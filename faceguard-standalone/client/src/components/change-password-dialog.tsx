import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1, "Въведете текущата парола"),
  newPassword: z.string().min(6, "Поне 6 символа"),
  confirmPassword: z.string().min(1, "Потвърдете новата парола"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Паролите не съвпадат",
  path: ["confirmPassword"],
});
type Fields = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const { changePassword } = useAuth();
  const { toast } = useToast();
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const form = useForm<Fields>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Fields) {
    try {
      await changePassword(v.currentPassword, v.newPassword);
      toast({ title: "Паролата е сменена успешно" });
      form.reset();
      onOpenChange(false);
    } catch (e: any) {
      form.setError("currentPassword", { message: e.message ?? "Грешка" });
    }
  }

  function PasswordInput({ show, onToggle, ...props }: any) {
    return (
      <div className="relative">
        <Input type={show ? "text" : "password"} className="pr-10" {...props} />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onToggle}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { form.reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Смяна на парола
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="currentPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Текуща парола</FormLabel>
                <FormControl>
                  <PasswordInput show={showCur} onToggle={() => setShowCur((s) => !s)} placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="newPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Нова парола</FormLabel>
                <FormControl>
                  <PasswordInput show={showNew} onToggle={() => setShowNew((s) => !s)} placeholder="Мин. 6 символа" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Потвърди новата парола</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Отказ
              </Button>
              <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Запазване..." : "Смени парола"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
