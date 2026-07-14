# FaceGuard — Self-Hosted Setup (Home Server + Real IP Cameras)

This folder packages the whole FaceGuard app (API + database + internal AI
face recognition + web UI) to run on your own hardware at home, outside of
Replit, so you can test it against your real RTSP/HTTP IP cameras.

It builds directly from this repository — there's no separate source copy to
keep in sync. To put this on GitHub as its own standalone repo, just push
this whole repository (it has no Replit-only runtime dependency; the only
Replit-specific things are the `.replit-artifact/artifact.toml` files, which
your home server never needs).

## What you get

- `postgres` — the database.
- `face-ai` — **InsightFace AI microservice**: Python + FastAPI service that
  runs the `buffalo_l` model pack (RetinaFace detector + ArcFace 512-dim
  embeddings). Dramatically more accurate than the old face-api.js/TF.js
  pipeline, especially for overhead/angled cameras. The Node.js API calls it
  over HTTP — no Python code touches the rest of the stack.
- `api-server` — the Express API, which calls `face-ai` for all recognition.
- `camera-worker` — a small process that connects to your IP camera(s)
  (RTSP or HTTP snapshot URLs), grabs a frame every few seconds, and submits
  it to the recognition pipeline. Replit can't reach your home cameras, so
  this worker only makes sense running on your own network.
- `face-guard` — the web UI, served by nginx, which also proxies `/api/*`
  to the API server (mirrors how Replit's shared proxy routes requests).

## ⚠️ After the first deploy — re-enroll employee faces

The InsightFace ArcFace model produces 512-dimensional embeddings.  The old
face-api.js model produced 128-dimensional ones.  **They are incompatible.**
After the stack is up and all employees' photo files are intact, call:

```bash
curl -X POST http://localhost:8080/api/employees/reprocess-all \
  -H "Authorization: Bearer <your-token>"
```

This reprocesses every enrolled photo through the new model and updates the
stored descriptors.  Walk in front of the camera afterwards — recognition
should be noticeably better.

### Recognition threshold

The default cosine-similarity threshold is **0.40** (range 0–1, higher =
stricter). Tune it in `selfhost/.env` if needed:

```env
FACE_MATCH_THRESHOLD=0.40   # default — good for frontal + moderate angles
# FACE_MATCH_THRESHOLD=0.35 # relaxed — better for ceiling cameras
# FACE_MATCH_THRESHOLD=0.45 # strict  — fewer false positives
```

## Prerequisites

- Docker + Docker Compose installed on the home server.
- Your IP camera(s)' RTSP or HTTP snapshot URL, and their username/password
  if they require auth.

## 1. Configure environment variables

```bash
cp selfhost/.env.example selfhost/.env
```

Edit `selfhost/.env`:
- `POSTGRES_PASSWORD` — pick any password for the local database.
- `CAMERA_WORKER_USERNAME` / `CAMERA_WORKER_PASSWORD` — an existing FaceGuard
  login the worker uses to call the API. The app seeds two accounts on first
  boot: `admin` / `Volareto78` and `operator` / `OpeR@t9`. **Change these
  passwords from the admin UI before exposing this to your home network.**

## 2. Start the stack

From the repo root:

```bash
docker compose -f selfhost/docker-compose.yml --env-file selfhost/.env up --build
```

This builds and starts all five services. **First boot takes longer than
usual** (5–10 min) because the `face-ai` container downloads the InsightFace
`buffalo_l` model weights (~300 MB) on its first startup. Subsequent starts
are instant — the weights are stored in the `faceguard-models` Docker volume.

## 3. Create the database schema

The database starts empty. Push the schema once the `postgres` container is
healthy (from your host machine, with Node + pnpm installed, or from inside
the `api-server` container):

```bash
DATABASE_URL=postgres://faceguard:<your-POSTGRES_PASSWORD>@localhost:5432/faceguard \
  pnpm --filter @workspace/db run push
```

## 4. Open the app

- Web UI: http://localhost:8081 (or your server's LAN IP, e.g.
  `http://192.168.1.50:8081`)
- Log in with `admin` / `Volareto78` (change this password immediately).

## 5. Add your camera(s)

In the admin UI, go to **Камери** (Cameras) and add each IP camera with:
- **Protocol**: `rtsp` for an RTSP stream URL, or `http`/`https` if your
  camera exposes a plain HTTP snapshot URL (e.g. `.../snapshot.jpg`).
- **Host** / **Port**: the camera's IP and port (RTSP is usually `554`).
- **Stream path**: the path portion of your camera's URL, e.g.
  `/Streaming/Channels/101` (varies by camera brand — check its manual or
  the ONVIF/RTSP URL your camera app already uses).
- **Username** / **Password**: if your camera requires auth in the stream
  URL.

The `camera-worker` container reads this config directly from the database
and reconstructs the full stream URL
(`<protocol>://<user>:<pass>@<host>:<port><streamPath>`). It polls every
camera on the interval set by `CAMERA_WORKER_POLL_INTERVAL_MS` (default 5s),
grabs one frame per camera each cycle (via `ffmpeg` for RTSP, or a plain
HTTP GET for snapshot URLs), and submits it for recognition. Walk in front
of a camera and you should see a new event appear on the dashboard /
recognition log within one polling interval — recognized if you're enrolled
with photos, otherwise logged as `unknown`.

## Troubleshooting

- **Worker logs show "Failed to capture camera frame"**: verify the stream
  URL works outside Docker first, e.g. `ffplay rtsp://user:pass@<ip>:554/<path>`.
  Common issues: wrong stream path, camera requires `rtsp_transport udp`
  instead of `tcp` (edit `grabRtspFrame` in
  `artifacts/api-server/src/worker/camera-ingest.ts` if so), or the camera
  isn't reachable from the Docker host's network (bridge networking may need
  `network_mode: host` on Linux if your camera is on the same LAN segment).
- **Worker logs show "login failed"**: double-check
  `CAMERA_WORKER_USERNAME`/`CAMERA_WORKER_PASSWORD` in `selfhost/.env` match
  a real FaceGuard account.
- **No recognitions ever show "recognized"**: make sure the employee has at
  least one enrolled photo (see the employee detail page's "Снимки за
  разпознаване" gallery) — the internal AI can only match faces it has seen
  before.

## Notes / limitations

- This worker grabs one still frame per camera per polling interval — it's
  built for testing correctness of the recognition pipeline against real
  cameras, not for continuous video analytics or millisecond-level access
  control. Tune `CAMERA_WORKER_POLL_INTERVAL_MS` down for faster response if
  your hardware can keep up.
- Auth tokens are in-memory on the API server and reset on restart — the
  worker automatically re-logs in if a request comes back `401`.
- To push this to your own GitHub repo: `git init`, commit, add your GitHub
  remote, and push as usual — nothing in this folder or the app code
  requires Replit at runtime.
