import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Activity, AlertTriangle, Users, Video, ShieldAlert, CheckCircle2, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetDashboardSummary, useGetRecentEvents, useGetHourlyActivity } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { refetchInterval: 30000 } });
  const { data: events, isLoading: loadingEvents } = useGetRecentEvents({ query: { refetchInterval: 5000 } });
  const { data: activity, isLoading: loadingActivity } = useGetHourlyActivity({ query: { refetchInterval: 60000 } });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-md" />)
        ) : summary ? (
          <>
            <StatCard title="Active Personnel" value={summary.activeEmployees.toString()} total={summary.totalEmployees.toString()} icon={Users} />
            <StatCard title="Today's Presence" value={summary.todayPresent.toString()} subtitle="Recognized individuals" icon={Activity} />
            <StatCard title="Cameras Online" value={summary.onlineCameras.toString()} total={summary.totalCameras.toString()} icon={Video} 
              alert={summary.onlineCameras < summary.totalCameras} />
            <StatCard title="Security Alerts" value={(summary.unknownToday + summary.deniedToday).toString()} 
              subtitle={`${summary.deniedToday} denied, ${summary.unknownToday} unknown`} 
              icon={ShieldAlert} alert={(summary.unknownToday + summary.deniedToday) > 0} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">Hourly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loadingActivity ? (
                <Skeleton className="h-full w-full" />
              ) : activity ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}:00`} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="recognized" stackId="a" fill="hsl(142 71% 45%)" name="Recognized" />
                    <Bar dataKey="unknown" stackId="a" fill="hsl(38 92% 50%)" name="Unknown" />
                    <Bar dataKey="denied" stackId="a" fill="hsl(0 84% 60%)" name="Denied" />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border bg-card flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider font-mono text-muted-foreground">Live Feed</CardTitle>
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {loadingEvents ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : events && events.length > 0 ? (
              <div className="divide-y divide-border">
                {events.map((event) => (
                  <div key={event.id} className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors">
                    <div className="h-10 w-10 shrink-0 bg-muted rounded overflow-hidden border border-border">
                      {event.snapshotUrl ? (
                        <img src={event.snapshotUrl} alt="snapshot" className="h-full w-full object-cover" />
                      ) : (
                        <UserX className="h-full w-full p-2 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium truncate">
                          {event.status === 'recognized' ? event.employeeName : 'Unknown Individual'}
                        </p>
                        <EventBadge status={event.status} />
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                        <span className="truncate mr-2">{event.cameraName} • {event.zoneName}</span>
                        <span>{new Date(event.detectedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">No recent events</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, total, icon: Icon, alert = false }: any) {
  return (
    <Card className={`border-border bg-card ${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">
          {value}
          {total && <span className="text-muted-foreground text-lg ml-1">/ {total}</span>}
        </div>
        {(subtitle || alert) && (
          <p className={`text-xs mt-1 ${alert ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {subtitle || 'System Alert'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EventBadge({ status }: { status: string }) {
  if (status === 'recognized') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Authorized</Badge>;
  if (status === 'denied') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Denied</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Unknown</Badge>;
}
