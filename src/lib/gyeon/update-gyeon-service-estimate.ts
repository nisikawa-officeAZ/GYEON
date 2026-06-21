"use server";

// Server Action — updates an existing GYEON service estimate.
//
// Security rules:
//   1. Update is scoped by BOTH id AND dealer_id from dealer_members.
//      A user cannot update a record belonging to another dealer.
//   2. estimate_id changes are validated against the same dealer.
//   3. dealer_id is NEVER changeable via this action.

import { revalidatePath }              from "next/cache";
import { createClient }                from "@/lib/supabase/server";
import { getCurrentDealer }            from "@/lib/auth/get-current-dealer";
import { GyeonOptionsJson }            from "./gyeon-service-types";
import { ServiceCategory, BodySize }   from "@/components/services/mockServiceEstimate";

export async function updateGyeonServiceEstimate(gyeonId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const estimateId      = (formData.get("estimate_id")      as string | null)?.trim();
  const serviceCategory = (formData.get("service_category") as string | null)?.trim();
  const bodySize        = (formData.get("body_size")        as string | null)?.trim();
  const optionsJsonRaw  = (formData.get("options_json")     as string | null) ?? "{}";

  if (!estimateId)      return { error: "Estimate is required." };
  if (!serviceCategory) return { error: "Service category is required." };
  if (!bodySize)        return { error: "Body size is required." };

  const supabase = await createClient();

  // Validate estimate_id belongs to the same dealer.
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id")
    .eq("id",        estimateId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (estimateError || !estimate) {
    return { error: "Estimate not found or does not belong to your dealer." };
  }

  let optionsJson: GyeonOptionsJson;
  try {
    optionsJson = JSON.parse(optionsJsonRaw) as GyeonOptionsJson;
  } catch {
    return { error: "Invalid options data." };
  }

  const basePrice = Number(formData.get("base_price") ?? 0);
  const discount  = Number(formData.get("discount")   ?? 0);
  const subtotal  = Number(formData.get("subtotal")   ?? 0);
  const tax       = Number(formData.get("tax")        ?? 0);
  const total     = Number(formData.get("total")      ?? 0);

  const { error } = await supabase
    .from("gyeon_service_estimates")
    .update({
      estimate_id:      estimateId,
      service_category: serviceCategory as ServiceCategory,
      body_size:        bodySize        as BodySize,
      base_price:       isNaN(basePrice) ? 0 : basePrice,
      options_json:     optionsJson,
      discount:         isNaN(discount)  ? 0 : discount,
      subtotal:         isNaN(subtotal)  ? 0 : subtotal,
      tax:              isNaN(tax)       ? 0 : tax,
      total:            isNaN(total)     ? 0 : total,
      updated_at:       new Date().toISOString(),
    })
    .eq("id",        gyeonId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateGyeonServiceEstimate] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/estimates");
  return { success: true };
}
