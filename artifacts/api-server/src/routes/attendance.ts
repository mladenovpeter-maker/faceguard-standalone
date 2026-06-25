import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, attendanceTable, employeesTable, zonesTable } from "@workspace/db";
import {
  ListAttendanceQueryParams,
  ListAttendanceResponse,
  GetTodayAttendanceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectAttendanceWithJoins = async (conditions?: any) => {
  const records = await db
    .select({
      id: attendanceTable.id,
      employeeId: attendanceTable.employeeId,
      employeeName: sql<string | null>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
      employeeNumber: employeesTable.employeeNumber,
      employeePhotoUrl: employeesTable.photoUrl,
      date: attendanceTable.date,
      firstSeen: attendanceTable.firstSeen,
      lastSeen: attendanceTable.lastSeen,
      zoneId: attendanceTable.zoneId,
      zoneName: zonesTable.name,
      totalMinutes: attendanceTable.totalMinutes,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(employeesTable.id, attendanceTable.employeeId))
    .leftJoin(zonesTable, eq(zonesTable.id, attendanceTable.zoneId))
    .where(conditions)
    .orderBy(attendanceTable.firstSeen);

  return records;
};

router.get("/attendance", async (req, res): Promise<void> => {
  const query = ListAttendanceQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { date, employeeId, zoneId } = query.data;

  const conditions = [];
  if (date) conditions.push(eq(attendanceTable.date, String(date)));
  if (employeeId != null) conditions.push(eq(attendanceTable.employeeId, employeeId));

  const records = await selectAttendanceWithJoins(
    conditions.length > 0 ? and(...conditions) : undefined
  );

  res.json(ListAttendanceResponse.parse(records));
});

router.get("/attendance/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const records = await selectAttendanceWithJoins(eq(attendanceTable.date, today));

  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));

  const totalEmployees = totalRow?.count ?? 0;
  const presentCount = records.length;

  res.json(GetTodayAttendanceResponse.parse({
    date: today,
    presentCount,
    absentCount: Math.max(0, totalEmployees - presentCount),
    totalEmployees,
    records,
  }));
});

export default router;
