"use server";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import type { DealerStaffDB } from "@/lib/staff/staff-types";

export async function getStaffList(): Promise<DealerStaffDB[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_staff")
      .select("*")
      .eq("dealer_id", dealer.dealer_id)
      .order("created_at", { ascending: true });

    if (error) {
      // Gracefully handle table-not-found or other errors
      return [];
    }

    return (data ?? []) as DealerStaffDB[];
  } catch {
    return [];
  }
}
