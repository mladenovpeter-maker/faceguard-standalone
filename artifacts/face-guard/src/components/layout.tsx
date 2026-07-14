import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, Users, ShieldCheck, Map, Clock, Video, MonitorPlay,
  CalendarOff, LogOut, KeyRound, ChevronDown, UserCircle, Database,
  Building2, TableProperties, BadgeCheck, Menu, Wifi, WifiOff,
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

const navGroups = [
  {
    label: "Мониторинг",
    items: [
      { href: "/", label: "Табло", icon: Activity },
      { href: "/recognitions", label: "Лог на събития", icon: MonitorPlay },
      { href: "/attendance", label: "Присъствие", icon: Clock },
    ],
  },
  {
    label: "Персонал & HR",
    items: [
      { href: "/employees", label: "Персонал", icon: Users },
      { href: "/departments", label: "Отдели", icon: Building2 },
      { href: "/department-schedules", label: "Работно време", icon: Clock },
      { href: "/leaves", label: "Отпуски", icon: CalendarOff },
      { href: "/form76", label: "Форма 76", icon: TableProperties },
    ],
  },
  {
    label: "Конфигурация",
    items: [
      { href: "/visitors", label: "Посетители", icon: BadgeCheck },
      { href: "/access-rules", label: "Контрол на достъп", icon: ShieldCheck },
      { href: "/cameras", label: "Камери", icon: Video },
      { href: "/zones", label: "Зони", icon: Map },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const { user, logout } = useAuth();
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleLabel = user?.role === "admin" ? "Администратор" : "Оператор";
  const currentPage = allNavItems.find(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  const isOnline = health?.status === "ok";

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">

      {/* Logo */}
      <div className="h-16 flex items-center px-5 shrink-0 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--sidebar-primary))] flex items-center justify-center shrink-0 shadow-lg shadow-black/30">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--sidebar-primary-foreground))]" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-[15px] tracking-tight text-[hsl(var(--sidebar-accent-foreground))] leading-none">
              FaceGuard
            </h1>
            <p className="text-[10px] font-mono text-[hsl(var(--sidebar-foreground))]/40 leading-none mt-1 tracking-widest uppercase">
              Access Control
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-mono font-semibold tracking-[0.15em] uppercase px-3 mb-1.5 text-[hsl(var(--sidebar-foreground))]/35">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-150",
                        isActive
                          ? "bg-[hsl(var(--sidebar-primary))]/15 text-[hsl(var(--sidebar-primary))] font-semibold"
                          : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))] font-medium"
                      )}
                      onClick={onNavigate}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[hsl(var(--sidebar-primary))]" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[hsl(var(--sidebar-primary))]" : "")} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-3 border-t border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-400" />
            )}
            <span className={cn(
              "text-xs font-mono font-semibold tracking-wider",
              !health ? "text-[hsl(var(--sidebar-foreground))]/40" :
              isOnline ? "text-emerald-400" : "text-red-400"
            )}>
              {!health ? "ЗАРЕЖДАНЕ" : isOnline ? "ОНЛАЙН" : "ПРОБЛЕМ"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-[hsl(var(--sidebar-foreground))]/30" />
            <span className={cn(
              "text-[10px] font-mono",
              health?.db === "ok" ? "text-emerald-400/80" : "text-red-400"
            )}>
              {!health ? "—" : health.db === "ok" ? "БД ОК" : "БД ГРЕШКА"}
            </span>
          </div>
        </div>
        {health?.uptimeSeconds !== undefined && (
          <p className="text-[10px] font-mono text-[hsl(var(--sidebar-foreground))]/25 mt-1">
            uptime {formatUptime(health.uptimeSeconds)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20 selection:text-primary">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[240px] flex-col z-20 shrink-0 shadow-xl shadow-black/20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-[240px] flex flex-col border-0">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* Header */}
        <header className="h-14 md:h-[58px] border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-3 md:px-6 shrink-0 justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0 h-8 w-8"
              onClick={() => setMobileOpen(true)}
              aria-label="Меню"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-[15px] font-display font-bold text-foreground tracking-tight truncate leading-none">
                {currentPage?.label ?? "Преглед"}
              </h2>
              <p className="text-[11px] font-mono text-muted-foreground hidden sm:block leading-none mt-0.5">
                {new Date().toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-secondary transition-colors text-sm">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none">
                  <span className="font-semibold text-[13px] text-foreground">{user?.displayName ?? user?.username}</span>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{roleLabel}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-2">
                <p className="text-sm font-semibold text-foreground">{user?.displayName ?? user?.username}</p>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">{roleLabel}</p>
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
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-5 lg:p-7">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
    </div>
  );
}
