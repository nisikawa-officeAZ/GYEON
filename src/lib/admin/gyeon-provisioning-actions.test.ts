// GYEON-PARTNER-ONBOARD-F1 — superAdmin provisioning actions, CSV import
// actions, and the provisioning table/import transaction.
//
// Run: node --import tsx --test src/lib/admin/gyeon-provisioning-actions.test.ts
//
// The "use server" actions cannot execute under node:test; the state-machine
// transitions, gate ordering, and invitation-recovery contract are pinned from
// source (actions + migration), the pure logic being proven behaviorally in
// gyeon-provisioning-csv-core.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ACTIONS_SRC = "src/lib/admin/gyeon-provisioning-actions.ts";
const CSV_SRC = "src/lib/admin/gyeon-provisioning-csv.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const stripSql = (s: string) => s.replace(/--.*$/gm, "");

function migrationSource(): string {
  const dir = "supabase/migrations";
  const file = readdirSync(dir).find((f) => f.endsWith("_gyeon_dealer_provisioning.sql"));
  assert.ok(file, "the provisioning migration exists");
  return readFileSync(`${dir}/${file}`, "utf8");
}

function functionBody(code: string, marker: string): string {
  const start = code.indexOf(marker);
  assert.ok(start >= 0, `found: ${marker}`);
  const next = code.indexOf("\nexport ", start + 1);
  const helper = code.indexOf("\nasync function ", start + 1);
  const candidates = [next, helper].filter((i) => i > start);
  const end = candidates.length > 0 ? Math.min(...candidates) : code.length;
  return code.slice(start, end);
}

// ── Gate + superAdmin on EVERY entry point ───────────────────────────────────

test("1. all provisioning entry points check the server gate before any table access", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const csv = strip(readFileSync(CSV_SRC, "utf8"));
  assert.match(actions, /^"use server";/m);
  assert.match(csv, /^"use server";/m);

  for (const [code, name] of [
    [actions, "export async function listGyeonProvisioning"],
    [actions, "export async function createGyeonProvisioning"],
    [actions, "async function runInviteDelivery"],
    [actions, "export async function reconcileGyeonProvisioningInvite"],
    [actions, "export async function revokeGyeonProvisioning"],
    [csv, "export async function dryRunGyeonProvisioningCsv"],
    [csv, "export async function confirmGyeonProvisioningCsv"],
  ] as const) {
    const body = functionBody(code, name);
    const gateAt = body.indexOf("isGyeonPartnerOnboardingEnabled()");
    assert.ok(gateAt >= 0, `${name} checks the gate`);
    const tableAt = body.indexOf("gyeon_dealer_provisioning");
    const rpcAt = body.indexOf(".rpc(");
    for (const accessAt of [tableAt, rpcAt]) {
      if (accessAt >= 0) assert.ok(gateAt < accessAt, `${name}: gate precedes table/RPC access`);
    }
    assert.ok(body.includes("requireSuperAdmin"), `${name} requires super_admin`);
  }

  // The two public invite wrappers delegate to the gated shared delivery.
  const send = functionBody(actions, "export async function sendGyeonProvisioningInvite");
  const resend = functionBody(actions, "export async function resendGyeonProvisioningInvite");
  assert.match(send, /runInviteDelivery\(id, \["none"\]/);
  assert.match(resend, /runInviteDelivery\(id, \["failed", "sent"\]/);
});

// ── Invitation recovery contract ─────────────────────────────────────────────

test("2. record-first ordering: 'pending' is committed BEFORE the ONLY invite call site", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const delivery = functionBody(actions, "async function runInviteDelivery");
  const pendingAt = delivery.indexOf('invitation_state: "pending"');
  const inviteAt = delivery.indexOf("inviteUserByEmail");
  assert.ok(pendingAt >= 0 && inviteAt >= 0 && pendingAt < inviteAt,
    "the provisioning record transitions before any Auth call");
  const callSites = actions.match(/inviteUserByEmail/g) ?? [];
  assert.equal(callSites.length, 1, "exactly one invitation call site in the app");
});

