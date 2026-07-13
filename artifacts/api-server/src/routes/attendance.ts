import { Router, type IRouter } from "express";
import { eq, and, sql, lte, gte } from "drizzle-orm";
import {
  db, attendanceTable, employeesTable, zonesTable, leavesTable,
  departmentsTable, departmentWorkSchedulesTable,
} from "@workspace/db";
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

function avgTimeHHMM(datetimes: (string | Date | null)[]): string | null {
  const valid = datetimes.filter(Boolean) as (string | Date)[];
  if (valid.length === 0) return null;
  const mins = valid.map((t) => {
    const d = typeof t === "string" ? new Date(t) : t;
    return d.getHours() * 60 + d.getMinutes();
  });
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}

/** Parse "HH:MM" → minutes since midnight */
function toMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

const LATE_GRACE_MINUTES  = 30;
const EARLY_GRACE_MINUTES = 30;

type ScheduleInfo = {
  scheduleStatus: "on_time" | "late" | "no_schedule";
  minutesLate:    number | null;
  scheduleStart:  string | null;
  scheduleEnd:    string | null;
  earlyDeparture: boolean | null;
  minutesEarly:   number | null;
};

function computeScheduleInfo(
  firstSeen: string | Date | null,
  lastSeen:  string | Date | null,
  scheduleStartTime: string | null,
  scheduleEndTime:   string | null,
): ScheduleInfo {
  const noSched: ScheduleInfo = {
    scheduleStatus: "no_schedule",
    minutesLate: null, scheduleStart: null,
    scheduleEnd: null, earlyDeparture: null, minutesEarly: null,
  };
  if (!scheduleStartTime || !firstSeen) return noSched;

  // Late arrival
  const dFirst = new Date(firstSeen);
  const actualStartMin = dFirst.getHours() * 60 + dFirst.getMinutes();
  const schedStartMin  = toMin(scheduleStartTime);
  const diffLate = actualStartMin - schedStartMin;
  const status = diffLate > LATE_GRACE_MINUTES ? "late" : "on_time";
  const minutesLate = diffLate > 0 ? diffLate : 0;

  // Early departure
  let earlyDeparture: boolean | null = null;
  let minutesEarly:   number | null  = null;
  if (scheduleEndTime && lastSeen) {
    const dLast = new Date(lastSeen);
    const actualEndMin = dLast.getHours() * 60 + dLast.getMinutes();
    const schedEndMin  = toMin(scheduleEndTime);
    const diffEarly    = schedEndMin - actualEndMin;
    if (diffEarly > EARLY_GRACE_MINUTES) {
      earlyDeparture = true;
      minutesEarly   = diffEarly;
    } else {
      earlyDeparture = false;
      minutesEarly   = 0;
    }
  }

  return {
    scheduleStatus: status,
    minutesLate,
    scheduleStart: scheduleStartTime,
    scheduleEnd:   scheduleEndTime ?? null,
    earlyDeparture,
    minutesEarly,
  };
}

/* ── schedule join expression ── */
const dayOfWeekExpr = sql<number>`EXTRACT(ISODOW FROM ${attendanceTable.date}::date)::int`;

/* ── routes ── */

