// DealerOS — AI Content Automation Platform: AI Compatibility (Sprint 11I Phase E)
//
// Provider-agnostic AI integration for the Content Automation Platform.
//
// Four agents contribute to content automation:
//   marketing_agent  — caption writing, storyboard curation, hashtag optimization
//   seo_agent        — advanced keyword analysis and SEO/AEO/LLMO/AIO enrichment (Phase 11J+)
//   growth_agent     — performance signal feed, optimal publish-time suggestion (Phase 11J+)
//   reputation_agent — compliance review for content that references customer reviews (Phase 11J+)
//
// Design rules:
//   - Agents never call each other directly — all cross-agent exchange via AI Gateway
//   - The platform declares WHAT each agent needs (task type, inputs, outputs)
//   - Provider selection is the AI Gateway's sole responsibility
//   - All plans have execution_deferred: true in Sprint 11I
//
// Pure — no "use server", no external calls.

import type { AIAgentId }  from "@/lib/ai/agents/types";
import type { AITaskType } from "@/lib/ai/types";
import type { ContentPipelineStage } from "./content-pipeline";
import type { ContentPublishingDestinationId } from "./publishing-registry";

// ─── Agent task configuration ──────────────────────────────────────────────────

/**
 * ContentAITaskConfig — a single AI task within the content automation pipeline.
 */
export interface ContentAITaskConfig {
  agent_id:            AIAgentId;
  task_type:           AITaskType;
  pipeline_stage:      ContentPipelineStage;
  purpose:             string;
  language_preference: "ja" | "en";
  input_variables:     string[];
  output_variables:    string[];
  /** True when this task must succeed for the pipeline to continue. */
  blocking:            boolean;
  /** True when the dealer must review the AI output before the pipeline advances. */
  requires_review:     boolean;
  /** True when this task produces content visible to customers. */
  is_customer_facing:  boolean;
}

// ─── Cross-agent feed ──────────────────────────────────────────────────────────

/**
 * ContentAgentCrossFeed — standardized data exchange between agents.
 *
 * Agents never import from each other's modules.
 * Data flows through the AI Gateway using this contract.
 */
export interface ContentAgentCrossFeed {
  source_agent_id:  AIAgentId;
  target_agent_id:  AIAgentId;
  pipeline_stage:   ContentPipelineStage;
  payload:          Record<string, unknown>;
  feed_version:     "1.0";
  created_at:       string;
  requires_gateway: true;
}

// ─── AI integration spec per pipeline stage ────────────────────────────────────

/**
 * ContentStageAISpec — describes the AI work at a single pipeline stage.
 */
export interface ContentStageAISpec {
  pipeline_stage:     ContentPipelineStage;
  uses_ai:            boolean;
  agents:             ContentAITaskConfig[];
  description:        string;
  deferred:           boolean;
  deferred_since:     string;
}

// ─── CONTENT_AI_STAGE_REGISTRY ────────────────────────────────────────────────

/**
 * CONTENT_AI_STAGE_REGISTRY — per-stage AI specifications for the content pipeline.
 *
 * Only stages with uses_ai: true have agent task configs.
 * All AI stages are deferred in Sprint 11I.
 */
export const CONTENT_AI_STAGE_REGISTRY: Partial<Record<ContentPipelineStage, ContentStageAISpec>> = {

  storyboard_planning: {
    pipeline_stage: "storyboard_planning",
    uses_ai:        true,
    agents:         [
      {
        agent_id:            "marketing_agent",
        task_type:           "image_analysis",
        pipeline_stage:      "storyboard_planning",
        purpose:             "Analyze approved media assets and sequence them into a before→after narrative",
        language_preference: "ja",
        input_variables:     [
          "approved_media_ids",
          "work_order_service_summary",
          "narrative_arc_preference",
        ],
        output_variables:    ["storyboard_scenes", "narrative_arc", "scene_descriptions"],
        blocking:            true,
        requires_review:     false,
        is_customer_facing:  false,
      },
    ],
    description:    "marketing_agent selects and sequences media into a before/after visual narrative",
    deferred:       true,
    deferred_since: "Sprint 11J+",
  },

  caption_planning: {
    pipeline_stage: "caption_planning",
    uses_ai:        true,
    agents:         [
      {
        agent_id:            "marketing_agent",
        task_type:           "content_writing",
        pipeline_stage:      "caption_planning",
        purpose:             "Draft per-channel captions adapted for tone and character limits",
        language_preference: "ja",
        input_variables:     [
          "service_summary",
          "dealer_name",
          "target_channels",
          "vehicle_type",
          "coating_product",
        ],
        output_variables:    ["base_caption", "channel_variants", "cta_suggestions"],
        blocking:            true,
        requires_review:     true,   // Dealer must review AI caption before approval
        is_customer_facing:  true,
      },
    ],
    description:    "marketing_agent drafts captions per channel; dealer reviews before approval",
    deferred:       true,
    deferred_since: "Sprint 11J+",
  },

  aeo_optimization: {
    pipeline_stage: "aeo_optimization",
    uses_ai:        true,
    agents:         [
      {
        agent_id:            "marketing_agent",
        task_type:           "keyword_extraction",
        pipeline_stage:      "aeo_optimization",
        purpose:             "Identify frequently asked questions for FAQ schema and featured snippet targeting",
        language_preference: "ja",
        input_variables:     ["base_caption", "service_summary", "dealer_local_keywords"],
        output_variables:    ["faq_items", "howto_steps"],
        blocking:            false,
        requires_review:     false,
        is_customer_facing:  false,
      },
    ],
    description:    "marketing_agent generates FAQ schema and featured snippet content",
    deferred:       true,
    deferred_since: "Sprint 11J+",
  },

  llmo_optimization: {
    pipeline_stage: "llmo_optimization",
    uses_ai:        true,
    agents:         [
      {
        agent_id:            "marketing_agent",
        task_type:           "content_writing",
        pipeline_stage:      "llmo_optimization",
        purpose:             "Enrich content with entity clarity and attribution for LLM citation",
        language_preference: "ja",
        input_variables:     [
          "base_caption",
          "dealer_name",
          "service_summary",
          "coating_product_name",
          "coating_manufacturer",
        ],
        output_variables:    ["llmo_enriched_text", "entity_annotations"],
        blocking:            false,
        requires_review:     false,
        is_customer_facing:  false,
      },
    ],
    description:    "marketing_agent enriches content for LLM discoverability",
    deferred:       true,
    deferred_since: "Sprint 11J+",
  },

  aio_optimization: {
    pipeline_stage: "aio_optimization",
    uses_ai:        true,
    agents:         [
      {
        agent_id:            "marketing_agent",
        task_type:           "content_writing",
        pipeline_stage:      "aio_optimization",
        purpose:             "Structure content for AI-native search: Perplexity, SearchGPT, Gemini AI",
        language_preference: "ja",
        input_variables:     [
          "llmo_enriched_text",
          "faq_items",
          "service_summary",
        ],
        output_variables:    ["aio_structured_content", "ai_search_snippet"],
        blocking:            false,
        requires_review:     false,
        is_customer_facing:  false,
      },
    ],
    description:    "marketing_agent structures content for AI-native search discoverability",
    deferred:       true,
    deferred_since: "Sprint 11J+",
  },

} as const;

