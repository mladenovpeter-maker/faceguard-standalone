import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql, isNotNull } from "drizzle-orm";
import { db, recognitionEventsTable, camerasTable, zonesTable, employeesTable, employeePhotosTable } from "@workspace/db";
import {
  ListRecognitionsQueryParams,
  CreateRecognitionBody,
  ListRecognitionsResponse,
  CreateRecognitionResponse,
} from "@workspace/api-zod";
import { computeAllFaceDescriptorsAsync } from "../lib/face-recognition-pool";
import { matchDescriptor, type FaceCandidate } from "../lib/face-recognition";

const router: IRouter = Router();

router.get("/recognitions", async (req, res): Promise<void> => {
  const query = ListRecognitionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { employeeId, cameraId, zoneId, from, to, status, limit } = query.data;

  const conditions = [];
  if (employeeId != null) conditions.push(eq(recognitionEventsTable.employeeId, employeeId));
  if (cameraId != null) conditions.push(eq(recognitionEventsTable.cameraId, cameraId));
  if (status && status !== "all") conditions.push(eq(recognitionEventsTable.status, status));
  if (from) conditions.push(gte(recognitionEventsTable.detectedAt, new Date(from)));
  if (to) conditions.push(lte(recognitionEventsTable.detectedAt, new Date(to)));

  // Filter by zone via camera join
  const cameraJoinCondition = zoneId != null
    ? and(eq(camerasTable.id, recognitionEventsTable.cameraId), eq(camerasTable.zoneId, zoneId))
    : eq(camerasTable.id, recognitionEventsTable.cameraId);

  const events = await db
    .select({
      id: recognitionEventsTable.id,
      cameraId: recognitionEventsTable.cameraId,
      cameraName: camerasTable.name,
      zoneId: camerasTable.zoneId,
      zoneName: zonesTable.name,
      employeeId: recognitionEventsTable.employeeId,
      employeeName: sql<string | null>`case when ${employeesTable.id} is not null then concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName}) else null end`,
      employeeNumber: employeesTable.employeeNumber,
      employeePhotoUrl: employeesTable.photoUrl,
      status: recognitionEventsTable.status,
      confidence: recognitionEventsTable.confidence,
      snapshotUrl: recognitionEventsTable.snapshotUrl,
      detectedAt: recognitionEventsTable.detectedAt,
    })
    .from(recognitionEventsTable)
    .leftJoin(camerasTable, eq(camerasTable.id, recognitionEventsTable.cameraId))
    .leftJoin(zonesTable, eq(zonesTable.id, camerasTable.zoneId))
    .leftJoin(employeesTable, eq(employeesTable.id, recognitionEventsTable.employeeId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(recognitionEventsTable.detectedAt))
    .limit(limit ?? 50);

  res.json(ListRecognitionsResponse.parse(events));
});

router.post("/recognitions", async (req, res): Promise<void> => {
  const parsed = CreateRecognitionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Internal AI fallback: only runs when the camera itself did not recognize anyone
  // (status "unknown") and a raw snapshot was supplied.
  // Uses detectAllFaces so a single frame can register an entire group.
  if (parsed.data.status === "unknown" && parsed.data.snapshotBase64) {
    try {
      const base64Data = parsed.data.snapshotBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const descriptors = await computeAllFaceDescriptorsAsync(buffer);

      if (descriptors.length === 0) {
        // Empty frame — no person in view, nothing to record.
        res.status(204).end();
        return;
      }

      // Load all enrolled face descriptors once, then match each detected face.
      const photos = await db
        .select({ employeeId: employeePhotosTable.employeeId, faceDescriptor: employeePhotosTable.faceDescriptor })
        .from(employeePhotosTable)
        .where(isNotNull(employeePhotosTable.faceDescriptor));

      const candidates: FaceCandidate[] = photos
        .filter((p) => p.faceDescriptor)
        .map((p) => ({ employeeId: p.employeeId, descriptor: p.faceDescriptor as number[] }));

      const snapshotUrl = parsed.data.snapshotUrl ?? parsed.data.snapshotBase64 ?? null;
      const detectedAt = new Date(parsed.data.detectedAt);

      const insertedEvents = await Promise.all(
        descriptors.map(async (descriptor) => {
          const match = matchDescriptor(descriptor, candidates);
          const [evt] = await db.insert(recognitionEventsTable).values({
            cameraId: parsed.data.cameraId,
            employeeId: match ? match.employeeId : null,
            status: match ? "recognized" : "unknown",
            confidence: match ? match.confidence / 100 : 0,
            snapshotUrl,
            detectedAt,
          }).returning();
          req.log.info(
            match
              ? { employeeId: match.employeeId, distance: match.distance }
              : {},
            match ? "AI fallback matched a face" : "AI fallback: face detected but no match",
          );
          return evt;
        }),
      );

      req.log.info({ count: insertedEvents.length }, "Group frame processed");

      // Respond with the first event (API contract unchanged; worker only needs 201 vs 204).
      const firstEvent = insertedEvents[0];
      const [camera] = await db.select({ name: camerasTable.name, zoneId: camerasTable.zoneId })
        .from(camerasTable).where(eq(camerasTable.id, firstEvent.cameraId));
      const zoneId = camera?.zoneId ?? null;
      const [zone] = zoneId ? await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, zoneId)) : [null];
      const [emp] = firstEvent.employeeId ? await db.select().from(employeesTable).where(eq(employeesTable.id, firstEvent.employeeId)) : [null];

      res.status(201).json(CreateRecognitionResponse.parse({
        ...firstEvent,
        cameraName: camera?.name ?? null,
        zoneId,
        zoneName: zone?.name ?? null,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
        employeeNumber: emp?.employeeNumber ?? null,
        employeePhotoUrl: emp?.photoUrl ?? null,
      }));
      return;
    } catch (err) {
      req.log.warn({ err }, "Internal AI fallback matching failed");
    }
  }

  // Non-AI path: camera already decided status (recognized / denied) — trust it.
  const snapshotUrl = parsed.data.snapshotUrl ?? null;
  const [event] = await db.insert(recognitionEventsTable).values({
    cameraId: parsed.data.cameraId,
    employeeId: parsed.data.employeeId ?? null,
    status: parsed.data.status,
    confidence: parsed.data.confidence,
    snapshotUrl,
    detectedAt: new Date(parsed.data.detectedAt),
  }).returning();

  const [camera] = await db.select({ name: camerasTable.name, zoneId: camerasTable.zoneId })
    .from(camerasTable).where(eq(camerasTable.id, event.cameraId));

  const zoneId = camera?.zoneId ?? null;
  const [zone] = zoneId ? await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, zoneId)) : [null];
  const [emp] = event.employeeId ? await db.select().from(employeesTable).where(eq(employeesTable.id, event.employeeId)) : [null];

  res.status(201).json(CreateRecognitionResponse.parse({
    ...event,
    cameraName: camera?.name ?? null,
    zoneId,
    zoneName: zone?.name ?? null,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeNumber: emp?.employeeNumber ?? null,
    employeePhotoUrl: emp?.photoUrl ?? null,
  }));
});

export default router;
