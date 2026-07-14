import {
  useListZones, useCreateZone, useUpdateZone, useDeleteZone, getListZonesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Plus, Pencil, Trash2, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

/* ─── Zone form ─── */
const zoneSchema = z.object({
  name: z.string().min(1, "Наименованието е задължително"),
  description: z.string().optional(),
  zoneType: z.enum(["entry", "exit"]),
});
type ZoneFormValues = z.infer<typeof zoneSchema>;

function ZoneForm({ defaultValues, onSubmit, isPending, submitLabel }: {
  defaultValues: ZoneFormValues;
  onSubmit: (v: ZoneFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const form = useForm<ZoneFormValues>({ resolver: zodResolver(zoneSchema), defaultValues });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Наименование на зоната</FormLabel>
            <FormControl><Input placeholder="напр. Сървърна зала" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Описание (незадължително)</FormLabel>
            <FormControl><Input placeholder="Кратко описание на помещението" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="zoneType" render={({ field }) => (
          <FormItem>
            <FormLabel>Тип зона</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Избери тип" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="entry">Вход — стартира работното време</SelectItem>
                <SelectItem value="exit">Изход — приключва работното време</SelectItem>
              </SelectContent>
            </Select>
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

/* ─── Main ─── */
export default function ZoneList() {
  const { data: zones, isLoading } = useListZones();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone();
  const deleteZone = useDeleteZone();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editZone, setEditZone] = useState<{ id: number; name: string; description?: string | null; zoneType: "entry" | "exit" } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });

  function handleCreate(values: ZoneFormValues) {
    createZone.mutate({ data: { ...values, accessLevel: "public" } }, {
      onSuccess: () => { toast({ title: "Зоната е създадена успешно" }); invalidate(); setCreateOpen(false); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleEdit(values: ZoneFormValues) {
    if (!editZone) return;
    updateZone.mutate({ id: editZone.id, data: { ...values, accessLevel: "public" } }, {
      onSuccess: () => { toast({ title: "Зоната е актуализирана" }); invalidate(); setEditZone(null); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteZone.mutate({ id }, {
      onSuccess: () => { toast({ title: "Зоната е изтрита" }); invalidate(); },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Зони</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs uppercase tracking-wider">
              <Plus className="mr-2 h-4 w-4" /> Добави зона
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Създаване на нова зона</DialogTitle></DialogHeader>
            <ZoneForm
              defaultValues={{ name: "", description: "", zoneType: "entry" }}
              onSubmit={handleCreate}
              isPending={createZone.isPending}
              submitLabel="Създай зона"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editZone} onOpenChange={(o) => !o && setEditZone(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Редактиране на зона</DialogTitle></DialogHeader>
          {editZone && (
            <ZoneForm
              defaultValues={{
                name: editZone.name,
                description: editZone.description ?? "",
                zoneType: (editZone.zoneType ?? "general") as "entry" | "exit" | "general",
              }}
              onSubmit={handleEdit}
              isPending={updateZone.isPending}
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
              <TableHead>Описание</TableHead>
              <TableHead>Тип (турникет)</TableHead>
              <TableHead className="text-center">Камери</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : zones && zones.length > 0 ? (
              zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {zone.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{zone.description || "—"}</TableCell>
                  <TableCell><ZoneTypeBadge type={zone.zoneType ?? "general"} /></TableCell>
                  <TableCell className="text-center font-mono text-muted-foreground">{zone.cameraCount || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditZone({ id: zone.id, name: zone.name, description: zone.description, zoneType: (zone.zoneType === "exit" ? "exit" : "entry") })}
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
                            <AlertDialogTitle>Изтриване на зона</AlertDialogTitle>
                            <AlertDialogDescription>
                              Сигурни ли сте, че искате да изтриете зона <strong>„{zone.name}"</strong>? Това действие е необратимо.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отказ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(zone.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Няма конфигурирани зони.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ZoneTypeBadge({ type }: { type: string }) {
  if (type === "exit") return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20"><LogOut className="h-3 w-3 mr-1" />ИЗХОД</Badge>;
  return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20"><LogIn className="h-3 w-3 mr-1" />ВХОД</Badge>;
}
