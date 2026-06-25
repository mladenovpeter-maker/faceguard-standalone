import { useState } from "react";
import { useGetTodayAttendance } from "@workspace/api-client-react";
import { User, Plane, Stethoscope, FileX, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LEAVE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid_leave:   { label: "Платен отпуск",    color: "bg-blue-100 text-blue-700 border-blue-200",   icon: Plane },
  unpaid_leave: { label: "Неплатен отпуск",  color: "bg-orange-100 text-orange-700 border-orange-200", icon: FileX },
  sick_leave:   { label: "Болничен",          color: "bg-red-100 text-red-700 border-red-200",      icon: Stethoscope },
  other:        { label: "Друга причина",     color: "bg-purple-100 text-purple-700 border-purple-200", icon: AlertCircle },
};

function LeaveTypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return <span className="text-muted-foreground text-xs">Неизвестна причина</span>;
  const cfg = LEAVE_LABELS[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("bg-BG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AttendanceList() {
  const { data: attendance, isLoading } = useGetTodayAttendance();
  const [tab, setTab] = useState("present");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Присъствие днес</h1>
        <div className="font-mono text-sm text-muted-foreground">
          {new Date().toLocaleDateString("bg-BG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Присъстващи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.presentCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">В отпуска</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.onLeaveCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Отсъстващи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.absentCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Общо персонал</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.totalEmployees ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="present">
            Присъстващи ({attendance?.presentCount ?? 0})
          </TabsTrigger>
          <TabsTrigger value="absent">
            Отсъстващи ({attendance?.absentCount ?? 0})
          </TabsTrigger>

        </TabsList>

        {/* Present tab */}
        <TabsContent value="present">
          <div className="bg-card rounded-lg border border-border overflow-hidden mt-4">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Служител</TableHead>
                  <TableHead>Първо засичане</TableHead>
                  <TableHead>Последно засичане</TableHead>
                  <TableHead>Текуща/последна зона</TableHead>
                  <TableHead className="text-right">Обща продължителност</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : attendance && (attendance.records ?? []).length > 0 ? (
                  (attendance.records ?? []).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center">
                          {record.employeePhotoUrl ? (
                            <img src={record.employeePhotoUrl} alt="снимка" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{record.employeeName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{record.employeeNumber}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {new Date(record.firstSeen).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {new Date(record.lastSeen).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{record.zoneName || "—"}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {record.totalMinutes
                          ? `${Math.floor(record.totalMinutes / 60)}ч ${record.totalMinutes % 60}м`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Няма регистрирано присъствие за днес.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Absent tab */}
        <TabsContent value="absent">
          <div className="bg-card rounded-lg border border-border overflow-hidden mt-4">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Служител</TableHead>
                  <TableHead>Отдел / Длъжност</TableHead>
                  <TableHead>Причина за отсъствие</TableHead>
                  <TableHead>Период</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    </TableRow>
                  ))
                ) : attendance && (attendance.absentRecords ?? []).length > 0 ? (
                  (attendance.absentRecords ?? []).map((rec) => (
                    <TableRow key={rec.employeeId}>
                      <TableCell>
                        <div className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center">
                          {rec.employeePhotoUrl ? (
                            <img src={rec.employeePhotoUrl} alt="снимка" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{rec.employeeName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{rec.employeeNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{rec.department}</div>
                        <div className="text-xs text-muted-foreground">{rec.position}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <LeaveTypeBadge type={rec.leaveType} />
                          {rec.leaveReason && (
                            <div className="text-xs text-muted-foreground mt-1">{rec.leaveReason}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {rec.leaveFrom && rec.leaveTo ? (
                          <span>{formatDate(rec.leaveFrom)} — {formatDate(rec.leaveTo)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Всички активни служители присъстват.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
