// DealerOS — AI Center: minimal usage logging
// SERVER-ONLY. Best-effort, non-blocking: a logging failure must never affect
// the AI call it records. Writes to gyeon_ai_usage_log via the service-role
// client (the table is RLS service-role-only). NOT a "use server" action.
//
// See: docs/AI_API_OWNERSHIP_POLICY.md, migration 095.

import { createAdminClient } from "@/lib/supabase/admin";

export interface AiUsageLogInput {
  /** Owned-feature key, e.g. "vehicle_registration_ocr". */
  featureKey:     string;
  dealerId?:      string | null;
  usedBy?:        string | null;
  model?:         string | null;
  inputTokens?:   number | null;
  outputTokens?:  number | null;
  totalTokens?:   number | null;
  estimatedCost?: number | null;
  responseMs?:    number | null;
  status:         "success" | "failed";
  errorCode?:     string | null;
}

/** Insert one usage-log row. Best-effort — swallows all errors. */
export async function logAiUsage(input: AiUsageLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("gyeon_ai_usage_log").insert({
      feature_key:    input.featureKey,
      dealer_id:      input.dealerId ?? null,
      used_by:        input.usedBy ?? null,
      model:          input.model ?? null,
      input_tokens:   input.inputTokens ?? null,
      output_tokens:  input.outputTokens ?? null,
      total_tokens:   input.totalTokens ?? null,
      estimated_cost: input.estimatedCost ?? null,
      response_ms:    input.responseMs ?? null,
      status:         input.status,
      error_code:     input.errorCode ?? null,
    });
  } catch {
    // Table missing / service-role unavailable — never block the caller.
  }
}
