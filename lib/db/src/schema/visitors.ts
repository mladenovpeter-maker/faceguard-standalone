import { pgTable, text, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visitorTypeEnum = pgEnum("visitor_type", ["supplier", "carrier", "client", "guest", "other"]);

export const visitorsTable = pgTable("visitors", {
  id:         serial("id").primaryKey(),
  name:       text("name").notNull(),
  company:    text("company"),
  type:       visitorTypeEnum("type").notNull().default("guest"),
  phone:      text("phone"),
  email:      text("email"),
  photoUrl:   text("photo_url"),
  cardNumber: text("card_number"),
  notes:      text("notes"),
  active:     boolean("active").notNull().default(true),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const visitorVisitsTable = pgTable("visitor_visits", {
  id:        serial("id").primaryKey(),
  visitorId: integer("visitor_id").notNull().references(() => visitorsTable.id, { onDelete: "cascade" }),
  purpose:   text("purpose"),
  hostName:  text("host_name"),
  checkIn:   timestamp("check_in", { withTimezone: true }).notNull().defaultNow(),
  checkOut:  timestamp("check_out", { withTimezone: true }),
  notes:     text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVisitorSchema = createInsertSchema(visitorsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertVisitorVisitSchema = createInsertSchema(visitorVisitsTable).omit({
  id: true, createdAt: true,
});
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor      = typeof visitorsTable.$inferSelect;
export type InsertVisitorVisit = z.infer<typeof insertVisitorVisitSchema>;
export type VisitorVisit       = typeof visitorVisitsTable.$inferSelect;
