// DealerOS — AI Reputation Agent Runtime: Public API
//
// Sprint 11D: canonical public exports for the Reputation Agent runtime layer.
//
// Import from "@/lib/reputation/runtime" for all runtime types and helpers.
//
// Module structure:
//   runtime-types.ts          — Phase A: all domain types (pure)
//   gateway-readiness.ts      — Phase B: 8-check AI Gateway readiness validator (server)
//   review-request-dryrun.ts  — Phase C: review request generation dry-run (pure)
//   compliance-guard.ts       — Phase D: workflow compliance guard (pure)
//   reputation-runtime.ts     — Phase A: main ReputationRuntime adapter (server)
//   engagement-runtime.ts     — Phase E: Customer Engagement runtime integration (pure)
//
// Dependency chain (no circular imports):
//   runtime-types          → @/lib/ai/agents/types, @/lib/ai/types,
//                             @/lib/ai/ai-settings-types,
//                             @/lib/reputation/reputation-types,
//                             @/lib/reputation/reputation-profile
//   gateway-readiness      → @/lib/plans/can-use-feature, @/lib/ai/check-ai-gateway,
//                             @/lib/ai/get-ai-settings, @/lib/ai/agents/registry,
//                             ./runtime-types
//   review-request-dryrun  → @/lib/ai/types, @/lib/reputation/reputation-types,
//                             @/lib/reputation/reputation-profile,
//                             ./runtime-types, ./compliance-guard
//   compliance-guard       → ./runtime-types
//   reputation-runtime     → @/lib/ai/agents/execution-policy,
//                             @/lib/plans/can-use-feature,
//                             @/lib/reputation/reputation-profile,
//                             @/lib/reputation/reputation-types,
//                             ./gateway-readiness, ./review-request-dryrun,
//                             ./compliance-guard, ./runtime-types
//   engagement-runtime     → @/lib/reputation/reputation-engagement, ./runtime-types

// ─── Phase A: Runtime domain types ───────────────────────────────────────────

export type {
  ReputationExecutionContext,
  ReputationExecutionRequest,
  ReputationExecutionState,
  ReputationExecutionResult,
  ReputationReadinessCheckName,
  ReputationReadinessCheckStatus,
  ReputationReadinessCheck,
  ReputationPromptMetadata,
  ReputationActionStepStatus,
  ReputationActionStep,
  ReputationComplianceCheckItem,
  ReputationActionPlan,
  ReputationGatewayReadiness,
  ComplianceViolation,
  ReputationComplianceGuardResult,
} from "./runtime-types";

// ─── Phase B: AI Gateway readiness ───────────────────────────────────────────

export { checkReputationGatewayReadiness } from "./gateway-readiness";

// ─── Phase C: Review request dry-run ─────────────────────────────────────────

export type {
  ReviewRequestDryRunInput,
  ReviewRequestDryRunResult,
} from "./review-request-dryrun";

export { buildReviewRequestDryRun } from "./review-request-dryrun";

// ─── Phase D: Compliance guard ────────────────────────────────────────────────

export type {
  ReputationWorkflowComplianceContext,
} from "./compliance-guard";

export {
  REPUTATION_COMPLIANCE_CHECKLIST,
  checkReputationCompliance,
  buildCleanComplianceContext,
  formatComplianceResult,
} from "./compliance-guard";

// ─── Phase A: Main runtime adapter ───────────────────────────────────────────

export { ReputationRuntime, createReputationRuntime } from "./reputation-runtime";

// ─── Phase E: Customer Engagement integration ─────────────────────────────────

export type {
  FutureLineDispatchPayload,
  FutureAgentExecutionRequest,
  WorkCompletedRuntimePlan,
} from "./engagement-runtime";

export {
  buildWorkCompletedRuntimePlan,
  summarizeRuntimePlan,
} from "./engagement-runtime";
