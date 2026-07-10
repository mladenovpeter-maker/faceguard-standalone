import { Router, type IRouter } from "express";
import { eq, and, sql, lte, gte } from "drizzle-orm";
import { db, attendanceTable, employeesTable, zonesTable, leavesTable, departmentsTable } from "@workspace/db";
import {
  ListAttendanceQueryParams,
  ListAttendanceResponse,
  GetTodayAttendanceResponse,
  GetAttendanceReportResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/* ── helpers ── */

function countWorkingDays(from: string, to: string): number {
  let count = 0;
  const cur = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  while (cur <= end) {
    const d = cur.getUTCDay();
    if (d !== 0 && d !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function countLeaveDaysInRange(
  leaves: { startDate: string; endDate: string }[],
  from: string,
  to: string
): number {
  const fromMs = new Date(from + "T12:00:00Z").getTime();
  const toMs   = new Date(to   + "T12:00:00Z").getTime();
  let count = 0;
  for (const leave of leaves) {
    const startMs = Math.max(new Date(leave.startDate + "T12:00:00Z").getTime(), fromMs);
    const endMs   = Math.min(new Date(leave.endDate   + "T12:00:00Z").getTime(), toMs);
    const cur = new Date(startMs);
    const endDate = new Date(endMs);
    while (cur <= endDate) {
      const d = cur.getUTCDay();
      if (d !== 0 && d !== 6) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return count;
}

function avgTimeHHMM(datetimes: (string | null)[]): string | null {
  const valid = datetimes.filter(Boolean) as string[];
  if (valid.length === 0) return null;
  const mins = valid.map((t) => {
    const d = new Date(t);
    return d.getHours() * 60 + d.getMinutes();
  });
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}

/* ── routes ── */

router.get("/attendance", async (req, res): Promise<void> => {
  const query = ListAttendanceQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { date, employeeId } = query.data;
  const conditions = [];
  if (date) conditions.push(eq(attendanceTable.date, String(date)));
  if (employeeId != null) conditions.push(eq(attendanceTable.employeeId, employeeId));

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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(attendanceTable.firstSeen);

  res.json(ListAttendanceResponse.parse(records));
});

router.get("/attendance/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

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
    .where(eq(attendanceTable.date, today))
    .orderBy(attendanceTable.firstSeen);

  const presentIds = new Set(records.map((r) => r.employeeId));

  const allActive = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      employeeNumber: employeesTable.employeeNumber,
      photoUrl: employeesTable.photoUrl,
      departmentName: departmentsTable.name,
      position: employeesTable.position,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.status, "active"));

  const activeLeaves = await db
    .select()
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
        departmentName: emp.departmentName ?? "",
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

router.get("/attendance/report", async (req, res): Promise<void> => {
  const { from, to, employeeId, departmentId } = req.query as Record<string, string | undefined>;

  if (!from || !to) {
    res.status(400).json({ error: "from и to са задължителни" });
    return;
  }

  // All active employees (optionally filtered)
  const empConditions: ReturnType<typeof eq>[] = [eq(employeesTable.status, "active")];
  if (departmentId) empConditions.push(eq(employeesTable.departmentId, Number(departmentId)));
  if (employeeId) empConditions.push(eq(employeesTable.id, Number(employeeId)));

  const allEmployees = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      employeeNumber: employeesTable.employeeNumber,
      photoUrl: employeesTable.photoUrl,
      departmentName: departmentsTable.name,
      position: employeesTable.position,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(and(...empConditions));

  const empIds = allEmployees.map((e) => e.id);
  if (empIds.length === 0) {
    res.json(GetAttendanceReportResponse.parse({
      from,
      to,
      totalEmployees: 0,
      workingDays: countWorkingDays(from, to),
      rows: [],
    }));
    return;
  }

  // Attendance records in range
  const attendance = await db
    .select({
      id: attendanceTable.id,
      employeeId: attendanceTable.employeeId,
      date: attendanceTable.date,
      firstSeen: attendanceTable.firstSeen,
      lastSeen: attendanceTable.lastSeen,
      totalMinutes: attendanceTable.totalMinutes,
      zoneName: zonesTable.name,
    })
    .from(attendanceTable)
    .leftJoin(zonesTable, eq(zonesTable.id, attendanceTable.zoneId))
    .where(
      and(
        gte(attendanceTable.date, from),
        lte(attendanceTable.date, to)
      )
    );

  // Approved leaves overlapping range
  const leaves = await db
    .select()
    .from(leavesTable)
    .where(
      and(
        lte(leavesTable.startDate, to),
        gte(leavesTable.endDate, from),
        eq(leavesTable.status, "approved")
      )
    );

  const workingDays = countWorkingDays(from, to);
  const isSingleDay = from === to;

  const rows = allEmployees.map((emp) => {
    const empAtt = attendance.filter((r) => r.employeeId === emp.id);
    const empLeaves = leaves.filter((l) => l.employeeId === emp.id);

    const daysPresent = empAtt.length;
    const totalMinutes = empAtt.reduce((s, r) => s + (r.totalMinutes ?? 0), 0);
    const daysOnLeave = countLeaveDaysInRange(
      empLeaves.map((l) => ({ startDate: l.startDate, endDate: l.endDate })),
      from,
      to
    );
    const daysAbsent = Math.max(0, workingDays - daysPresent - daysOnLeave);

    const avgFirstSeen = avgTimeHHMM(empAtt.map((r) => r.firstSeen));
    const avgLastSeen  = avgTimeHHMM(empAtt.map((r) => r.lastSeen));

    // For single-day drill-down
    const dayRec = isSingleDay ? empAtt[0] : undefined;
    const dayLeave = isSingleDay
      ? empLeaves.find((l) => l.startDate <= from && l.endDate >= from)
      : undefined;

    return {
      employeeId:       emp.id,
      employeeName:     `${emp.firstName} ${emp.lastName}`,
      employeeNumber:   emp.employeeNumber,
      employeePhotoUrl: emp.photoUrl ?? null,
      departmentName:   emp.departmentName ?? "",
      position:         emp.position ?? "",
      daysPresent,
      daysAbsent,
      daysOnLeave,
      totalMinutes,
      avgFirstSeen,
      avgLastSeen,
      firstSeen:   dayRec?.firstSeen  ?? null,
      lastSeen:    dayRec?.lastSeen   ?? null,
      zoneName:    dayRec?.zoneName   ?? null,
      leaveType:   dayLeave?.type     ?? null,
      leaveReason: dayLeave?.reason   ?? null,
    };
  });

  res.json(GetAttendanceReportResponse.parse({
    from,
    to,
    totalEmployees: allEmployees.length,
    workingDays,
    rows,
  }));
});

export default router;
