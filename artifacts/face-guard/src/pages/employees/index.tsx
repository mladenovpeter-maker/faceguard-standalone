import { useListEmployees, useDeleteEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, User, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeList() {
  const [search, setSearch] = useState("");
  const { data: employees, isLoading } = useListEmployees({ search: search || undefined });
  const deleteEmployee = useDeleteEmployee();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
