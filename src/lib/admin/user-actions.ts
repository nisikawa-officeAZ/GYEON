"use server";

import { requireAdmin, requireSuperAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { checkSuperAdminRemovalSafe } from "./super-admin-guard";

export async function disableUserAdmin(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Never suspend the last active Super Admin (or one's own super-admin access).
  const currentUser = await getCurrentUser();
  const guardError = await checkSuperAdminRemovalSafe(supabase, userId, currentUser?.id, "停止");
  if (guardError) return { success: false, error: guardError };

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

  // Mandatory server-side guard: never hard-delete the last active Super Admin,
  // regardless of which entry point (Admin Users / Auth Users) called us or
  // whether the UI button was hidden.
  const guardError = await checkSuperAdminRemovalSafe(supabase, userId, currentUser?.id, "完全削除");
  if (guardError) return { success: false, error: guardError };

  // Orphan cleanup — ONLY performed for an explicit hard delete.
  // dealers.owner_user_id references auth.users with NO ON DELETE rule, so the
  // auth delete below would fail on that FK unless the pointer is cleared first.
  // Nulling it preserves the dealer row and ALL business data (customers,
  // vehicles, estimates, invoices …) — only the owner link is removed.
  const { data: clearedOwnerDealers } = await supabase
    .from("dealers")
    .update({ owner_user_id: null })
    .eq("owner_user_id", userId)
    .select("id");

  // Remove this user's memberships explicitly. dealer_members.user_id is
  // ON DELETE CASCADE so this would happen anyway, but doing it deterministically
  // keeps the orphan cleanup auditable rather than implicit.
  const { data: removedMemberships } = await supabase
    .from("dealer_members")
    .delete()
    .eq("user_id", userId)
    .select("id");

  // Remove any admin_users row for this user. admin_users.user_id is also
  // ON DELETE CASCADE, but we clean it explicitly for symmetry, auditability,
  // and to stay correct even if that FK rule is ever changed.
  const { data: removedAdmins } = await supabase
    .from("admin_users")
    .delete()
    .eq("user_id", userId)
    .select("id");

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "user_deleted",
    details:      {
      hard_delete:           true,
      cleared_owner_dealers: clearedOwnerDealers?.length ?? 0,
      removed_memberships:   removedMemberships?.length ?? 0,
      removed_admins:        removedAdmins?.length ?? 0,
    },
  });

  // Cleanup above already ran, so at this point the blocking FK references are
  // cleared. If the auth deletion still fails, the account is left in a
  // recoverable partial state — surface a clear instruction to retry.
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    return {
      success: false,
      error:
        "関連データの削除は完了しましたが、認証ユーザーの削除に失敗しました。" +
        "もう一度お試しいただくか、管理者にお問い合わせください。",
    };
  }

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
