import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, departmentsTable, employeesTable } from "@workspace/db";
import {
  CreateDepartmentBody,
  CreateDepartmentResponse,
  UpdateDepartmentBody,
  UpdateDepartmentResponse,
  ListDepartmentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectDepartmentsWithCounts = async (conditions?: any) => {
  const records = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
      createdAt: departmentsTable.createdAt,
      employeeCount: sql<number>`cast(count(${employeesTable.id}) as int)`,
    })
    .from(departmentsTable)
    .leftJoin(employeesTable, eq(employeesTable.departmentId, departmentsTable.id))
    .where(conditions)
    .groupBy(departmentsTable.id)
    .orderBy(departmentsTable.name);

  return records;
};

router.get("/departments", async (_req, res): Promise<void> => {
  const records = await selectDepartmentsWithCounts();
  res.json(ListDepartmentsResponse.parse(records));
});

router.post("/departments", async (req, res): Promise<void> => {
  const body = CreateDepartmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [inserted] = await db
    .insert(departmentsTable)
    .values({ name: body.data.name })
    .returning();

  res.status(201).json(CreateDepartmentResponse.parse({ ...inserted, employeeCount: 0 }));
});

router.patch("/departments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = UpdateDepartmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(departmentsTable)
    .set({ name: body.data.name })
    .where(eq(departmentsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  const records = await selectDepartmentsWithCounts(eq(departmentsTable.id, id));
  res.json(UpdateDepartmentResponse.parse(records[0]));
});

router.delete("/departments/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(employeesTable)
    .where(eq(employeesTable.departmentId, id));

  if (count > 0) {
    res.status(409).json({ error: "Отделът има назначени служители" });
    return;
  }

  const deleted = await db
    .delete(departmentsTable)
    .where(eq(departmentsTable.id, id))
    .returning({ id: departmentsTable.id });

  if (!deleted[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
