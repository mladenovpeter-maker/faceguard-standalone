import { Router, type IRouter } from "express";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";
import { db, leavesTable, employeesTable } from "@workspace/db";
import {
  ListLeavesQueryParams,
  ListLeavesResponse,
  CreateLeaveBody,
  CreateLeaveResponse,
  GetLeaveResponse,
  UpdateLeaveBody,
  UpdateLeaveResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectLeaveWithJoins = async (conditions?: any) => {
  const records = await db
    .select({
      id: leavesTable.id,
      employeeId: leavesTable.employeeId,
      employeeName: sql<string | null>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
      employeeNumber: employeesTable.employeeNumber,
      employeePhotoUrl: employeesTable.photoUrl,
      department: employeesTable.department,
      type: leavesTable.type,
      startDate: leavesTable.startDate,
      endDate: leavesTable.endDate,
      reason: leavesTable.reason,
      status: leavesTable.status,
      notes: leavesTable.notes,
      createdAt: leavesTable.createdAt,
    })
    .from(leavesTable)
    .leftJoin(employeesTable, eq(employeesTable.id, leavesTable.employeeId))
    .where(conditions)
    .orderBy(leavesTable.startDate);

  return records;
};

router.get("/leaves", async (req, res): Promise<void> => {
  const query = ListLeavesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { employeeId, status, from, to, activeOn } = query.data;

  const conditions = [];
  if (employeeId != null) conditions.push(eq(leavesTable.employeeId, employeeId));
  if (status && status !== "all") conditions.push(eq(leavesTable.status, status));
  if (from) conditions.push(gte(leavesTable.endDate, String(from)));
  if (to) conditions.push(lte(leavesTable.startDate, String(to)));
  if (activeOn) {
    const d = String(activeOn);
    conditions.push(lte(leavesTable.startDate, d));
    conditions.push(gte(leavesTable.endDate, d));
  }

  const records = await selectLeaveWithJoins(
    conditions.length > 0 ? and(...conditions) : undefined
  );

  res.json(ListLeavesResponse.parse(records));
});

router.post("/leaves", async (req, res): Promise<void> => {
  const body = CreateLeaveBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [inserted] = await db
    .insert(leavesTable)
    .values({
      employeeId: body.data.employeeId,
      type: body.data.type ?? "paid_leave",
      startDate: body.data.startDate,
      endDate: body.data.endDate,
      reason: body.data.reason ?? null,
      status: body.data.status ?? "approved",
      notes: body.data.notes ?? null,
    })
    .returning({ id: leavesTable.id });

  const records = await selectLeaveWithJoins(eq(leavesTable.id, inserted.id));
  res.status(201).json(CreateLeaveResponse.parse(records[0]));
});

router.get("/leaves/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const records = await selectLeaveWithJoins(eq(leavesTable.id, id));
  if (!records[0]) { res.status(404).json({ error: "Not found" }); return; }

  res.json(GetLeaveResponse.parse(records[0]));
});

router.patch("/leaves/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateLeaveBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.type !== undefined) updateData.type = body.data.type;
  if (body.data.startDate !== undefined) updateData.startDate = body.data.startDate;
  if (body.data.endDate !== undefined) updateData.endDate = body.data.endDate;
  if (body.data.reason !== undefined) updateData.reason = body.data.reason;
  if (body.data.status !== undefined) updateData.status = body.data.status;
  if (body.data.notes !== undefined) updateData.notes = body.data.notes;

  await db.update(leavesTable).set(updateData).where(eq(leavesTable.id, id));

  const records = await selectLeaveWithJoins(eq(leavesTable.id, id));
  if (!records[0]) { res.status(404).json({ error: "Not found" }); return; }

  res.json(UpdateLeaveResponse.parse(records[0]));
});

router.delete("/leaves/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db.delete(leavesTable).where(eq(leavesTable.id, id)).returning({ id: leavesTable.id });
  if (!deleted[0]) { res.status(404).json({ error: "Not found" }); return; }

  res.status(204).end();
});

export default router;
