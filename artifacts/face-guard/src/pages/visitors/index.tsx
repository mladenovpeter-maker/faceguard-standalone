import { useState } from "react";
import {
  BadgeCheck, Plus, Search, Phone, Mail, CreditCard,
  Building2, UserCheck, UserX, LogIn, LogOut, Clock, ChevronRight, X, Save, Pencil,
} from "lucide-react";
import {
  useListVisitors, useCreateVisitor, useUpdateVisitor, useDeleteVisitor,
  useCheckInVisitor, useUpdateVisitorVisit, useGetVisitorVisits,
} from "@workspace/api-client-react";
import type { Visitor, VisitorVisit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

/* ── consts ── */

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  supplier: { label: "Доставчик",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  carrier:  { label: "Спедитор",   color: "bg-purple-100 text-purple-700 border-purple-200" },
  client:   { label: "Клиент",     color: "bg-green-100 text-green-700 border-green-200" },
  guest:    { label: "Гост",       color: "bg-amber-100 text-amber-700 border-amber-200" },
  other:    { label: "Друг",       color: "bg-slate-100 text-slate-600 border-slate-200" },
};

/* ── helpers ── */

function formatDT(dt: string | null | undefined) {
  if (!dt) return "—";
  const d = new Date(dt);
  return `${d.toLocaleDateString("bg-BG")} ${d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}`;
}

function duration(checkIn: string, checkOut: string | null | undefined) {
  if (!checkOut) return null;
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000);
  if (mins < 60) return `${mins} мин`;
  return `${Math.floor(mins / 60)}ч ${mins % 60}мин`;
}

/* ── VisitorForm dialog ── */

