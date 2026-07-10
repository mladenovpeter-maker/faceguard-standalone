import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListLeaves,
  useCreateLeave,
  useUpdateLeave,
  useDeleteLeave,
  useListEmployees,
  getListLeavesQueryKey,
} from "@workspace/api-client-react";
import type { LeaveRecord } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Plane, Stethoscope, FileX, AlertCircle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

/* ── Types ── */
const LEAVE_TYPES = [
  { value: "paid_leave",   label: "Платен отпуск",   icon: Plane,        color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "unpaid_leave", label: "Неплатен отпуск", icon: FileX,        color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "sick_leave",   label: "Болничен",         icon: Stethoscope,  color: "bg-red-100 text-red-700 border-red-200" },
  { value: "other",        label: "Друга причина",    icon: AlertCircle,  color: "bg-purple-100 text-purple-700 border-purple-200" },
];

const STATUSES = [
  { value: "approved", label: "Одобрена",  cls: "bg-green-100 text-green-700 border-green-200" },
  { value: "pending",  label: "Изчаква",   cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "rejected", label: "Отказана",  cls: "bg-red-100 text-red-700 border-red-200" },
];

function LeaveTypeBadge({ type }: { type: string }) {
  const cfg = LEAVE_TYPES.find((t) => t.value === type);
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUSES.find((s) => s.value === status);
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("bg-BG", { day: "numeric", month: "short", year: "numeric" });
}

function daysCount(from: string, to: string) {
  const diff = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1;
  return diff > 0 ? diff : 1;
}

/* ── Form schema ── */
const leaveSchema = z.object({
  employeeId: z.coerce.number({ error: "Изберете служител" }).min(1, "Изберете служител"),
  type: z.enum(["paid_leave", "unpaid_leave", "sick_leave", "other"], { error: "Изберете тип" }),
  startDate: z.string().min(1, "Въведете начална дата"),
  endDate:   z.string().min(1, "Въведете крайна дата"),
  reason:    z.string().optional(),
  status:    z.enum(["approved", "pending", "rejected"]).default("approved"),
  notes:     z.string().optional(),
});
type LeaveForm = z.infer<typeof leaveSchema>;

/* ── Main component ── */
export default function LeavesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState<LeaveRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveRecord | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: leaves = [], isLoading } = useListLeaves(
    filterStatus !== "all" ? { status: filterStatus as any } : {}
  );
  const { data: employees = [] } = useListEmployees({ status: "active" });

  const createLeave = useCreateLeave();
  const updateLeave = useUpdateLeave();
  const deleteLeave = useDeleteLeave();

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: "paid_leave", status: "approved" },
  });

  function openAdd() {
    setEditing(null);
    form.reset({ type: "paid_leave", status: "approved" });
    setDialogOpen(true);
  }

  function openEdit(leave: LeaveRecord) {
    setEditing(leave);
    form.reset({
      employeeId: leave.employeeId,
      type:       leave.type as any,
      startDate:  leave.startDate,
      endDate:    leave.endDate,
      reason:     leave.reason ?? "",
      status:     leave.status as any,
      notes:      leave.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: LeaveForm) {
    const invalidate = () => qc.invalidateQueries({ queryKey: getListLeavesQueryKey() });
    if (editing) {
      await updateLeave.mutateAsync(
        { id: editing.id, data: values as any },
        {
          onSuccess: () => { toast({ title: "Отпуската е обновена" }); invalidate(); setDialogOpen(false); },
          onError: ()  => toast({ title: "Грешка при обновяване", variant: "destructive" }),
        }
      );
    } else {
      await createLeave.mutateAsync(
        { data: values as any },
        {
          onSuccess: () => { toast({ title: "Отпуската е добавена" }); invalidate(); setDialogOpen(false); },
          onError: ()  => toast({ title: "Грешка при добавяне", variant: "destructive" }),
        }
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteLeave.mutateAsync(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Отпуската е изтрита" });
          qc.invalidateQueries({ queryKey: getListLeavesQueryKey() });
        },
        onError: () => toast({ title: "Грешка при изтриване", variant: "destructive" }),
      }
    );
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Отпуски</h1>
        {isAdmin && (
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          ДОБАВИ ОТПУСКА
        </Button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "Всички" }, ...STATUSES.map((s) => ({ value: s.value, label: s.label }))].map((f) => (
          <Button
            key={f.value}
            variant={filterStatus === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Служител</th>
              <th className="text-left px-4 py-3">Тип отпуска</th>
              <th className="text-left px-4 py-3">Начало</th>
              <th className="text-left px-4 py-3">Край</th>
              <th className="text-left px-4 py-3">Дни</th>
              <th className="text-left px-4 py-3">Причина</th>
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-right px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : leaves.length > 0 ? (
              leaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{leave.employeeName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{leave.employeeNumber}</div>
                  </td>
                  <td className="px-4 py-3"><LeaveTypeBadge type={leave.type} /></td>
                  <td className="px-4 py-3 font-mono">{formatDate(leave.startDate)}</td>
                  <td className="px-4 py-3 font-mono">{formatDate(leave.endDate)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {daysCount(leave.startDate, leave.endDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{leave.reason || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && (
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(leave)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(leave)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Няма записани отпуски.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit dialog */}
      {isAdmin && (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактирай отпуска" : "Добави отпуска"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="employeeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Служител</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={!!editing}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Изберете служител" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.firstName} {e.lastName} ({e.employeeNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип отпуска</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Начална дата</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Крайна дата</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Причина (по избор)</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Кратко описание..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Бележки (вътрешни)</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Вътрешни бележки..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отказ</Button>
                <Button type="submit" disabled={createLeave.isPending || updateLeave.isPending}>
                  {editing ? "Запази" : "Добави"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      )}

      {/* Delete confirmation */}
      {isAdmin && (
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на отпуска</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете отпуската на{" "}
              <strong>{deleteTarget?.employeeName}</strong> ({deleteTarget?.startDate} — {deleteTarget?.endDate})?
              Действието е необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
    </div>
  );
}
