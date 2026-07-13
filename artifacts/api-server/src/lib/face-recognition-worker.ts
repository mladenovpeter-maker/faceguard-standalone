/**
 * Node.js worker-thread that runs face detection + recognition in isolation
 * so the main Express event loop is never blocked by synchronous TensorFlow.js
 * CPU operations.
 *
 * Protocol (via worker_threads MessageChannel):
 *   Main → Worker:  { id: number; imageBuffer: ArrayBuffer }
 *   Worker → Main:  { id: number; descriptor: number[] | null }
 *                 | { id: number; error: string }
 */
import { parentPort } from "worker_threads";
import { computeFaceDescriptor } from "./face-recognition.js";

if (!parentPort) {
  throw new Error("face-recognition-worker must be run as a worker thread");
}

parentPort.on("message", async (msg: { id: number; imageBuffer: ArrayBuffer }) => {
  const { id, imageBuffer } = msg;
  try {
    const buffer = Buffer.from(imageBuffer);
    const descriptor = await computeFaceDescriptor(buffer);
    parentPort!.postMessage({ id, descriptor });
  } catch (err) {
    parentPort!.postMessage({ id, error: String(err) });
  }
});
