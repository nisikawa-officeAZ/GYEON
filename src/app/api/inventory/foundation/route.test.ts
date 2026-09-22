import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

mock.module("server-only", {
  namedExports: {},
});

mock.module("../../../../lib/inventory/foundation/foundation-server-actions.js", {
  namedExports: {
    FOUNDATION_BOUNDARY_MAX_BODY_BYTES: 32768,
    publicStatusFor: (code: string) => {
      if (code === "invalid_request") return 400;
      if (code === "operator_authority_not_configured") return 403;
      if (code === "dependency_not_configured") return 503;
      return 400;
    },
    executeFoundationServerBoundary: async () => ({
      ok: false,
      code: "operator_authority_not_configured",
    }),
  },
});

type Route = typeof import("./route");
let GET: Route["GET"];
let POST: Route["POST"];
let PUT: Route["PUT"];
let HEAD: Route["HEAD"];
let OPTIONS: Route["OPTIONS"];
let isExactJsonMediaType: Route["isExactJsonMediaType"];
let mutationOriginAllowed: Route["mutationOriginAllowed"];

before(async () => {
  ({ GET, POST, PUT, HEAD, OPTIONS, isExactJsonMediaType, mutationOriginAllowed } =
    await import("./route.js"));
});

function originUrl() {
  return "http://localhost:3000/api/inventory/foundation";
}

test("route is dynamic and does not export a Server Action", () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "route.ts"),
    "utf8",
  );
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /no-store, private/);
  assert.equal(source.includes('"use server"'), false);
  assert.equal(source.includes("createAdminClient"), false);
  assert.equal(source.includes("getSession"), false);
});

test("media type match is exact and rejects lookalikes", () => {
  assert.equal(isExactJsonMediaType("application/json"), true);
  assert.equal(isExactJsonMediaType("application/json; charset=utf-8"), true);
  assert.equal(isExactJsonMediaType("application/jsonp"), false);
  assert.equal(isExactJsonMediaType("text/plain; x=application/json"), false);
  assert.equal(isExactJsonMediaType(null), false);
});

test("mutations require a present same-origin Origin", () => {
  const same = new Request(originUrl(), {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
  const missing = new Request(originUrl(), { method: "POST" });
  const foreign = new Request(originUrl(), {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  assert.equal(mutationOriginAllowed(same), true);
  assert.equal(mutationOriginAllowed(missing), false);
  assert.equal(mutationOriginAllowed(foreign), false);
});

test("unknown methods are 405", async () => {
  const res = await PUT();
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("cache-control"), "no-store, private");
  assert.equal(res.headers.get("allow"), "GET, POST");
});

test("HEAD and OPTIONS are explicit 405", async () => {
  for (const res of [await HEAD(), await OPTIONS()]) {
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("cache-control"), "no-store, private");
    assert.equal(res.headers.get("allow"), "GET, POST");
  }
});

test("POST without origin is invalid_request", async () => {
  const res = await POST(
    new Request(originUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, code: "invalid_request" });
  assert.equal(res.headers.get("cache-control"), "no-store, private");
});

test("POST with wrong media type is invalid_request", async () => {
  const res = await POST(
    new Request(originUrl(), {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/jsonp",
      },
      body: "{}",
    }),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, code: "invalid_request" });
});

test("oversized POST is 413", async () => {
  const res = await POST(
    new Request(originUrl(), {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "content-length": "40000",
      },
      body: "{}",
    }),
  );
  assert.equal(res.status, 413);
});

test("GET extra query keys fail closed", async () => {
  const res = await GET(
    new Request(`${originUrl()}?actorId=a&operatorId=b&role=owner`),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, code: "invalid_request" });
  assert.equal(res.headers.get("cache-control"), "no-store, private");
});

test("GET client requestId is rejected", async () => {
  const res = await GET(
    new Request(`${originUrl()}?actorId=a&operatorId=b&requestId=client`),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { ok: false, code: "invalid_request" });
});

test("authenticated responses stay private and uncached", async () => {
  const res = await GET(new Request(`${originUrl()}?actorId=actor-1&operatorId=operator-1&expectedAuthorityVersion=1&requiredLocationIds=loc-1&requestId=req-1`));
  assert.equal(res.headers.get("cache-control"), "no-store, private");
});
