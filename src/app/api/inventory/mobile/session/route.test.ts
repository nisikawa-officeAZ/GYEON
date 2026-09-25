import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

mock.module("server-only", { namedExports: {} });
mock.module("../../../../../lib/inventory/mobile/office-az-inventory-mobile-server", {
  namedExports: {
    isExactJsonMediaType: (headerValue: string | null) =>
      headerValue === "application/json",
    publicStatusFor: (code: string) => {
      if (code === "invalid_request") return 400;
      if (code === "dependency_not_configured") return 503;
      if (code === "unauthenticated") return 401;
      return 400;
    },
    readBoundedJsonBody: async (req: Request) => {
      const raw = await req.text();
      if (raw.length > 32768) return { ok: false, status: 413 as const };
      try {
        return { ok: true as const, value: JSON.parse(raw) };
      } catch {
        return { ok: false, status: 400 as const };
      }
    },
    executeMobileSessionBoundary: async (body: { operation?: string }) => {
      if (body?.operation === "issue-success-shape") {
        return {
          ok: true,
          operation: "issue",
          accepted: true,
          sessionId: "S".repeat(43),
          refreshToken: "R".repeat(43),
          refreshVersion: 1,
          accessLifetimeMs: 3_600_000,
          refreshAbsoluteCeilingMs: 43_200_000,
        };
      }
      if (body?.operation === "refresh-success-shape") {
        return {
          ok: true,
          operation: "refresh",
          accepted: true,
          refreshToken: "N".repeat(43),
          refreshVersion: 2,
        };
      }
      return { ok: false, code: "dependency_not_configured" };
    },
  },
});

type Route = typeof import("./route");
let POST: Route["POST"];
let GET: Route["GET"];
let HEAD: Route["HEAD"];
let OPTIONS: Route["OPTIONS"];

before(async () => {
  ({ POST, GET, HEAD, OPTIONS } = await import("./route"));
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/inventory/mobile/session", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

test("session route is dynamic POST-only and does not require Origin", async () => {
  const source = readFileSync(
    "src/app/api/inventory/mobile/session/route.ts",
    "utf8",
  );
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.equal(source.includes("mutationOriginAllowed"), false);
  const res = await post({ operation: "issue" });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(await res.json(), { ok: false, code: "dependency_not_configured" });
  const text = JSON.stringify(await (await post({ operation: "issue" })).json());
  assert.equal(text.includes("token"), false);
});

test("non-POST methods are 405 and wrong media type is invalid_request", async () => {
  assert.equal((await GET()).status, 405);
  assert.equal((await HEAD()).status, 405);
  assert.equal((await OPTIONS()).status, 405);
  const bad = await POST(
    new Request("http://localhost:3000/api/inventory/mobile/session", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }),
  );
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { ok: false, code: "invalid_request" });
});

test("session success payloads pass through unchanged with 200 and no-store", async () => {
  const issued = await post({ operation: "issue-success-shape" });
  assert.equal(issued.status, 200);
  assert.equal(issued.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(await issued.json(), {
    ok: true,
    operation: "issue",
    accepted: true,
    sessionId: "S".repeat(43),
    refreshToken: "R".repeat(43),
    refreshVersion: 1,
    accessLifetimeMs: 3_600_000,
    refreshAbsoluteCeilingMs: 43_200_000,
  });
  const refreshed = await post({ operation: "refresh-success-shape" });
  assert.equal(refreshed.status, 200);
  const body = await refreshed.json();
  assert.deepEqual(Object.keys(body).sort(), [
    "accepted",
    "ok",
    "operation",
    "refreshToken",
    "refreshVersion",
  ]);
});

test("D4 foundation route still enforces Origin and was not imported here", () => {
  const mobile = readFileSync("src/app/api/inventory/mobile/session/route.ts", "utf8");
  const foundation = readFileSync(
    "src/app/api/inventory/foundation/route.ts",
    "utf8",
  );
  assert.equal(mobile.includes("foundation-server-actions"), false);
  assert.match(foundation, /mutationOriginAllowed/);
  assert.match(foundation, /export const dynamic = "force-dynamic"/);
});
