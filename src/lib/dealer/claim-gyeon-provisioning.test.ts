// GYEON-PARTNER-ONBOARD-F1 — the shared claim convergence service.
//
// Run: node --import tsx --test src/lib/dealer/claim-gyeon-provisioning.test.ts
//
// The "use server" action transitively imports the server/admin Supabase
// clients, so it cannot execute under node:test. Its contract — session-only
// inputs, gate-before-database, the atomic SQL transaction it delegates to —
// is pinned from source, including the migration.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const SRC = "src/lib/dealer/claim-gyeon-provisioning.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const stripSql = (s: string) => s.replace(/--.*$/gm, "");

function migrationSource(): string {
  const dir = "supabase/migrations";
  const file = readdirSync(dir).find((f) => f.endsWith("_gyeon_dealer_provisioning.sql"));
  assert.ok(file, "the provisioning migration exists exactly by suffix");
  return readFileSync(`${dir}/${file}`, "utf8");
}

function claimFunctionSlice(): string {
  const sql = stripSql(migrationSource());
  const start = sql.indexOf("create or replace function public.claim_gyeon_provisioning");
  assert.ok(start >= 0);
  const end = sql.indexOf("create or replace function", start + 1);
  return sql.slice(start, end === -1 ? undefined : end);
}

// ── Action source boundary ───────────────────────────────────────────────────

test("1. zero-argument server action: nothing applicant-controlled can enter", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /^"use server";/m);
  assert.match(code, /export async function claimGyeonProvisioning\(\): Promise<ClaimGyeonProvisioningResult>/,
    "the claim takes no parameters");
});

test("2. the server-only feature gate runs BEFORE any database client", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const gateAt = code.indexOf("if (!isGyeonPartnerOnboardingEnabled()) return { kind: \"disabled\" }");
  const serverClientAt = code.indexOf("await createClient()");
  const adminAt = code.indexOf("createAdminClient()");
  assert.ok(gateAt >= 0 && serverClientAt >= 0 && adminAt >= 0);
  assert.ok(gateAt < serverClientAt && gateAt < adminAt,
    "on SaaS the action returns before touching any client");
});

test("3. identity is the verified session user, nothing else", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /supabase\.auth\.getUser\(\)/);
  assert.match(code, /if \(!user\.email \|\| !user\.email_confirmed_at\) return \{ kind: "not-verified" \}/,
    "unverified sessions never reach the claim");
  assert.match(code, /p_user_id: user\.id/);
  assert.match(code, /p_email: user\.email/);
  const rpcCalls = code.match(/\.rpc\(/g) ?? [];
  assert.equal(rpcCalls.length, 1, "exactly one RPC — the atomic claim transaction");
  assert.match(code, /\.rpc\("claim_gyeon_provisioning"/);
  for (const forbidden of ["user_metadata", "app_metadata", "detailer_rank", "role", "searchParams", "formData"]) {
    assert.equal(code.includes(forbidden), false, `forbidden authorization input: ${forbidden}`);
  }
});

test("4. every SQL outcome maps to a typed kind; unknown falls to error", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  for (const outcome of ["claimed", "no-match", "already-claimed", "already-member", "revoked"]) {
    assert.ok(code.includes(`"${outcome}"`), `outcome mapped: ${outcome}`);
  }
  assert.match(code, /default:\s+return \{ kind: "error" \}/);
});

// ── The atomic claim transaction (migration pins) ────────────────────────────

test("5. winner gate: registered + unclaimed ONLY — invitation_state is absent from the entire claim body", () => {
  const body = claimFunctionSlice();
  assert.match(body, /provisioning_status = 'registered'/);
  assert.match(body, /claimed_at is null/);
  assert.equal(body.includes("invitation_state"), false,
    "the delivery state machine never gates the claim");
});

test("6. the winner gate precedes every dealer/membership write", () => {
  const body = claimFunctionSlice();
  const gateAt = body.indexOf("update public.gyeon_dealer_provisioning");
  const dealerWriteAt = body.indexOf("update public.dealers");
  const dealerInsertAt = body.indexOf("insert into public.dealers");
  const memberAt = body.indexOf("insert into public.dealer_members");
  assert.ok(gateAt >= 0 && dealerWriteAt >= 0 && dealerInsertAt >= 0 && memberAt >= 0);
  assert.ok(gateAt < dealerWriteAt && gateAt < dealerInsertAt && gateAt < memberAt,
    "no dealer or membership row can persist unless this transaction owns the record");
});

