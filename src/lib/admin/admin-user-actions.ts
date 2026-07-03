"use server";

import { randomBytes } from "crypto";
import { requireSuperAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { deleteUserAdmin } from "./user-actions";
import { checkSuperAdminRemovalSafe } from "./super-admin-guard";
import type { AdminRole } from "./admin-roles";

type CreatableAdminRole = Exclude<AdminRole, "super_admin">;

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(16);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

export async function createAdminUser(
  email: string,
  name: string,
  role: CreatableAdminRole
) {
  const caller = await requireSuperAdmin();
  const supabase = createAdminClient();

  const tempPassword = generateTempPassword();

  const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !authUser.user) {
    return { success: false, error: createError?.message ?? "ユーザー作成に失敗しました" };
  }

  const { error: insertError } = await supabase.from("admin_users").insert({
    user_id: authUser.user.id,
    email:   email.trim().toLowerCase(),
    name:    name.trim() || null,
    role,
    status:  "active",
  });

  if (insertError) {
    // Rollback: remove orphaned auth user
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: insertError.message };
  }

  await writeAuditLog({
    adminUserId:  caller.id,
    targetUserId: authUser.user.id,
    action:       "admin_user_created",
    details:      { role, email },
  });

  return { success: true, tempPassword, userId: authUser.user.id };
}

export async function disableAdminUser(adminId: string) {
  const caller = await requireSuperAdmin();
  const currentUser = await getCurrentUser();

  const supabase = createAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from("admin_users")
    .select("id, user_id, email, role")
    .eq("id", adminId)
    .single();

  if (fetchError || !target) return { success: false, error: "管理者が見つかりません" };

  if (target.user_id === currentUser?.id) {
    return { success: false, error: "自分自身を無効化できません" };
  }

  // Never suspend the last active Super Admin.
  const guardError = await checkSuperAdminRemovalSafe(supabase, target.user_id, currentUser?.id, "停止");
  if (guardError) return { success: false, error: guardError };

  const { error: banError } = await supabase.auth.admin.updateUserById(target.user_id, {
    ban_duration: "876600h",
  });
  if (banError) return { success: false, error: banError.message };

  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ status: "disabled" })
    .eq("id", adminId);
  if (updateError) return { success: false, error: updateError.message };

  await writeAuditLog({
    adminUserId:  caller.id,
    targetUserId: target.user_id,
    action:       "admin_user_disabled",
    details:      { target_email: target.email, target_role: target.role },
  });

  return { success: true };
}

export async function enableAdminUser(adminId: string) {
  const caller = await requireSuperAdmin();
  const supabase = createAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from("admin_users")
    .select("id, user_id, email, role")
    .eq("id", adminId)
    .single();

  if (fetchError || !target) return { success: false, error: "管理者が見つかりません" };

  const { error: banError } = await supabase.auth.admin.updateUserById(target.user_id, {
    ban_duration: "none",
  });
  if (banError) return { success: false, error: banError.message };

  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ status: "active" })
    .eq("id", adminId);
  if (updateError) return { success: false, error: updateError.message };

  await writeAuditLog({
    adminUserId:  caller.id,
    targetUserId: target.user_id,
    action:       "admin_user_enabled",
    details:      { target_email: target.email, target_role: target.role },
  });

  return { success: true };
}

/**
 * Permanently delete (完全削除) an admin user — Super Admin only.
 *
 * Delegates the actual hard delete to the existing safe deleteUserAdmin(), which
 * enforces the mandatory guards server-side (no self-delete; never remove the
 * last active Super Admin) and performs FK cleanup + auth.users deletion. The
 * admin_users row is removed by ON DELETE CASCADE. No hard-delete logic is
 * duplicated here.
 */
export async function deleteAdminUser(adminId: string) {
  const caller = await requireSuperAdmin();
  const supabase = createAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from("admin_users")
    .select("id, user_id, email, role, status")
    .eq("id", adminId)
    .single();

  if (fetchError || !target) return { success: false, error: "管理者が見つかりません" };

  // Hard delete via the single safe path (self + last-super-admin guards live there).
  const res = await deleteUserAdmin(target.user_id);
  if (!res.success) return { success: false, error: res.error };

  await writeAuditLog({
    adminUserId:  caller.id,
    targetUserId: target.user_id,
    action:       "admin_user_deleted",
    details:      { target_email: target.email, target_role: target.role },
  });

  return { success: true };
}

export async function changeAdminRole(adminId: string, newRole: CreatableAdminRole) {
  const caller = await requireSuperAdmin();
  const currentUser = await getCurrentUser();
  const supabase = createAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from("admin_users")
    .select("id, user_id, email, role")
    .eq("id", adminId)
    .single();

  if (fetchError || !target) return { success: false, error: "管理者が見つかりません" };

  if (target.user_id === currentUser?.id) {
    return { success: false, error: "自分自身のロールは変更できません" };
  }

  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ role: newRole })
    .eq("id", adminId);
  if (updateError) return { success: false, error: updateError.message };

  await writeAuditLog({
    adminUserId:  caller.id,
    targetUserId: target.user_id,
    action:       "admin_role_changed",
    details:      { target_email: target.email, old_role: target.role, new_role: newRole },
  });

  return { success: true };
}

export async function resetAdminPassword(adminId: string) {
  const caller = await requireSuperAdmin();
  const supabase = createAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from("admin_users")
    .select("id, user_id, email")
    .eq("id", adminId)
    .single();

  if (fetchError || !target?.email) return { success: false, error: "管理者が見つかりません" };

  const { error: linkError } = await supabase.auth.admin.generateLink({
    type:  "recovery",
    email: target.email,
  });
  if (linkError) return { success: false, error: linkError.message };

  await writeAuditLog({
    adminUserId:  caller.id,
    targetUserId: target.user_id,
    action:       "admin_password_reset",
    details:      { target_email: target.email },
  });

  return { success: true, email: target.email };
}
