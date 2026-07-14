"""
FaceGuard AI microservice — InsightFace (ArcFace / buffalo_l).

Exposes a minimal HTTP API so the Node.js API server can call it without
touching Python or ONNX directly.

Endpoints
---------
GET  /health          liveness check
POST /analyze         detect all faces in an image; return ArcFace 512-dim embeddings
"""

import io
import os
import sys
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Config from environment
# ---------------------------------------------------------------------------
DET_SIZE   = int(os.environ.get("DET_SIZE", 640))
MIN_SCORE  = float(os.environ.get("MIN_FACE_SCORE", 0.5))

# ---------------------------------------------------------------------------
# Model — loaded once at startup
# ---------------------------------------------------------------------------
face_analyzer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global face_analyzer
    print(f"[face-ai] Loading buffalo_l model (det_size={DET_SIZE}×{DET_SIZE}) …", flush=True)
    from insightface.app import FaceAnalysis
    face_analyzer = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_analyzer.prepare(ctx_id=0, det_size=(DET_SIZE, DET_SIZE))
    print("[face-ai] InsightFace ready.", flush=True)
    yield
    # shutdown — nothing to clean up

app = FastAPI(title="FaceGuard AI", version="1.0.0", lifespan=lifespan)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "model": "buffalo_l", "det_size": DET_SIZE}


@app.post("/analyze")
async def analyze(image: bytes = File(...)):
    """
    Accept raw JPEG/PNG/WebP image bytes.
    Returns every detected face that passes MIN_FACE_SCORE.

    Response body:
    {
      "faces": [
        {
          "embedding": [512 floats],   // ArcFace L2-normalised embedding
          "score":     0.98,           // RetinaFace detection confidence
          "bbox":      [x1, y1, x2, y2]
        },
        …
      ]
    }
    """
    nparr = np.frombuffer(image, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image — send raw JPEG/PNG bytes")

    faces = face_analyzer.get(img)

    result = []
    for face in faces:
        score = float(face.det_score)
        if score < MIN_SCORE:
            print(f"[face-ai] skip: score={score:.3f} < min={MIN_SCORE}", flush=True)
            continue
        result.append({
            "embedding": face.embedding.tolist(),
            "score":     score,
            "bbox":      [float(v) for v in face.bbox],
        })

    print(
        f"[face-ai] analyze: {len(faces)} raw detections → {len(result)} passed "
        f"(min_score={MIN_SCORE}, img={img.shape[1]}×{img.shape[0]})",
        flush=True,
    )
    return {"faces": result}
