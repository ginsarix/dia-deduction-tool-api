import { integer, numeric, pgTable, timestamp } from "drizzle-orm/pg-core";

export const hourDefinitionTable = pgTable("hour_definition", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  multiplier: numeric({ precision: 3, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$onUpdate(() => new Date())
    .notNull(),
});