function VisitorFormDialog({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Visitor | null;
}) {
  const isEdit = !!initial;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name:       initial?.name       ?? "",
    company:    initial?.company    ?? "",
    type:       initial?.type       ?? "guest",
    phone:      initial?.phone      ?? "",
    email:      initial?.email      ?? "",
    cardNumber: initial?.cardNumber ?? "",
    notes:      initial?.notes      ?? "",
    active:     initial?.active     ?? true,
  });

  const createMut = useCreateVisitor();
  const updateMut = useUpdateVisitor();

  function set(k: string, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.name.trim()) { toast({ title: "Въведи ime", variant: "destructive" }); return; }
    const payload = {
      name:       form.name,
      company:    form.company   || null,
      type:       form.type as Visitor["type"],
      phone:      form.phone     || null,
      email:      form.email     || null,
      cardNumber: form.cardNumber || null,
      notes:      form.notes     || null,
      active:     form.active,
    };
    if (isEdit && initial) {
      await updateMut.mutateAsync({ id: initial.id, data: payload });
      toast({ title: "Посетителят е обновен" });
    } else {
      await createMut.mutateAsync({ data: payload });
      toast({ title: "Посетителят е добавен" });
    }
    qc.invalidateQueries({ queryKey: ["/api/visitors"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Редактиране" : "Нов посетител"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Имe *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Иван Иванов" />
            </div>
            <div className="space-y-1">
              <Label>Компания</Label>
              <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Фирма ООД" />
            </div>
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Телефон</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+359 ..." />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@..." />
            </div>
            <div className="space-y-1">
              <Label>Карта №</Label>
              <Input value={form.cardNumber} onChange={e => set("cardNumber", e.target.value)} placeholder="A-0001" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Бележки</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отказ</Button>
          <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isEdit ? "Запази" : "Добави"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── CheckInDialog ── */

function CheckInDialog({ visitor, open, onClose }: { visitor: Visitor; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const checkInMut = useCheckInVisitor();
  const [purpose, setPurpose] = useState("");
  const [hostName, setHostName] = useState("");

  async function confirm() {
    await checkInMut.mutateAsync({
      id: visitor.id,
      data: { purpose: purpose || null, hostName: hostName || null, notes: null },
    });
    toast({ title: `${visitor.name} — регистриран вход` });
    qc.invalidateQueries({ queryKey: ["/api/visitor-visits"] });
    qc.invalidateQueries({ queryKey: [`/api/visitors/${visitor.id}/visits`] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Вход — {visitor.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Цел на посещението</Label>
            <Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Доставка, Среща, ..." />
          </div>
          <div className="space-y-1">
            <Label>При кого</Label>
            <Input value={hostName} onChange={e => setHostName(e.target.value)} placeholder="Иван Петров" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отказ</Button>
          <Button onClick={confirm} disabled={checkInMut.isPending}>
            <LogIn className="h-4 w-4 mr-2" />
            Регистрирай вход
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── VisitorDetail panel ── */

function VisitorDetail({ visitor, onClose, onEdit }: { visitor: Visitor; onClose: () => void; onEdit: () => void }) {
  const { data: visits = [] } = useGetVisitorVisits(visitor.id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const checkOutMut = useUpdateVisitorVisit();
  const [checkInOpen, setCheckInOpen] = useState(false);

  const typeInfo = TYPE_LABELS[visitor.type] ?? TYPE_LABELS.other;
  const activeVisit = (visits as VisitorVisit[]).find(v => !v.checkOut);

  async function checkOut() {
    if (!activeVisit) return;
    await checkOutMut.mutateAsync({ id: visitor.id, visitId: activeVisit.id, data: {} });
    toast({ title: `${visitor.name} — регистриран изход` });
    qc.invalidateQueries({ queryKey: [`/api/visitors/${visitor.id}/visits`] });
    qc.invalidateQueries({ queryKey: ["/api/visitor-visits"] });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold">{visitor.name}</h2>
          {visitor.company && <p className="text-sm text-muted-foreground">{visitor.company}</p>}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded border", typeInfo.color)}>{typeInfo.label}</span>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded border",
          visitor.active ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
        )}>{visitor.active ? "Активен" : "Неактивен"}</span>
        {activeVisit && (
          <span className="text-xs font-medium px-2 py-0.5 rounded border bg-teal-100 text-teal-700 border-teal-200 animate-pulse">
            В обекта
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-sm mb-4">
        {visitor.phone      && <div className="flex items-center gap-2"><Phone    className="h-3.5 w-3.5 text-muted-foreground" />{visitor.phone}</div>}
        {visitor.email      && <div className="flex items-center gap-2"><Mail     className="h-3.5 w-3.5 text-muted-foreground" />{visitor.email}</div>}
        {visitor.cardNumber && <div className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />Карта: {visitor.cardNumber}</div>}
        {visitor.notes      && <div className="flex items-center gap-2 text-muted-foreground italic">{visitor.notes}</div>}
      </div>

      <div className="flex gap-2 mb-5">
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />Редактирай
        </Button>
        {activeVisit ? (
          <Button size="sm" variant="destructive" className="flex-1" onClick={checkOut} disabled={checkOutMut.isPending}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" />Изход
          </Button>
        ) : (
          <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => setCheckInOpen(true)}>
            <LogIn className="h-3.5 w-3.5 mr-1.5" />Вход
          </Button>
        )}
      </div>

      <div className="border-t pt-3 flex-1 overflow-y-auto">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">История на посещенията</p>
        {(visits as VisitorVisit[]).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Няма регистрирани посещения</p>
        ) : (
          <div className="space-y-2">
            {(visits as VisitorVisit[]).map(v => (
              <div key={v.id} className={cn("rounded-lg border p-2.5 text-sm", !v.checkOut && "border-teal-300 bg-teal-50/50")}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatDT(v.checkIn)}</span>
                  {v.checkOut ? (
                    <span className="text-xs text-muted-foreground">{duration(v.checkIn, v.checkOut)}</span>
                  ) : (
                    <span className="text-xs text-teal-600 font-medium">В обекта</span>
                  )}
                </div>
                {v.checkOut && <div className="text-xs text-muted-foreground mt-0.5">Изход: {formatDT(v.checkOut)}</div>}
                {v.purpose  && <div className="text-xs mt-0.5">Цел: {v.purpose}</div>}
                {v.hostName && <div className="text-xs text-muted-foreground">При: {v.hostName}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {checkInOpen && (
        <CheckInDialog visitor={visitor} open={checkInOpen} onClose={() => setCheckInOpen(false)} />
      )}
    </div>
  );
}

/* ── Main page ── */

export default function VisitorsPage() {
  const { data: visitors = [], isLoading } = useListVisitors();
  const deleteMut = useDeleteVisitor();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch]       = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<Visitor | null>(null);
  const [selected, setSelected]   = useState<Visitor | null>(null);

  const filtered = (visitors as Visitor[]).filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || (v.company ?? "").toLowerCase().includes(q) || (v.cardNumber ?? "").toLowerCase().includes(q);
    const matchType = typeFilter === "all" || v.type === typeFilter;
    return matchSearch && matchType;
  });

  const active   = (visitors as Visitor[]).filter(v => v.active).length;
  const inactive = (visitors as Visitor[]).length - active;

  function openNew()  { setEditTarget(null); setFormOpen(true); }
  function openEdit(v: Visitor) { setEditTarget(v); setFormOpen(true); }

  async function deleteVisitor(v: Visitor) {
    if (!confirm(`Изтриване на ${v.name}?`)) return;
    await deleteMut.mutateAsync({ id: v.id });
    toast({ title: "Посетителят е изтрит" });
    qc.invalidateQueries({ queryKey: ["/api/visitors"] });
    if (selected?.id === v.id) setSelected(null);
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-8rem)]">
      {/* Left panel */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Посетители</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Доставчици, спедитори и гости</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Нов посетител
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><BadgeCheck className="h-4 w-4 text-blue-600" /></div>
            <div><p className="text-xl font-bold">{(visitors as Visitor[]).length}</p><p className="text-[10px] text-muted-foreground font-mono uppercase">Общо</p></div>
          </div>
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><UserCheck className="h-4 w-4 text-green-600" /></div>
            <div><p className="text-xl font-bold">{active}</p><p className="text-[10px] text-muted-foreground font-mono uppercase">Активни</p></div>
          </div>
          <div className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg"><UserX className="h-4 w-4 text-slate-500" /></div>
            <div><p className="text-xl font-bold">{inactive}</p><p className="text-[10px] text-muted-foreground font-mono uppercase">Неактивни</p></div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Търсене по име, фирма, карта..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Всички типове" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички типове</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading && (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm animate-pulse">Зареждане...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BadgeCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>Няма посетители</p>
            </div>
          )}
          {filtered.map(v => {
            const ti = TYPE_LABELS[v.type] ?? TYPE_LABELS.other;
            const isSelected = selected?.id === v.id;
            return (
              <div
                key={v.id}
                onClick={() => setSelected(isSelected ? null : v)}
                className={cn(
                  "bg-card border rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-colors hover:bg-secondary/50",
                  isSelected && "border-primary bg-primary/5",
                  !v.active && "opacity-60"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {v.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{v.name}</span>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", ti.color)}>{ti.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                    {v.company  && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{v.company}</span>}
                    {v.cardNumber && <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{v.cardNumber}</span>}
                    {v.phone    && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</span>}
                  </div>
                </div>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isSelected && "rotate-90")} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Right detail panel */}
      {selected && (
        <div className="w-80 shrink-0 bg-card border rounded-lg p-4 overflow-y-auto">
          <VisitorDetail
            visitor={selected}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditTarget(selected); setFormOpen(true); }}
          />
        </div>
      )}

      {formOpen && (
        <VisitorFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditTarget(null); }}
          initial={editTarget}
        />
      )}
    </div>
  );
}
