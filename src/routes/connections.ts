import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { connectionTable } from "../db/schemas/connection.js";
import { aesEncrypt } from "../utils/aes-256-gcm.js";
import {
  connectionInsertSchema,
  connectionUpdateSchema,
} from "../validations/schemas.js";

const app = new Hono();

const connectionPublicColumns = {
  id: connectionTable.id,
  name: connectionTable.name,
  diaServerCode: connectionTable.diaServerCode,
  diaUsername: connectionTable.diaUsername,
  diaApiKey: connectionTable.diaApiKey,
  diaFirmCode: connectionTable.diaFirmCode,
  diaPeriodCode: connectionTable.diaPeriodCode,
  sessionId: connectionTable.sessionId,
  createdAt: connectionTable.createdAt,
  updatedAt: connectionTable.updatedAt,
} as const;

app.get("/", async (c) => {
  const connections = await db
    .select(connectionPublicColumns)
    .from(connectionTable);

  return c.json(
    { message: "DIA bağlantıları başarıyla getirildi", connections },
    200,
  );
});

app.get(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [connection] = await db
      .select(connectionPublicColumns)
      .from(connectionTable)
      .where(eq(connectionTable.id, id));

    if (!connection)
      return c.json({ message: "DIA bağlantısı bulunamadı" }, 404);

    return c.json(
      { message: "DIA bağlantısı başarıyla getirildi", connection },
      200,
    );
  },
);

app.post("/", zValidator("json", connectionInsertSchema), async (c) => {
  const input = c.req.valid("json");
  const [createdConnection] = await db
    .insert(connectionTable)
    .values({ ...input, diaPassword: aesEncrypt(input.diaPassword) })
    .returning(connectionPublicColumns);

  c.header("Location", `/connections/${createdConnection.id}`);
  return c.json(
    {
      message: "DIA bağlantısı başarıyla oluşturuldu",
      createdConnection,
    },
    201,
  );
});

app.patch(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator("json", connectionUpdateSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const [updatedConnection] = await db
      .update(connectionTable)
      .set({
        ...input,
        diaPassword:
          input.diaPassword !== undefined
            ? aesEncrypt(input.diaPassword)
            : input.diaPassword,
      })
      .where(eq(connectionTable.id, id))
      .returning(connectionPublicColumns);

    if (!updatedConnection) {
      return c.json({ message: "DIA bağlantısı bulunamadı" }, 404);
    }

    return c.json(
      { message: "DIA bağlantısı başarıyla güncellendi", updatedConnection },
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
      .delete(connectionTable)
      .where(eq(connectionTable.id, id));

    if (!deleteResult.rowCount) {
      return c.json({ message: "DIA bağlantısı bulunamadı" }, 404);
    }

    return c.json({ message: "DIA bağlantısı silindi" }, 200);
  },
);

export default app;
