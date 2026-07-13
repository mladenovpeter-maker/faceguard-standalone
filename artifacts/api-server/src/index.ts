import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { seedSystemUsers } from "./lib/seed-users";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const migrationsFolder = process.env["NODE_ENV"] === "production"
  ? "/app/drizzle"
  : path.resolve(__dirname, "../../../lib/db/drizzle");

async function start() {
  logger.info({ migrationsFolder }, "Running database migrations");
  await migrate(db, { migrationsFolder });
  logger.info("Migrations complete");

  await seedSystemUsers();
  logger.info("Seed complete");

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  pool.end();
  process.exit(1);
});
