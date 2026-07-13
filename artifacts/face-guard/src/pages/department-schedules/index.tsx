import {
  useListDepartments,
  useListDepartmentSchedules, useUpsertDepartmentSchedule, useDeleteDepartmentSchedule, getListDepartmentSchedulesQueryKey,
} from "@workspace/api-client-react";
import type { ScheduleBreak } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Building2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const DAYS = [
  { iso: 1, label: "Понеделник" },
  { iso: 2, label: "Вторник" },
  { iso: 3, label: "Сряда" },
  { iso: 4, label: "Четвъртък" },
  { iso: 5, label: "Петък" },
  { iso: 6, label: "Събота" },
  { iso: 7, label: "Неделя" },
];

function DepartmentScheduleCard({ departmentId, departmentName }: { departmentId: number; departmentName: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: schedules = [], isLoading } = useListDepartmentSchedules({ departmentId });
  const upsert = useUpsertDepartmentSchedule();
  const del    = useDeleteDepartmentSchedule();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListDepartmentSchedulesQueryKey({ departmentId }) });

  // Local breaks state per dayOfWeek
  const [localBreaks, setLocalBreaks] = useState<Map<number, ScheduleBreak[]>>(new Map());

  useEffect(() => {
    setLocalBreaks(prev => {
      const next = new Map(prev);
      for (const s of schedules) {
        if (!next.has(s.dayOfWeek)) next.set(s.dayOfWeek, s.breaks ?? []);
      }
      return next;
    });
  }, [schedules]);

  const byDay = new Map(schedules.map(s => [s.dayOfWeek, s]));

  async function toggleDay(dayOfWeek: number, isWorking: boolean) {
    if (isWorking) {
      const slot = byDay.get(dayOfWeek);
      if (slot) {
        setLocalBreaks(prev => { const m = new Map(prev); m.delete(dayOfWeek); return m; });
        await del.mutateAsync({ id: slot.id }, { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) });
      }
    } else {
      setLocalBreaks(prev => { const m = new Map(prev); m.set(dayOfWeek, []); return m; });
      await upsert.mutateAsync(
        { data: { departmentId, dayOfWeek, startTime: "08:00", endTime: "17:00", breaks: [] } },
        { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) },
      );
    }
  }

  async function updateTime(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    const slot = byDay.get(dayOfWeek);
    if (!slot) return;
    const startTime = field === "startTime" ? value : slot.startTime;
    const endTime   = field === "endTime"   ? value : slot.endTime;
    const breaks    = localBreaks.get(dayOfWeek) ?? slot.breaks ?? [];
    await upsert.mutateAsync(
      { data: { departmentId, dayOfWeek, startTime, endTime, breaks } },
      { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) },
    );
  }

  async function saveBreaks(dayOfWeek: number, breaks: ScheduleBreak[]) {
    const slot = byDay.get(dayOfWeek);
    if (!slot) return;
    setLocalBreaks(prev => { const m = new Map(prev); m.set(dayOfWeek, breaks); return m; });
    await upsert.mutateAsync(
      { data: { departmentId, dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, breaks } },
      { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) },
    );
  }

  function addBreak(dayOfWeek: number) {
    const current = localBreaks.get(dayOfWeek) ?? [];
    const next = [...current, { name: "Технологична почивка", startTime: "10:00", endTime: "10:15" }];
    saveBreaks(dayOfWeek, next);
  }

  function removeBreak(dayOfWeek: number, index: number) {
    const current = localBreaks.get(dayOfWeek) ?? [];
    saveBreaks(dayOfWeek, current.filter((_, i) => i !== index));
  }

  function updateBreakField(dayOfWeek: number, index: number, field: keyof ScheduleBreak, value: string) {
    setLocalBreaks(prev => {
      const m = new Map(prev);
      const arr = [...(m.get(dayOfWeek) ?? [])];
      arr[index] = { ...arr[index], [field]: value };
      m.set(dayOfWeek, arr);
      return m;
    });
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {departmentName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <div className="divide-y divide-border">
            {DAYS.map(d => {
              const slot = byDay.get(d.iso);
              const isWorking = !!slot;
              const breaks = localBreaks.get(d.iso) ?? slot?.breaks ?? [];

              return (
                <div key={d.iso} className="py-2.5 space-y-1.5">
                  {/* Day row */}
                  <div className={`flex items-center gap-3 ${isWorking ? "" : "opacity-40"}`}>
                    <input
                      type="checkbox"
                      checked={isWorking}
                      onChange={() => toggleDay(d.iso, isWorking)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                    />
                    <span className={`text-sm w-28 shrink-0 ${isWorking ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {d.label}
                    </span>
                    {isWorking && slot ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          defaultValue={slot.startTime}
                          key={`${d.iso}-start-${slot.startTime}`}
                          className="h-7 w-24 text-xs font-mono px-2"
                          onBlur={e => updateTime(d.iso, "startTime", e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">—</span>
                        <Input
                          type="time"
                          defaultValue={slot.endTime}
                          key={`${d.iso}-end-${slot.endTime}`}
                          className="h-7 w-24 text-xs font-mono px-2"
                          onBlur={e => updateTime(d.iso, "endTime", e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-xs text-muted-foreground italic">почивен ден</span>
                    )}
                  </div>

                  {/* Breaks sub-section */}
                  {isWorking && (
                    <div className="ml-7 space-y-1">
                      {breaks.map((brk, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Input
                            defaultValue={brk.name}
                            key={`${d.iso}-brk-name-${i}-${brk.name}`}
                            placeholder="Вид почивка"
                            className="h-6 text-xs px-2 flex-1 min-w-0"
                            onChange={e => updateBreakField(d.iso, i, "name", e.target.value)}
                            onBlur={() => saveBreaks(d.iso, breaks)}
                          />
                          <Input
                            type="time"
                            defaultValue={brk.startTime}
                            key={`${d.iso}-brk-s-${i}`}
                            className="h-6 w-20 text-xs font-mono px-1.5 shrink-0"
                            onChange={e => updateBreakField(d.iso, i, "startTime", e.target.value)}
                            onBlur={() => saveBreaks(d.iso, breaks)}
                          />
                          <span className="text-xs text-muted-foreground">—</span>
                          <Input
                            type="time"
                            defaultValue={brk.endTime}
                            key={`${d.iso}-brk-e-${i}`}
                            className="h-6 w-20 text-xs font-mono px-1.5 shrink-0"
                            onChange={e => updateBreakField(d.iso, i, "endTime", e.target.value)}
                            onBlur={() => saveBreaks(d.iso, breaks)}
                          />
                          <button
                            type="button"
                            onClick={() => removeBreak(d.iso, i)}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBreak(d.iso)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        Добави почивка
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DepartmentSchedulesPage() {
  const { data: departments, isLoading } = useListDepartments();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Работно време по отдели</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}
        </div>
      ) : departments && departments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <DepartmentScheduleCard key={dept.id} departmentId={dept.id} departmentName={dept.name} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Building2 className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm">Няма конфигурирани отдели.</p>
        </div>
      )}
    </div>
  );
}
