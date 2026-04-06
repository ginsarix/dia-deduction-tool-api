import {
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
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

  // -- rates

  // -- 5510 SAYILI KANUN KAPSAMINDA MATRAH VE %5'LİK İNDİRİM

  // SGK İşçi Payı
  sgk5510EmployeeShareRate: numeric("sgk5510_employee_share_rate", {
    precision: 6,
    scale: 4,
    mode: "number",
  }).default(0.14),

  // SGK İşçi İşsizlik Payı
  sgk5510EmployeeUnemploymentShareRate: numeric(
    "sgk5510_employee_unemployment_share_rate",
    { precision: 4, scale: 2, mode: "number" },
  ).default(0.01),

  // SGK İŞV PAYI
  sgk5510EmployerShareRate: numeric("sgk5510_employer_share_rate", {
    precision: 6,
    scale: 4,
    mode: "number",
  }).default(0.2175),

  // SGK İşveren İşsizlik Payı
  sgk5510EmployerUnemploymentShareRate: numeric(
    "sgk5510_employer_unemployment_share_rate",
    { precision: 4, scale: 2, mode: "number" },
  ).default(0.03),

  // -- 5510 SAYILI KANUN KAPSAMINDA MATRAH VE %5'LİK İNDİRİM

  // -- 5746 SAYILI KANUN KAPSAMINDA SGK İŞVEREN PAYI HESAPLAMA

  // SGK İŞV PAYI
  sgk5746EmployerShareRate: numeric("sgk5746_employer_share_rate", {
    precision: 6,
    scale: 4,
    mode: "number",
  }).default(0.2175),

  //  SGK İşveren İşsizlik Payı
  sgk5746EmployerUnemploymentShareRate: numeric(
    "sgk5746_employer_unemployment_share_rate",
    { precision: 4, scale: 2, mode: "number" },
  ).default(0.02),

  // -- 5746 SAYILI KANUN KAPSAMINDA SGK İŞVEREN PAYI HESAPLAMA

  // -- 5746 SAYILI KANUN KAPSAMINDA GELİR VERGİSİ STOPAJ HESAPLAMA

  // SGK İşçi Payı
  incomeTaxSgk5746EmployeeShareRate: numeric(
    "income_tax_sgk5746_employee_share_rate",
    { precision: 4, scale: 2, mode: "number" },
  ).default(0.14),

  // SGK İşçi İşsizlik Payı
  incomeTaxSgk5746EmployeeUnemploymentShareRate: numeric(
    "income_tax_sgk5746_employee_unemployment_share_rate",
    { precision: 4, scale: 2, mode: "number" },
  ).default(0.01),

  // -- 5746 SAYILI KANUN KAPSAMINDA GELİR VERGİSİ STOPAJ HESAPLAMA

  // -- rates

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$onUpdate(() => new Date())
    .notNull(),
});
