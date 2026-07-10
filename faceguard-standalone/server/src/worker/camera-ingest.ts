/**
 * Standalone camera-ingestion worker (self-hosted deployments only).
 *
 * This process is NOT started by the main API server. It is meant to run as
 * its own process (see docker-compose.yml `camera-worker` service) when the
 * whole stack is self-hosted at home against real IP cameras.
 *
 * For every camera row in the `cameras` table it periodically:
 *   1. Grabs a single still frame from the camera's RTSP or HTTP stream
 *      (via ffmpeg for RTSP, or a plain HTTP GET for snapshot-style URLs).
 *   2. POSTs it to POST /api/recognitions with status "unknown" so the
 *      existing internal AI fallback (see lib/face-recognition.ts) attempts
 *      to match it against enrolled employee photos, exactly like a real
 *      camera/NVR integration would.
 *
 * This intentionally does NOT do any face detection itself — every captured
 * frame is submitted as "unknown" and the server decides whether a face was
 * found and matched. This keeps the worker simple and reuses the existing,
 * already-tested matching pipeline.
 */
import { db, camerasTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { captureFrame, sanitizeError } from "../lib/camera-capture";

const API_BASE_URL = process.env.CAMERA_WORKER_API_URL ?? "http://localhost:8080";
const USERNAME = process.env.CAMERA_WORKER_USERNAME;
const PASSWORD = process.env.CAMERA_WORKER_PASSWORD;
const POLL_INTERVAL_MS = Number(process.env.CAMERA_WORKER_POLL_INTERVAL_MS ?? 5000);

if (!USERNAME || !PASSWORD) {
  throw new Error(
    "CAMERA_WORKER_USERNAME and CAMERA_WORKER_PASSWORD environment variables are required " +
      "(the worker logs in as an existing FaceGuard user to call the recognitions API).",
  );
}

let authToken: string | null = null;
let authTokenObtainedAt = 0;
const AUTH_TOKEN_MAX_AGE_MS = 7 * 60 * 60 * 1000; // refresh well before the 8h server-side TTL

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Camera worker login failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function getAuthToken(): Promise<string> {
  if (!authToken || Date.now() - authTokenObtainedAt > AUTH_TOKEN_MAX_AGE_MS) {
    authToken = await login();
    authTokenObtainedAt = Date.now();
    logger.info("Camera worker authenticated with the API server");
  }
  return authToken;
}

async function captureFrameOrNull(camera: typeof camerasTable.$inferSelect): Promise<Buffer | null> {
  try {
    return await captureFrame(camera);
  } catch (err) {
    logger.warn(
      { err: sanitizeError(err), cameraId: camera.id, cameraName: camera.name },
      "Failed to capture camera frame",
    );
    return null;
  }
}

async function submitFrame(camera: typeof camerasTable.$inferSelect, frame: Buffer): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}/api/recognitions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      cameraId: camera.id,
      status: "unknown",
      confidence: 0,
      snapshotBase64: `data:image/jpeg;base64,${frame.toString("base64")}`,
      detectedAt: new Date().toISOString(),
    }),
  });

  if (res.status === 401) {
    // Token expired unexpectedly (e.g. server restarted) — force a fresh login next time.
    authToken = null;
    return;
  }

  if (!res.ok) {
    logger.warn(
      { cameraId: camera.id, status: res.status, body: await res.text() },
      "Recognition submission failed",
    );
    return;
  }

  const result = (await res.json()) as { status: string; employeeName?: string | null };
  if (result.status === "recognized") {
    logger.info({ cameraId: camera.id, employeeName: result.employeeName }, "Face recognized via internal AI fallback");
  }
}

async function pollAllCameras(): Promise<void> {
  const cameras = await db.select().from(camerasTable);
  if (cameras.length === 0) {
    logger.warn("No cameras configured yet — add one from the FaceGuard admin UI first.");
    return;
  }

  await Promise.all(
    cameras.map(async (camera) => {
      const frame = await captureFrameOrNull(camera);
      if (!frame) return;
      try {
        await submitFrame(camera, frame);
      } catch (err) {
        logger.warn({ err, cameraId: camera.id }, "Failed to submit recognition frame");
      }
    }),
  );
}

async function main(): Promise<void> {
  logger.info(
    { apiBaseUrl: API_BASE_URL, pollIntervalMs: POLL_INTERVAL_MS },
    "Camera ingestion worker starting",
  );

  // Fail fast if the API server isn't reachable / credentials are wrong.
  await getAuthToken();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pollAllCameras();
    } catch (err) {
      logger.error({ err }, "Camera polling cycle failed");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  logger.error({ err }, "Camera ingestion worker crashed");
  process.exit(1);
});
