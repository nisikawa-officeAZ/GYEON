import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guard against unsafe removal of an active Super Admin.
 *
 * Given a service-role client, returns a Japanese error message if the requested
 * operation on `targetUserId` would either (a) act on the caller's own Super
 * Admin account, or (b) suspend/demote/delete any currently ACTIVE Super Admin —
 * otherwise returns null (safe to proceed).
 *
 * Only Super Admin targets are constrained; non-super-admin (or non-active)
 * users return null. This is a plain helper (NOT a server action) invoked by
 * server actions using the server-only service-role client — it never runs on
 * the client and does not touch RLS.
 *
 * Fail-closed: a read error on the target lookup is treated as UNSAFE (returns
 * a denial message), never as "safe to proceed".
 *
 * There is no DB transaction/RPC available in this phase, so a "count active
 * Super Admins, allow removal if > 1" check would be a non-atomic
 * check-then-write: concurrent disable/demotion/delete calls can each observe
 * the same count and jointly remove every active Super Admin. Rather than
 * ship that race, every active Super Admin removal is denied unconditionally
 * until a transactional safety mechanism exists. No active-count lookup is
 * performed.
 */
export async function checkSuperAdminRemovalSafe(
  supabase: SupabaseClient,
  targetUserId: string,
  callerUserId: string | undefined,
  actionLabel: string,
): Promise<string | null> {
  const { data: target, error: targetError } = await supabase
    .from("admin_users")
    .select("role, status")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError) {
    return `対象の管理者情報を確認できなかったため、${actionLabel}を中止しました`;
  }

  const isActiveSuper = target?.role === "super_admin" && target?.status === "active";
  if (!isActiveSuper) return null;

  // Rule: the currently logged-in Super Admin cannot remove their own access.
  if (callerUserId && targetUserId === callerUserId) {
    return `自分自身のスーパー管理者アカウントは${actionLabel}できません`;
  }

  // Rule: removing/suspending/demoting an active Super Admin is disabled
  // outright until a transactional (RPC/DB-level) safety mechanism exists,
  // because a count-based check here would be a non-atomic race.
  return `トランザクションによる安全性が確保されるまで、有効なスーパー管理者の${actionLabel}は無効化されています`;
}
