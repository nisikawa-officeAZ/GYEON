// DealerOS — Marketing AI Agent Compatibility Layer
//
// Sprint 11A Phase F: marketing_agent, reputation_agent, and growth_agent must
// consume MarketingAsset instead of raw MediaAsset when performing marketing workflows.
//
// This module provides:
//   - MarketingAssetForAgent: safe, minimal view for AI agents
//   - MarketingAICapability: types of AI operations on marketing content
//   - MarketingAIRequest / MarketingAIGateResult: gated request model
//   - toMarketingAssetForAgent(): validates and projects for agent use
//   - buildMarketingAIRequest(): constructs a validated request
//
// No AI provider execution. No external API calls.
// These types define the contract between the orchestration layer and AI agents.
//
// Security:
//   - dealer_id is verified against asset.dealer_id in every gate function
//   - Only "approved" or "ai_reviewed" assets may be passed to agents for publishing
//   - All source media must pass the marketing media permission gate

import type { MediaForAI }            from "@/lib/media";
import { checkMediaAICapability }      from "@/lib/media";
import type { AIAgentId }              from "@/lib/ai/agents/types";
import type { MarketingAsset }         from "./marketing-asset";
import { checkMarketingAssetMediaPermissions } from "./marketing-asset";
import type {
  MarketingAssetType,
  MarketingApprovalStatus,
  MarketingChannelId,
  MarketingCampaignType,
} from "./marketing-types";
import type { MarketingWorkflowStage } from "./marketing-workflow";
import type { OptimizationTarget }     from "./marketing-optimization";

// ─── AI capability types ──────────────────────────────────────────────────────

/**
 * The types of AI operations that can be performed on marketing content.
 * Each capability maps to a specific AI agent workflow (Phase 11B+).
 */
export type MarketingAICapability =
  | "caption_generation"       // Generate platform-optimized captions
  | "hashtag_generation"       // Generate relevant hashtags for the asset and channels
  | "quality_review"           // Review image/video quality and composition
  | "compliance_check"         // Check for brand guideline and policy compliance
  | "performance_prediction"   // Predict estimated reach and engagement
  | "audience_targeting"       // Suggest optimal audience parameters
  | "seo_optimization"         // Optimize content for SEO/MEO/LLMO/AIO metadata
  | "channel_adaptation";      // Adapt content for channel-specific requirements

// ─── Agent-safe asset view ────────────────────────────────────────────────────

/**
 * MarketingAssetForAgent — the safe, minimal projection of a MarketingAsset
 * that AI agents may receive.
 *
 * Raw MediaAsset objects (including file_url, consent fields) are replaced
 * with pre-validated MediaForAI objects that have already passed all gate checks.
 *
 * Rules before constructing this object:
 *   1. dealer_id verified against asset.dealer_id
 *   2. asset has appropriate status for the requested capability
 *   3. All source_media pass checkMediaAICapability for "ai_marketing"
 */
export interface MarketingAssetForAgent {
  id:                   string;
  dealer_id:            string;
  campaign_id:          string | null;
  asset_type:           MarketingAssetType;
  approval_status:      MarketingApprovalStatus;
  generated_caption:    string | null;
  generated_hashtags:   string[];
  target_channels:      MarketingChannelId[];
  /** Pre-validated, minimal media view — all gate checks already passed. */
  source_media_for_ai:  MediaForAI[];
}

// ─── Workflow context ─────────────────────────────────────────────────────────

/**
 * Context passed to an AI agent alongside a marketing request.
 * Provides the agent with enough campaign context to make informed decisions.
 */
export interface MarketingWorkflowContext {
  campaign_id:           string | null;
  campaign_type:         MarketingCampaignType | null;
  workflow_stage:        MarketingWorkflowStage;
  channels:              MarketingChannelId[];
  optimization_targets:  OptimizationTarget[];
}

// ─── AI request / result ──────────────────────────────────────────────────────

export interface MarketingAIRequest {
  request_id:  string;
  dealer_id:   string;
  agent_id:    AIAgentId;
  asset:       MarketingAssetForAgent;
  capability:  MarketingAICapability;
  context:     MarketingWorkflowContext;
}

export type MarketingAIGateResult =
  | {
      allowed: true;
      asset:   MarketingAssetForAgent;
      agent_id: AIAgentId;
    }
  | {
      allowed: false;
      reason:  string;
      agent_id: AIAgentId;
    };

// ─── Gate function ────────────────────────────────────────────────────────────

