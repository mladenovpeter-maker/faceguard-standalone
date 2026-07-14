import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql, isNotNull } from "drizzle-orm";
import { db, recognitionEventsTable, camerasTable, zonesTable, employeesTable, employeePhotosTable, attendanceTable } from "@workspace/db";
import {
  ListRecognitionsQueryParams,
  CreateRecognitionBody,
  ListRecognitionsResponse,
  CreateRecognitionResponse,
} from "@workspace/api-zod";
import { computeFaceDescriptor, matchDescriptor, type FaceCandidate } from "../lib/face-recognition";

const router: IRouter = Router();

// ── Event cooldown ──────────────────────────────────────────────────────────
const UNKNOWN_COOLDOWN_MS   = Number(process.env.UNKNOWN_EVENT_COOLDOWN_SECONDS   ?? 180) * 1000;
const RECOGNIZED_COOLDOWN_MS = Number(process.env.RECOGNIZED_EVENT_COOLDOWN_SECONDS ?? 300) * 1000;

const lastUnknownAt    = new Map<number, number>();
const lastRecognizedAt = new Map<string, number>();

function unknownCoolingDown(cameraId: number): boolean {
  const last = lastUnknownAt.get(cameraId);
  return last !== undefined && Date.now() - last < UNKNOWN_COOLDOWN_MS;
}
function recognizedCoolingDown(cameraId: number, employeeId: number): boolean {
  const last = lastRecognizedAt.get(`${cameraId}-${employeeId}`);
  return last !== undefined && Date.now() - last < RECOGNIZED_COOLDOWN_MS;
}
function markUnknown(cameraId: number): void { lastUnknownAt.set(cameraId, Date.now()); }
function markRecognized(cameraId: number, employeeId: number): void {
  lastRecognizedAt.set(`${cameraId}-${employeeId}`, Date.now());
}
// ────────────────────────────────────────────────────────────────────────────

/**
 * Upsert attendance with turnstile zone support.
 *   entry zone  → sets clockInAt  (earliest of the day)
 *   exit zone   → sets clockOutAt (latest of the day)
 *   general/null → classic firstSeen/lastSeen fallback
 */
