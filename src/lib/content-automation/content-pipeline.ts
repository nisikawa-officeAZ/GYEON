// DealerOS — AI Content Automation Platform: Content Pipeline (Sprint 11I Phase B)
//
// Canonical pipeline model from WORK_COMPLETED event to published social content.
//
// Pipeline stages (in order):
//   1. work_completed       — CE event triggers automation
//   2. media_collection     — Fetch and validate MediaAssets from the work order
//   3. content_project      — Create ContentProject with source context
//   4. storyboard_planning  — AI selects and sequences media (Phase 11J+)
//   5. caption_planning     — AI drafts per-channel captions (Phase 11J+)
//   6. seo_optimization     — Apply SEO metadata to web/GBP content
//   7. meo_optimization     — Apply local/map optimization signals
//   8. aeo_optimization     — Adapt content for answer engine results
//   9. llmo_optimization    — Optimize for LLM citation and discoverability
//  10. aio_optimization     — Adapt for AI-native search systems
//  11. dealer_approval      — Dealer reviews and approves the full plan
//  12. publishing_plan      — Lock the final plan for dispatch
//  13. dispatch             — Social platform API calls (Phase 11J+)
//  14. analytics            — Track impressions, reach, conversion (Phase 11J+)
//
// In Sprint 11I, no stage executes real work. The pipeline defines typed
// stage descriptors, state tracking, and the execution plan structure.
//
// Pure — no "use server", no external calls, no DB queries.

import type { AIAgentId }     from "@/lib/ai/agents/types";
import type { AITaskType }    from "@/lib/ai/types";
import type {
  ContentProject,
  ContentProjectStatus,
} from "./content-automation-types";
import type { ContentPublishingDestinationId } from "./publishing-registry";

// ─── Pipeline stage ────────────────────────────────────────────────────────────

/**
 * ContentPipelineStage — all stages in the content automation pipeline.
 */
export type ContentPipelineStage =
  | "work_completed"       // Trigger — CE WORK_COMPLETED event received
  | "media_collection"     // Fetch + validate approved MediaAssets
  | "content_project"      // Create ContentProject with ContentSource
  | "storyboard_planning"  // AI sequences media into StoryboardPlan
  | "caption_planning"     // AI drafts per-channel CaptionPlan
  | "seo_optimization"     // SEO metadata applied to web/GBP content
  | "meo_optimization"     // Local search signals applied
  | "aeo_optimization"     // Answer engine optimization applied
  | "llmo_optimization"    // LLM discoverability optimization applied
  | "aio_optimization"     // AI-native search optimization applied
  | "dealer_approval"      // Dealer reviews + approves the plan
  | "publishing_plan"      // Plan locked — ready for dispatch
  | "dispatch"             // Social API calls (Phase 11J+)
  | "analytics";           // Post-publish tracking (Phase 11J+)

/**
 * ContentPipelineStepStatus — execution status of a single pipeline stage.
 */
export type ContentPipelineStepStatus =
  | "pending"      // Not yet started
  | "in_progress"  // Currently running
  | "completed"    // Successfully completed
  | "skipped"      // Intentionally skipped (e.g., no GBP channel = skip meo_optimization)
  | "failed"       // Execution failed — requires intervention
  | "deferred";    // Stage is defined but execution requires a future sprint

// ─── Pipeline step ─────────────────────────────────────────────────────────────

/**
 * ContentPipelineStep — a single step's execution record in the pipeline.
 */
export interface ContentPipelineStep {
  stage:          ContentPipelineStage;
  status:         ContentPipelineStepStatus;
  started_at:     string | null;
  completed_at:   string | null;
  /** AI agent that executed this step (null for non-AI stages). */
  ai_agent_id:    AIAgentId | null;
  ai_task_type:   AITaskType | null;
  /** Human-readable outcome description. null when pending. */
  outcome_note:   string | null;
  /** True when this stage requires a social platform API call. */
  requires_api:   boolean;
  /** True when this stage requires an AI provider call. */
  requires_ai:    boolean;
  /** True when stage is deferred to a future sprint. */
  deferred:       boolean;
  deferred_since: string;
}

