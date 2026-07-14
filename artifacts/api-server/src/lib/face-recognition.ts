/**
 * Face recognition engine — InsightFace HTTP backend (primary).
 *
 * The heavy lifting runs in a separate Python microservice (face-ai) that
 * wraps InsightFace buffalo_l (RetinaFace detector + ArcFace 512-dim embeddings).
 * This module calls that service over HTTP and provides pure-JS helpers for
 * embedding comparison.
 *
 * When FACE_AI_URL is NOT set (e.g. Replit dev) functions return empty arrays
 * and log a warning — the rest of the pipeline degrades gracefully.
 *
 * Distance metric: cosine similarity (ArcFace embeddings are L2-normalised,
 * so dot-product ≈ cosine similarity).
 * Match threshold: FACE_MATCH_THRESHOLD env var (default 0.40).
 *   ≥ 0.40 → same person  (good general default)
 *   ≥ 0.35 → same person  (relaxed — better for ceiling / angled cameras)
 *   ≥ 0.45 → same person  (strict — fewer false positives)
 */

import { logger } from "./logger.js";

// ── Config ────────────────────────────────────────────────────────────────────

const FACE_AI_URL = (process.env.FACE_AI_URL ?? "").replace(/\/$/, "");

/**
 * Cosine-similarity threshold for a positive match.
 * ArcFace typical operating range: 0.28 (academic TAR@FAR=1e-6) … 0.50 (loose).
 * Default 0.40 works well across frontal and moderate angles.
 */
export const FACE_MATCH_THRESHOLD = parseFloat(
  process.env.FACE_MATCH_THRESHOLD ?? "0.40",
);

// ── InsightFace HTTP client ────────────────────────────────────────────────────

interface FaceAiFace {
  embedding: number[];
  score: number;
  bbox: [number, number, number, number];
}

interface FaceAiResponse {
  faces: FaceAiFace[];
}

/**
 * Detect ALL faces in a frame and return their 512-dim ArcFace embeddings.
 * Returns [] when no faces are found or FACE_AI_URL is not configured.
 */
export async function computeAllFaceDescriptors(
  imageBuffer: Buffer,
): Promise<number[][]> {
  if (!FACE_AI_URL) {
    logger.warn(
      "FACE_AI_URL not set — face recognition disabled. " +
        "Set FACE_AI_URL=http://face-ai:5000 in docker-compose.",
    );
    return [];
  }

  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" }),
    "frame.jpg",
  );

  let res: Response;
  try {
    res = await fetch(`${FACE_AI_URL}/analyze`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.error(
      { err },
      "face-ai service unreachable — is the face-ai container running?",
    );
    return [];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "face-ai /analyze returned an error");
    return [];
  }

  const data = (await res.json()) as FaceAiResponse;
  logger.debug({ count: data.faces.length }, "InsightFace: faces detected");
  return data.faces.map((f) => f.embedding);
}

/** @deprecated Use computeAllFaceDescriptors */
export async function computeFaceDescriptor(
  imageBuffer: Buffer,
): Promise<number[] | null> {
  const all = await computeAllFaceDescriptors(imageBuffer);
  return all.length > 0 ? (all[0] ?? null) : null;
}

// ── Cosine similarity matching ─────────────────────────────────────────────────

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/**
 * Cosine similarity between two ArcFace embedding vectors.
 * Returns value in [-1, 1]; ≥ FACE_MATCH_THRESHOLD means same person.
 * Returns -1 on dimension mismatch (stale 128-dim descriptor from old face-api.js).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return -1;
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return -1;
  return dotProduct(a, b) / (na * nb);
}

// ── Types shared with recognitions.ts ────────────────────────────────────────

export interface FaceCandidate {
  employeeId: number;
  descriptor: number[];
}

export interface FaceMatch {
  employeeId: number;
  distance: number; // kept for API compatibility — value is 1 - similarity
  confidence: number; // 0–100
}

/**
 * Compares a query embedding against all enrolled candidate descriptors
 * and returns the best match above FACE_MATCH_THRESHOLD, or null if none.
 *
 * Note: `distance` in the returned object is (1 - similarity) so that
 * existing callers that expect "lower = better" continue to work correctly.
 */
export function matchDescriptor(
  descriptor: number[],
  candidates: FaceCandidate[],
): FaceMatch | null {
  let best: FaceMatch | null = null;

  for (const candidate of candidates) {
    const sim = cosineSimilarity(descriptor, candidate.descriptor);
    if (sim < FACE_MATCH_THRESHOLD) continue;

    const distance = 1 - sim;
    if (!best || distance < best.distance) {
      best = {
        employeeId: candidate.employeeId,
        distance,
        confidence: Math.min(100, Math.max(0, (sim / FACE_MATCH_THRESHOLD) * 100)),
      };
    }
  }

  return best;
}
