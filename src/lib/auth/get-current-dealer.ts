// Server-side helper — resolves dealer membership from dealer_members table.
//
// Architecture rule:
//   dealer_id MUST NOT equal auth.uid().
//   Dealer isolation is based on dealer_members, not auth.users directly.
//
// Query:
//   SELECT dealer_id, role
//   FROM dealer_members
//   WHERE user_id = auth.uid()
//     AND status = 'active'
//
// Returns null if:
//   - User is not authenticated
//   - No active dealer_members record exists for the user

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./get-current-user";

export interface DealerMembership {
  dealer_id: string;
  role: string;
}

export async function getCurrentDealer(): Promise<DealerMembership | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("dealer_members")
      .select("dealer_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      dealer_id: data.dealer_id,
      role: data.role,
    };
  } catch {
    return null;
  }
}
