import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const startedAt = Date.now();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbStatus: "ok" | "error" = "error";
  try {
    await db.execute(sql`SELECT 1`);
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  const overall = dbStatus === "ok" ? "ok" : "degraded";
  const uptimeSeconds = (Date.now() - startedAt) / 1000;

  const data = HealthCheckResponse.parse({ status: overall, db: dbStatus, uptimeSeconds });
  res.status(overall === "ok" ? 200 : 503).json(data);
});

export default router;
