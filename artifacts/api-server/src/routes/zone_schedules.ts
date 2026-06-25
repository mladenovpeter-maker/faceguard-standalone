import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, zoneWorkSchedulesTable, zonesTable } from "@workspace/db";
import {
  ListZoneSchedulesQueryParams,
  ListZoneSchedulesResponse,
  UpsertZoneScheduleBody,
  UpsertZoneScheduleResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectScheduleWithJoins = async (conditions?: any) => {
  const records = await db
    .select({
      id: zoneWorkSchedulesTable.id,
      zoneId: zoneWorkSchedulesTable.zoneId,
      zoneName: zonesTable.name,
      dayOfWeek: zoneWorkSchedulesTable.dayOfWeek,
      startTime: zoneWorkSchedulesTable.startTime,
      endTime: zoneWorkSchedulesTable.endTime,
    })
    .from(zoneWorkSchedulesTable)
    .leftJoin(zonesTable, eq(zonesTable.id, zoneWorkSchedulesTable.zoneId))
    .where(conditions)
    .orderBy(zoneWorkSchedulesTable.zoneId, zoneWorkSchedulesTable.dayOfWeek);

  return records;
};

router.get("/zone-schedules", async (req, res): Promise<void> => {
  const query = ListZoneSchedulesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { zoneId } = query.data;
  const conditions = zoneId != null ? eq(zoneWorkSchedulesTable.zoneId, zoneId) : undefined;
  const records = await selectScheduleWithJoins(conditions);
  res.json(ListZoneSchedulesResponse.parse(records));
});

router.post("/zone-schedules", async (req, res): Promise<void> => {
  const body = UpsertZoneScheduleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [upserted] = await db
    .insert(zoneWorkSchedulesTable)
    .values({
      zoneId: body.data.zoneId,
      dayOfWeek: body.data.dayOfWeek,
      startTime: body.data.startTime,
      endTime: body.data.endTime,
    })
    .onConflictDoUpdate({
      target: [zoneWorkSchedulesTable.zoneId, zoneWorkSchedulesTable.dayOfWeek],
      set: {
        startTime: body.data.startTime,
        endTime: body.data.endTime,
      },
    })
    .returning({ id: zoneWorkSchedulesTable.id });

  const records = await selectScheduleWithJoins(eq(zoneWorkSchedulesTable.id, upserted.id));
  res.json(UpsertZoneScheduleResponse.parse(records[0]));
});

router.delete("/zone-schedules/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db
    .delete(zoneWorkSchedulesTable)
    .where(eq(zoneWorkSchedulesTable.id, id))
    .returning({ id: zoneWorkSchedulesTable.id });

  if (!deleted[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
