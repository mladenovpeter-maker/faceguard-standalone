import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool, recognitionEventsTable } from "@workspace/db";
import { and, isNotNull, lt } from "drizzle-orm";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSystemUsers } from "./lib/seed-users";
import { deleteOldSnapshotDirs, SNAPSHOTS_DIR, snapshotRetentionCutoff } from "./lib/snapshot-store";

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

const SNAPSHOT_RETENTION_DAYS = 3;
const SNAPSHOT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every hour

async function cleanupOldSnapshots() {
  try {
    const cutoff = snapshotRetentionCutoff();

    // 1. Delete old files from disk
    const filesDeleted = await deleteOldSnapshotDirs();

    // 2. NULL snapshot_url in DB for events older than the same cutoff
    const result = await db
      .update(recognitionEventsTable)
      .set({ snapshotUrl: null })
      .where(
        and(
          isNotNull(recognitionEventsTable.snapshotUrl),
          lt(recognitionEventsTable.detectedAt, cutoff),
        ),
      );
    const dbCount = (result as unknown as { rowCount: number }).rowCount ?? 0;

    logger.info(
      { filesDeleted, dbCount, retentionDays: SNAPSHOT_RETENTION_DAYS, cutoff: cutoff.toISOString() },
      "Snapshot cleanup complete",
    );
  } catch (err) {
    logger.warn({ err }, "Snapshot cleanup failed");
  }
}

async function checkSnapshotsVolume() {
  try {
    const { default: fsSync } = await import("fs");
    const items = fsSync.readdirSync(SNAPSHOTS_DIR);
    logger.info({ snapshotsDir: SNAPSHOTS_DIR, entries: items.length }, "Snapshots volume OK");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Directory doesn't exist yet — create it and warn (may mean volume not mounted)
      const fsP = await import("fs/promises");
      await fsP.mkdir(SNAPSHOTS_DIR, { recursive: true });
      logger.warn(
        { snapshotsDir: SNAPSHOTS_DIR },
        "Snapshots directory did not exist at startup — created it. " +
        "If this is production, verify the Docker volume is mounted at /app/snapshots.",
      );
    } else {
      logger.error({ err, snapshotsDir: SNAPSHOTS_DIR }, "Cannot access snapshots directory");
    }
  }
}

async function start() {
  logger.info({ migrationsFolder }, "Running database migrations");
  await migrate(db, { migrationsFolder });
  logger.info("Migrations complete");

  await seedSystemUsers();
  logger.info("Seed complete");

  // Verify the snapshots volume is mounted before first cleanup
  await checkSnapshotsVolume();

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