// ─── AI execution plan ─────────────────────────────────────────────────────────

/**
 * ContentAIExecutionPlan — the deferred AI execution plan for a ContentProject.
 *
 * execution_deferred: true — literal type, always set in Sprint 11I.
 * AI execution requires Phase 11J+: AI Gateway wired to social dispatch layer.
 */
export interface ContentAIExecutionPlan {
  content_project_id:  string;
  /** Always from getCurrentDealer(). */
  dealer_id:           string;
  stages_with_ai:      ContentPipelineStage[];
  tasks:               ContentAITaskConfig[];
  cross_feeds:         ContentAgentCrossFeed[];
  destinations:        ContentPublishingDestinationId[];
  /** Always true — no AI inference in Sprint 11I */
  execution_deferred:  true;
  deferred_reason:     string;
  prepared_at:         string;
}

// ─── Agent workflow registry ───────────────────────────────────────────────────

/**
 * CONTENT_AI_AGENT_ROLES — maps each agent to its role in content automation.
 */
export const CONTENT_AI_AGENT_ROLES: Record<AIAgentId, string> = {
  marketing_agent:  "Primary — caption writing, storyboard curation, hashtag optimization, SEO/AEO/LLMO/AIO enrichment",
  growth_agent:     "Performance signals — optimal publish time, engagement predictions (Phase 11J+)",
  reputation_agent: "Compliance review — checks content referencing customer reviews (Phase 11J+)",
  ocr_agent:        "Not used in content automation pipeline",
  review_agent:     "Not used in content automation pipeline",
  line_agent:       "Not used in content automation pipeline",
  seo_agent:        "SEO enrichment — advanced keyword analysis (Phase 11J+)",
} as const;

// ─── Cross-feed builders ───────────────────────────────────────────────────────

/**
 * buildGrowthAgentFeed — creates a cross-feed from growth_agent to marketing_agent.
 * Carries optimal publish-time suggestions from growth analysis.
 * dealer_id must come from getCurrentDealer().
 */
export function buildGrowthAgentFeed(
  dealer_id: string,
  payload:   Record<string, unknown>,
  now:       string,
): ContentAgentCrossFeed {
  return {
    source_agent_id:  "growth_agent",
    target_agent_id:  "marketing_agent",
    pipeline_stage:   "publishing_plan",
    payload,
    feed_version:     "1.0",
    created_at:       now,
    requires_gateway: true,
  };
}

// ─── Execution plan builder ────────────────────────────────────────────────────

/**
 * buildContentAIExecutionPlan — creates a deferred AI plan for a ContentProject.
 * dealer_id must come from getCurrentDealer().
 */
export function buildContentAIExecutionPlan(
  content_project_id: string,
  dealer_id:          string,
  destinations:       ContentPublishingDestinationId[],
  now:                string,
): ContentAIExecutionPlan {
  const stagesWithAI = Object.keys(CONTENT_AI_STAGE_REGISTRY) as ContentPipelineStage[];
  const allTasks: ContentAITaskConfig[] = stagesWithAI.flatMap(
    (stage) => CONTENT_AI_STAGE_REGISTRY[stage]?.agents ?? [],
  );

  return {
    content_project_id,
    dealer_id,
    stages_with_ai:     stagesWithAI,
    tasks:              allTasks,
    cross_feeds:        [],
    destinations,
    execution_deferred: true,
    deferred_reason:    "Content AI execution requires Phase 11J+ — AI Gateway must be wired to social dispatch layer",
    prepared_at:        now,
  };
}
