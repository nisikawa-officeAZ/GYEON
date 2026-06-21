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

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

function num(formData: FormData, key: string): number | null {
  const v = (formData.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const customerId = str(formData, "customer_id");
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
      customer_id:            customerId,
      vehicle_code:           str(formData, "vehicle_code"),
      maker:                  str(formData, "maker"),
      model:                  str(formData, "model"),
      grade:                  str(formData, "grade"),
      year:                   str(formData, "year"),
      color:                  str(formData, "color"),
      plate_number:           str(formData, "plate_number"),
      vin:                    str(formData, "vin"),
      body_size:              str(formData, "body_size"),
      mileage:                num(formData, "mileage"),
      inspection_expiry_date: str(formData, "inspection_expiry_date") || null,
      notes:                  str(formData, "notes"),
      updated_at:             new Date().toISOString(),
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
