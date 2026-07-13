import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Eye, EyeOff, LogIn, User, Lock } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1, "Въведете потребителско име"),
  password: z.string().min(1, "Въведете парола"),
});
type Fields = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm<Fields>({ resolver: zodResolver(schema) });

  async function onSubmit(v: Fields) {
    setPending(true);
    setError(null);
    try {
      await login(v.username, v.password);
    } catch (e: any) {
      setError(e.message ?? "Грешка при вход");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-10 gap-5">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-black/5">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">FaceGuard</h1>
            <p className="text-xs font-bold text-primary uppercase tracking-[0.2em]">
              Система за контрол на достъп
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground">Вход в системата</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Въведете вашите идентификационни данни за сигурен достъп.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Username */}
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <label className="text-sm font-semibold text-foreground/80" htmlFor="username">
                    Потребителско име
                  </label>
                  <FormControl>
                    <div className="relative mt-1.5">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                      </div>
                      <input
                        id="username"
                        type="text"
                        placeholder="Въведете потребителско име"
                        autoComplete="username"
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-card transition-all duration-200"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Password */}
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <label className="text-sm font-semibold text-foreground/80" htmlFor="password">
                    Парола
                  </label>
                  <FormControl>
                    <div className="relative mt-1.5">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                      </div>
                      <input
                        id="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-card transition-all duration-200"
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                        onClick={() => setShowPass((s) => !s)}
                        tabIndex={-1}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Error */}
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2.5">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-md shadow-primary/10 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
              >
                <LogIn className="h-4 w-4" strokeWidth={2} />
                {pending ? "Проверка на данни..." : "Вход"}
              </button>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground font-medium tracking-wide">
          <p>© {new Date().getFullYear()} FaceGuard Enterprise Security</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>Системата е онлайн</span>
          </div>
        </div>
      </div>
    </div>
  );
}