test("7. both arms create the owner membership INVITED — never active", () => {
  const body = claimFunctionSlice();
  assert.match(body, /values \(v_dealer_id, p_user_id, 'owner', 'invited'\)/);
  assert.match(body, /do update set role = 'owner', status = 'invited'/);
  const insertAt = body.indexOf("insert into public.dealer_members");
  assert.ok(insertAt >= 0);
  const memberWrite = body.slice(insertAt, body.indexOf(";", insertAt));
  assert.equal(memberWrite.includes("'active'"), false,
    "the claim never activates a membership; only profile completion does");
});

test("8. approved_by is the REAL recording superAdmin; rank/name come from the operator record", () => {
  const body = claimFunctionSlice();
  assert.match(body, /approved_by\s+= v_rec\.created_by_admin_id/,
    "arm A approval is attributed to the record's creator");
  assert.match(body, /name\s+= v_rec\.shop_name/);
  assert.match(body, /detailer_rank\s+= v_rec\.detailer_rank/);
  assert.match(body, /'approved', v_rec\.created_by_admin_id/,
    "arm B creation is attributed identically");
  assert.match(body, /insert into public\.dealer_settings \(dealer_id, detailer_rank, updated_at\)/,
    "rank write-through mirrors the manual approval path");
});

test("9. fail-closed branches and in-transaction audit", () => {
  const body = claimFunctionSlice();
  assert.match(body, /dm\.status in \('active', 'invited'\)/, "existing members never claim a second shop");
  assert.match(body, /'already-claimed'/);
  assert.match(body, /'revoked'/);
  assert.match(body, /'no-match'/);
  assert.match(body, /gyeon_claim_dealer_conflict/, "a live non-pending dealer on the email aborts the transaction");
  assert.match(body, /insert into public\.admin_audit_logs/);
  assert.match(body, /'gyeon_provisioning_claimed'/);
});

test("F2-01a. the transaction revalidates identity against auth.users BEFORE any mutation", () => {
  const body = claimFunctionSlice();
  const identityAt = body.indexOf("from auth.users u");
  const winnerGateAt = body.indexOf("update public.gyeon_dealer_provisioning");
  assert.ok(identityAt >= 0 && winnerGateAt >= 0);
  assert.ok(identityAt < winnerGateAt, "identity check precedes the winner gate and every write");
  assert.match(body, /u\.id = p_user_id/);
  assert.match(body, /lower\(btrim\(coalesce\(u\.email, ''\)\)\) = v_email/, "normalized-email equality");
  assert.match(body, /u\.email_confirmed_at is not null/, "unconfirmed emails are refused");
  assert.match(body, /'identity-mismatch'/, "the refusal is a typed zero-write outcome");
});

test("F2-01b. the server service maps the identity refusal explicitly", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.match(code, /case "identity-mismatch": return \{ kind: "identity-mismatch" \}/);
  assert.match(code, /\| \{ kind: "identity-mismatch" \}/, "the outcome is part of the typed union");
});

test("F2-02. arm A requires OWNERSHIP — a pending dealer of another user is a conflict, never reassigned", () => {
  const body = claimFunctionSlice();
  const armA = body.slice(body.indexOf("select d.id into v_dealer_id"), body.indexOf("if found then"));
  assert.match(armA, /d\.owner_user_id = p_user_id/, "the pending dealer must belong to the claimant");
  // The fall-through conflict guard still aborts on ANY other live dealer with
  // this email — including a pending dealer owned by someone else.
  assert.match(body, /gyeon_claim_dealer_conflict/);
  const conflictAt = body.indexOf("gyeon_claim_dealer_conflict");
  const armBInsertAt = body.indexOf("insert into public.dealers");
  assert.ok(conflictAt < armBInsertAt, "the conflict abort precedes the create arm");
});

