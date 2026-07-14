import { useState, useMemo } from "react";
import XLSXStyle from "xlsx-js-style";
import {
  ChevronLeft, ChevronRight, Download, Users, Clock,
  TrendingUp, Moon, AlertTriangle, Filter, FileSpreadsheet,
  CalendarDays, BarChart3,
} from "lucide-react";
import { useGetAttendanceForm76, useListDepartments } from "@workspace/api-client-react";
import type { Form76Row, Form76Response } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ── consts ── */

const BG_MONTHS = [
  "", "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември",
];

const BG_WEEKDAY_SHORT = ["Н", "П", "В", "С", "Ч", "П", "С"];

const CODE_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  "Я":  { label: "Явяване",         bg: "bg-emerald-100", text: "text-emerald-800", dot: "#10b981" },
  "0":  { label: "Платен отпуск",   bg: "bg-sky-100",     text: "text-sky-800",     dot: "#0ea5e9" },
  "Нп": { label: "Неплатен",        bg: "bg-orange-100",  text: "text-orange-800",  dot: "#f97316" },
  "Б":  { label: "Болничен",        bg: "bg-purple-100",  text: "text-purple-800",  dot: "#a855f7" },
  "К":  { label: "Командировка",    bg: "bg-cyan-100",    text: "text-cyan-800",    dot: "#06b6d4" },
  "Д":  { label: "Друг отпуск",     bg: "bg-amber-100",   text: "text-amber-800",   dot: "#f59e0b" },
  "П":  { label: "Почивка",         bg: "bg-slate-100",   text: "text-slate-500",   dot: "#94a3b8" },
  "Н":  { label: "Отсъствие",       bg: "bg-red-100",     text: "text-red-700",     dot: "#ef4444" },
  "Пр": { label: "Официален праз.", bg: "bg-indigo-100",  text: "text-indigo-800",  dot: "#6366f1" },
};

/* ── helpers ── */

function pad2(n: number) { return String(n).padStart(2, "0"); }
function dayOfWeek(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay();
}

function countCodes(days: Form76Row["days"]) {
  const counts: Record<string, number> = {};
  for (const d of days) {
    if (d.code) counts[d.code] = (counts[d.code] ?? 0) + 1;
  }
  return counts;
}

/* ── stat card ── */

function StatCard({
  label, value, icon: Icon, gradient, warning,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  warning?: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-xl p-4 text-white overflow-hidden shadow-sm",
      gradient,
      warning && "ring-2 ring-amber-400 ring-offset-1"
    )}>
      <div className="absolute inset-0 opacity-10 bg-white rounded-xl" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-2xl font-extrabold leading-none tracking-tight">{value}</p>
          <p className="text-[11px] font-medium uppercase tracking-wider mt-1 opacity-80">{label}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/20">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {warning && (
        <AlertTriangle className="absolute bottom-2 right-2 h-3 w-3 text-amber-300" />
      )}
    </div>
  );
}

/* ── day cell ── */

function DayCell({ code, hours, isReview }: { code: string; hours?: number | null; isReview?: boolean }) {
  if (!code) return <div className="w-7 h-7" />;
  const meta = CODE_META[code] ?? { label: code, bg: "bg-gray-100", text: "text-gray-700", dot: "#9ca3af" };
  return (
    <div
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center relative text-[9px] font-bold leading-none select-none shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        meta.bg, meta.text
      )}
      title={`${meta.label}${hours != null ? ` · ${hours}ч` : ""}`}
    >
      {code}
      {isReview && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white shadow" />
      )}
    </div>
  );
}

/* ── CSV export (summary format matching Форма 76 standard) ── */

