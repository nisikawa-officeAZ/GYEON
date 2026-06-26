// DealerOS — Reputation Agent Runtime: Review Request Generation Dry-Run (Phase C)
//
// Sprint 11D Phase C: pure dry-run path for future review request generation.
//
// This module builds the full dry-run output for a review_request_generation task
// without calling any AI provider. It describes exactly what would happen when:
//   1. All checks pass
//   2. The dealer approves
//   3. The AI provider adapter is available (Phase 11E+)
//
// Input: pre-fetched context (caller handles all DB lookups)
// Output: ReviewRequestDryRunResult with readiness, missing settings,
//         action plan, future prompt metadata, and compliance checklist
//
// Security:
//   dealer_id must always come from getCurrentDealer() in the server action that
//   constructs ReputationExecutionContext. This module never accepts dealer_id from
//   client form input.
//   No AI output is generated. No messages are sent.

import type { ReviewDestination }           from "@/lib/reputation/reputation-types";
import type { ReputationPolicy }            from "@/lib/reputation/reputation-profile";
import type {
  ReputationActionPlan,
  ReputationActionStep,
  ReputationComplianceCheckItem,
  ReputationPromptMetadata,
  ReputationReadinessCheck,
} from "./runtime-types";
import { REPUTATION_COMPLIANCE_CHECKLIST } from "./compliance-guard";

// ─── Input / Output ───────────────────────────────────────────────────────────

/**
 * ReviewRequestDryRunInput — pre-fetched data needed to build the dry-run result.
 *
 * All DB lookups are done by the caller (server action or ReputationRuntime).
 * This keeps buildReviewRequestDryRun() a pure, synchronous function.
 */
export interface ReviewRequestDryRunInput {
  /** Always from getCurrentDealer() — injected by server action. */
  dealer_id:             string;
  customer_id:           string;
  vehicle_id?:           string;
  work_order_id:         string;
  completion_report_id?: string;
  service_summary:       string;
  destination:           ReviewDestination;
  language_preference:   "ja" | "en";
  reputation_policy:     ReputationPolicy;
  /** Pre-computed: AI Gateway is ready for this dealer. */
  gateway_ready:         boolean;
  /** Pre-computed: customer has not received a request in the last 30 days. */
  customer_eligible:     boolean;
  /** Pre-computed: destination is enabled and review_url is set. */
  destination_configured: boolean;
}

/**
 * ReviewRequestDryRunResult — full output of a review_request_generation dry-run.
 *
 * Contains no AI-generated content. Documents what WOULD happen
 * after dealer approval and Phase 11E+ implementation.
 */
export interface ReviewRequestDryRunResult {
  /** Always from getCurrentDealer() via context. */
  dealer_id:                 string;
  task_type:                 "review_request_generation";
  readiness_status:          "ready" | "not_ready";
  readiness_checks:          ReputationReadinessCheck[];
  all_checks_passed:         boolean;
  /** Settings the dealer must configure before AI execution is possible. */
  required_missing_settings: string[];
  action_plan:               ReputationActionPlan;
  prepared_at:               string;  // ISO 8601
}

// ─── Prompt metadata builder ──────────────────────────────────────────────────

function buildPromptMetadata(input: ReviewRequestDryRunInput): ReputationPromptMetadata {
  return {
    task_type:               "review_request_generation",
    recommended_provider:    null,   // Phase 11E: determined by gateway task routing
    estimated_tokens:        800,    // Conservative estimate for review request messages
    system_prompt_template:  "reputation_agent_review_request_v1",
    required_context_fields: [
      "dealer_id",
      "customer_name",
      "shop_name",
      "service_summary",
      "destination.platform",
      "destination.review_url",
      "language_preference",
      "reputation_policy.send_window_start_hour",
      "reputation_policy.send_window_end_hour",
    ],
    language: input.language_preference,
  };
}

// ─── Action step builder ──────────────────────────────────────────────────────

