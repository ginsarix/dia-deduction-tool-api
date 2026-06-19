import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const projectTable = pgTable("project", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  title: text().notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  active: boolean().notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
