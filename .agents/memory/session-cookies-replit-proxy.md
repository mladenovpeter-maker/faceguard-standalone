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

Even with `secure: true; sameSite: "none"` set correctly, some browsers still
block the cookie outright when it's third-party (set from an iframe whose
origin differs from the top-level page, as in the Canvas preview) — this
shows up as login succeeding (200) but the very next request 401'ing,
intermittently, with no code change. `cookie.partitioned: true` (CHIPS)
did NOT fully resolve it either in the Canvas iframe context.

**Final fix that actually worked:** abandon cookies entirely for
cross-origin-embeddable apps and use a Bearer token instead — return an
opaque token from `/api/auth/login`, store it client-side (`localStorage`),
and attach it as `Authorization: Bearer <token>` on every request via a
token-getter hook (see `lib/api-client-react/src/custom-fetch.ts`'s
`setAuthTokenGetter`). This sidesteps all browser cookie policy (SameSite,
third-party blocking, partitioning) since the token is sent explicitly by
JS, not attached implicitly by the browser. Preferred default for any
Replit web app whose preview may be embedded in an iframe (Canvas, etc.).
