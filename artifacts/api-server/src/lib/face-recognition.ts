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
const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const MODELS_DIR = fs.existsSync(path.resolve(workspaceRoot, "artifacts/api-server/models"))
  ? path.resolve(workspaceRoot, "artifacts/api-server/models")
  : path.resolve(currentDir, "../../models");

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
      await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
      modelsLoaded = true;
      logger.info({ MODELS_DIR }, "Face recognition models loaded");
    })();
  }
  return modelsLoadingPromise;
}

/**
 * Computes a 128-dimensional face descriptor from an image buffer.
 * Returns null if no face could be detected in the image.
 */
export async function computeFaceDescriptor(imageBuffer: Buffer): Promise<number[] | null> {
  await ensureModelsLoaded();
  const image = await canvasLib.loadImage(imageBuffer);
  const detection = await faceapi
    .detectSingleFace(
      image as unknown as faceapi.TNetInput,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return Array.from(detection.descriptor);
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
