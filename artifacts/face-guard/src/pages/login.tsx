import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, Eye, EyeOff, LogIn, User, Lock, Camera, Fingerprint } from "lucide-react";
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
    <div className="min-h-screen flex">

      {/* Left — Brand panel */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0a0f1e 0%, #0d1a2e 40%, #0a1628 70%, #071020 100%)" }}
      >
        {/* Dot-grid background pattern */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #67e8f9 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Glowing orb top-right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)" }}
        />
        {/* Glowing orb bottom-left */}
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-cyan-400" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">FaceGuard</span>
          </div>

          {/* Main tagline */}
          <div className="mt-auto">
            <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-3 py-1 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-mono text-cyan-400 tracking-widest uppercase">Система активна</span>
            </div>

            <h2 className="font-display font-black text-white leading-none tracking-tight mb-4"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
            >
              Разпознаване<br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg, #22d3ee, #60a5fa)" }}
              >
                на лица
              </span>
              <br />в реално време
            </h2>

            <p className="text-slate-400 text-[15px] leading-relaxed max-w-sm">
              Контрол на достъп, присъствие и работно
              време — всичко на едно място.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-10">
            {[
              { icon: Camera, label: "IP камери" },
              { icon: Fingerprint, label: "Биометрия" },
              { icon: ShieldCheck, label: "Зонален достъп" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-slate-600 text-xs font-mono mt-8">
            © {new Date().getFullYear()} FaceGuard Enterprise
          </p>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-background">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl text-foreground tracking-tight">FaceGuard</span>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
              Добре дошли
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Влезте с вашите идентификационни данни.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Username */}
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <label className="text-[13px] font-semibold text-foreground/75 block mb-1.5" htmlFor="username">
                    Потребителско име
                  </label>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-muted-foreground/60" strokeWidth={2} />
                      </div>
                      <input
                        id="username"
                        type="text"
                        placeholder="потребителско_име"
                        autoComplete="username"
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all duration-200 shadow-sm"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-1" />
                </FormItem>
              )} />

              {/* Password */}
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <label className="text-[13px] font-semibold text-foreground/75 block mb-1.5" htmlFor="password">
                    Парола
                  </label>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-muted-foreground/60" strokeWidth={2} />
                      </div>
                      <input
                        id="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all duration-200 shadow-sm"
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground/60 hover:text-foreground transition-colors focus:outline-none"
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

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm px-3.5 py-2.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={pending}
                className="w-full mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-px active:translate-y-0"
                style={{ background: "linear-gradient(135deg, hsl(192 80% 38%), hsl(210 80% 45%))", color: "white" }}
              >
                <LogIn className="h-4 w-4" strokeWidth={2} />
                {pending ? "Проверка..." : "Влез в системата"}
              </button>
            </form>
          </Form>

          {/* Mobile footer */}
          <div className="lg:hidden mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>Системата е онлайн</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
