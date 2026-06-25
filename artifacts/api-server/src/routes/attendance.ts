import { Router, type IRouter } from "express";
import { eq, and, sql, lte, gte } from "drizzle-orm";
import { db, attendanceTable, employeesTable, zonesTable, leavesTable } from "@workspace/db";
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

  // Present employees
  const records = await selectAttendanceWithJoins(eq(attendanceTable.date, today));
  const presentIds = new Set(records.map((r) => r.employeeId));

  // All active employees
  const allActive = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      employeeNumber: employeesTable.employeeNumber,
      photoUrl: employeesTable.photoUrl,
      department: employeesTable.department,
      position: employeesTable.position,
    })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));

  // Today's active leaves
  const activeLeaves = await db
    .select({
      id: leavesTable.id,
      employeeId: leavesTable.employeeId,
      type: leavesTable.type,
      reason: leavesTable.reason,
      startDate: leavesTable.startDate,
      endDate: leavesTable.endDate,
    })
    .from(leavesTable)
    .where(
      and(
        lte(leavesTable.startDate, today),
        gte(leavesTable.endDate, today),
        eq(leavesTable.status, "approved")
      )
    );

  const leaveByEmployee = new Map(activeLeaves.map((l) => [l.employeeId, l]));

  const absentRecords = allActive
    .filter((emp) => !presentIds.has(emp.id))
    .map((emp) => {
      const leave = leaveByEmployee.get(emp.id);
      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        employeePhotoUrl: emp.photoUrl,
        department: emp.department,
        position: emp.position,
        leaveId: leave?.id ?? null,
        leaveType: leave?.type ?? null,
        leaveReason: leave?.reason ?? null,
        leaveFrom: leave?.startDate ?? null,
        leaveTo: leave?.endDate ?? null,
      };
    });

  const totalEmployees = allActive.length;
  const presentCount = records.length;
  const onLeaveCount = absentRecords.filter((r) => r.leaveId !== null).length;
  const absentCount = Math.max(0, totalEmployees - presentCount);

  res.json(GetTodayAttendanceResponse.parse({
    date: today,
    presentCount,
    absentCount,
    onLeaveCount,
    totalEmployees,
    records,
    absentRecords,
  }));
});

export default router;
