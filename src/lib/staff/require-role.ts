"use server";

import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type { DealerStaffRole } from "@/lib/staff/staff-types";

export async function requireRole(
  allowedRoles: DealerStaffRole[]
): Promise<{ role: DealerStaffRole; dealerId: string }> {
  const [staff, dealer] = await Promise.all([
    getCurrentStaff(),
    getCurrentDealer(),
  ]);

  if (!dealer) {
    throw new Error("認証が必要です");
  }

  if (!staff) {
    throw new Error("この操作を行う権限がありません");
  }

  const role: DealerStaffRole = staff.role;

  if (!allowedRoles.includes(role)) {
    throw new Error("この操作を行う権限がありません");
  }

  return { role, dealerId: dealer.dealer_id };
}
