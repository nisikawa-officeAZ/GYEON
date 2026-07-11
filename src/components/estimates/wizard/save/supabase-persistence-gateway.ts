import "server-only";

// Estimate Wizard Ver2.2 — Supabase atomic-RPC persistence gateway (Phase 11I).
//
// The REAL persistence gateway. Server-only. It (Option B) allocates + formats the estimate number via
// the existing authoritative TypeScript numbering rules, then calls the single atomic RPC
// `save_estimate_from_wizard` (migration 102). It maps the RPC's coded errors to stable codes and
// NEVER exposes raw Supabase/Postgres error text. Dealer id comes from the server context only
// (getCurrentDealer upstream); it is never read from the payload/client. No persistence logic is
// duplicated here — the transaction lives entirely in the RPC.

import { createClient } from "@/lib/supabase/server";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import type { EstimatePersistenceGateway, EstimateSaveGatewayResult } from "./estimate-persistence-gateway";

// Known RPC error-code prefixes → stable gateway codes. Anything else → SAVE_FAILED (no raw leak).
const RPC_CODE_PREFIXES = [
  "DEALER_CONTEXT_REQUIRED", "VALIDATION_ERROR", "PRICING_INCOMPLETE",
  "CUSTOMER_NOT_FOUND", "VEHICLE_NOT_FOUND", "DUPLICATE_SUBMISSION",
  "ESTIMATE_NUMBER_FAILED", "ESTIMATE_CREATE_FAILED", "ESTIMATE_ITEM_CREATE_FAILED",
] as const;

function mapRpcError(rawMessage: string | undefined): { code: string; message: string } {
  const msg = rawMessage ?? "";
  const prefix = RPC_CODE_PREFIXES.find((c) => msg.startsWith(`${c}:`) || msg === c);
  if (prefix === "DUPLICATE_SUBMISSION") return { code: "DUPLICATE_SUBMISSION", message: "同じ内容の見積が既に保存されています。" };
  if (prefix === "CUSTOMER_NOT_FOUND")   return { code: "CUSTOMER_NOT_FOUND", message: "お客様情報を確認できませんでした。" };
  if (prefix === "VEHICLE_NOT_FOUND")    return { code: "VEHICLE_NOT_FOUND", message: "車両情報を確認できませんでした。" };
  if (prefix === "PRICING_INCOMPLETE")   return { code: "PRICING_INCOMPLETE", message: "価格が未確定のため保存できません。" };
  if (prefix === "VALIDATION_ERROR")     return { code: "VALIDATION_ERROR", message: "入力内容に不備があります。" };
  if (prefix === "DEALER_CONTEXT_REQUIRED") return { code: "DEALER_CONTEXT_REQUIRED", message: "ディーラー情報の取得に失敗しました。" };
  return { code: "SAVE_FAILED", message: "保存中にエラーが発生しました。" };
}

export const supabasePersistenceGateway: EstimatePersistenceGateway = {
  async saveEstimate(payload, ctx): Promise<EstimateSaveGatewayResult> {
    // 1. Allocate + format the estimate number via the existing authoritative numbering (Option B).
    const estimateNumber = await getNextDocumentNumber("estimate");
    if (!estimateNumber) {
      return { ok: false, code: "ESTIMATE_NUMBER_FAILED", message: "見積番号を採番できませんでした。" };
    }

    // 2. Single atomic RPC — the ONLY place customer/vehicle/estimate/items persist together.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_estimate_from_wizard", {
      p_dealer_id:       ctx.dealerId,   // server-resolved (getCurrentDealer); never from payload
      p_actor_user_id:   ctx.userId,
      p_estimate_number: estimateNumber,
      p_payload:         payload,
    });

    if (error) {
      return { ok: false, ...mapRpcError(error.message) };
    }

    // 3. Map the RPC jsonb result (never raw DB error text to the client).
    const r = (data ?? {}) as {
      ok?: boolean; estimate_id?: string; estimate_number?: string;
      customer_id?: string; vehicle_id?: string; idempotent_replay?: boolean;
    };
    if (!r.ok || !r.estimate_id) {
      return { ok: false, code: "SAVE_FAILED", message: "保存に失敗しました。" };
    }
    return {
      ok: true,
      estimateId:     r.estimate_id,
      estimateNumber: r.estimate_number ?? estimateNumber,
      customerId:     r.customer_id ?? "",
      vehicleId:      r.vehicle_id ?? "",
      replay:         !!r.idempotent_replay,
    };
  },
};
