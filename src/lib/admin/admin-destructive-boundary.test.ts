// R4Q-R14-C1R — fail-closed contract for the destructive admin/user actions in
// user-actions.ts and admin-user-actions.ts.
//
// Run: node --import tsx --test src/lib/admin/admin-destructive-boundary.test.ts
//
// Both source files start with "use server" and transitively import
// next/headers (via getCurrentUser -> lib/supabase/server), so they cannot
// execute under node:test — the same constraint documented in
// gyeon-provisioning-actions.test.ts. The contract is pinned from source
// instead: exact strings and statement ordering, resistant to reformatting
// but sensitive to a removed check or a reordered write.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const USER_ACTIONS = "src/lib/admin/user-actions.ts";
const ADMIN_ACTIONS = "src/lib/admin/admin-user-actions.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function functionBody(code: string, marker: string): string {
  const start = code.indexOf(marker);
  assert.ok(start >= 0, `found: ${marker}`);
  const next = code.indexOf("\nexport ", start + 1);
  return next > start ? code.slice(start, next) : code.slice(start);
}

// ── user-actions.ts: disableUserAdmin / enableUserAdmin reject admin targets ──

test("1. disableUserAdmin and enableUserAdmin fail closed on an admin_users lookup error, and reject any admin_users target", () => {
  const code = strip(readFileSync(USER_ACTIONS, "utf8"));
  for (const name of ["export async function disableUserAdmin", "export async function enableUserAdmin"]) {
    const body = functionBody(code, name);
    assert.match(body, /from\("admin_users"\)/, `${name}: looks up admin_users`);
    const lookupErrAt = body.indexOf("if (lookupError)");
    const linkedAt = body.indexOf("if (linkedAdmin)");
    const banAt = body.indexOf("updateUserById(userId");
    assert.ok(lookupErrAt >= 0 && linkedAt >= 0 && banAt >= 0, `${name}: has both guards before the Auth call`);
    assert.ok(lookupErrAt < banAt, `${name}: a lookup error is checked before the Auth ban/unban`);
    assert.ok(linkedAt < banAt, `${name}: an admin_users match is checked before the Auth ban/unban`);
    assert.match(body, /管理者ユーザー」画面から/, `${name}: redirects the caller to the dedicated Admin lifecycle`);
  }
});

test("2. neither disableUserAdmin nor enableUserAdmin calls checkSuperAdminRemovalSafe — the admin_users rejection above makes it unreachable for admin targets", () => {
  const code = strip(readFileSync(USER_ACTIONS, "utf8"));
  for (const name of ["export async function disableUserAdmin", "export async function enableUserAdmin"]) {
    const body = functionBody(code, name);
    assert.equal(body.includes("checkSuperAdminRemovalSafe"), false, `${name} delegates admin targets instead of guarding them itself`);
  }
});

// ── user-actions.ts: deleteUserAdmin ordering ────────────────────────────────

