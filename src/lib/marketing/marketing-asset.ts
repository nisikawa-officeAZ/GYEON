// DealerOS — Marketing Asset Domain Object
//
// Sprint 11A Phase B: marketing assets consume canonical MediaAsset objects.
//
// MarketingAsset wraps one or more MediaAsset objects with campaign context,
// generated content (captions, hashtags), approval state, and publish records.
//
// Media must pass the MediaPermissionGate before being used as source_media:
//   visibility = "marketing_approved" AND consent_status = "approved"
//   AND is_marketing_approved = true
//
// No AI content generation in this module. Generated captions/hashtags are
// populated by the marketing_agent at the ai_review workflow stage (Phase 11B+).

import type { MediaAsset, MediaReference }       from "@/lib/media";
import type { DealerMedia }                       from "@/lib/media";
import { checkMediaPermission, toMediaReference } from "@/lib/media";
import type {
  MarketingAssetType,
  MarketingAssetStatus,
  MarketingApprovalStatus,
  MarketingPublishRecord,
  MarketingChannelId,
} from "./marketing-types";
import { DEFAULT_MARKETING_POLICY } from "./marketing-types";

// ─── MarketingAsset ───────────────────────────────────────────────────────────

/**
 * MarketingAsset — a unit of marketing content ready for publication.
 *
 * Wraps one or more canonical MediaAsset objects with:
 *   - asset_type: what kind of content this is
 *   - generated_caption / generated_hashtags: AI-generated content (future)
 *   - approval_status: where this asset is in the approval workflow
 *   - published_to: records of past publish events
 *
 * The source_media array holds the full MediaAsset objects that feed this asset.
 * All source_media must pass the marketing permission gate before this asset
 * can be approved for publication.
 */
export interface MarketingAsset {
  id:                  string;
  /** Always from getCurrentDealer(). Never from client input. */
  dealer_id:           string;
  campaign_id:         string | null;     // null if not yet assigned to a campaign
  asset_type:          MarketingAssetType;
  /** Source MediaAsset objects — must all have visibility = marketing_approved. */
  source_media:        MediaAsset[];
  /** AI-generated or manually written caption. Null until ai_review stage. */
  generated_caption:   string | null;
  /** AI-generated or manually curated hashtags. Empty until ai_review stage. */
  generated_hashtags:  string[];
  /** Target channels for this specific asset (subset of campaign channels). */
  target_channels:     MarketingChannelId[];
  status:              MarketingAssetStatus;
  approval_status:     MarketingApprovalStatus;
  /** UUID of the dealer staff member who approved. */
  approved_by:         string | null;
  /** ISO 8601 — when approval was granted. */
  approved_at:         string | null;
  /** One entry per channel publish attempt. */
  published_to:        MarketingPublishRecord[];
  created_at:          string;
  updated_at:          string;
  /** UUID of the staff member or agent that created this asset. */
  created_by:          string | null;
}

// ─── Asset media reference (lightweight view) ─────────────────────────────────

/**
 * Lightweight view of a MarketingAsset for list rendering and campaign summaries.
 * Does not include full source_media chain.
 */
export interface MarketingAssetSummary {
  id:                 string;
  dealer_id:          string;
  campaign_id:        string | null;
  asset_type:         MarketingAssetType;
  source_media_refs:  MediaReference[];   // Lightweight media references
  status:             MarketingAssetStatus;
  approval_status:    MarketingApprovalStatus;
  target_channels:    MarketingChannelId[];
  published_to:       MarketingPublishRecord[];
  created_at:         string;
}

// ─── Permission validation ────────────────────────────────────────────────────

export interface MediaPermissionCheckResult {
  all_permitted:   boolean;
  blocked_ids:     string[];    // IDs of media that failed the marketing gate
  denial_reasons:  string[];
}

