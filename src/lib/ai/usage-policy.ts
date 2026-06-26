// DealerOS — AI Gateway: Usage Policy
// Design only — NO runtime implementation.
//
// Defines the data shapes for tracking AI usage and enforcing dealer-configured limits.
// Actual usage tracking requires dealer_ai_usage_log table (future migration — CTO approval).
//
// Key principle: Office AZ does not pay AI inference costs.
// All costs are tracked against and paid by the dealer's own API key.

import type { AIProviderId, AITaskType } from "./types";

// ─── Usage estimate ───────────────────────────────────────────────────────────

export interface AIUsageEstimate {
  task_type:     AITaskType;
  provider:      AIProviderId;
  model:         string;
  /** Estimated token count for this request (input + estimated output). */
  estimated_tokens: number;
  /** Estimated cost in USD — advisory only, actual cost depends on provider pricing. */
  estimated_usd: number;
  currency:      "usd";
  note:          string;
}

// ─── Usage policy ─────────────────────────────────────────────────────────────

export interface AIUsagePolicy {
  /** dealer_id — always from dealer_ai_settings, never from client. */
  dealer_id:         string;
  /** Monthly spend cap in USD. 0 = no limit configured. */
  monthly_limit_usd: number;
  /** Whether to block requests when limit is reached (vs. warn only). */
  hard_limit:        boolean;
  /** Estimated current month spend in USD. */
  current_month_usd: number;
  /** True if current_month_usd >= monthly_limit_usd (and monthly_limit_usd > 0). */
  limit_reached:     boolean;
}

// ─── Usage event (future storage in dealer_ai_usage_log) ─────────────────────

export interface AIUsageEvent {
  dealer_id:          string;
  task_type:          AITaskType;
  provider:           AIProviderId;
  model:              string;
  prompt_tokens:      number;
  completion_tokens:  number;
  total_tokens:       number;
  estimated_cost_usd: number;
  created_at:         string;  // ISO 8601
}

// ─── Monthly summary ──────────────────────────────────────────────────────────

export interface AIUsageSummary {
  dealer_id:              string;
  period:                 string;   // "YYYY-MM"
  total_tokens:           number;
  estimated_cost_usd:     number;
  by_task_type:           Partial<Record<AITaskType, { tokens: number; cost_usd: number }>>;
  by_provider:            Partial<Record<AIProviderId, { tokens: number; cost_usd: number }>>;
  policy:                 AIUsagePolicy;
}
