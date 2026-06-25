import { useState, useMemo } from "react";
import { useGetAttendanceReport } from "@workspace/api-client-react";
import type { AttendanceReportRow } from "@workspace/api-client-react";
import {
  User, Search, Calendar, ChevronDown, Clock,
  CheckCircle, XCircle, Plane, TrendingUp, Timer,
  ArrowRight, Building2, Stethoscope, FileX, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── types ──────────────────────────────────────────────────── */

type Preset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

/* ── date helpers ─────────────────────────────────────────────── */

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function resolveRange(preset: Preset, cFrom: string, cTo: string) {
  const now = new Date();
  switch (preset) {
    case "today":      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "this_week": {
      const day = now.getDay() || 7;
      const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
      return { from: fmt(mon), to: fmt(now) };
    }
    case "last_week": {
      const day = now.getDay() || 7;
      const lm = new Date(now); lm.setDate(now.getDate() - day - 6);
      const ls = new Date(lm); ls.setDate(lm.getDate() + 6);
      return { from: fmt(lm), to: fmt(ls) };
    }
    case "this_month": {
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case "custom":
      return { from: cFrom || fmt(now), to: cTo || fmt(now) };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today",      label: "ДНЕС"       },
  { key: "yesterday",  label: "ВЧЕРА"      },
  { key: "this_week",  label: "ТАЗИ СЕДМ." },
  { key: "last_week",  label: "МИН. СЕДМ." },
  { key: "this_month", label: "ТОЗИ МЕС."  },
  { key: "last_month", label: "МИН. МЕС."  },
  { key: "custom",     label: "ИЗБОР…"     },
];

const LEAVE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  paid_leave:   { label: "Платен отпуск",   color: "bg-blue-500/10 text-blue-400 border-blue-400/30",     Icon: Plane        },
  unpaid_leave: { label: "Неплатен отпуск", color: "bg-orange-500/10 text-orange-400 border-orange-400/30", Icon: FileX      },
  sick_leave:   { label: "Болничен",        color: "bg-purple-500/10 text-purple-400 border-purple-400/30", Icon: Stethoscope },
  other:        { label: "Друга причина",   color: "bg-gray-500/10 text-gray-400 border-gray-400/30",     Icon: AlertCircle  },
};

/* ── micro helpers ─────────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}

function fmtMins(m: number) {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h === 0 ? `${min}м` : min === 0 ? `${h}ч` : `${h}ч ${min}м`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function rateColor(rate: number) {
  if (rate >= 0.9) return "text-green-500";
  if (rate >= 0.7) return "text-amber-500";
  return "text-red-500";
}
function rateBg(rate: number) {
  if (rate >= 0.9) return "bg-green-500";
  if (rate >= 0.7) return "bg-amber-500";
  return "bg-red-500";
}

/* ── Avatar ─────────────────────────────────────────────────── */

function Avatar({ name, photo, size = "md" }: { name: string; photo?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "h-8 w-8 text-[10px]", md: "h-10 w-10 text-xs", lg: "h-12 w-12 text-sm" }[size];
  return (
    <div className={cn("rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center font-bold text-muted-foreground shrink-0", sz)}>
      {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

/* ── Section label ─────────────────────────────────────────── */

function SectionHeader({ icon: Icon, color, label, count }: { icon: React.ElementType; color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn("h-4 w-4", color)} />
      <span className="text-sm font-semibold tracking-tight">{label}</span>
      <span className="ml-1 text-xs font-mono font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>
    </div>
  );
}

/* ── Present card (single-day) ─────────────────────────────── */

function PresentCard({ row }: { row: AttendanceReportRow }) {
  const mins   = row.totalMinutes ?? 0;
  const fill   = Math.min(100, Math.round((mins / (8 * 60)) * 100));
  const arr    = row.firstSeen ? new Date(row.firstSeen).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }) : null;
  const dep    = row.lastSeen  ? new Date(row.lastSeen).toLocaleTimeString("bg-BG",  { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-green-500/40 hover:shadow-[0_0_0_1px_hsl(142_71%_45%/0.2)] transition-all">
      <div className="flex items-center gap-3">
        <Avatar name={row.employeeName} photo={row.employeePhotoUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{row.employeeName}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.employeeNumber} · {row.department}</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
      </div>

      <div className="flex items-center gap-3 text-xs">
        {arr && (
          <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 rounded-md px-2 py-1">
            <Clock className="h-3 w-3" />
            <span className="font-mono font-bold">{arr}</span>
          </div>
        )}
        {dep && (
          <div className="flex items-center gap-1.5 bg-muted text-muted-foreground rounded-md px-2 py-1">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{dep}</span>
          </div>
        )}
        {row.zoneName && (
          <span className="ml-auto text-muted-foreground truncate max-w-[90px] text-[11px]">{row.zoneName}</span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Работно време</span>
          <span className={cn("font-mono font-bold", fill >= 100 ? "text-green-500" : fill >= 60 ? "text-amber-500" : "text-red-400")}>
            {fmtMins(mins)}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", fill >= 100 ? "bg-green-500" : fill >= 60 ? "bg-amber-400" : "bg-red-400")}
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Leave card (single-day) ──────────────────────────────── */

function LeaveCard({ row }: { row: AttendanceReportRow }) {
  const meta = LEAVE_META[row.leaveType ?? ""] ?? LEAVE_META["other"];
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <Avatar name={row.employeeName} photo={row.employeePhotoUrl} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{row.employeeName}</p>
        <p className="text-xs text-muted-foreground font-mono">{row.employeeNumber} · {row.department}</p>
      </div>
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shrink-0", meta.color)}>
        <meta.Icon className="h-3 w-3" />
        {meta.label}
      </span>
    </div>
  );
}

/* ── Single-day view ────────────────────────────────────────── */

function SingleDayView({ rows }: { rows: AttendanceReportRow[] }) {
  const [showAbsent, setShowAbsent] = useState(true);

  const present = rows.filter(r => r.daysPresent > 0);
  const onLeave = rows.filter(r => r.daysPresent === 0 && r.daysOnLeave > 0);
  const absent  = rows.filter(r => r.daysPresent === 0 && r.daysOnLeave === 0 && r.daysAbsent > 0);

  return (
    <div className="space-y-8">
      {present.length > 0 && (
        <div>
          <SectionHeader icon={CheckCircle} color="text-green-500" label="Присъстващи" count={present.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {present.map(r => <PresentCard key={r.employeeId} row={r} />)}
          </div>
        </div>
      )}

      {onLeave.length > 0 && (
        <div>
          <SectionHeader icon={Plane} color="text-blue-400" label="В отпуска" count={onLeave.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {onLeave.map(r => <LeaveCard key={r.employeeId} row={r} />)}
          </div>
        </div>
      )}

      {absent.length > 0 && (
        <div>
          <button
            onClick={() => setShowAbsent(v => !v)}
            className="flex items-center gap-2 mb-3 group"
          >
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-semibold group-hover:text-foreground text-muted-foreground transition-colors">Отсъстващи</span>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{absent.length}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform ml-0.5", !showAbsent && "-rotate-90")} />
          </button>
          {showAbsent && (
            <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
              {absent.map(r => (
                <div key={r.employeeId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <Avatar name={r.employeeName} photo={r.employeePhotoUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.employeeName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.department} · {r.position}</p>
                  </div>
                  <Badge variant="outline" className="text-xs text-red-400 border-red-400/30 bg-red-500/5 shrink-0">
                    Отсъстващ
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Calendar className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm">Няма данни за избрания ден.</p>
        </div>
      )}
    </div>
  );
}

/* ── Multi-day table ────────────────────────────────────────── */

function MultiDayTable({ rows, workingDays }: { rows: AttendanceReportRow[]; workingDays: number }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-sm">Няма намерени служители.</p>
      </div>
    );
  }

  const wd = workingDays || 1;

  return (
    <div className="bg-card rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {["Служител", "Дни работа", "Отсъствие", "Отпуска", "Общо часове", "Ср. влизане", "Ср. излизане", "Присъствие %"].map((h, i) => (
              <th key={h} className={cn(
                "px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap",
                i === 0 ? "text-left" : "text-center",
                i >= 4 && i <= 6 ? "hidden md:table-cell" : "",
                i >= 5 && i <= 6 ? "hidden lg:table-cell" : "",
              )}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows
            .slice()
            .sort((a, b) => b.daysPresent - a.daysPresent)
            .map(r => {
              const rate = r.daysPresent / wd;
              return (
                <tr key={r.employeeId} className="hover:bg-muted/25 transition-colors group">
                  {/* Employee */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.employeeName} photo={r.employeePhotoUrl} size="sm" />
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{r.employeeName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.department}</p>
                      </div>
                    </div>
                  </td>
                  {/* Days present */}
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-mono font-bold text-green-500 bg-green-500/10">
                      {r.daysPresent}
                    </span>
                  </td>
                  {/* Days absent */}
                  <td className="px-4 py-3 text-center">
                    {r.daysAbsent > 0
                      ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-mono font-bold text-red-400 bg-red-500/10">{r.daysAbsent}</span>
                      : <span className="text-muted-foreground/50 text-xs">—</span>}
                  </td>
                  {/* Days on leave */}
                  <td className="px-4 py-3 text-center">
                    {r.daysOnLeave > 0
                      ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-mono font-bold text-blue-400 bg-blue-500/10">{r.daysOnLeave}</span>
                      : <span className="text-muted-foreground/50 text-xs">—</span>}
                  </td>
                  {/* Total hours */}
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="font-mono font-semibold">{fmtMins(r.totalMinutes)}</span>
                  </td>
                  {/* Avg arrival */}
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {r.avgFirstSeen
                      ? <span className="font-mono text-sm font-semibold text-green-500">{r.avgFirstSeen}</span>
                      : <span className="text-muted-foreground/50 text-xs">—</span>}
                  </td>
                  {/* Avg departure */}
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {r.avgLastSeen
                      ? <span className="font-mono text-sm text-muted-foreground">{r.avgLastSeen}</span>
                      : <span className="text-muted-foreground/50 text-xs">—</span>}
                  </td>
                  {/* Attendance rate */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div className={cn("h-full rounded-full transition-all", rateBg(rate))} style={{ width: `${Math.min(100, Math.round(rate * 100))}%` }} />
                      </div>
                      <span className={cn("font-mono font-bold text-sm tabular-nums", rateColor(rate))}>
                        {Math.min(100, Math.round(rate * 100))}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function AttendancePage() {
  const [preset, setPreset]   = useState<Preset>("today");
  const [cFrom, setCFrom]     = useState("");
  const [cTo, setCTo]         = useState("");
  const [search, setSearch]   = useState("");
  const [dept, setDept]       = useState("all");

  const { from, to } = resolveRange(preset, cFrom, cTo);
  const isSingleDay  = from === to;

  const { data: report, isLoading } = useGetAttendanceReport({ from, to });

  const departments = useMemo(
    () => Array.from(new Set((report?.rows ?? []).map(r => r.department).filter(Boolean))).sort() as string[],
    [report]
  );

  const rows: AttendanceReportRow[] = useMemo(() => {
    if (!report) return [];
    return report.rows.filter(r => {
      if (dept !== "all" && r.department !== dept) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.employeeName.toLowerCase().includes(q) || r.employeeNumber.toLowerCase().includes(q);
      }
      return true;
    });
  }, [report, dept, search]);

  /* summary stats */
  const totalPresentRows = rows.filter(r => r.daysPresent > 0).length;
  const totalMins        = rows.reduce((s, r) => s + r.totalMinutes, 0);
  const maxPossible      = rows.length * (report?.workingDays ?? 1);
  const overallRate      = maxPossible > 0 ? rows.reduce((s, r) => s + r.daysPresent, 0) / maxPossible : 0;

  /* range label */
  const rangeLabel = isSingleDay
    ? fmtDate(from)
    : `${fmtDate(from)} — ${fmtDate(to)}`;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Присъствие</h1>
        <p className="text-sm text-muted-foreground font-mono mt-0.5">{rangeLabel}</p>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2 items-center">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold tracking-wider border transition-all",
              preset === p.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}

        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-1 flex-wrap">
            <input
              type="date"
              value={cFrom}
              onChange={e => setCFrom(e.target.value)}
              className="h-8 rounded-lg border border-border bg-muted/50 px-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={cTo}
              onChange={e => setCTo(e.target.value)}
              className="h-8 rounded-lg border border-border bg-muted/50 px-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Търси служител…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-muted/40 border-border"
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-[190px] h-9 text-sm bg-muted/40 border-border gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Отдел" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички отдели</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Работни дни",
            value: isLoading ? null : (report?.workingDays ?? 0),
            sub: "в периода",
            color: "text-foreground",
            Icon: Calendar,
            bg: "bg-muted",
          },
          {
            label: isSingleDay ? "Присъстват" : "Редовни",
            value: isLoading ? null : totalPresentRows,
            sub: `от ${rows.length} служители`,
            color: "text-green-500",
            Icon: CheckCircle,
            bg: "bg-green-500/10",
          },
          {
            label: "Изработено",
            value: isLoading ? null : fmtMins(totalMins),
            sub: "общо часове",
            color: "text-primary",
            Icon: Timer,
            bg: "bg-primary/10",
          },
          {
            label: "Присъствие",
            value: isLoading ? null : `${Math.round(overallRate * 100)}%`,
            sub: isSingleDay ? "за деня" : "средно за периода",
            color: rateColor(overallRate),
            Icon: TrendingUp,
            bg: overallRate >= 0.9 ? "bg-green-500/10" : overallRate >= 0.7 ? "bg-amber-500/10" : "bg-red-500/10",
          },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
            <div className={cn("mt-0.5 p-2 rounded-lg", c.bg)}>
              <c.Icon className={cn("h-4 w-4", c.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{c.label}</p>
              {isLoading
                ? <Skeleton className="h-7 w-16 mt-1 mb-0.5" />
                : <p className={cn("text-2xl font-bold font-mono leading-none mt-1", c.color)}>{c.value}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : isSingleDay ? (
        <SingleDayView rows={rows} />
      ) : (
        <MultiDayTable rows={rows} workingDays={report?.workingDays ?? 1} />
      )}
    </div>
  );
}
