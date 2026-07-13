import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Download, Users, Clock,
  TrendingUp, Moon, AlertTriangle, Filter,
} from "lucide-react";
import { useGetAttendanceForm76, useListDepartments } from "@workspace/api-client-react";
import type { Form76Row, Form76Response } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ── consts ── */

const BG_MONTHS = [
  "", "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември",
];

const BG_WEEKDAY_SHORT = ["Н", "П", "В", "С", "Ч", "П", "С"]; // Sun=0

const CODE_META: Record<string, { label: string; bg: string; text: string }> = {
  "Я":  { label: "Явяване",        bg: "bg-green-100",  text: "text-green-800" },
  "0":  { label: "Платен отпуск",  bg: "bg-blue-100",   text: "text-blue-800"  },
  "Нп": { label: "Неплатен",       bg: "bg-orange-100", text: "text-orange-800" },
  "Б":  { label: "Болничен",       bg: "bg-purple-100", text: "text-purple-800" },
  "К":  { label: "Командировка",   bg: "bg-cyan-100",   text: "text-cyan-800"  },
  "Д":  { label: "Друг отпуск",    bg: "bg-amber-100",  text: "text-amber-800" },
  "П":  { label: "Почивка",        bg: "bg-slate-100",  text: "text-slate-500" },
  "Н":  { label: "Неявяване",      bg: "bg-red-100",    text: "text-red-700"   },
  "Пр": { label: "Официален праз.", bg: "bg-indigo-100", text: "text-indigo-800" },
};

/* ── helpers ── */

function pad2(n: number) { return String(n).padStart(2, "0"); }

function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const d = dayOfWeek(year, month, day);
  return d === 0 || d === 6;
}

