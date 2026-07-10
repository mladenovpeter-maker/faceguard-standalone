import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, camerasTable, zonesTable, recognitionEventsTable } from "@workspace/db";
import {
  CreateCameraBody,
  GetCameraParams,
  UpdateCameraParams,
  UpdateCameraBody,
  DeleteCameraParams,
  TestCameraConnectionParams,
  ListCamerasResponse,
  CreateCameraResponse,
  GetCameraResponse,
  UpdateCameraResponse,
  TestCameraConnectionResponse,
} from "@workspace/api-zod";
import { captureFrame, sanitizeError } from "../lib/camera-capture";

const router: IRouter = Router();

router.get("/cameras", async (_req, res): Promise<void> => {
  const cameras = await db
    .select({
      id: camerasTable.id,
      name: camerasTable.name,
      brand: camerasTable.brand,
      protocol: camerasTable.protocol,
      host: camerasTable.host,
      port: camerasTable.port,
      username: camerasTable.username,
      streamPath: camerasTable.streamPath,
      zoneId: camerasTable.zoneId,
      zoneName: zonesTable.name,
      status: camerasTable.status,
      createdAt: camerasTable.createdAt,
    })
    .from(camerasTable)
    .leftJoin(zonesTable, eq(camerasTable.zoneId, zonesTable.id))
    .orderBy(camerasTable.name);

  res.json(ListCamerasResponse.parse(cameras));
});

router.post("/cameras", async (req, res): Promise<void> => {
  const parsed = CreateCameraBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rest } = parsed.data;

  const [camera] = await db.insert(camerasTable).values({
    ...rest,
    passwordHash: password ?? null,
  }).returning();

  const [zoneRow] = await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, camera.zoneId));

  const result = { ...camera, zoneName: zoneRow?.name ?? null };
  res.status(201).json(CreateCameraResponse.parse(result));
});

router.get("/cameras/:id", async (req, res): Promise<void> => {
  const params = GetCameraParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [camera] = await db
    .select({
      id: camerasTable.id,
      name: camerasTable.name,
      brand: camerasTable.brand,
      protocol: camerasTable.protocol,
      host: camerasTable.host,
      port: camerasTable.port,
      username: camerasTable.username,
      streamPath: camerasTable.streamPath,
      zoneId: camerasTable.zoneId,
      zoneName: zonesTable.name,
      status: camerasTable.status,
      createdAt: camerasTable.createdAt,
    })
    .from(camerasTable)
    .leftJoin(zonesTable, eq(camerasTable.zoneId, zonesTable.id))
    .where(eq(camerasTable.id, params.data.id));

  if (!camera) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }

  res.json(GetCameraResponse.parse(camera));
});

router.patch("/cameras/:id", async (req, res): Promise<void> => {
  const params = UpdateCameraParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCameraBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rest } = parsed.data as any;
  const updateData: any = { ...rest };
  if (password !== undefined) {
    updateData.passwordHash = password;
  }

  const [camera] = await db
    .update(camerasTable)
    .set(updateData)
    .where(eq(camerasTable.id, params.data.id))
    .returning();

  if (!camera) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }

  const [zoneRow] = await db.select({ name: zonesTable.name }).from(zonesTable).where(eq(zonesTable.id, camera.zoneId));

  const result = { ...camera, zoneName: zoneRow?.name ?? null };
  res.json(UpdateCameraResponse.parse(result));
});

router.delete("/cameras/:id", async (req, res): Promise<void> => {
  const params = DeleteCameraParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const cameraId = params.data.id;

  const [existing] = await db.select({ id: camerasTable.id }).from(camerasTable).where(eq(camerasTable.id, cameraId));
  if (!existing) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }

  // Delete recognition events first (camera_id is NOT NULL, no cascade)
  await db.delete(recognitionEventsTable).where(eq(recognitionEventsTable.cameraId, cameraId));

  // Now delete the camera
  await db.delete(camerasTable).where(eq(camerasTable.id, cameraId));

  res.sendStatus(204);
});

router.post("/cameras/:id/test", async (req, res): Promise<void> => {
  const params = TestCameraConnectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [camera] = await db
    .select()
    .from(camerasTable)
    .where(eq(camerasTable.id, params.data.id));

  if (!camera) {
    res.status(404).json({ error: "Camera not found" });
    return;
  }

  const start = Date.now();

  try {
    await captureFrame(camera);
    const latencyMs = Date.now() - start;

    await db.update(camerasTable).set({ status: "online" }).where(eq(camerasTable.id, params.data.id));

    res.json(TestCameraConnectionResponse.parse({
      success: true,
      message: `Successfully connected to ${camera.brand.toUpperCase()} camera at ${camera.host}`,
      latencyMs,
    }));
  } catch (err) {
    await db.update(camerasTable).set({ status: "offline" }).where(eq(camerasTable.id, params.data.id));

    const sanitized = sanitizeError(err);
    const message =
      sanitized && typeof sanitized === "object" && "message" in sanitized
        ? String((sanitized as { message: unknown }).message)
        : String(sanitized);

    res.json(TestCameraConnectionResponse.parse({
      success: false,
      message: `Could not connect to ${camera.brand.toUpperCase()} camera at ${camera.host}: ${message}`,
      latencyMs: Date.now() - start,
    }));
  }
});

export default router;
