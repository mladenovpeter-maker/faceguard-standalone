import { useListCameras, useUpdateCamera, useDeleteCamera, useTestCameraConnection, getListCamerasQueryKey, useListZones } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Video, Network, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const cameraSchema = z.object({
  name: z.string().min(1, "Задължително"),
  brand: z.enum(["dahua", "hikvision", "unv", "other"]),
  protocol: z.enum(["rtsp", "http", "https"]),
  host: z.string().min(1, "Задължително"),
  port: z.coerce.number().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  streamPath: z.string().optional(),
  zoneId: z.coerce.number().min(1, "Задължително"),
});

type CameraFormValues = z.infer<typeof cameraSchema>;

type CameraRow = {
  id: number;
  name: string;
  brand: string;
  protocol: string;
  host: string;
  port?: number | null;
  username?: string | null;
  streamPath?: string | null;
  zoneId?: number | null;
  zoneName?: string | null;
  status: string;
};

function CameraEditForm({ camera, zones, onSubmit, isPending, onCancel }: {
  camera: CameraRow;
  zones: { id: number; name: string }[];
  onSubmit: (v: CameraFormValues) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const form = useForm<CameraFormValues>({
    resolver: zodResolver(cameraSchema),
    defaultValues: {
      name: camera.name,
      brand: camera.brand as any,
      protocol: camera.protocol as any,
      host: camera.host,
      port: camera.port ?? 554,
      username: camera.username ?? "admin",
      password: "",
      streamPath: camera.streamPath ?? "",
      zoneId: camera.zoneId ?? undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Наименование</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="brand" render={({ field }) => (
            <FormItem>
              <FormLabel>Марка</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="dahua">Dahua</SelectItem>
                  <SelectItem value="hikvision">Hikvision</SelectItem>
                  <SelectItem value="unv">UNV</SelectItem>
                  <SelectItem value="other">Друга/ONVIF</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="zoneId" render={({ field }) => (
            <FormItem>
              <FormLabel>Зона</FormLabel>
              <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                <FormControl><SelectTrigger><SelectValue placeholder="Избери зона" /></SelectTrigger></FormControl>
                <SelectContent>
                  {zones.map(z => <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="protocol" render={({ field }) => (
            <FormItem>
              <FormLabel>Протокол</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="rtsp">RTSP</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="host" render={({ field }) => (
            <FormItem><FormLabel>Адрес / IP</FormLabel><FormControl><Input className="font-mono" placeholder="192.168.1.100" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="port" render={({ field }) => (
            <FormItem><FormLabel>Порт</FormLabel><FormControl><Input type="number" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="streamPath" render={({ field }) => (
            <FormItem><FormLabel>Път на потока</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem><FormLabel>Потребителско име</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem><FormLabel>Парола (остави празно без промяна)</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Отказ</Button>
          <Button type="submit" disabled={isPending}>{isPending ? "Запазване..." : "Запази промените"}</Button>
        </div>
      </form>
    </Form>
  );
}

export default function CameraList() {
  const { data: cameras, isLoading } = useListCameras();
  const { data: zones } = useListZones();
  const updateCamera = useUpdateCamera();
  const deleteCamera = useDeleteCamera();
  const testCamera = useTestCameraConnection();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editCamera, setEditCamera] = useState<CameraRow | null>(null);
  const [snapshot, setSnapshot] = useState<{ cameraName: string; imageBase64: string } | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });

  function handleTest(id: number, cameraName: string) {
    testCamera.mutate({ id }, {
      onSuccess: (result) => {
        toast({
          title: result.success ? "Връзката е успешна" : "Няма връзка с камерата",
          description: result.message,
          variant: result.success ? "default" : "destructive",
        });
        if (result.success && result.snapshotBase64) {
          setSnapshot({ cameraName, imageBase64: result.snapshotBase64 });
        }
        invalidate();
      },
      onError: (err: any) => toast({ title: "Грешка при теста", description: err.message, variant: "destructive" }),
    });
  }

  function handleEdit(values: CameraFormValues) {
    if (!editCamera) return;
    updateCamera.mutate({ id: editCamera.id, data: values }, {
      onSuccess: () => { toast({ title: "Камерата е актуализирана" }); invalidate(); setEditCamera(null); },
      onError: (err: any) => toast({ title: "Грешка", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteCamera.mutate({ id }, {
      onSuccess: () => { toast({ title: "Камерата е изтрита" }); invalidate(); },
      onError: (err: any) => toast({ title: "Грешка при изтриване", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Камери</h1>
        {isAdmin && (
        <Link href="/cameras/new">
          <Button className="font-mono text-xs uppercase tracking-wider">
            <Plus className="mr-2 h-4 w-4" /> Добави камера
          </Button>
        </Link>
        )}
      </div>

      {/* Snapshot dialog */}
      <Dialog open={!!snapshot} onOpenChange={(o) => !o && setSnapshot(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Кадър от камера „{snapshot?.cameraName}"</DialogTitle></DialogHeader>
          {snapshot && (
            <img src={snapshot.imageBase64} alt={`Кадър от ${snapshot.cameraName}`} className="w-full rounded-md border border-border" />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {isAdmin && (
      <Dialog open={!!editCamera} onOpenChange={(o) => !o && setEditCamera(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Редактиране на камера</DialogTitle></DialogHeader>
          {editCamera && zones && (
            <CameraEditForm
              camera={editCamera}
              zones={zones}
              onSubmit={handleEdit}
              isPending={updateCamera.isPending}
              onCancel={() => setEditCamera(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead>Марка</TableHead>
              <TableHead>Адрес</TableHead>
              <TableHead>Зона</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ) : cameras && cameras.length > 0 ? (
              cameras.map(camera => (
                <TableRow key={camera.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                      {camera.name}
                    </div>
                  </TableCell>
                  <TableCell><BrandBadge brand={camera.brand} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {camera.protocol}://{camera.host}:{camera.port || 80}
                  </TableCell>
                  <TableCell>{camera.zoneName}</TableCell>
                  <TableCell><StatusBadge status={camera.status} /></TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline" size="sm" className="font-mono text-xs h-7 mr-1"
                        disabled={testCamera.isPending}
                        onClick={() => handleTest(camera.id, camera.name)}
                      >
                        <Network className="h-3 w-3 mr-1" /> {testCamera.isPending ? "..." : "ТЕСТ"}
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditCamera(camera as CameraRow)}
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
                            <AlertDialogTitle>Изтриване на камера</AlertDialogTitle>
                            <AlertDialogDescription>
                              Сигурни ли сте, че искате да изтриете камера <strong>„{camera.name}"</strong>? Това действие е необратимо.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отказ</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(camera.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Изтрий
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Няма конфигурирани камери.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BrandBadge({ brand }: { brand: string }) {
  const styles: Record<string, string> = {
    dahua: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    hikvision: "bg-red-500/10 text-red-500 border-red-500/20",
    unv: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    other: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={styles[brand] || styles.other}>{brand.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'online') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">ОНЛАЙН</Badge>;
  if (status === 'offline') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">ОФЛАЙН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">НЕИЗВЕСТЕН</Badge>;
}
