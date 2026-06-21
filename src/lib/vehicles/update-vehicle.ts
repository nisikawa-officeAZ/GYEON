"use server";

// Server Action — updates an existing vehicle.
//
// Security rules:
//   1. Update is scoped by BOTH id AND dealer_id from dealer_members.
//      A user cannot update a vehicle belonging to another dealer.
//   2. If customer_id is changed, the new customer_id is validated to belong
//      to the same dealer_id before update.
//   3. dealer_id is NEVER changeable via this action.

import { revalidatePath } from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const customerId = (formData.get("customer_id") as string | null)?.trim();
  if (!customerId) return { error: "Customer is required." };

  const supabase = await createClient();

  // If customer_id is being changed, validate it belongs to the same dealer.
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (customerError || !customer) {
    return { error: "Customer not found or does not belong to your dealer." };
  }

  const { error } = await supabase
    .from("vehicles")
    .update({
      customer_id:   customerId,
      manufacturer:  (formData.get("manufacturer")  as string | null) || null,
      model:         (formData.get("model")          as string | null) || null,
      year:          (formData.get("year")           as string | null) || null,
      grade:         (formData.get("grade")          as string | null) || null,
      body_color:    (formData.get("body_color")     as string | null) || null,
      license_plate: (formData.get("license_plate")  as string | null) || null,
      vin:           (formData.get("vin")            as string | null) || null,
      memo:          (formData.get("memo")           as string | null) || null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id",        vehicleId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (error) {
    console.error("[updateVehicle] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/vehicles");
  return { success: true };
}
