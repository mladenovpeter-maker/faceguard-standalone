import { Link, useLocation } from "wouter";
import { Activity, Camera, Users, ShieldCheck, Map, Clock, Video, MonitorPlay, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  const navItems = [
    { href: "/", label: "Табло", icon: Activity },
    { href: "/recognitions", label: "Лог на събития", icon: MonitorPlay },
    { href: "/employees", label: "Персонал", icon: Users },
    { href: "/attendance", label: "Присъствие", icon: Clock },
    { href: "/leaves", label: "Отпуски", icon: CalendarOff },
    { href: "/access-rules", label: "Контрол на достъп", icon: ShieldCheck },
    { href: "/cameras", label: "Камери", icon: Video },
    { href: "/zones", label: "Зони", icon: Map },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-border gap-3">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-base tracking-tight leading-tight">FaceGuard</h1>
            <p className="text-[10px] font-mono text-muted-foreground leading-tight tracking-wide uppercase">Контрол на достъп · Работно Време</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Основни модули
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}>
                  <Icon className="h-4 w-4 mr-3" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">СТАТУС НА СИСТЕМАТА</span>
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", health?.status === "ok" ? "bg-green-500" : "bg-red-500")} />
              <span className="font-mono font-medium">{health?.status === "ok" ? "ОНЛАЙН" : "ОФЛАЙН"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-8 shrink-0 justify-between">
          <h2 className="text-lg font-medium text-foreground capitalize tracking-wide">
            {navItems.find(i => location === i.href || (i.href !== "/" && location.startsWith(i.href)))?.label || "Преглед"}
          </h2>
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <span>{new Date().toISOString().split('T')[0]}</span>
            <span>СИС_АДМИНИСТРАТОР</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
