import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql, isNotNull } from "drizzle-orm";
import { db, recognitionEventsTable, camerasTable, zonesTable, employeesTable, employeePhotosTable, attendanceTable } from "@workspace/db";
import {
  ListRecognitionsQueryParams,
  CreateRecognitionBody,
  ListRecognitionsResponse,
  CreateRecognitionResponse,
} from "@workspace/api-zod";
import { computeAllFaceDescriptorsAsync } from "../lib/face-recognition-pool";
import { matchDescriptor, type FaceCandidate } from "../lib/face-recognition";
import { saveSnapshot, SNAPSHOTS_DIR } from "../lib/snapshot-store";

const router: IRouter = Router();

// ── Event cooldown ──────────────────────────────────────────────────────────
// Prevents spam from a static camera polling the same scene every 5 seconds.
//
// unknownCooldownMs  — min gap between two "unknown" events from the same camera.
//   Default 3 min. Set UNKNOWN_EVENT_COOLDOWN_SECONDS in .env to override.
// recognizedCooldownMs — min gap between two "recognized" events for the same
//   employee+camera pair. Attendance is still updated on every recognition;
//   only the log entry is suppressed. Default 5 min.
//   Set RECOGNIZED_EVENT_COOLDOWN_SECONDS in .env to override.
const UNKNOWN_COOLDOWN_MS = Number(process.env.UNKNOWN_EVENT_COOLDOWN_SECONDS ?? 180) * 1000;
const RECOGNIZED_COOLDOWN_MS = Number(process.env.RECOGNIZED_EVENT_COOLDOWN_SECONDS ?? 300) * 1000;

