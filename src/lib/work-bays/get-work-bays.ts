"use server";

// DealerOS — Work Bay reads (Batch B6b).
//
// Dealer-scoped; dealer_id from getCurrentDealer(), never from client.
// Gated on WORK_BAYS_SCHEMA_READY — returns [] until migration 092 is applied,
// so callers behave as before B6b.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { WORK_BAYS_SCHEMA_READY } from "@/lib/flags";
import type { WorkBayDB, WorkBayOption } from "./work-bay-types";

export async function getWorkBays(): Promise<WorkBayDB[]> {
  if (!WORK_BAYS_SCHEMA_READY) return [];
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("work_bays")
      .select("*")
      .eq("dealer_id", dealer.dealer_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[getWorkBays] error — returning empty:", error.message);
      return [];
    }
    return (data ?? []) as WorkBayDB[];
  } catch (err) {
    console.warn("[getWorkBays] failed — returning empty:", err);
    return [];
  }
}

export async function getBayOptions(): Promise<WorkBayOption[]> {
  const bays = await getWorkBays();
  return bays.map((b) => ({ id: b.id, name: b.name, active: b.active, capacity: b.capacity }));
}
