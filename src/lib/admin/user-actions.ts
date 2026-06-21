"use server";

import { requireAdmin } from "./require-admin";
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
  const admin = await requireAdmin();

  // Prevent admin from deleting themselves
  const currentUser = await getCurrentUser();
  if (currentUser?.id === userId) {
    return { success: false, error: "自分自身のアカウントは削除できません" };
  }

  const supabase = createAdminClient();

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "user_deleted",
    details:      {},
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
