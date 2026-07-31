// GYEON-PARTNER-ONBOARD-F1 — atomic shop-profile completion (invited → active).
//
// Run: node --import tsx --test src/lib/dealer/complete-gyeon-shop-profile.test.ts
//
// The "use server" action cannot execute under node:test (server client
// imports); its contract and the atomic transaction it delegates to are
// pinned from source.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const SRC = "src/lib/dealer/complete-gyeon-shop-profile.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const stripSql = (s: string) => s.replace(/--.*$/gm, "");

function completionSlice(): string {
  const dir = "supabase/migrations";
  const file = readdirSync(dir).find((f) => f.endsWith("_gyeon_dealer_provisioning.sql"));
  assert.ok(file);
  const sql = stripSql(readFileSync(`${dir}/${file}`, "utf8"));
  const start = sql.indexOf("create or replace function public.complete_gyeon_shop_profile");
  assert.ok(start >= 0);
  const end = sql.indexOf("create or replace function", start + 1);
  return sql.slice(start, end === -1 ? undefined : end);
}

// ── Action source boundary ───────────────────────────────────────────────────

test("1. gate first, then the verified session — before any database access", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /^"use server";/m);
  const gateAt = code.indexOf('if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" }');
  const clientAt = code.indexOf("await createClient()");
  const adminAt = code.indexOf("createAdminClient()");
  assert.ok(gateAt >= 0 && clientAt >= 0 && adminAt >= 0);
  assert.ok(gateAt < clientAt && gateAt < adminAt);
  assert.match(code, /if \(!user\.email_confirmed_at\) return \{ kind: "not-verified" \}/);
});

test("2. the caller supplies ONLY the three profile fields; required-field validation fails closed", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /input: \{\s*phone: string;\s*prefecture: string;\s*address: string;\s*\}/);
  assert.match(code, /if \(phone === ""\) return \{ kind: "invalid-input"/);
  assert.match(code, /if \(prefecture === ""\) return \{ kind: "invalid-input"/);
  assert.match(code, /if \(address === ""\) return \{ kind: "invalid-input"/);
  // The input type above is the complete client surface: no dealer id, role,
  // rank, or status field exists for a caller to supply.
  const inputShape = code.match(/input: \{[\s\S]*?\}/)?.[0] ?? "";
  for (const forbidden of ["dealer", "role", "rank", "status"]) {
    assert.equal(inputShape.includes(forbidden), false,
      `no client-controlled authorization field may exist in the input: ${forbidden}`);
  }
});

test("3. exactly one RPC — the atomic completion transaction; no direct table writes", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const rpcCalls = code.match(/\.rpc\(/g) ?? [];
  assert.equal(rpcCalls.length, 1);
  assert.match(code, /\.rpc\("complete_gyeon_shop_profile"/);
  assert.equal(code.includes(".from("), false, "all writes live inside the SQL transaction");
  assert.match(code, /p_user_id: user\.id/, "identity is the session user");
});

test("4. outcomes map to typed kinds", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  for (const kind of ["completed", "not-eligible", "already-active", "invalid-input", "error"]) {
    assert.ok(code.includes(`"${kind}"`), kind);
  }
});

// ── The atomic transaction (migration pins) ──────────────────────────────────

test("5. eligibility: the INVITED owner membership on a live dealer, locked FOR UPDATE", () => {
  const body = completionSlice();
  assert.match(body, /dm\.role\s+= 'owner'/);
  assert.match(body, /dm\.status\s+= 'invited'/);
  assert.match(body, /d\.deleted_at is null/);
  assert.match(body, /for update of dm/);
  assert.match(body, /'not-eligible'/);
  assert.match(body, /'already-active'/);
});

test("6. the transition writes the three required fields and activates atomically", () => {
  const body = completionSlice();
  const fieldsAt = body.indexOf("update public.dealers");
  const activateAt = body.indexOf("set status = 'active'");
  assert.ok(fieldsAt >= 0 && activateAt >= 0 && fieldsAt < activateAt);
  assert.match(body, /phone\s+= btrim\(p_phone\)/);
  assert.match(body, /prefecture = btrim\(p_prefecture\)/);
  assert.match(body, /address\s+= btrim\(p_address\)/);
  assert.match(body, /where id = v_member_id and status = 'invited'/,
    "activation is guarded — only the invited row can transition");
  assert.match(body, /get diagnostics v_rows = row_count/);
  assert.match(body, /raise exception/,
    "a lost activation row aborts the WHOLE transaction — the field writes roll back too");
});

test("7. empty required fields are rejected inside the transaction as well", () => {
  const body = completionSlice();
  assert.match(body, /btrim\(coalesce\(p_phone, ''\)\)\s+= ''/);
  assert.match(body, /btrim\(coalesce\(p_prefecture, ''\)\) = ''/);
  assert.match(body, /btrim\(coalesce\(p_address, ''\)\)\s+= ''/);
  assert.match(body, /'invalid-input'/);
});

test("F2-03a. the transaction revalidates the auth.users identity before any mutation", () => {
  const body = completionSlice();
  const identityAt = body.indexOf("from auth.users u");
  const memberLookupAt = body.indexOf("from public.dealer_members dm");
  const dealerWriteAt = body.indexOf("update public.dealers");
  assert.ok(identityAt >= 0 && memberLookupAt >= 0 && dealerWriteAt >= 0);
  assert.ok(identityAt < memberLookupAt && identityAt < dealerWriteAt);
  assert.match(body, /u\.email_confirmed_at is not null/);
  assert.match(body, /'identity-mismatch'/);
});

test("F2-03b. membership, provisioning record, and claimant must belong together; unresolved audit actor fails closed", () => {
  const body = completionSlice();
  const relationAt = body.indexOf("g.claimed_by_user_id = p_user_id");
  const dealerRelAt = body.indexOf("g.claimed_dealer_id  = v_dealer_id");
  const failClosedAt = body.indexOf("if not found or v_admin_id is null then");
  const dealerWriteAt = body.indexOf("update public.dealers");
  assert.ok(relationAt >= 0 && dealerRelAt >= 0 && failClosedAt >= 0 && dealerWriteAt >= 0);
  assert.ok(relationAt < dealerWriteAt && failClosedAt < dealerWriteAt,
    "the provisioning relationship and audit actor resolve BEFORE any mutation — or nothing is written");
  assert.match(body, /g\.provisioning_status = 'claimed'/);
});

test("F2-03c. the server service maps the identity refusal explicitly", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /case "identity-mismatch": return \{ kind: "identity-mismatch" \}/);
  assert.match(code, /\| \{ kind: "identity-mismatch" \}/);
});

test("8. audit row inside the transaction; SECURITY INVOKER; service_role-only EXECUTE", () => {
  const body = completionSlice();
  assert.match(body, /insert into public\.admin_audit_logs/);
  assert.match(body, /'gyeon_shop_profile_completed'/);
  assert.match(body, /security invoker/);
  assert.match(body, /revoke execute on function public\.complete_gyeon_shop_profile\(uuid, text, text, text\)\s+from public, anon, authenticated/);
  assert.match(body, /grant execute on function public\.complete_gyeon_shop_profile\(uuid, text, text, text\)\s+to service_role/);
});