test("3. deleteUserAdmin performs no destructive related-DB write before the Auth delete — only a read-only owner lookup", () => {
  const code = strip(readFileSync(USER_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function deleteUserAdmin");
  const deleteAt = body.indexOf('supabase.auth.admin.deleteUser(userId)');
  assert.ok(deleteAt >= 0);
  const before = body.slice(0, deleteAt);
  for (const destructive of [
    "owner_user_id: null",
    'from("dealer_members")',
    'from("admin_users")',
    ".delete()",
  ]) {
    assert.equal(before.includes(destructive), false, `no destructive write before Auth delete: ${destructive}`);
  }
  // The only read before the Auth delete is the owner_user_id lookup.
  assert.match(before, /from\("dealers"\)\s*\.select\("id"\)\s*\.eq\("owner_user_id", userId\)/);
});

test("4. deleteUserAdmin: an owner-lookup error AND an existing owner reference both deny (fail closed) before Auth delete runs", () => {
  const code = strip(readFileSync(USER_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function deleteUserAdmin");
  const lookupErrAt = body.indexOf("if (ownerLookupError)");
  const ownedAt = body.indexOf("if (ownedDealers && ownedDealers.length > 0)");
  const deleteAt = body.indexOf("supabase.auth.admin.deleteUser(userId)");
  assert.ok(lookupErrAt >= 0 && ownedAt >= 0 && deleteAt >= 0);
  assert.ok(lookupErrAt < deleteAt && ownedAt < deleteAt, "both guards precede the Auth delete");
  assert.match(body.slice(ownedAt, deleteAt), /オーナーを再割り当て/, "the owner-ref refusal explains the required manual step");
});

test("5. deleteUserAdmin writes the success audit ONLY after the Auth delete succeeds, and checkSuperAdminRemovalSafe still guards it", () => {
  const code = strip(readFileSync(USER_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function deleteUserAdmin");
  assert.match(body, /checkSuperAdminRemovalSafe\(supabase, userId, currentUser\?\.id, "完全削除"\)/);
  const deleteAt = body.indexOf('supabase.auth.admin.deleteUser(userId)');
  const errorCheckAt = body.indexOf("if (error) {", deleteAt);
  const auditAt = body.indexOf("writeAuditLog(", deleteAt);
  const returnTrueAt = body.indexOf("return { success: true }");
  assert.ok(deleteAt >= 0 && errorCheckAt >= 0 && auditAt >= 0 && returnTrueAt >= 0);
  assert.ok(deleteAt < errorCheckAt && errorCheckAt < auditAt && auditAt < returnTrueAt,
    "Auth delete -> error check -> audit -> success, in that order");
});

// ── admin-user-actions.ts: disableAdminUser status/ban ordering ─────────────

test("6. disableAdminUser writes admin_users.status = disabled BEFORE the Auth ban, and checks both errors", () => {
  const code = strip(readFileSync(ADMIN_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function disableAdminUser");
  const statusAt = body.indexOf('update({ status: "disabled" })');
  const statusErrAt = body.indexOf("if (updateError) return { success: false, error: updateError.message };");
  const banAt = body.indexOf("updateUserById(target.user_id");
  const banErrAt = body.indexOf("if (banError)");
  assert.ok(statusAt >= 0 && statusErrAt >= 0 && banAt >= 0 && banErrAt >= 0);
  assert.ok(statusAt < banAt, "admin_users.status is written before the Auth ban is attempted");
  assert.ok(statusErrAt < banAt, "a status-write error is checked before ever attempting the Auth ban");
  assert.ok(banAt < banErrAt, "the ban's own error is checked immediately after it");
});

test("7. disableAdminUser still fails closed (returns success:false) if the Auth ban fails after the status write already succeeded", () => {
  const code = strip(readFileSync(ADMIN_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function disableAdminUser");
  const banErrAt = body.indexOf("if (banError)");
  const banBlock = body.slice(banErrAt, banErrAt + 300);
  assert.match(banBlock, /success:\s*false/, "a failed Auth ban is never reported as success");
  // It must not silently roll back the status write (no update({ status: "active" }) call exists in this function).
  assert.equal(body.includes('update({ status: "active" })'), false,
    "no compensating re-activation on ban failure — the disabled status is preserved (fail closed)");
});

test("8. disableAdminUser calls checkSuperAdminRemovalSafe, and enableAdminUser does not (enabling is not a removal)", () => {
  const code = strip(readFileSync(ADMIN_ACTIONS, "utf8"));
  assert.match(functionBody(code, "export async function disableAdminUser"), /checkSuperAdminRemovalSafe/);
  assert.equal(functionBody(code, "export async function enableAdminUser").includes("checkSuperAdminRemovalSafe"), false);
});

// ── admin-user-actions.ts: changeAdminRole demotion guard ────────────────────

test("9. changeAdminRole guards self AND calls checkSuperAdminRemovalSafe before writing the new role", () => {
  const code = strip(readFileSync(ADMIN_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function changeAdminRole");
  const selfAt = body.indexOf('return { success: false, error: "自分自身のロールは変更できません" };');
  const guardCallAt = body.indexOf("checkSuperAdminRemovalSafe(supabase, target.user_id, currentUser?.id");
  const guardCheckAt = body.indexOf("if (guardError) return { success: false, error: guardError };");
  const updateAt = body.indexOf('update({ role: newRole })');
  assert.ok(selfAt >= 0 && guardCallAt >= 0 && guardCheckAt >= 0 && updateAt >= 0);
  assert.ok(selfAt < guardCallAt, "self-demotion is rejected before the removal guard even runs");
  assert.ok(guardCallAt < updateAt && guardCheckAt < updateAt, "the active-Super-Admin removal guard precedes the role write");
});

test("10. CreatableAdminRole excludes super_admin, so changeAdminRole can never assign super_admin (no privilege-escalation path here)", () => {
  const code = strip(readFileSync(ADMIN_ACTIONS, "utf8"));
  assert.match(code, /type CreatableAdminRole = Exclude<AdminRole, "super_admin">;/);
  assert.match(code, /export async function changeAdminRole\(adminId: string, newRole: CreatableAdminRole\)/);
});

// ── deleteAdminUser still delegates to the single hard-delete path ──────────

test("11. deleteAdminUser has no duplicated hard-delete logic — it delegates entirely to deleteUserAdmin()", () => {
  const code = strip(readFileSync(ADMIN_ACTIONS, "utf8"));
  const body = functionBody(code, "export async function deleteAdminUser");
  assert.match(body, /await deleteUserAdmin\(target\.user_id\)/);
  for (const forbidden of [".auth.admin.deleteUser(", 'from("dealer_members")', 'from("dealers")']) {
    assert.equal(body.includes(forbidden), false, `deleteAdminUser must not duplicate: ${forbidden}`);
  }
});
