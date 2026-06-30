import { zValidator } from "@hono/zod-validator";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { db } from "../db/index.js";
import { connectionTable } from "../db/schemas/connection.js";
import { hourDefinitionTable } from "../db/schemas/hour-definition.js";
import { monthTable } from "../db/schemas/month.js";
import { monthWorkersTable } from "../db/schemas/month-workers.js";
import { projectTable } from "../db/schemas/project.js";
import { workerTable } from "../db/schemas/worker.js";
import { DiaClient } from "../services/dia.js";
import type { DiaWorkerTally } from "../types/dia-responses.js";
import { aesDecrypt } from "../utils/aes-256-gcm.js";
import { diaResponseIsSuccess } from "../utils/dia.js";
import { monthInsertSchema, monthUpdateSchema } from "../validations/schemas.js";

const app = new Hono();

app.get("/", async (c) => {
  const months = await db
    .select({
      month: monthTable,
      workerCount: count(monthWorkersTable.workerId),
    })
    .from(monthTable)
    .leftJoin(monthWorkersTable, eq(monthWorkersTable.monthId, monthTable.id))
    .groupBy(monthTable.id);

  return c.json({ message: "Aylar başarıyla getirildi", months }, 200);
});

app.get(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [month] = await db
      .select()
      .from(monthTable)
      .where(eq(monthTable.id, id));

    if (!month) return c.json({ message: "Ay bulunamadı" }, 404);

    return c.json({ message: "Ay başarıyla getirildi", month }, 200);
  },
);

app.post(
  "/",
  zValidator("json", monthInsertSchema),
  async (c) => {
    const monthInput = c.req.valid("json");

    const [createdMonth] = await db
      .insert(monthTable)
      .values(monthInput)
      .returning();

    c.header("Location", `/months/${createdMonth.id}`);
    return c.json({ message: "Ay başarıyla oluşturuldu", createdMonth }, 201);
  },
);

app.patch(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator("json", monthUpdateSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const [updatedMonth] = await db
      .update(monthTable)
      .set(input)
      .where(eq(monthTable.id, id))
      .returning();

    if (!updatedMonth) {
      return c.json({ message: "Ay bulunamadı" }, 404);
    }

    return c.json({ message: "Ay başarıyla güncellendi", updatedMonth }, 200);
  },
);

app.delete(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");

    const deleteResult = await db
      .delete(monthTable)
      .where(eq(monthTable.id, id));

    if (!deleteResult.rowCount) {
      return c.json({ message: "Ay bulunamadı" }, 404);
    }

    return c.json({ message: "Ay silindi" }, 200);
  },
);

app.get(
  "/:id/workers",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");

    const workers = await db
      .select({
        workerId: workerTable.id,
        workerName: workerTable.name,
        diaKey: workerTable.diaKey,
        hourDefinitionId: hourDefinitionTable.id,
        multiplier: hourDefinitionTable.multiplier,
        projectId: monthWorkersTable.projectId,
        projectTitle: projectTable.title,
      })
      .from(monthWorkersTable)
      .innerJoin(workerTable, eq(monthWorkersTable.workerId, workerTable.id))
      .innerJoin(
        hourDefinitionTable,
        eq(monthWorkersTable.hourDefinitionId, hourDefinitionTable.id),
      )
      .innerJoin(projectTable, eq(monthWorkersTable.projectId, projectTable.id))
      .where(eq(monthWorkersTable.monthId, id));

    return c.json({ message: "Personeller başarıyla getirildi", workers }, 200);
  },
);

