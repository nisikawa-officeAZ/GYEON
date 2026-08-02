"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import type { DealerStaffRole } from "@/lib/staff/staff-types";
import {
  resolveStaffAuthorization,
  type DealerStaffQueryOutcome,
} from "@/lib/staff/current-staff-authorization-core";

export async function getCurrentStaff(): Promise<{ role: DealerStaffRole; staffId: string | null } | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    // B1-R5-1: read the dealer_staff row WITHOUT a status filter, so a
    // disabled or invited row is SEEN and denies access instead of silently
    // vanishing into the dealer_members fallback. maybeSingle keeps "no row"
    // distinguishable from a real query failure; any failure — including a
    // missing table — is a hard denial, never a fallback.
    let staffQuery: DealerStaffQueryOutcome;
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("dealer_staff")
        .select("id, role, status")
        .eq("dealer_id", dealer.dealer_id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        staffQuery = { kind: "error" };
      } else if (!data) {
        staffQuery = { kind: "no-row" };
      } else {
        staffQuery = { kind: "row", id: data.id, role: data.role, status: data.status };
      }
    } catch {
      staffQuery = { kind: "error" };
    }

    // getCurrentDealer only ever returns an ACTIVE membership, so the fallback
    // status is known here; the core validates it anyway so the whole rule
    // lives in one tested place.
    const decision = resolveStaffAuthorization(staffQuery, {
      role: dealer.role,
      status: "active",
    });

    if (decision.kind !== "authorized") return null;
    return { role: decision.role, staffId: decision.staffId };
  } catch {
    return null;
  }
}
