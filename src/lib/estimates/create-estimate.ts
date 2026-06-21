"use server";

// Server Action — creates a new estimate.
//
// Security rules:
//   1. dealer_id is ALWAYS injected server-side from dealer_members.
//      dealer_id is NEVER accepted from client form input.
//   2. customer_id from the form is validated to belong to the same dealer_id.
//   3. vehicle_id from the form is validated to belong to the same dealer_id.

import { revalidatePath } from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { EstimateStatus }   from "./estimate-types";

export async function createEstimate(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const customerId  = (formData.get("customer_id")  as string | null)?.trim();
  const vehicleId   = (formData.get("vehicle_id")   as string | null)?.trim();
  const estimateNo  = (formData.get("estimate_no")  as string | null)?.trim();
  const status      = (formData.get("status")       as string | null) ?? "DRAFT";
  const subtotal    = Number(formData.get("subtotal") ?? 0);
  const tax         = Number(formData.get("tax")      ?? 0);
  const total       = Number(formData.get("total")    ?? 0);

  if (!customerId)  return { error: "Customer is required." };
  if (!vehicleId)   return { error: "Vehicle is required." };
  if (!estimateNo)  return { error: "Estimate No is required." };

  const supabase = await createClient();

  // Validate customer_id belongs to the same dealer.
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (customerError || !customer) {
    return { error: "Customer not found or does not belong to your dealer." };
  }

  // Validate vehicle_id belongs to the same dealer.
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id",        vehicleId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (vehicleError || !vehicle) {
    return { error: "Vehicle not found or does not belong to your dealer." };
  }

  const { error } = await supabase.from("estimates").insert({
    customer_id:  customerId,
    vehicle_id:   vehicleId,
    estimate_no:  estimateNo,
    status:       status as EstimateStatus,
    subtotal:     isNaN(subtotal) ? 0 : subtotal,
    tax:          isNaN(tax)      ? 0 : tax,
    total:        isNaN(total)    ? 0 : total,
    dealer_id:    dealer.dealer_id,   // server-injected — never from form
  });

  if (error) {
    console.error("[createEstimate] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/estimates");
  return { success: true };
}