app.patch(
  "/:id/workers",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator(
    "json",
    z.array(
      z.object({
        projectId: z.number().int().positive(),
        workerId: z.number().int().positive(),
        hourDefinitionId: z.number().int().positive(),
      }),
    ),
  ),
  async (c) => {
    const { id: monthId } = c.req.valid("param");
    const input = c.req.valid("json");

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          projectId: monthWorkersTable.projectId,
          workerId: monthWorkersTable.workerId,
        })
        .from(monthWorkersTable)
        .where(eq(monthWorkersTable.monthId, monthId));

      const inputSet = new Set(
        input.map((a) => `${a.projectId}:${a.workerId}`),
      );
      const toDelete = existing.filter(
        (e) => !inputSet.has(`${e.projectId}:${e.workerId}`),
      );

      for (const row of toDelete) {
        await tx
          .delete(monthWorkersTable)
          .where(
            and(
              eq(monthWorkersTable.monthId, monthId),
              eq(monthWorkersTable.projectId, row.projectId),
              eq(monthWorkersTable.workerId, row.workerId),
            ),
          );
      }

      if (input.length > 0) {
        await tx
          .insert(monthWorkersTable)
          .values(input.map((a) => ({ ...a, monthId })))
          .onConflictDoUpdate({
            target: [
              monthWorkersTable.monthId,
              monthWorkersTable.projectId,
              monthWorkersTable.workerId,
            ],
            set: { hourDefinitionId: sql`excluded.hour_definition_id` },
          });
      }
    });

    return c.json({ message: "Personel atamaları güncellendi" }, 200);
  },
);

app.get(
  "/:id/rates",
  zValidator(
    "param",
    z.object({ id: z.coerce.number().int().positive() }),
  ),
  async (c) => {
    const { id: monthId } = c.req.valid("param");

    const assignmentsQuery = db
      .select({
        monthWorkers: {
          projectId: monthWorkersTable.projectId,
          argeCenterWorkDays: monthWorkersTable.argeCenterWorkDays,
          otherActivitiesWorkDays: monthWorkersTable.otherActivitiesWorkDays,
          totalWorkDays: monthWorkersTable.totalWorkDays,
          grossBaseSalary: monthWorkersTable.grossBaseSalary,
          overtimeAdditionalPay: monthWorkersTable.overtimeAdditionalPay,
          monthlyUpperLimit: monthWorkersTable.monthlyUpperLimit,
          incomeTaxAmount: monthWorkersTable.incomeTaxAmount,
          agi: monthWorkersTable.agi,
          argeExemptionRate: monthWorkersTable.argeExemptionRate,
        },
        hourDefinition: hourDefinitionTable,
        worker: workerTable,
        project: {
          id: projectTable.id,
          title: projectTable.title,
        },
      })
      .from(monthWorkersTable)
      .innerJoin(workerTable, eq(monthWorkersTable.workerId, workerTable.id))
      .innerJoin(
        hourDefinitionTable,
        eq(monthWorkersTable.hourDefinitionId, hourDefinitionTable.id),
      )
      .innerJoin(projectTable, eq(monthWorkersTable.projectId, projectTable.id))
      .where(eq(monthWorkersTable.monthId, monthId));

    const monthQuery = db
      .select({
        sgk5510EmployeeShareRate: monthTable.sgk5510EmployeeShareRate,
        sgk5510EmployeeUnemploymentShareRate:
          monthTable.sgk5510EmployeeUnemploymentShareRate,
        sgk5510EmployerShareRate: monthTable.sgk5510EmployerShareRate,
        sgk5510EmployerUnemploymentShareRate:
          monthTable.sgk5510EmployerUnemploymentShareRate,
        sgk5746EmployerShareRate: monthTable.sgk5746EmployerShareRate,
        sgk5746EmployerUnemploymentShareRate:
          monthTable.sgk5746EmployerUnemploymentShareRate,
        incomeTaxSgk5746EmployeeShareRate:
          monthTable.incomeTaxSgk5746EmployeeShareRate,
        incomeTaxSgk5746EmployeeUnemploymentShareRate:
          monthTable.incomeTaxSgk5746EmployeeUnemploymentShareRate,
      })
      .from(monthTable)
      .where(eq(monthTable.id, monthId));

    const [assignments, [month]] = await Promise.all([
      assignmentsQuery,
      monthQuery,
    ]);

    if (!month) {
      return c.json({ message: "Ay bulunamadı" }, 404);
    }

    return c.json(
      { message: "Oranlar başarıyla getirildi", rates: { workers: assignments, month } },
      200,
    );
  },
);

