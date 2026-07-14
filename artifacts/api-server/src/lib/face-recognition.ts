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
// 0.65 gives better results when the camera angle differs from the enrolled photos
// (e.g. ceiling-mounted camera vs frontal enrollment photos).
export const FACE_MATCH_THRESHOLD = 0.65;

// Minimum SSD detection confidence (0–1). Below this → not a face.
// 0.3 causes false positives on car headlights/grilles.
// 0.5 is the practical minimum for real human faces in a garage/hallway.
// Override with FACE_MIN_CONFIDENCE env var for tuning.
const FACE_MIN_CONFIDENCE = Number(process.env.FACE_MIN_CONFIDENCE ?? 0.5);

// Minimum face bounding-box area as a fraction of the total image area (0–1).
// A real human face from 2–4 m overhead covers ~3–15% of a 640px frame.
// Car features (headlights, mirrors, grilles) are detected as much smaller "faces".
// Default 0.008 = 0.8% — filters car parts while keeping overhead human faces.
// Override with FACE_MIN_AREA_FRACTION env var for tuning.
const FACE_MIN_AREA_FRACTION = Number(process.env.FACE_MIN_AREA_FRACTION ?? 0.008);

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
 * Detects ALL faces in a frame using SsdMobilenetv1, falling back to
 * TinyFaceDetector if SSD finds nothing.
 * Returns an array of face descriptors — one per detected person.
 * Returns an empty array when no faces are found.
 */
export async function computeAllFaceDescriptors(imageBuffer: Buffer): Promise<number[][]> {
  await ensureModelsLoaded();
  const image = await canvasLib.loadImage(imageBuffer);
  logger.info({ width: image.width, height: image.height, bufLen: imageBuffer.length }, "Image loaded for detection");

  // Draw onto a canvas (required by face-api in Node.js)
  const canvas = canvasLib.createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const imageArea = image.width * image.height;

  /** Logs each raw detection and returns only those that pass quality filters. */
  function filterDetections<T extends { detection: faceapi.FaceDetection }>(
    dets: T[],
    detector: string,
  ): T[] {
    const kept: T[] = [];
    for (const d of dets) {
      const { score, box } = d.detection;
      const areaFraction = (box.width * box.height) / imageArea;
      const pass = score >= FACE_MIN_CONFIDENCE && areaFraction >= FACE_MIN_AREA_FRACTION;
      logger.info(
        {
          detector,
          score: +score.toFixed(3),
          boxW: Math.round(box.width),
          boxH: Math.round(box.height),
          areaFraction: +areaFraction.toFixed(4),
          minConfidence: FACE_MIN_CONFIDENCE,
          minAreaFraction: FACE_MIN_AREA_FRACTION,
          pass,
        },
        pass ? "Detection PASSED filters" : "Detection REJECTED (too small or low confidence — likely car/object)",
      );
      if (pass) kept.push(d);
    }
    return kept;
  }

  // --- Primary: SsdMobilenetv1 — use a permissive threshold so we can log all
  //     raw detections, then apply our own stricter filters.
  const ssdRaw = await faceapi
    .detectAllFaces(canvas as unknown as faceapi.TNetInput, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  const ssdDets = filterDetections(ssdRaw, "ssd");
  if (ssdDets.length > 0) {
    logger.info({ detector: "ssd", rawCount: ssdRaw.length, passedCount: ssdDets.length }, "SSD pass complete");
    return ssdDets.map((d) => Array.from(d.descriptor));
  }

  // --- Secondary: TinyFaceDetector (two sizes) ---
  for (const inputSize of [320, 416] as const) {
    const tinyRaw = await faceapi
      .detectAllFaces(
        canvas as unknown as faceapi.TNetInput,
        new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptors();
    const tinyDets = filterDetections(tinyRaw, `tiny-${inputSize}`);
    if (tinyDets.length > 0) {
      logger.info({ detector: "tiny", inputSize, rawCount: tinyRaw.length, passedCount: tinyDets.length }, "Tiny pass complete");
      return tinyDets.map((d) => Array.from(d.descriptor));
    }
  }

  logger.info({ width: image.width, height: image.height }, "No faces passed filters");
  return [];
}

/** @deprecated Use computeAllFaceDescriptors — kept for backward compat */
export async function computeFaceDescriptor(imageBuffer: Buffer): Promise<number[] | null> {
  const all = await computeAllFaceDescriptors(imageBuffer);
  return all.length > 0 ? all[0] : null;
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