function StatCard({
  label, value, icon: Icon, color, warning,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  warning?: boolean;
}) {
  const cls = {
    blue:   "bg-blue-500/10 text-blue-600",
    green:  "bg-green-500/10 text-green-600",
    amber:  "bg-amber-500/10 text-amber-600",
    red:    "bg-red-500/10 text-red-600",
    purple: "bg-purple-500/10 text-purple-600",
    slate:  "bg-slate-100 text-slate-600",
  }[color];
  return (
    <div className={cn("bg-card border rounded-lg p-4 flex items-center gap-3", warning && "border-amber-400 bg-amber-50/30")}>
      <div className={cn("p-2 rounded-lg shrink-0", cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wide mt-1">{label}</p>
      </div>
      {warning && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 ml-auto" />}
    </div>
  );
}

/* ── day cell ── */

function DayCell({ code, hours, isReview }: { code: string; hours?: number | null; isReview?: boolean }) {
  if (!code) {
    return <div className="w-7 h-7" />;
  }
  const meta = CODE_META[code] ?? { label: code, bg: "bg-gray-100", text: "text-gray-700" };
  return (
    <div
      className={cn(
        "w-7 h-7 rounded flex items-center justify-center relative text-[9px] font-bold leading-none select-none",
        meta.bg, meta.text
      )}
      title={`${meta.label}${hours != null ? ` · ${hours}ч` : ""}`}
    >
      {code}
      {isReview && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white" />
      )}
    </div>
  );
}

/* ── CSV export ── */

function buildCsv(data: Form76Response, daysInMonth: number) {
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
  const headers = ["Служител", "Отдел", ...dayHeaders, "Отр.д.", "Часове", "Норма", "Баланс", "Нощ"];
  const rows = data.rows.map((r) => [
    r.employeeName,
    r.departmentName,
    ...r.days.map((d) => d.code || ""),
    String(r.totalDaysWorked),
    r.totalHours.toFixed(2),
    r.normHours.toFixed(2),
    (r.totalHours - r.normHours).toFixed(2),
    r.nightHours.toFixed(2),
  ]);
  return [headers, ...rows].map((r) => r.map((v) => `"${String(v)}"`).join(",")).join("\n");
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

  const isCurrentOrFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);

  const { data, isLoading } = useGetAttendanceForm76({
    year,
    month,
    departmentId: departmentId !== "all" ? Number(departmentId) : undefined,
  });

  const { data: depts = [] } = useListDepartments();

  const daysInMonth = data?.daysInMonth ?? 31;

  const dayHeaders = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dow = dayOfWeek(year, month, d);
      return { d, dow, isWknd: dow === 0 || dow === 6, letter: BG_WEEKDAY_SHORT[dow] };
    });
  }, [year, month, daysInMonth]);

  function exportCsv() {
    if (!data) return;
    const csv = "\ufeff" + buildCsv(data as Form76Response, daysInMonth);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `форма76-${year}-${pad2(month)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const balance = data ? data.totalHours - (data.normHours * data.totalEmployees) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Форма 76</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Месечна ведомост за труд и работно присъствие</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2" disabled={!data}>
            <Download className="h-4 w-4" />
            Експорт CSV
          </Button>
        </div>
      </div>

      {/* Month navigation + department filter */}
      <div className="bg-card border rounded-lg p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold w-44 text-center">{BG_MONTHS[month]} {year}</span>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={nextMonth}
            disabled={year === now.getFullYear() && month >= now.getMonth() + 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-48 h-8 text-sm">
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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Работници"       value={data?.totalEmployees ?? 0}   icon={Users}          color="blue"   />
        <StatCard label="Отр. часове"      value={`${data?.totalHours.toFixed(0) ?? 0}ч`}   icon={Clock}    color="green"  />
        <StatCard label="Извънреден труд"  value={`${data?.totalOvertime.toFixed(0) ?? 0}ч`} icon={TrendingUp} color="amber" />
        <StatCard label="Нощен труд"       value={`${data?.totalNightHours.toFixed(0) ?? 0}ч`} icon={Moon}    color="purple" />
        <StatCard
          label="Дни за преглед"
          value={data?.reviewDays ?? 0}
          icon={AlertTriangle}
          color="red"
          warning={(data?.reviewDays ?? 0) > 0}
        />
      </div>

      {/* Legend */}
      <div className="bg-card border rounded-lg p-3 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-1">Легенда:</span>
        {Object.entries(CODE_META).map(([code, meta]) => (
          <div key={code} className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold", meta.bg, meta.text)}>
            <span>{code}</span>
            <span className="font-normal opacity-70">{meta.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
          <span className="text-[10px] text-muted-foreground">За преглед</span>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground font-mono text-sm animate-pulse">
            Зареждане...
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground font-mono text-sm">
            Няма данни за {BG_MONTHS[month]} {year}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-max">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  {/* Employee sticky col */}
                  <th className="sticky left-0 z-10 bg-muted/60 text-left px-3 py-2 font-mono text-[10px] tracking-widest uppercase whitespace-nowrap border-r border-border min-w-[180px]">
                    Служител
                  </th>
                  {/* Day headers */}
                  {dayHeaders.map(({ d, letter, isWknd }) => (
                    <th
                      key={d}
                      className={cn(
                        "w-7 px-0.5 py-1 text-center",
                        isWknd ? "bg-slate-200/60 text-slate-500" : "text-muted-foreground"
                      )}
                    >
                      <div className="font-mono text-[9px] leading-none">{d}</div>
                      <div className={cn("font-mono text-[9px] leading-none mt-0.5", isWknd ? "text-slate-400" : "text-muted-foreground/60")}>
                        {letter}
                      </div>
                    </th>
                  ))}
                  {/* Summary headers */}
                  <th className="px-2 py-2 font-mono text-[10px] tracking-widest uppercase text-right text-muted-foreground border-l border-border whitespace-nowrap">Отр.д.</th>
                  <th className="px-2 py-2 font-mono text-[10px] tracking-widest uppercase text-right text-muted-foreground whitespace-nowrap">Часове</th>
                  <th className="px-2 py-2 font-mono text-[10px] tracking-widest uppercase text-right text-muted-foreground whitespace-nowrap">Норма</th>
                  <th className="px-2 py-2 font-mono text-[10px] tracking-widest uppercase text-right text-muted-foreground whitespace-nowrap">Баланс</th>
                  <th className="px-2 py-2 font-mono text-[10px] tracking-widest uppercase text-right text-muted-foreground whitespace-nowrap pr-3">Нощ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.rows.map((row: Form76Row, ri: number) => {
                  const bal = row.totalHours - row.normHours;
                  return (
                    <tr key={row.employeeId} className={cn("hover:bg-muted/20 transition-colors", ri % 2 === 1 && "bg-muted/5")}>
                      {/* Employee sticky */}
                      <td className={cn(
                        "sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-border",
                        ri % 2 === 1 && "bg-muted/5"
                      )}>
                        <div className="whitespace-nowrap">
                          <p className="font-medium text-[11px] leading-tight">{row.employeeName}</p>
                          <p className="text-muted-foreground text-[9px] font-mono">{row.departmentName}</p>
                        </div>
                      </td>
                      {/* Days */}
                      {row.days.map((day) => (
                        <td key={day.day} className="px-0.5 py-1 text-center">
                          <DayCell code={day.code} hours={day.hours} isReview={day.isReview} />
                        </td>
                      ))}
                      {/* Summary */}
                      <td className="px-2 py-1.5 text-right font-mono font-bold border-l border-border">
                        {row.totalDaysWorked}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold">
                        {row.totalHours.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                        {row.normHours.toFixed(0)}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono font-semibold", bal >= 0 ? "text-green-600" : "text-red-500")}>
                        {bal >= 0 ? "+" : ""}{bal.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-muted-foreground pr-3">
                        {row.nightHours > 0 ? row.nightHours.toFixed(1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              {data.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-[10px] font-mono uppercase tracking-widest border-r border-border text-muted-foreground">
                      Общо
                    </td>
                    {dayHeaders.map(({ d }) => <td key={d} />)}
                    <td className="px-2 py-2 text-right font-mono text-[11px]">
                      {data.rows.reduce((s, r) => s + r.totalDaysWorked, 0)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px]">
                      {data.totalHours.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px] text-muted-foreground">
                      {(data.normHours * data.totalEmployees).toFixed(0)}
                    </td>
                    <td className={cn("px-2 py-2 text-right font-mono text-[11px]", balance >= 0 ? "text-green-600" : "text-red-500")}>
                      {balance >= 0 ? "+" : ""}{balance.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[11px] text-muted-foreground pr-3">
                      {data.totalNightHours > 0 ? data.totalNightHours.toFixed(1) : "—"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Summary line */}
      {data && data.workingDays > 0 && (
        <p className="text-xs text-muted-foreground font-mono text-right">
          {BG_MONTHS[month]} {year} · {data.workingDays} работни дни · норма {data.normHours}ч/служ.
        </p>
      )}
    </div>
  );
}
