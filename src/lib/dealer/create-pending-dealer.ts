"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function createPendingDealer(params: {
  businessName: string;
  ownerUserId:  string;
  email:        string;
}): Promise<{ success: true; dealerId: string } | { success: false; error: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dealers")
    .insert({
      name:                params.businessName,
      owner_user_id:       params.ownerUserId,
      email:               params.email,
      approval_status:     "pending",
      subscription_status: "pending",
      plan:                "basic",
      status:              "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createPendingDealer] insert error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, dealerId: data.id };
}
