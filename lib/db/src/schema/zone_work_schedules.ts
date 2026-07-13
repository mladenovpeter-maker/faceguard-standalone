import { pgTable, serial, integer, text, timestamp, unique, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";
import { scheduleBreakSchema, type ScheduleBreak } from "./department_work_schedules";

export const zoneWorkSchedulesTable = pgTable("zone_work_schedules", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 1=Monday … 7=Sunday (ISO)
  startTime: text("start_time").notNull(),     // "08:00"
  endTime: text("end_time").notNull(),          // "17:00"
  breaks: json("breaks").$type<ScheduleBreak[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.zoneId, t.dayOfWeek)]);

export const insertZoneWorkScheduleSchema = createInsertSchema(zoneWorkSchedulesTable).omit({
  id: true,
  createdAt: true,
}).extend({
  breaks: z.array(scheduleBreakSchema).optional().default([]),
});
export type InsertZoneWorkSchedule = z.infer<typeof insertZoneWorkScheduleSchema>;
export type ZoneWorkSchedule = typeof zoneWorkSchedulesTable.$inferSelect;
