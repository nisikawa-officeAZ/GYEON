// DealerOS — AI Content Automation Platform: Approval Workflow (Sprint 11I Phase F)
//
// Dealer approval workflow for content automation publishing.
//
// Five approval modes:
//   dealer_approval — dealer must review and explicitly approve before publishing
//   scheduled       — system publishes at a pre-set time without dealer action
//   manual          — dealer initiates publish manually on their own schedule
//   draft_only      — project is prepared but never dispatched without mode change
//   disabled        — content automation is off for this dealer
//
// The approval workflow is stateful — it tracks revision cycles.
// A dealer may reject a plan and request specific revisions.
// After revision, the plan re-enters the dealer_approval gate.
// Max revision cycles is configurable per policy (default: 3).
//
// No execution. No persistence. No DB calls.
// State is modeled in types; the React component will hold it locally
// until a server-side approval record is persisted (Phase 11J+ migration).
//
// Pure — no "use server", no external calls.

import type {
  ApprovalWorkflow,
  ApprovalDecision,
  AutomationPolicy,
  ContentProject,
} from "./content-automation-types";

// ─── Approval mode ─────────────────────────────────────────────────────────────

/**
 * ContentApprovalMode — governs when and how content may be published.
 * Matches ApprovalWorkflow.mode — defined here for convenience of importing.
 */
export type ContentApprovalMode =
  | "dealer_approval"  // Explicit dealer sign-off required before every publish
  | "scheduled"        // System auto-publishes at the scheduled time — no action needed
  | "manual"           // Dealer initiates the publish manually — no scheduled push
  | "draft_only"       // Pipeline completes but never dispatches — review only
  | "disabled";        // Content automation is fully disabled for this dealer

// ─── Approval gate result ──────────────────────────────────────────────────────

/**
 * ContentApprovalGate — result of evaluating whether publishing is permitted.
 * Pure — no DB lookups. Caller must supply the current ApprovalWorkflow.
 */
export interface ContentApprovalGate {
  content_project_id: string;
  mode:               ContentApprovalMode;
  gate_open:          boolean;
  requires_action:    boolean;
  /** Reason the gate is closed. Empty string when gate_open. */
  blocked_reason:     string;
  /** Number of revision cycles used. */
  revisions_used:     number;
  /** True when the dealer has exhausted max revision cycles. */
  max_revisions_reached: boolean;
}

// ─── Approval transition ───────────────────────────────────────────────────────

/**
 * ApprovalTransition — a state transition in the approval workflow.
 *
 * The approval state machine:
 *   null → "approved"           (dealer approves first submission)
 *   null → "rejected"           (dealer rejects first submission)
 *   null → "revision_requested" (dealer requests changes)
 *   "revision_requested" → null (revision submitted — resets to pending)
 *   "revision_requested" → "approved"
 *   "revision_requested" → "rejected"
 *   "approved" → (publishing_plan locked — no further transitions)
 *   "rejected" → "cancelled"   (project is abandoned)
 *   any → "skipped"            (mode is "scheduled", "manual", or "draft_only")
 */
export interface ApprovalTransition {
  from: ApprovalDecision | null;
  to:   ApprovalDecision;
  allowed: boolean;
  blocked_reason: string;
}

// ─── Policy defaults ───────────────────────────────────────────────────────────

/**
 * DEFAULT_AUTOMATION_POLICY — baseline policy applied to all new dealers.
 *
 * By default, content automation is:
 *   - Not triggered automatically (auto_trigger_on_completion: false)
 *   - Requires dealer approval (approval_mode: "dealer_approval")
 *   - Targets Instagram Feed + Google Business Profile
 *   - AI features disabled until dealer explicitly enables them
 *   - Requires Pro+ features: line, ai_marketing
 */
export const DEFAULT_AUTOMATION_POLICY: Omit<AutomationPolicy, "dealer_id"> = {
  auto_trigger_on_completion: false,
  min_media_count:             1,
  approval_mode:               "dealer_approval",
  default_channels:            ["instagram_feed", "google_business_profile"],
  ai_hashtags_enabled:         false,
  ai_captions_enabled:         false,
  ai_storyboard_enabled:       false,
  required_features:           ["ai_marketing", "line"],
  enabled:                     false,  // Disabled until social API integration (Phase 11J+)
};

// ─── Approval gate evaluator ───────────────────────────────────────────────────

/**
 * evaluateApprovalGate — pure function that evaluates whether publishing is permitted.
 *
 * No DB calls. No getCurrentDealer(). Caller supplies the current ApprovalWorkflow.
 * Returns a ContentApprovalGate describing the current state.
 */
