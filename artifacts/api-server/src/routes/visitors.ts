import { Router, type IRouter } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, visitorsTable, visitorVisitsTable } from "@workspace/db";

const router: IRouter = Router();

/* ── helpers ── */
const TYPE_LABELS: Record<string, string> = {
  supplier: "Доставчик",
  carrier:  "Спедитор",
  client:   "Клиент",
  guest:    "Гост",
  other:    "Друг",
};

/* ── GET /api/visitors ── */
router.get("/visitors", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(visitorsTable)
    .orderBy(desc(visitorsTable.createdAt));
  res.json(rows);
});

/* ── POST /api/visitors ── */
router.post("/visitors", async (req, res): Promise<void> => {
  const { name, company, type, phone, email, photoUrl, cardNumber, notes, active } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(visitorsTable).values({
    name, company: company ?? null,
    type: type ?? "guest",
    phone: phone ?? null,
    email: email ?? null,
    photoUrl: photoUrl ?? null,
    cardNumber: cardNumber ?? null,
    notes: notes ?? null,
    active: active ?? true,
  }).returning();
  res.status(201).json(row);
});

/* ── GET /api/visitors/:id ── */
router.get("/visitors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(visitorsTable).where(eq(visitorsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

/* ── PATCH /api/visitors/:id ── */
router.patch("/visitors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { name, company, type, phone, email, photoUrl, cardNumber, notes, active } = req.body;
  const updates: Record<string, unknown> = {};
  if (name        !== undefined) updates.name        = name;
  if (company     !== undefined) updates.company     = company;
  if (type        !== undefined) updates.type        = type;
  if (phone       !== undefined) updates.phone       = phone;
  if (email       !== undefined) updates.email       = email;
  if (photoUrl    !== undefined) updates.photoUrl    = photoUrl;
  if (cardNumber  !== undefined) updates.cardNumber  = cardNumber;
  if (notes       !== undefined) updates.notes       = notes;
  if (active      !== undefined) updates.active      = active;
  const [row] = await db.update(visitorsTable).set(updates).where(eq(visitorsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

/* ── DELETE /api/visitors/:id ── */
router.delete("/visitors/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(visitorsTable).where(eq(visitorsTable.id, id));
  res.status(204).send();
});

/* ── GET /api/visitors/:id/visits ── */
router.get("/visitors/:id/visits", async (req, res): Promise<void> => {
  const visitorId = Number(req.params.id);
  const visits = await db
    .select()
    .from(visitorVisitsTable)
    .where(eq(visitorVisitsTable.visitorId, visitorId))
    .orderBy(desc(visitorVisitsTable.checkIn));
  res.json(visits);
});

/* ── POST /api/visitors/:id/visits (check-in) ── */
router.post("/visitors/:id/visits", async (req, res): Promise<void> => {
  const visitorId = Number(req.params.id);
  const { purpose, hostName, notes } = req.body;
  const [visit] = await db.insert(visitorVisitsTable).values({
    visitorId,
    purpose: purpose ?? null,
    hostName: hostName ?? null,
    notes: notes ?? null,
    checkIn: new Date(),
  }).returning();
  res.status(201).json(visit);
});

/* ── PATCH /api/visitors/:id/visits/:visitId (check-out) ── */
router.patch("/visitors/:id/visits/:visitId", async (req, res): Promise<void> => {
  const visitId = Number(req.params.visitId);
  const { notes, checkOut } = req.body;
  const updates: Record<string, unknown> = {
    checkOut: checkOut ? new Date(checkOut) : new Date(),
  };
  if (notes !== undefined) updates.notes = notes;
  const [visit] = await db.update(visitorVisitsTable).set(updates).where(eq(visitorVisitsTable.id, visitId)).returning();
  if (!visit) { res.status(404).json({ error: "Not found" }); return; }
  res.json(visit);
});

/* ── GET /api/visitor-visits (recent active visits) ── */
router.get("/visitor-visits", async (_req, res): Promise<void> => {
  const visits = await db
    .select({
      id:            visitorVisitsTable.id,
      visitorId:     visitorVisitsTable.visitorId,
      visitorName:   visitorsTable.name,
      visitorCompany: visitorsTable.company,
      visitorType:   visitorsTable.type,
      purpose:       visitorVisitsTable.purpose,
      hostName:      visitorVisitsTable.hostName,
      checkIn:       visitorVisitsTable.checkIn,
      checkOut:      visitorVisitsTable.checkOut,
      notes:         visitorVisitsTable.notes,
    })
    .from(visitorVisitsTable)
    .leftJoin(visitorsTable, eq(visitorsTable.id, visitorVisitsTable.visitorId))
    .orderBy(desc(visitorVisitsTable.checkIn))
    .limit(100);
  res.json(visits);
});

export default router;
