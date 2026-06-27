"use server";

import { getCurrentAdmin } from "./get-current-admin";

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error("管理者権限が必要です");
  }
  if (admin.status !== "active") {
    throw new Error("管理者アカウントが無効です");
  }
  return admin;
}

export async function requireSuperAdmin() {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    throw new Error("Super Admin権限が必要です");
  }
  return admin;
}
