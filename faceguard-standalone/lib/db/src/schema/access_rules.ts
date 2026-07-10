import { pgTable, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { zonesTable } from "./zones";

export const accessRulesTable = pgTable("access_rules", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  zoneId: integer("zone_id").notNull().references(() => zonesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.employeeId, t.zoneId)]);

export const insertAccessRuleSchema = createInsertSchema(accessRulesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAccessRule = z.infer<typeof insertAccessRuleSchema>;
export type AccessRule = typeof accessRulesTable.$inferSelect;
