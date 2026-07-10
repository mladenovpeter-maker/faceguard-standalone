# FaceGuard — Self-Hosted (Home Server + Real IP Cameras)

Standalone version of FaceGuard (face recognition access & attendance app):
API + PostgreSQL database + internal AI face recognition + web UI, packaged
to run on your own hardware with Docker, against your real RTSP/HTTP IP
cameras. This repo is self-contained — it does not depend on Replit at
runtime.

## What you get

- `postgres` — the database.
- `api-server` — the Express API + internal AI face recognition.
- `camera-worker` — connects to your IP camera(s) (RTSP or HTTP snapshot
  URLs), grabs a frame every few seconds, and submits it to the recognition
  pipeline like a real camera integration would.
- `face-guard` — the web UI, served by nginx, which also proxies `/api/*`
  to the API server.

## Prerequisites

- Docker + Docker Compose installed on the home server.
- Your IP camera(s)' RTSP or HTTP snapshot URL, and their username/password
  if they require auth.

## 1. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:
- `POSTGRES_PASSWORD` — pick any password for the local database.
- `CAMERA_WORKER_USERNAME` / `CAMERA_WORKER_PASSWORD` — an existing FaceGuard
  login the worker uses to call the API. The app seeds two accounts on first
  boot: `admin` / `Volareto78` and `operator` / `OpeR@t9`. **Change these
  passwords from the admin UI before exposing this to your home network.**

## 2. Start the stack

From the repo root:

```bash
docker compose --env-file .env up --build
```

This builds and starts all four services. First boot takes a few minutes
(installs dependencies, builds the frontend, downloads the face-recognition
models bundled in the repo).

## 3. Create the database schema

The database starts empty. Push the schema once the `postgres` container is
healthy:

```bash
# From your host machine, with Node + pnpm installed, against the
# port published by docker-compose (localhost:5432):
DATABASE_URL=postgres://faceguard:<your-POSTGRES_PASSWORD>@localhost:5432/faceguard \
  pnpm --filter @workspace/db run push

# OR, without installing anything locally, run it inside the api-server
# container (which already has pnpm + the db package) against the
# in-network postgres host:
docker compose exec api-server sh -c \
  "DATABASE_URL=postgres://faceguard:<your-POSTGRES_PASSWORD>@postgres:5432/faceguard pnpm --filter @workspace/db run push"
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
  `server/src/worker/camera-ingest.ts` if so), or the camera isn't reachable
  from the Docker host's network (bridge networking may need
  `network_mode: host` on Linux if your camera is on the same LAN segment).
- **Worker logs show "login failed"**: double-check
  `CAMERA_WORKER_USERNAME`/`CAMERA_WORKER_PASSWORD` in `.env` match a real
  FaceGuard account.
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

## Repo layout

```
server/     Express API + AI face recognition + camera-ingest worker
client/     React + Vite web UI
lib/db/            Drizzle ORM schema
lib/api-zod/       Shared Zod schemas
lib/api-client-react/  Generated API hooks used by the client
Dockerfile.api-server  Builds server + camera-worker image
Dockerfile.face-guard  Builds the web UI image (nginx)
docker-compose.yml     Orchestrates postgres + api-server + camera-worker + face-guard
```
