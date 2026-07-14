/**
 * Thin async wrapper around face recognition.
 *
 * Previously this ran TF.js in a worker_thread to avoid blocking the event loop.
 * With the InsightFace HTTP backend the call is already async (network I/O),
 * so no worker is needed — this module now delegates directly.
 */
import { computeAllFaceDescriptors, computeFaceDescriptor } from "./face-recognition.js";

export { computeAllFaceDescriptors as computeAllFaceDescriptorsAsync };

/** @deprecated Use computeAllFaceDescriptorsAsync */
export async function computeFaceDescriptorAsync(
  imageBuffer: Buffer,
): Promise<number[] | null> {
  return computeFaceDescriptor(imageBuffer);
}
