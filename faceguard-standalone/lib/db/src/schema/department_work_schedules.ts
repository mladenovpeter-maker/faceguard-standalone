import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";

export const departmentWorkSchedulesTable = pgTable("department_work_schedules", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departmentsTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 1=Monday … 7=Sunday (ISO)
  startTime: text("start_time").notNull(),     // "08:00"
  endTime: text("end_time").notNull(),          // "17:00"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.departmentId, t.dayOfWeek)]);

export const insertDepartmentWorkScheduleSchema = createInsertSchema(departmentWorkSchedulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDepartmentWorkSchedule = z.infer<typeof insertDepartmentWorkScheduleSchema>;
export type DepartmentWorkSchedule = typeof departmentWorkSchedulesTable.$inferSelect;
