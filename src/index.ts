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

const app = new Hono().basePath("/api");
app.use(logger());
app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (origin === env.APP_URL) {
        return origin;
      }

      if (
        env.NODE_ENV === "development" &&
        origin.startsWith("http://localhost:")
      ) {
        return origin;
      }

      return null;
    },
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.error("Critical Error:", err);

  const isDev = process.env.NODE_ENV === "development";

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

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  () => {
    console.log(`Server is running on ${env.APP_URL}`);
  },
);
