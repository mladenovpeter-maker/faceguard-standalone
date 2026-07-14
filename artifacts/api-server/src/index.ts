import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool, recognitionEventsTable } from "@workspace/db";
import { and, isNotNull, lt } from "drizzle-orm";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSystemUsers } from "./lib/seed-users";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const migrationsFolder = process.env["NODE_ENV"] === "production"
  ? "/app/drizzle"
  : path.resolve(__dirname, "../../../lib/db/drizzle");

const SNAPSHOT_TTL_MS = 30 * 60 * 1000;
const SNAPSHOT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

async function cleanupOldSnapshots() {
  try {
    const cutoff = new Date(Date.now() - SNAPSHOT_TTL_MS);
    const result = await db
      .update(recognitionEventsTable)
      .set({ snapshotUrl: null })
      .where(
        and(
          isNotNull(recognitionEventsTable.snapshotUrl),
          lt(recognitionEventsTable.detectedAt, cutoff),
        ),
      );
    const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count, cutoffMinutes: 30 }, "Cleaned up old snapshots");
    }
  } catch (err) {
    logger.warn({ err }, "Snapshot cleanup failed");
  }
}

async function start() {
  logger.info({ migrationsFolder }, "Running database migrations");
  await migrate(db, { migrationsFolder });
  logger.info("Migrations complete");

  await seedSystemUsers();
  logger.info("Seed complete");

  await cleanupOldSnapshots();
  setInterval(() => { void cleanupOldSnapshots(); }, SNAPSHOT_CLEANUP_INTERVAL_MS);

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  pool.end();
  process.exit(1);
});
