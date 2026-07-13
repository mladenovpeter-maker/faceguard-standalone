import {
  useListDepartments,
  useListDepartmentSchedules, useUpsertDepartmentSchedule, useDeleteDepartmentSchedule, getListDepartmentSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Building2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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

  async function addDay(dayOfWeek: number) {
    await upsert.mutateAsync(
      { data: { departmentId, dayOfWeek, startTime: "08:00", endTime: "17:00" } },
      {
        onSuccess: () => { toast({ title: "Работният ден е добавен" }); invalidate(); },
        onError:   () => toast({ title: "Грешка при запис", variant: "destructive" }),
      }
    );
  }

  async function updateTime(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    const existing = schedules.find(s => s.dayOfWeek === dayOfWeek);
    if (!existing) return;
    const startTime = field === "startTime" ? value : existing.startTime;
    const endTime   = field === "endTime"   ? value : existing.endTime;
    await upsert.mutateAsync(
      { data: { departmentId, dayOfWeek, startTime, endTime } },
      {
        onSuccess: () => invalidate(),
        onError:   () => toast({ title: "Грешка при запис", variant: "destructive" }),
      }
    );
  }

  async function removeDay(id: number) {
    await del.mutateAsync(
      { id },
      {
        onSuccess: () => { toast({ title: "Денят е премахнат" }); invalidate(); },
        onError:   () => toast({ title: "Грешка при изтриване", variant: "destructive" }),
      }
    );
  }

  const byDay = new Map(schedules.map(s => [s.dayOfWeek, s]));
  const workingDays    = DAYS.filter(d => byDay.has(d.iso));
  const nonWorkingDays = DAYS.filter(d => !byDay.has(d.iso));

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {departmentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {/* Working days */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                Работни дни ({workingDays.length})
              </p>
              {workingDays.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1">Няма зададени работни дни</p>
              ) : (
                <div className="space-y-1.5">
                  {workingDays.map(d => {
                    const slot = byDay.get(d.iso)!;
                    return (
                      <div key={d.iso} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
                        <span className="text-sm font-medium w-28 shrink-0">{d.label}</span>
                        <Input
                          type="time"
                          defaultValue={slot.startTime}
                          className="h-7 w-24 text-xs font-mono px-2"
                          onBlur={e => updateTime(d.iso, "startTime", e.target.value)}
                        />
                        <span className="text-muted-foreground text-xs">—</span>
                        <Input
                          type="time"
                          defaultValue={slot.endTime}
                          className="h-7 w-24 text-xs font-mono px-2"
                          onBlur={e => updateTime(d.iso, "endTime", e.target.value)}
                        />
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 ml-auto text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeDay(slot.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Non-working days */}
            {nonWorkingDays.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Неработни дни ({nonWorkingDays.length})
                </p>
                <div className="space-y-1.5">
                  {nonWorkingDays.map(d => (
                    <div key={d.iso} className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-1.5 opacity-60 hover:opacity-100 transition-opacity">
                      <span className="text-sm font-medium w-28 shrink-0 text-muted-foreground">{d.label}</span>
                      <span className="text-xs text-muted-foreground italic flex-1">неработен</span>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 px-2 text-xs ml-auto shrink-0"
                        onClick={() => addDay(d.iso)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Добави
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
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
          <p className="text-sm">Няма конфигурирани отдели. Добавете отдел, за да зададете работно време.</p>
        </div>
      )}
    </div>
  );
}
