// DealerOS — AI cost estimation (minimal, approximate)
// Single source of truth for a rough per-call cost estimate. This is NOT billing:
// it produces an advisory "概算" figure for the Developer Preview verification
// screens and the OCR result panel. Prices are approximate USD list prices and
// are intended to be adjusted centrally here if they change.
//
// See: docs/AI_API_OWNERSHIP_POLICY.md

/** Approximate USD price per 1,000 tokens, by model. */
interface ModelRate {
  inputPer1k:  number;
  outputPer1k: number;
}

// Approximate list prices (USD / 1K tokens). Adjust here if pricing changes.
const MODEL_RATES: Record<string, ModelRate> = {
  "gpt-4.1-mini": { inputPer1k: 0.0004, outputPer1k: 0.0016 },
  "gpt-4o-mini":  { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "gpt-4.1":      { inputPer1k: 0.002,  outputPer1k: 0.008 },
  "gpt-4o":       { inputPer1k: 0.0025, outputPer1k: 0.01 },
};

// Fallback when the model is unknown — use the OCR default's rate.
const DEFAULT_RATE: ModelRate = MODEL_RATES["gpt-4.1-mini"];

/**
 * Estimate the USD cost of a single call. Returns null when token counts are
 * unavailable (so callers can store/display null rather than a misleading 0).
 */
export function estimateCostUsd(
  model: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number | null {
  if (inputTokens == null && outputTokens == null) return null;
  const rate = (model && MODEL_RATES[model]) || DEFAULT_RATE;
  const inCost  = ((inputTokens  ?? 0) / 1000) * rate.inputPer1k;
  const outCost = ((outputTokens ?? 0) / 1000) * rate.outputPer1k;
  return Number((inCost + outCost).toFixed(6));
}

/** Format a USD estimate for display (approximate). */
export function formatUsd(cost: number | null | undefined): string {
  if (cost == null) return "—";
  return `$${cost.toFixed(4)}`;
}
