// GDA-AUTH-DEVNEXT-1B — fail-closed Cron contract for LINE queue delivery.
//
// Run:
//   node --experimental-test-module-mocks --import tsx \
//     --test src/app/api/admin/cron/process-line-queue/route.test.ts

import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";

let downstreamCalls = 0;
const originalCronSecret = process.env.CRON_SECRET;

function mockModule(specifier: string, moduleExports: Record<string, unknown>): void {
  Reflect.apply(mock.module, mock, [specifier, { exports: moduleExports }]);
}

mockModule("@/lib/line/process-line-queue-cron", {
  processLineNotificationQueueForCron: async () => {
    downstreamCalls += 1;
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      reaped: 0,
      requeued: 0,
      errors: [],
    };
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

for (const method of ["GET", "POST"] as const) {
  test(`${method} returns 401 with CRON_SECRET absent and performs zero LINE work`, async () => {
    const response = await route[method](
      new Request("https://dev-next.detailer-ag.com/api/admin/cron/process-line-queue", {
        method,
        headers: { authorization: "Bearer attacker-controlled" },
      }) as Parameters<(typeof route)[typeof method]>[0],
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
    assert.equal(downstreamCalls, 0);
  });
}
