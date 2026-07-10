/**
 * Shared camera stream/snapshot capture logic, used by both the "Test
 * connection" API route (routes/cameras.ts) and the standalone
 * camera-ingestion worker (worker/camera-ingest.ts).
 */
import { execFile } from "child_process";
import { promisify } from "util";
import type { camerasTable } from "@workspace/db";

const execFileAsync = promisify(execFile);

const FFMPEG_TIMEOUT_MS = Number(process.env.CAMERA_WORKER_FFMPEG_TIMEOUT_MS ?? 8000);

export function buildStreamUrl(camera: typeof camerasTable.$inferSelect): string {
  const auth = camera.username
    ? `${encodeURIComponent(camera.username)}${camera.passwordHash ? `:${encodeURIComponent(camera.passwordHash)}` : ""}@`
    : "";
  const port = camera.port ? `:${camera.port}` : "";
  const streamPath = camera.streamPath?.startsWith("/") ? camera.streamPath : `/${camera.streamPath ?? ""}`;
  const scheme = camera.protocol === "http" || camera.protocol === "https" ? camera.protocol : "rtsp";
  return `${scheme}://${auth}${camera.host}${port}${streamPath}`;
}

/** Grabs one JPEG still frame from an RTSP stream using ffmpeg. */
async function grabRtspFrame(streamUrl: string): Promise<Buffer> {
  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-rtsp_transport", "tcp",
      "-i", streamUrl,
      "-frames:v", "1",
      "-q:v", "3",
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "pipe:1",
    ],
    { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 20, encoding: "buffer" as BufferEncoding },
  );
  return Buffer.from(stdout as unknown as Uint8Array);
}

/** Grabs one JPEG still frame from an HTTP snapshot-style camera URL. */
async function grabHttpFrame(streamUrl: string): Promise<Buffer> {
  const res = await fetch(streamUrl, { signal: AbortSignal.timeout(FFMPEG_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching camera snapshot`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Strips embedded `user:pass@` credentials from a stream URL / error message before logging. */
export function redactCredentials(text: string): string {
  return text.replace(/:\/\/[^/@\s]+@/g, "://***:***@");
}

export function sanitizeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: redactCredentials(err.message) };
  }
  return redactCredentials(String(err));
}

/** Attempts to grab a single still frame from the camera's configured stream. Throws on failure. */
export async function captureFrame(camera: typeof camerasTable.$inferSelect): Promise<Buffer> {
  const streamUrl = buildStreamUrl(camera);
  if (camera.protocol === "http" || camera.protocol === "https") {
    return await grabHttpFrame(streamUrl);
  }
  return await grabRtspFrame(streamUrl);
}
