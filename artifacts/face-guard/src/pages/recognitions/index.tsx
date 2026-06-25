import { useListRecognitions } from "@workspace/api-client-react";
import { Search, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function RecognitionList() {
  const [status, setStatus] = useState<"all" | "recognized" | "unknown" | "denied">("all");
  const { data: recognitions, isLoading } = useListRecognitions({
    status: status === "all" ? undefined : status,
    limit: 100
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Лог на събития</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Търсене на събития..."
            className="pl-9 font-mono bg-background"
          />
        </div>
        <Select value={status} onValueChange={(v: any) => setStatus(v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Филтър по статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички събития</SelectItem>
            <SelectItem value="recognized">Разпознати</SelectItem>
            <SelectItem value="unknown">Непознати</SelectItem>
            <SelectItem value="denied">Отказани</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[80px]">Снимка</TableHead>
              <TableHead>Дата и час</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Лице</TableHead>
              <TableHead>Точност</TableHead>
              <TableHead>Камера</TableHead>
              <TableHead>Зона</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : recognitions && recognitions.length > 0 ? (
              recognitions.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {event.snapshotUrl ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <div className="h-10 w-10 bg-muted rounded-md border border-border overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                            <img src={event.snapshotUrl} alt="snapshot" className="h-full w-full object-cover" />
                          </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Снимка от събитие</DialogTitle>
                          </DialogHeader>
                          <div className="mt-2 aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center border border-border">
                            <img src={event.snapshotUrl} alt="full snapshot" className="w-full h-full object-contain" />
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded-md border border-border flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(event.detectedAt).toLocaleString('bg-BG')}
                  </TableCell>
                  <TableCell>
                    <EventBadge status={event.status} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {event.status === 'recognized' ? (
                      <div className="flex flex-col">
                        <span>{event.employeeName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{event.employeeNumber}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Непознато</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {(event.confidence * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground">{event.cameraName}</TableCell>
                  <TableCell className="text-muted-foreground">{event.zoneName}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Няма намерени разпознавания.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EventBadge({ status }: { status: string }) {
  if (status === 'recognized') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">РАЗПОЗНАТ</Badge>;
  if (status === 'denied') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">ОТКАЗАН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">НЕПОЗНАТ</Badge>;
}