// ─── Pipeline stage descriptor ─────────────────────────────────────────────────

/**
 * ContentPipelineStageMeta — static metadata about a pipeline stage.
 * Used for documentation, UI labels, and admin panels.
 */
export interface ContentPipelineStageMeta {
  stage:              ContentPipelineStage;
  sequence:           number;
  label:              string;
  description:        string;
  /** Whether this stage is the trigger entry point. */
  is_trigger:         boolean;
  /** Whether this stage requires a human action (dealer approval). */
  requires_human:     boolean;
  requires_ai:        boolean;
  requires_api:       boolean;
  available:          boolean;
  available_since:    string;
}

// ─── PIPELINE_STAGE_REGISTRY ───────────────────────────────────────────────────

/**
 * PIPELINE_STAGE_REGISTRY — metadata for all 14 pipeline stages.
 */
export const PIPELINE_STAGE_REGISTRY: readonly ContentPipelineStageMeta[] = [
  {
    stage:           "work_completed",
    sequence:        1,
    label:           "Work Completed",
    description:     "CE WORK_COMPLETED event triggers the automation pipeline",
    is_trigger:      true,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11E",
  },
  {
    stage:           "media_collection",
    sequence:        2,
    label:           "Media Collection",
    description:     "Fetch and validate approved MediaAssets from the work order — consent required",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11I",
  },
  {
    stage:           "content_project",
    sequence:        3,
    label:           "Content Project",
    description:     "Create ContentProject with ContentSource, ApprovalWorkflow, and target channels",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11I",
  },
  {
    stage:           "storyboard_planning",
    sequence:        4,
    label:           "Storyboard Planning",
    description:     "marketing_agent selects and sequences media into a before→after visual narrative",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     true,
    requires_api:    false,
    available:       false,
    available_since: "Sprint 11J+",
  },
  {
    stage:           "caption_planning",
    sequence:        5,
    label:           "Caption Planning",
    description:     "marketing_agent drafts per-channel captions adapted for tone and character limits",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     true,
    requires_api:    false,
    available:       false,
    available_since: "Sprint 11J+",
  },
  {
    stage:           "seo_optimization",
    sequence:        6,
    label:           "SEO Optimization",
    description:     "Apply SEO metadata (title, description, structured data) to web and GBP content",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11I",
  },
  {
    stage:           "meo_optimization",
    sequence:        7,
    label:           "MEO Optimization",
    description:     "Apply local search signals, NAP consistency, and service area keywords",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11I",
  },
  {
    stage:           "aeo_optimization",
    sequence:        8,
    label:           "AEO Optimization",
    description:     "Format content for featured snippets, FAQ schema, and People Also Ask results",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     true,
    requires_api:    false,
    available:       false,
    available_since: "Sprint 11J+",
  },
  {
    stage:           "llmo_optimization",
    sequence:        9,
    label:           "LLMO Optimization",
    description:     "Optimize content for LLM citation: entity clarity, attribution, semantic density",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     true,
    requires_api:    false,
    available:       false,
    available_since: "Sprint 11J+",
  },
  {
    stage:           "aio_optimization",
    sequence:        10,
    label:           "AIO Optimization",
    description:     "Adapt for AI-native search: structured Q&A, Perplexity/SearchGPT discoverability",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     true,
    requires_api:    false,
    available:       false,
    available_since: "Sprint 11J+",
  },
  {
    stage:           "dealer_approval",
    sequence:        11,
    label:           "Dealer Approval",
    description:     "Dealer reviews storyboard, captions, hashtags, and optimization metadata — approve or reject",
    is_trigger:      false,
    requires_human:  true,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11I",
  },
  {
    stage:           "publishing_plan",
    sequence:        12,
    label:           "Publishing Plan",
    description:     "Lock the final approved plan with per-channel targets, captions, and schedule",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    false,
    available:       true,
    available_since: "Sprint 11I",
  },
  {
    stage:           "dispatch",
    sequence:        13,
    label:           "Dispatch",
    description:     "Execute social platform API calls to publish content (Instagram, GBP, TikTok, etc.)",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    true,
    available:       false,
    available_since: "Sprint 11J+",
  },
  {
    stage:           "analytics",
    sequence:        14,
    label:           "Analytics",
    description:     "Collect post-publish metrics: impressions, reach, engagement, conversions",
    is_trigger:      false,
    requires_human:  false,
    requires_ai:     false,
    requires_api:    true,
    available:       false,
    available_since: "Sprint 11J+",
  },
] as const;

