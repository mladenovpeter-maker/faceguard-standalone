import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, systemUsersTable } from "@workspace/db";
import { createToken, deleteToken, extractBearerToken } from "../lib/auth-tokens";

const router: IRouter = Router();

/* GET /api/auth/me — returns the logged-in user or 401 */
router.get("/auth/me", (req, res): void => {
  if (!req.authUser) {
    res.status(401).json({ error: "Не сте влезли в системата" });
    return;
  }
  res.json({
    id: req.authUser.userId,
    username: req.authUser.username,
    role: req.authUser.role,
    displayName: req.authUser.displayName,
  });
});

/* POST /api/auth/login */
router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    res.status(400).json({ error: "Невалидни данни" });
    return;
  }

  const [user] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.username, String(username).toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Грешно потребителско име или парола" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Грешно потребителско име или парола" });
    return;
  }

  const token = createToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  });

  res.json({
    token,
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  });
});

/* POST /api/auth/logout */
router.post("/auth/logout", (req, res): void => {
  deleteToken(extractBearerToken(req.headers.authorization));
  res.json({ ok: true });
});

/* POST /api/auth/change-password */
router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.authUser) {
    res.status(401).json({ error: "Не сте влезли в системата" });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: "Паролата трябва да е поне 6 символа" });
    return;
  }

  const [user] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.id, req.authUser.userId));

  if (!user) {
    res.status(404).json({ error: "Потребителят не е намерен" });
    return;
  }

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Текущата парола е грешна" });
    return;
  }

  const newHash = await bcrypt.hash(String(newPassword), 12);
  await db
    .update(systemUsersTable)
    .set({ passwordHash: newHash })
    .where(eq(systemUsersTable.id, user.id));

  res.json({ ok: true });
});

export default router;
