import type { ScheduleBreak } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronDown, Copy, Coffee, Check } from "lucide-react";
import { useState, useEffect } from "react";

export type ScheduleDay = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breaks: ScheduleBreak[];
};

export type UpsertScheduleData = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breaks: ScheduleBreak[];
};

export type ScheduleEditorProps = {
  schedules: ScheduleDay[];
  onUpsert: (data: UpsertScheduleData) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isLoading?: boolean;
};

const DAYS = [
  { iso: 1, label: "Понеделник" },
  { iso: 2, label: "Вторник" },
  { iso: 3, label: "Сряда" },
  { iso: 4, label: "Четвъртък" },
  { iso: 5, label: "Петък" },
  { iso: 6, label: "Събота" },
  { iso: 7, label: "Неделя" },
];

const PRESETS = [
  { label: "Стандартно 8–17",        start: "08:00", end: "17:00" },
  { label: "Сутринна смяна 6–14",    start: "06:00", end: "14:00" },
  { label: "Следобедна смяна 14–22", start: "14:00", end: "22:00" },
  { label: "Нощна смяна 22–06",      start: "22:00", end: "06:00" },
];

function toMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatDuration(start: string, end: string, breaks: ScheduleBreak[]): string {
  let mins = toMin(end) - toMin(start);
  if (mins < 0) mins += 1440;
  const brkMins = breaks.reduce((acc, b) => {
    const d = toMin(b.endTime) - toMin(b.startTime);
    return acc + (d > 0 ? d : 0);
  }, 0);
  const net = Math.max(0, mins - brkMins);
  const h = Math.floor(net / 60);
  const m = net % 60;
  return m > 0 ? `${h}ч ${m}мин` : `${h}ч`;
}

const TL_START = 6 * 60;
const TL_RANGE = 16 * 60;
function pct(min: number) {
  return Math.max(0, Math.min(100, ((min - TL_START) / TL_RANGE) * 100));
}

function DayTimeline({ start, end, breaks }: { start: string; end: string; breaks: ScheduleBreak[] }) {
  const s = toMin(start);
  const e = toMin(end);
  const l = pct(s);
  const w = Math.max(0, pct(e) - l);
  return (
    <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="absolute h-full bg-primary/40 rounded-full" style={{ left: `${l}%`, width: `${w}%` }} />
      {breaks.map((b, i) => {
        const bl = pct(toMin(b.startTime));
        const bw = Math.max(0.8, pct(toMin(b.endTime)) - bl);
        return <div key={i} className="absolute h-full bg-amber-400" style={{ left: `${bl}%`, width: `${bw}%` }} />;
      })}
    </div>
  );
}

type DayLocal = { startTime: string; endTime: string; breaks: ScheduleBreak[] };

