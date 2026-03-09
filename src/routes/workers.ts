import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { db } from "../db/index.js";
import { connectionTable } from "../db/schemas/connection.js";
import { workerTable } from "../db/schemas/worker.js";
import { DiaClient } from "../services/dia.js";
import { aesDecrypt } from "../utils/aes-256-gcm.js";
import { diaResponseIsSuccess } from "../utils/dia.js";
import {
  workerInsertSchema,
  workerUpdateSchema,
} from "../validations/schemas.js";

const app = new Hono();

app.get("/", async (c) => {
  const workers = await db.select().from(workerTable);

  return c.json({ message: "Personeller başarıyla getirildi", workers }, 200);
});

app.get(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [worker] = await db
      .select()
      .from(workerTable)
      .where(eq(workerTable.id, id));

    if (!worker) return c.json({ message: "Personel bulunamadı" }, 404);

    return c.json(
      {
        message: "Personel başarıyla getirildi",
        worker,
      },
      200,
    );
  },
);

app.post("/", zValidator("json", workerInsertSchema), async (c) => {
  const input = c.req.valid("json");
  const [createdWorker] = await db
    .insert(workerTable)
    .values(input)
    .returning();

  c.header("Location", `/connections/${createdWorker.id}`);
  return c.json(
    {
      message: "Personel başarıyla oluşturuldu",
      createdWorker,
    },
    201,
  );
});

app.post(
  "/sync/:connectionId",
  zValidator(
    "param",
    z.object({ connectionId: z.coerce.number().int().positive() }),
  ),
  async (c) => {
    const { connectionId } = c.req.valid("param");

    const [connection] = await db
      .select()
      .from(connectionTable)
      .where(eq(connectionTable.id, connectionId));

    if (!connection) {
      return c.json({ message: "DIA bağlantısı bulunamadı" }, 404);
    }

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

    const diaWorkers = await dia.getWorkers({
      per_personel_listele: {
        firma_kodu: connection.diaFirmCode,
        donem_kodu: connection.diaPeriodCode ?? 0,
        params: { selectedcolumns: ["adisoyadi", "_key"] },
      },
    });

    if (!diaResponseIsSuccess(diaWorkers)) {
      return c.json(
        { message: diaWorkers.msg },
        +diaWorkers.code as ContentfulStatusCode,
      );
    }

    const incomingWorkers = diaWorkers.result.map((w) => ({
      name: w.adisoyadi,
      diaKey: w._key,
      connectionId: connection.id,
    }));

    const existingWorkers = await db
      .select()
      .from(workerTable)
      .where(eq(workerTable.connectionId, connectionId));

    const existingMap = new Map(existingWorkers.map((w) => [w.diaKey, w]));
    const incomingMap = new Map(incomingWorkers.map((w) => [w.diaKey, w]));

    const toInsert = incomingWorkers.filter((w) => !existingMap.has(w.diaKey));

    const toUpdate = incomingWorkers.filter((w) => {
      const existing = existingMap.get(w.diaKey);
      return existing && existing.name !== w.name;
    });

    const toDelete = existingWorkers
      .filter((w) => !incomingMap.has(w.diaKey))
      .map((w) => w.diaKey);

    await Promise.all([
      toInsert.length > 0
        ? db.insert(workerTable).values(toInsert)
        : Promise.resolve(),

      ...toUpdate.map((w) =>
        db
          .update(workerTable)
          .set({ name: w.name })
          .where(
            and(
              eq(workerTable.diaKey, w.diaKey),
              eq(workerTable.connectionId, connectionId),
            ),
          ),
      ),

      toDelete.length > 0
        ? db
            .delete(workerTable)
            .where(
              and(
                inArray(workerTable.diaKey, toDelete),
                eq(workerTable.connectionId, connectionId),
              ),
            )
        : Promise.resolve(),
    ]);

    const syncedWorkers = await db
      .select()
      .from(workerTable)
      .where(eq(workerTable.connectionId, connectionId));

    return c.json(
      {
        message: "Personeller başarıyla eşleştirildi",
        stats: {
          inserted: toInsert.length,
          updated: toUpdate.length,
          deleted: toDelete.length,
        },
        workers: syncedWorkers,
      },
      200,
    );
  },
);

app.patch(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator("json", workerUpdateSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const [updatedWorker] = await db
      .update(workerTable)
      .set(input)
      .where(eq(workerTable.id, id))
      .returning();

    if (!updatedWorker) {
      return c.json({ message: "Personel bulunamadı" }, 404);
    }

    return c.json(
      { message: "Personel başarıyla güncellendi", updatedWorker },
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
      .delete(workerTable)
      .where(eq(workerTable.id, id));

    if (!deleteResult.rowCount) {
      return c.json({ message: "Personel bulunamadı" }, 404);
    }

    return c.json({ message: "Personel silindi" }, 200);
  },
);

export default app;