export function evaluateApprovalGate(
  workflow:    ApprovalWorkflow,
  policy:      Pick<AutomationPolicy, "approval_mode" | "enabled">,
): ContentApprovalGate {
  const mode = workflow.mode;
  const revisions_used        = workflow.revision_count;
  const max_revisions_reached = revisions_used >= workflow.max_revisions;

  if (!policy.enabled) {
    return {
      content_project_id:   workflow.content_project_id,
      mode:                 "disabled",
      gate_open:            false,
      requires_action:      false,
      blocked_reason:       "Content automation is disabled for this dealer",
      revisions_used,
      max_revisions_reached,
    };
  }

  if (mode === "disabled") {
    return {
      content_project_id:   workflow.content_project_id,
      mode,
      gate_open:            false,
      requires_action:      false,
      blocked_reason:       "Content automation mode is set to disabled",
      revisions_used,
      max_revisions_reached,
    };
  }

  if (mode === "draft_only") {
    return {
      content_project_id:   workflow.content_project_id,
      mode,
      gate_open:            false,
      requires_action:      false,
      blocked_reason:       "Project is in draft-only mode — change mode to publish",
      revisions_used,
      max_revisions_reached,
    };
  }

  if (mode === "scheduled" || mode === "manual") {
    return {
      content_project_id:   workflow.content_project_id,
      mode,
      gate_open:            true,
      requires_action:      false,
      blocked_reason:       "",
      revisions_used,
      max_revisions_reached,
    };
  }

  // dealer_approval: gate is open only when decision = "approved"
  const approved     = workflow.decision === "approved";
  const rejected     = workflow.decision === "rejected";
  const pending      = workflow.decision === null;
  const revision_req = workflow.decision === "revision_requested";

  let blocked_reason = "";
  if (pending) {
    blocked_reason = "Awaiting dealer approval";
  } else if (rejected) {
    blocked_reason = "Dealer rejected this plan — revision or cancellation required";
  } else if (revision_req && max_revisions_reached) {
    blocked_reason = "Maximum revision cycles reached — escalate or cancel";
  } else if (revision_req) {
    blocked_reason = "Revision requested — resubmit for approval";
  }

  return {
    content_project_id:   workflow.content_project_id,
    mode:                 "dealer_approval",
    gate_open:            approved,
    requires_action:      pending || revision_req,
    blocked_reason,
    revisions_used,
    max_revisions_reached,
  };
}

// ─── Approval workflow factory ─────────────────────────────────────────────────

/**
 * buildApprovalWorkflow — creates a fresh ApprovalWorkflow for a new ContentProject.
 * dealer_id must come from getCurrentDealer().
 */
export function buildApprovalWorkflow(
  content_project_id: string,
  dealer_id:          string,
  mode:               ContentApprovalMode,
  now:                string,
): ApprovalWorkflow {
  return {
    content_project_id,
    dealer_id,
    mode,
    decision:       null,
    decided_by:     null,
    decided_at:     null,
    dealer_notes:   null,
    revision_count: 0,
    max_revisions:  3,
    created_at:     now,
  };
}

// ─── Transition helpers ────────────────────────────────────────────────────────

/**
 * validateApprovalTransition — checks whether a state transition is valid.
 * Returns an ApprovalTransition describing whether the move is allowed.
 */
export function validateApprovalTransition(
  workflow: ApprovalWorkflow,
  to:       ApprovalDecision,
): ApprovalTransition {
  const from  = workflow.decision;
  const maxed = workflow.revision_count >= workflow.max_revisions;

  // Can't transition if already approved and publishing is locked
  if (from === "approved") {
    return {
      from, to,
      allowed:        false,
      blocked_reason: "Plan is already approved and locked for publishing",
    };
  }

  // Can't revise if max revisions reached
  if (to === "revision_requested" && maxed) {
    return {
      from, to,
      allowed:        false,
      blocked_reason: `Maximum revision cycles (${workflow.max_revisions}) reached`,
    };
  }

  return { from, to, allowed: true, blocked_reason: "" };
}

/**
 * applyApprovalDecision — returns the updated ApprovalWorkflow after a decision.
 * Does not mutate the input — returns a new object.
 * decided_by should be the staff member UUID from auth context.
 */
export function applyApprovalDecision(
  workflow:   ApprovalWorkflow,
  decision:   ApprovalDecision,
  decided_by: string,
  notes:      string | null,
  now:        string,
): ApprovalWorkflow {
  const isRevision = decision === "revision_requested";
  return {
    ...workflow,
    decision,
    decided_by,
    decided_at:     now,
    dealer_notes:   notes,
    revision_count: isRevision ? workflow.revision_count + 1 : workflow.revision_count,
  };
}

// ─── Mode helpers ──────────────────────────────────────────────────────────────

/** True when the mode requires a dealer to take explicit action before publishing. */
export function requiresDealerAction(mode: ContentApprovalMode): boolean {
  return mode === "dealer_approval";
}

/** True when the mode allows publishing without dealer interaction. */
export function isAutoPublishMode(mode: ContentApprovalMode): boolean {
  return mode === "scheduled";
}

/** True when the mode permanently blocks all publishing. */
export function isBlockingMode(mode: ContentApprovalMode): boolean {
  return mode === "disabled" || mode === "draft_only";
}
