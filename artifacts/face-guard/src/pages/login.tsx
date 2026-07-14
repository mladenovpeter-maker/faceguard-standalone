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
    <div className="min-h-screen bg-background flex">

      {/* Left — colorful brand panel */}
      <div
        className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)" }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Soft highlight blob top */}
        <div
          className="absolute -top-40 -left-20 w-[500px] h-[500px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 65%)" }}
        />
        {/* Soft blob bottom-right */}
        <div
          className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 65%)" }}
        />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Top logo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-white text-[17px] tracking-tight">FaceGuard</span>
          </div>

          {/* Main content — pushed to middle */}
          <div className="mt-auto mb-auto pt-20">
            <p className="text-indigo-200 text-sm font-mono tracking-widest uppercase mb-5">
              Система за контрол на достъп
            </p>
            <h2
              className="font-display font-black text-white leading-tight tracking-tight mb-6"
              style={{ fontSize: "clamp(2rem, 3.5vw, 2.75rem)" }}
            >
              Разпознаване<br />
              на лица —<br />
              в реално време
            </h2>
            <p className="text-indigo-200/80 text-[15px] leading-relaxed max-w-xs">
              Присъствие, контрол на достъп и работно
              време — всичко автоматично.
            </p>
          </div>

          {/* Bottom stats row */}
          <div className="flex gap-6 mt-auto">
            {[
              { value: "IP камери", label: "поддържа" },
              { value: "Форма 76", label: "автоматично" },
              { value: "Реално", label: "присъствие" },
            ].map(({ value, label }) => (
              <div key={value}>
                <p className="text-white font-display font-bold text-[15px]">{value}</p>
                <p className="text-indigo-300 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — clean form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/25">
              <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-xl text-foreground">FaceGuard</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display font-bold text-[1.6rem] text-foreground tracking-tight leading-tight">
              Добре дошли
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Влезте с вашите данни за достъп.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <label className="text-[13px] font-semibold text-foreground/70 block mb-1.5" htmlFor="username">
                    Потребителско ime
                  </label>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                      </div>
                      <input
                        id="username"
                        type="text"
                        placeholder="потребителско_ime"
                        autoComplete="username"
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <label className="text-[13px] font-semibold text-foreground/70 block mb-1.5" htmlFor="password">
                    Парола
                  </label>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                      </div>
                      <input
                        id="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
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
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )} />

              {error && (
                <div className="rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full mt-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-2.5 px-4 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-px active:translate-y-0"
              >
                <LogIn className="h-4 w-4" strokeWidth={2} />
                {pending ? "Проверка..." : "Влез в системата"}
              </button>
            </form>
          </Form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span>Системата е онлайн · © {new Date().getFullYear()} FaceGuard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