test("3. state settlement: sent stores the auth user id; exists → awaiting_claim; definite → failed; uncertain stays pending", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const delivery = functionBody(actions, "async function runInviteDelivery");
  assert.match(delivery, /invited_auth_user_id: invitedUserId/, "returned Auth user id is stored");
  assert.match(delivery, /invitation_state: "awaiting_claim"/);
  assert.match(delivery, /invitation_state: "failed"/);
  assert.match(delivery, /classifyGyeonInviteError/);
  // The uncertain branch records the observation WITHOUT a state transition:
  const uncertainAt = delivery.indexOf('return { kind: "uncertain" }');
  assert.ok(uncertainAt >= 0);
  const transitions = delivery.match(/invitation_state: "/g) ?? [];
  assert.equal(transitions.length, 4,
    "exactly pending/sent/awaiting_claim/failed transitions exist — none for uncertain");
});

test("4. no automatic resend: an uncertain 'pending' requires reconcile before any re-delivery", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const delivery = functionBody(actions, "async function runInviteDelivery");
  assert.match(delivery, /"reconcile-required"/);
  const pendingGuardAt = delivery.indexOf('existing.invitation_state === "pending"');
  const inviteAt = delivery.indexOf("inviteUserByEmail");
  assert.ok(pendingGuardAt >= 0 && pendingGuardAt < inviteAt);
});

test("5. reconcile settles WITHOUT sending: Auth is read-only there", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const reconcile = functionBody(actions, "export async function reconcileGyeonProvisioningInvite");
  assert.equal(reconcile.includes("inviteUserByEmail"), false, "reconcile never sends");
  assert.match(reconcile, /getUserById|listUsers/);
  assert.match(reconcile, /settleReconciliation\(/, "settlement goes through the pending-gated helper");
  const settleHelper = functionBody(actions, "async function settleReconciliation");
  assert.match(settleHelper, /\.eq\("invitation_state", "pending"\)/, "settlement is winner-gated on pending");
  assert.match(reconcile, /invited_auth_user_id: found\.id/, "a discovered user id is persisted");
});

test("F2-05a. every settlement demands database proof: no error AND exactly one affected row", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  for (const helper of ["async function settleInvitationState", "async function settleReconciliation"]) {
    const body = functionBody(actions, helper);
    assert.match(body, /\.select\("id"\)/, `${helper}: affected-row evidence is requested`);
    assert.match(body, /!error && Array\.isArray\(data\) && data\.length === 1/,
      `${helper}: both error and row count are checked`);
  }
});

test("F2-05b. 'sent' (and every settled kind) is never returned after a failed local transition", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const delivery = functionBody(actions, "async function runInviteDelivery");
  // Each settlement branch: settle → if (!settled) return uncertain → only then the settled kind.
  const sentReturnAt = delivery.indexOf('return { kind: "sent" }');
  assert.ok(sentReturnAt >= 0);
  const sentBlock = delivery.slice(delivery.indexOf('invitation_state: "sent"'), sentReturnAt);
  assert.match(sentBlock, /if \(!settled\) return \{ kind: "uncertain" \}/,
    "external-send-succeeded + local-settlement-failed → uncertain, recoverable as pending");
  for (const settledKind of ['return { kind: "awaiting-claim" }', 'return { kind: "failed" }']) {
    const at = delivery.indexOf(settledKind);
    assert.ok(at >= 0);
    const before = delivery.slice(0, at);
    assert.ok(before.lastIndexOf('if (!settled) return { kind: "uncertain" }') >= 0,
      `${settledKind} is preceded by a settlement proof`);
  }
  const reconcile = functionBody(actions, "export async function reconcileGyeonProvisioningInvite");
  assert.match(reconcile, /if \(!settled\) return \{ kind: "unsettled" \}/,
    "reconciliation never silently claims settlement");
});

