import { useGetDashboardSummary, useGetRecentEvents, useGetDashboardPresence } from "@workspace/api-client-react";
import { UserX, Video, ShieldAlert, Users, Clock, TrendingUp, Building2, TreePalm, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { useState, useMemo } from "react";

const LEAVE_LABELS: Record<string, string> = {
  paid_leave: "Платен отпуск",
  sick_leave: "Болничен",
  unpaid_leave: "Неплатен",
  maternity_leave: "Майчинство",
  other: "Друго",
};

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const { data: events, isLoading: loadingEvents } = useGetRecentEvents({ query: { refetchInterval: 5000 } });
  const { data: presence, isLoading: loadingPresence } = useGetDashboardPresence({ query: { refetchInterval: 15000 } });
  const [absentExpanded, setAbsentExpanded] = useState(false);

  const presentList = useMemo(() => presence?.filter(p => p.present && !p.onLeave) ?? [], [presence]);
  const onLeaveList = useMemo(() => presence?.filter(p => p.onLeave) ?? [], [presence]);
  const absentList  = useMemo(() => presence?.filter(p => !p.present && !p.onLeave) ?? [], [presence]);

  // Sort present by arrival time (earliest first)
  const sortedPresent = useMemo(
    () => [...presentList].sort((a, b) => new Date(a.firstSeen!).getTime() - new Date(b.firstSeen!).getTime()),
    [presentList]
  );

  // Arrival distribution (30-min buckets 06:00–12:00)
  const arrivalSlots = useMemo(() => {
    const slots: { label: string; count: number; late: boolean }[] = [];
    for (let h = 6; h <= 11; h++) {
      for (const m of [0, 30]) {
        const label = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
        const late = h > 9 || (h === 9 && m >= 30);
        slots.push({ label, count: 0, late });
      }
    }
    if (presence) {
      for (const emp of presence) {
        if (!emp.firstSeen) continue;
        const d = new Date(emp.firstSeen);
        const h = d.getHours();
        const m = d.getMinutes() >= 30 ? 30 : 0;
        const idx = (h - 6) * 2 + (m === 30 ? 1 : 0);
        if (idx >= 0 && idx < slots.length) slots[idx].count++;
      }
    }
    return slots;
  }, [presence]);
  const hasArrivals = arrivalSlots.some(s => s.count > 0);

  // Department breakdown
  const depts = useMemo(() => {
    const deptMap: Record<string, { present: number; total: number }> = {};
    if (presence) {
      for (const emp of presence) {
        if (!deptMap[emp.departmentName]) deptMap[emp.departmentName] = { present: 0, total: 0 };
        deptMap[emp.departmentName].total++;
        if (emp.present) deptMap[emp.departmentName].present++;
      }
    }
    return Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total);
  }, [presence]);
  const totalActive = presence?.length ?? 0;

  return (
    <div className="space-y-5">

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingSummary || loadingPresence ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <Card className="border-green-500/30 bg-green-500/5 relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
              </div>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">В сградата</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-bold font-mono text-green-500">
                  {presentList.length}
                  <span className="text-muted-foreground text-xl font-normal ml-1">/ {totalActive}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">активни служители</p>
              </CardContent>
            </Card>

            <Card className={onLeaveList.length > 0 ? "border-blue-500/30 bg-blue-500/5" : "border-border bg-card"}>
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">В отпуска</CardTitle>
                <TreePalm className={`h-4 w-4 ${onLeaveList.length > 0 ? "text-blue-400" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-3xl font-bold font-mono ${onLeaveList.length > 0 ? "text-blue-400" : "text-muted-foreground"}`}>
                  {onLeaveList.length}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {onLeaveList.length === 0 ? "Никой в отпуска" : "одобрен отпуск"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Отсъстват</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-bold font-mono text-muted-foreground">{absentList.length}</div>
                <p className="text-xs text-muted-foreground mt-0.5">без регистрация днес</p>
              </CardContent>
            </Card>

            <Card className={(summary && (summary.unknownToday + summary.deniedToday) > 0) ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}>
              <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Сигнали</CardTitle>
                <ShieldAlert className={`h-4 w-4 ${summary && (summary.unknownToday + summary.deniedToday) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className={`text-3xl font-bold font-mono ${summary && (summary.unknownToday + summary.deniedToday) > 0 ? "text-destructive" : ""}`}>
                  {(summary?.unknownToday ?? 0) + (summary?.deniedToday ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary ? `${summary.deniedToday} отк. · ${summary.unknownToday} непозн.` : "днес"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── PRESENCE WALL ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
            Кой е в сградата
          </CardTitle>
          {!loadingPresence && (
            <div className="flex gap-2 flex-wrap justify-end">
              <Badge variant="outline" className="font-mono text-xs bg-green-500/10 text-green-600 border-green-500/20">{presentList.length} присъства</Badge>
              {onLeaveList.length > 0 && <Badge variant="outline" className="font-mono text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">{onLeaveList.length} отпуска</Badge>}
              {absentList.length > 0 && <Badge variant="outline" className="font-mono text-xs">{absentList.length} отсъства</Badge>}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingPresence ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* PRESENT */}
              {sortedPresent.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">● Присъстват</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {sortedPresent.map(emp => {
                      const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
                      const arrivalTime = emp.firstSeen
                        ? new Date(emp.firstSeen).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })
                        : null;
                      const hours = emp.totalMinutes != null ? Math.floor(emp.totalMinutes / 60) : null;
                      const mins = emp.totalMinutes != null ? emp.totalMinutes % 60 : null;
                      return (
                        <div key={emp.id} className="rounded-lg border border-green-500/30 bg-green-500/5 p-2.5 flex flex-col items-center gap-1.5 text-center hover:bg-green-500/10 transition-colors">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center overflow-hidden text-xs font-bold border-2 border-green-500/40 bg-green-500/20 text-green-700 dark:text-green-400">
                            {emp.photoUrl ? <img src={emp.photoUrl} alt="" className="h-full w-full object-cover" /> : initials}
                          </div>
                          <div className="w-full min-w-0">
                            <p className="text-[11px] font-semibold truncate leading-tight">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{emp.departmentName}</p>
                          </div>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[9px] px-1 py-0 font-mono h-4">
                            ▶ {arrivalTime}
                          </Badge>
                          {hours !== null && (
                            <span className="text-[9px] text-muted-foreground font-mono">{hours}ч {mins}м</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ON LEAVE */}
              {onLeaveList.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">◌ В отпуска</p>
                  <div className="flex flex-wrap gap-2">
                    {onLeaveList.map(emp => {
                      const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
                      const label = LEAVE_LABELS[emp.leaveType ?? "other"] ?? emp.leaveType;
                      return (
                        <div key={emp.id} className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-bold border border-blue-500/30 bg-blue-500/15 text-blue-500">
                            {emp.photoUrl ? <img src={emp.photoUrl} alt="" className="h-full w-full object-cover" /> : initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-blue-400 font-mono truncate">{label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ABSENT — compact collapsible list */}
              {absentList.length > 0 && (
                <div>
                  <button
                    onClick={() => setAbsentExpanded(v => !v)}
                    className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 hover:text-foreground transition-colors"
                  >
                    ○ Отсъстват ({absentList.length})
                    {absentExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {absentExpanded && (
                    <div className="flex flex-wrap gap-1.5">
                      {absentList.map(emp => (
                        <div key={emp.id} className="rounded-md border border-dashed border-border px-2.5 py-1 flex items-center gap-1.5 opacity-60">
                          <div className="h-5 w-5 shrink-0 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <span className="text-xs text-muted-foreground">{emp.firstName} {emp.lastName}</span>
                          <span className="text-[9px] text-muted-foreground/60 font-mono">{emp.departmentName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!sortedPresent.length && !onLeaveList.length && !absentList.length && (
                <div className="py-10 text-center text-muted-foreground text-sm">Няма активни служители</div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ARRIVAL CHART */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
              Влизания по час
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPresence ? (
              <Skeleton className="h-40 w-full" />
            ) : !hasArrivals ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                Няма регистрирани влизания днес
              </div>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={arrivalSlots} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontFamily: "monospace" }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: 12 }}
                      formatter={(v: number) => [`${v} влизания`]}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {arrivalSlots.map((slot, i) => (
                        <Cell key={i} fill={slot.late ? "hsl(38 92% 50%)" : "hsl(142 71% 45%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-green-500 inline-block" /> Навреме (преди 09:30)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" /> Закъснение (след 09:30)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* DEPARTMENT BREAKDOWN */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">
              По отдели
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPresence ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
            ) : depts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Няма данни</p>
            ) : (
              depts.map(([dept, { present, total }]) => {
                const pct = Math.round((present / total) * 100);
                return (
                  <div key={dept}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium truncate mr-2 max-w-[140px]" title={dept}>{dept}</span>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{present}/{total}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-green-500/70" : "bg-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{pct}%</p>
                  </div>
                );
              })
            )}
            {!loadingPresence && (
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Общо
                </span>
                <span className="text-xs font-mono font-semibold">
                  {presentList.length}/{totalActive} — {totalActive ? Math.round((presentList.length / totalActive) * 100) : 0}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── LIVE FEED ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">Лог на събития</CardTitle>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground font-mono">НА ЖИВО</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingEvents ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : events && events.length > 0 ? (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div key={event.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                  <div className={`h-7 w-7 shrink-0 rounded-full overflow-hidden border-2 flex items-center justify-center text-[9px] font-bold ${
                    event.status === "recognized" ? "border-green-500/40 bg-green-500/10 text-green-600" :
                    event.status === "denied" ? "border-red-500/40 bg-red-500/10 text-red-500" :
                    "border-amber-500/40 bg-amber-500/10 text-amber-600"
                  }`}>
                    {event.snapshotUrl ? (
                      <img src={event.snapshotUrl} alt="" className="h-full w-full object-cover" />
                    ) : event.status === "recognized" && event.employeeName ? (
                      `${event.employeeName[0]}${event.employeeName.split(" ")[1]?.[0] ?? ""}`
                    ) : (
                      <UserX className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.status === "recognized" ? "bg-green-500" : event.status === "denied" ? "bg-red-500" : "bg-amber-500"}`} />
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {event.status === "recognized" ? event.employeeName : "Непознато лице"}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-muted-foreground truncate hidden sm:block">{event.cameraName} · {event.zoneName}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{new Date(event.detectedAt).toLocaleTimeString("bg-BG")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">Няма скорошни събития</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
