// GYEON-PARTNER-ONBOARD-F1 — the shared dealer-shell guard.
//
// Run: node --import tsx --test src/lib/auth/require-active-dealer.test.ts
//
// The guard transitively imports the server Supabase client (next/headers), so
// it cannot execute under node:test; its contract is pinned from source, the
// same discipline as the other server-boundary tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = "src/lib/auth/require-active-dealer.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("1. derives identity ONLY from the session helpers", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /import \{ getCurrentUser \} from "@\/lib\/auth\/get-current-user"/);
  assert.match(code, /import \{ getCurrentDealer, type DealerMembership \} from "@\/lib\/auth\/get-current-dealer"/);
  assert.match(code, /export async function requireActiveDealer\(\): Promise<DealerMembership>/,
    "zero parameters — nothing client-controlled can enter the guard");
});

test("2. unauthenticated → /login, no ACTIVE membership → /no-dealer, else returns", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const userAt = code.indexOf("await getCurrentUser()");
  const loginAt = code.indexOf('redirect("/login")');
  const dealerAt = code.indexOf("await getCurrentDealer()");
  const noDealerAt = code.indexOf('redirect("/no-dealer")');
  const returnAt = code.indexOf("return dealer");
  assert.ok(userAt >= 0 && loginAt >= 0 && dealerAt >= 0 && noDealerAt >= 0 && returnAt >= 0);
  assert.ok(userAt < loginAt, "user resolution precedes the login redirect");
  assert.ok(loginAt < dealerAt, "membership is resolved only for authenticated users");
  assert.ok(dealerAt < noDealerAt && noDealerAt < returnAt, "active membership gates the return");
});

test("3. market-neutral: no env flag, market profile, or brand value in the guard", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  for (const forbidden of ["process.env", "DEALEROS_MARKET", "getActiveMarket", "NEXT_PUBLIC", "brand"]) {
    assert.equal(code.includes(forbidden), false, `guard must not read: ${forbidden}`);
  }
});
