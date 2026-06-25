import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db, recognitionEventsTable, camerasTable, zonesTable, employeesTable } from "@workspace/db";
import {
  ListRecognitionsQueryParams,
  CreateRecognitionBody,
  ListRecognitionsResponse,
  CreateRecognitionResponse,
} from "@workspace/api-zod";

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

  const [event] = await db.insert(recognitionEventsTable).values({
    cameraId: parsed.data.cameraId,
    employeeId: parsed.data.employeeId ?? null,
    status: parsed.data.status,
    confidence: parsed.data.confidence,
    snapshotUrl: parsed.data.snapshotUrl ?? null,
    detectedAt: new Date(parsed.data.detectedAt),
  }).returning();

  const [camera] = await db.select({ name: camerasTable.name, zoneId: camerasTable.zoneId })
    .from(camerasTable).where(eq(camerasTable.id, event.cameraId));

  const zoneId = camera?.zoneId ?? null;
  const [zone] = zoneId ? await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, zoneId)) : [null];
  const [emp] = event.employeeId ? await db.select().from(employeesTable).where(eq(employeesTable.id, event.employeeId)) : [null];

  const result = {
    ...event,
    cameraName: camera?.name ?? null,
    zoneId: zoneId,
    zoneName: zone?.name ?? null,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeNumber: emp?.employeeNumber ?? null,
    employeePhotoUrl: emp?.photoUrl ?? null,
  };

  res.status(201).json(CreateRecognitionResponse.parse(result));
});

export default router;
