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
