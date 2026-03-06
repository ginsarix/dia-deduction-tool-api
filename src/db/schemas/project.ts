import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { connectionTable } from "./connection.js";

export const projectTable = pgTable("project", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: text().notNull(),
  number: integer(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  connectionId: integer("connection_id")
    .references(() => connectionTable.id, { onDelete: "restrict" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$onUpdate(() => new Date())
    .notNull(),
});
