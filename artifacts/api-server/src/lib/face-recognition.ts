import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as canvasLib from "canvas";
// Use the "nobundle" build with the pure-JS (@tensorflow/tfjs) CPU backend instead of
// @tensorflow/tfjs-node. The native tfjs-node bindings are fragile across environments
// (version-locked native addon), whereas the pure-JS backend has no native dependency and
// is fast enough since this only runs as an occasional fallback, not on every camera frame.
import * as faceapi from "@vladmandic/face-api/dist/face-api.esm-nobundle.js";
import * as tf from "@tensorflow/tfjs";
import { logger } from "./logger";

const { Canvas, Image, ImageData } = canvasLib as unknown as {
  Canvas: unknown;
  Image: unknown;
  ImageData: unknown;
};
faceapi.env.monkeyPatch({ Canvas, Image, ImageData } as unknown as Parameters<typeof faceapi.env.monkeyPatch>[0]);

// face-api registers the "wasm" backend as its highest-priority tfjs backend, but we don't
// ship the wasm binary (we only need the plain CPU backend for occasional fallback matching).
// Force the CPU backend explicitly so tfjs doesn't try (and fail) to auto-initialize wasm.
const backendReadyPromise = tf.setBackend("cpu").then(() => tf.ready());

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Probe multiple candidate paths — works in all environments:
//   Replit dev:  cwd = .../artifacts/api-server  → models/ sibling of src/
//   Docker prod: cwd = /app, dist/ sibling of models/  → /app/models
const MODELS_DIR = ((): string => {
  const candidates = [
    // Replit dev (cwd = artifacts/api-server)
    path.resolve(process.cwd(), "models"),
    // Docker prod (cwd = /app, dist/index.mjs compiled to /app/dist/)
    path.resolve(currentDir, "../models"),
    // Monorepo root fallback
    path.resolve(process.cwd(), "artifacts/api-server/models"),
    path.resolve(currentDir, "../../models"),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error(`Face models not found. Tried:\n${candidates.join("\n")}`);
  return found;
})();

// Minimum descriptor distance to consider two faces a match (lower = stricter).
// face-api's Euclidean distance: <0.6 is a widely used threshold for the same person.
export const FACE_MATCH_THRESHOLD = 0.55;

let modelsLoaded = false;
let modelsLoadingPromise: Promise<void> | null = null;

async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  if (!modelsLoadingPromise) {
    modelsLoadingPromise = (async () => {
      await backendReadyPromise;
      // SsdMobilenetv1 is the primary detector — more robust than TinyFaceDetector,
      // handles close-ups, side angles, and varied lighting better.
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
      // TinyFaceDetector as secondary (already loaded weights kept for fallback)
      await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR);
      modelsLoaded = true;
      logger.info({ MODELS_DIR }, "Face recognition models loaded (SSD + Tiny)");
    })();
  }
  return modelsLoadingPromise;
}

/**
 * Tries to detect a face using SsdMobilenetv1 at progressively lower confidence
 * thresholds, then falls back to TinyFaceDetector if SSD finds nothing.
 * Returns null only if no face is found by any method.
 */
export async function computeFaceDescriptor(imageBuffer: Buffer): Promise<number[] | null> {
  await ensureModelsLoaded();
  const image = await canvasLib.loadImage(imageBuffer);
  logger.info({ width: image.width, height: image.height, bufLen: imageBuffer.length }, "Image loaded for detection");

  // Draw onto a canvas (required by face-api in Node.js)
  const canvas = canvasLib.createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  // Try detection on the original frame first, then on a 2× upscaled copy.
  // Real IP cameras at 640×360 often have the face occupying <15% of the frame
  // (person standing 3–5 m away). Upscaling before detection helps the model
  // find small faces without dropping thresholds so low we get false positives.
  const canvases: ReturnType<typeof canvasLib.createCanvas>[] = [canvas];
  if (image.width <= 640) {
    const up = canvasLib.createCanvas(image.width * 2, image.height * 2);
    up.getContext("2d").drawImage(image, 0, 0, up.width, up.height);
    canvases.push(up);
  }

  // --- Primary: SsdMobilenetv1 (0.3 threshold — suits cameras at 3–5 m) ---
  for (const c of canvases) {
    const det = await faceapi
      .detectSingleFace(c as unknown as faceapi.TNetInput, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (det) {
      logger.info({ detector: "ssd", score: det.detection.score, upscaled: c !== canvas }, "Face detected");
      return Array.from(det.descriptor);
    }
  }

  // --- Secondary: TinyFaceDetector at multiple input sizes ---
  for (const c of canvases) {
    for (const inputSize of [224, 320, 416, 608]) {
      const det = await faceapi
        .detectSingleFace(
          c as unknown as faceapi.TNetInput,
          new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (det) {
        logger.info({ detector: "tiny", inputSize, score: det.detection.score, upscaled: c !== canvas }, "Face detected");
        return Array.from(det.descriptor);
      }
    }
  }

  logger.warn({ width: image.width, height: image.height }, "No face detected by any method");
  return null;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export interface FaceCandidate {
  employeeId: number;
  descriptor: number[];
}

export interface FaceMatch {
  employeeId: number;
  distance: number;
  confidence: number;
}

/**
 * Compares a face descriptor against a set of enrolled candidate descriptors
 * (an employee may have several, one per enrolled photo) and returns the
 * closest match under the matching threshold, or null if no match is close enough.
 */
export function matchDescriptor(descriptor: number[], candidates: FaceCandidate[]): FaceMatch | null {
  let best: FaceMatch | null = null;
  for (const candidate of candidates) {
    const distance = euclideanDistance(descriptor, candidate.descriptor);
    if (distance <= FACE_MATCH_THRESHOLD && (!best || distance < best.distance)) {
      best = {
        employeeId: candidate.employeeId,
        distance,
        confidence: Math.max(0, 1 - distance / FACE_MATCH_THRESHOLD) * 100,
      };
    }
  }
  return best;
}
