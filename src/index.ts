import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { env } from "./config/env.js";
import { auth } from "./lib/auth.js";
import { authMiddleware } from "./middleware.js";
import connectionsRouteGroup from "./routes/connections.js";
import hourDefinitionsRouteGroup from "./routes/hour-definitions.js";
import projectsRouteGroup from "./routes/projects.js";
import workersRouteGroup from "./routes/workers.js";
import { DiaClient } from "./services/dia.js";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "./db/index.js";
import { connectionTable } from "./db/schemas/connection.js";
import { eq } from "drizzle-orm";
import { aesDecrypt } from "./utils/aes-256-gcm.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { diaResponseIsSuccess } from "./utils/dia.js";

const app = new Hono().basePath("/api");

// in case of reverse proxy
// app.use("/*", (c, next) => {
//   const proto = c.req.header("x-forwarded-proto");
//   if (proto === "https") {
//     c.req.raw.headers.set("x-forwarded-proto", "https");
//   }
//   return next();
// });

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.ORIGIN_URL,
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.error("Critical Error:", err);

  const isDev = env.NODE_ENV === "development";

  return c.json(
    {
      message: isDev ? err.message : "Internal server error",
      stack: isDev ? err.stack : undefined,
    },
    500,
  );
});

app.get("/", (c) => {
  return c.text("Arge Merkezi Hesaplama API");
});

app.use("/connections/*", authMiddleware);
app.use("/workers/*", authMiddleware);
app.use("/projects/*", authMiddleware);
app.use("/hour-definitions/*", authMiddleware);

app.route("/connections", connectionsRouteGroup);
app.route("/workers", workersRouteGroup);
app.route("/projects", projectsRouteGroup);
app.route("/hour-definitions", hourDefinitionsRouteGroup);

app.get(
  "/departments/:connectionId",
  authMiddleware,
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

    const diaDepartments = await dia.getDepartments({
      sis_departman_listele: {
        firma_kodu: connection.diaFirmCode,
        donem_kodu: connection.diaPeriodCode ?? 0,
        params: {
          selectedcolumns: ["_key", "aciklama"],
        },
      },
    });

    if (!diaResponseIsSuccess(diaDepartments)) {
      return c.json(
        { message: diaDepartments.msg },
        +diaDepartments.code as ContentfulStatusCode,
      );
    }

    const departments = diaDepartments.result.map((dd) => ({
      key: dd._key,
      name: dd.aciklama,
    }));

    return c.json({
      message: "Departmanlar başarıyla getirildi",
      departments,
    });
  },
);

serve(
  {
    fetch: app.fetch,
    // hosting environment might inject its own port
    port: Number(process.env.PORT) || 3000,
    ...(env.NODE_ENV === "production" && { host: "0.0.0.0" }),
  },
  ({ port }) => {
    console.log(`Server is running on ${port}`);
  },
);
