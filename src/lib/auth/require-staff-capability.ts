// Phase 3.5 — Shared server-side authorization guard (Issue F hardening).
//
// Single entry point for dealer-staff capability checks on write actions. Reuses
// the existing capability helpers and getCurrentStaff() as the SINGLE SERVER-SIDE
// SOURCE OF TRUTH for the staff role (dealer_staff primary; dealer_members
// fallback; unknown role → "readonly"). Client-supplied role/permission is never
// trusted.
//
// Fail-CLOSED: missing auth/dealer context, or a role lacking the capability, is
// denied. (getCurrentStaff maps an unknown/invalid role to least-privilege
// "readonly"; this guard maps a null context to denial.)
//
// Plain server module (no "use server"): it exports a type + async helpers and is
// called from Server Actions; it is not invoked from the client.

import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  canEditBusinessData,
  canDeleteData,
  canViewFinance,
  canManageStaff,
  type DealerStaffRole,
} from "@/lib/staff/staff-types";

export type StaffCapability = "edit" | "finance" | "delete" | "manage";

// Standardized denial response (matches the existing { error: string } convention).
export const AUTHORIZATION_DENIED = "この操作を行う権限がありません";

function capabilityAllows(capability: StaffCapability, role: DealerStaffRole): boolean {
  switch (capability) {
    case "edit":    return canEditBusinessData(role);
    case "finance": return canViewFinance(role);
    case "delete":  return canDeleteData(role);
    case "manage":  return canManageStaff(role);
    default:        return false; // unknown capability → deny
  }
}

// Returns the resolved tenant + role on success, or a typed { error } on denial.
// dealer_id is always server-resolved (never from client).
export async function requireStaffCapability(
  capability: StaffCapability,
): Promise<{ dealerId: string; role: DealerStaffRole } | { error: string }> {
  const staff = await getCurrentStaff();
  if (!staff) return { error: AUTHORIZATION_DENIED };          // fail-closed: no auth/dealer

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: AUTHORIZATION_DENIED };         // dealer_id server-side only

  if (!capabilityAllows(capability, staff.role)) {
    return { error: AUTHORIZATION_DENIED };                    // role lacks capability
  }

  return { dealerId: dealer.dealer_id, role: staff.role };
}

// Non-blocking variant for conditional server logic / read gating.
export async function hasStaffCapability(capability: StaffCapability): Promise<boolean> {
  const staff = await getCurrentStaff();
  if (!staff) return false;
  return capabilityAllows(capability, staff.role);
}
