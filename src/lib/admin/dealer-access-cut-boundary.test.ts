// R4Q-R14-C1R — access-cut ordering and purgeDealer() fail-closed contract in
// approve-dealer.ts.
//
// Run: node --import tsx --test src/lib/admin/dealer-access-cut-boundary.test.ts
//
// The source starts with "use server" and transitively imports next/headers,
// so it cannot execute under node:test; the contract is pinned from source,
// the same discipline as the other admin/auth boundary tests in this repo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = "src/lib/admin/approve-dealer.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function functionBody(code: string, marker: string): string {
  const start = code.indexOf(marker);
  assert.ok(start >= 0, `found: ${marker}`);
  const next = code.indexOf("\nexport ", start + 1);
  const helper = code.indexOf("\nfunction ", start + 1);
  const candidates = [next, helper].filter((i) => i > start);
  const end = candidates.length > 0 ? Math.min(...candidates) : code.length;
  return code.slice(start, end);
}

// ── suspendDealer: access cut precedes the dealer-state write ───────────────

test("1. suspendDealer suspends dealer_members BEFORE writing the dealers row, and checks the membership write error", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const body = functionBody(code, "export async function suspendDealer");
  const memberAt = body.indexOf('from("dealer_members")');
  const memberErrCheckAt = body.indexOf("if (memberError) return { success: false, error: memberError.message };");
  const dealersAt = body.indexOf('from("dealers")');
  const auditAt = body.indexOf("writeAuditLog(");
  assert.ok(memberAt >= 0 && memberErrCheckAt >= 0 && dealersAt >= 0 && auditAt >= 0);
  assert.ok(memberAt < dealersAt, "the access cut (dealer_members) runs before the dealers row is updated");
  assert.ok(memberErrCheckAt < dealersAt, "a membership-write error is checked before the dealers row is touched");
  assert.ok(dealersAt < auditAt, "the audit log is written only after both writes succeed");
});

test("2. suspendDealer checks the dealers-update error too (no ignored write in either step)", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const body = functionBody(code, "export async function suspendDealer");
  const dealersAt = body.indexOf('from("dealers")');
  const errCheckAt = body.indexOf("if (error) return { success: false, error: error.message };", dealersAt);
  assert.ok(errCheckAt > dealersAt, "the dealers-row write error is checked");
});

// ── deleteDealer: access cut precedes the archive write ──────────────────────

test("3. deleteDealer suspends dealer_members BEFORE archiving (deleted_at write), and checks the membership write error", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const body = functionBody(code, "export async function deleteDealer");
  const memberAt = body.indexOf('from("dealer_members")');
  const memberErrCheckAt = body.indexOf("if (memberError) return { success: false, error: memberError.message };");
  const archiveAt = body.indexOf("deleted_at: new Date().toISOString()");
  const auditAt = body.indexOf("writeAuditLog(");
  assert.ok(memberAt >= 0 && memberErrCheckAt >= 0 && archiveAt >= 0 && auditAt >= 0);
  assert.ok(memberAt < archiveAt, "the access cut runs before the dealer is archived");
  assert.ok(memberErrCheckAt < archiveAt, "a membership-write error is checked before the archive write is attempted");
  assert.ok(archiveAt < auditAt, "the audit log is written only after both writes succeed");
});

test("4. deleteDealer checks the archive-write error too, and reports the suspended-member count", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const body = functionBody(code, "export async function deleteDealer");
  const archiveAt = body.indexOf("deleted_at: new Date().toISOString()");
  const errCheckAt = body.indexOf("if (error) return { success: false, error: error.message };", archiveAt);
  assert.ok(errCheckAt > archiveAt, "the archive-write error is checked");
  assert.match(body, /suspendedMembers\?\.length \?\? 0/);
  assert.match(body, /return \{ success: true, suspendedMembers: suspendedCount \}/);
});

// ── purgeDealer: runtime-gated and unconditionally fail-closed ───────────────

test("5. purgeDealer requires Super Admin, then denies outside an explicit Preview/test runtime", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const body = functionBody(code, "export async function purgeDealer");
  const authAt = body.indexOf("await requireSuperAdmin()");
  const gateAt = body.indexOf("isPurgeDealerRuntimePermitted()");
  assert.ok(authAt >= 0 && gateAt >= 0);
  assert.ok(authAt < gateAt, "auth is checked before the runtime gate");

  assert.match(code, /function isPurgeDealerRuntimePermitted\(\): boolean \{/);
  const gateFn = functionBody(code, "function isPurgeDealerRuntimePermitted");
  assert.match(gateFn, /if \(process\.env\.VERCEL_ENV === "production"\) return false;/,
    "production is denied unconditionally, before any other check");
  assert.match(gateFn, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(gateFn, /process\.env\.NODE_ENV === "test"/);
});

test("6. purgeDealer always returns success:false — no path performs the delete regardless of runtime", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const body = functionBody(code, "export async function purgeDealer");
  const returns = body.match(/return \{[^}]*\}/g) ?? [];
  assert.ok(returns.length >= 1, "purgeDealer has at least one return");
  for (const ret of returns) {
    assert.match(ret, /success:\s*false/, `every purgeDealer return is a denial: ${ret}`);
  }
  for (const forbidden of [".delete(", ".auth.admin.deleteUser(", "deleteUserAdmin("]) {
    assert.equal(body.includes(forbidden), false, `purgeDealer must never perform: ${forbidden}`);
  }
});

test("7. purgeDealer no longer imports the hard-delete helper it used to delegate to (fully disabled, not partially)", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.equal(code.includes('import { deleteUserAdmin } from "./user-actions";'), false,
    "the unused import was removed along with the disabled delegation");
});
