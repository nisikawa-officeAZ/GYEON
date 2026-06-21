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

  // If no staff record (table not yet applied) — treat as owner for dev mode
  const role: DealerStaffRole = staff?.role ?? "owner";

  if (!allowedRoles.includes(role)) {
    throw new Error("この操作を行う権限がありません");
  }

  return { role, dealerId: dealer.dealer_id };
}
