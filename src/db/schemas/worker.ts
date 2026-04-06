import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { connectionTable } from "./connection.js";

export const workerTable = pgTable(
  "worker",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    diaKey: text("dia_key").notNull(),
    tc: varchar({ length: 11 }).unique().notNull(),
    name: text().notNull(),
    department: text().notNull(),
    branch: text().notNull(),
    mission: text(),
    connectionId: integer("connection_id")
      .notNull()
      .references(() => connectionTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique().on(t.diaKey, t.connectionId), // unique per connection
  ],
);
