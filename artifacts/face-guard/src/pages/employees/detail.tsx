import { useGetEmployee, useUpdateEmployee, useDeleteEmployee, useListRecognitions, useListDepartments, getListEmployeesQueryKey, useListEmployeePhotos, useAddEmployeePhoto, useDeleteEmployeePhoto, getListEmployeePhotosQueryKey, useListCameras, useTestCameraConnection } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Building, Briefcase, Calendar, Pencil, Trash2, ScanFace, Plus, X, ShieldCheck, ShieldAlert, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const editSchema = z.object({
  firstName: z.string().min(1, "Задължително"),
  lastName: z.string().min(1, "Задължително"),
  employeeNumber: z.string().min(1, "Задължително"),
  departmentId: z.coerce.number().min(1, "Изберете отдел"),
  position: z.string().min(1, "Задължително"),
  email: z.string().email("Невалиден имейл").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export default function EmployeeDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const employeeId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: employee, isLoading: loadingEmp, refetch } = useGetEmployee(employeeId, { query: { enabled: !!employeeId } });
  const { data: recognitions, isLoading: loadingRec } = useListRecognitions({ employeeId, limit: 10 }, { query: { enabled: !!employeeId } });
  const { data: departments = [] } = useListDepartments();
  const { data: photos = [], isLoading: loadingPhotos } = useListEmployeePhotos(employeeId, { query: { enabled: !!employeeId } });
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const addPhoto = useAddEmployeePhoto();
  const deletePhoto = useDeleteEmployeePhoto();
  const testCamera = useTestCameraConnection();
  const { data: cameras = [] } = useListCameras();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 5;
  const [reprocessing, setReprocessing] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturingId, setCapturingId] = useState<number | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);

  function handleCaptureFromCamera(cameraId: number) {
    setCapturingId(cameraId);
    setCapturePreview(null);
    testCamera.mutate({ id: cameraId }, {
      onSuccess: (result) => {
        if (result.snapshotBase64) {
          setCapturePreview(result.snapshotBase64);
        } else {
          toast({ title: "Камерата не е достъпна", variant: "destructive" });
        }
      },
      onError: (err: any) => toast({ title: "Грешка при снимане", description: err.message, variant: "destructive" }),
      onSettled: () => setCapturingId(null),
    });
  }

  function handleUseCapturedPhoto() {
    if (!capturePreview) return;
    const photoBase64 = capturePreview.split(',')[1];
    addPhoto.mutate({ id: employeeId, data: { photoBase64 } }, {
      onSuccess: (photo) => {
        toast({
          title: "Снимката е добавена",
          description: photo.hasFaceDescriptor
            ? "Лицето е разпознато и запазено."
            : "Не бе открито лице — снимката е запазена без AI профил.",
        });
        queryClient.invalidateQueries({ queryKey: getListEmployeePhotosQueryKey(employeeId) });
        setCaptureOpen(false);
        setCapturePreview(null);
      },
      onError: (err: any) => toast({ title: "Грешка при запазване", description: err.message, variant: "destructive" }),
    });
  }

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/employees/${employeeId}/photos/reprocess`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const found = data.found ?? 0;
      const total = data.total ?? 0;
      toast({
        title: found > 0 ? `Лице открито в ${found} от ${total} снимки` : `Не е открито лице`,
        description: found > 0
          ? `Разпознаването е активирано за ${found} снимки.`
          : `SSD моделът не засече лице. Опитайте с нови снимки при добра светлина.`,
        variant: found > 0 ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: getListEmployeePhotosQueryKey(employeeId) });
    } catch (e: any) {
      toast({ title: "Грешка при преобработка", description: e.message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  }

  function handleAddPhotoClick() {
    photoInputRef.current?.click();
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    const canAdd = MAX_PHOTOS - photos.length;
    const toUpload = files.slice(0, canAdd);
    if (toUpload.length === 0) {
      toast({ title: "Максимумът е достигнат", description: `Може да добавите най-много ${MAX_PHOTOS} снимки.`, variant: "destructive" });
      return;
    }
    if (files.length > canAdd) {
      toast({ title: `Качват се само ${toUpload.length} снимки`, description: `Достигнат е лимитът от ${MAX_PHOTOS}.` });
    }

    let added = 0;
    let withFace = 0;
    for (const file of toUpload) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const photoBase64 = (ev.target?.result as string).split(',')[1];
          addPhoto.mutate({ id: employeeId, data: { photoBase64 } }, {
            onSuccess: (photo) => { added++; if (photo.hasFaceDescriptor) withFace++; resolve(); },
            onError: () => resolve(),
          });
        };
        reader.readAsDataURL(file);
      });
    }

    queryClient.invalidateQueries({ queryKey: getListEmployeePhotosQueryKey(employeeId) });
    toast({
      title: `${added} снимки добавени`,
      description: `${withFace} с открито лице, ${added - withFace} без.`,
    });
  }

  function handleDeletePhoto(photoId: number) {
    deletePhoto.mutate({ id: employeeId, photoId }, {
      onSuccess: () => {
        toast({ title: "Снимката е изтрита" });
        queryClient.invalidateQueries({ queryKey: getListEmployeePhotosQueryKey(employeeId) });
      },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message, variant: "destructive" }),
    });
  }

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: employee ? {
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNumber: employee.employeeNumber,
      departmentId: employee.departmentId ?? undefined,
      position: employee.position ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
    } : undefined,
  });

  function handleEdit(values: z.infer<typeof editSchema>) {
    updateEmployee.mutate({ id: employeeId, data: values }, {
      onSuccess: () => {
        toast({ title: "Данните са актуализирани" });
        refetch();
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setEditOpen(false);
      },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete() {
    deleteEmployee.mutate({ id: employeeId }, {
      onSuccess: () => {
        toast({ title: "Служителят е изтрит" });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setLocation("/employees");
      },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message, variant: "destructive" }),
    });
  }

  if (loadingEmp) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!employee) return <div className="p-8 text-center">Служителят не е намерен</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Профил на служител</h1>
        <Badge variant="outline" className={employee.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground'}>
          {employee.status === 'active' ? 'АКТИВЕН' : 'НЕАКТИВЕН'}
        </Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Редактирай
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Изтрий
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Изтриване на служител</AlertDialogTitle>
                <AlertDialogDescription>
                  Сигурни ли сте, че искате да изтриете <strong>{employee.firstName} {employee.lastName}</strong>? Всички свързани данни (разпознавания, присъствие, права за достъп) ще бъдат изтрити. Това действие е необратимо.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отказ</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Изтрий
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
              <FormField control={form.control} name="departmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Отдел</FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Изберете отдел" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="position" render={({ field }) => (
                <FormItem><FormLabel>Длъжност</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Имейл</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Телефон</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Отказ</Button>
                <Button type="submit" disabled={updateEmployee.isPending}>
                  {updateEmployee.isPending ? "Запазване..." : "Запази промените"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-border bg-card">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="h-32 w-32 rounded-full border-4 border-muted overflow-hidden bg-muted mb-4 flex items-center justify-center">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="Профилна снимка" className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <h2 className="text-xl font-bold">{employee.firstName} {employee.lastName}</h2>
            <p className="font-mono text-sm text-muted-foreground mt-1 mb-4">{employee.employeeNumber}</p>

            <div className="w-full space-y-3 text-sm text-left">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{employee.departmentName ?? "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{employee.position}</span>
              </div>
              {employee.email && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="text-foreground break-all">{employee.email}</span>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="text-foreground">{employee.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="text-foreground">Постъпил на {new Date(employee.createdAt).toLocaleDateString('bg-BG')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ScanFace className="h-4 w-4" /> Снимки за разпознаване ({photos.length}/{MAX_PHOTOS})
              </CardTitle>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoFileChange}
              />
              <div className="flex gap-2 flex-wrap">
                {photos.some(p => !p.hasFaceDescriptor) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReprocess}
                    disabled={reprocessing}
                    className="text-amber-500 border-amber-500/40 hover:bg-amber-500/10"
                  >
                    <ScanFace className="h-4 w-4 mr-2" />
                    {reprocessing ? "Обработва..." : "Преобработи"}
                  </Button>
                )}
                {cameras.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCapturePreview(null); setCaptureOpen(true); }}
                    disabled={photos.length >= MAX_PHOTOS}
                  >
                    <Camera className="h-4 w-4 mr-2" /> Снимай от камера
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddPhotoClick}
                  disabled={photos.length >= MAX_PHOTOS || addPhoto.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {addPhoto.isPending ? "Качване..." : "Добави снимка"}
                </Button>
              </div>
            </CardHeader>

            {/* Camera capture dialog */}
            <Dialog open={captureOpen} onOpenChange={(o) => { if (!o) { setCaptureOpen(false); setCapturePreview(null); } }}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Снимай от камера</DialogTitle>
                </DialogHeader>
                {!capturePreview ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Избери камера за заснемане на служителя:</p>
                    <div className="grid gap-2">
                      {cameras.map(cam => (
                        <Button
                          key={cam.id}
                          variant="outline"
                          className="justify-start"
                          disabled={capturingId === cam.id}
                          onClick={() => handleCaptureFromCamera(cam.id)}
                        >
                          <Camera className="h-4 w-4 mr-2 text-muted-foreground" />
                          {cam.name}
                          <span className="ml-auto font-mono text-xs text-muted-foreground">{cam.host}</span>
                          {capturingId === cam.id && <span className="ml-2 text-xs">Снима...</span>}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img src={capturePreview} alt="Снимка от камера" className="w-full object-contain max-h-72" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setCapturePreview(null)}>Снимай отново</Button>
                      <Button onClick={handleUseCapturedPhoto} disabled={addPhoto.isPending}>
                        {addPhoto.isPending ? "Запазване..." : "Използвай снимката"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Добавете 2–5 снимки от различни ъгли, за да подобрите точността на разпознаване. Тези снимки се използват само като резервен вариант, когато камерата не успее да разпознае лицето.
              </p>
              {loadingPhotos ? (
                <div className="flex gap-3"><Skeleton className="h-24 w-24 rounded-lg" /><Skeleton className="h-24 w-24 rounded-lg" /></div>
              ) : photos.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  Няма добавени снимки за AI разпознаване
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <div className="h-24 w-24 rounded-lg overflow-hidden border border-border bg-muted">
                        <img src={photo.photoUrl} alt="Снимка за разпознаване" className="h-full w-full object-cover" />
                      </div>
                      <div
                        className={`absolute bottom-1 left-1 rounded-full p-0.5 ${photo.hasFaceDescriptor ? 'bg-green-500/90' : 'bg-amber-500/90'}`}
                        title={photo.hasFaceDescriptor ? "Лицето е разпознато" : "Не бе открито лице"}
                      >
                        {photo.hasFaceDescriptor ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5 text-white" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Изтрий снимката"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Последни събития за достъп</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Час</TableHead>
                    <TableHead>Местоположение</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Точност</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRec ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : recognitions && recognitions.length > 0 ? (
                    recognitions.map(rec => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-xs">{new Date(rec.detectedAt).toLocaleString('bg-BG')}</TableCell>
                        <TableCell>{rec.cameraName} / {rec.zoneName}</TableCell>
                        <TableCell>
                          {rec.status === 'recognized' ?
                            <span className="text-green-500 text-xs font-medium">РАЗРЕШЕН</span> :
                            <span className="text-red-500 text-xs font-medium">ОТКАЗАН</span>
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{(rec.confidence * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Няма скорошни събития</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
