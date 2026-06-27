"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import type { DealerStaffRole } from "@/lib/staff/staff-types";

const VALID_ROLES: DealerStaffRole[] = ["owner", "manager", "staff", "readonly"];

function isValidRole(role: string): role is DealerStaffRole {
  return VALID_ROLES.includes(role as DealerStaffRole);
}

export async function getCurrentStaff(): Promise<{ role: DealerStaffRole; staffId: string | null } | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("dealer_staff")
        .select("id, role")
        .eq("dealer_id", dealer.dealer_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (!error && data) {
        const role: DealerStaffRole = isValidRole(data.role) ? data.role : "readonly";
        return { role, staffId: data.id };
      }

      // Table doesn't exist or no record — fallback to dealer_members role
      const fallbackRole: DealerStaffRole = isValidRole(dealer.role) ? dealer.role : "readonly";
      return { role: fallbackRole, staffId: null };
    } catch {
      // Table doesn't exist yet — fallback to dealer_members role
      const fallbackRole: DealerStaffRole = isValidRole(dealer.role) ? dealer.role : "readonly";
      return { role: fallbackRole, staffId: null };
    }
  } catch {
    return null;
  }
}
