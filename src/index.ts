import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { env } from "./config/env.js";
import { auth } from "./lib/auth.js";
import { authMiddleware } from "./middleware.js";
import connectionsRouteGroup from "./routes/connections.js";
import hourDefinitionsRouteGroup from "./routes/hour-definitions.js";
import projectsRouteGroup from "./routes/projects.js";
import workersRouteGroup from "./routes/workers.js";

const app = new Hono().basePath("/api");
app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (origin === "https://argeoms.panunet.com.tr") {
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
  console.error(err);

  return c.json({ message: "Internal server error" }, 500);
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
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
