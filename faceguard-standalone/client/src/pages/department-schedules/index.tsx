import {
  useListDepartments,
  useListDepartmentSchedules, useUpsertDepartmentSchedule, useDeleteDepartmentSchedule, getListDepartmentSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Building2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const DAYS = [
  { iso: 1, label: "Понеделник" },
  { iso: 2, label: "Вторник" },
  { iso: 3, label: "Сряда" },
  { iso: 4, label: "Четвъртък" },
  { iso: 5, label: "Петък" },
  { iso: 6, label: "Събота" },
  { iso: 7, label: "Неделя" },
];

const DAY_GROUPS: { label: string; days: number[] }[] = [
  { label: "Всеки ден", days: [1, 2, 3, 4, 5, 6, 7] },
  { label: "Работни дни (Пон–Пет)", days: [1, 2, 3, 4, 5] },
  { label: "Уикенд (Съб–Нед)", days: [6, 7] },
];

const slotSchema = z.object({
  daysOfWeek: z.array(z.number().min(1).max(7)).min(1, "Изберете поне един ден"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Формат ЧЧ:ММ"),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, "Формат ЧЧ:ММ"),
});
type SlotForm = z.infer<typeof slotSchema>;

function DepartmentScheduleCard({ departmentId, departmentName, isAdmin }: { departmentId: number; departmentName: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: schedules = [], isLoading } = useListDepartmentSchedules({ departmentId });

  const upsert = useUpsertDepartmentSchedule();
  const del    = useDeleteDepartmentSchedule();

  const form = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: { daysOfWeek: [1], startTime: "08:00", endTime: "17:00" },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListDepartmentSchedulesQueryKey({ departmentId }) });

  async function onAdd(values: SlotForm) {
    try {
      await Promise.all(
        values.daysOfWeek.map((dayOfWeek) =>
          upsert.mutateAsync({ data: { departmentId, dayOfWeek, startTime: values.startTime, endTime: values.endTime } })
        )
      );
      toast({ title: "Работното време е записано" });
      invalidate();
    } catch {
      toast({ title: "Грешка при запис", variant: "destructive" });
    }
  }

  async function onDelete(id: number) {
    await del.mutateAsync(
      { id },
      {
        onSuccess: () => { toast({ title: "Часът е изтрит" }); invalidate(); },
        onError:   () => toast({ title: "Грешка при изтриване", variant: "destructive" }),
      }
    );
  }

  const scheduledDays = new Set(schedules.map((s) => s.dayOfWeek));

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {departmentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Няма зададено работно време.</p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium w-32">{DAYS.find((d) => d.iso === s.dayOfWeek)?.label}</span>
                <span className="font-mono text-muted-foreground">{s.startTime} — {s.endTime}</span>
                {isAdmin && (
                <Button
                  variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => onDelete(s.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
                )}
              </div>
            ))
          )}
        </div>

        {isAdmin && (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Добави / Замени работно време</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAdd)} className="space-y-3">
              <FormField control={form.control} name="daysOfWeek" render={({ field }) => (
                <FormItem>
                  <FormLabel>Дни</FormLabel>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {DAY_GROUPS.map((g) => (
                      <Button
                        key={g.label} type="button" size="sm" variant="outline"
                        className="h-7 text-xs"
                        onClick={() => field.onChange(g.days)}
                      >
                        {g.label}
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => field.onChange([])}>
                      Изчисти
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS.map((d) => (
                      <label key={d.iso} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={field.value.includes(d.iso)}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked
                                ? [...field.value, d.iso].sort((a, b) => a - b)
                                : field.value.filter((v) => v !== d.iso)
                            );
                          }}
                        />
                        {d.label}{scheduledDays.has(d.iso) ? " ✓" : ""}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Начало</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Край</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" disabled={upsert.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Запази работно време
              </Button>
            </form>
          </Form>
        </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DepartmentSchedulesPage() {
  const { data: departments, isLoading } = useListDepartments();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

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
            <DepartmentScheduleCard key={dept.id} departmentId={dept.id} departmentName={dept.name} isAdmin={isAdmin} />
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
