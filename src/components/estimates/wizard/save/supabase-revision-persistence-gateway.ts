import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { EstimatePersistenceGateway, EstimateSaveGatewayResult } from "./estimate-persistence-gateway";
import type { WizardRevisionSource } from "./revision-save-intent";

const CODED = [
  "UNAUTHENTICATED", "PERMISSION_DENIED", "DEALER_CONTEXT_REQUIRED", "VALIDATION_ERROR",
  "PRICING_INCOMPLETE", "CUSTOMER_NOT_FOUND", "VEHICLE_NOT_FOUND", "DUPLICATE_SUBMISSION",
  "REVISION_SOURCE_UNAVAILABLE", "REVISION_SOURCE_CHANGED", "REVISION_CONFLICT",
] as const;

function controlledFailure(message: string | undefined): EstimateSaveGatewayResult {
  const raw = message ?? "";
  const code = CODED.find((candidate) => raw === candidate || raw.startsWith(`${candidate}:`));
  if (code === "DUPLICATE_SUBMISSION" || code === "REVISION_CONFLICT") {
    return { ok: false, code: "DUPLICATE_SUBMISSION", message: "この見積には既に新版があります。" };
  }
  if (code === "UNAUTHENTICATED") return { ok: false, code, message: "ログインが必要です。" };
  if (code === "PERMISSION_DENIED") return { ok: false, code, message: "この操作を行う権限がありません。" };
  if (code === "VALIDATION_ERROR") return { ok: false, code, message: "入力内容に不備があります。" };
  return { ok: false, code: "SAVE_FAILED", message: "新版の保存に失敗しました。" };
}

export function createSupabaseRevisionPersistenceGateway(
  source: WizardRevisionSource,
): EstimatePersistenceGateway {
  return {
    async saveEstimate(payload, context, draftSnapshot): Promise<EstimateSaveGatewayResult> {
      if (draftSnapshot === undefined) return { ok: false, code: "SAVE_FAILED", message: "新版の保存に失敗しました。" };
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("issue_estimate_revision_from_wizard", {
        p_dealer_id: context.dealerId,
        p_actor_user_id: context.userId,
        p_predecessor_estimate_id: source.predecessorEstimateId,
        p_source_snapshot_fingerprint: source.sourceSnapshotFingerprint,
        p_payload: payload,
        p_draft_snapshot: draftSnapshot,
      });
      if (error) return controlledFailure(error.message);
      const result = (data ?? {}) as {
        ok?: boolean; estimate_id?: string; estimate_number?: string;
        customer_id?: string; vehicle_id?: string; idempotent_replay?: boolean;
      };
      if (!result.ok || typeof result.estimate_id !== "string" || typeof result.estimate_number !== "string" || result.estimate_number.trim() === "") {
        return { ok: false, code: "SAVE_FAILED", message: "新版の保存に失敗しました。" };
      }
      return {
        ok: true,
        estimateId: result.estimate_id,
        estimateNumber: result.estimate_number,
        customerId: result.customer_id ?? "",
        vehicleId: result.vehicle_id ?? "",
        replay: result.idempotent_replay === true,
      };
    },
  };
}
