import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

export const employeePhotosTable = pgTable("employee_photos", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  faceDescriptor: jsonb("face_descriptor").$type<number[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeePhotoSchema = createInsertSchema(employeePhotosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEmployeePhoto = z.infer<typeof insertEmployeePhotoSchema>;
export type EmployeePhoto = typeof employeePhotosTable.$inferSelect;