test("F2-08. /no-dealer is fully gate-isolated: with the flag off there is no claim, no admin client, and no /shop-profile redirect", () => {
  const page = strip(readFileSync("src/app/no-dealer/page.tsx", "utf8"));
  assert.match(page, /import \{ isGyeonPartnerOnboardingEnabled \} from "@\/lib\/gyeon\/partner-onboarding-enabled"/);
  const gateAt = page.indexOf("if (isGyeonPartnerOnboardingEnabled())");
  const claimAt = page.indexOf("await claimGyeonProvisioning()");
  const adminAt = page.indexOf("createAdminClient()");
  const redirectAt = page.indexOf('redirect("/shop-profile")');
  assert.ok(gateAt >= 0 && claimAt >= 0 && adminAt >= 0 && redirectAt >= 0);
  assert.ok(gateAt < claimAt && gateAt < adminAt && gateAt < redirectAt,
    "every GYEON operation sits inside the gate block");
  assert.equal((page.match(/redirect\("\/shop-profile"\)/g) ?? []).length, 1,
    "exactly one /shop-profile edge exists and it is gated");
  // Loop impossibility: with the gate off, /shop-profile redirects back to
  // /no-dealer, and /no-dealer (gated above) never redirects to /shop-profile.
  const shopProfile = strip(readFileSync("src/app/shop-profile/page.tsx", "utf8"));
  const spGateAt = shopProfile.indexOf('if (!isGyeonPartnerOnboardingEnabled()) redirect("/no-dealer")');
  assert.ok(spGateAt >= 0, "/shop-profile fails closed to /no-dealer when disabled");
});

test("F4. auth.users access is EXACTLY a three-column SELECT grant to service_role", () => {
  const sql = stripSql(migrationSource());

  // STATEMENT-level extraction (F4-R1): a SQL statement can span any number of
  // lines and ends at its first semicolon, so grants are extracted as complete
  // semicolon-terminated statements from the comment-stripped text — a
  // line-based scan would let a multiline grant slip through.
  const extractAuthUsersGrants = (text: string): string[] =>
    (text.match(/\bgrant\b[^;]*;/gi) ?? [])
      .map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())
      .filter((s) => s.includes("auth.users"));

  const authGrants = extractAuthUsersGrants(sql);
  assert.deepEqual(authGrants,
    ["grant select (id, email, email_confirmed_at) on table auth.users to service_role;"],
    "exactly one canonical auth.users statement — no table-wide SELECT, no extra column, no second grant");

  // Negative control (in-memory): the extractor DOES capture a hostile grant
  // whose grant keyword, auth.users reference, and target role sit on three
  // separate lines — so a multiline table-wide SELECT would be extracted and
  // would FAIL the exact-array comparison above.
  const hostileMultiline = "grant select\n  on table auth.users\n  to service_role;";
  const control = extractAuthUsersGrants(hostileMultiline);
  assert.deepEqual(control, ["grant select on table auth.users to service_role;"],
    "the statement extractor recognizes a GRANT split across lines");
  assert.notDeepEqual(control, authGrants,
    "and that table-wide form is NOT the accepted canonical statement");

  // No non-SELECT privilege is ever granted on auth.users.
  for (const priv of ["insert", "update", "delete", "truncate", "references", "trigger"]) {
    assert.equal(authGrants.some((s) => s.includes(priv)), false,
      `no ${priv} privilege on auth.users`);
  }
  // No auth.users privilege reaches public, anon, or authenticated.
  for (const role of ["to public", "to anon", "to authenticated"]) {
    assert.equal(authGrants.some((s) => s.includes(role)), false,
      `auth.users never granted ${role}`);
  }
  // The grant precedes the SECURITY INVOKER functions that depend on it.
  const grantAt = sql.indexOf("grant select (id, email, email_confirmed_at) on table auth.users");
  const firstFnAt = sql.indexOf("create or replace function public.claim_gyeon_provisioning");
  assert.ok(grantAt >= 0 && firstFnAt >= 0 && grantAt < firstFnAt,
    "the privilege provision sits in the security section before the functions");
});

test("10. the claim function is SECURITY INVOKER and service_role-only", () => {
  const sql = stripSql(migrationSource());
  assert.match(sql, /claim_gyeon_provisioning[\s\S]{0,400}security invoker/);
  assert.match(sql, /revoke execute on function public\.claim_gyeon_provisioning\(uuid, text\)\s+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.claim_gyeon_provisioning\(uuid, text\)\s+to service_role/);
});