async function upsertAttendance(
  employeeId: number,
  zoneId: number | null,
  zoneType: string | null,
  detectedAt: Date,
): Promise<void> {
  const dateStr = detectedAt.toISOString().slice(0, 10);
  const ts = detectedAt.toISOString();

  if (zoneType === "entry") {
    await db
      .insert(attendanceTable)
      .values({ employeeId, date: dateStr, firstSeen: detectedAt, lastSeen: detectedAt, clockInAt: detectedAt, zoneId, totalMinutes: 0 })
      .onConflictDoUpdate({
        target: [attendanceTable.employeeId, attendanceTable.date],
        set: {
          clockInAt: sql`LEAST(COALESCE(${attendanceTable.clockInAt}, ${ts}::timestamptz), ${ts}::timestamptz)`,
          totalMinutes: sql`CASE
            WHEN ${attendanceTable.clockOutAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (
              ${attendanceTable.clockOutAt} -
              LEAST(COALESCE(${attendanceTable.clockInAt}, ${ts}::timestamptz), ${ts}::timestamptz)
            ))::int / 60
            ELSE ${attendanceTable.totalMinutes}
          END`,
          firstSeen: sql`LEAST(${attendanceTable.firstSeen}, ${ts}::timestamptz)`,
          updatedAt: sql`NOW()`,
        },
      });
    return;
  }

  if (zoneType === "exit") {
    await db
      .insert(attendanceTable)
      .values({ employeeId, date: dateStr, firstSeen: detectedAt, lastSeen: detectedAt, clockOutAt: detectedAt, zoneId, totalMinutes: 0 })
      .onConflictDoUpdate({
        target: [attendanceTable.employeeId, attendanceTable.date],
        set: {
          clockOutAt: sql`GREATEST(COALESCE(${attendanceTable.clockOutAt}, ${ts}::timestamptz), ${ts}::timestamptz)`,
          lastSeen: sql`GREATEST(${attendanceTable.lastSeen}, ${ts}::timestamptz)`,
          totalMinutes: sql`CASE
            WHEN ${attendanceTable.clockInAt} IS NOT NULL
            THEN EXTRACT(EPOCH FROM (
              GREATEST(COALESCE(${attendanceTable.clockOutAt}, ${ts}::timestamptz), ${ts}::timestamptz) -
              ${attendanceTable.clockInAt}
            ))::int / 60
            ELSE ${attendanceTable.totalMinutes}
          END`,
          updatedAt: sql`NOW()`,
        },
      });
    return;
  }

  // General fallback
  await db
    .insert(attendanceTable)
    .values({ employeeId, date: dateStr, firstSeen: detectedAt, lastSeen: detectedAt, zoneId, totalMinutes: 0 })
    .onConflictDoUpdate({
      target: [attendanceTable.employeeId, attendanceTable.date],
      set: {
        lastSeen: sql`GREATEST(${attendanceTable.lastSeen}, ${ts}::timestamptz)`,
        firstSeen: sql`LEAST(${attendanceTable.firstSeen}, ${ts}::timestamptz)`,
        totalMinutes: sql`EXTRACT(EPOCH FROM (
          GREATEST(${attendanceTable.lastSeen}, ${ts}::timestamptz) -
          LEAST(${attendanceTable.firstSeen}, ${ts}::timestamptz)
        ))::int / 60`,
        updatedAt: sql`NOW()`,
      },
    });
}

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
    .leftJoin(camerasTable, cameraJoinCondition)
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

  let status = parsed.data.status;
  let employeeId = parsed.data.employeeId ?? null;
  let confidence = parsed.data.confidence;

  // Fetch camera zone (and zone type) once — needed for attendance records.
  const [cam] = await db
    .select({ zoneId: camerasTable.zoneId, zoneType: zonesTable.zoneType })
    .from(camerasTable)
    .leftJoin(zonesTable, eq(zonesTable.id, camerasTable.zoneId))
    .where(eq(camerasTable.id, parsed.data.cameraId));
  const camZoneId   = cam?.zoneId   ?? null;
  const camZoneType = cam?.zoneType ?? null;

  const detectedAt = new Date(parsed.data.detectedAt);
  const cameraId   = parsed.data.cameraId;

  // Internal AI fallback: only runs when camera sent status "unknown" + snapshot.
  if (status === "unknown" && parsed.data.snapshotBase64) {
    try {
      const base64Data = parsed.data.snapshotBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const descriptor = await computeFaceDescriptor(buffer);

      if (!descriptor) {
        res.status(204).end();
        return;
      }

      const photos = await db
        .select({ employeeId: employeePhotosTable.employeeId, faceDescriptor: employeePhotosTable.faceDescriptor })
        .from(employeePhotosTable)
        .where(isNotNull(employeePhotosTable.faceDescriptor));

      const candidates: FaceCandidate[] = photos
        .filter((p) => p.faceDescriptor)
        .map((p) => ({ employeeId: p.employeeId, descriptor: p.faceDescriptor as number[] }));

      const match = matchDescriptor(descriptor, candidates);

      if (match) {
        // Always update attendance (cooldown only suppresses the log entry).
        await upsertAttendance(match.employeeId, camZoneId, camZoneType, detectedAt).catch((e) =>
          req.log.warn({ err: e, employeeId: match.employeeId }, "Attendance upsert failed"),
        );

        if (recognizedCoolingDown(cameraId, match.employeeId)) {
          req.log.info({ employeeId: match.employeeId, cameraId }, "Recognized — cooldown active, skipping event");
          res.status(204).end();
          return;
        }
        markRecognized(cameraId, match.employeeId);

        status     = "recognized";
        employeeId = match.employeeId;
        confidence = match.confidence / 100;
        req.log.info({ employeeId, distance: match.distance }, "AI fallback matched a face");
      } else {
        if (unknownCoolingDown(cameraId)) {
          req.log.info({ cameraId }, "Unknown face — cooldown active, skipping event");
          res.status(204).end();
          return;
        }
        markUnknown(cameraId);
        req.log.info({ cameraId }, "AI fallback: face detected but no match");
      }
    } catch (err) {
      req.log.warn({ err }, "Internal AI fallback matching failed");
    }
  } else if (status === "recognized" && employeeId) {
    // Camera itself recognized — still update attendance.
    await upsertAttendance(employeeId, camZoneId, camZoneType, detectedAt).catch((e) =>
      req.log.warn({ err: e, employeeId }, "Attendance upsert failed"),
    );
  }

  const [event] = await db.insert(recognitionEventsTable).values({
    cameraId,
    employeeId,
    status,
    confidence,
    snapshotUrl: parsed.data.snapshotUrl ?? null,
    detectedAt,
  }).returning();

  const [zone] = camZoneId ? await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, camZoneId)) : [null];
  const [emp]  = employeeId ? await db.select().from(employeesTable).where(eq(employeesTable.id, employeeId)) : [null];

  res.status(201).json(CreateRecognitionResponse.parse({
    ...event,
    cameraName: cam ? (await db.select({ name: camerasTable.name }).from(camerasTable).where(eq(camerasTable.id, cameraId)))[0]?.name ?? null : null,
    zoneId: camZoneId,
    zoneName: zone?.name ?? null,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeNumber: emp?.employeeNumber ?? null,
    employeePhotoUrl: emp?.photoUrl ?? null,
  }));
});

export default router;
