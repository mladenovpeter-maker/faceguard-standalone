import {
  useListZones, useCreateZone, useUpdateZone, useDeleteZone, getListZonesQueryKey,
  useListZoneSchedules, useUpsertZoneSchedule, useDeleteZoneSchedule, getListZoneSchedulesQueryKey,
} from "@workspace/api-client-react";
import type { ZoneWorkSchedule } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Map, Plus, Shield, ShieldAlert, ShieldCheck, Pencil, Trash2, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

/* ─── Zone form ─── */
const zoneSchema = z.object({
  name: z.string().min(1, "Наименованието е задължително"),
  description: z.string().optional(),
  accessLevel: z.enum(["public", "restricted", "secure"]),
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
        <FormField control={form.control} name="accessLevel" render={({ field }) => (
          <FormItem>
            <FormLabel>Ниво на достъп</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Избери ниво" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="public">Публичен</SelectItem>
                <SelectItem value="restricted">Ограничен</SelectItem>
                <SelectItem value="secure">Сигурен</SelectItem>
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

/* ─── Work schedule dialog ─── */
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

function WorkScheduleDialog({ zoneId, zoneName }: { zoneId: number; zoneName: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: schedules = [], isLoading } = useListZoneSchedules(
    { zoneId },
    { query: { enabled: open } }
  );

  const upsert = useUpsertZoneSchedule();
  const del    = useDeleteZoneSchedule();

  const form = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: { daysOfWeek: [1], startTime: "08:00", endTime: "17:00" },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListZoneSchedulesQueryKey({ zoneId }) });

  async function onAdd(values: SlotForm) {
    try {
      await Promise.all(
        values.daysOfWeek.map((dayOfWeek) =>
          upsert.mutateAsync({ data: { zoneId, dayOfWeek, startTime: values.startTime, endTime: values.endTime } })
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Работно Време">
          <Clock className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Работно Време — {zoneName}</DialogTitle>
        </DialogHeader>

        {/* Existing slots */}
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
                <Button
                  variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => onDelete(s.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add slot form */}
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
                Запази работно време
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
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
  const [editZone, setEditZone] = useState<{ id: number; name: string; description?: string | null; accessLevel: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });

  function handleCreate(values: ZoneFormValues) {
    createZone.mutate({ data: values }, {
      onSuccess: () => { toast({ title: "Зоната е създадена успешно" }); invalidate(); setCreateOpen(false); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleEdit(values: ZoneFormValues) {
    if (!editZone) return;
    updateZone.mutate({ id: editZone.id, data: values }, {
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
              defaultValues={{ name: "", description: "", accessLevel: "restricted" }}
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
                accessLevel: editZone.accessLevel as "public" | "restricted" | "secure",
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
              <TableHead>Ниво на достъп</TableHead>
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
                      <Map className="h-4 w-4 text-muted-foreground shrink-0" />
                      {zone.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{zone.description || "—"}</TableCell>
                  <TableCell><AccessLevelBadge level={zone.accessLevel} /></TableCell>
                  <TableCell className="text-center font-mono text-muted-foreground">{zone.cameraCount || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Work schedule */}
                      <WorkScheduleDialog zoneId={zone.id} zoneName={zone.name} />

                      {/* Edit */}
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditZone({ id: zone.id, name: zone.name, description: zone.description, accessLevel: zone.accessLevel })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
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

function AccessLevelBadge({ level }: { level: string }) {
  if (level === "public")  return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><ShieldCheck className="h-3 w-3 mr-1" />ПУБЛИЧЕН</Badge>;
  if (level === "secure")  return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><ShieldAlert className="h-3 w-3 mr-1" />СИГУРЕН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Shield className="h-3 w-3 mr-1" />ОГРАНИЧЕН</Badge>;
}
