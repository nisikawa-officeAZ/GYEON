import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

const fetchCalls: Array<{ url: string; authorization: string | null }> = [];
let fetchResult: { ok: boolean; body: unknown } = {
  ok: true,
  body: { id: "auth-user-1" },
};
let fetchThrows = false;

mock.module("server-only", { namedExports: {} });

type Bearer = typeof import("./resolve-office-az-inventory-mobile-bearer");
let parseAuthorizationBearerHeader: Bearer["parseAuthorizationBearerHeader"];
let createOfficeAzInventoryMobileBearerClient: Bearer["createOfficeAzInventoryMobileBearerClient"];
let resolveOfficeAzInventoryMobileBearer: Bearer["resolveOfficeAzInventoryMobileBearer"];

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const authorization =
      init && init.headers && typeof init.headers === "object" && "Authorization" in init.headers
        ? String((init.headers as { Authorization?: string }).Authorization ?? null)
        : null;
    fetchCalls.push({ url, authorization });
    if (fetchThrows) throw new Error("hidden auth detail");
    return {
      ok: fetchResult.ok,
      json: async () => fetchResult.body,
    } as Response;
  }) as typeof fetch;
  ({
    parseAuthorizationBearerHeader,
    createOfficeAzInventoryMobileBearerClient,
    resolveOfficeAzInventoryMobileBearer,
  } = await import("./resolve-office-az-inventory-mobile-bearer"));
});

test("exact Bearer header is required", () => {
  assert.equal(parseAuthorizationBearerHeader(null), null);
  assert.equal(parseAuthorizationBearerHeader(""), null);
  assert.equal(parseAuthorizationBearerHeader("bearer token"), null);
  assert.equal(parseAuthorizationBearerHeader("Basic abc"), null);
  assert.equal(parseAuthorizationBearerHeader("Bearer"), null);
  assert.equal(parseAuthorizationBearerHeader("Bearer "), null);
  assert.equal(parseAuthorizationBearerHeader("Bearer  token"), null);
  assert.equal(parseAuthorizationBearerHeader("Bearer token extra"), null);
  assert.equal(parseAuthorizationBearerHeader("Bearer a, Bearer b"), null);
  assert.equal(parseAuthorizationBearerHeader("Bearer good-token"), "good-token");
});

test("bearer resolver never treats a missing or lookalike header as authenticated", async () => {
  fetchCalls.length = 0;
  assert.deepEqual(await resolveOfficeAzInventoryMobileBearer(null), {
    tag: "denied",
    code: "UNAUTHENTICATED",
  });
  assert.deepEqual(await resolveOfficeAzInventoryMobileBearer("Token abc"), {
    tag: "denied",
    code: "UNAUTHENTICATED",
  });
  assert.deepEqual(fetchCalls, []);
});

test("valid bearer uses a token-scoped user lookup and returns only userId", async () => {
  fetchCalls.length = 0;
  fetchResult = { ok: true, body: { id: "auth-user-1" } };
  const resolved = await resolveOfficeAzInventoryMobileBearer("Bearer supabase-jwt");
  assert.deepEqual(resolved, { tag: "authenticated", userId: "auth-user-1" });
  assert.deepEqual(fetchCalls, [{
    url: "https://example.supabase.test/auth/v1/user",
    authorization: "Bearer supabase-jwt",
  }]);
  assert.equal(JSON.stringify(resolved).includes("supabase-jwt"), false);
  const client = createOfficeAzInventoryMobileBearerClient("Bearer supabase-jwt");
  assert.equal(client === null, false);
  fetchResult = {
    ok: true,
    body: { candidates: [], knownLocationIds: [] },
  };
  if (client) {
    await client.rpc("resolve_office_az_inventory_authority", {
      p_actor_id: "actor-1",
      p_operator_id: "operator-1",
    });
  }
  assert.deepEqual(fetchCalls[1], {
    url: "https://example.supabase.test/rest/v1/rpc/resolve_office_az_inventory_authority",
    authorization: "Bearer supabase-jwt",
  });
});

test("null user, auth error, and thrown client fail closed without token leakage", async () => {
  fetchResult = { ok: true, body: { id: null } };
  assert.deepEqual(await resolveOfficeAzInventoryMobileBearer("Bearer stolen"), {
    tag: "denied",
    code: "UNAUTHENTICATED",
  });
  fetchResult = { ok: false, body: { message: "bad" } };
  assert.deepEqual(await resolveOfficeAzInventoryMobileBearer("Bearer stolen"), {
    tag: "denied",
    code: "UNAUTHENTICATED",
  });
  fetchThrows = true;
  const denied = await resolveOfficeAzInventoryMobileBearer("Bearer stolen");
  assert.deepEqual(denied, { tag: "denied", code: "UNAUTHENTICATED" });
  assert.equal(JSON.stringify(denied).includes("stolen"), false);
  fetchThrows = false;
});
