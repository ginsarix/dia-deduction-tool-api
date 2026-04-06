import {
  integer,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core";
import { hourDefinitionTable } from "./hour-definition.js";
import { projectTable } from "./project.js";
import { workerTable } from "./worker.js";

export const projectWorkersTable = pgTable(
  "project_workers",
  {
    projectId: integer("project_id")
      .references(() => projectTable.id, {
        onDelete: "cascade",
      })
      .notNull(),
    workerId: integer("worker_id")
      .references(() => workerTable.id, {
        onDelete: "cascade",
      })
      .notNull(),
    hourDefinitionId: integer("hour_definition_id")
      .references(() => hourDefinitionTable.id, { onDelete: "restrict" })
      .notNull(),

    // -- rates

    // ARGE MERKEZİNDE ÇALIŞILAN GÜN SAYISI
    argeCenterWorkDays: integer("arge_center_work_days").default(0),

    // DİĞER FAALİYETLERDE ÇALIŞMA GÜN SAYISI
    otherActivitiesWorkDays: integer("other_activities_work_days").default(0),

    // TOPLAM ÇALIŞMA GÜN SAYISI
    totalWorkDays: integer("total_work_days").default(0),

    // BRÜT TEMEL ÜCRET
    grossBaseSalary: numeric("gross_base_salary", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).default(0),

    // FAZLA MESAİ - EK ÜCRET
    overtimeAdditionalPay: numeric("overtime_additional_pay", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).default(0),

    // GELİR VERGİSİ TUTARI
    incomeTaxAmount: numeric("income_tax_amount", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).default(0),

    agi: numeric("agi", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).default(0),

    // ARGE İSTİSNA ORANI
    argeExemptionRate: numeric("argeExemptionRate", {
      precision: 6,
      scale: 4,
      mode: "number",
    }).default(0),

    monthlyUpperLimit: numeric("monthly_upper_limit", {
      precision: 15,
      scale: 2,
      mode: "number",
    }).default(0),

    // -- rates

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.workerId] })],
);
