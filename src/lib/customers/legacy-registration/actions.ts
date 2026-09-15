"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { findCustomerDuplicates } from "@/lib/customers/find-customer-duplicates";
import { findVehicleByVinOrPlate } from "@/lib/vehicles/find-vehicle-by-vin-or-plate";
import { toCustomerReferences, toVehicleReferences } from "@/lib/estimates/wizard-entity-references";
import { completeOcrSession } from "@/lib/ocr/ocr-session-actions";
import { validateAndBuildLegacyPayload } from "./legacy-registration-core";
import type {
  LegacyDuplicateResult,
  LegacyRegistrationDraft,
  LegacyRegistrationSaveResult,
  LegacyRegistrationVehicleResult,
} from "./legacy-registration-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function actorFailure(reason: string): "UNAUTHENTICATED" | "FORBIDDEN" {
  return reason === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN";
}

export async function getLegacyCustomerVehiclesAction(
  rawCustomerId: unknown,
): Promise<LegacyRegistrationVehicleResult> {
  if (typeof rawCustomerId !== "string" || !UUID.test(rawCustomerId)) {
    return { ok: false, code: "INVALID_INPUT" };
  }
  const actor = await getEstimateSaveActorContext();
  if (!actor.ok) return { ok: false, code: actorFailure(actor.reason) };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("id, customer_id, maker, model, plate_number, body_size")
      .eq("dealer_id", actor.context.dealerId)
      .eq("customer_id", rawCustomerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return { ok: false, code: "SEARCH_FAILED" };
    if (data.some((row) => row.customer_id !== rawCustomerId)) {
      return { ok: false, code: "SEARCH_FAILED" };
    }
    return { ok: true, vehicles: toVehicleReferences(data) };
  } catch {
    return { ok: false, code: "SEARCH_FAILED" };
  }
}

export async function findLegacyRegistrationDuplicatesAction(
  input: unknown,
): Promise<LegacyDuplicateResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "SEARCH_FAILED" };
  }
  const value = input as {
    customer?: { lastName?: unknown; firstName?: unknown; phone?: unknown } | null;
    vehicle?: { vin?: unknown; plateNumber?: unknown };
  };
  const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
  const actor = await getEstimateSaveActorContext();
  if (!actor.ok) return { ok: false, code: actorFailure(actor.reason) };
  try {
    const [customerRows, vehicleRows] = await Promise.all([
      value.customer
        ? findCustomerDuplicates({
            last_name: text(value.customer.lastName) || undefined,
            first_name: text(value.customer.firstName) || undefined,
            phone: text(value.customer.phone) || undefined,
          })
        : Promise.resolve([]),
      findVehicleByVinOrPlate({
        vin: text(value.vehicle?.vin) || undefined,
        plate_number: text(value.vehicle?.plateNumber) || undefined,
      }),
    ]);
    return {
      ok: true,
      customers: toCustomerReferences(customerRows),
      vehicles: toVehicleReferences(vehicleRows),
    };
  } catch {
    return { ok: false, code: "SEARCH_FAILED" };
  }
}

const ERROR_MAP = [
  ["AUTH_REQUIRED", "UNAUTHENTICATED", "ログイン状態を確認して、もう一度お試しください。"],
  ["FORBIDDEN", "FORBIDDEN", "この操作を行う権限がありません。"],
  ["PERMISSION_DENIED", "FORBIDDEN", "この操作を行う権限がありません。"],
  ["CUSTOMER_NOT_FOUND", "CUSTOMER_NOT_FOUND", "選択した顧客を確認できませんでした。"],
  ["VEHICLE_NOT_FOUND", "VEHICLE_NOT_FOUND", "選択した車両を確認できませんでした。"],
  ["VEHICLE_CUSTOMER_MISMATCH", "VEHICLE_CUSTOMER_MISMATCH", "選択した車両はこの顧客に紐付いていません。"],
  ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT", "保存内容が変更されています。画面を再読み込みしてやり直してください。"],
] as const;

export async function registerLegacyCustomerAction(input: unknown): Promise<LegacyRegistrationSaveResult> {
  const validated = validateAndBuildLegacyPayload(input);
  if (!validated.ok) {
    return { ok: false, code: "INVALID_INPUT", message: "入力内容を確認してください。", fieldErrors: validated.fieldErrors };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("register_legacy_customer", {
      p_payload: validated.payload,
    });
    if (error) {
      const mapped = ERROR_MAP.find(([token]) => error.message.includes(token));
      return mapped
        ? { ok: false, code: mapped[1], message: mapped[2] }
        : { ok: false, code: "SAVE_FAILED", message: "保存に失敗しました。入力内容は保持されています。" };
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, code: "SAVE_FAILED", message: "保存結果を確認できませんでした。" };
    }
    const result = data as Record<string, unknown>;
    const customerId = typeof result.customerId === "string" ? result.customerId : "";
    const vehicleId = typeof result.vehicleId === "string" ? result.vehicleId : "";
    if (!UUID.test(customerId) || !UUID.test(vehicleId)) {
      return { ok: false, code: "SAVE_FAILED", message: "保存結果を確認できませんでした。" };
    }

    const draft = input as LegacyRegistrationDraft;
    if (draft.ocrSessionId && draft.reviewedOcr) {
      try {
        await completeOcrSession({
          session_id: draft.ocrSessionId,
          reviewed_result: draft.reviewedOcr,
          customer_id: customerId,
          vehicle_id: vehicleId,
        });
      } catch {
        // Registration is authoritative. OCR audit completion is non-blocking.
      }
    }

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${vehicleId}`);
    return {
      ok: true,
      customerId,
      vehicleId,
      receiptId: typeof result.receiptId === "string" ? result.receiptId : null,
      idempotentReplay: result.idempotentReplay === true,
    };
  } catch {
    return { ok: false, code: "SAVE_FAILED", message: "保存に失敗しました。入力内容は保持されています。" };
  }
}
