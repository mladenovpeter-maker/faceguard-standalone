import { useListAccessRules, useCreateAccessRule, useDeleteAccessRule, getListAccessRulesQueryKey, useListEmployees, useListZones } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const ruleSchema = z.object({
  employeeId: z.coerce.number().min(1, "Изберете служител"),
  zoneId: z.coerce.number().min(1, "Изберете зона"),
});

export default function AccessRulesList() {
  const { data: rules, isLoading } = useListAccessRules();
  const { data: employees } = useListEmployees();
  const { data: zones } = useListZones();

  const createRule = useCreateAccessRule();
  const deleteRule = useDeleteAccessRule();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const form = useForm<z.infer<typeof ruleSchema>>({
    resolver: zodResolver(ruleSchema),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAccessRulesQueryKey() });

  function onSubmit(values: z.infer<typeof ruleSchema>) {
    createRule.mutate({ data: values }, {
      onSuccess: () => { toast({ title: "Правото за достъп е добавено" }); invalidate(); setOpen(false); form.reset(); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteRule.mutate({ id }, {
      onSuccess: () => { toast({ title: "Правото е премахнато" }); invalidate(); },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Права за достъп</h1>
        {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs uppercase tracking-wider">
              <Plus className="mr-2 h-4 w-4" /> Даване на достъп
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Даване на достъп до зона</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Служител</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Избери служител" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {employees?.map(emp => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>
                            {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="zoneId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Зона</FormLabel>
                    <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Избери зона" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {zones?.map(zone => (
                          <SelectItem key={zone.id} value={zone.id.toString()}>{zone.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createRule.isPending}>
                  {createRule.isPending ? "Запазване..." : "Дай достъп"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Служител</TableHead>
              <TableHead>Служебен №</TableHead>
              <TableHead>Зона</TableHead>
              <TableHead>Дата на предоставяне</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : rules && rules.length > 0 ? (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.employeeName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{rule.employeeNumber}</TableCell>
                  <TableCell>{rule.zoneName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(rule.createdAt).toLocaleDateString('bg-BG')}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Премахване на право за достъп</AlertDialogTitle>
                          <AlertDialogDescription>
                            Сигурни ли сте, че искате да премахнете достъпа на <strong>{rule.employeeName}</strong> до зона <strong>„{rule.zoneName}"</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отказ</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Премахни
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Няма конфигурирани права за достъп.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
