import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, systemUsersTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_USERS = [
  { username: "admin",    password: "Volareto78", role: "admin",    displayName: "Администратор" },
  { username: "operator", password: "OpeR@t9",    role: "operator", displayName: "Оператор" },
];

export async function seedSystemUsers() {
  for (const u of DEFAULT_USERS) {
    const [existing] = await db
      .select({ id: systemUsersTable.id })
      .from(systemUsersTable)
      .where(eq(systemUsersTable.username, u.username));

    if (!existing) {
      const hash = await bcrypt.hash(u.password, 12);
      await db.insert(systemUsersTable).values({
        username: u.username,
        passwordHash: hash,
        role: u.role,
        displayName: u.displayName,
      });
      logger.info({ username: u.username }, "Seeded default system user");
    }
  }
}
