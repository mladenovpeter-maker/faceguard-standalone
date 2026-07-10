import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, departmentWorkSchedulesTable, departmentsTable } from "@workspace/db";
import {
  ListDepartmentSchedulesQueryParams,
  ListDepartmentSchedulesResponse,
  UpsertDepartmentScheduleBody,
  UpsertDepartmentScheduleResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectScheduleWithJoins = async (conditions?: any) => {
  const records = await db
    .select({
      id: departmentWorkSchedulesTable.id,
      departmentId: departmentWorkSchedulesTable.departmentId,
      departmentName: departmentsTable.name,
      dayOfWeek: departmentWorkSchedulesTable.dayOfWeek,
      startTime: departmentWorkSchedulesTable.startTime,
      endTime: departmentWorkSchedulesTable.endTime,
    })
    .from(departmentWorkSchedulesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, departmentWorkSchedulesTable.departmentId))
    .where(conditions)
    .orderBy(departmentWorkSchedulesTable.departmentId, departmentWorkSchedulesTable.dayOfWeek);

  return records;
};

router.get("/department-schedules", async (req, res): Promise<void> => {
  const query = ListDepartmentSchedulesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { departmentId } = query.data;
  const conditions = departmentId != null ? eq(departmentWorkSchedulesTable.departmentId, departmentId) : undefined;
  const records = await selectScheduleWithJoins(conditions);
  res.json(ListDepartmentSchedulesResponse.parse(records));
});

router.post("/department-schedules", async (req, res): Promise<void> => {
  const body = UpsertDepartmentScheduleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [upserted] = await db
    .insert(departmentWorkSchedulesTable)
    .values({
      departmentId: body.data.departmentId,
      dayOfWeek: body.data.dayOfWeek,
      startTime: body.data.startTime,
      endTime: body.data.endTime,
    })
    .onConflictDoUpdate({
      target: [departmentWorkSchedulesTable.departmentId, departmentWorkSchedulesTable.dayOfWeek],
      set: {
        startTime: body.data.startTime,
        endTime: body.data.endTime,
      },
    })
    .returning({ id: departmentWorkSchedulesTable.id });

  const records = await selectScheduleWithJoins(eq(departmentWorkSchedulesTable.id, upserted.id));
  res.json(UpsertDepartmentScheduleResponse.parse(records[0]));
});

router.delete("/department-schedules/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db
    .delete(departmentWorkSchedulesTable)
    .where(eq(departmentWorkSchedulesTable.id, id))
    .returning({ id: departmentWorkSchedulesTable.id });

  if (!deleted[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
