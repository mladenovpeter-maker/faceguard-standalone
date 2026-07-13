import {
  useListDepartments,
  useListDepartmentSchedules, useUpsertDepartmentSchedule, useDeleteDepartmentSchedule,
  getListDepartmentSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScheduleEditor } from "@/components/schedule-editor";
import type { UpsertScheduleData, ScheduleDay } from "@/components/schedule-editor";

function DepartmentScheduleCard({ departmentId, departmentName }: { departmentId: number; departmentName: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: schedules = [], isLoading } = useListDepartmentSchedules({ departmentId });
  const upsert = useUpsertDepartmentSchedule();
  const del = useDeleteDepartmentSchedule();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListDepartmentSchedulesQueryKey({ departmentId }) });

  async function handleUpsert(data: UpsertScheduleData) {
    await upsert.mutateAsync(
      { data: { departmentId, ...data } },
      { onSuccess: invalidate, onError: () => toast({ title: "Грешка при запазване", variant: "destructive" }) },
    );
  }

  async function handleDelete(id: number) {
    await del.mutateAsync(
      { id },
      { onSuccess: invalidate, onError: () => toast({ title: "Грешка при изтриване", variant: "destructive" }) },
    );
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
        <ScheduleEditor
          schedules={schedules as ScheduleDay[]}
          onUpsert={handleUpsert}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
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
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
        </div>
      ) : departments && departments.length > 0 ? (
        <div className="space-y-4">
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
