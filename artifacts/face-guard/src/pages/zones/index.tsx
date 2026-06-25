import { useListZones, useCreateZone, getListZonesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Map, Plus, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const zoneSchema = z.object({
  name: z.string().min(1, "Наименованието е задължително"),
  description: z.string().optional(),
  accessLevel: z.enum(["public", "restricted", "secure"]),
});

export default function ZoneList() {
  const { data: zones, isLoading } = useListZones();
  const createZone = useCreateZone();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof zoneSchema>>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: "",
      description: "",
      accessLevel: "restricted",
    },
  });

  function onSubmit(values: z.infer<typeof zoneSchema>) {
    createZone.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Зоната е създадена успешно" });
        queryClient.invalidateQueries({ queryKey: getListZonesQueryKey() });
        setOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({ title: "Грешка при създаване на зона", description: err.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Зони</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs uppercase tracking-wider">
              <Plus className="mr-2 h-4 w-4" /> Добави зона
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Създаване на нова зона</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Наименование на зоната</FormLabel>
                      <FormControl>
                        <Input placeholder="напр. Сървърна зала" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание (незадължително)</FormLabel>
                      <FormControl>
                        <Input placeholder="Кратко описание на помещението" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ниво на достъп</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Избери ниво" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="public">Публичен</SelectItem>
                          <SelectItem value="restricted">Ограничен</SelectItem>
                          <SelectItem value="secure">Сигурен</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createZone.isPending}>
                  {createZone.isPending ? "Създаване..." : "Създай зона"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Ниво на достъп</TableHead>
              <TableHead className="text-right">Камери</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
              </TableRow>
            ) : zones && zones.length > 0 ? (
              zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Map className="h-4 w-4 text-muted-foreground" />
                    {zone.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{zone.description || "-"}</TableCell>
                  <TableCell>
                    <AccessLevelBadge level={zone.accessLevel} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {zone.cameraCount || 0}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Няма конфигурирани зони.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AccessLevelBadge({ level }: { level: string }) {
  if (level === 'public') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><ShieldCheck className="h-3 w-3 mr-1"/> ПУБЛИЧЕН</Badge>;
  if (level === 'secure') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><ShieldAlert className="h-3 w-3 mr-1"/> СИГУРЕН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Shield className="h-3 w-3 mr-1"/> ОГРАНИЧЕН</Badge>;
}
