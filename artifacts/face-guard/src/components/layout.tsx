import { Link, useLocation } from "wouter";
import { Activity, Camera, Users, ShieldCheck, Map, Clock, Video, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  
  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/recognitions", label: "Event Log", icon: MonitorPlay },
    { href: "/employees", label: "Personnel", icon: Users },
    { href: "/attendance", label: "Attendance", icon: Clock },
    { href: "/access-rules", label: "Access Control", icon: ShieldCheck },
    { href: "/cameras", label: "Cameras", icon: Video },
    { href: "/zones", label: "Zones", icon: Map },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col z-20">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <ShieldCheck className="h-6 w-6 text-primary mr-3" />
          <h1 className="font-bold text-lg tracking-tight">FaceGuard OS</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Core Modules
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
            <span className="text-muted-foreground font-mono">SYSTEM STATUS</span>
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", health?.status === "ok" ? "bg-green-500" : "bg-red-500")} />
              <span className="font-mono font-medium">{health?.status === "ok" ? "ONLINE" : "OFFLINE"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-8 shrink-0 justify-between">
          <h2 className="text-lg font-medium text-foreground capitalize tracking-wide">
            {navItems.find(i => location === i.href || (i.href !== "/" && location.startsWith(i.href)))?.label || "Overview"}
          </h2>
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <span>{new Date().toISOString().split('T')[0]}</span>
            <span>SYS_ADMIN</span>
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
