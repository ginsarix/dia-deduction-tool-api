import { zValidator } from "@hono/zod-validator";
import { count, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { connectionTable } from "../db/schemas/connection.js";
import { hourDefinitionTable } from "../db/schemas/hour-definition.js";
import { projectTable } from "../db/schemas/project.js";
import { projectWorkersTable } from "../db/schemas/project-workers.js";
import { workerTable } from "../db/schemas/worker.js";
import {
  projectInsertSchema,
  projectUpdateSchema,
} from "../validations/schemas.js";

const app = new Hono();

app.get("/", async (c) => {
  const projects = await db
    .select({
      project: projectTable,
      connectionName: connectionTable.name,
      workerCount: count(projectWorkersTable.workerId),
    })
    .from(projectTable)
    .innerJoin(
      connectionTable,
      eq(connectionTable.id, projectTable.connectionId),
    )
    .leftJoin(
      projectWorkersTable,
      eq(projectWorkersTable.projectId, projectTable.id),
    )
    .groupBy(projectTable.id, connectionTable.name);

  return c.json({ message: "Projeler başarıyla getirildi", projects }, 200);
});

app.get(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [project] = await db
      .select()
      .from(projectTable)
      .where(eq(projectTable.id, id));

    if (!project) return c.json({ message: "Proje bulunamadı" }, 404);

    return c.json({ message: "Proje başarıyla getirildi", project }, 200);
  },
);

app.post(
  "/",
  zValidator(
    "json",
    projectInsertSchema.extend({
      workers: z
        .array(
          z.object({
            workerId: z.number().int().positive(),
            hourDefinitionId: z.number().int().positive(),
          }),
        )
        .min(1),
    }),
  ),
  async (c) => {
    const { workers, ...projectInput } = c.req.valid("json");

    const [createdProject] = await db
      .insert(projectTable)
      .values(projectInput)
      .returning();

    const createdAssignments = await db
      .insert(projectWorkersTable)
      .values(workers.map((w) => ({ ...w, projectId: createdProject.id })))
      .returning();

    c.header("Location", `/projects/${createdProject.id}`);
    return c.json(
      {
        message: "Proje başarıyla oluşturuldu",
        createdProject,
        createdAssignments,
      },
      201,
    );
  },
);

app.patch(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator("json", projectUpdateSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const [updatedProject] = await db
      .update(projectTable)
      .set(input)
      .where(eq(projectTable.id, id))
      .returning();

    if (!updatedProject) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    return c.json(
      { message: "Proje başarıyla güncellendi", updatedProject },
      200,
    );
  },
);

app.delete(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");

    const deleteResult = await db
      .delete(projectTable)
      .where(eq(projectTable.id, id));

    if (!deleteResult.rowCount) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    return c.json({ message: "Proje silindi" }, 200);
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
      })
      .from(projectWorkersTable)
      .innerJoin(workerTable, eq(projectWorkersTable.workerId, workerTable.id))
      .innerJoin(
        hourDefinitionTable,
        eq(projectWorkersTable.hourDefinitionId, hourDefinitionTable.id),
      )
      .where(eq(projectWorkersTable.projectId, id));

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
        workerId: z.number().int().positive(),
        hourDefinitionId: z.number().int().positive(),
      }),
    ),
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const toUpsert = input.map((o) => ({
      ...o,
      projectId: id,
    }));

    const updateResult = await db
      .insert(projectWorkersTable)
      .values(toUpsert)
      .onConflictDoUpdate({
        target: [projectWorkersTable.projectId, projectWorkersTable.workerId],
        set: {
          hourDefinitionId: sql`excluded.hour_definition_id`,
        },
      })
      .returning();

    return c.json(
      {
        message: "Personel atamaları başarıyla güncellendi",
        updateResult,
      },
      200,
    );
  },
);

app.get(
  "/:id/rates",
  zValidator(
    "param",
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  ),
  async (c) => {
    const { id: projectId } = c.req.valid("param");

    const assignmentsQuery = db
      .select({
        projectWorkers: {
          argeCenterWorkDays: projectWorkersTable.argeCenterWorkDays,
          otherActivitiesWorkDays: projectWorkersTable.otherActivitiesWorkDays,
          totalWorkDays: projectWorkersTable.totalWorkDays,
          grossBaseSalary: projectWorkersTable.grossBaseSalary,
          overtimeAdditionalPay: projectWorkersTable.overtimeAdditionalPay,
          monthlyUpperLimit: projectWorkersTable.monthlyUpperLimit,
          incomeTaxAmount: projectWorkersTable.incomeTaxAmount,
          agi: projectWorkersTable.agi,
          argeExemptionRate: projectWorkersTable.argeExemptionRate,
        },
        hourDefinition: hourDefinitionTable,
        worker: workerTable,
      })
      .from(projectWorkersTable)
      .innerJoin(workerTable, eq(projectWorkersTable.workerId, workerTable.id))
      .innerJoin(
        hourDefinitionTable,
        eq(projectWorkersTable.hourDefinitionId, hourDefinitionTable.id),
      )
      .where(eq(projectWorkersTable.projectId, projectId));

    const projectQuery = db
      .select({
        sgk5510EmployeeShareRate: projectTable.sgk5510EmployeeShareRate,
        sgk5510EmployeeUnemploymentShareRate:
          projectTable.sgk5510EmployeeUnemploymentShareRate,
        sgk5510EmployerShareRate: projectTable.sgk5510EmployerShareRate,
        sgk5510EmployerUnemploymentShareRate:
          projectTable.sgk5510EmployerUnemploymentShareRate,
        sgk5746EmployerShareRate: projectTable.sgk5746EmployerShareRate,
        sgk5746EmployerUnemploymentShareRate:
          projectTable.sgk5746EmployerUnemploymentShareRate,
        incomeTaxSgk5746EmployeeShareRate:
          projectTable.incomeTaxSgk5746EmployeeShareRate,
        incomeTaxSgk5746EmployeeUnemploymentShareRate:
          projectTable.incomeTaxSgk5746EmployeeUnemploymentShareRate,
      })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));

    const [assignments, [project]] = await Promise.all([
      assignmentsQuery,
      projectQuery,
    ]);

    if (!project) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    return c.json(
      {
        message: "Oranlar başarıyla getirildi",
        rates: { workers: assignments, project },
      },
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
      project: z
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
    const { id: projectId } = c.req.valid("param");
    const { project: projectRates, workers: workerRates } = c.req.valid("json");

    const [existingProject] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));

    if (!existingProject) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    await db.transaction(async (tx) => {
      if (projectRates && Object.keys(projectRates).length > 0) {
        await tx
          .update(projectTable)
          .set(projectRates)
          .where(eq(projectTable.id, projectId));
      }

      if (workerRates && workerRates.length > 0) {
        const rows = workerRates.map(
          ({ workerId, ...r }) =>
            sql`(
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
          UPDATE project_workers AS pw
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
          WHERE pw.project_id = ${projectId}
            AND pw.worker_id  = v.worker_id
        `);
      }
    });

    return c.json({ message: "Oranlar başarıyla güncellendi" }, 200);
  },
);

export default app;
