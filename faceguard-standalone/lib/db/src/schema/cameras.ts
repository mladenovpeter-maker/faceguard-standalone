import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";

export const camerasTable = pgTable("cameras", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("other"),
  protocol: text("protocol").notNull().default("rtsp"),
  host: text("host").notNull(),
  port: integer("port"),
  username: text("username"),
  passwordHash: text("password_hash"),
  streamPath: text("stream_path"),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id),
  status: text("status").notNull().default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCameraSchema = createInsertSchema(camerasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCamera = z.infer<typeof insertCameraSchema>;
export type Camera = typeof camerasTable.$inferSelect;
