import { useGetDashboardSummary, useGetRecentEvents, useGetDashboardPresence } from "@workspace/api-client-react";
import { UserX, ShieldAlert, Users, Clock, TrendingUp, Building2, TreePalm, ChevronDown, ChevronUp, Zap } from "lucide-react";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </h3>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const { data: events, isLoading: loadingEvents } = useGetRecentEvents({ query: { refetchInterval: 5000 } });
  const { data: presence, isLoading: loadingPresence } = useGetDashboardPresence({ query: { refetchInterval: 15000 } });
  const [absentExpanded, setAbsentExpanded] = useState(false);

  const presentList = useMemo(() => presence?.filter(p => p.present && !p.onLeave) ?? [], [presence]);
  const onLeaveList = useMemo(() => presence?.filter(p => p.onLeave) ?? [], [presence]);
  const absentList  = useMemo(() => presence?.filter(p => !p.present && !p.onLeave) ?? [], [presence]);

  const sortedPresent = useMemo(
    () => [...presentList].sort((a, b) => new Date(a.firstSeen!).getTime() - new Date(b.firstSeen!).getTime()),
    [presentList]
  );

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
        const mm = d.getMinutes() >= 30 ? 30 : 0;
        const idx = (h - 6) * 2 + (mm === 30 ? 1 : 0);
        if (idx >= 0 && idx < slots.length) slots[idx].count++;
      }
    }
    return slots;
  }, [presence]);
  const hasArrivals = arrivalSlots.some(s => s.count > 0);

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
  const alerts = (summary?.unknownToday ?? 0) + (summary?.deniedToday ?? 0);

  const kpiCards = [
    {
      label: "В сградата",
      value: loadingSummary || loadingPresence ? null : presentList.length,
      sub: `от ${totalActive} активни`,
      icon: Users,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-400/20",
      pulse: true,
    },
    {
      label: "В отпуска",
      value: loadingSummary || loadingPresence ? null : onLeaveList.length,
      sub: onLeaveList.length === 0 ? "Никой в момента" : "одобрен отпуск",
      icon: TreePalm,
      gradient: "from-sky-500 to-blue-600",
      iconBg: "bg-sky-400/20",
      pulse: false,
    },
    {
      label: "Отсъстват",
      value: loadingSummary || loadingPresence ? null : absentList.length,
      sub: "без регистрация днес",
      icon: Clock,
      gradient: "from-slate-500 to-slate-600",
      iconBg: "bg-slate-400/20",
      pulse: false,
    },
    {
      label: "Сигнали",
      value: loadingSummary ? null : alerts,
      sub: summary ? `${summary.deniedToday} откл · ${summary.unknownToday} непозн` : "днес",
      icon: ShieldAlert,
      gradient: alerts > 0 ? "from-rose-500 to-red-600" : "from-slate-500 to-slate-600",
      iconBg: alerts > 0 ? "bg-rose-400/20" : "bg-slate-400/20",
      pulse: alerts > 0,
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="relative rounded-2xl overflow-hidden bg-card border border-card-border shadow-sm hover:shadow-md transition-shadow">
              {/* Gradient top bar */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${card.gradient}`} />
              <div className="p-4 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">{card.label}</p>
                  <div className={`h-8 w-8 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                    <Icon className="h-4 w-4 text-foreground/70" />
                  </div>
                </div>
                {card.value === null ? (
                  <Skeleton className="h-9 w-16 mb-1" />
                ) : (
                  <div className="flex items-end gap-2">
                    <span className={`text-[2.25rem] font-display font-black leading-none bg-gradient-to-br ${card.gradient} bg-clip-text text-transparent`}>
                      {card.value}
                    </span>
                    {card.label === "В сградата" && (
                      <span className="text-base font-mono text-muted-foreground/50 mb-0.5">/{totalActive}</span>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{card.sub}</p>
                {card.pulse && card.value !== null && card.value > 0 && (
                  <span className="absolute top-4 right-4 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PRESENCE WALL ── */}
      <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <SectionTitle>Кой е в сградата</SectionTitle>
          {!loadingPresence && (
            <div className="flex gap-2 flex-wrap justify-end">
              <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/8 text-emerald-600 border-emerald-500/20 h-5 px-2">
                {presentList.length} присъства
              </Badge>
              {onLeaveList.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] bg-sky-500/8 text-sky-500 border-sky-500/20 h-5 px-2">
                  {onLeaveList.length} отпуска
                </Badge>
              )}
              {absentList.length > 0 && (
                <Badge variant="outline" className="font-mono text-[10px] h-5 px-2">
                  {absentList.length} отсъства
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="p-5 space-y-5">
          {loadingPresence ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <>
              {sortedPresent.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono font-bold text-emerald-500/80 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    Присъстват
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {sortedPresent.map(emp => {
                      const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
                      const arrivalTime = emp.firstSeen
                        ? new Date(emp.firstSeen).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })
                        : null;
                      const hours = emp.totalMinutes != null ? Math.floor(emp.totalMinutes / 60) : null;
                      const mins = emp.totalMinutes != null ? emp.totalMinutes % 60 : null;
                      return (
                        <div key={emp.id} className="rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-transparent p-3 flex flex-col items-center gap-2 text-center hover:border-emerald-500/40 hover:bg-emerald-500/8 transition-all cursor-default">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center overflow-hidden text-xs font-bold ring-2 ring-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            {emp.photoUrl ? <img src={emp.photoUrl} alt="" className="h-full w-full object-cover" /> : initials}
                          </div>
                          <div className="w-full min-w-0">
                            <p className="text-[11px] font-semibold truncate leading-tight">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-muted-foreground truncate mt-0.5">{emp.departmentName}</p>
                          </div>
                          {arrivalTime && (
                            <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 border border-emerald-500/20">
                              ▶ {arrivalTime}
                            </span>
                          )}
                          {hours !== null && (
                            <span className="text-[9px] text-muted-foreground font-mono">{hours}ч {mins}м</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {onLeaveList.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono font-bold text-sky-500/80 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
                    В отпуска
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {onLeaveList.map(emp => {
                      const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
                      const label = LEAVE_LABELS[emp.leaveType ?? "other"] ?? emp.leaveType;
                      return (
                        <div key={emp.id} className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 flex items-center gap-2.5 min-w-0 hover:bg-sky-500/8 transition-colors">
                          <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden text-[10px] font-bold border border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400">
                            {emp.photoUrl ? <img src={emp.photoUrl} alt="" className="h-full w-full object-cover" /> : initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-sky-500 font-mono truncate">{label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {absentList.length > 0 && (
                <div>
                  <button
                    onClick={() => setAbsentExpanded(v => !v)}
                    className="flex items-center gap-2 text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 hover:text-muted-foreground transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full border border-muted-foreground/40 inline-block" />
                    Отсъстват ({absentList.length})
                    {absentExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {absentExpanded && (
                    <div className="flex flex-wrap gap-1.5">
                      {absentList.map(emp => (
                        <div key={emp.id} className="rounded-lg border border-dashed border-border/60 px-2.5 py-1.5 flex items-center gap-1.5 opacity-50 hover:opacity-70 transition-opacity">
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
                <div className="py-12 text-center text-muted-foreground text-sm">Няма активни служители</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ARRIVAL CHART */}
        <div className="lg:col-span-2 rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-primary" />
            </div>
            <SectionTitle>Влизания по час</SectionTitle>
          </div>
          <div className="p-5">
            {loadingPresence ? (
              <Skeleton className="h-44 w-full" />
            ) : !hasArrivals ? (
              <div className="h-44 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Clock className="h-8 w-8 opacity-20" />
                <p className="text-sm">Няма регистрирани влизания днес</p>
              </div>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={arrivalSlots} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontFamily: "monospace" }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: 12, borderRadius: "0.5rem" }}
                      formatter={(v: number) => [`${v} влизания`]}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {arrivalSlots.map((slot, i) => (
                        <Cell key={i} fill={slot.late ? "hsl(38 95% 52%)" : "hsl(152 72% 45%)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex gap-5 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block" /> Навреме (до 09:30)
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" /> Закъснение
              </span>
            </div>
          </div>
        </div>

        {/* DEPARTMENT BREAKDOWN */}
        <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <SectionTitle>По отдели</SectionTitle>
          </div>
          <div className="p-5 space-y-4">
            {loadingPresence ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
            ) : depts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Няма данни</p>
            ) : (
              depts.map(([dept, { present, total }]) => {
                const pct = Math.round((present / total) * 100);
                const color = pct === 100 ? "bg-emerald-500" : pct >= 75 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-rose-400";
                return (
                  <div key={dept}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold truncate mr-2 max-w-[140px]" title={dept}>{dept}</span>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 tabular-nums">{present}/{total}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
            {!loadingPresence && depts.length > 0 && (
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Общо присъствие
                </span>
                <span className="text-sm font-display font-bold text-foreground">
                  {totalActive ? Math.round((presentList.length / totalActive) * 100) : 0}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── LIVE FEED ── */}
      <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <SectionTitle>На живо</SectionTitle>
          </div>
          <div className="flex items-center gap-2 bg-rose-500/8 border border-rose-500/20 rounded-full px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-rose-500 tracking-widest uppercase">Live</span>
          </div>
        </div>
        {loadingEvents ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : events && events.length > 0 ? (
          <div className="divide-y divide-border/60">
            {events.map((event) => (
              <div key={event.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                <div className={`h-9 w-9 shrink-0 rounded-xl overflow-hidden border-2 flex items-center justify-center text-[9px] font-bold ${
                  event.status === "recognized" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" :
                  event.status === "denied"     ? "border-rose-500/40 bg-rose-500/10 text-rose-500" :
                  "border-amber-500/40 bg-amber-500/10 text-amber-600"
                }`}>
                  {event.snapshotUrl ? (
                    <img src={event.snapshotUrl} alt="" className="h-full w-full object-cover" />
                  ) : event.status === "recognized" && event.employeeName ? (
                    `${event.employeeName[0]}${event.employeeName.split(" ")[1]?.[0] ?? ""}`
                  ) : (
                    <UserX className="h-4 w-4" />
                  )}
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${
                  event.status === "recognized" ? "bg-emerald-500" :
                  event.status === "denied"     ? "bg-rose-500" :
                  "bg-amber-500"
                }`} />
                <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate leading-tight">
                      {event.status === "recognized" ? event.employeeName : "Непознато лице"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate hidden sm:block font-mono">
                      {event.cameraName} · {event.zoneName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                      event.status === "recognized" ? "bg-emerald-500/8 text-emerald-600 border-emerald-500/20" :
                      event.status === "denied"     ? "bg-rose-500/8 text-rose-500 border-rose-500/20" :
                      "bg-amber-500/8 text-amber-600 border-amber-500/20"
                    }`}>
                      {event.status === "recognized" ? "РАЗПОЗНАТ" : event.status === "denied" ? "ОТКАЗАН" : "НЕПОЗНАТ"}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                      {new Date(event.detectedAt).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">Няма скорошни събития</div>
        )}
      </div>
    </div>
  );
}