test("F2-06. pagination exhaustion stays uncertain — 'failed' needs a proven-complete search", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const reconcile = functionBody(actions, "export async function reconcileGyeonProvisioningInvite");
  assert.match(reconcile, /let searchComplete = false/);
  assert.match(reconcile, /if \(users\.length < RECONCILE_PAGE_SIZE\) \{ searchComplete = true; break; \}/,
    "only a short page proves the final page");
  assert.match(reconcile, /if \(!found && !searchComplete\) \{/, "capped search settles nothing");
  assert.match(reconcile, /return \{ kind: "incomplete" \}/);
  const failedSettleAt = reconcile.indexOf('invitation_state: "failed"');
  const incompleteAt = reconcile.indexOf('return { kind: "incomplete" }');
  assert.ok(incompleteAt >= 0 && failedSettleAt > incompleteAt,
    "the failed settlement is reachable only past the completeness guard");
});

test("F3-01. the import transaction is serialized by ONE table lock taken before classification and insertion", () => {
  const sql = stripSql(migrationSource());
  const body = sql.slice(sql.indexOf("create or replace function public.import_gyeon_provisioning"));
  const locks = body.match(/lock table public\.gyeon_dealer_provisioning in share row exclusive mode/g) ?? [];
  assert.equal(locks.length, 1, "exactly one SHARE ROW EXCLUSIVE lock");
  const lockAt = body.indexOf("lock table public.gyeon_dealer_provisioning in share row exclusive mode");
  const classifyAt = body.indexOf("select * into v_existing");
  const insertAt = body.indexOf("insert into public.gyeon_dealer_provisioning");
  assert.ok(lockAt >= 0 && classifyAt >= 0 && insertAt >= 0);
  assert.ok(lockAt < classifyAt, "the lock precedes every existing-row classification");
  assert.ok(lockAt < insertAt, "the lock precedes every insert");
  // The whole migration contains no other lock statement.
  const allLocks = sql.match(/lock table/g) ?? [];
  assert.equal(allLocks.length, 1);
});

test("F3-02a. reconciliation retains invited_at and existence alone can NEVER settle 'sent'", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const reconcile = functionBody(actions, "export async function reconcileGyeonProvisioningInvite");
  assert.match(reconcile, /invitedAt: data\.user\.invited_at \?\? null/, "getUserById path retains invited_at");
  assert.match(reconcile, /invitedAt: hit\.invited_at \?\? null/, "listUsers path retains invited_at");
  const guardAt = reconcile.indexOf('found.invitedAt !== null && found.invitedAt.trim() !== ""');
  const sentAt = reconcile.indexOf('invitation_state: "sent"');
  assert.ok(guardAt >= 0 && sentAt >= 0);
  assert.ok(guardAt < sentAt, "the 'sent' settlement is reachable only through the non-empty invited_at guard");
});

test("F3-02b. an existing-but-never-invited Auth user settles to awaiting_claim with the stable classification", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const reconcile = functionBody(actions, "export async function reconcileGyeonProvisioningInvite");
  const awaitingAt = reconcile.indexOf('invitation_state: "awaiting_claim"');
  assert.ok(awaitingAt >= 0);
  const awaitingBlock = reconcile.slice(awaitingAt, reconcile.indexOf('return { kind: "settled-awaiting-claim" }'));
  assert.match(awaitingBlock, /invited_auth_user_id: found\.id/, "the discovered id is persisted");
  assert.match(awaitingBlock, /invite_last_error: "email_exists"/, "only the stable email_exists classification");
  assert.match(awaitingBlock, /if \(!settled\) return \{ kind: "unsettled" \}/, "a failed local settlement never reports settled");
  assert.match(reconcile, /return \{ kind: "settled-awaiting-claim" \}/);
  // 'failed' remains reachable only from a complete search proving NO user.
  const failedAt = reconcile.indexOf('invitation_state: "failed"');
  const foundBlockEnd = reconcile.indexOf('return { kind: "settled-awaiting-claim" }');
  assert.ok(failedAt > foundBlockEnd, "the failed settlement sits outside (after) the user-found branch");
});

