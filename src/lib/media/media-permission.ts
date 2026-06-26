// DealerOS — Media Permission Model
//
// Sprint 10J: production-ready permission model for all media operations.
// Determines what operations are allowed on a DealerMedia asset based on:
//   - visibility: current access level set by the dealer
//   - consent_status: customer's response to sharing requests
//   - is_marketing_approved: dealer's explicit approval for marketing use
//   - is_ai_training_excluded: immutable exclusion from AI model training
//
// Privacy invariant:
//   All new uploads default to internal_only and not_required.
//   Visibility only increases through explicit dealer action and customer consent.
//   consent_status = "denied" always reverts effective scope to internal_only.
//
// Security:
//   dealer_id must be verified before calling these functions.
//   These helpers evaluate a single DealerMedia object — they do not re-query the DB.

import type { DealerMedia } from "./media-types";
import { isRetentionExpired } from "./media-types";

// ─── Permission scope ─────────────────────────────────────────────────────────

/**
 * The effective permission level of a media asset, derived from its current
 * visibility, consent, and marketing flags.
 *
 * Ordered from least to most permissive:
 *   retention_expired < internal_only < customer_visible < marketing_candidate < marketing_approved
 *
 * retention_expired is a blocking state: the file has been deleted or its retention
 * window has elapsed. All operations except reading the audit record are blocked.
 *
 * is_ai_training_excluded is a separate orthogonal flag, not a scope level.
 */
export type MediaPermissionScope =
  | "retention_expired"   // File deleted or retention window elapsed — no access.
  | "internal_only"       // Default. No external sharing allowed.
  | "customer_visible"    // Cleared for completion report sharing.
  | "marketing_candidate" // Flagged for marketing but consent not yet confirmed.
  | "marketing_approved"; // Consent confirmed and dealer-approved for marketing.

// ─── Permission gate ──────────────────────────────────────────────────────────

/**
 * Full permission gate for a single media asset.
 * Each boolean answers: "Is this specific operation allowed right now?"
 *
 * denial_reasons explains why each restricted operation is blocked.
 * Empty when all permissions are granted.
 */
export interface MediaPermissionGate {
  scope:                             MediaPermissionScope;
  is_ai_training_excluded:           boolean;
  can_view_internally:               boolean;  // Always true if dealer holds the record
  can_include_in_completion_report:  boolean;  // Requires scope >= customer_visible
  can_share_with_customer:           boolean;  // Requires scope >= customer_visible
  can_use_for_marketing:             boolean;  // Requires scope = marketing_approved
  can_use_for_ai_analysis:           boolean;  // Requires scope >= customer_visible
  can_use_for_ai_training:           boolean;  // Requires marketing_approved + not excluded
  denial_reasons:                    string[];
}

// ─── Scope resolver ───────────────────────────────────────────────────────────

/**
 * Derives the current effective MediaPermissionScope from a DealerMedia record.
 *
 * Evaluation order:
 * 0. File deleted or retention window expired → retention_expired (blocks all operations)
 * 1. consent_status = "denied"  → always internal_only regardless of visibility
 * 2. All three marketing gates met → marketing_approved
 * 3. Visibility = marketing_approved or usage = marketing_candidate → marketing_candidate
 * 4. visibility = customer_visible → customer_visible
 * 5. Default → internal_only
 */
export function resolvePermissionScope(media: DealerMedia): MediaPermissionScope {
  if (media.deleted_at || isRetentionExpired(media)) {
    return "retention_expired";
  }

  if (media.consent_status === "denied") {
    return "internal_only";
  }

  if (
    media.visibility            === "marketing_approved" &&
    media.is_marketing_approved === true &&
    media.consent_status        === "approved"
  ) {
    return "marketing_approved";
  }

  if (
    media.visibility     === "marketing_approved" ||
    media.usage          === "marketing_candidate" ||
    media.consent_status === "pending"
  ) {
    return "marketing_candidate";
  }

  if (media.visibility === "customer_visible") {
    return "customer_visible";
  }

  return "internal_only";
}

// ─── Gate evaluator ───────────────────────────────────────────────────────────

/**
 * Returns the full permission gate for a media asset.
 *
 * All operations are validated against the derived scope and privacy flags.
 * Never throws — always returns a populated gate object.
 */
export function checkMediaPermission(media: DealerMedia): MediaPermissionGate {
  const scope   = resolvePermissionScope(media);
  const denials: string[] = [];

  // Retention-expired assets block all operations — file no longer exists in storage.
  if (scope === "retention_expired") {
    const reason = media.deleted_at
      ? "File has been physically deleted from storage. Only the audit record remains."
      : "Retention window has elapsed. File is pending physical deletion.";
    return {
      scope,
      is_ai_training_excluded:          media.is_ai_training_excluded,
      can_view_internally:              false,
      can_include_in_completion_report: false,
      can_share_with_customer:          false,
      can_use_for_marketing:            false,
      can_use_for_ai_analysis:          false,
      can_use_for_ai_training:          false,
      denial_reasons:                   [reason],
    };
  }

  const canShareCustomer =
    scope === "customer_visible" ||
    scope === "marketing_candidate" ||
    scope === "marketing_approved";

  const canMarketing = scope === "marketing_approved";

  const canAIAnalysis = canShareCustomer && !media.is_ai_training_excluded;

  const canAITraining = canMarketing && !media.is_ai_training_excluded;

  if (!canShareCustomer) {
    denials.push(
      "Visibility is internal_only. Customer sharing requires the dealer to change visibility.",
    );
  }

  if (scope === "marketing_candidate") {
    denials.push(
      "Marketing use requires customer consent (approved) and dealer marketing approval.",
    );
  }

  if (!canMarketing && scope !== "marketing_candidate") {
    // Only add this if not already covered by the marketing_candidate reason
    if (canShareCustomer) {
      denials.push(
        "Marketing use requires visibility = marketing_approved, consent = approved, and is_marketing_approved = true.",
      );
    }
  }

  if (media.is_ai_training_excluded) {
    denials.push("Media is excluded from AI training — is_ai_training_excluded is true.");
  }

  if (media.consent_status === "denied") {
    denials.push("Customer has denied consent. Media is restricted to internal_only.");
  }

  return {
    scope,
    is_ai_training_excluded:          media.is_ai_training_excluded,
    can_view_internally:              true,
    can_include_in_completion_report: canShareCustomer,
    can_share_with_customer:          canShareCustomer,
    can_use_for_marketing:            canMarketing,
    can_use_for_ai_analysis:          canAIAnalysis,
    can_use_for_ai_training:          canAITraining,
    denial_reasons:                   denials,
  };
}
