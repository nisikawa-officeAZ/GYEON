"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { recalculateInvoicePayment } from "./recalculate-invoice-payment";
import { createAuditLog } from "@/lib/audit/audit";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function deletePayment(
  id: string
): Promise<{ error: string } | { success: true }> {
  const auth = await requireStaffCapability("delete");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Fetch to get invoice_id before deleting
  const { data: existing } = await supabase
    .from("payments")
    .select("id, invoice_id")
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id)
    .single();
  if (!existing) return { error: "入金記録が見つかりません" };

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    console.error("deletePayment error:", error);
    return { error: error.message };
  }

  // Recalculate invoice totals after deletion
  await recalculateInvoicePayment(supabase, existing.invoice_id as string, dealer.dealer_id);

  void createAuditLog({
    action: "delete",
    resource_type: "payment",
    resource_id: id,
    old_value: { invoice_id: existing.invoice_id },
  });

  return { success: true };
}
