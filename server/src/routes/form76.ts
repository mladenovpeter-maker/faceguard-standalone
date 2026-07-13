import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import {
  db, attendanceTable, employeesTable, departmentsTable, leavesTable,
} from "@workspace/db";

const router: IRouter = Router();

/* ── helpers ── */

const LEAVE_CODE: Record<string, string> = {
  paid_leave:   "0",
  unpaid_leave: "Нп",
  sick_leave:   "Б",
  other:        "Д",
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

function countWorkingDaysInMonth(year: number, month: number): number {
  const total = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= total; d++) {
    if (!isWeekend(year, month, d)) count++;
  }
  return count;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Compute minutes worked during 22:00–06:00 windows.
 */
function nightMinutes(firstSeen: Date | string, lastSeen: Date | string): number {
  const s = typeof firstSeen === "string" ? new Date(firstSeen) : firstSeen;
  const e = typeof lastSeen  === "string" ? new Date(lastSeen)  : lastSeen;
  if (e.getTime() <= s.getTime()) return 0;

  let mins = 0;
  const cur = new Date(s);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(e);
  endDay.setHours(23, 59, 59, 999);

  while (cur <= endDay) {
    // 00:00–06:00 window
    const w1s = new Date(cur); w1s.setHours(0,  0, 0, 0);
    const w1e = new Date(cur); w1e.setHours(6,  0, 0, 0);
    // 22:00–24:00 window
    const w2s = new Date(cur); w2s.setHours(22, 0, 0, 0);
    const w2e = new Date(cur.getTime() + 86400000); w2e.setHours(0, 0, 0, 0);

    const st = s.getTime(), et = e.getTime();
    mins += Math.max(0, Math.min(et, w1e.getTime()) - Math.max(st, w1s.getTime())) / 60000;
    mins += Math.max(0, Math.min(et, w2e.getTime()) - Math.max(st, w2s.getTime())) / 60000;

    cur.setDate(cur.getDate() + 1);
  }
  return mins;
}

/* ── route ── */

router.get("/attendance/form76", async (req, res): Promise<void> => {
  const year  = parseInt(req.query.year  as string);
  const month = parseInt(req.query.month as string);
  const departmentIdParam = req.query.departmentId ? parseInt(req.query.departmentId as string) : null;
  const employeeIdParam   = req.query.employeeId   ? parseInt(req.query.employeeId   as string) : null;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    res.status(400).json({ error: "year and month (1-12) are required" });
    return;
  }

  const firstDay = toDateStr(year, month, 1);
  const lastDay  = toDateStr(year, month, daysInMonth(year, month));
  const today    = new Date().toISOString().slice(0, 10);
  const total    = daysInMonth(year, month);
  const normHours = countWorkingDaysInMonth(year, month) * 8;

  // Employees
  const empConditions = [eq(employeesTable.status, "active")];
  if (departmentIdParam) empConditions.push(eq(employeesTable.departmentId, departmentIdParam));
  if (employeeIdParam)   empConditions.push(eq(employeesTable.id, employeeIdParam));

  const employees = await db
    .select({
      id:             employeesTable.id,
      firstName:      employeesTable.firstName,
      lastName:       employeesTable.lastName,
      employeeNumber: employeesTable.employeeNumber,
      photoUrl:       employeesTable.photoUrl,
      departmentId:   employeesTable.departmentId,
      departmentName: departmentsTable.name,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(and(...empConditions))
    .orderBy(departmentsTable.name, employeesTable.lastName, employeesTable.firstName);

  if (employees.length === 0) {
    res.json({
      year, month, daysInMonth: total, workingDays: countWorkingDaysInMonth(year, month),
      normHours, totalEmployees: 0, totalHours: 0, totalOvertime: 0, totalNightHours: 0,
      reviewDays: 0, rows: [],
    });
    return;
  }

  const empIds = employees.map((e) => e.id);

  // Attendance for the month
  const attendance = await db
    .select({
      employeeId:   attendanceTable.employeeId,
      date:         attendanceTable.date,
      firstSeen:    attendanceTable.firstSeen,
      lastSeen:     attendanceTable.lastSeen,
      totalMinutes: attendanceTable.totalMinutes,
    })
    .from(attendanceTable)
    .where(
      and(
        inArray(attendanceTable.employeeId, empIds),
        gte(attendanceTable.date, firstDay),
        lte(attendanceTable.date, lastDay),
      )
    );

  // Leaves overlapping month
  const leaves = await db
    .select({
      employeeId: leavesTable.employeeId,
      type:       leavesTable.type,
      startDate:  leavesTable.startDate,
      endDate:    leavesTable.endDate,
    })
    .from(leavesTable)
    .where(
      and(
        inArray(leavesTable.employeeId, empIds),
        lte(leavesTable.startDate, lastDay),
        gte(leavesTable.endDate, firstDay),
        eq(leavesTable.status, "approved"),
      )
    );

  // Build rows
  let globalReviewDays = 0;
  let globalHours      = 0;
  let globalOvertime   = 0;
  let globalNight      = 0;

  const rows = employees.map((emp) => {
    const empAtt   = attendance.filter((a) => a.employeeId === emp.id);
    const empLeaves = leaves.filter((l) => l.employeeId === emp.id);
    const attByDate = new Map(empAtt.map((a) => [a.date, a]));

    let workedDays  = 0;
    let totalHrs    = 0;
    let overtimeHrs = 0;
    let nightHrs    = 0;
    let reviewCount = 0;

    const days = [];

    for (let d = 1; d <= total; d++) {
      const dateStr = toDateStr(year, month, d);
      const isFuture = dateStr > today;

      // Weekend
      if (isWeekend(year, month, d)) {
        days.push({ day: d, code: "П", hours: null, isReview: false });
        continue;
      }

      // Approved leave
      const leave = empLeaves.find((l) => l.startDate <= dateStr && l.endDate >= dateStr);
      if (leave) {
        days.push({ day: d, code: LEAVE_CODE[leave.type] ?? "Д", hours: null, isReview: false });
        continue;
      }

      // Future date — blank
      if (isFuture) {
        days.push({ day: d, code: "", hours: null, isReview: false });
        continue;
      }

      // Attendance
      const att = attByDate.get(dateStr);
      if (att) {
        const hrs = att.totalMinutes ? Math.round(att.totalMinutes / 60 * 100) / 100 : 0;
        const ot  = Math.max(0, hrs - 8);
        const nh  = nightMinutes(att.firstSeen, att.lastSeen) / 60;
        workedDays++;
        totalHrs    += hrs;
        overtimeHrs += ot;
        nightHrs    += nh;
        days.push({ day: d, code: "Я", hours: Math.round(hrs * 100) / 100, isReview: false });
        continue;
      }

      // Absent (no attendance, no leave, past workday)
      reviewCount++;
      days.push({ day: d, code: "Н", hours: null, isReview: true });
    }

    globalReviewDays += reviewCount;
    globalHours      += totalHrs;
    globalOvertime   += overtimeHrs;
    globalNight      += nightHrs;

    return {
      employeeId:     emp.id,
      employeeName:   `${emp.firstName} ${emp.lastName}`,
      employeeNumber: emp.employeeNumber,
      employeePhotoUrl: emp.photoUrl ?? null,
      departmentName: emp.departmentName ?? "",
      days,
      totalDaysWorked: workedDays,
      totalHours:     Math.round(totalHrs    * 100) / 100,
      normHours,
      overtime:       Math.round(overtimeHrs * 100) / 100,
      nightHours:     Math.round(nightHrs    * 100) / 100,
    };
  });

  res.json({
    year,
    month,
    daysInMonth: total,
    workingDays: countWorkingDaysInMonth(year, month),
    normHours,
    totalEmployees:  employees.length,
    totalHours:      Math.round(globalHours    * 100) / 100,
    totalOvertime:   Math.round(globalOvertime * 100) / 100,
    totalNightHours: Math.round(globalNight    * 100) / 100,
    reviewDays:      globalReviewDays,
    rows,
  });
});

export default router;
