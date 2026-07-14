/**
 * Thin wrapper around a persistent worker_thread that runs face recognition.
 * Exposes a single async function so callers never block the event loop.
 */
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.resolve(currentDir, "lib/face-recognition-worker.mjs");

type Pending = {
  resolve: (descriptors: number[][]) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let nextId = 0;

function spawnWorker(): Worker {
  const w = new Worker(WORKER_PATH);

  w.on("message", (msg: { id: number; descriptors?: number[][]; error?: string }) => {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) {
      p.reject(new Error(msg.error));
    } else {
      p.resolve(msg.descriptors ?? []);
    }
  });

  w.on("error", (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error({ err }, "Face recognition worker crashed — rejecting all pending jobs");
    for (const p of pending.values()) p.reject(error);
    pending.clear();
    worker = null;
  });

  w.on("exit", (code) => {
    if (code !== 0) {
      logger.warn({ code }, "Face recognition worker exited unexpectedly");
      worker = null;
    }
  });

  logger.info({ workerPath: WORKER_PATH }, "Face recognition worker thread started");
  return w;
}

function getWorker(): Worker {
  if (!worker) worker = spawnWorker();
  return worker;
}

/**
 * Run face detection for ALL faces in a frame, in a worker thread.
 * Returns an array of descriptors — one per detected face (may be empty).
 * Never blocks the caller's event loop.
 */
export async function computeAllFaceDescriptorsAsync(imageBuffer: Buffer): Promise<number[][]> {
  return new Promise<number[][]>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    const copy = Buffer.from(imageBuffer);
    getWorker().postMessage({ id, imageBuffer: copy.buffer }, [copy.buffer]);
  });
}

/** @deprecated Use computeAllFaceDescriptorsAsync */
export async function computeFaceDescriptorAsync(imageBuffer: Buffer): Promise<number[] | null> {
  const all = await computeAllFaceDescriptorsAsync(imageBuffer);
  return all.length > 0 ? all[0] : null;
}
