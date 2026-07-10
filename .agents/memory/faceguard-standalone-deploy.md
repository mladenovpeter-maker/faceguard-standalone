---
name: FaceGuard standalone self-hosted deploy
description: How the faceguard-standalone repo is deployed on the user's home server and exposed externally.
---

The `faceguard-standalone` repo (separate from this workspace's `artifacts/face-guard`) is deployed via `docker compose` on the user's home server, against real RTSP/HTTP IP cameras on their LAN. It has no `lib/api-spec`/openapi — API types in `lib/api-zod` and `lib/api-client-react` are hand-edited generated files, not produced by orval codegen. Any API contract change must be manually mirrored across both, then rebuilt with `pnpm run typecheck:libs` so the composite lib's `dist/*.d.ts` is regenerated (client typecheck resolves against those declaration files, not `src`, since the lib is `composite: true` + `emitDeclarationOnly`).

**Why:** stale `dist/*.d.ts` after hand-editing generated sources is a common trap — the client typecheck error looks like a missing field even when the source type was already fixed.

**External access:** exposed at a subdomain on the user's own Cloudflare-managed domain via a `cloudflared` tunnel service (added back into `docker-compose.yml`, reading `CLOUDFLARE_TUNNEL_TOKEN` from `.env`). The tunnel's public hostname routes to `http://face-guard:80` (the nginx container that serves the built frontend and reverse-proxies `/api` to `api-server:8080`), so only one route is needed — no separate route for the API. Cloudflare Tunnel's public-hostname routing must be configured manually in the Cloudflare Zero Trust dashboard (not something the agent can do — the agent can only edit the docker-compose service and `.env.example` placeholder).

**How to apply:** if the user reports a broken deploy from outside their LAN, first check the tunnel is running (`cloudflared` container up, correct `CLOUDFLARE_TUNNEL_TOKEN` in their `.env`) and that the Cloudflare dashboard's public hostname route points at `http://face-guard:80` before investigating app code.
