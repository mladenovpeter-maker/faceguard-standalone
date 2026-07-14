import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Where snapshots are stored on disk.
 * - Production (Docker):  /app/snapshots  (mounted Docker volume)
 * - Development (Replit): <workspace>/artifacts/api-server/snapshots
 */
export const SNAPSHOTS_DIR: string =
  process.env["SNAPSHOTS_DIR"] ??
  (process.env["NODE_ENV"] === "production"
    ? "/app/snapshots"
    : path.resolve(
        process.cwd().endsWith(path.join("artifacts", "api-server"))
          ? process.cwd()
          : path.join(process.cwd(), "artifacts", "api-server"),
        "snapshots",
      ));

export const SNAPSHOTS_URL_PREFIX = "/api/snapshots";

const SNAPSHOT_RETENTION_DAYS = 3;

/**
 * Midnight UTC of (today - SNAPSHOT_RETENTION_DAYS).
 * Exported so index.ts can reuse the same boundary for DB nulling.
 */
export function snapshotRetentionCutoff(): Date {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - SNAPSHOT_RETENTION_DAYS);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * Save a snapshot (data URI or raw base64 JPEG) to disk.
 * If the input is already an HTTP/HTTPS URL or a path URL, it is returned as-is.
 * Returns null when the input is empty or unrecognisable.
 * Throws on filesystem errors so callers can log them explicitly.
 */
export async function saveSnapshot(
  input: string | null | undefined,
  detectedAt: Date,
): Promise<string | null> {
  if (!input) return null;

  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("/")) {
    return input;
  }

  let base64: string;
  if (input.startsWith("data:image/")) {
    const comma = input.indexOf(",");
    if (comma === -1) return null;
    base64 = input.slice(comma + 1);
  } else {
    base64 = input;
  }

  if (!base64) return null;

  const dateDir = detectedAt.toISOString().slice(0, 10);
  const dir = path.join(SNAPSHOTS_DIR, dateDir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `event-${detectedAt.getTime()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
  const filePath = path.join(dir, filename);

  await fs.writeFile(filePath, Buffer.from(base64, "base64"));

  return `${SNAPSHOTS_URL_PREFIX}/${dateDir}/${filename}`;
}

/**
 * Delete snapshot directories older than SNAPSHOT_RETENTION_DAYS days.
 * Returns the number of files deleted.
 */
export async function deleteOldSnapshotDirs(): Promise<number> {
  const cutoff = snapshotRetentionCutoff();

  let deleted = 0;
  try {
    const entries = await fs.readdir(SNAPSHOTS_DIR);
    await Promise.all(
      entries.map(async (entry) => {
        // Only process YYYY-MM-DD directory names
        const entryDate = new Date(entry + "T12:00:00Z");
        if (isNaN(entryDate.getTime())) return;
        if (entryDate < cutoff) {
          const dirPath = path.join(SNAPSHOTS_DIR, entry);
          const files = await fs.readdir(dirPath).catch(() => [] as string[]);
          deleted += files.length;
          await fs.rm(dirPath, { recursive: true, force: true });
        }
      }),
    );
  } catch {
    // SNAPSHOTS_DIR may not exist yet — that is fine
  }
  return deleted;
}
