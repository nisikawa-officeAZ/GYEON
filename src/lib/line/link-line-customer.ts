"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

// Links a DealerOS customer to a LINE user_id.
// Called from LIFF link endpoint after LINE Login verification.

export async function linkLineCustomer(
  customerId: string,
  lineUserId:  string,
  displayName: string,
  pictureUrl?: string | null,
  statusMessage?: string | null
): Promise<{ error: string } | { success: true }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();

  // Validate customer ownership
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  if (!customer) return { error: "顧客が見つかりません" };

  const now = new Date().toISOString();

  // Upsert line_customers record
  const { error: lcErr } = await supabase
    .from("line_customers")
    .upsert(
      {
        dealer_id:    dealer.dealer_id,
        customer_id:  customerId,
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url:  pictureUrl  ?? null,
        status_message: statusMessage ?? null,
        is_friend:    true,
        linked_at:    now,
        updated_at:   now,
      },
      { onConflict: "dealer_id,line_user_id" }
    );

  if (lcErr) {
    console.error("linkLineCustomer upsert error:", lcErr);
    return { error: lcErr.message };
  }

  // Update customer.line_connected = true and line_user_id
  const { error: custErr } = await supabase
    .from("customers")
    .update({
      line_connected:   true,
      line_user_id:     lineUserId,
      line_display_name: displayName,
      line_picture_url:  pictureUrl ?? null,
      updated_at:        now,
    })
    .eq("id", customerId)
    .eq("dealer_id", dealer.dealer_id);

  if (custErr) {
    console.error("linkLineCustomer customer update error:", custErr);
    return { error: custErr.message };
  }

  return { success: true };
}

export async function unlinkLineCustomer(
  customerId: string
): Promise<{ error: string } | { success: true }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "認証エラー" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  await supabase
    .from("line_customers")
    .update({ is_friend: false, updated_at: now })
    .eq("dealer_id", dealer.dealer_id)
    .eq("customer_id", customerId);

  await supabase
    .from("customers")
    .update({ line_connected: false, updated_at: now })
    .eq("id", customerId)
    .eq("dealer_id", dealer.dealer_id);

  return { success: true };
}
