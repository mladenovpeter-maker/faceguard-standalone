import { useGetEmployee, useListRecognitions } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, User, Phone, Mail, Building, Briefcase, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function EmployeeDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const employeeId = parseInt(id || "0", 10);
  
  const { data: employee, isLoading: loadingEmp } = useGetEmployee(employeeId, { query: { enabled: !!employeeId } });
  const { data: recognitions, isLoading: loadingRec } = useListRecognitions({ employeeId, limit: 10 }, { query: { enabled: !!employeeId } });

  if (loadingEmp) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!employee) return <div className="p-8 text-center">Employee not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/employees")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Employee Profile</h1>
        <Badge variant="outline" className={employee.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20 ml-auto' : 'bg-muted text-muted-foreground ml-auto'}>
          {employee.status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-border bg-card">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="h-32 w-32 rounded-full border-4 border-muted overflow-hidden bg-muted mb-4 flex items-center justify-center">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <h2 className="text-xl font-bold">{employee.firstName} {employee.lastName}</h2>
            <p className="font-mono text-sm text-muted-foreground mt-1 mb-4">{employee.employeeNumber}</p>
            
            <div className="w-full space-y-3 text-sm text-left">
              <div className="flex items-center text-muted-foreground">
                <Building className="h-4 w-4 mr-3" />
                <span className="text-foreground">{employee.department}</span>
              </div>
              <div className="flex items-center text-muted-foreground">
                <Briefcase className="h-4 w-4 mr-3" />
                <span className="text-foreground">{employee.position}</span>
              </div>
              {employee.email && (
                <div className="flex items-center text-muted-foreground">
                  <Mail className="h-4 w-4 mr-3" />
                  <span className="text-foreground">{employee.email}</span>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center text-muted-foreground">
                  <Phone className="h-4 w-4 mr-3" />
                  <span className="text-foreground">{employee.phone}</span>
                </div>
              )}
              <div className="flex items-center text-muted-foreground">
                <Calendar className="h-4 w-4 mr-3" />
                <span className="text-foreground">Joined {new Date(employee.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2 space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent Access Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRec ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ) : recognitions && recognitions.length > 0 ? (
                    recognitions.map(rec => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-xs">{new Date(rec.detectedAt).toLocaleString()}</TableCell>
                        <TableCell>{rec.cameraName} / {rec.zoneName}</TableCell>
                        <TableCell>
                          {rec.status === 'recognized' ? 
                            <span className="text-green-500 text-xs font-medium">AUTHORIZED</span> : 
                            <span className="text-red-500 text-xs font-medium">DENIED</span>
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{(rec.confidence * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No recent events</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
