"use server";

// Phase 2 Sprint 1 — Customer + Vehicle registration orchestration.
//
// Takes a reviewed OCR result (already mapped into customer/vehicle form state)
// and creates a customer (or reuses an existing one) plus a linked vehicle, then
// completes the OCR session. It composes the EXISTING create actions so that all
// validation, server-side dealer_id injection, activity/audit logging, and path
// revalidation continue to apply exactly as before.
//
// Architecture rules preserved:
//   - dealer_id ALWAYS resolved via getCurrentDealer(); never from client input.
//   - customer_id ownership re-validated before attaching a vehicle.
//   - RLS assumptions unchanged.

import { createCustomer }     from "@/lib/customers/create-customer";
import { createVehicle }      from "@/lib/vehicles/create-vehicle";
import { createClient }       from "@/lib/supabase/server";
import { getCurrentDealer }   from "@/lib/auth/get-current-dealer";
import { completeOcrSession } from "./ocr-session-actions";
import type { RegisterFromOcrParams, RegisterFromOcrResult } from "./register-types";

export async function registerCustomerAndVehicleFromOcr(
  params: RegisterFromOcrParams,
): Promise<RegisterFromOcrResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "ディーラー認証に失敗しました" };

  const { customer, vehicle } = params;

  // ── 1. Resolve the customer ───────────────────────────────────────────────
  let customerId: string;

  if (params.existingCustomerId) {
    // Validate the customer belongs to this dealer (defense-in-depth over RLS).
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("id",        params.existingCustomerId)
      .eq("dealer_id", dealer.dealer_id)
      .is("deleted_at", null)
      .single();

    if (error || !data) return { success: false, error: "顧客情報の確認に失敗しました" };
    customerId = data.id;
  } else {
    if (!customer.last_name.trim()) return { success: false, error: "姓は必須です" };

    const cfd = new FormData();
    cfd.set("last_name",       customer.last_name.trim());
    cfd.set("first_name",      customer.first_name.trim());
    cfd.set("last_name_kana",  customer.last_name_kana.trim());
    cfd.set("first_name_kana", customer.first_name_kana.trim());
    cfd.set("phone",           customer.phone.trim());
    cfd.set("email",           customer.email.trim());
    cfd.set("postal_code",     customer.postal_code.trim());
    cfd.set("prefecture",      customer.prefecture.trim());
    cfd.set("city",            customer.city.trim());
    cfd.set("address1",        customer.address1.trim());
    cfd.set("notes",           customer.notes.trim());
    cfd.set("line_user_id",    customer.line_user_id.trim());
    if (customer.is_company) cfd.set("occupation", "法人");

    const customerResult = await createCustomer(cfd);
    if ("error" in customerResult) {
      return { success: false, error: customerResult.error ?? "顧客の作成に失敗しました" };
    }
    customerId = customerResult.customerId;
  }

  // ── 2. Create the vehicle (createVehicle re-validates customer ownership) ──
  const vfd = new FormData();
  vfd.set("customer_id",            customerId);
  vfd.set("maker",                  vehicle.maker.trim());
  vfd.set("model",                  vehicle.model.trim());
  vfd.set("grade",                  vehicle.grade.trim());
  vfd.set("year",                   vehicle.year.trim());
  vfd.set("color",                  vehicle.color.trim());
  vfd.set("plate_number",           vehicle.plate_number.trim());
  vfd.set("vin",                    vehicle.vin.trim());
  vfd.set("body_size",              vehicle.body_size.trim());
  vfd.set("inspection_expiry_date", vehicle.inspection_expiry_date.trim());
  vfd.set("displacement",           vehicle.displacement.trim());
  vfd.set("fuel_type",              vehicle.fuel_type.trim());
  vfd.set("registration_date",      vehicle.registration_date.trim());
  vfd.set("notes",                  vehicle.notes.trim());

  const vehicleResult = await createVehicle(vfd);
  if ("error" in vehicleResult) {
    // The customer may already exist — surface its id so the caller can retry
    // the vehicle step without creating a duplicate customer.
    return {
      success:    false,
      error:      vehicleResult.error ?? "車両の作成に失敗しました",
      customerId,
    };
  }

  // ── 3. Complete the OCR session (non-blocking) ────────────────────────────
  if (params.sessionId && params.reviewedResult) {
    try {
      await completeOcrSession({
        session_id:      params.sessionId,
        reviewed_result: params.reviewedResult,
        customer_id:     customerId,
        vehicle_id:      vehicleResult.vehicleId,
      });
    } catch {
      // Session completion must not block the registration result.
    }
  }

  return { success: true, customerId, vehicleId: vehicleResult.vehicleId };
}