app.patch(
  "/:id/rates",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator(
    "json",
    z.object({
      month: z
        .object({
          sgk5510EmployeeShareRate: z.number().optional(),
          sgk5510EmployeeUnemploymentShareRate: z.number().optional(),
          sgk5510EmployerShareRate: z.number().optional(),
          sgk5510EmployerUnemploymentShareRate: z.number().optional(),
          sgk5746EmployerShareRate: z.number().optional(),
          sgk5746EmployerUnemploymentShareRate: z.number().optional(),
          incomeTaxSgk5746EmployeeShareRate: z.number().optional(),
          incomeTaxSgk5746EmployeeUnemploymentShareRate: z.number().optional(),
        })
        .optional(),
      workers: z
        .array(
          z.object({
            projectId: z.number().int().positive(),
            workerId: z.number().int().positive(),
            argeCenterWorkDays: z.number().int().optional(),
            otherActivitiesWorkDays: z.number().int().optional(),
            totalWorkDays: z.number().int().optional(),
            grossBaseSalary: z.number().optional(),
            overtimeAdditionalPay: z.number().optional(),
            monthlyUpperLimit: z.number().optional(),
            incomeTaxAmount: z.number().optional(),
            agi: z.number().optional(),
            argeExemptionRate: z.number().optional(),
          }),
        )
        .optional(),
    }),
  ),
  async (c) => {
    const { id: monthId } = c.req.valid("param");
    const { month: monthRates, workers: workerRates } = c.req.valid("json");

    const [existingMonth] = await db
      .select({ id: monthTable.id })
      .from(monthTable)
      .where(eq(monthTable.id, monthId));

    if (!existingMonth) {
      return c.json({ message: "Ay bulunamadı" }, 404);
    }

    await db.transaction(async (tx) => {
      if (monthRates && Object.keys(monthRates).length > 0) {
        await tx
          .update(monthTable)
          .set(monthRates)
          .where(eq(monthTable.id, monthId));
      }

      if (workerRates && workerRates.length > 0) {
        const rows = workerRates.map(
          ({ projectId, workerId, ...r }) =>
            sql`(
              ${projectId}::int,
              ${workerId}::int,
              ${r.argeCenterWorkDays ?? null}::int,
              ${r.otherActivitiesWorkDays ?? null}::int,
              ${r.totalWorkDays ?? null}::int,
              ${r.grossBaseSalary ?? null}::numeric,
              ${r.overtimeAdditionalPay ?? null}::numeric,
              ${r.monthlyUpperLimit ?? null}::numeric,
              ${r.incomeTaxAmount ?? null}::numeric,
              ${r.agi ?? null}::numeric,
              ${r.argeExemptionRate ?? null}::numeric
            )`,
        );

        await tx.execute(sql`
          UPDATE month_workers AS pw
          SET
            arge_center_work_days      = COALESCE(v.arge_center_work_days,      pw.arge_center_work_days),
            other_activities_work_days = COALESCE(v.other_activities_work_days, pw.other_activities_work_days),
            total_work_days            = COALESCE(v.total_work_days,            pw.total_work_days),
            gross_base_salary          = COALESCE(v.gross_base_salary,          pw.gross_base_salary),
            overtime_additional_pay    = COALESCE(v.overtime_additional_pay,    pw.overtime_additional_pay),
            monthly_upper_limit        = COALESCE(v.monthly_upper_limit,        pw.monthly_upper_limit),
            income_tax_amount          = COALESCE(v.income_tax_amount,          pw.income_tax_amount),
            agi                        = COALESCE(v.agi,                        pw.agi),
            "argeExemptionRate"        = COALESCE(v.arge_exemption_rate,        pw."argeExemptionRate")
          FROM (VALUES ${sql.join(rows, sql`, `)}) AS v(
            project_id,
            worker_id,
            arge_center_work_days,
            other_activities_work_days,
            total_work_days,
            gross_base_salary,
            overtime_additional_pay,
            monthly_upper_limit,
            income_tax_amount,
            agi,
            arge_exemption_rate
          )
          WHERE pw.month_id  = ${monthId}
            AND pw.project_id = v.project_id
            AND pw.worker_id  = v.worker_id
        `);
      }
    });

    return c.json({ message: "Oranlar başarıyla güncellendi" }, 200);
  },
);

