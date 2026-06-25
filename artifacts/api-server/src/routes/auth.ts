import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, systemUsersTable } from "@workspace/db";

const router: IRouter = Router();

/* GET /api/auth/me — returns the logged-in user or 401 */
router.get("/auth/me", (req, res): void => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Не сте влезли в системата" });
    return;
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    displayName: req.session.displayName,
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

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  req.session.displayName = user.displayName;

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  });
});

/* POST /api/auth/logout */
router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("faceguard.sid");
    res.json({ ok: true });
  });
});

/* POST /api/auth/change-password */
router.post("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
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
    .where(eq(systemUsersTable.id, req.session.userId));

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