export function ScheduleEditor({ schedules, onUpsert, onDelete, isLoading }: ScheduleEditorProps) {
  const [local, setLocal] = useState<Map<number, DayLocal>>(new Map());
  const [editingBreak, setEditingBreak] = useState<{ day: number; idx: number } | null>(null);

  const byDay = new Map(schedules.map(s => [s.dayOfWeek, s]));

  useEffect(() => {
    setLocal(prev => {
      const next = new Map(prev);
      for (const s of schedules) {
        if (!next.has(s.dayOfWeek)) {
          next.set(s.dayOfWeek, { startTime: s.startTime, endTime: s.endTime, breaks: s.breaks ?? [] });
        }
      }
      return next;
    });
  }, [schedules]);

  function getDay(dow: number): DayLocal {
    if (local.has(dow)) return local.get(dow)!;
    const s = byDay.get(dow);
    return s ? { startTime: s.startTime, endTime: s.endTime, breaks: s.breaks ?? [] }
             : { startTime: "08:00", endTime: "17:00", breaks: [] };
  }

  function patchLocal(dow: number, patch: Partial<DayLocal>) {
    setLocal(prev => new Map(prev).set(dow, { ...getDay(dow), ...patch }));
  }

  async function save(dow: number, patch: Partial<DayLocal>) {
    const merged = { ...getDay(dow), ...patch };
    patchLocal(dow, patch);
    await onUpsert({ dayOfWeek: dow, ...merged });
  }

  async function toggleDay(dow: number, isWorking: boolean) {
    if (isWorking) {
      const slot = byDay.get(dow);
      if (slot) {
        setLocal(prev => { const m = new Map(prev); m.delete(dow); return m; });
        await onDelete(slot.id);
      }
    } else {
      const def: DayLocal = { startTime: "08:00", endTime: "17:00", breaks: [] };
      setLocal(prev => new Map(prev).set(dow, def));
      await onUpsert({ dayOfWeek: dow, ...def });
    }
  }

  async function copyToAllWorking(dow: number) {
    const src = getDay(dow);
    for (const d of DAYS) {
      if (d.iso === dow || !byDay.has(d.iso)) continue;
      await save(d.iso, { startTime: src.startTime, endTime: src.endTime, breaks: src.breaks.map(b => ({ ...b })) });
    }
  }

  async function addBreak(dow: number) {
    const current = getDay(dow);
    const nb: ScheduleBreak = { name: "Почивка", startTime: "12:00", endTime: "12:30" };
    const breaks = [...current.breaks, nb];
    await save(dow, { breaks });
    setEditingBreak({ day: dow, idx: breaks.length - 1 });
  }

  async function removeBreak(dow: number, idx: number) {
    const breaks = getDay(dow).breaks.filter((_, i) => i !== idx);
    if (editingBreak?.day === dow && editingBreak.idx === idx) setEditingBreak(null);
    await save(dow, { breaks });
  }

  function patchBreak(dow: number, idx: number, field: keyof ScheduleBreak, value: string) {
    const d = getDay(dow);
    const breaks = d.breaks.map((b, i) => i === idx ? { ...b, [field]: value } : b);
    patchLocal(dow, { breaks });
  }

  async function saveBreaks(dow: number) {
    const current = getDay(dow);
    await onUpsert({ dayOfWeek: dow, ...current });
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-1.5">
      {DAYS.map(d => {
        const slot = byDay.get(d.iso);
        const isWorking = !!slot;
        const day = getDay(d.iso);

        return (
          <div
            key={d.iso}
            className={`rounded-lg border transition-all ${
              isWorking ? "border-border bg-card" : "border-transparent bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Switch
                checked={isWorking}
                onCheckedChange={() => toggleDay(d.iso, isWorking)}
                className="shrink-0 data-[state=checked]:bg-primary"
              />

              <span className={`w-28 text-sm shrink-0 font-medium select-none ${
                isWorking ? "text-foreground" : "text-muted-foreground"
              }`}>
                {d.label}
              </span>

              {isWorking ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      value={day.startTime}
                      onChange={e => patchLocal(d.iso, { startTime: e.target.value })}
                      onBlur={e => save(d.iso, { startTime: e.target.value })}
                      className="h-7 w-[5.5rem] text-sm font-mono tabular-nums px-2 text-center"
                    />
                    <span className="text-muted-foreground text-xs select-none">→</span>
                    <Input
                      type="time"
                      value={day.endTime}
                      onChange={e => patchLocal(d.iso, { endTime: e.target.value })}
                      onBlur={e => save(d.iso, { endTime: e.target.value })}
                      className="h-7 w-[5.5rem] text-sm font-mono tabular-nums px-2 text-center"
                    />
                  </div>

                  <Badge
                    variant="outline"
                    className="text-xs font-mono tabular-nums text-muted-foreground border-border shrink-0 hidden sm:flex"
                  >
                    {formatDuration(day.startTime, day.endTime, day.breaks)}
                  </Badge>

                  <div className="ml-auto flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Шаблони и действия"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem disabled className="text-xs text-muted-foreground font-medium">Шаблони</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {PRESETS.map(p => (
                          <DropdownMenuItem
                            key={p.label}
                            onSelect={() => save(d.iso, { startTime: p.start, endTime: p.end })}
                            className="text-sm"
                          >
                            {p.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => copyToAllWorking(d.iso)} className="text-sm gap-2">
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                          Копирай на всички работни
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground italic select-none">почивен ден</span>
              )}
            </div>

            {isWorking && (
              <div className="px-3 pb-3 space-y-2 mt-0.5">
                <DayTimeline start={day.startTime} end={day.endTime} breaks={day.breaks} />

                <div className="flex flex-wrap gap-1.5 items-center min-h-[1.75rem]">
                  {day.breaks.map((brk, i) => {
                    const isEdit = editingBreak?.day === d.iso && editingBreak.idx === i;
                    return isEdit ? (
                      <div
                        key={i}
                        className="flex items-center gap-1 bg-amber-500/10 border border-amber-400/40 rounded-md px-2 py-1"
                      >
                        <Coffee className="h-3 w-3 text-amber-500 shrink-0" />
                        <Input
                          autoFocus
                          value={brk.name}
                          onChange={e => patchBreak(d.iso, i, "name", e.target.value)}
                          onBlur={() => saveBreaks(d.iso)}
                          className="h-5 w-20 text-xs px-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          placeholder="Вид почивка"
                        />
                        <Input
                          type="time"
                          value={brk.startTime}
                          onChange={e => patchBreak(d.iso, i, "startTime", e.target.value)}
                          onBlur={() => saveBreaks(d.iso)}
                          className="h-5 w-[4.5rem] text-xs font-mono px-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={brk.endTime}
                          onChange={e => patchBreak(d.iso, i, "endTime", e.target.value)}
                          onBlur={() => saveBreaks(d.iso)}
                          className="h-5 w-[4.5rem] text-xs font-mono px-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <button
                          type="button"
                          onClick={() => { saveBreaks(d.iso); setEditingBreak(null); }}
                          className="h-4 w-4 flex items-center justify-center rounded hover:text-primary transition-colors text-muted-foreground"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBreak(d.iso, i)}
                          className="h-4 w-4 flex items-center justify-center rounded hover:text-destructive transition-colors text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEditingBreak({ day: d.iso, idx: i })}
                        className="group flex items-center gap-1.5 bg-amber-500/10 border border-amber-400/20 rounded-md px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-400/40 transition-colors"
                      >
                        <Coffee className="h-3 w-3 shrink-0" />
                        <span className="font-medium">{brk.name}</span>
                        <span className="font-mono text-amber-600/70 dark:text-amber-500/70">
                          {brk.startTime}–{brk.endTime}
                        </span>
                        <span
                          role="button"
                          onClick={e => { e.stopPropagation(); removeBreak(d.iso, i); }}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addBreak(d.iso)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded-md px-2 py-0.5 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Добави почивка
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
