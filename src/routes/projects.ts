import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { projectTable } from "../db/schemas/project.js";
import {
  projectInsertSchema,
  projectUpdateSchema,
} from "../validations/schemas.js";

const app = new Hono();

app.get("/", async (c) => {
  const projects = await db
    .select()
    .from(projectTable)
    .orderBy(projectTable.startDate);

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
  zValidator("json", projectInsertSchema),
  async (c) => {
    const input = c.req.valid("json");

    const [created] = await db
      .insert(projectTable)
      .values(input)
      .returning();

    c.header("Location", `/projects/${created.id}`);
    return c.json(
      { message: "Proje başarıyla oluşturuldu", project: created },
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

    const [updated] = await db
      .update(projectTable)
      .set(input)
      .where(eq(projectTable.id, id))
      .returning();

    if (!updated) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    return c.json(
      { message: "Proje başarıyla güncellendi", project: updated },
      200,
    );
  },
);

app.delete(
  "/:id",
  zValidator("param", z.object({ id: z.coerce.number().int().positive() })),
  async (c) => {
    const { id } = c.req.valid("param");

    const result = await db
      .delete(projectTable)
      .where(eq(projectTable.id, id));

    if (!result.rowCount) {
      return c.json({ message: "Proje bulunamadı" }, 404);
    }

    return c.json({ message: "Proje silindi" }, 200);
  },
);

export default app;
