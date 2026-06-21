"use server";

import { randomBytes } from "crypto";
import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "./write-audit-log";

// ── Send password reset email ────────────────────────────────────────────────

export async function sendPasswordResetEmail(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Fetch user email first
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) {
    return { success: false, error: "ユーザーが見つかりません" };
  }

  const { error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: userData.user.email,
  });

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:    admin.id,
    targetUserId:   userId,
    action:         "password_reset_sent",
    details:        { email: userData.user.email },
  });

  return { success: true, email: userData.user.email };
}

// ── Generate temporary password ──────────────────────────────────────────────
// Displayed ONCE in UI — never stored in DB

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(16);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

export async function createTemporaryPassword(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const tempPassword = generateTempPassword();

  // Set password AND mark that user must change it on next login via user_metadata
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { force_password_change: true },
  });

  if (error) return { success: false, error: error.message };

  await writeAuditLog({
    adminUserId:  admin.id,
    targetUserId: userId,
    action:       "temporary_password_created",
    details:      {}, // NEVER log the password itself
  });

  // Return the temp password ONCE — UI must show it to admin immediately
  return { success: true, temporaryPassword: tempPassword };
}