/**
 * Validates whether a MarketingAsset may be passed to the given AI agent
 * for the requested capability, and projects it to MarketingAssetForAgent.
 *
 * Validation sequence:
 *   1. Dealer isolation — asset.dealer_id must equal dealerId
 *   2. Status gate — asset must be in an AI-eligible state
 *   3. Media permission gate — all source_media must pass ai_marketing gate
 *   4. Agent eligibility — only designated agents may receive marketing assets
 *
 * Returns MarketingAssetForAgent on success (all media already in MediaForAI form).
 * Returns a denial reason string on failure — never throws.
 */
export function toMarketingAssetForAgent(
  asset:      MarketingAsset,
  agentId:    AIAgentId,
  dealerId:   string,
): MarketingAIGateResult {
  // Dealer isolation
  if (asset.dealer_id !== dealerId) {
    return {
      allowed:  false,
      reason:   "asset.dealer_id does not match dealerId. Cross-dealer access is forbidden.",
      agent_id: agentId,
    };
  }

  // Only these agents are authorized for marketing workflows
  const authorizedAgents: AIAgentId[] = [
    "marketing_agent",
    "reputation_agent",
    "growth_agent",
    "seo_agent",
  ];
  if (!authorizedAgents.includes(agentId)) {
    return {
      allowed:  false,
      reason:   `Agent "${agentId}" is not authorized for marketing workflows.`,
      agent_id: agentId,
    };
  }

  // Status eligibility
  const eligibleStatuses = ["draft", "pending_review", "ai_reviewed", "pending_approval", "approved"];
  if (!eligibleStatuses.includes(asset.status)) {
    return {
      allowed:  false,
      reason:   `Asset status "${asset.status}" is not eligible for AI agent processing. Expected one of: ${eligibleStatuses.join(", ")}.`,
      agent_id: agentId,
    };
  }

  // Media permission gate — all source media must pass ai_marketing capability check
  const permCheck = checkMarketingAssetMediaPermissions(asset);
  if (!permCheck.all_permitted) {
    return {
      allowed:  false,
      reason:   `Source media permission gate failed: ${permCheck.denial_reasons.join("; ")}`,
      agent_id: agentId,
    };
  }

  // Build MediaForAI projections from source_media
  const source_media_for_ai: MediaForAI[] = [];
  for (const media of asset.source_media) {
    const gateResult = checkMediaAICapability({
      capability: "ai_marketing",
      media,
      agent_id:   agentId,
      dealer_id:  dealerId,
    });
    if (!gateResult.allowed) {
      return {
        allowed:  false,
        reason:   `Media ${media.id} failed AI gate: ${gateResult.reason}`,
        agent_id: agentId,
      };
    }
    source_media_for_ai.push(gateResult.media_for_ai);
  }

  const projectedAsset: MarketingAssetForAgent = {
    id:                   asset.id,
    dealer_id:            asset.dealer_id,
    campaign_id:          asset.campaign_id,
    asset_type:           asset.asset_type,
    approval_status:      asset.approval_status,
    generated_caption:    asset.generated_caption,
    generated_hashtags:   asset.generated_hashtags,
    target_channels:      asset.target_channels,
    source_media_for_ai,
  };

  return { allowed: true, asset: projectedAsset, agent_id: agentId };
}

// ─── Request builder ──────────────────────────────────────────────────────────

/**
 * Constructs a MarketingAIRequest from a validated MarketingAssetForAgent.
 *
 * @param requestId  Caller-provided trace ID for this specific AI invocation.
 *                   Use crypto.randomUUID() in the calling server action.
 */
export function buildMarketingAIRequest(
  requestId:  string,
  dealerId:   string,
  agentId:    AIAgentId,
  asset:      MarketingAssetForAgent,
  capability: MarketingAICapability,
  context:    MarketingWorkflowContext,
): MarketingAIRequest {
  return {
    request_id: requestId,
    dealer_id:  dealerId,
    agent_id:   agentId,
    asset,
    capability,
    context,
  };
}

// ─── Agent eligibility queries ────────────────────────────────────────────────

/**
 * Returns the marketing capabilities assigned to the given agent.
 * Used by the AI agent framework to route marketing requests.
 */
export const AGENT_MARKETING_CAPABILITIES: Partial<Record<AIAgentId, MarketingAICapability[]>> = {
  marketing_agent:  [
    "caption_generation",
    "hashtag_generation",
    "quality_review",
    "compliance_check",
    "performance_prediction",
    "audience_targeting",
    "channel_adaptation",
  ],
  seo_agent:        ["seo_optimization"],
  reputation_agent: ["quality_review", "compliance_check"],
  growth_agent:     ["performance_prediction", "audience_targeting"],
};

/**
 * Returns true if the given agent is authorized to perform the given capability.
 */
export function agentHasMarketingCapability(
  agentId:    AIAgentId,
  capability: MarketingAICapability,
): boolean {
  return AGENT_MARKETING_CAPABILITIES[agentId]?.includes(capability) ?? false;
}