/**
 * Verifies that all source media in a MarketingAsset pass the marketing permission gate.
 *
 * Required before:
 *   - Submitting an asset for AI review
 *   - Submitting for dealer approval
 *   - Scheduling for publication
 *
 * Returns a result object rather than throwing — callers decide how to handle failures.
 */
export function checkMarketingAssetMediaPermissions(
  asset: MarketingAsset,
): MediaPermissionCheckResult {
  const blocked_ids:    string[] = [];
  const denial_reasons: string[] = [];

  for (const media of asset.source_media) {
    const gate = checkMediaPermission(media);
    if (!gate.can_use_for_marketing) {
      blocked_ids.push(media.id);
      denial_reasons.push(
        `Media ${media.id}: ${gate.denial_reasons.join("; ")}`,
      );
    }
  }

  return {
    all_permitted: blocked_ids.length === 0,
    blocked_ids,
    denial_reasons,
  };
}

/**
 * Returns true if this asset has all requirements met to be scheduled for publishing:
 *   1. Status is "approved"
 *   2. approval_status is "approved"
 *   3. At least one target channel is configured
 *   4. All source media pass the marketing permission gate
 */
export function isAssetPublishable(asset: MarketingAsset): boolean {
  if (asset.status !== "approved")           return false;
  if (asset.approval_status !== "approved")  return false;
  if (asset.target_channels.length === 0)    return false;
  return checkMarketingAssetMediaPermissions(asset).all_permitted;
}

// ─── Filtering helpers ────────────────────────────────────────────────────────

/**
 * Returns all assets approved and ready for scheduling.
 */
export function getApprovedAssets(assets: MarketingAsset[]): MarketingAsset[] {
  return assets.filter(
    (a) => a.status === "approved" && a.approval_status === "approved",
  );
}

/**
 * Returns all assets targeting the given channel.
 */
export function getAssetsForChannel(
  assets:  MarketingAsset[],
  channel: MarketingChannelId,
): MarketingAsset[] {
  return assets.filter((a) => a.target_channels.includes(channel));
}

/**
 * Returns all assets awaiting dealer approval.
 */
export function getAssetsPendingApproval(assets: MarketingAsset[]): MarketingAsset[] {
  return assets.filter(
    (a) => a.status === "pending_approval" || a.approval_status === "pending",
  );
}

// ─── Projection ───────────────────────────────────────────────────────────────

/**
 * Projects a MarketingAsset to a MarketingAssetSummary for list views.
 * Replaces full MediaAsset objects with lightweight MediaReference objects.
 */
export function toMarketingAssetSummary(asset: MarketingAsset): MarketingAssetSummary {
  return {
    id:                asset.id,
    dealer_id:         asset.dealer_id,
    campaign_id:       asset.campaign_id,
    asset_type:        asset.asset_type,
    source_media_refs: asset.source_media.map((m) => toMediaReference(m as DealerMedia)),
    status:            asset.status,
    approval_status:   asset.approval_status,
    target_channels:   asset.target_channels,
    published_to:      asset.published_to,
    created_at:        asset.created_at,
  };
}

// ─── Asset type helpers ───────────────────────────────────────────────────────

/** Returns true if the asset type requires video source media. */
export function isVideoAssetType(type: MarketingAssetType): boolean {
  return (
    type === "work_progress_video"  ||
    type === "water_beading_video"  ||
    type === "completion_video"     ||
    type === "ai_generated_video"
  );
}

/** Returns true if the asset type was generated by an AI pipeline. */
export function isAIGeneratedAssetType(type: MarketingAssetType): boolean {
  return type === "ai_generated_image" || type === "ai_generated_video";
}

/** Returns true if this asset type requires customer consent to use. */
export function requiresCustomerConsent(
  type:   MarketingAssetType,
  policy: typeof DEFAULT_MARKETING_POLICY = DEFAULT_MARKETING_POLICY,
): boolean {
  if (!policy.requires_media_consent) return false;
  // Testimonials always require consent regardless of policy
  return type === "customer_testimonial" || policy.requires_media_consent;
}
