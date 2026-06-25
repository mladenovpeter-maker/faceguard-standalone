import { Router, type IRouter } from "express";
import { eq, desc, gte, sql, and, lte } from "drizzle-orm";
import { db, employeesTable, camerasTable, zonesTable, recognitionEventsTable, attendanceTable, leavesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentEventsResponse,
  GetHourlyActivityResponse,
  GetDashboardPresenceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00Z`);

  const [[totalEmpRow], [activeEmpRow], [totalCamRow], [onlineCamRow], [totalZoneRow], [todayPresentRow], todayStats] =
    await Promise.all([
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(employeesTable),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(employeesTable).where(eq(employeesTable.status, "active")),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(camerasTable),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(camerasTable).where(eq(camerasTable.status, "online")),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(zonesTable),
      db.select({ count: sql<number>`cast(count(*) as int)` }).from(attendanceTable).where(eq(attendanceTable.date, today)),
      db.select({
        status: recognitionEventsTable.status,
        count: sql<number>`cast(count(*) as int)`,
      })
        .from(recognitionEventsTable)
        .where(gte(recognitionEventsTable.detectedAt, todayStart))
        .groupBy(recognitionEventsTable.status),
    ]);

  let todayRecognitions = 0, unknownToday = 0, deniedToday = 0;
  for (const row of todayStats) {
    todayRecognitions += row.count;
    if (row.status === "unknown") unknownToday = row.count;
    if (row.status === "denied") deniedToday = row.count;
  }

  res.json(GetDashboardSummaryResponse.parse({
    totalEmployees: totalEmpRow?.count ?? 0,
    activeEmployees: activeEmpRow?.count ?? 0,
    totalCameras: totalCamRow?.count ?? 0,
    onlineCameras: onlineCamRow?.count ?? 0,
    totalZones: totalZoneRow?.count ?? 0,
    todayPresent: todayPresentRow?.count ?? 0,
    todayRecognitions,
    unknownToday,
    deniedToday,
  }));
});

router.get("/dashboard/recent-events", async (_req, res): Promise<void> => {
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
    .orderBy(desc(recognitionEventsTable.detectedAt))
    .limit(20);

  res.json(GetRecentEventsResponse.parse(events));
});

router.get("/dashboard/hourly-activity", async (_req, res): Promise<void> => {
  const todayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  const rows = await db
    .select({
      hour: sql<number>`cast(extract(hour from ${recognitionEventsTable.detectedAt} at time zone 'UTC') as int)`,
      status: recognitionEventsTable.status,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(recognitionEventsTable)
    .where(gte(recognitionEventsTable.detectedAt, todayStart))
    .groupBy(
      sql`extract(hour from ${recognitionEventsTable.detectedAt} at time zone 'UTC')`,
      recognitionEventsTable.status,
    );

  const hourMap: Record<number, { hour: number; recognized: number; unknown: number; denied: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourMap[h] = { hour: h, recognized: 0, unknown: 0, denied: 0 };
  }
  for (const row of rows) {
    const h = row.hour;
    if (hourMap[h]) {
      if (row.status === "recognized") hourMap[h].recognized = row.count;
      else if (row.status === "unknown") hourMap[h].unknown = row.count;
      else if (row.status === "denied") hourMap[h].denied = row.count;
    }
  }

  res.json(GetHourlyActivityResponse.parse(Object.values(hourMap)));
});

router.get("/dashboard/presence", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      employeeNumber: employeesTable.employeeNumber,
      department: employeesTable.department,
      position: employeesTable.position,
      photoUrl: employeesTable.photoUrl,
      status: employeesTable.status,
      firstSeen: attendanceTable.firstSeen,
      lastSeen: attendanceTable.lastSeen,
      totalMinutes: attendanceTable.totalMinutes,
      leaveType: leavesTable.type,
    })
    .from(employeesTable)
    .leftJoin(
      attendanceTable,
      and(
        eq(attendanceTable.employeeId, employeesTable.id),
        eq(attendanceTable.date, today),
      ),
    )
    .leftJoin(
      leavesTable,
      and(
        eq(leavesTable.employeeId, employeesTable.id),
        eq(leavesTable.status, "approved"),
        lte(leavesTable.startDate, today),
        gte(leavesTable.endDate, today),
      ),
    )
    .where(eq(employeesTable.status, "active"))
    .orderBy(employeesTable.firstName);

  const result = rows.map(r => ({
    ...r,
    present: r.firstSeen !== null,
    onLeave: r.leaveType !== null,
    leaveType: r.leaveType ?? null,
    firstSeen: r.firstSeen ? r.firstSeen.toISOString() : null,
    lastSeen: r.lastSeen ? r.lastSeen.toISOString() : null,
  }));

  res.json(GetDashboardPresenceResponse.parse(result));
});

export default router;
