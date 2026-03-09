import { zValidator } from "@hono/zod-validator";
import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { workerTallySelectedColumns } from "../constants/dia.js";
import { db } from "../db/index.js";
import { connectionTable } from "../db/schemas/connection.js";
import { hourDefinitionTable } from "../db/schemas/hour-definition.js";
import { projectTable } from "../db/schemas/project.js";
import { projectWorkersTable } from "../db/schemas/project-workers.js";
import { workerTable } from "../db/schemas/worker.js";
import { DiaClient } from "../services/dia.js";
import type { DiaFilter } from "../types/dia-requests.js";
import type { DiaWorkerTally } from "../types/dia-responses.js";
import { aesDecrypt } from "../utils/aes-256-gcm.js";
import {
  diaResponseIsSuccess,
  employerCostWithIncentive,
  employerCostWithoutIncentive,
} from "../utils/dia.js";
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

    const updateResult = await db.transaction(async (tx) => {
      await tx
        .delete(projectWorkersTable)
        .where(eq(projectWorkersTable.projectId, id))
        .returning();

      const toInsert = input.map((o) => ({
        ...o,
        projectId: id,
      }));

      const updatedAssignments = await tx
        .insert(projectWorkersTable)
        .values(toInsert)
        .returning();

      return updatedAssignments;
    });

    return c.json(
      {
        message: "Personel atamaları başarıyla güncellendi",
        updateResult,
      },
      200,
    );
  },
);

type ExcludedTallyFields =
  | "_key_per_personel"
  | "muhasebelesme"
  | "duzenlemetarihi"
  | "persdepartmanaciklama"
  | "adi"
  | "soyadi"
  | "tckimlikno"
  | "sube"
  | "ucretturu"
  | "carifisno"
  | "isverenhastalikprimtutari"
  | "isverenihtiyarlikprimtutari"
  | "isverenanalikprimtutari"
  | "isverentehlikederecesiprimtutari"
  | "uzunvadeliskisveren"
  | "gssisveren"
  | "kisavadeliskisveren"
  | "sgk_6111kanunindirimi"
  | "kisavadeliskisveren_muafiyettutari"
  | "uzunvadeliskisveren_muafiyettutari"
  | "gssisveren_muafiyettutari"
  | "artiisverendevlettesviki"
  | "sgk_4447kanunindirimi"
  | "sgk_16322kanunindirimi"
  | "sgk_26322kanunindirimi"
  | "sgk_7252kanunindirimi"
  | "sgk_3294kanunindirimi"
  | "sgk_2828kanunindirimi";

type TallyKeys = keyof Omit<DiaWorkerTally, ExcludedTallyFields>;

type CalculationResult = {
  [K in TallyKeys]: number;
} & {
  workerName: string;
  employerCostWithoutIncentive: number;
  employerCostWithIncentive: number;
};

