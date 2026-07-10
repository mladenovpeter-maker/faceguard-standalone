import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, zonesTable, camerasTable, recognitionEventsTable, attendanceTable } from "@workspace/db";
import {
  CreateZoneBody,
  UpdateZoneParams,
  UpdateZoneBody,
  DeleteZoneParams,
  ListZonesResponse,
  CreateZoneResponse,
  UpdateZoneResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/zones", async (_req, res): Promise<void> => {
  const zones = await db.select({
    id: zonesTable.id,
    name: zonesTable.name,
    description: zonesTable.description,
    accessLevel: zonesTable.accessLevel,
    cameraCount: sql<number>`cast(count(${camerasTable.id}) as int)`,
    createdAt: zonesTable.createdAt,
  })
    .from(zonesTable)
    .leftJoin(camerasTable, eq(camerasTable.zoneId, zonesTable.id))
    .groupBy(zonesTable.id)
    .orderBy(zonesTable.name);

  res.json(ListZonesResponse.parse(zones));
});

router.post("/zones", async (req, res): Promise<void> => {
  const parsed = CreateZoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [zone] = await db.insert(zonesTable).values({
    name: parsed.data.name,
    description: parsed.data.description,
    accessLevel: parsed.data.accessLevel ?? "public",
  }).returning();

  const result = { ...zone, cameraCount: 0 };
  res.status(201).json(CreateZoneResponse.parse(result));
});

router.patch("/zones/:id", async (req, res): Promise<void> => {
  const params = UpdateZoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateZoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [zone] = await db
    .update(zonesTable)
    .set(parsed.data)
    .where(eq(zonesTable.id, params.data.id))
    .returning();

  if (!zone) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }

  const [cameraCountRow] = await db.select({ count: sql<number>`cast(count(*) as int)` })
    .from(camerasTable)
    .where(eq(camerasTable.zoneId, zone.id));

  const result = { ...zone, cameraCount: cameraCountRow?.count ?? 0 };
  res.json(UpdateZoneResponse.parse(result));
});

router.delete("/zones/:id", async (req, res): Promise<void> => {
  const params = DeleteZoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const zoneId = params.data.id;

  // Check zone exists
  const [existing] = await db.select({ id: zonesTable.id }).from(zonesTable).where(eq(zonesTable.id, zoneId));
  if (!existing) {
    res.status(404).json({ error: "Zone not found" });
    return;
  }

  // 1. Find cameras in this zone
  const cameras = await db.select({ id: camerasTable.id }).from(camerasTable).where(eq(camerasTable.zoneId, zoneId));
  const cameraIds = cameras.map(c => c.id);

  // 2. Delete recognition events for those cameras
  if (cameraIds.length > 0) {
    await db.delete(recognitionEventsTable).where(inArray(recognitionEventsTable.cameraId, cameraIds));
  }

  // 3. Delete cameras in this zone
  if (cameraIds.length > 0) {
    await db.delete(camerasTable).where(eq(camerasTable.zoneId, zoneId));
  }

  // 4. Null out attendance.zone_id (nullable FK)
  await db.update(attendanceTable).set({ zoneId: null }).where(eq(attendanceTable.zoneId, zoneId));

  // 5. Delete the zone (zone_work_schedules and access_rules cascade automatically)
  await db.delete(zonesTable).where(eq(zonesTable.id, zoneId));

  res.sendStatus(204);
});

export default router;
