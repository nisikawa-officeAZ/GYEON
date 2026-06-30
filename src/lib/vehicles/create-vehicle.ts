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
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

function num(formData: FormData, key: string): number | null {
  const v = (formData.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function createVehicle(formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "ディーラー認証に失敗しました" };

  const customerId = str(formData, "customer_id");
  if (!customerId) return { error: "顧客IDが必要です" };

  const supabase = await createClient();

  // Validate customer_id belongs to the same dealer — prevent cross-dealer attachment.
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (customerError || !customer) {
    return { error: "顧客情報の確認に失敗しました" };
  }

  const { data: newVehicle, error } = await supabase.from("vehicles").insert({
    dealer_id:              dealer.dealer_id,   // server-injected — never from form
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
    // Added in migration 073
    displacement:           str(formData, "displacement"),
    fuel_type:              str(formData, "fuel_type"),
    registration_date:      str(formData, "registration_date") || null,
  }).select("id").single();

  if (error) {
    console.error("[createVehicle] error:", error.message);
    return { error: error.message };
  }

  if (!newVehicle) return { error: "車両の作成に失敗しました" };

  revalidatePath("/vehicles");
  return { success: true, vehicleId: newVehicle.id };
}