test("F2-07. raw provider error text is never persisted; audit inserts are inspected", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  assert.equal(actions.includes("invite_last_error: inviteError?.message"), false,
    "provider messages never reach the database");
  assert.equal(actions.includes("invite_last_error: inviteError.message"), false);
  assert.match(actions, /const ERROR_CODE_SHAPE = \/\^\[a-z0-9_\]\{1,64\}\$\//,
    "persisted classifications are bounded and shape-checked");
  assert.match(actions, /sanitizeInviteErrorCode\(inviteError\?\.code, "email_exists"\)/);
  assert.match(actions, /sanitizeInviteErrorCode\(inviteError\?\.code, "invite_failed"\)/);
  assert.match(actions, /invite_last_error: "uncertain_transport"/,
    "the uncertain path stores a stable constant, not the caught message");
  assert.match(actions, /invite_last_error: "reconcile_no_auth_user"/);
  const audit = functionBody(actions, "async function auditProvisioning");
  assert.match(audit, /const \{ error \} = await supabase\.from\("admin_audit_logs"\)/,
    "the audit insert result is inspected");
  assert.match(audit, /AUDIT WRITE FAILED/, "audit failure is reported loudly");
});

test("6. revoke is winner-gated on registered+unclaimed; claimed records are never revocable", () => {
  const actions = strip(readFileSync(ACTIONS_SRC, "utf8"));
  const revoke = functionBody(actions, "export async function revokeGyeonProvisioning");
  assert.match(revoke, /\.eq\("provisioning_status", "registered"\)/);
  assert.match(revoke, /\.is\("claimed_at", null\)/);
  assert.match(revoke, /"not-revocable"/);
});

// ── CSV actions ──────────────────────────────────────────────────────────────

