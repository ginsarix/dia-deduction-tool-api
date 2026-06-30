import { describe, test } from "vitest";
import workersApp from "./workers.js";

const DEMO_CONNECTION_ID = 2;
const REAL_CONNECTION_ID = 5;

async function syncWorkers(connectionId: number) {
  const label = connectionId === DEMO_CONNECTION_ID ? "demo" : "real";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${label}] POST /sync/${connectionId}`);
  console.log("=".repeat(60));

  let res: Response;
  try {
    res = await workersApp.request(`/sync/${connectionId}`, {
      method: "POST",
    });
  } catch (err) {
    console.error(`[${label}] app.request() threw:`, err);
    if (err instanceof Error && err.cause) {
      console.error(`[${label}] cause:`, err.cause);
    }
    return { res: null, body: null };
  }

  const body = await res.json().catch(() => null);

  console.log(`[${label}] status : ${res.status}`);

  if (!res.ok) {
    console.error(`[${label}] FAILED — HTTP ${res.status}`);
    console.error(`[${label}] body   :`, JSON.stringify(body, null, 2));
    if (body?.stack) console.error(`[${label}] stack  :`, body.stack);
  } else {
    const { stats } = body as {
      stats: { inserted: number; updated: number; deleted: number };
    };
    console.log(
      `[${label}] stats  : inserted=${stats.inserted} updated=${stats.updated} deleted=${stats.deleted}`,
    );
  }

  return { res, body };
}

describe("worker sync", () => {
  test(
    `syncs workers for demo connection (id=${DEMO_CONNECTION_ID})`,
    async ({ expect }) => {
      const { res, body } = await syncWorkers(DEMO_CONNECTION_ID);
      expect(res?.status, `expected 200, body: ${JSON.stringify(body)}`).toBe(
        200,
      );
    },
    30_000,
  );

  test(
    `syncs workers for real connection (id=${REAL_CONNECTION_ID})`,
    async ({ expect }) => {
      const { res, body } = await syncWorkers(REAL_CONNECTION_ID);
      expect(res?.status, `expected 200, body: ${JSON.stringify(body)}`).toBe(
        200,
      );
    },
    30_000,
  );
});