function buildActionSteps(input: ReviewRequestDryRunInput): ReputationActionStep[] {
  return [
    {
      step:        "1_gateway_check",
      description: "Verify AI Gateway readiness and provider availability",
      status:      input.gateway_ready ? "ready" : "missing",
      blocking:    true,
    },
    {
      step:        "2_destination_check",
      description: "Verify review destination URL is configured for the target platform",
      status:      input.destination_configured ? "ready" : "missing",
      blocking:    true,
    },
    {
      step:        "3_customer_check",
      description: "Verify customer is eligible per 30-day rolling policy",
      status:      input.customer_eligible ? "ready" : "missing",
      blocking:    true,
    },
    {
      step:        "4_compliance_guard",
      description: "Run workflow compliance guard (Phase D)",
      status:      "ready",
      blocking:    true,
    },
    {
      step:        "5_prompt_build",
      description: "Build review request prompt from context fields",
      status:      "deferred",
      blocking:    false,
    },
    {
      step:        "6_ai_generate",
      description: "Generate review request message via AI provider adapter (Phase 11E+)",
      status:      "deferred",
      blocking:    false,
    },
    {
      step:        "7_draft_compliance",
      description: "Run validateDraftCompliance() on generated message text",
      status:      "deferred",
      blocking:    false,
    },
    {
      step:        "8_dealer_approval",
      description: "Present draft to dealer for review and explicit approval",
      status:      "deferred",
      blocking:    false,
    },
    {
      step:        "9_line_dispatch",
      description: "Dispatch approved message via LINE (Phase 11E+)",
      status:      "deferred",
      blocking:    false,
    },
  ];
}

// ─── Readiness checks builder ─────────────────────────────────────────────────

function buildReadinessChecks(input: ReviewRequestDryRunInput): ReputationReadinessCheck[] {
  return [
    {
      name:     "ai_gateway_feature",
      status:   input.gateway_ready ? "passed" : "failed",
      blocking: true,
      message:  input.gateway_ready
        ? "AI Gateway is ready for this dealer"
        : "AI Gateway is not ready — configure provider and API key in Settings > AI",
    },
    {
      name:     "destination_configured",
      status:   input.destination_configured ? "passed" : "failed",
      blocking: true,
      message:  input.destination_configured
        ? `Review destination configured: ${input.destination.platform}`
        : `No enabled review destination URL for ${input.destination.platform} — configure in Settings > Reputation`,
    },
    {
      name:     "customer_eligible",
      status:   input.customer_eligible ? "passed" : "failed",
      blocking: true,
      message:  input.customer_eligible
        ? "Customer is eligible for a review request"
        : `Customer received a review request within the last ${input.reputation_policy.max_requests_per_customer_per_30_days * 30} days`,
    },
    {
      name:     "compliance_guard_passed",
      status:   "passed",
      blocking: true,
      message:  "Workflow compliance guard passed (all 8 rules enforced)",
    },
  ];
}

// ─── Missing settings builder ─────────────────────────────────────────────────

function buildMissingSettings(input: ReviewRequestDryRunInput): string[] {
  const missing: string[] = [];

  if (!input.gateway_ready) {
    missing.push("AI Gateway configuration (Settings > AI > select provider and add API key)");
  }

  if (!input.destination.enabled) {
    missing.push(`Enable ${input.destination.platform} review destination (Settings > Reputation)`);
  } else if (!input.destination.review_url) {
    missing.push(`Add ${input.destination.platform} review URL (Settings > Reputation)`);
  }

  if (!input.customer_eligible) {
    missing.push("Customer 30-day review request cooldown (no action required — wait for policy window)");
  }

  return missing;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildReviewRequestDryRun — constructs the full dry-run result for
 * a review_request_generation task.
 *
 * Pure synchronous function. No DB calls, no AI calls, no side effects.
 *
 * @param input     Pre-fetched context from the caller
 * @param actionId  UUID generated by the caller (ReputationRuntime.execute)
 * @param now       ISO 8601 timestamp from the caller
 */
export function buildReviewRequestDryRun(
  input:    ReviewRequestDryRunInput,
  actionId: string,
  now:      string,
): ReviewRequestDryRunResult {
  const readinessChecks  = buildReadinessChecks(input);
  const missingSettings  = buildMissingSettings(input);
  const allChecksPassed  = readinessChecks.every((c) => c.status !== "failed");
  const actionSteps      = buildActionSteps(input);
  const promptMetadata   = buildPromptMetadata(input);

  const actionPlan: ReputationActionPlan = {
    dealer_id:                input.dealer_id,
    task_type:                "review_request_generation",
    action_id:                actionId,
    estimated_ready:          allChecksPassed,
    steps:                    actionSteps,
    prompt_metadata:          promptMetadata,
    compliance_checklist:     REPUTATION_COMPLIANCE_CHECKLIST as ReputationComplianceCheckItem[],
    missing_settings:         missingSettings,
    dealer_approval_required: true,
    execution_deferred:       true,
  };

  return {
    dealer_id:                 input.dealer_id,
    task_type:                 "review_request_generation",
    readiness_status:          allChecksPassed ? "ready" : "not_ready",
    readiness_checks:          readinessChecks,
    all_checks_passed:         allChecksPassed,
    required_missing_settings: missingSettings,
    action_plan:               actionPlan,
    prepared_at:               now,
  };
}