test("7. dry-run performs ZERO writes; confirm delegates to the atomic import RPC only", () => {
  const csv = strip(readFileSync(CSV_SRC, "utf8"));
  const dryRun = functionBody(csv, "export async function dryRunGyeonProvisioningCsv");
  for (const write of [".insert(", ".update(", ".delete(", ".rpc(", "inviteUserByEmail"]) {
    assert.equal(dryRun.includes(write), false, `dry-run must not: ${write}`);
  }
  const confirm = functionBody(csv, "export async function confirmGyeonProvisioningCsv");
  assert.match(confirm, /\.rpc\("import_gyeon_provisioning"/);
  assert.equal(confirm.includes(".insert("), false, "rows are written only inside the SQL transaction");
  assert.equal(csv.includes("inviteUserByEmail"), false, "import NEVER sends invitations");
});

// ── Migration: table + import transaction ────────────────────────────────────

test("8. the table separates the two state machines with the locked value sets", () => {
  const sql = stripSql(migrationSource());
  assert.match(sql, /provisioning_status in \('registered', 'claimed', 'revoked'\)/);
  assert.match(sql, /invitation_state in \('none', 'pending', 'sent', 'failed', 'awaiting_claim'\)/);
  assert.match(sql, /detailer_rank in \('shop', 'detailer', 'ppf_installer', 'certified'\)/);
  assert.match(sql, /unique \(email_normalized\)/);
  assert.match(sql, /unique \(dealer_code\)/);
  for (const column of [
    "invited_auth_user_id", "invite_sent_at", "invite_last_error",
    "created_by_admin_id", "revoked_by_admin_id", "revoked_at",
    "claimed_by_user_id", "claimed_dealer_id", "claimed_at", "import_batch_id",
  ]) {
    assert.ok(sql.includes(column), `column exists: ${column}`);
  }
});

test("9. RLS enabled with ZERO policies; table privileges revoked from anon/authenticated", () => {
  const sql = stripSql(migrationSource());
  assert.match(sql, /alter table public\.gyeon_dealer_provisioning enable row level security/);
  assert.equal(sql.includes("create policy"), false, "no client policy may exist");
  assert.match(sql, /revoke all privileges on table public\.gyeon_dealer_provisioning\s+from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on table public\.gyeon_dealer_provisioning\s+to service_role/);
});

test("10. the import transaction is conflict-checked-then-all-or-nothing with in-transaction audit", () => {
  const sql = stripSql(migrationSource());
  const start = sql.indexOf("create or replace function public.import_gyeon_provisioning");
  assert.ok(start >= 0);
  const body = sql.slice(start);
  const conflictAt = body.indexOf("'conflict'");
  const insertAt = body.indexOf("insert into public.gyeon_dealer_provisioning");
  const auditAt = body.indexOf("insert into public.admin_audit_logs");
  assert.ok(conflictAt >= 0 && insertAt >= 0 && auditAt >= 0);
  assert.ok(conflictAt < insertAt, "conflicts return BEFORE any row is written");
  assert.ok(insertAt < auditAt, "the audit record commits with the rows or not at all");
  assert.match(body, /security invoker/);
  assert.match(body, /revoke execute on function public\.import_gyeon_provisioning\(uuid, jsonb\)\s+from public, anon, authenticated/);
  assert.match(body, /grant execute on function public\.import_gyeon_provisioning\(uuid, jsonb\)\s+to service_role/);
});

test("F2-04a. identical replay is a no-op; changed/claimed/revoked replays stay conflicts (import transaction)", () => {
  const sql = stripSql(migrationSource());
  const body = sql.slice(sql.indexOf("create or replace function public.import_gyeon_provisioning"));
  // The unchanged classification: identical fields AND still registered+unclaimed.
  assert.match(body, /v_existing\.provisioning_status = 'registered'/);
  assert.match(body, /v_existing\.claimed_at is null/);
  assert.match(body, /v_existing\.shop_name = v_shop/);
  assert.match(body, /v_existing\.detailer_rank = v_rank/);
  assert.match(body, /coalesce\(v_existing\.dealer_code, ''\) = coalesce\(v_code, ''\)/);
  // Any deviation is a conflict (the classification is negated: NOT identical → conflict).
  assert.match(body, /if not \(v_existing\.provisioning_status = 'registered'/);
  // Concurrency safety: email uniqueness arbitrates; identical racers count as unchanged.
  assert.match(body, /on conflict \(email_normalized\) do nothing/);
  assert.match(body, /get diagnostics v_rows = row_count/);
  // Inserted and unchanged are reported separately (and audited).
  assert.match(body, /'inserted', v_inserted/);
  assert.match(body, /'unchanged', v_unchanged/);
});

test("F2-04b. dry-run applies the SAME classification rules as the import transaction", () => {
  const csv = strip(readFileSync(CSV_SRC, "utf8"));
  const dryRun = functionBody(csv, "export async function dryRunGyeonProvisioningCsv");
  assert.match(dryRun, /hit\.provisioning_status === "registered"/);
  assert.match(dryRun, /hit\.claimed_at === null/);
  assert.match(dryRun, /hit\.shop_name === row\.shopName/);
  assert.match(dryRun, /hit\.detailer_rank === row\.detailerRank/);
  assert.match(dryRun, /\(hit\.dealer_code \?\? ""\) === \(row\.dealerCode \?\? ""\)/);
  assert.match(dryRun, /if \(identical\) unchanged \+= 1/, "identical rows are unchanged, not conflicts");
  assert.match(dryRun, /else conflicts\.push/, "everything else stays a conflict");
  // The confirmed import surfaces both counts from the transaction.
  const confirm = functionBody(csv, "export async function confirmGyeonProvisioningCsv");
  assert.match(confirm, /result\.inserted/);
  assert.match(confirm, /result\.unchanged/);
});
