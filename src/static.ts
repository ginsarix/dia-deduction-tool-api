import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

const isApiPath = (path: string) => path === "/api" || path.startsWith("/api/");

/**
 * Mounts the API and serves the built client from `root` for every non-API path.
 *
 * The hosting web server (gws on Plesk) forwards every request to this process
 * instead of serving files from the document root first, so the app has to
 * serve the frontend itself. The client uses HashRouter, so no SPA fallback is
 * needed: only `/` and real files.
 *
 * `root` is relative to the process cwd (serveStatic rejects absolute paths);
 * in production the cwd is the app root, which contains `public/`.
 */
export function withFrontend(api: Hono<any, any, any>, root = "./public") {
  const server = new Hono();
  const frontend = serveStatic({ root });

  server.route("/", api);
  server.use("*", (c, next) => (isApiPath(c.req.path) ? next() : frontend(c, next)));

  return server;
}
