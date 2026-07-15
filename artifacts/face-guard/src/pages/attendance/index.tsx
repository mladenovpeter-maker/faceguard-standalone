import { useState, useMemo } from "react";
import {
  Users, UserCheck, UserX, Clock, Calendar, Download, AlertTriangle,
} from "lucide-react";
import { useListAttendance, useGetTodayAttendance } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);
const BG_WEEKDAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function formatTime(dt: string | null | undefined): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatHours(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function formatDate(dateVal: string | Date): string {
  let d: Date;
  if (dateVal instanceof Date) {
    d = dateVal;
  } else {
    d = dateVal.includes("T") ? new Date(dateVal) : new Date(dateVal + "T12:00:00Z");
  }
  if (isNaN(d.getTime())) return String(dateVal);
  return `${BG_WEEKDAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "green" | "amber" | "red";
}) {
  const cls = {
    blue:  "bg-blue-500/10 text-blue-600",
    green: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    red:   "bg-red-500/10   text-red-600",
  }[color];
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-4">
      <div className={cn("p-2.5 rounded-lg", cls)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate]     = useState(today);

  const isToday = fromDate === today && toDate === today;

  const { data: todayData } = useGetTodayAttendance();
  const { data: records = [], isLoading } = useListAttendance({ from: fromDate, to: toDate });

  const stats = useMemo(() => {
    if (isToday && todayData) {
      return {
        total:   todayData.totalEmployees,
        present: todayData.presentCount,
        onLeave: todayData.onLeaveCount,
        absent:  todayData.absentCount,
      };
    }
    return { total: records.length, present: records.length, onLeave: 0, absent: 0 };
  }, [isToday, todayData, records]);

  function exportCsv() {
    const headers = ["Работник", "Номер", "Дата", "Отдел", "Вход", "Изход", "Часове", "Закъснение", "Напускал", "Статус"];
    const rowsCsv = records.map((r) => [
      r.employeeName ?? "",
      r.employeeNumber ?? "",
      r.date,
      r.departmentName ?? "",
      formatTime(r.firstSeen),
      formatTime(r.lastSeen),
      r.totalMinutes ? (r.totalMinutes / 60).toFixed(2) : "",
      r.scheduleStatus === "late" ? `Закъснял ${r.minutesLate}м` : r.scheduleStatus === "on_time" ? "Навреме" : "",
      r.earlyDeparture ? `Рано ${r.minutesEarly}м` : r.earlyDeparture === false ? "Не" : "",
      "Присъства",
    ]);
    const csv = [headers, ...rowsCsv].map((r) => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `присъствие-${fromDate}${fromDate !== toDate ? `--${toDate}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Присъствие</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Дневна регистрация на работното присъствие</p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Експорт CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Общо активни"  value={stats.total}   icon={Users}     color="blue"  />
        <StatCard label="На работа"      value={stats.present} icon={UserCheck} color="green" />
        <StatCard label="В отпуска"      value={stats.onLeave} icon={Calendar}  color="amber" />
        <StatCard label="Отсъстващи"    value={stats.absent}  icon={UserX}     color="red"   />
      </div>

      {/* Date filter */}
      <div className="bg-card border rounded-lg p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium shrink-0 text-muted-foreground">От:</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40 font-mono text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium shrink-0 text-muted-foreground">До:</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40 font-mono text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={() => { setFromDate(today); setToDate(today); }} className="gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Днес
        </Button>
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {records.length} записа
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-mono text-[10px] tracking-widest uppercase">Работник</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase">Дата</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase">Отдел</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase text-right">Вход ↓</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase text-right">Изход ↑</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase text-right">Часове</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase text-center">Закъснение</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase text-center">Напускал</TableHead>
                <TableHead className="font-mono text-[10px] tracking-widest uppercase text-center">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-muted-foreground font-mono text-sm animate-pulse">
                    Зареждане...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-muted-foreground font-mono text-sm">
                    Няма записи за избрания период
                  </TableCell>
                </TableRow>
              ) : (
                records.map((rec) => (
                  <TableRow key={rec.id} className="hover:bg-muted/30 transition-colors">
                    {/* Работник */}
                    <TableCell className="min-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={rec.employeePhotoUrl ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                            {(rec.employeeName ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm leading-tight">{rec.employeeName ?? "—"}</p>
                          {rec.employeeNumber && (
                            <p className="text-[11px] text-muted-foreground font-mono">№{rec.employeeNumber}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Дата */}
                    <TableCell className="min-w-[140px]">
                      <p className="text-xs font-mono">{formatDate(rec.date)}</p>
                      {rec.date === today && (
                        <Badge variant="outline" className="text-[9px] font-mono mt-0.5 px-1 py-0 h-3.5 border-blue-400 text-blue-500 leading-none">
                          Днес
                        </Badge>
                      )}
                    </TableCell>

                    {/* Отдел */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{rec.departmentName ?? "—"}</span>
                    </TableCell>

                    {/* Вход */}
                    <TableCell className="text-right min-w-[90px]">
                      <span className="font-mono text-sm font-semibold text-green-600">{formatTime(rec.firstSeen)}</span>
                      {rec.scheduleStart && (
                        <p className="text-[10px] text-muted-foreground font-mono text-right">{rec.scheduleStart}</p>
                      )}
                    </TableCell>

                    {/* Изход */}
                    <TableCell className="text-right min-w-[90px]">
                      {rec.lastSeen && rec.firstSeen && formatTime(rec.lastSeen) !== formatTime(rec.firstSeen) ? (
                        <span className="font-mono text-sm font-semibold text-orange-500">{formatTime(rec.lastSeen)}</span>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground">—</span>
                      )}
                      {rec.scheduleEnd && (
                        <p className="text-[10px] text-muted-foreground font-mono text-right">{rec.scheduleEnd}</p>
                      )}
                    </TableCell>

                    {/* Часове */}
                    <TableCell className="text-right min-w-[80px]">
                      <span className="font-mono text-sm font-bold">{formatHours(rec.totalMinutes)}</span>
                    </TableCell>

                    {/* Закъснение */}
                    <TableCell className="text-center min-w-[110px]">
                      {rec.scheduleStatus === "late" ? (
                        <Badge variant="destructive" className="font-mono text-[10px] gap-1 px-2">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Закъснял {rec.minutesLate}м
                        </Badge>
                      ) : rec.scheduleStatus === "on_time" ? (
                        <Badge variant="outline" className="font-mono text-[10px] text-green-700 border-green-400 bg-green-50">
                          Навреме
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>

                    {/* Напускал */}
                    <TableCell className="text-center min-w-[90px]">
                      {rec.earlyDeparture === true ? (
                        <Badge className="font-mono text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                          Рано {rec.minutesEarly}м
                        </Badge>
                      ) : rec.earlyDeparture === false ? (
                        <span className="text-sm text-muted-foreground font-mono">Не</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>

                    {/* Статус */}
                    <TableCell className="text-center min-w-[100px]">
                      <Badge variant="outline" className="font-mono text-[10px] text-green-700 border-green-400 bg-green-50">
                        ● Присъства
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Absent section — today only */}
        {isToday && todayData && todayData.absentRecords.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <UserX className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-mono text-red-600 uppercase tracking-wider font-semibold">
                Отсъстващи — {todayData.absentRecords.length}
              </span>
            </div>
            <Table>
              <TableBody>
                {todayData.absentRecords.map((emp) => (
                  <TableRow key={emp.employeeId} className="hover:bg-muted/20 opacity-65">
                    <TableCell className="min-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={emp.employeePhotoUrl ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-red-100 text-red-700 font-bold">
                            {(emp.employeeName ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{emp.employeeName}</p>
                          {emp.employeeNumber && <p className="text-[11px] text-muted-foreground font-mono">№{emp.employeeNumber}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <span className="text-xs font-mono text-muted-foreground">{formatDate(todayData.date)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{emp.departmentName ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right"><span className="text-muted-foreground text-sm font-mono">—</span></TableCell>
                    <TableCell className="text-right"><span className="text-muted-foreground text-sm font-mono">—</span></TableCell>
                    <TableCell className="text-right"><span className="text-muted-foreground text-sm font-mono">—</span></TableCell>
                    <TableCell className="text-center"><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell className="text-center"><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell className="text-center">
                      {emp.leaveId ? (
                        <Badge variant="outline" className="font-mono text-[10px] text-amber-700 border-amber-400 bg-amber-50">
                          Отпуска
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-[10px] text-red-700 border-red-400 bg-red-50">
                          ● Отсъства
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
