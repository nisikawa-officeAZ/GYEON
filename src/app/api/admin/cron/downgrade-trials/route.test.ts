// GDA-AUTH-DEVNEXT-1B — fail-closed Cron contract for downgrade-trials.
//
// Run:
//   node --experimental-test-module-mocks --import tsx \
//     --test src/app/api/admin/cron/downgrade-trials/route.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, mock, test } from "node:test";

let downstreamCalls = 0;
const originalCronSecret = process.env.CRON_SECRET;

function mockModule(specifier: string, moduleExports: Record<string, unknown>): void {
  Reflect.apply(mock.module, mock, [specifier, { exports: moduleExports }]);
}

mockModule("@/lib/admin/auto-downgrade", {
  checkAndDowngradeExpiredTrials: async () => {
    downstreamCalls += 1;
    return { downgraded: 0, errors: [] };
  },
});

let route: typeof import("./route");

before(async () => {
  route = await import("./route");
});

beforeEach(() => {
  downstreamCalls = 0;
  delete process.env.CRON_SECRET;
});

after(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

test("the scheduled GET is deliberately owned by Next's framework 405", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons?: Array<{ path?: string; schedule?: string }>;
  };
  assert.deepEqual(
    vercel.crons?.filter((entry) => entry.path === "/api/admin/cron/downgrade-trials"),
    [{ path: "/api/admin/cron/downgrade-trials", schedule: "0 17 * * *" }],
  );

  assert.equal("GET" in route, false, "no GET handler may turn the scheduled request into execution");
  assert.equal(typeof route.POST, "function");
  assert.equal(downstreamCalls, 0);
});

test("POST returns 401 with CRON_SECRET absent and performs zero downgrade work", async () => {
  const response = await route.POST(
    new Request("https://dev-next.detailer-ag.com/api/admin/cron/downgrade-trials", {
      method: "POST",
      headers: { authorization: "Bearer attacker-controlled" },
    }) as Parameters<typeof route.POST>[0],
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
  assert.equal(downstreamCalls, 0);
});