router.get("/attendance", async (req, res): Promise<void> => {
  const raw = req.query as Record<string, string | undefined>;
  const { date, from, to, zoneId: zoneIdRaw } = raw;
  const employeeIdRaw  = raw.employeeId;
  const departmentIdRaw = raw.departmentId;

  const conditions = [];
  if (date)           conditions.push(eq(attendanceTable.date, date));
  if (from && !date)  conditions.push(gte(attendanceTable.date, from));
  if (to   && !date)  conditions.push(lte(attendanceTable.date, to));
  if (employeeIdRaw != null)   conditions.push(eq(attendanceTable.employeeId, Number(employeeIdRaw)));
  if (zoneIdRaw     != null)   conditions.push(eq(attendanceTable.zoneId, Number(zoneIdRaw)));
  if (departmentIdRaw != null) conditions.push(eq(employeesTable.departmentId, Number(departmentIdRaw)));

  const records = await db
    .select({
      id:               attendanceTable.id,
      employeeId:       attendanceTable.employeeId,
      employeeName:     sql<string | null>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
      employeeNumber:   employeesTable.employeeNumber,
      employeePhotoUrl: employeesTable.photoUrl,
      departmentName:   departmentsTable.name,
      date:             attendanceTable.date,
      firstSeen:        attendanceTable.firstSeen,
      lastSeen:         attendanceTable.lastSeen,
      zoneId:           attendanceTable.zoneId,
      zoneName:         zonesTable.name,
      totalMinutes:     attendanceTable.totalMinutes,
      scheduleStartTime: departmentWorkSchedulesTable.startTime,
      scheduleEndTime:   departmentWorkSchedulesTable.endTime,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable,  eq(employeesTable.id, attendanceTable.employeeId))
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .leftJoin(zonesTable,      eq(zonesTable.id, attendanceTable.zoneId))
    .leftJoin(
      departmentWorkSchedulesTable,
      and(
        eq(departmentWorkSchedulesTable.departmentId, employeesTable.departmentId!),
        eq(departmentWorkSchedulesTable.dayOfWeek, dayOfWeekExpr),
      )
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(attendanceTable.firstSeen);

  const result = records.map((r) => {
    const si = computeScheduleInfo(
      r.firstSeen, r.lastSeen,
      r.scheduleStartTime ?? null, r.scheduleEndTime ?? null,
    );
    return {
      ...r,
      scheduleStatus:  si.scheduleStatus,
      minutesLate:     si.minutesLate,
      scheduleStart:   si.scheduleStart,
      scheduleEnd:     si.scheduleEnd,
      earlyDeparture:  si.earlyDeparture,
      minutesEarly:    si.minutesEarly,
    };
  });

  res.json(ListAttendanceResponse.parse(result));
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
      scheduleStartTime: departmentWorkSchedulesTable.startTime,
      scheduleEndTime:   departmentWorkSchedulesTable.endTime,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(employeesTable.id, attendanceTable.employeeId))
    .leftJoin(zonesTable, eq(zonesTable.id, attendanceTable.zoneId))
    .leftJoin(
      departmentWorkSchedulesTable,
      and(
        eq(departmentWorkSchedulesTable.departmentId, employeesTable.departmentId!),
        eq(departmentWorkSchedulesTable.dayOfWeek, dayOfWeekExpr),
      )
    )
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

  const recordsWithSchedule = records.map((r) => {
    const si = computeScheduleInfo(r.firstSeen, r.lastSeen, r.scheduleStartTime ?? null, r.scheduleEndTime ?? null);
    return { ...r, ...si };
  });

  res.json(GetTodayAttendanceResponse.parse({
    date: today,
    presentCount,
    absentCount,
    onLeaveCount,
    totalEmployees,
    records: recordsWithSchedule,
    absentRecords,
  }));
});

router.get("/attendance/report", async (req, res): Promise<void> => {
  const { from, to, employeeId, departmentId } = req.query as Record<string, string | undefined>;

  if (!from || !to) {
    res.status(400).json({ error: "from и to са задължителни" });
    return;
  }

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

  const attendance = await db
    .select({
      id: attendanceTable.id,
      employeeId: attendanceTable.employeeId,
      date: attendanceTable.date,
      firstSeen: attendanceTable.firstSeen,
      lastSeen: attendanceTable.lastSeen,
      totalMinutes: attendanceTable.totalMinutes,
      zoneName: zonesTable.name,
      scheduleStartTime: departmentWorkSchedulesTable.startTime,
      scheduleEndTime:   departmentWorkSchedulesTable.endTime,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(employeesTable.id, attendanceTable.employeeId))
    .leftJoin(zonesTable, eq(zonesTable.id, attendanceTable.zoneId))
    .leftJoin(
      departmentWorkSchedulesTable,
      and(
        eq(departmentWorkSchedulesTable.departmentId, employeesTable.departmentId!),
        eq(departmentWorkSchedulesTable.dayOfWeek, dayOfWeekExpr),
      )
    )
    .where(
      and(
        gte(attendanceTable.date, from),
        lte(attendanceTable.date, to)
      )
    );

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

    const dayRec   = isSingleDay ? empAtt[0] : undefined;
    const dayLeave = isSingleDay
      ? empLeaves.find((l) => l.startDate <= from && l.endDate >= from)
      : undefined;

    const schedInfo = isSingleDay && dayRec
      ? computeScheduleInfo(dayRec.firstSeen, dayRec.lastSeen, dayRec.scheduleStartTime ?? null, dayRec.scheduleEndTime ?? null)
      : { scheduleStatus: null, minutesLate: null, scheduleStart: null, scheduleEnd: null, earlyDeparture: null, minutesEarly: null };

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
      firstSeen:     dayRec?.firstSeen  ?? null,
      lastSeen:      dayRec?.lastSeen   ?? null,
      zoneName:      dayRec?.zoneName   ?? null,
      leaveType:     dayLeave?.type     ?? null,
      leaveReason:   dayLeave?.reason   ?? null,
      scheduleStatus: schedInfo.scheduleStatus,
      minutesLate:    schedInfo.minutesLate,
      scheduleStart:  schedInfo.scheduleStart,
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
