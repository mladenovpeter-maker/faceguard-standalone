import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";

export const zoneWorkSchedulesTable = pgTable("zone_work_schedules", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 1=Monday … 7=Sunday (ISO)
  startTime: text("start_time").notNull(),     // "08:00"
  endTime: text("end_time").notNull(),          // "17:00"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.zoneId, t.dayOfWeek)]);

export const insertZoneWorkScheduleSchema = createInsertSchema(zoneWorkSchedulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertZoneWorkSchedule = z.infer<typeof insertZoneWorkScheduleSchema>;
export type ZoneWorkSchedule = typeof zoneWorkSchedulesTable.$inferSelect;
