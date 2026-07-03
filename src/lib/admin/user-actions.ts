"use server";

import { requireAdmin, requireSuperAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function disableUserAdmin(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

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

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "user_deleted",
    details:      {
      hard_delete:           true,
      cleared_owner_dealers: clearedOwnerDealers?.length ?? 0,
      removed_memberships:   removedMemberships?.length ?? 0,
    },
  });

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return { success: false, error: error.message };

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
