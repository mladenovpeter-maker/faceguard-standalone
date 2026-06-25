import { useCreateCamera, getListCamerasQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { useListZones } from "@workspace/api-client-react";

const cameraSchema = z.object({
  name: z.string().min(1, "Required"),
  brand: z.enum(["dahua", "hikvision", "unv", "other"]),
  protocol: z.enum(["rtsp", "http", "https"]),
  host: z.string().min(1, "Required"),
  port: z.coerce.number().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  streamPath: z.string().optional(),
  zoneId: z.coerce.number().min(1, "Required"),
});

export default function CameraNew() {
  const [, setLocation] = useLocation();
  const createCamera = useCreateCamera();
  const { data: zones } = useListZones();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof cameraSchema>>({
    resolver: zodResolver(cameraSchema),
    defaultValues: {
      name: "",
      brand: "dahua",
      protocol: "rtsp",
      host: "",
      port: 554,
      username: "admin",
      password: "",
      streamPath: "/cam/realmonitor?channel=1&subtype=0",
    },
  });

  async function onSubmit(values: z.infer<typeof cameraSchema>) {
    try {
      await createCamera.mutateAsync({ data: values });
      toast({ title: "Camera added successfully" });
      queryClient.invalidateQueries({ queryKey: getListCamerasQueryKey() });
      setLocation("/cameras");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/cameras")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add Camera</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border bg-card">
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Camera Name</FormLabel><FormControl><Input placeholder="e.g. Front Door" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="dahua">Dahua</SelectItem>
                      <SelectItem value="hikvision">Hikvision</SelectItem>
                      <SelectItem value="unv">UNV</SelectItem>
                      <SelectItem value="other">Other/ONVIF</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="zoneId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Zone</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {zones?.map(z => <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="sm:col-span-2 border-t border-border my-2 pt-4"><h3 className="text-sm font-medium text-muted-foreground">Connection Details</h3></div>

              <FormField control={form.control} name="protocol" render={({ field }) => (
                <FormItem>
                  <FormLabel>Protocol</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormItem><FormLabel>Host / IP Address</FormLabel><FormControl><Input className="font-mono" placeholder="192.168.1.100" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="port" render={({ field }) => (
                <FormItem><FormLabel>Port</FormLabel><FormControl><Input type="number" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="streamPath" render={({ field }) => (
                <FormItem><FormLabel>Stream Path</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/cameras")}>Cancel</Button>
            <Button type="submit" disabled={createCamera.isPending}>
              {createCamera.isPending ? "Saving..." : "Add Camera"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
