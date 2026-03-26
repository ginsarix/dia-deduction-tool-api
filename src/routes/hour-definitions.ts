import { zValidator } from "@hono/zod-validator";
import { DrizzleQueryError, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { hourDefinitionTable } from "../db/schemas/hour-definition.js";
import {
  hourDefinitionInsertSchema,
  hourDefinitionUpdateSchema,
} from "../validations/schemas.js";
import { DatabaseError } from "pg";

const app = new Hono();

app.get("/", async (c) => {
  const hourDefinitions = await db.select().from(hourDefinitionTable);

  return c.json(
    { message: "Saat tanımlamaları başarıyla getirildi", hourDefinitions },
    200,
  );
});

app.get(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");
    const [hourDefinition] = await db
      .select()
      .from(hourDefinitionTable)
      .where(eq(hourDefinitionTable.id, id));

    if (!hourDefinition)
      return c.json({ message: "Saat tanımlaması bulunamadı" }, 404);

    return c.json(
      { message: "Saat tanımlaması başarıyla getirildi", hourDefinition },
      200,
    );
  },
);

app.post("/", zValidator("json", hourDefinitionInsertSchema), async (c) => {
  const input = c.req.valid("json");
  const [createdHourDefinition] = await db
    .insert(hourDefinitionTable)
    .values(input)
    .returning();

  c.header("Location", `/hour-definitions/${createdHourDefinition.id}`);
  return c.json(
    {
      message: "Saat tanımlaması başarıyla oluşturuldu",
      createdHourDefinition,
    },
    201,
  );
});

app.patch(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  zValidator("json", hourDefinitionUpdateSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");

    const [updatedHourDefinition] = await db
      .update(hourDefinitionTable)
      .set(input)
      .where(eq(hourDefinitionTable.id, id))
      .returning();

    if (!updatedHourDefinition) {
      return c.json({ message: "Saat tanımlaması bulunamadı" }, 404);
    }

    return c.json(
      {
        message: "Saat tanımlaması başarıyla güncellendi",
        updatedHourDefinition,
      },
      200,
    );
  },
);

app.delete(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");

    try {
      const deleteResult = await db
        .delete(hourDefinitionTable)
        .where(eq(hourDefinitionTable.id, id));

      if (!deleteResult.rowCount) {
        return c.json({ message: "Saat tanımlaması bulunamadı" }, 404);
      }
    } catch (error) {
      if (
        error instanceof DrizzleQueryError &&
        error.cause instanceof DatabaseError &&
        error.cause.code === "23503"
      ) {
        return c.json(
          { message: "Bu saat tanımlaması kullanımda olduğu için silinemedi" },
          409,
        );
      }

      throw error;
    }

    return c.json({ message: "Saat tanımlaması silindi" }, 200);
  },
);

export default app;
