import { useGetTodayAttendance } from "@workspace/api-client-react";
import { Clock, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AttendanceList() {
  const { data: attendance, isLoading } = useGetTodayAttendance();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Today's Attendance</h1>
        <div className="font-mono text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.presentCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-red-500">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.absentCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Workforce</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {isLoading ? <Skeleton className="h-8 w-16" /> : attendance?.totalEmployees || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>First Seen</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Current/Last Zone</TableHead>
              <TableHead className="text-right">Total Duration</TableHead>
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
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : attendance && attendance.records.length > 0 ? (
              attendance.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center">
                      {record.employeePhotoUrl ? (
                        <img src={record.employeePhotoUrl} alt="photo" className="h-full w-full object-cover" />
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
                    {new Date(record.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {new Date(record.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{record.zoneName || '-'}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {record.totalMinutes ? `${Math.floor(record.totalMinutes / 60)}h ${record.totalMinutes % 60}m` : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No attendance records for today.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
