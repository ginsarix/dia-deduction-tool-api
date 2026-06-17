import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { hourDefinitionTable } from "../db/schemas/hour-definition.js";
import { projectWorkersTable } from "../db/schemas/project-workers.js";

const app = new Hono();

app.get("/", async (c) => {
  const assignments = await db
    .select({
      projectId: projectWorkersTable.projectId,
      workerId: projectWorkersTable.workerId,
      hourDefinitionId: projectWorkersTable.hourDefinitionId,
      multiplier: hourDefinitionTable.multiplier,
    })
    .from(projectWorkersTable)
    .innerJoin(
      hourDefinitionTable,
      eq(projectWorkersTable.hourDefinitionId, hourDefinitionTable.id),
    );

  return c.json({ message: "Atamalar başarıyla getirildi", assignments }, 200);
});

const putSchema = z.object({
  assignments: z.array(
    z.object({
      workerId: z.number().int().positive(),
      projectId: z.number().int().positive(),
      hourDefinitionId: z.number().int().positive(),
    }),
  ),
});

app.put("/", zValidator("json", putSchema), async (c) => {
  const { assignments } = c.req.valid("json");

  if (assignments.length > 0) {
    const hourDefIds = [...new Set(assignments.map((a) => a.hourDefinitionId))];
    const hourDefs = await db
      .select({ id: hourDefinitionTable.id, multiplier: hourDefinitionTable.multiplier })
      .from(hourDefinitionTable)
      .where(inArray(hourDefinitionTable.id, hourDefIds));

    const multiplierMap = new Map(hourDefs.map((h) => [h.id, Number(h.multiplier)]));

    const workerSums = new Map<number, number>();
    for (const a of assignments) {
      const m = multiplierMap.get(a.hourDefinitionId) ?? 0;
      workerSums.set(a.workerId, (workerSums.get(a.workerId) ?? 0) + m);
    }

    for (const [workerId, sum] of workerSums) {
      if (Math.abs(sum - 1) > 0.001) {
        return c.json(
          {
            message: `Personel #${workerId} için saat tanımlamaları toplamı 1.000 olmalıdır (şu an: ${sum.toFixed(3)})`,
          },
          422,
        );
      }
    }
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        projectId: projectWorkersTable.projectId,
        workerId: projectWorkersTable.workerId,
      })
      .from(projectWorkersTable);

    const newSet = new Set(assignments.map((a) => `${a.projectId}:${a.workerId}`));
    const toDelete = existing.filter((e) => !newSet.has(`${e.projectId}:${e.workerId}`));

    if (toDelete.length > 0) {
      // Group by projectId so each delete is one IN-query
      const byProject = new Map<number, number[]>();
      for (const row of toDelete) {
        const ids = byProject.get(row.projectId) ?? [];
        ids.push(row.workerId);
        byProject.set(row.projectId, ids);
      }
      for (const [projectId, workerIds] of byProject) {
        await tx
          .delete(projectWorkersTable)
          .where(
            and(
              eq(projectWorkersTable.projectId, projectId),
              inArray(projectWorkersTable.workerId, workerIds),
            ),
          );
      }
    }

    // Upsert preserves existing rate fields — only updates hourDefinitionId when changed
    if (assignments.length > 0) {
      await tx
        .insert(projectWorkersTable)
        .values(assignments)
        .onConflictDoUpdate({
          target: [projectWorkersTable.projectId, projectWorkersTable.workerId],
          set: { hourDefinitionId: sql`excluded.hour_definition_id` },
        });
    }
  });

  return c.json({ message: "Atamalar başarıyla güncellendi" }, 200);
});

export default app;
