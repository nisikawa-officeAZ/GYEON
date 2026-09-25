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
    executeMobileDeviceBoundary: async (body: { operation?: string }) => {
      if (body?.operation === "register-success-shape") {
        return { ok: true, operation: "register", accepted: true, deviceId: "D".repeat(43) };
      }
      if (body?.operation === "revoke-device-success-shape") {
        return { ok: true, operation: "revoke_device", accepted: true };
      }
      return { ok: false, code: "dependency_not_configured" };
    },
  },
});

type Route = typeof import("./route");
let POST: Route["POST"];
let GET: Route["GET"];
let PUT: Route["PUT"];

before(async () => {
  ({ POST, GET, PUT } = await import("./route"));
});

test("devices route is POST-only, uncached, and never returns token material", async () => {
  const res = await POST(
    new Request("http://localhost:3000/api/inventory/mobile/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "register" }),
    }),
  );
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("cache-control"), "no-store, private");
  const json = await res.json();
  assert.deepEqual(json, { ok: false, code: "dependency_not_configured" });
  assert.equal(JSON.stringify(json).includes("enroll"), false);
  assert.equal((await GET()).status, 405);
  assert.equal((await PUT()).status, 405);
});

test("device success payloads pass through unchanged with 200 and no-store", async () => {
  const send = (operation: string) =>
    POST(
      new Request("http://localhost:3000/api/inventory/mobile/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation }),
      }),
    );
  const registered = await send("register-success-shape");
  assert.equal(registered.status, 200);
  assert.equal(registered.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(await registered.json(), {
    ok: true,
    operation: "register",
    accepted: true,
    deviceId: "D".repeat(43),
  });
  const revoked = await send("revoke-device-success-shape");
  assert.equal(revoked.status, 200);
  assert.deepEqual(await revoked.json(), {
    ok: true,
    operation: "revoke_device",
    accepted: true,
  });
});

test("D4 foundation route remains the Origin-enforced Foundation entry", () => {
  const foundation = readFileSync(
    "src/app/api/inventory/foundation/route.ts",
    "utf8",
  );
  assert.match(foundation, /mutationOriginAllowed/);
  assert.equal(
    readFileSync("src/app/api/inventory/mobile/devices/route.ts", "utf8").includes(
      "mutationOriginAllowed",
    ),
    false,
  );
});
