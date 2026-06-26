// DealerOS — Media Lifecycle State Machine
//
// Sprint 10L Phase B: lifecycle types covering all stages from capture to audit.
//
// The lifecycle describes the full journey of a media asset through the system.
// States are deterministically derived from DealerMedia fields — no separate
// lifecycle table is required at this stage.
//
// Full lifecycle:
//   Capture → Upload → Validation → Association → Usage →
//   AI Consumption → Marketing → Retention → Deletion → Audit

import type { DealerMedia } from "./media-types";
import { DEFAULT_RETENTION_DAYS, isRetentionExpired } from "./media-types";

// ─── Lifecycle stage ──────────────────────────────────────────────────────────

/**
 * All stages in a media asset's lifecycle.
 *
 * Stages are ordered from earliest to latest. A single asset may visit some
 * stages more than once (e.g., marketing → in_use if approval is revoked) but
 * deleted and audited are terminal — no further transitions are allowed after audited.
 */
export type MediaLifecycleStage =
  | "captured"          // File exists on device; not yet uploaded to storage
  | "uploaded"          // File in Supabase Storage; not yet formally validated
  | "validated"         // Passed MIME/size/type validation; file_size_bytes and mime_type are set
  | "associated"        // Linked to at least one business entity (work order, customer, vehicle)
  | "in_use"            // Actively used in customer-facing documents (completion report, gallery)
  | "ai_consumption"    // Being or has been processed by an AI agent
  | "marketing"         // Cleared for marketing and SNS distribution
  | "retention_active"  // Active use phase has ended; inside its retention window
  | "retention_expired" // Retention window elapsed; file awaits physical deletion
  | "deleted"           // File physically deleted from storage; record retained for audit
  | "audited";          // Lifecycle complete; full deletion record finalized

// ─── Lifecycle trigger ────────────────────────────────────────────────────────

/**
 * The event that caused a lifecycle stage transition.
 */
export type MediaLifecycleTrigger =
  | "file_uploaded"             // Storage upload completed
  | "validation_passed"         // MIME/size checks passed
  | "entity_linked"             // work_order_id, customer_id, or vehicle_id was set
  | "completion_report_added"   // Included in a completion report
  | "customer_gallery_added"    // Added to customer portal gallery
  | "ai_agent_consumed"         // Passed to an AI agent (marketing, reputation, etc.)
  | "marketing_approved"        // Dealer approved for marketing, consent confirmed
  | "retention_window_opened"   // Asset moved out of active use into retention period
  | "retention_window_expired"  // Retention deadline elapsed
  | "file_deleted"              // Physical file removed from storage
  | "audit_finalized";          // MediaDeletionRecord finalized

// ─── Lifecycle transition ─────────────────────────────────────────────────────

/**
 * A recorded transition between two lifecycle stages.
 */
export interface MediaLifecycleTransition {
  from:        MediaLifecycleStage;
  to:          MediaLifecycleStage;
  trigger:     MediaLifecycleTrigger;
  occurred_at: string;    // ISO 8601
  actor_id?:   string;    // UUID of staff member who triggered the transition (optional)
}

// ─── Lifecycle domain object (Phase A) ────────────────────────────────────────

/**
 * MediaLifecycle — Phase A domain object representing the lifecycle state of an asset.
 *
 * current_stage is the authoritative answer to "where is this asset now?"
 * history contains the ordered list of transitions (populated from event log — Phase 10M+).
 */
export interface MediaLifecycle {
  media_id:      string;
  dealer_id:     string;
  current_stage: MediaLifecycleStage;
  entered_at:    string;    // ISO 8601 — when current_stage was entered
  history:       MediaLifecycleTransition[];
}

// ─── Allowed transitions ──────────────────────────────────────────────────────

/**
 * Valid state machine transitions.
 * A transition not listed here is a programming error.
 */
export const LIFECYCLE_TRANSITIONS: Record<MediaLifecycleStage, MediaLifecycleStage[]> = {
  captured:          ["uploaded"],
  uploaded:          ["validated", "deleted"],
  validated:         ["associated", "deleted"],
  associated:        ["in_use", "ai_consumption", "retention_active", "deleted"],
  in_use:            ["marketing", "ai_consumption", "retention_active", "deleted"],
  ai_consumption:    ["marketing", "in_use", "retention_active", "deleted"],
  marketing:         ["in_use", "retention_active", "deleted"],
  retention_active:  ["retention_expired", "deleted"],
  retention_expired: ["deleted"],
  deleted:           ["audited"],
  audited:           [],
};

// ─── Stage derivation ─────────────────────────────────────────────────────────

/**
 * Derives the current MediaLifecycleStage from a DealerMedia record.
 *
 * This is a best-effort approximation from available DB fields.
 * A full event log (Phase 10M+) would provide exact stage history.
 *
 * Priority order: deleted > captured > retention_expired > marketing > in_use >
 *   associated > validated > uploaded
 */
export function deriveLifecycleStage(media: DealerMedia): MediaLifecycleStage {
  if (media.deleted_at)                                   return "deleted";
  if (!media.file_path)                                   return "captured";
  if (isRetentionExpired(media))                          return "retention_expired";
  if (
    media.visibility           === "marketing_approved" &&
    media.is_marketing_approved === true                &&
    media.consent_status       === "approved"
  ) {
    return "marketing";
  }
  if (media.visibility === "customer_visible" || media.completion_report_id) {
    return "in_use";
  }
  if (media.work_order_id || media.customer_id || media.vehicle_id) {
    return "associated";
  }
  if (media.file_size_bytes !== null && media.mime_type !== null) {
    return "validated";
  }
  return "uploaded";
}

/**
 * Returns the list of stages this asset can legally transition to from its current stage.
 */
export function getAvailableTransitions(media: DealerMedia): MediaLifecycleStage[] {
  const current = deriveLifecycleStage(media);
  return LIFECYCLE_TRANSITIONS[current] ?? [];
}

/**
 * Returns true if the asset may legally transition to the target stage.
 */
export function canTransitionTo(
  media:  DealerMedia,
  target: MediaLifecycleStage,
): boolean {
  return getAvailableTransitions(media).includes(target);
}

/**
 * Returns the default video retention window expiry for a given asset.
 * Null if the asset is a photo or has long-term retention.
 */
export function computeRetentionExpiry(media: DealerMedia): string | null {
  if (media.media_type !== "video") return null;
  const days    = DEFAULT_RETENTION_DAYS["video"];
  if (days >= 3650) return null;
  const created = new Date(media.created_at);
  const expires = new Date(created);
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}
