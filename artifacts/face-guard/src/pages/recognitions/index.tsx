import { useListRecognitions, useListVisitors, useCreateVisitor, useCheckInVisitor } from "@workspace/api-client-react";
import type { RecognitionEvent, Visitor } from "@workspace/api-client-react";
import { Search, Image as ImageIcon, UserPlus, UserCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

/* ── helpers ── */
const TYPE_LABELS: Record<string, string> = {
  supplier: "Доставчик",
  carrier:  "Спедитор",
  client:   "Клиент",
  guest:    "Гост",
  other:    "Друг",
};

/* ── RegisterVisitorModal ── */
function RegisterVisitorModal({
  event,
  onClose,
}: {
  event: RecognitionEvent;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: visitors = [] } = useListVisitors();
  const createVisitorMut = useCreateVisitor();
  const checkInMut = useCheckInVisitor();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedVisitorId, setSelectedVisitorId] = useState<number | null>(null);

  // New visitor form
  const [name,    setName]    = useState("");
  const [company, setCompany] = useState("");
  const [type,    setType]    = useState("guest");
  const [purpose, setPurpose] = useState("");
  const [host,    setHost]    = useState("");

  const busy = createVisitorMut.isPending || checkInMut.isPending;

  async function confirm() {
    let visitorId: number;

    if (mode === "existing") {
      if (!selectedVisitorId) {
        toast({ title: "Избери посетител", variant: "destructive" }); return;
      }
      visitorId = selectedVisitorId;
    } else {
      if (!name.trim()) {
        toast({ title: "Въведи ime на посетителя", variant: "destructive" }); return;
      }
      const created = await createVisitorMut.mutateAsync({
        data: {
          name: name.trim(),
          company: company || null,
          type: type as Visitor["type"],
          active: true,
        },
      });
      visitorId = created.id;
      qc.invalidateQueries({ queryKey: ["/api/visitors"] });
    }

    await checkInMut.mutateAsync({
      id: visitorId,
      data: {
        purpose: purpose || null,
        hostName: host || null,
        notes: `Регистриран от камера "${event.cameraName ?? ""}" · ${new Date(event.detectedAt).toLocaleString("bg-BG")}`,
      },
    });

    qc.invalidateQueries({ queryKey: ["/api/visitor-visits"] });
    toast({ title: "Посетителят е регистриран ✓" });
    onClose();
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Регистрирай като посетител
          </DialogTitle>
        </DialogHeader>

        {/* snapshot + event info */}
        <div className="flex gap-3 items-start bg-muted/40 rounded-lg p-3 border">
          {event.snapshotUrl ? (
            <img src={event.snapshotUrl} alt="snapshot" className="w-20 h-20 rounded object-cover border shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded bg-muted flex items-center justify-center border shrink-0">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="text-sm space-y-0.5">
            <p className="font-medium text-foreground">Непознато лице</p>
            <p className="text-muted-foreground font-mono text-xs">{new Date(event.detectedAt).toLocaleString("bg-BG")}</p>
            {event.cameraName && <p className="text-muted-foreground text-xs">Камера: {event.cameraName}</p>}
            {event.zoneName   && <p className="text-muted-foreground text-xs">Зона: {event.zoneName}</p>}
          </div>
        </div>

        {/* mode tabs */}
        <div className="flex rounded-lg overflow-hidden border text-sm">
          <button
            onClick={() => setMode("existing")}
            className={`flex-1 py-2 font-medium transition-colors ${mode === "existing" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
          >
            Съществуващ посетител
          </button>
          <button
            onClick={() => setMode("new")}
            className={`flex-1 py-2 font-medium transition-colors ${mode === "new" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
          >
            Нов посетител
          </button>
        </div>

        <div className="space-y-3">
          {mode === "existing" ? (
            <div className="space-y-1">
              <Label>Избери посетител</Label>
              <Select
                value={selectedVisitorId ? String(selectedVisitorId) : ""}
                onValueChange={v => setSelectedVisitorId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— избери от списъка —" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {(visitors as Visitor[]).filter(v => v.active).map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      <span className="font-medium">{v.name}</span>
                      {v.company && <span className="text-muted-foreground ml-1.5 text-xs">· {v.company}</span>}
                      <span className="text-muted-foreground ml-1.5 text-xs">({TYPE_LABELS[v.type] ?? v.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Имe *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" />
              </div>
              <div className="space-y-1">
                <Label>Компания</Label>
                <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Фирма ООД" />
              </div>
              <div className="space-y-1">
                <Label>Тип</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* common fields */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t">
            <div className="space-y-1">
              <Label>Цел на посещението</Label>
              <Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Доставка, Среща..." />
            </div>
            <div className="space-y-1">
              <Label>При кого</Label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="Иван Петров" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Отказ</Button>
          <Button onClick={confirm} disabled={busy} className="gap-2">
            <UserCheck className="h-4 w-4" />
            {busy ? "Записва..." : "Регистрирай вход"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ── */
export default function RecognitionList() {
  const [status, setStatus] = useState<"all" | "recognized" | "unknown" | "denied">("all");
  const [registerEvent, setRegisterEvent] = useState<RecognitionEvent | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: recognitions, isLoading } = useListRecognitions({
    status: status === "all" ? undefined : status,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Лог на събития</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Непознатите лица могат да бъдат регистрирани директно като посетители
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center bg-card p-3.5 rounded-xl border border-card-border shadow-sm">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Търсене на събития..." className="pl-9 bg-background rounded-lg" />
        </div>
        <Select value={status} onValueChange={(v: any) => setStatus(v)}>
          <SelectTrigger className="w-[200px] rounded-lg">
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

      <div className="rounded-xl border border-card-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="w-[72px] text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Снимка</TableHead>
              <TableHead className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Дата и час</TableHead>
              <TableHead className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Статус</TableHead>
              <TableHead className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Лице</TableHead>
              <TableHead className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Точност</TableHead>
              <TableHead className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Камера</TableHead>
              <TableHead className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Зона</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : recognitions && recognitions.length > 0 ? (
              recognitions.map((event) => (
                <TableRow key={event.id} className={event.status === "unknown" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                  <TableCell>
                    {event.snapshotUrl ? (
                      <div
                        className="h-10 w-10 bg-muted rounded-md border border-border overflow-hidden flex items-center justify-center cursor-zoom-in hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={() => setPreviewUrl(event.snapshotUrl!)}
                        title="Увеличи снимката"
                      >
                        <img src={event.snapshotUrl} alt="snapshot" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 bg-muted rounded-md border border-border flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(event.detectedAt).toLocaleString("bg-BG")}
                  </TableCell>
                  <TableCell>
                    <EventBadge status={event.status} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {event.status === "recognized" ? (
                      <div className="flex flex-col">
                        <span>{event.employeeName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{event.employeeNumber}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">Непознато лице</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {(event.confidence * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-muted-foreground">{event.cameraName}</TableCell>
                  <TableCell className="text-muted-foreground">{event.zoneName}</TableCell>
                  <TableCell>
                    {event.status === "unknown" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => setRegisterEvent(event as RecognitionEvent)}
                        title="Регистрирай като посетител"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Посетител
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Няма намерени разпознавания.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {registerEvent && (
        <RegisterVisitorModal
          event={registerEvent}
          onClose={() => setRegisterEvent(null)}
        />
      )}

      {/* Full-size snapshot preview */}
      <Dialog open={!!previewUrl} onOpenChange={v => { if (!v) setPreviewUrl(null); }}>
        <DialogContent className="max-w-2xl p-2">
          <DialogHeader className="px-2 pt-2 pb-0">
            <DialogTitle className="text-sm text-muted-foreground font-normal">Снимка от камера</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="rounded-lg overflow-hidden bg-black">
              <img
                src={previewUrl}
                alt="Снимка от събитие"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventBadge({ status }: { status: string }) {
  if (status === "recognized") return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">РАЗПОЗНАТ</Badge>;
  if (status === "denied")     return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">ОТКАЗАН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">НЕПОЗНАТ</Badge>;
}