app.post(
  "/:id/sync-rates",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id: monthId } = c.req.valid("param");

    const assignedWorkers = await db
      .select({
        workerId: workerTable.id,
        projectId: monthWorkersTable.projectId,
        diaKey: workerTable.diaKey,
        connectionId: workerTable.connectionId,
      })
      .from(monthWorkersTable)
      .innerJoin(workerTable, eq(monthWorkersTable.workerId, workerTable.id))
      .where(eq(monthWorkersTable.monthId, monthId));

    if (assignedWorkers.length === 0) {
      return c.json({ message: "Bu aya atanmış personel yok", updated: 0 }, 200);
    }

    const workersByConnection = new Map<number, typeof assignedWorkers>();
    for (const w of assignedWorkers) {
      if (!workersByConnection.has(w.connectionId)) workersByConnection.set(w.connectionId, []);
      workersByConnection.get(w.connectionId)!.push(w);
    }

    const connections = await db
      .select()
      .from(connectionTable)
      .where(inArray(connectionTable.id, [...workersByConnection.keys()]));

    const SELECTED_COLUMNS = [
      "_key_per_personel",
      "toplamsigortagun",
      "argefaaliyetgunsayisi",
      "aylikbrutkazanc",
      "gelirvergisitutari",
      "mahsupedilecekagi",
    ] satisfies (keyof DiaWorkerTally)[];

    let updated = 0;

    for (const connection of connections) {
      const workers = workersByConnection.get(connection.id) ?? [];
      const diaKeyToWorkers = new Map<string, typeof assignedWorkers>();
      for (const w of workers) {
        if (!diaKeyToWorkers.has(w.diaKey)) diaKeyToWorkers.set(w.diaKey, []);
        diaKeyToWorkers.get(w.diaKey)!.push(w);
      }

      const dia = await DiaClient.create({
        serverCode: connection.diaServerCode,
        sessionId: connection.sessionId ?? undefined,
        connectionId: connection.id,
        loginRequest: {
          login: {
            username: connection.diaUsername,
            password: aesDecrypt(connection.diaPassword),
            disconnect_same_user: "true",
            params: { apikey: connection.diaApiKey },
          },
        },
      });

      const diaTallies = await dia.getWorkerTallies({
        per_personel_puantaj_listele: {
          firma_kodu: connection.diaFirmCode,
          donem_kodu: connection.diaPeriodCode ?? 0,
          params: { selectedcolumns: SELECTED_COLUMNS },
        },
      });

      if (!diaResponseIsSuccess(diaTallies)) {
        return c.json({ message: diaTallies.msg }, +diaTallies.code as ContentfulStatusCode);
      }

      // Deduplicate by diaKey — last row from DIA wins (handles DIA's zero-row + real-row pattern)
      const tallyByDiaKey = new Map<string, DiaWorkerTally>();
      for (const t of diaTallies.result) tallyByDiaKey.set(t._key_per_personel, t);

      await db.transaction(async (tx) => {
        for (const [diaKey, tally] of tallyByDiaKey) {
          const matchedWorkers = diaKeyToWorkers.get(diaKey);
          if (!matchedWorkers) continue;

          const newValues = {
            argeCenterWorkDays: Math.round(+tally.argefaaliyetgunsayisi || 0),
            totalWorkDays: Math.round(+tally.toplamsigortagun || 0),
            grossBaseSalary: +tally.aylikbrutkazanc || 0,
            incomeTaxAmount: +tally.gelirvergisitutari || 0,
            agi: +tally.mahsupedilecekagi || 0,
          };

          for (const worker of matchedWorkers) {
            await tx.update(monthWorkersTable).set(newValues).where(
              and(
                eq(monthWorkersTable.monthId, monthId),
                eq(monthWorkersTable.projectId, worker.projectId),
                eq(monthWorkersTable.workerId, worker.workerId),
              ),
            );
            updated++;
          }
        }
      });
    }

    return c.json({ message: "Puantaj verileri aktarıldı", updated }, 200);
  },
);

export default app;
