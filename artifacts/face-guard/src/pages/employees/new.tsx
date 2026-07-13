import { useCreateEmployee, useUploadEmployeePhoto, useAddEmployeePhoto, useListDepartments, useListCameras, useTestCameraConnection } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Plus, X, ScanFace, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef } from "react";

const MAX_PHOTOS = 5;

const employeeSchema = z.object({
  firstName: z.string().min(1, "Задължително"),
  lastName: z.string().min(1, "Задължително"),
  employeeNumber: z.string().min(1, "Задължително"),
  departmentId: z.coerce.number().min(1, "Изберете отдел"),
  position: z.string().min(1, "Задължително"),
  email: z.string().email("Невалиден имейл").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
});

export default function EmployeeNew() {
  const [, setLocation] = useLocation();
  const createEmployee = useCreateEmployee();
  const uploadPhoto = useUploadEmployeePhoto();
  const addPhoto = useAddEmployeePhoto();
  const { data: departments = [] } = useListDepartments();
  const { data: cameras = [] } = useListCameras();
  const testCamera = useTestCameraConnection();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturingId, setCapturingId] = useState<number | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeNumber: "",
      position: "",
      email: "",
      phone: "",
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(',')[1];
      setPhotos((prev) => [...prev, base64]);
    };
    reader.readAsDataURL(file);
  };

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

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
    const base64 = capturePreview.split(',')[1];
    setPhotos((prev) => [...prev, base64]);
    setCaptureOpen(false);
    setCapturePreview(null);
  }

  async function onSubmit(values: z.infer<typeof employeeSchema>) {
    setSubmitting(true);
    try {
      const emp = await createEmployee.mutateAsync({ data: values });

      if (photos.length > 0) {
        await uploadPhoto.mutateAsync({
          id: emp.id,
          data: { photoBase64: photos[0] }
        });
        for (const photoBase64 of photos) {
          await addPhoto.mutateAsync({ id: emp.id, data: { photoBase64 } });
        }
      }

      toast({ title: "Служителят е регистриран успешно" });
      setLocation("/employees");
    } catch (err: any) {
      toast({ title: "Грешка", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Регистрация на служител</h1>
      </div>

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
                <Button onClick={handleUseCapturedPhoto}>Използвай снимката</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ScanFace className="h-4 w-4" /> Лицево разпознаване ({photos.length}/{MAX_PHOTOS})
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />
                  {photos.length === 0 ? (
                    <div
                      className="w-full h-40 rounded-lg border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-xs font-mono text-muted-foreground">Натисни за качване</span>
                    </div>
                  ) : (
                    <div className="w-full grid grid-cols-2 gap-3">
                      {photos.map((base64, index) => (
                        <div key={index} className="relative group">
                          <div className="h-24 w-full rounded-lg overflow-hidden border border-border bg-muted">
                            <img src={`data:image/jpeg;base64,${base64}`} alt="Преглед" className="h-full w-full object-cover" />
                          </div>
                          {index === 0 && (
                            <span className="absolute bottom-1 left-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/90 text-primary-foreground">
                              ОСНОВНА
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Премахни снимката"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 w-full">
                    {cameras.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => { setCapturePreview(null); setCaptureOpen(true); }}
                        disabled={photos.length >= MAX_PHOTOS}
                      >
                        <Camera className="h-4 w-4 mr-2" /> Снимай от камера
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photos.length >= MAX_PHOTOS}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Добави снимка
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Добавете 2–5 ясни, добре осветени снимки от различни ъгли за по-точно разпознаване.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-6">
              <Card className="border-border bg-card">
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <FormItem><FormLabel>Имейл (незадължително)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Телефон (незадължително)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/employees")}>Отказ</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Запазване..." : "Регистрирай служителя"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
