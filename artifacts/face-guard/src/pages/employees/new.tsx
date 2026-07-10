import { useCreateEmployee, useUploadEmployeePhoto, useListDepartments } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef } from "react";

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
  const { data: departments = [] } = useListDepartments();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

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
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhotoPreview(result);
      const base64 = result.split(',')[1];
      setPhotoBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(values: z.infer<typeof employeeSchema>) {
    try {
      const emp = await createEmployee.mutateAsync({ data: values });

      if (photoBase64) {
        await uploadPhoto.mutateAsync({
          id: emp.id,
          data: { photoBase64 }
        });
      }

      toast({ title: "Служителят е регистриран успешно" });
      setLocation("/employees");
    } catch (err: any) {
      toast({ title: "Грешка", description: err.message, variant: "destructive" });
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Лицево разпознаване</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <div
                    className="w-48 h-48 rounded-lg border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Преглед" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <User className="h-12 w-12 text-muted-foreground mb-2" />
                        <span className="text-xs font-mono text-muted-foreground">Натисни за качване</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Избери снимка
                  </Button>
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Необходима е ясна, добре осветена фронтална снимка на лицето за точно разпознаване.
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
                <Button type="submit" disabled={createEmployee.isPending || uploadPhoto.isPending}>
                  {createEmployee.isPending || uploadPhoto.isPending ? "Запазване..." : "Регистрирай служителя"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
