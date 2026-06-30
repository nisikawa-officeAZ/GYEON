"use server";

// Phase 2 Sprint 2 — Server Action: update a customer's notes only.
//
// Security rule:
//   Scoped by BOTH id AND dealer_id from getCurrentDealer().
//   dealer_id is NEVER accepted from client input and is never changed here.
//   Writes only the `notes` column (no schema change introduced).

import { revalidatePath }     from "next/cache";
import { createClient }       from "@/lib/supabase/server";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { createActivityLog }  from "@/lib/activity/activity-log";

export async function updateCustomerNotes(customerId: string, notes: string) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const trimmed = notes.trim();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ notes: trimmed || null, updated_at: new Date().toISOString() })
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateCustomerNotes] error:", error.message);
    return { error: error.message };
  }

  void createActivityLog({
    entity_type: "customer",
    entity_id:   customerId,
    customer_id: customerId,
    action:      "updated",
    title:       "メモを更新",
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: true };
}
