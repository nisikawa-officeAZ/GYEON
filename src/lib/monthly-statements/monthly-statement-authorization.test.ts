// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — source-scan authorization matrix test.
//
// Static assertions over the B3 migration's RLS/grant matrix. Executable role behavior is reserved for
// B3-V1; here we prove the policy SHAPE: super_admin is read-only, gyeon_admin/logistics_admin get no
// cross-tenant access, anon gets nothing, and the finance write policies exist per table.
//
// Run: node --import tsx --test src/lib/monthly-statements/monthly-statement-authorization.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIG_DIR = "supabase/migrations";
const MIG_FILE = readdirSync(MIG_DIR).find((f) => f.endsWith("_payment_allocations_receipts_adjustments.sql"));
assert.ok(MIG_FILE, "the B3 migration file must exist");

const SQL = readFileSync(`${MIG_DIR}/${MIG_FILE}`, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "").toLowerCase();

const NEW_TABLES = ["payments", "payment_allocations", "monthly_statement_adjustments", "monthly_statement_receipts"];

// Each `create policy NAME on public.TABLE ... ;` has no interior semicolons, so `;` delimits it.
type Policy = { name: string; table: string; body: string };
const POLICIES: Policy[] = [];
for (const m of SQL.matchAll(/create policy (\w+) on public\.(\w+)([\s\S]*?);/g)) {
  POLICIES.push({ name: m[1], table: m[2], body: m[3] });
}

test("1. RLS is enabled on payments and all three new tables", () => {
  for (const t of NEW_TABLES) {
    assert.match(SQL, new RegExp(`alter table public\\.${t}\\s+enable row level security`), t);
  }
});

test("2. anon receives no privileges on payments or any new table", () => {
  for (const t of NEW_TABLES) {
    assert.match(SQL, new RegExp(`revoke all on public\\.${t}\\s+from anon`), t);
  }
});

test("3. super_admin appears ONLY in SELECT policies (read-only), never in a write policy", () => {
  const withSuper = POLICIES.filter((p) => /super_admin/.test(p.body));
  assert.ok(withSuper.length > 0, "at least one select policy grants super_admin read");
  for (const p of withSuper) {
    assert.ok(p.name.endsWith("_select"), `super_admin only in select policies, found in ${p.name}`);
  }
  // No INSERT/UPDATE/DELETE policy mentions super_admin.
  for (const p of POLICIES) {
    if (!p.name.endsWith("_select")) {
      assert.doesNotMatch(p.body, /super_admin/, `${p.name} (write) must not grant super_admin`);
    }
  }
});

test("4. no policy grants gyeon_admin or logistics_admin cross-tenant access", () => {
  for (const p of POLICIES) {
    assert.doesNotMatch(p.body, /gyeon/, `${p.name} must not reference gyeon`);
    assert.doesNotMatch(p.body, /logistic/, `${p.name} must not reference logistics`);
  }
});

test("5. finance write policies enforce active owner/manager with dealer_staff precedence + member fallback", () => {
  const writes = POLICIES.filter((p) => /_insert$|_update$|_delete$/.test(p.name));
  // payments + payment_allocations + monthly_statement_adjustments each get 3 write policies (receipts
  // is system-owned and has none) → 9. Receipts intentionally has no write policy.
  assert.equal(writes.length, 9, `expected 9 finance write policies (got ${writes.length})`);
  for (const p of writes) {
    assert.match(p.body, /dealer_staff/, `${p.name} checks dealer_staff`);
    assert.match(p.body, /'active'/, `${p.name} requires active`);
    assert.match(p.body, /'owner'\s*,\s*'manager'/, `${p.name} restricts to owner/manager`);
    assert.match(p.body, /dealer_members/, `${p.name} has the member fallback`);
    assert.match(p.body, /not exists/, `${p.name} gives dealer_staff precedence`);
  }
});

test("6. payments has all four finance policies; receipts has ONLY a select policy", () => {
  const byTable = (t: string) => POLICIES.filter((p) => p.table === t).map((p) => p.name).sort();
  assert.deepEqual(byTable("payments"),
    ["payments_delete", "payments_insert", "payments_select", "payments_update"]);
  assert.deepEqual(byTable("monthly_statement_receipts"), ["monthly_statement_receipts_select"]);
  // payment_allocations + adjustments get the full finance CRUD set.
  assert.equal(byTable("payment_allocations").length, 4);
  assert.equal(byTable("monthly_statement_adjustments").length, 4);
});

test("7. SELECT policies grant read to active staff/member roles and read-only super_admin", () => {
  const selects = POLICIES.filter((p) => p.name.endsWith("_select"));
  for (const p of selects) {
    assert.match(p.body, /'owner'\s*,\s*'manager'\s*,\s*'staff'\s*,\s*'readonly'/, `${p.name} read roles`);
    assert.match(p.body, /admin_users/, `${p.name} allows super_admin read`);
  }
});
