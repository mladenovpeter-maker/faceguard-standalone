import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedSystemUsers } from "./lib/seed-users";
import { getTokenData, extractBearerToken } from "./lib/auth-tokens";

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const app: Express = express();

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

/* ── Auth: Bearer token in the Authorization header (in-memory store,
   resets on server restart). Deliberately NOT cookie-based: this app can
   be embedded cross-origin (e.g. the Canvas preview), and browsers
   increasingly block third-party cookies outright even with
   SameSite=None; Secure; Partitioned set correctly. A token sent
   explicitly by the client sidesteps cookie policy entirely. ── */
app.use((req: Request, _res: Response, next: NextFunction): void => {
  const token = extractBearerToken(req.headers.authorization);
  const data = getTokenData(token);
  if (data) req.authUser = data;
  next();
});

/* ── Auth guard: protect everything under /api except health + auth ── */
const PUBLIC_PATHS = ["/api/healthz", "/api/auth/login", "/api/auth/me"];

app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  const fullPath = "/api" + req.path;
  if (PUBLIC_PATHS.includes(fullPath) || fullPath.startsWith("/api/uploads")) {
    next();
    return;
  }
  if (!req.authUser) {
    res.status(401).json({ error: "Необходим е вход в системата" });
    return;
  }
  next();
});

/* ── Role guard: operators (read-only) may only issue GET requests,
   except for managing their own session/password. Admins have full access. ── */
const OPERATOR_ALLOWED_MUTATIONS = ["/api/auth/logout", "/api/auth/change-password"];

app.use("/api", (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === "GET" || !req.authUser) {
    next();
    return;
  }
  const fullPath = "/api" + req.path;
  if (req.authUser.role === "admin" || OPERATOR_ALLOWED_MUTATIONS.includes(fullPath)) {
    next();
    return;
  }
  res.status(403).json({ error: "Нямате права за това действие" });
});

/* ── Serve uploaded photos ── */
app.use("/api/uploads", express.static(path.resolve(workspaceRoot, "artifacts/api-server/uploads")));

app.use("/api", router);

/* ── Seed default users on startup ── */
seedSystemUsers().catch((err) => logger.error({ err }, "Failed to seed system users"));

export default app;
