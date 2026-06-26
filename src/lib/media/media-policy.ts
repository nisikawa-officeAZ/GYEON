// GYEON Business Hub — Media Asset Center: Lifecycle Policy Registry (Sprint 12E)
//
// Defines the 6 lifecycle retention policies for all media asset types.
//
// The existing media module (Sprint 10I–10L) uses a DEFAULT_RETENTION_DAYS constant
// and a VideoRetentionPeriod type. Sprint 12E formalizes the full policy model with
// a named policy type, a structured descriptor, and a queryable registry.
//
// Policy hierarchy (most restrictive to most permissive):
//   legal_hold > permanent > dealer_defined > retention_30d > delete_after_download >
//   delete_after_ai_processing
//
// Key rules:
//   - legal_hold overrides all other policies — cannot be removed without CTO approval.
//   - dealer_defined policies must have retention_days set in dealer configuration.
//   - delete_after_ai_processing is the most aggressive — source files gone immediately.
//   - No deletion logic in Sprint 12E. Policy declarations only.
//
// No deletion logic. No storage calls. No DB calls.
// Pure — no "use server", no async, no external calls.

import type { MediaAssetTypeId } from "./media-asset-type-registry";

// ─── Policy identifier ────────────────────────────────────────────────────────

/**
 * MediaLifecyclePolicyId — all retention/deletion policy types.
 *
 * These policies determine when (or whether) a media asset is physically deleted
 * from storage. Policy assignment happens at upload time or via dealer configuration.
 */
export type MediaLifecyclePolicyId =
  | "permanent"                  // Never deleted automatically
  | "retention_30d"              // Automatically deleted after 30 days
  | "delete_after_download"      // Deleted once dealer or customer has confirmed download
  | "delete_after_ai_processing" // Deleted immediately after AI processing completes
  | "dealer_defined"             // Dealer configures a custom retention period
  | "legal_hold";                // Cannot be deleted (legal or compliance requirement)

// ─── Deletion trigger ─────────────────────────────────────────────────────────

/**
 * What event causes the deletion to be scheduled or executed.
 */
export type MediaDeletionTrigger =
  | "time_elapsed"        // Retention window has passed
  | "download_confirmed"  // Dealer or customer download was confirmed
  | "ai_processed"        // AI processing step completed
  | "dealer_action"       // Dealer explicitly triggered deletion
  | "never"               // Never auto-deleted (permanent or legal_hold)
  | "system_policy";      // System-enforced rule (not dealer-configurable)

// ─── Policy descriptor ────────────────────────────────────────────────────────

export interface MediaLifecyclePolicyDescriptor {
  policy_id:               MediaLifecyclePolicyId;
  display_name:            string;
  description:             string;
  retention_days:          number | null;  // null = indefinite or event-triggered
  deletion_trigger:        MediaDeletionTrigger;
  auto_delete:             boolean;        // Whether deletion happens without manual action
  requires_confirmation:   boolean;        // Whether dealer must confirm before deletion
  legal_hold_capable:      boolean;        // Whether this policy can be applied as legal hold
  can_be_overridden:       boolean;        // Whether dealer can change this policy
  /** Asset types where this is the recommended default policy. */
  recommended_for:         MediaAssetTypeId[];
  /** Asset types this policy is incompatible with. */
  incompatible_with:       MediaAssetTypeId[];
}

// ─── Policy registry ──────────────────────────────────────────────────────────

