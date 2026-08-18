// PERF-A regression contract for request-scoped auth reuse and dashboard
// parallelism.
//
// Run: node --import tsx --test src/lib/auth/request-auth-performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("current user is memoized only through React request cache", () => {
  const code = strip(read("src/lib/auth/get-current-user.ts"));

  assert.match(code, /import\s*\{\s*cache\s*\}\s*from\s*"react"/);
  assert.match(code, /async function resolveCurrentUser\(\)/);
  assert.match(code, /export const getCurrentUser = cache\(resolveCurrentUser\)/);
  assert.equal(code.includes("unstable_cache"), false);
  assert.equal(code.includes("revalidate"), false);
});

test("active dealer membership shares the same request-scoped snapshot", () => {
  const code = strip(read("src/lib/auth/get-current-dealer.ts"));

  assert.match(code, /import\s*\{\s*cache\s*\}\s*from\s*"react"/);
  assert.match(code, /async function resolveCurrentDealer\(\): Promise<DealerMembership \| null>/);
  assert.match(code, /export const getCurrentDealer = cache\(resolveCurrentDealer\)/);
  assert.match(code, /\.eq\("user_id", user\.id\)[\s\S]*?\.eq\("status", "active"\)/);
  assert.equal(code.includes("unstable_cache"), false);
  assert.equal(code.includes("createAdminClient"), false);
  assert.equal(code.includes("service_role"), false);
});

test("dashboard keeps the admin gate first and starts independent reads together", () => {
  const code = strip(read("src/app/dashboard/page.tsx"));
  const adminAt = code.indexOf("const admin = await getCurrentAdmin()");
  const redirectAt = code.indexOf('if (admin) redirect("/admin/dashboard")');
  const parallelAt = code.indexOf("const [dealer, staffInfo, dash] = await Promise.all([");
  const dealerAt = code.indexOf("getCurrentDealer()", parallelAt);
  const staffAt = code.indexOf("getCurrentStaff().catch(() => null)", parallelAt);
  const summaryAt = code.indexOf("getDashboardSummary()", parallelAt);
  const noDealerAt = code.indexOf("if (!dealer)", parallelAt);

  assert.ok(adminAt >= 0 && redirectAt > adminAt, "super-admin gate must remain first");
  assert.ok(parallelAt > redirectAt, "dealer reads start only after the admin gate");
  assert.ok(dealerAt > parallelAt && staffAt > dealerAt && summaryAt > staffAt);
  assert.ok(noDealerAt > summaryAt, "membership decision is checked after the shared reads settle");
});
