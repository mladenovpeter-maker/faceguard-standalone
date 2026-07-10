import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedSystemUsers } from "./lib/seed-users";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const app: Express = express();

// The app runs behind Replit's reverse proxy, which terminates TLS and
// forwards over plain HTTP internally. Without this, Express (and
// express-session's `secure` cookie option) never sees the request as
// HTTPS, so the session cookie is silently never set.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ── Sessions (in-memory store — resets on server restart) ── */
app.use(
  session({
    name: "faceguard.sid",
    secret: process.env["SESSION_SECRET"] ?? "faceguard-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // The app is served through Replit's HTTPS proxy and can be embedded
      // in a cross-origin iframe (e.g. the Canvas preview), so the session
      // cookie must be SameSite=None + Secure or browsers will silently
      // drop it on every request, causing spurious 401s.
      secure: true,
      sameSite: "none",
      // Browsers increasingly block third-party cookies outright, even
      // with SameSite=None + Secure, when the app is loaded inside a
      // cross-origin iframe (e.g. Canvas preview). CHIPS (partitioned
      // cookies) is the modern workaround: it scopes the cookie to the
      // embedding top-level site instead of being blocked entirely.
      partitioned: true,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
    proxy: true,
  })
);

/* ── Auth guard: protect everything under /api except health + auth ── */
const PUBLIC_PATHS = ["/api/healthz", "/api/auth/login", "/api/auth/me"];

app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  const fullPath = "/api" + req.path;
  if (PUBLIC_PATHS.includes(fullPath) || fullPath.startsWith("/api/uploads")) {
    next();
    return;
  }
  if (!req.session?.userId) {
    res.status(401).json({ error: "Необходим е вход в системата" });
    return;
  }
  next();
});

/* ── Serve uploaded photos ── */
app.use("/api/uploads", express.static(path.resolve(workspaceRoot, "artifacts/api-server/uploads")));

app.use("/api", router);

/* ── Seed default users on startup ── */
seedSystemUsers().catch((err) => logger.error({ err }, "Failed to seed system users"));

export default app;
