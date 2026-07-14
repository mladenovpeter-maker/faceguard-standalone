import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, Users, ShieldCheck, Map, Clock, Video, MonitorPlay,
  CalendarOff, LogOut, KeyRound, ChevronDown, UserCircle, Database,
  Building2, TableProperties, BadgeCheck, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}мин`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}ч ${m}мин`;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const { user, logout } = useAuth();
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Табло", icon: Activity },
    { href: "/recognitions", label: "Лог на събития", icon: MonitorPlay },
    { href: "/employees", label: "Персонал", icon: Users },
    { href: "/departments", label: "Отдели", icon: Building2 },
    { href: "/attendance", label: "Присъствие", icon: Clock },
    { href: "/form76", label: "Форма 76", icon: TableProperties },
    { href: "/department-schedules", label: "Работно време", icon: Clock },
    { href: "/leaves", label: "Отпуски", icon: CalendarOff },
    { href: "/visitors", label: "Посетители", icon: BadgeCheck },
    { href: "/access-rules", label: "Контрол на достъп", icon: ShieldCheck },
    { href: "/cameras", label: "Камери", icon: Video },
    { href: "/zones", label: "Зони", icon: Map },
  ];

  const roleLabel = user?.role === "admin" ? "АДМИНИСТРАТОР" : "ОПЕРАТОР";
  const currentPage = navItems.find(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border gap-3 shrink-0">
        <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="font-bold text-base tracking-tight leading-tight">FaceGuard</h1>
          <p className="text-[10px] font-mono text-muted-foreground leading-tight tracking-wide uppercase">
            Контрол на достъп · Работно Време
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 px-3">
          Основни модули
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-md cursor-pointer transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                onClick={onNavigate}
              >
                <Icon className="h-4 w-4 mr-3 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="p-4 border-t border-border bg-card/50 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono">СТАТУС НА СИСТЕМАТА</span>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "h-2 w-2 rounded-full",
              !health ? "bg-gray-400 animate-pulse" :
              health.status === "ok" ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            <span className={cn(
              "font-mono font-semibold text-xs",
              !health ? "text-muted-foreground" :
              health.status === "ok" ? "text-green-500" : "text-red-500"
            )}>
              {!health ? "ЗАРЕЖДАНЕ" : health.status === "ok" ? "ОНЛАЙН" : "ПРОБЛЕМ"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            <span>БД</span>
          </div>
          <span className={cn("font-medium", health?.db === "ok" ? "text-green-500" : "text-red-400")}>
            {!health ? "—" : health.db === "ok" ? "ОК" : "ГРЕШКА"}
          </span>
        </div>
        {health?.uptimeSeconds !== undefined && (
          <div className="text-xs text-muted-foreground font-mono text-right">
            uptime {formatUptime(health.uptimeSeconds)}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col z-20 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 flex flex-col">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-14 md:h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-3 md:px-8 shrink-0 justify-between gap-2">
          {/* Mobile: hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Меню"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <h2 className="text-sm md:text-lg font-medium text-foreground capitalize tracking-wide truncate">
            {currentPage?.label ?? "Преглед"}
          </h2>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <span className="text-sm font-mono text-muted-foreground hidden lg:block">
              {new Date().toISOString().split("T")[0]}
            </span>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 md:gap-2 text-sm font-mono rounded-md px-1.5 md:px-2 py-1.5 hover:bg-secondary transition-colors text-foreground">
                  <UserCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium hidden sm:block">{user?.username?.toUpperCase()}</span>
                  <span className="text-muted-foreground text-xs hidden lg:block">({roleLabel})</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-xs text-muted-foreground font-mono">
                  {user?.displayName ?? user?.username}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setChangePwOpen(true)} className="gap-2 cursor-pointer">
                  <KeyRound className="h-3.5 w-3.5" />
                  Смяна на парола
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Изход
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </div>
  );
}
