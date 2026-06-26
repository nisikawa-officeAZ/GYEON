// DealerOS — Marketing Publishing Workflow
//
// Sprint 11A Phase D: canonical publishing workflow state machine.
//
// The workflow describes the full journey from source media to published content:
//   MediaAsset → MarketingAsset → AI Review → Dealer Approval →
//   Scheduling → Publishing → Analytics → Retention → Audit
//
// No runtime publishing. No external API calls.
// This module provides: stage types, transition model, derivation logic.

import type {
  MarketingAssetStatus,
  MarketingApprovalStatus,
  MarketingPublishRecord,
} from "./marketing-types";

// ─── Workflow stages ──────────────────────────────────────────────────────────

/**
 * All stages in the marketing publishing workflow.
 *
 * Each stage maps to a concrete action that moves the asset forward.
 * The workflow follows the pipeline:
 *   MediaAsset → MarketingAsset → AI Review → Dealer Approval →
 *   Scheduling → Publishing → Analytics → Retention → Audit
 */
export type MarketingWorkflowStage =
  | "media_selection"   // Select and validate source MediaAsset objects
  | "asset_creation"    // Create MarketingAsset — set type, caption draft, channels
  | "ai_review"         // AI agent reviews for quality, compliance, and content
  | "dealer_approval"   // Dealer reviews AI output and approves or rejects
  | "scheduling"        // Set publish time, timezone, and repeat policy
  | "publishing"        // Execute channel API calls — images/video published
  | "analytics"         // Track impressions, reach, engagement, conversions
  | "retention"         // Apply retention policy — archive or delete old posts
  | "audit";            // Finalize audit record — campaign lifecycle complete

// ─── Step status ──────────────────────────────────────────────────────────────

export type MarketingWorkflowStepStatus =
  | "pending"      // Not yet started
  | "in_progress"  // Currently being executed
  | "completed"    // Successfully completed
  | "failed"       // Execution failed — requires retry or manual intervention
  | "skipped";     // Intentionally skipped (e.g., dealer_approval skipped for ai_only policy)

// ─── Workflow step ────────────────────────────────────────────────────────────

/**
 * A single step in the publishing workflow for a given asset.
 */
export interface MarketingWorkflowStep {
  stage:        MarketingWorkflowStage;
  status:       MarketingWorkflowStepStatus;
  started_at:   string | null;   // ISO 8601
  completed_at: string | null;   // ISO 8601
  /**
   * UUID of the actor that completed this step.
   * For human steps (dealer_approval): staff member UUID.
   * For agent steps (ai_review): AIAgentId string.
   * Null if not yet completed.
   */
  actor_id:     string | null;
  notes:        string | null;   // Rejection reason, failure message, or approval note
}

// ─── Workflow record ──────────────────────────────────────────────────────────

/**
 * MarketingWorkflow — tracks the full publishing pipeline state for one asset.
 *
 * One MarketingWorkflow per MarketingAsset.
 * current_stage is the authoritative answer to "where is this asset in the pipeline?"
 * steps contains one entry per workflow stage (ordered by stage index).
 */
export interface MarketingWorkflow {
  id:            string;
  dealer_id:     string;
  campaign_id:   string;
  asset_id:      string;
  current_stage: MarketingWorkflowStage;
  steps:         MarketingWorkflowStep[];
  created_at:    string;
  updated_at:    string;
}

// ─── Ordered stages ───────────────────────────────────────────────────────────

/** All stages in their canonical execution order. */
export const WORKFLOW_STAGES: ReadonlyArray<MarketingWorkflowStage> = [
  "media_selection",
  "asset_creation",
  "ai_review",
  "dealer_approval",
  "scheduling",
  "publishing",
  "analytics",
  "retention",
  "audit",
];

// ─── Allowed transitions ──────────────────────────────────────────────────────

/**
 * Valid state machine transitions for the publishing workflow.
 *
 * Most stages transition forward only.
 * Backward transitions are allowed for correction:
 *   - ai_review → asset_creation: AI found quality issues — revise the asset
 *   - dealer_approval → asset_creation: Dealer rejected — revise the asset
 */
export const WORKFLOW_TRANSITIONS: Record<MarketingWorkflowStage, MarketingWorkflowStage[]> = {
  media_selection:  ["asset_creation"],
  asset_creation:   ["ai_review", "dealer_approval"],   // Skip AI review if policy allows
  ai_review:        ["dealer_approval", "asset_creation"],
  dealer_approval:  ["scheduling", "asset_creation"],   // Back to creation if rejected
  scheduling:       ["publishing"],
  publishing:       ["analytics"],
  analytics:        ["retention"],
  retention:        ["audit"],
  audit:            [],   // Terminal stage
};

// ─── Stage derivation ─────────────────────────────────────────────────────────

/**
 * Derives the current workflow stage from a MarketingAsset's observable state.
 *
 * This is a best-effort derivation from existing fields.
 * A full workflow event log (Phase 11B+) would provide exact stage history.
 */
export function deriveWorkflowStage(asset: {
  status:          MarketingAssetStatus;
  approval_status: MarketingApprovalStatus;
  published_to:    MarketingPublishRecord[];
}): MarketingWorkflowStage {
  switch (asset.status) {
    case "archived":
      return "audit";

    case "published":
      return "analytics";

    case "publishing":
      return "publishing";

    case "scheduled":
      return "scheduling";

    case "approved":
      if (asset.approval_status === "approved") return "scheduling";
      return "dealer_approval";

    case "pending_approval":
      if (asset.approval_status === "rejected")  return "asset_creation";
      return "dealer_approval";

    case "ai_reviewed":
      return "dealer_approval";

    case "pending_review":
      return "ai_review";

    case "failed":
      return "publishing";

    case "draft":
    default:
      return "asset_creation";
  }
}

// ─── Stage navigation ─────────────────────────────────────────────────────────

/**
 * Returns all valid next stages from the given stage.
 */
export function getNextStages(
  stage: MarketingWorkflowStage,
): MarketingWorkflowStage[] {
  return WORKFLOW_TRANSITIONS[stage] ?? [];
}

/**
 * Returns true if transitioning from → to is allowed by the state machine.
 */
export function canAdvanceWorkflow(
  from: MarketingWorkflowStage,
  to:   MarketingWorkflowStage,
): boolean {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns the position of a stage in the ordered pipeline (0-indexed).
 * Returns -1 for unknown stages.
 */
export function getStageIndex(stage: MarketingWorkflowStage): number {
  return WORKFLOW_STAGES.indexOf(stage);
}

/**
 * Returns true if stage A comes before stage B in the pipeline.
 */
export function isStageBeforeStage(
  a: MarketingWorkflowStage,
  b: MarketingWorkflowStage,
): boolean {
  return getStageIndex(a) < getStageIndex(b);
}

// ─── Step builder ─────────────────────────────────────────────────────────────

/**
 * Creates a pending workflow step for a given stage.
 * Initial state — no actor, no timestamps, no notes.
 */
export function createPendingStep(
  stage: MarketingWorkflowStage,
): MarketingWorkflowStep {
  return {
    stage,
    status:       "pending",
    started_at:   null,
    completed_at: null,
    actor_id:     null,
    notes:        null,
  };
}

/**
 * Creates a fresh workflow with all stages in pending state.
 * Used when initializing a new MarketingWorkflow record.
 */
export function createInitialWorkflowSteps(): MarketingWorkflowStep[] {
  return WORKFLOW_STAGES.map(createPendingStep);
}
