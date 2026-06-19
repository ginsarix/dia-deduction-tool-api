import { integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { projectTable } from "./project.js";
import { workerTable } from "./worker.js";

export const projectWorkersTable = pgTable(
  "project_workers",
  {
    projectId: integer("project_id")
      .references(() => projectTable.id, { onDelete: "cascade" })
      .notNull(),
    workerId: integer("worker_id")
      .references(() => workerTable.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.workerId] })],
);
