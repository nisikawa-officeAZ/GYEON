import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Guard against removing the last active Super Admin.
 *
 * Given a service-role client, returns a Japanese error message if the requested
 * operation on `targetUserId` would either (a) act on the caller's own Super
 * Admin account, or (b) remove/suspend the last remaining ACTIVE Super Admin —
 * otherwise returns null (safe to proceed).
 *
 * Only Super Admin targets are constrained; non-super-admin users return null.
 * This is a plain helper (NOT a server action) invoked by server actions using
 * the server-only service-role client — it never runs on the client and does
 * not touch RLS.
 */
export async function checkSuperAdminRemovalSafe(
  supabase: SupabaseClient,
  targetUserId: string,
  callerUserId: string | undefined,
  actionLabel: string,
): Promise<string | null> {
  const { data: target } = await supabase
    .from("admin_users")
    .select("role, status")
    .eq("user_id", targetUserId)
    .maybeSingle();

  const isActiveSuper = target?.role === "super_admin" && target?.status === "active";
  if (!isActiveSuper) return null;

  // Rule: the currently logged-in Super Admin cannot remove their own access.
  if (callerUserId && targetUserId === callerUserId) {
    return `自分自身のスーパー管理者アカウントは${actionLabel}できません`;
  }

  // Rule: at least one active Super Admin must remain afterward.
  const { count } = await supabase
    .from("admin_users")
    .select("*", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("status", "active");

  if ((count ?? 0) <= 1) {
    return `最後のアクティブなスーパー管理者は${actionLabel}できません`;
  }

  return null;
}