app.get(
  "/:id/calculations/:month?",
  zValidator(
    "param",
    z.object({
      id: z.coerce.number().int().positive(),
      month: z.coerce.number().int().min(1).max(12).optional(),
    }),
  ),
  async (c) => {
    const { id: projectId, month } = c.req.valid("param");

    const assignmentsQuery = db
      .select({ hourDefinition: hourDefinitionTable, worker: workerTable })
      .from(projectWorkersTable)
      .innerJoin(workerTable, eq(projectWorkersTable.workerId, workerTable.id))
      .innerJoin(
        hourDefinitionTable,
        eq(projectWorkersTable.hourDefinitionId, hourDefinitionTable.id),
      )
      .where(eq(projectWorkersTable.projectId, projectId));

    const projectQuery = db
      .select()
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .then((p) => p[0]);

    const [assignments, project] = await Promise.all([
      assignmentsQuery,
      projectQuery,
    ]);

    if (!project) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    const [connection] = await db
      .select()
      .from(connectionTable)
      .where(eq(connectionTable.id, project.connectionId));

    const dia = await DiaClient.create({
      serverCode: connection.diaServerCode,
      sessionId: connection.sessionId ?? undefined,
      connectionId: connection.id,
      loginRequest: {
        login: {
          username: connection.diaUsername,
          password: aesDecrypt(connection.diaPassword),
          params: { apikey: connection.diaApiKey },
        },
      },
    });

    const workerKeysFilter: DiaFilter = {
      field: "_key_per_personel",
      operator: "IN",
      value: assignments.map((a) => a.worker.diaKey).join(","),
    };

    const workerTalliesFilters: DiaFilter[] = [workerKeysFilter];

    if (month) {
      workerTalliesFilters.push({
        field: "duzenlemeayno",
        operator: "=",
        value: String(month).padStart(2, "0"),
      });
    }

    const workerTallies = await dia.getWorkerTallies({
      per_personel_puantaj_listele: {
        firma_kodu: connection.diaFirmCode,
        donem_kodu: connection.diaPeriodCode ?? 0,
        filters: workerTalliesFilters,
        params: { selectedcolumns: workerTallySelectedColumns },
      },
    });

    if (!diaResponseIsSuccess(workerTallies)) {
      return c.json(
        { message: workerTallies.msg },
        +workerTallies.code as ContentfulStatusCode,
      );
    }

    const workerHourMap = new Map(
      assignments.map((a) => [a.worker.diaKey, a.hourDefinition]),
    );

    const matchedTallies = workerTallies.result.filter((t) =>
      workerHourMap.has(t._key_per_personel),
    );

    const stripNonCalculable = (t: DiaWorkerTally) => {
      const {
        _key_per_personel,
        toplamsigortagun,
        argefaaliyetgunsayisi,
        argegelirvergisigunsayisi,
        muhasebelesme,
        duzenlemetarihi,
        persdepartmanaciklama,
        adi,
        soyadi,
        tckimlikno,
        sube,
        ucretturu,
        carifisno,
        isverenhastalikprimtutari,
        isverenihtiyarlikprimtutari,
        isverenanalikprimtutari,
        isverentehlikederecesiprimtutari,
        uzunvadeliskisveren,
        gssisveren,
        kisavadeliskisveren,
        artiisverendevlettesviki,
        sgk_6111kanunindirimi,
        kisavadeliskisveren_muafiyettutari,
        uzunvadeliskisveren_muafiyettutari,
        gssisveren_muafiyettutari,
        sgk_4447kanunindirimi,
        sgk_16322kanunindirimi,
        sgk_26322kanunindirimi,
        sgk_7252kanunindirimi,
        sgk_3294kanunindirimi,
        sgk_2828kanunindirimi,
        ...toCalculate
      } = t;

      return toCalculate;
    };

    const originalTallies = matchedTallies.map((t) => ({
      ...stripNonCalculable(t),
      employerCostWithoutIncentive: employerCostWithoutIncentive(t),
      employerCostWithIncentive: employerCostWithIncentive(t),
      workerName: `${t.adi} ${t.soyadi}`,
    }));

    const calculations = matchedTallies.map((t) => {
      // exclude properties that are not meant to be calculated
      const toCalculate = stripNonCalculable(t);

      // we already filter above so this can't be undefined
      const workerHour = workerHourMap.get(t._key_per_personel)!;

      const calculated = {
        workerName: `${t.adi} ${t.soyadi}`,
      } as CalculationResult;

      for (const [key, value] of Object.entries(toCalculate)) {
        const numValue = Number(value);

        if (Number.isNaN(numValue)) {
          continue;
        }

        calculated[key as TallyKeys] = numValue * workerHour.multiplier;
      }

      calculated.employerCostWithoutIncentive =
        employerCostWithoutIncentive(t) * workerHour.multiplier;
      calculated.employerCostWithIncentive =
        employerCostWithIncentive(t) * workerHour.multiplier;

      return calculated;
    });

    return c.json(
      {
        message: "Hesaplamalar başarıyla getirildi",
        originalTallies,
        calculations,
      },
      200,
    );
  },
);

export default app;
