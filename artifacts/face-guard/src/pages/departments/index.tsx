import {
  useListDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
  getListDepartmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const departmentSchema = z.object({
  name: z.string().min(1, "Наименованието е задължително"),
});
type DepartmentFormValues = z.infer<typeof departmentSchema>;

function DepartmentForm({ defaultValues, onSubmit, isPending, submitLabel }: {
  defaultValues: DepartmentFormValues;
  onSubmit: (v: DepartmentFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const form = useForm<DepartmentFormValues>({ resolver: zodResolver(departmentSchema), defaultValues });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Наименование на отдела</FormLabel>
            <FormControl><Input placeholder="напр. Счетоводство" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Запазване..." : submitLabel}
        </Button>
      </form>
    </Form>
  );
}

export default function DepartmentList() {
  const { data: departments, isLoading } = useListDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<{ id: number; name: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });

  function handleCreate(values: DepartmentFormValues) {
    createDepartment.mutate({ data: values }, {
      onSuccess: () => { toast({ title: "Отделът е създаден успешно" }); invalidate(); setCreateOpen(false); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleEdit(values: DepartmentFormValues) {
    if (!editDept) return;
    updateDepartment.mutate({ id: editDept.id, data: values }, {
      onSuccess: () => { toast({ title: "Отделът е актуализиран" }); invalidate(); setEditDept(null); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteDepartment.mutate({ id }, {
      onSuccess: () => { toast({ title: "Отделът е изтрит" }); invalidate(); },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message ?? "Отделът има назначени служители", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Отдели</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs uppercase tracking-wider">
              <Plus className="mr-2 h-4 w-4" /> Добави отдел
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Създаване на нов отдел</DialogTitle></DialogHeader>
            <DepartmentForm
              defaultValues={{ name: "" }}
              onSubmit={handleCreate}
              isPending={createDepartment.isPending}
              submitLabel="Създай отдел"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editDept} onOpenChange={(o) => !o && setEditDept(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактиране на отдел</DialogTitle></DialogHeader>
          {editDept && (
            <DepartmentForm
              defaultValues={{ name: editDept.name }}
              onSubmit={handleEdit}
              isPending={updateDepartment.isPending}
              submitLabel="Запази промените"
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead className="text-center">Служители</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : departments && departments.length > 0 ? (
              departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {dept.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground font-mono text-sm">
                      <Users className="h-3.5 w-3.5" />
                      {dept.employeeCount ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditDept({ id: dept.id, name: dept.name })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Изтриване на отдел</AlertDialogTitle>
                            <AlertDialogDescription>
                              Сигурни ли сте, че искате да изтриете отдел <strong>„{dept.name}"</strong>? Това действие е необратимо.
                              {(dept.employeeCount ?? 0) > 0 && (
                                <span className="block mt-2 text-destructive">Отделът има {dept.employeeCount} назначени служители и не може да бъде изтрит.</span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отказ</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(dept.id)}
                              disabled={(dept.employeeCount ?? 0) > 0}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Изтрий
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Няма конфигурирани отдели.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
