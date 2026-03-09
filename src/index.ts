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
    // hosting environment might inject its own port
    port: Number(process.env.PORT) || 3000,
    ...(env.NODE_ENV === "production" && { host: "0.0.0.0" }),
  },
  ({ port }) => {
    console.log(`Server is running on ${port}`);
  },
);
