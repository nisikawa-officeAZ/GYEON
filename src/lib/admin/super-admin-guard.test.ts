// R4Q-R14-C1R — checkSuperAdminRemovalSafe() fail-closed behavior.
//
// Run: node --import tsx --test src/lib/admin/super-admin-guard.test.ts
//
// This is a plain helper (no "use server", no next/headers import), so unlike
// the other admin/auth boundary modules it can execute directly under
// node:test against a minimal mock Supabase query-builder.

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkSuperAdminRemovalSafe } from "./super-admin-guard";

// checkSuperAdminRemovalSafe() only ever issues a single `.from(...)` chain:
// the target lookup via `.maybeSingle()`. There is no active-count lookup —
// `results` holds exactly one entry, and a second call would throw, proving
// no follow-up query is performed.
function mockSupabase(results: Array<{ data?: unknown; error?: unknown }>) {
  let i = 0;
  const next = () => {
    const r = results[i++];
    if (!r) throw new Error(`mockSupabase: no queued result for call #${i}`);
    return r;
  };
  const chain = {
    select() { return chain; },
    eq() { return chain; },
    maybeSingle: async () => {
      const r = next();
      return { data: r.data ?? null, error: r.error ?? null };
    },
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      const r = next();
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null })
        .then(resolve, reject);
    },
  };
  return { from: () => chain } as unknown as Parameters<typeof checkSuperAdminRemovalSafe>[0];
}

test("1. target lookup error → fail closed (denied), even though role/status are unknown", async () => {
  const supabase = mockSupabase([{ error: { message: "boom" } }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "target-1", "caller-1", "停止");
  assert.equal(typeof result, "string");
  assert.match(result as string, /確認できなかった/);
});

test("2. target not found (no row, no error) → safe (null) — not a super admin at all", async () => {
  const supabase = mockSupabase([{ data: null }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "target-1", "caller-1", "停止");
  assert.equal(result, null);
});

test("3. target is a non-super-admin (or inactive) admin → safe (null), no further lookup performed", async () => {
  const supabase = mockSupabase([{ data: { role: "gyeon_admin", status: "active" } }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "target-1", "caller-1", "停止");
  assert.equal(result, null);

  const inactiveSuper = mockSupabase([{ data: { role: "super_admin", status: "disabled" } }]);
  const result2 = await checkSuperAdminRemovalSafe(inactiveSuper, "target-1", "caller-1", "停止");
  assert.equal(result2, null);
});

test("4. active super admin targeting self → denied with the self-targeting message, not the general denial", async () => {
  const supabase = mockSupabase([{ data: { role: "super_admin", status: "active" } }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "user-1", "user-1", "完全削除");
  assert.equal(typeof result, "string");
  assert.match(result as string, /自分自身/);
});

test("5. active super admin, not self → denied unconditionally, with only ONE lookup issued (no active-count query)", async () => {
  const supabase = mockSupabase([{ data: { role: "super_admin", status: "active" } }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "target-1", "caller-1", "停止");
  assert.equal(typeof result, "string");
  assert.match(result as string, /トランザクション/);
  // A second call would throw "no queued result" if a count lookup were attempted;
  // reaching this point without throwing proves none was.
});

test("6. active super admin removal denied regardless of hypothetical remaining active-admin count — no count lookup exists to make that distinction", async () => {
  const supabase = mockSupabase([{ data: { role: "super_admin", status: "active" } }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "target-1", "caller-1", "ロール変更");
  assert.equal(typeof result, "string");
  assert.match(result as string, /トランザクション/);
});

test("7. no callerUserId provided → self-check skipped, active-Super-Admin denial still applies", async () => {
  const supabase = mockSupabase([{ data: { role: "super_admin", status: "active" } }]);
  const result = await checkSuperAdminRemovalSafe(supabase, "target-1", undefined, "停止");
  assert.equal(typeof result, "string");
  assert.match(result as string, /トランザクション/);
});
