import { useListEmployees, useDeleteEmployee, useUpdateEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, User, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const editSchema = z.object({
  firstName: z.string().min(1, "Задължително"),
  lastName: z.string().min(1, "Задължително"),
  employeeNumber: z.string().min(1, "Задължително"),
  department: z.string().min(1, "Задължително"),
  position: z.string().min(1, "Задължително"),
  email: z.string().email("Невалиден имейл").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

type EditEmployee = { id: number; firstName: string; lastName: string; employeeNumber: string; department: string; position: string; email?: string | null; phone?: string | null; status: "active" | "inactive" };

export default function EmployeeList() {
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<EditEmployee | null>(null);
  const { data: employees, isLoading } = useListEmployees({ search: search || undefined });
  const deleteEmployee = useDeleteEmployee();
  const updateEmployee = useUpdateEmployee();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: editTarget ? {
      firstName: editTarget.firstName,
      lastName: editTarget.lastName,
      employeeNumber: editTarget.employeeNumber,
      department: editTarget.department ?? "",
      position: editTarget.position ?? "",
      email: editTarget.email ?? "",
      phone: editTarget.phone ?? "",
      status: editTarget.status,
    } : undefined,
  });

  function openEdit(emp: EditEmployee, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTarget(emp);
  }

  function handleEdit(values: z.infer<typeof editSchema>) {
    if (!editTarget) return;
    updateEmployee.mutate({ id: editTarget.id, data: values }, {
      onSuccess: () => {
        toast({ title: "Данните са актуализирани" });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setEditTarget(null);
      },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(id: number, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteEmployee.mutate({ id }, {
      onSuccess: () => {
        toast({ title: `${name} беше изтрит/а` });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Редактиране на служител</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEdit)} className="grid grid-cols-2 gap-4 mt-2">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>Име</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Фамилия</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="employeeNumber" render={({ field }) => (
                <FormItem><FormLabel>Служебен номер</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Отдел</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem><FormLabel>Длъжност</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Статус</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Активен</SelectItem>
                      <SelectItem value="inactive">Неактивен</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Имейл</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Телефон</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Отказ</Button>
                <Button type="submit" disabled={updateEmployee.isPending}>
                  {updateEmployee.isPending ? "Запазване..." : "Запази промените"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Регистър на персонала</h1>
        <Link href="/employees/new">
          <Button className="font-mono text-xs uppercase tracking-wider">
            <Plus className="mr-2 h-4 w-4" /> Регистрирай служител
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Търсене по име, номер или отдел..."
            className="pl-9 font-mono bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[80px]">Снимка</TableHead>
              <TableHead>Име</TableHead>
              <TableHead>Служебен №</TableHead>
              <TableHead>Отдел</TableHead>
              <TableHead>Длъжност</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : employees && employees.length > 0 ? (
              employees.map((employee) => {
                const fullName = `${employee.firstName} ${employee.lastName}`;
                return (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => window.location.href = `/employees/${employee.id}`}
                  >
                    <TableCell>
                      <div className="h-10 w-10 bg-muted rounded-md border border-border overflow-hidden flex items-center justify-center">
                        {employee.photoUrl ? (
                          <img src={employee.photoUrl} alt={employee.firstName} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{fullName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{employee.employeeNumber}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={employee.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground'}>
                        {employee.status === 'active' ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => openEdit({ id: employee.id, firstName: employee.firstName, lastName: employee.lastName, employeeNumber: employee.employeeNumber, department: employee.department ?? "", position: employee.position ?? "", email: employee.email, phone: employee.phone, status: employee.status as "active" | "inactive" }, e)}
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
                            <AlertDialogTitle>Изтриване на служител</AlertDialogTitle>
                            <AlertDialogDescription>
                              Сигурни ли сте, че искате да изтриете <strong>{fullName}</strong>? Всички свързани данни (разпознавания, присъствие, права за достъп) ще бъдат изтрити. Това действие е необратимо.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отказ</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => handleDelete(employee.id, fullName, e)}
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
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Няма намерен персонал.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