// ─── Pipeline execution plan ───────────────────────────────────────────────────

/**
 * ContentPipelineExecutionPlan — the full pipeline state for a ContentProject.
 *
 * In Sprint 11I, all steps beyond content_project have status: "deferred".
 * execution_deferred: true — literal type; prevents accidental execution.
 */
export interface ContentPipelineExecutionPlan {
  content_project_id:   string;
  /** Always from getCurrentDealer(). */
  dealer_id:            string;
  steps:                ContentPipelineStep[];
  current_stage:        ContentPipelineStage;
  current_status:       ContentProjectStatus;
  destinations:         ContentPublishingDestinationId[];
  /** True when all required pipeline stages have completed. */
  pipeline_complete:    boolean;
  /** True when dealer has confirmed the publishing plan. */
  dealer_confirmed:     boolean;
  /** Always true in Sprint 11I — dispatch requires Phase 11J+ */
  execution_deferred:   true;
  prepared_at:          string;
}

// ─── Pipeline builder ──────────────────────────────────────────────────────────

/**
 * buildPipelineExecutionPlan — creates a deferred pipeline plan for a ContentProject.
 *
 * All stages after "content_project" are deferred in Sprint 11I.
 * dealer_id must come from getCurrentDealer().
 */
export function buildPipelineExecutionPlan(
  project: Pick<ContentProject, "id" | "dealer_id" | "target_channels">,
  destinations: ContentPublishingDestinationId[],
  now: string,
): ContentPipelineExecutionPlan {
  const steps: ContentPipelineStep[] = PIPELINE_STAGE_REGISTRY.map((meta) => ({
    stage:          meta.stage,
    status:         meta.available ? ("pending" as const) : ("deferred" as const),
    started_at:     null,
    completed_at:   null,
    ai_agent_id:    null,
    ai_task_type:   null,
    outcome_note:   meta.available ? null : `Deferred to ${meta.available_since}`,
    requires_api:   meta.requires_api,
    requires_ai:    meta.requires_ai,
    deferred:       !meta.available,
    deferred_since: meta.available ? "" : meta.available_since,
  }));

  return {
    content_project_id: project.id,
    dealer_id:          project.dealer_id,
    steps,
    current_stage:      "work_completed",
    current_status:     "draft",
    destinations,
    pipeline_complete:  false,
    dealer_confirmed:   false,
    execution_deferred: true,
    prepared_at:        now,
  };
}

// ─── Stage helpers ─────────────────────────────────────────────────────────────

/** Returns metadata for a pipeline stage. */
export function getPipelineStageMeta(
  stage: ContentPipelineStage,
): ContentPipelineStageMeta | undefined {
  return PIPELINE_STAGE_REGISTRY.find((s) => s.stage === stage);
}

/** Returns all stages that are currently available (not deferred). */
export function getAvailableStages(): readonly ContentPipelineStageMeta[] {
  return PIPELINE_STAGE_REGISTRY.filter((s) => s.available);
}

/** Returns all stages that require AI execution. */
export function getAIStages(): readonly ContentPipelineStageMeta[] {
  return PIPELINE_STAGE_REGISTRY.filter((s) => s.requires_ai);
}

/** Returns all stages that require a social platform API call. */
export function getAPIStages(): readonly ContentPipelineStageMeta[] {
  return PIPELINE_STAGE_REGISTRY.filter((s) => s.requires_api);
}
