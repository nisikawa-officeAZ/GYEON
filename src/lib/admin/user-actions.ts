"use server";

import { requireAdmin, requireSuperAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { checkSuperAdminRemovalSafe } from "./super-admin-guard";

export async function disableUserAdmin(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Auth Users must never bypass the dedicated Admin lifecycle. An admin_users
  // target can only be disabled via disableAdminUser(), which keeps
  // admin_users.status consistent with the Auth ban and enforces the
  // self/active-Super-Admin removal guard. A lookup error here is treated
  // as unsafe (fail closed), not as "not an admin".
  const { data: linkedAdmin, error: lookupError } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: "管理者情報を確認できなかったため、操作を中止しました" };
  }
  if (linkedAdmin) {
    return { success: false, error: "管理者アカウントは「管理者ユーザー」画面から無効化してください" };
  }

  // Ban the user (Supabase ban = disabled)
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876600h", // ~100 years = effectively permanent
  });

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "user_disabled",
    details:      {},
  });

  return { success: true };
}

export async function enableUserAdmin(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Same boundary as disableUserAdmin(): an admin_users target must be
  // re-enabled via the dedicated Admin lifecycle (enableAdminUser()) only.
  const { data: linkedAdmin, error: lookupError } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) {
    return { success: false, error: "管理者情報を確認できなかったため、操作を中止しました" };
  }
  if (linkedAdmin) {
    return { success: false, error: "管理者アカウントは「管理者ユーザー」画面から有効化してください" };
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "user_enabled",
    details:      {},
  });

  return { success: true };
}

export async function deleteUserAdmin(userId: string) {
  // Hard delete of auth.users is destructive and irreversible → Super Admin only.
  // This is the ONLY hard-delete path; the Approval Center only soft-archives.
  const admin = await requireSuperAdmin();

  // Prevent admin from deleting themselves
  const currentUser = await getCurrentUser();
  if (currentUser?.id === userId) {
    return { success: false, error: "自分自身のアカウントは削除できません" };
  }

  const supabase = createAdminClient();

  // Mandatory server-side guard: never hard-delete any active Super Admin,
  // regardless of which entry point (Admin Users / Auth Users) called us or
  // whether the UI button was hidden.
  const guardError = await checkSuperAdminRemovalSafe(supabase, userId, currentUser?.id, "完全削除");
  if (guardError) return { success: false, error: guardError };

  // dealers.owner_user_id references auth.users with NO ON DELETE rule, so the
  // auth delete below would fail on that FK if this user owns a dealer. Rather
  // than irreversibly nulling that pointer before the Auth deletion even runs,
  // fail closed: this is a read-only check, and the operator must separately
  // reassign/clear ownership before the account can be hard-deleted.
  const { data: ownedDealers, error: ownerLookupError } = await supabase
    .from("dealers")
    .select("id")
    .eq("owner_user_id", userId);

  if (ownerLookupError) {
    return { success: false, error: "所有ディーラーの確認に失敗したため、削除を中止しました" };
  }
  if (ownedDealers && ownedDealers.length > 0) {
    return {
      success: false,
      error:
        "このユーザーはディーラーのオーナーに設定されているため削除できません。" +
        "先にオーナーを再割り当てまたは解除してください。",
    };
  }

  // Auth deletion is the ONLY write this action performs. dealer_members and
  // admin_users rows for this user are removed by their existing ON DELETE
  // CASCADE — no irreversible related-DB cleanup runs before the Auth delete.
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return { success: false, error: error.message };
  }

  // Success is audited only now that the Auth deletion has actually succeeded.
  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "user_deleted",
    details:      { hard_delete: true },
  });

  return { success: true };
}

export async function updateUserEmail(userId: string, newEmail: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  });

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "dealer_updated",
    details:      { field: "email", new_email: newEmail },
  });

  return { success: true };
}