function buildSummaryCsv(data: Form76Response) {
  const headers = [
    "Служебен номер", "Име", "Отдел",
    "Отработени дни", "Отработени часове", "Норма (часове)", "Баланс ± (часове)",
    "Извънреден труд (часове)", "Нощен труд (часове)",
    "Платен отпуск (дни)", "Неплатен отпуск (дни)", "Болничен (дни)",
    "Командировка (дни)", "Друг отпуск (дни)",
    "Празници (дни)", "Почивни (дни)", "Отсъствия (дни)",
  ];
  const rows = data.rows.map((r) => {
    const c = countCodes(r.days);
    return [
      r.employeeNumber,
      r.employeeName,
      r.departmentName,
      r.totalDaysWorked,
      r.totalHours.toFixed(2),
      r.normHours.toFixed(2),
      (r.totalHours - r.normHours).toFixed(2),
      r.overtime.toFixed(2),
      r.nightHours.toFixed(2),
      c["0"]  ?? 0,
      c["Нп"] ?? 0,
      c["Б"]  ?? 0,
      c["К"]  ?? 0,
      c["Д"]  ?? 0,
      c["Пр"] ?? 0,
      c["П"]  ?? 0,
      c["Н"]  ?? 0,
    ];
  });
  return [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v)}"`).join(","))
    .join("\n");
}

/* ── Excel export (styled) ── */

const XL_HEADER_FILL = { patternType: "solid", fgColor: { rgb: "0F4C75" } };
const XL_HEADER_FONT = { bold: true, color: { rgb: "FFFFFF" }, sz: 9 };
const XL_WKND_FILL   = { patternType: "solid", fgColor: { rgb: "E2E8F0" } };
const XL_ALT_FILL    = { patternType: "solid", fgColor: { rgb: "F8FAFC" } };
const XL_TOT_FILL    = { patternType: "solid", fgColor: { rgb: "EFF6FF" } };
const XL_BORDER      = { style: "thin", color: { rgb: "CBD5E1" } };
const XL_ALL_BORDER  = { top: XL_BORDER, bottom: XL_BORDER, left: XL_BORDER, right: XL_BORDER };

const CODE_RGB: Record<string, string> = {
  "Я":  "D1FAE5", "0":  "DBEAFE", "Нп": "FFEDD5",
  "Б":  "F3E8FF", "К":  "CFFAFE", "Д":  "FEF3C7",
  "П":  "F1F5F9", "Н":  "FEE2E2", "Пр": "E0E7FF",
};

