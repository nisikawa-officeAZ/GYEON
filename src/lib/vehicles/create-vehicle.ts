"use server";

// Server Action — creates a new vehicle.
//
// Security rules:
//   1. dealer_id is ALWAYS injected server-side from dealer_members.
//      dealer_id is NEVER accepted from client form input.
//   2. customer_id from the form is validated to belong to the same dealer_id
//      before insert. A user cannot attach a vehicle to another dealer's customer.

import { revalidatePath } from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export async function createVehicle(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const customerId = (formData.get("customer_id") as string | null)?.trim();
  if (!customerId) return { error: "Customer is required." };

  const supabase = await createClient();

  // Validate customer_id belongs to the same dealer — prevent cross-dealer attachment.
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (customerError || !customer) {
    return { error: "Customer not found or does not belong to your dealer." };
  }

  const { error } = await supabase.from("vehicles").insert({
    customer_id:   customerId,
    manufacturer:  (formData.get("manufacturer")  as string | null) || null,
    model:         (formData.get("model")          as string | null) || null,
    year:          (formData.get("year")           as string | null) || null,
    grade:         (formData.get("grade")          as string | null) || null,
    body_color:    (formData.get("body_color")     as string | null) || null,
    license_plate: (formData.get("license_plate")  as string | null) || null,
    vin:           (formData.get("vin")            as string | null) || null,
    memo:          (formData.get("memo")           as string | null) || null,
    dealer_id:     dealer.dealer_id,   // server-injected — never from form
  });

  if (error) {
    console.error("[createVehicle] error:", error.message);
    return { error: error.message };
  }

  revalidatePath("/vehicles");
  return { success: true };
}
