"use server";

// B3-B1B I1-R1 — notes-only payment correction.
//
// After creation, every financial, date, status, reference, numbering, customer, invoice,
// and allocation field of a payment is READ-ONLY at this boundary (the accepted database
// triggers additionally freeze issued-statement-captured payments). The ONLY editable
// fields are notes and internal_memo — they are not part of the authoritative receipt
// identity.
//
// ONE dealer-scoped UPDATE with a returned-row check: zero returned rows (missing or
// cross-dealer payment) is the not-found error, never a silent success. No pre-read, no
// recalculation, no invoice/allocation write, no net computation.

import { createClient } from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function updatePayment(
  id: string,
  fd: FormData
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  if (!id) return { error: "入金記録が見つかりません" };

  const supabase = await createClient();

  // ONLY the two non-financial memo fields ever reach the update payload. Financial
  // FormData fields are never read here, so they cannot leak into the write.
  const { data, error } = await supabase
    .from("payments")
    .update({
      notes:         (fd.get("notes") as string) || null,
      internal_memo: (fd.get("internal_memo") as string) || null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", id)
    .eq("dealer_id", auth.dealerId)
    .select("id");

  if (error) {
    console.error("updatePayment error:", error);
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "入金記録が見つかりません" };
  }
  return { success: true };
}