function buildXlsx(data: Form76Response, year: number, month: number) {
  const daysInMonth = data.daysInMonth;
  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // ── Sheet 1: Day-by-day attendance grid ──
  const gridHeaders = [
    { v: "Служител",  s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "left" } } },
    { v: "Таб. №",   s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: "Отдел",    s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER } },
    ...dayNums.map((d) => {
      const dow = dayOfWeek(year, month, d);
      const isWknd = dow === 0 || dow === 6;
      return {
        v: `${d}\n${BG_WEEKDAY_SHORT[dow]}`,
        s: {
          fill: isWknd ? XL_WKND_FILL : XL_HEADER_FILL,
          font: { bold: true, color: { rgb: isWknd ? "64748B" : "FFFFFF" }, sz: 8 },
          border: XL_ALL_BORDER,
          alignment: { horizontal: "center", wrapText: true },
        },
      };
    }),
    { v: "Отр.дни", s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: "Часове",  s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: "Норма",   s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: "Баланс",  s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: "ИТ",      s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: "НТ",      s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
  ];

  const gridRows = data.rows.map((row, ri) => {
    const bal = row.totalHours - row.normHours;
    const rowFill = ri % 2 === 1 ? XL_ALT_FILL : { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
    return [
      { v: row.employeeName, s: { fill: rowFill, font: { bold: true, sz: 9 }, border: XL_ALL_BORDER } },
      { v: row.employeeNumber, s: { fill: rowFill, font: { sz: 9 }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: row.departmentName, s: { fill: rowFill, font: { sz: 9, color: { rgb: "64748B" } }, border: XL_ALL_BORDER } },
      ...row.days.map((d) => {
        const rgb = d.code ? (CODE_RGB[d.code] ?? "FFFFFF") : (ri % 2 === 1 ? "F8FAFC" : "FFFFFF");
        return {
          v: d.code || "",
          s: {
            fill: { patternType: "solid", fgColor: { rgb } },
            font: { bold: true, sz: 9 },
            border: XL_ALL_BORDER,
            alignment: { horizontal: "center" },
          },
        };
      }),
      { v: row.totalDaysWorked, s: { fill: rowFill, font: { bold: true, sz: 9 }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: +row.totalHours.toFixed(2), s: { fill: rowFill, font: { bold: true, sz: 9 }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
      { v: +row.normHours.toFixed(0), s: { fill: rowFill, font: { sz: 9, color: { rgb: "64748B" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" } } },
      {
        v: +bal.toFixed(2),
        s: {
          fill: rowFill,
          font: { bold: true, sz: 9, color: { rgb: bal >= 0 ? "16A34A" : "DC2626" } },
          border: XL_ALL_BORDER,
          alignment: { horizontal: "right" },
          numFmt: "+0.00;-0.00",
        },
      },
      { v: +row.overtime.toFixed(2), s: { fill: rowFill, font: { sz: 9, color: { rgb: "D97706" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
      { v: +row.nightHours.toFixed(2), s: { fill: rowFill, font: { sz: 9, color: { rgb: "7C3AED" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
    ];
  });

  const totalBal = data.totalHours - data.normHours * data.totalEmployees;
  const totalsRow = [
    { v: "ОБЩО", s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10, color: { rgb: "1E3A5F" } }, border: XL_ALL_BORDER } },
    { v: "", s: { fill: XL_TOT_FILL, border: XL_ALL_BORDER } },
    { v: "", s: { fill: XL_TOT_FILL, border: XL_ALL_BORDER } },
    ...dayNums.map(() => ({ v: "", s: { fill: XL_TOT_FILL, border: XL_ALL_BORDER } })),
    { v: data.rows.reduce((s, r) => s + r.totalDaysWorked, 0), s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10 }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    { v: +data.totalHours.toFixed(2), s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10 }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
    { v: +(data.normHours * data.totalEmployees).toFixed(0), s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10 }, border: XL_ALL_BORDER, alignment: { horizontal: "right" } } },
    { v: +totalBal.toFixed(2), s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10, color: { rgb: totalBal >= 0 ? "16A34A" : "DC2626" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "+0.00;-0.00" } },
    { v: +data.totalOvertime.toFixed(2), s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10, color: { rgb: "D97706" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
    { v: +data.totalNightHours.toFixed(2), s: { fill: XL_TOT_FILL, font: { bold: true, sz: 10, color: { rgb: "7C3AED" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
  ];

  const wsGrid = XLSXStyle.utils.aoa_to_sheet([[...gridHeaders], ...gridRows, [...totalsRow]]);
  wsGrid["!cols"] = [
    { wch: 22 }, { wch: 8 }, { wch: 16 },
    ...dayNums.map(() => ({ wch: 3.5 })),
    { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 8 }, { wch: 6 }, { wch: 6 },
  ];
  wsGrid["!rows"] = [{ hpt: 28 }];

  // ── Sheet 2: Summary per employee ──
  const sumHeaders = [
    "Служебен номер", "Служител", "Отдел",
    "Отр. дни", "Часове", "Норма", "Баланс ±",
    "Изв. труд", "Нощен труд",
    "Платен отп.", "Неплатен", "Болничен",
    "Команд.", "Друг отп.",
    "Празници", "Почивни", "Отсъствия",
  ].map((v) => ({ v, s: { fill: XL_HEADER_FILL, font: XL_HEADER_FONT, border: XL_ALL_BORDER, alignment: { horizontal: "center", wrapText: true } } }));

  const sumRows = data.rows.map((row, ri) => {
    const c = countCodes(row.days);
    const bal = row.totalHours - row.normHours;
    const rowFill = ri % 2 === 1 ? XL_ALT_FILL : { patternType: "solid", fgColor: { rgb: "FFFFFF" } };
    const cell = (v: string | number, extra?: object) => ({ v, s: { fill: rowFill, font: { sz: 9 }, border: XL_ALL_BORDER, ...extra } });
    return [
      cell(row.employeeNumber, { alignment: { horizontal: "center" } }),
      cell(row.employeeName,   { font: { bold: true, sz: 9 } }),
      cell(row.departmentName, { font: { sz: 9, color: { rgb: "64748B" } } }),
      cell(row.totalDaysWorked, { alignment: { horizontal: "center" }, font: { bold: true, sz: 9 } }),
      { v: +row.totalHours.toFixed(2), s: { fill: rowFill, font: { bold: true, sz: 9 }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
      { v: +row.normHours.toFixed(0),  s: { fill: rowFill, font: { sz: 9, color: { rgb: "64748B" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" } } },
      { v: +bal.toFixed(2), s: { fill: rowFill, font: { bold: true, sz: 9, color: { rgb: bal >= 0 ? "16A34A" : "DC2626" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "+0.00;-0.00" } },
      { v: +row.overtime.toFixed(2),   s: { fill: { patternType: "solid", fgColor: { rgb: ri % 2 === 1 ? "FEF9EC" : "FFFBEB" } }, font: { sz: 9, color: { rgb: "D97706" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
      { v: +row.nightHours.toFixed(2), s: { fill: { patternType: "solid", fgColor: { rgb: ri % 2 === 1 ? "F5F3FF" : "FAF5FF" } }, font: { sz: 9, color: { rgb: "7C3AED" } }, border: XL_ALL_BORDER, alignment: { horizontal: "right" }, numFmt: "0.00" } },
      { v: c["0"]  ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "EFF6FF" } }, font: { sz: 9, color: { rgb: "1D4ED8" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["Нп"] ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "FFF7ED" } }, font: { sz: 9, color: { rgb: "C2410C" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["Б"]  ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "FDF4FF" } }, font: { sz: 9, color: { rgb: "9333EA" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["К"]  ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "ECFEFF" } }, font: { sz: 9, color: { rgb: "0891B2" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["Д"]  ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "FFFBEB" } }, font: { sz: 9, color: { rgb: "D97706" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["Пр"] ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "EEF2FF" } }, font: { sz: 9, color: { rgb: "4F46E5" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["П"]  ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } }, font: { sz: 9, color: { rgb: "64748B" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
      { v: c["Н"]  ?? 0, s: { fill: { patternType: "solid", fgColor: { rgb: "FEF2F2" } }, font: { sz: 9, color: { rgb: "DC2626" } }, border: XL_ALL_BORDER, alignment: { horizontal: "center" } } },
    ];
  });

  const wsSummary = XLSXStyle.utils.aoa_to_sheet([[...sumHeaders], ...sumRows]);
  wsSummary["!cols"] = [
    { wch: 12 }, { wch: 22 }, { wch: 14 },
    { wch: 8 }, { wch: 8 }, { wch: 7 }, { wch: 9 },
    { wch: 9 }, { wch: 9 },
    { wch: 10 }, { wch: 9 }, { wch: 9 },
    { wch: 9 }, { wch: 9 },
    { wch: 9 }, { wch: 9 }, { wch: 9 },
  ];
  wsSummary["!rows"] = [{ hpt: 28 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, wsGrid, `Ф76 ${BG_MONTHS[month]} ${year}`);
  XLSXStyle.utils.book_append_sheet(wb, wsSummary, "Резюме");
  XLSXStyle.writeFile(wb, `форма76-${year}-${pad2(month)}.xlsx`);
}

/* ── main page ── */

export default function Form76Page() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<string>("all");

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return;
    setYear(ny); setMonth(nm);
  }

  const { data, isLoading } = useGetAttendanceForm76({
    year, month,
    departmentId: departmentId !== "all" ? Number(departmentId) : undefined,
  });

  const { data: depts = [] } = useListDepartments();
  const daysInMonth = data?.daysInMonth ?? 31;

  const dayHeaders = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dow = dayOfWeek(year, month, d);
    return { d, dow, isWknd: dow === 0 || dow === 6, letter: BG_WEEKDAY_SHORT[dow] };
  }), [year, month, daysInMonth]);

  function exportCsv() {
    if (!data) return;
    const csv = "\ufeff" + buildSummaryCsv(data as Form76Response);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `форма76-${year}-${pad2(month)}.csv`;
    a.click();
  }

  function exportXlsx() {
    if (!data) return;
    buildXlsx(data as Form76Response, year, month);
  }

  const balance = data ? data.totalHours - data.normHours * data.totalEmployees : 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F4C75] via-[#1B6CA8] to-[#3A86C8] p-5 text-white shadow-lg flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/20 shadow-inner">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Форма 76</h1>
            <p className="text-blue-100 text-sm font-medium mt-0.5">Месечна ведомост за труд и работно присъствие</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end">
          <Button
            onClick={exportCsv}
            disabled={!data}
            size="sm"
            className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-white/30 border"
            variant="ghost"
          >
            <Download className="h-3.5 w-3.5" />CSV
          </Button>
          <Button
            onClick={exportXlsx}
            disabled={!data}
            size="sm"
            className="gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white shadow"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />Excel
          </Button>
        </div>
      </div>

      {/* ── Month nav + filter ── */}
      <div className="bg-card border rounded-xl p-3 flex flex-wrap items-center gap-4 shadow-sm">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-bold w-44 text-center tracking-tight">
            {BG_MONTHS[month]} {year}
          </span>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
            onClick={nextMonth}
            disabled={year === now.getFullYear() && month >= now.getMonth() + 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-52 h-8 text-sm rounded-lg">
              <SelectValue placeholder="Всички отдели" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички отдели</SelectItem>
              {depts.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Работници"      value={data?.totalEmployees ?? 0}                            icon={Users}        gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
        <StatCard label="Отр. часове"    value={`${data?.totalHours.toFixed(0) ?? 0}ч`}              icon={Clock}        gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <StatCard label="Изв. труд"      value={`${data?.totalOvertime.toFixed(0) ?? 0}ч`}           icon={TrendingUp}   gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
        <StatCard label="Нощен труд"     value={`${data?.totalNightHours.toFixed(0) ?? 0}ч`}         icon={Moon}         gradient="bg-gradient-to-br from-violet-500 to-purple-700" />
        <StatCard
          label="За преглед"
          value={data?.reviewDays ?? 0}
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-rose-500 to-red-700"
          warning={(data?.reviewDays ?? 0) > 0}
        />
      </div>

      {/* ── Balance bar ── */}
      {data && (
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Баланс на часовете
            </div>
            <span className={cn("text-sm font-bold tabular-nums", balance >= 0 ? "text-emerald-600" : "text-red-500")}>
              {balance >= 0 ? "+" : ""}{balance.toFixed(1)}ч
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            {data.totalHours > 0 && (
              <div
                className={cn("h-2 rounded-full transition-all", balance >= 0 ? "bg-emerald-500" : "bg-red-500")}
                style={{ width: `${Math.min(100, (data.totalHours / (data.normHours * data.totalEmployees || 1)) * 100)}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
            <span>0ч</span>
            <span>Норма: {(data.normHours * data.totalEmployees).toFixed(0)}ч</span>
            <span>{data.totalHours.toFixed(0)}ч</span>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="bg-card border rounded-xl p-3 flex flex-wrap gap-1.5 items-center shadow-sm">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-1">Легенда:</span>
        {Object.entries(CODE_META).map(([code, meta]) => (
          <div key={code} className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm border border-black/5", meta.bg, meta.text)}>
            <span className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px]" style={{ backgroundColor: meta.dot + "33" }}>{code}</span>
            <span className="font-normal opacity-70">{meta.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow" />
          <span className="text-[10px] text-muted-foreground">За преглед</span>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-24 text-center text-muted-foreground font-mono text-sm animate-pulse">
            Зареждане...
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground font-mono text-sm">
            Няма данни за {BG_MONTHS[month]} {year}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-max">
              <thead>
                <tr className="bg-[#0F4C75] text-white">
                  <th className="sticky left-0 z-10 bg-[#0F4C75] text-left px-3 py-2.5 font-semibold text-[10px] tracking-widest uppercase whitespace-nowrap border-r border-blue-400/30 min-w-[190px]">
                    Служител
                  </th>
                  {dayHeaders.map(({ d, letter, isWknd }) => (
                    <th
                      key={d}
                      className={cn(
                        "w-7 px-0 py-1.5 text-center",
                        isWknd ? "bg-slate-600/60" : ""
                      )}
                    >
                      <div className="font-bold text-[9px] leading-none">{d}</div>
                      <div className="text-[8px] leading-none mt-0.5 opacity-60">{letter}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-right border-l border-blue-400/30 whitespace-nowrap">Отр.д.</th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-right whitespace-nowrap">Часове</th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-right whitespace-nowrap opacity-70">Норма</th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-right whitespace-nowrap">Баланс</th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-right whitespace-nowrap text-amber-200">ИТ</th>
                  <th className="px-2 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-right whitespace-nowrap pr-3 text-violet-200">НТ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(data as Form76Response).rows.map((row: Form76Row, ri: number) => {
                  const bal = row.totalHours - row.normHours;
                  return (
                    <tr key={row.employeeId} className={cn("hover:bg-blue-50/40 transition-colors group", ri % 2 === 1 && "bg-muted/30")}>
                      <td className={cn(
                        "sticky left-0 z-10 px-3 py-1.5 border-r border-border",
                        ri % 2 === 1 ? "bg-muted/30 group-hover:bg-blue-50/40" : "bg-card group-hover:bg-blue-50/40"
                      )}>
                        <div className="whitespace-nowrap">
                          <p className="font-semibold text-[11px] leading-tight">{row.employeeName}</p>
                          <p className="text-muted-foreground text-[9px] font-mono">{row.departmentName}</p>
                        </div>
                      </td>
                      {row.days.map((day) => (
                        <td key={day.day} className="px-0.5 py-1 text-center">
                          <DayCell code={day.code} hours={day.hours} isReview={day.isReview} />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-mono font-bold border-l border-border text-[11px]">
                        {row.totalDaysWorked}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold text-[11px]">
                        {row.totalHours.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-muted-foreground text-[11px]">
                        {row.normHours.toFixed(0)}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono font-bold text-[11px]", bal >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {bal >= 0 ? "+" : ""}{bal.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-amber-600">
                        {row.overtime > 0 ? row.overtime.toFixed(1) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-violet-600 pr-3">
                        {row.nightHours > 0 ? row.nightHours.toFixed(1) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#0F4C75]/30 bg-blue-50/60 font-semibold">
                  <td className="sticky left-0 z-10 bg-blue-50/60 px-3 py-2.5 text-[10px] font-bold font-mono uppercase tracking-widest border-r border-border text-[#0F4C75]">
                    Общо
                  </td>
                  {dayHeaders.map(({ d }) => <td key={d} />)}
                  <td className="px-2 py-2.5 text-right font-mono font-bold border-l border-border text-[11px]">
                    {(data as Form76Response).rows.reduce((s, r) => s + r.totalDaysWorked, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-[11px]">
                    {data.totalHours.toFixed(1)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-muted-foreground text-[11px]">
                    {(data.normHours * data.totalEmployees).toFixed(0)}
                  </td>
                  <td className={cn("px-2 py-2.5 text-right font-mono font-bold text-[11px]", balance >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {balance >= 0 ? "+" : ""}{balance.toFixed(1)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-[11px] text-amber-600">
                    {data.totalOvertime.toFixed(1)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold text-[11px] text-violet-600 pr-3">
                    {data.totalNightHours > 0 ? data.totalNightHours.toFixed(1) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {data && data.workingDays > 0 && (
        <p className="text-[11px] text-muted-foreground font-mono text-right">
          {BG_MONTHS[month]} {year} · {data.workingDays} работни дни · норма {data.normHours}ч/служ.
        </p>
      )}
    </div>
  );
}
