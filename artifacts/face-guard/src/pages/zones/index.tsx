import {
  useListZones, useCreateZone, useUpdateZone, useDeleteZone, getListZonesQueryKey,
  useListZoneSchedules, useUpsertZoneSchedule, useDeleteZoneSchedule, getListZoneSchedulesQueryKey,
} from "@workspace/api-client-react";
import type { ScheduleBreak } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Plus, Shield, ShieldAlert, ShieldCheck, Pencil, Trash2, Clock, X } from "lucide-react";
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
import { useState, useEffect } from "react";
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

  const invalidate = () => qc.invalidateQueries({ queryKey: getListZoneSchedulesQueryKey({ zoneId }) });

  const [localBreaks, setLocalBreaks] = useState<Map<number, ScheduleBreak[]>>(new Map());

  useEffect(() => {
    setLocalBreaks(prev => {
      const next = new Map(prev);
      for (const s of schedules) {
        if (!next.has(s.dayOfWeek)) next.set(s.dayOfWeek, s.breaks ?? []);
      }
      return next;
    });
  }, [schedules]);

  const byDay = new Map(schedules.map(s => [s.dayOfWeek, s]));

  async function toggleDay(dayOfWeek: number, isWorking: boolean) {
    if (isWorking) {
      const slot = byDay.get(dayOfWeek);
      if (slot) {
        setLocalBreaks(prev => { const m = new Map(prev); m.delete(dayOfWeek); return m; });
        await del.mutateAsync({ id: slot.id }, { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) });
      }
    } else {
      setLocalBreaks(prev => { const m = new Map(prev); m.set(dayOfWeek, []); return m; });
      await upsert.mutateAsync(
        { data: { zoneId, dayOfWeek, startTime: "08:00", endTime: "17:00", breaks: [] } },
        { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) },
      );
    }
  }

  async function updateTime(dayOfWeek: number, field: "startTime" | "endTime", value: string) {
    const slot = byDay.get(dayOfWeek);
    if (!slot) return;
    const startTime = field === "startTime" ? value : slot.startTime;
    const endTime   = field === "endTime"   ? value : slot.endTime;
    const breaks    = localBreaks.get(dayOfWeek) ?? slot.breaks ?? [];
    await upsert.mutateAsync(
      { data: { zoneId, dayOfWeek, startTime, endTime, breaks } },
      { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) },
    );
  }

  async function saveBreaks(dayOfWeek: number, breaks: ScheduleBreak[]) {
    const slot = byDay.get(dayOfWeek);
    if (!slot) return;
    setLocalBreaks(prev => { const m = new Map(prev); m.set(dayOfWeek, breaks); return m; });
    await upsert.mutateAsync(
      { data: { zoneId, dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, breaks } },
      { onSuccess: invalidate, onError: () => toast({ title: "Грешка", variant: "destructive" }) },
    );
  }

  function addBreak(dayOfWeek: number) {
    const current = localBreaks.get(dayOfWeek) ?? [];
    const next = [...current, { name: "Технологична почивка", startTime: "10:00", endTime: "10:15" }];
    saveBreaks(dayOfWeek, next);
  }

  function removeBreak(dayOfWeek: number, index: number) {
    const current = localBreaks.get(dayOfWeek) ?? [];
    saveBreaks(dayOfWeek, current.filter((_, i) => i !== index));
  }

  function updateBreakField(dayOfWeek: number, index: number, field: keyof ScheduleBreak, value: string) {
    setLocalBreaks(prev => {
      const m = new Map(prev);
      const arr = [...(m.get(dayOfWeek) ?? [])];
      arr[index] = { ...arr[index], [field]: value };
      m.set(dayOfWeek, arr);
      return m;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Работно Време">
          <Clock className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Работно Време — {zoneName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <div className="divide-y divide-border">
            {DAYS.map(d => {
              const slot = byDay.get(d.iso);
              const isWorking = !!slot;
              const breaks = localBreaks.get(d.iso) ?? slot?.breaks ?? [];

              return (
                <div key={d.iso} className="py-2.5 space-y-1.5">
                  {/* Day row */}
                  <div className={`flex items-center gap-3 ${isWorking ? "" : "opacity-40"}`}>
                    <input
                      type="checkbox"
                      checked={isWorking}
                      onChange={() => toggleDay(d.iso, isWorking)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                    />
                    <span className={`text-sm w-28 shrink-0 ${isWorking ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {d.label}
                    </span>
                    {isWorking && slot ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <Input
                          type="time"
                          defaultValue={slot.startTime}
                          key={`${d.iso}-start-${slot.startTime}`}
                          className="h-7 w-24 text-xs font-mono px-2"
                          onBlur={e => updateTime(d.iso, "startTime", e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">—</span>
                        <Input
                          type="time"
                          defaultValue={slot.endTime}
                          key={`${d.iso}-end-${slot.endTime}`}
                          className="h-7 w-24 text-xs font-mono px-2"
                          onBlur={e => updateTime(d.iso, "endTime", e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-xs text-muted-foreground italic">почивен</span>
                    )}
                  </div>

                  {/* Breaks sub-section */}
                  {isWorking && (
                    <div className="ml-7 space-y-1">
                      {breaks.map((brk, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Input
                            defaultValue={brk.name}
                            key={`${d.iso}-brk-name-${i}-${brk.name}`}
                            placeholder="Вид почивка"
                            className="h-6 text-xs px-2 flex-1 min-w-0"
                            onChange={e => updateBreakField(d.iso, i, "name", e.target.value)}
                            onBlur={() => saveBreaks(d.iso, breaks)}
                          />
                          <Input
                            type="time"
                            defaultValue={brk.startTime}
                            key={`${d.iso}-brk-s-${i}`}
                            className="h-6 w-20 text-xs font-mono px-1.5 shrink-0"
                            onChange={e => updateBreakField(d.iso, i, "startTime", e.target.value)}
                            onBlur={() => saveBreaks(d.iso, breaks)}
                          />
                          <span className="text-xs text-muted-foreground">—</span>
                          <Input
                            type="time"
                            defaultValue={brk.endTime}
                            key={`${d.iso}-brk-e-${i}`}
                            className="h-6 w-20 text-xs font-mono px-1.5 shrink-0"
                            onChange={e => updateBreakField(d.iso, i, "endTime", e.target.value)}
                            onBlur={() => saveBreaks(d.iso, breaks)}
                          />
                          <button
                            type="button"
                            onClick={() => removeBreak(d.iso, i)}
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBreak(d.iso)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        Добави почивка
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                      <MapIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      {zone.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{zone.description || "—"}</TableCell>
                  <TableCell><AccessLevelBadge level={zone.accessLevel} /></TableCell>
                  <TableCell className="text-center font-mono text-muted-foreground">{zone.cameraCount || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <WorkScheduleDialog zoneId={zone.id} zoneName={zone.name} />

                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditZone({ id: zone.id, name: zone.name, description: zone.description, accessLevel: zone.accessLevel })}
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

function AccessLevelBadge({ level }: { level: string }) {
  if (level === "public")  return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><ShieldCheck className="h-3 w-3 mr-1" />ПУБЛИЧЕН</Badge>;
  if (level === "secure")  return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><ShieldAlert className="h-3 w-3 mr-1" />СИГУРЕН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Shield className="h-3 w-3 mr-1" />ОГРАНИЧЕН</Badge>;
}
