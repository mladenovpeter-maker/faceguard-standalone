import { pgTable, serial, timestamp, integer, text, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { camerasTable } from "./cameras";
import { employeesTable } from "./employees";

export const recognitionEventsTable = pgTable("recognition_events", {
  id: serial("id").primaryKey(),
  cameraId: integer("camera_id").notNull().references(() => camerasTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  status: text("status").notNull().default("unknown"),
  confidence: real("confidence").notNull().default(0),
  snapshotUrl: text("snapshot_url"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecognitionEventSchema = createInsertSchema(recognitionEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRecognitionEvent = z.infer<typeof insertRecognitionEventSchema>;
export type RecognitionEvent = typeof recognitionEventsTable.$inferSelect;
