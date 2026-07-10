---
name: Session cookies behind Replit's reverse proxy
description: express-session cookies with secure:true/sameSite:none require app.set("trust proxy", 1), or the cookie is silently never issued.
---

Replit's environment terminates TLS at a reverse proxy and forwards requests to
the app over plain HTTP internally. If a server sets a session cookie with
`secure: true` (required for `sameSite: "none"`, which is itself required when
the app can be embedded in a cross-origin iframe, e.g. the Canvas preview),
Express must be told to trust the proxy's `X-Forwarded-Proto` header via
`app.set("trust proxy", 1)`. Without it, `req.secure` is always false, so
express-session never emits a `Set-Cookie` header at all — no error, just no
cookie, which manifests as every authenticated request returning 401 even
right after a successful login.

**Why:** Debugged a case where login returned 200 but every subsequent API
call 401'd. `curl -D -` against the login endpoint showed zero `Set-Cookie`
header. Adding `X-Forwarded-Proto: https` manually to the curl request caused
the cookie to appear — proving the missing trust-proxy config was the root
cause, not an auth/session-store bug.

**How to apply:** Any Express app on Replit using cookie-based sessions
(express-session, cookie-session, etc.) with `cookie.secure: true` must call
`app.set("trust proxy", 1)` before the session middleware is registered. Also
use `sameSite: "none"` (not the default `"lax"`) if the app might be viewed
inside an iframe (Canvas preview, embeds) — same-site-only cookies get
dropped in third-party iframe contexts even when secure/trust-proxy are
correct.