export const MEDIA_LIFECYCLE_POLICIES: MediaLifecyclePolicyDescriptor[] = [

  {
    policy_id:             "permanent",
    display_name:          "Permanent Retention",
    description:
      "The media asset is never automatically deleted. The dealer or a system administrator " +
      "must explicitly trigger deletion. Appropriate for legal records, long-term job " +
      "documentation, and dealer branding assets. Default for photos (images) in the " +
      "current DealerMedia model.",
    retention_days:        null,
    deletion_trigger:      "never",
    auto_delete:           false,
    requires_confirmation: true,
    legal_hold_capable:    true,
    can_be_overridden:     true,   // Dealer can downgrade to retention_30d to save storage
    recommended_for:       ["image", "pdf"],
    incompatible_with:     ["ai_generated_video", "ocr_source_image"],
  },

  {
    policy_id:             "retention_30d",
    display_name:          "30-Day Retention",
    description:
      "The media asset is scheduled for physical deletion 30 days after it was created. " +
      "The delete is automatic — no dealer action required. A deletion record is retained " +
      "for audit. Default for AI-generated videos and standard video recordings. " +
      "Mirrors the existing DEFAULT_RETENTION_DAYS['video'] = 30 in media-types.ts.",
    retention_days:        30,
    deletion_trigger:      "time_elapsed",
    auto_delete:           true,
    requires_confirmation: false,
    legal_hold_capable:    false,
    can_be_overridden:     true,   // Dealer can extend via dealer_defined
    recommended_for:       ["video", "ai_generated_video"],
    incompatible_with:     [],     // legal_hold policy overrides this at the policy level
  },

  {
    policy_id:             "delete_after_download",
    display_name:          "Delete After Download",
    description:
      "The media asset is deleted from storage once the dealer or customer has confirmed " +
      "a successful download. Designed for AI-generated videos and large output files " +
      "that should not remain in long-term storage after the dealer has saved a local copy. " +
      "Deletion is triggered by the download confirmation event, not by a time window.",
    retention_days:        null,   // No time window — event-triggered
    deletion_trigger:      "download_confirmed",
    auto_delete:           true,
    requires_confirmation: false,  // Confirmation is the download itself
    legal_hold_capable:    false,
    can_be_overridden:     true,   // Dealer can upgrade to permanent if needed
    recommended_for:       ["ai_generated_video"],
    incompatible_with:     ["3d_asset"],
  },

  {
    policy_id:             "delete_after_ai_processing",
    display_name:          "Delete After AI Processing",
    description:
      "The source media asset is deleted immediately after AI processing has completed " +
      "and the output has been stored. Applied to OCR source images where the goal is " +
      "to extract text and discard the original file. Minimizes storage usage and " +
      "privacy exposure for scanned documents.",
    retention_days:        null,   // Immediate deletion after processing event
    deletion_trigger:      "ai_processed",
    auto_delete:           true,
    requires_confirmation: false,
    legal_hold_capable:    false,
    can_be_overridden:     false,  // Must be changed at upload time — not configurable post-upload
    recommended_for:       ["ocr_source_image"],
    incompatible_with:     ["image", "video", "ai_generated_image", "ai_generated_video", "3d_asset"],
  },

  {
    policy_id:             "dealer_defined",
    display_name:          "Dealer-Defined Retention",
    description:
      "The dealer configures a custom retention period via the Settings → Media screen. " +
      "Overrides the system default for applicable asset types. Minimum: 7 days. " +
      "Maximum: 3650 days (~10 years). Requires Pro or Pro+ plan for periods " +
      "exceeding 90 days. Default retention_days comes from dealer_media_preferences " +
      "(Phase 10K — not yet implemented).",
    retention_days:        null,   // Loaded from dealer configuration at runtime
    deletion_trigger:      "time_elapsed",
    auto_delete:           true,
    requires_confirmation: false,
    legal_hold_capable:    false,
    can_be_overridden:     true,
    recommended_for:       ["image", "video", "pdf"],
    incompatible_with:     ["ocr_source_image"],  // OCR source must use delete_after_ai_processing
  },

  {
    policy_id:             "legal_hold",
    display_name:          "Legal Hold",
    description:
      "The media asset cannot be deleted under any circumstances until the legal hold " +
      "is explicitly released by an authorized administrator. Overrides all other policies. " +
      "Applied when media is associated with a legal dispute, regulatory inquiry, or " +
      "customer complaint requiring evidence preservation. " +
      "Requires CTO approval to set or release.",
    retention_days:        null,   // Indefinite — held until explicit release
    deletion_trigger:      "never",
    auto_delete:           false,
    requires_confirmation: true,
    legal_hold_capable:    true,
    can_be_overridden:     false,  // Cannot be changed without CTO approval
    recommended_for:       [],     // Applied on a case-by-case basis — no default type
    incompatible_with:     [],     // Compatible with all types — overrides any other policy
  },

] as const satisfies MediaLifecyclePolicyDescriptor[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getLifecyclePolicy(
  policy_id: MediaLifecyclePolicyId,
): MediaLifecyclePolicyDescriptor | undefined {
  return MEDIA_LIFECYCLE_POLICIES.find(p => p.policy_id === policy_id);
}

export function getRecommendedPolicyForType(
  type_id: MediaAssetTypeId,
): MediaLifecyclePolicyDescriptor | undefined {
  return MEDIA_LIFECYCLE_POLICIES.find(p => p.recommended_for.includes(type_id));
}

export function getAutoDeletingPolicies(): MediaLifecyclePolicyDescriptor[] {
  return MEDIA_LIFECYCLE_POLICIES.filter(p => p.auto_delete);
}

export function getNonDeletingPolicies(): MediaLifecyclePolicyDescriptor[] {
  return MEDIA_LIFECYCLE_POLICIES.filter(p => !p.auto_delete);
}

export function getOverridablePolicies(): MediaLifecyclePolicyDescriptor[] {
  return MEDIA_LIFECYCLE_POLICIES.filter(p => p.can_be_overridden);
}

export function getDefaultPolicyIdForType(
  type_id: MediaAssetTypeId,
): MediaLifecyclePolicyId {
  switch (type_id) {
    case "ocr_source_image":     return "delete_after_ai_processing";
    case "ai_generated_video":   return "delete_after_download";
    case "video":                return "retention_30d";
    case "ai_generated_image":   return "retention_30d";
    case "voice":                return "retention_30d";
    case "attachment":           return "retention_30d";
    case "image":                return "permanent";
    case "pdf":                  return "permanent";
    case "3d_asset":             return "permanent";
    default:                     return "retention_30d";
  }
}