// cameraId → last unknown event timestamp
const lastUnknownAt = new Map<number, number>();
// `${cameraId}-${employeeId}` → last recognized event timestamp
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
 * Upsert an attendance record for a recognized employee.
 *
 * Turnstile mode (zone has zoneType = 'entry' or 'exit'):
 *   - entry zone: sets clockInAt (keeps the earliest clock-in of the day)
 *   - exit zone:  sets clockOutAt (keeps the latest clock-out of the day)
 *   - totalMinutes = clockOutAt - clockInAt (when both are present)
 *
 * General / no-zone mode (zoneType = 'general' or null):
 *   - falls back to firstSeen/lastSeen logic (original behaviour)
 *   - totalMinutes = lastSeen - firstSeen
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
      .values({
        employeeId,
        date: dateStr,
        firstSeen: detectedAt,
        lastSeen: detectedAt,
        clockInAt: detectedAt,
        currentlyInside: true,
        zoneId,
        totalMinutes: 0,
      })
      .onConflictDoUpdate({
        target: [attendanceTable.employeeId, attendanceTable.date],
        set: {
          // Keep earliest clock-in
          clockInAt: sql`LEAST(COALESCE(${attendanceTable.clockInAt}, ${ts}::timestamptz), ${ts}::timestamptz)`,
          // Mark as currently inside (re-entry after lunch break etc.)
          currentlyInside: true,
          // Recalculate totalMinutes if clockOut already recorded
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
      .values({
        employeeId,
        date: dateStr,
        firstSeen: detectedAt,
        lastSeen: detectedAt,
        clockOutAt: detectedAt,
        currentlyInside: false,
        zoneId,
        totalMinutes: 0,
      })
      .onConflictDoUpdate({
        target: [attendanceTable.employeeId, attendanceTable.date],
        set: {
          // Keep latest clock-out
          clockOutAt: sql`GREATEST(COALESCE(${attendanceTable.clockOutAt}, ${ts}::timestamptz), ${ts}::timestamptz)`,
          lastSeen: sql`GREATEST(${attendanceTable.lastSeen}, ${ts}::timestamptz)`,
          // Mark as not currently inside
          currentlyInside: false,
          // Recalculate totalMinutes if clockIn already recorded
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

  // General / no-zone fallback: classic firstSeen/lastSeen
  await db
    .insert(attendanceTable)
    .values({
      employeeId,
      date: dateStr,
      firstSeen: detectedAt,
      lastSeen: detectedAt,
      zoneId,
      totalMinutes: 0,
    })
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

      const detectedAt = new Date(parsed.data.detectedAt);
      const snapshotUrl = await saveSnapshot(
        parsed.data.snapshotUrl ?? parsed.data.snapshotBase64 ?? null,
        detectedAt,
      ).catch((err: unknown) => {
        req.log.error({ err, snapshotsDir: SNAPSHOTS_DIR }, "saveSnapshot failed — check Docker volume mount at /app/snapshots");
        return null;
      });

      // Fetch camera zone (and zone type) once — needed for attendance records.
      const [cam] = await db
        .select({ zoneId: camerasTable.zoneId, zoneType: zonesTable.zoneType })
        .from(camerasTable)
        .leftJoin(zonesTable, eq(zonesTable.id, camerasTable.zoneId))
        .where(eq(camerasTable.id, parsed.data.cameraId));
      const camZoneId   = cam?.zoneId   ?? null;
      const camZoneType = cam?.zoneType ?? null;

      const cameraId = parsed.data.cameraId;
      const eventsToInsert = descriptors.map((descriptor) => ({
        descriptor,
        match: matchDescriptor(descriptor, candidates),
      }));

      // Apply cooldown: suppress creating a new log entry if the same face/camera
      // was seen too recently. Attendance is ALWAYS updated regardless.
      const insertedEvents = (
        await Promise.all(
          eventsToInsert.map(async ({ descriptor: _d, match }) => {
            if (match) {
              // Always update attendance so lastSeen/clockIn/clockOut stays current.
              await upsertAttendance(match.employeeId, camZoneId, camZoneType, detectedAt).catch((e) =>
                req.log.warn({ err: e, employeeId: match.employeeId }, "Attendance upsert failed"),
              );
              if (recognizedCoolingDown(cameraId, match.employeeId)) {
                req.log.info({ employeeId: match.employeeId, cameraId }, "Recognized — cooldown active, skipping event");
                return null;
              }
              markRecognized(cameraId, match.employeeId);
            } else {
              if (unknownCoolingDown(cameraId)) {
                req.log.info({ cameraId }, "Unknown face — cooldown active, skipping event");
                return null;
              }
              markUnknown(cameraId);
            }

            const [evt] = await db.insert(recognitionEventsTable).values({
              cameraId,
              employeeId: match ? match.employeeId : null,
              status: match ? "recognized" : "unknown",
              confidence: match ? match.confidence / 100 : 0,
              snapshotUrl,
              detectedAt,
            }).returning();
            req.log.info(
              match ? { employeeId: match.employeeId, distance: match.distance } : {},
              match ? "AI fallback matched a face" : "AI fallback: face detected but no match",
            );
            return evt;
          }),
        )
      ).filter(Boolean);

      req.log.info({ descriptorCount: descriptors.length, insertedCount: insertedEvents.length }, "Group frame processed");

      // All events were suppressed by cooldown — no new log entries needed.
      if (insertedEvents.length === 0) {
        res.status(204).end();
        return;
      }

      // Respond with the first event (API contract unchanged; worker only needs 201 vs 204).
      const firstEvent = insertedEvents[0]!;
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
  const detectedAtNonAi = new Date(parsed.data.detectedAt);
  const snapshotUrl = await saveSnapshot(parsed.data.snapshotUrl ?? null, detectedAtNonAi).catch((err: unknown) => {
    req.log.error({ err, snapshotsDir: SNAPSHOTS_DIR }, "saveSnapshot failed — check Docker volume mount at /app/snapshots");
    return null;
  });
  const [event] = await db.insert(recognitionEventsTable).values({
    cameraId: parsed.data.cameraId,
    employeeId: parsed.data.employeeId ?? null,
    status: parsed.data.status,
    confidence: parsed.data.confidence,
    snapshotUrl,
    detectedAt: detectedAtNonAi,
  }).returning();

  const [camera] = await db
    .select({ name: camerasTable.name, zoneId: camerasTable.zoneId, zoneType: zonesTable.zoneType })
    .from(camerasTable)
    .leftJoin(zonesTable, eq(zonesTable.id, camerasTable.zoneId))
    .where(eq(camerasTable.id, event.cameraId));

  const zoneId   = camera?.zoneId   ?? null;
  const zoneType = camera?.zoneType ?? null;

  // Sync attendance when the camera itself confirmed recognition.
  if (event.status === "recognized" && event.employeeId) {
    await upsertAttendance(event.employeeId, zoneId, zoneType, detectedAtNonAi).catch((e) =>
      req.log.warn({ err: e, employeeId: event.employeeId }, "Attendance upsert failed"),
    );
  }
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
