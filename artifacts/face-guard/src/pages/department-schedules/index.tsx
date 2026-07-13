import {
  useListDepartments,
  useListDepartmentSchedules, useUpsertDepartmentSchedule, useDeleteDepartmentSchedule, getListDepartmentSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const DAYS = [
  { iso: 1, label: "Понеделник", short: "Пн" },
  { iso: 2, label: "Вторник",    short: "Вт" },
  { iso: 3, label: "Сряда",      short: "Ср" },
  { iso: 4, label: "Четвъртък",  short: "Чт" },
  { iso: 5, label: "Петък",      short: "Пт" },
  { iso: 6, label: "Събота",     short: "Сб" },
  { iso: 7, label: "Неделя",     short: "Нд" },
];

function DepartmentScheduleCard({ departmentId, departmentName }: { departmentId: number; departmentName: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: schedules = [], isLoading } = useListDepartmentSchedules({ departmentId });
  const upsert = useUpsertDepartmentSchedule();
  const del    = useDeleteDepartmentSchedule();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListDepartmentSchedulesQueryKey({ departmentId }) });

  async function toggleDay(dayOfWeek: number, isWorking: boolean) {
    if (isWorking) {
      const slot = byDay.get(dayOfWeek);
      if (slot) await del.mutateAsync({ id: slot.id }, { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) });
    } else {
      await upsert.mutateAsync({ data: { departmentId, dayOfWeek, startTime: "08:00", endTime: "17:00" } }, { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) });
    }
  }

  async function updateTime(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    const slot = byDay.get(dayOfWeek);
    if (!slot) return;
    const startTime = field === "startTime" ? value : slot.startTime;
    const endTime   = field === "endTime"   ? value : slot.endTime;
    await upsert.mutateAsync({ data: { departmentId, dayOfWeek, startTime, endTime } }, { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) });
  }

  const byDay = new Map(schedules.map(s => [s.dayOfWeek, s]));

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
              return (
                <div key={d.iso} className={`flex items-center gap-3 py-2.5 ${isWorking ? "" : "opacity-40"}`}>
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
