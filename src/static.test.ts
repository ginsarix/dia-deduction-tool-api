import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withFrontend } from "./static.js";

let dir: string;
let server: Hono;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "static-test-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><p>app</p>");
  writeFileSync(join(dir, "assets", "index-abc.js"), "console.log(1)");

  const api = new Hono().basePath("/api");
  api.get("/", (c) => c.text("api root"));
  api.get("/projects", (c) => c.text("projects"));

  // serveStatic only accepts roots relative to cwd
  server = withFrontend(api, relative(process.cwd(), dir));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("withFrontend", () => {
  it("serves index.html at /", async () => {
    const res = await server.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("<p>app</p>");
  });

  it("serves built assets", async () => {
    const res = await server.request("/assets/index-abc.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
  });

  it("keeps API routes working", async () => {
    expect(await (await server.request("/api")).text()).toBe("api root");
    expect(await (await server.request("/api/projects")).text()).toBe("projects");
  });

  it("does not answer unknown API paths with the frontend", async () => {
    const res = await server.request("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("<p>app</p>");
  });

  it("404s for missing files", async () => {
    const res = await server.request("/missing.png");
    expect(res.status).toBe(404);
  });
});
