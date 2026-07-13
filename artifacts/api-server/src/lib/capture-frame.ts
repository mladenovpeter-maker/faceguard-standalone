import { execFile } from "child_process";
import { promisify } from "util";
import { type camerasTable } from "@workspace/db";

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

export async function grabRtspFrame(streamUrl: string): Promise<Buffer> {
  const { stdout } = await execFileAsync(
    "ffmpeg",
    ["-y", "-rtsp_transport", "tcp", "-i", streamUrl, "-frames:v", "1", "-q:v", "3", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"],
    { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 20, encoding: "buffer" as BufferEncoding },
  );
  return Buffer.from(stdout as unknown as Uint8Array);
}

export async function grabHttpFrame(streamUrl: string): Promise<Buffer> {
  const res = await fetch(streamUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching camera snapshot`);
  return Buffer.from(await res.arrayBuffer());
}

export async function captureFrame(camera: typeof camerasTable.$inferSelect): Promise<Buffer | null> {
  const streamUrl = buildStreamUrl(camera);
  try {
    if (camera.protocol === "http" || camera.protocol === "https") {
      return await grabHttpFrame(streamUrl);
    }
    return await grabRtspFrame(streamUrl);
  } catch {
    return null;
  }
}

export function toSnapshotDataUrl(frame: Buffer): string {
  return `data:image/jpeg;base64,${frame.toString("base64")}`;
}
