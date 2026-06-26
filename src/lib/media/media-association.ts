// DealerOS — Media Association Model
//
// Sprint 10L Phase C: a single media asset may belong to multiple business entities.
//
// The association model decouples "where media was captured" from "where it is used."
// Example: a before/after photo of a vehicle is captured in a work order context,
// associated with the work order AND the vehicle AND the completion report AND
// optionally a marketing campaign — all from the same source file.
//
// Security: dealer_id is always part of every association lookup.
// Cross-dealer access is forbidden — each association is scoped to a single dealer.

import type { DealerMedia } from "./media-types";

// ─── Association target ───────────────────────────────────────────────────────

/**
 * The business entity types that a media asset can be associated with.
 * Each represents a distinct business context where the same file may appear.
 */
export type MediaAssociationTarget =
  | "customer"             // Direct association with a customer record
  | "vehicle"              // Vehicle-level association (car profile, vehicle gallery)
  | "estimate"             // Attached to a specific estimate
  | "work_order"           // Source context — the job during which it was captured
  | "completion_report"    // Used in the formal completion report PDF
  | "invoice"              // Included in an invoice
  | "line_message"         // Sent via LINE to the customer
  | "review"               // Used in a reputation/review workflow
  | "marketing_campaign"   // Used in a marketing campaign
  | "sns_post"             // Published to a social network (Instagram, etc.)
  | "ai_generated_asset";  // AI-generated output derived from this source

// ─── Association role ─────────────────────────────────────────────────────────

/**
 * Why this media is associated with the target entity.
 * The same media may have different roles for different targets.
 *
 * Example:
 *   For work_order  → role = "source_input" (it was captured here)
 *   For completion_report → role = "evidence" (it proves the job result)
 *   For marketing_campaign → role = "marketing_use"
 */
export type MediaAssociationRole =
  | "primary"        // The main representative media for this entity
  | "supporting"     // Additional media for the same entity
  | "evidence"       // Documents or proves a state (before/after job result)
  | "source_input"   // Was used as input to generate something else (AI source)
  | "output"         // Generated output from an AI agent
  | "marketing_use"  // Active use in a marketing or SNS campaign
  | "review_use";    // Used as part of a review or reputation workflow

// ─── Association record ───────────────────────────────────────────────────────

/**
 * MediaAssociation — a link between a media asset and a business entity.
 *
 * One media asset may have many associations, each pointing to a different entity.
 * This is the primary mechanism for answering: "Where is this media used?"
 *
 * Notes:
 *   - dealer_id must be the same for media, target entity, and association.
 *   - created_at records when the association was established (not when media was captured).
 *   - removed_at marks when an association was ended (e.g., removed from marketing campaign).
 *     Null means the association is currently active.
 */
export interface MediaAssociation {
  media_id:     string;
  dealer_id:    string;
  target_type:  MediaAssociationTarget;
  target_id:    string;
  role:         MediaAssociationRole;
  created_at:   string;    // ISO 8601
  removed_at:   string | null;  // Non-null if the association was explicitly ended
}

// ─── Association helpers ──────────────────────────────────────────────────────

/**
 * Returns all currently active associations (removed_at is null).
 */
export function getActiveAssociations(
  associations: MediaAssociation[],
): MediaAssociation[] {
  return associations.filter((a) => a.removed_at === null);
}

/**
 * Returns all associations for a specific target type.
 */
export function getAssociationsByTarget(
  associations: MediaAssociation[],
  target: MediaAssociationTarget,
): MediaAssociation[] {
  return associations.filter((a) => a.target_type === target && a.removed_at === null);
}

/**
 * Returns true if a media asset has any active association with the given entity.
 */
export function isAssociatedWith(
  associations: MediaAssociation[],
  target: MediaAssociationTarget,
  targetId: string,
): boolean {
  return associations.some(
    (a) => a.target_type === target && a.target_id === targetId && a.removed_at === null,
  );
}

/**
 * Derives simple associations from a DealerMedia record for backward compatibility.
 * This is used by toMediaAsset() when no pre-fetched association list is available.
 *
 * These associations are inferred from nullable FK fields — they are not equivalent
 * to the full association model (no role, no created_at from the association).
 */
export function deriveAssociationsFromMedia(media: DealerMedia): MediaAssociation[] {
  const now        = new Date().toISOString();
  const baseFields = { media_id: media.id, dealer_id: media.dealer_id, removed_at: null, created_at: now };
  const result: MediaAssociation[] = [];

  if (media.work_order_id) {
    result.push({ ...baseFields, target_type: "work_order",    target_id: media.work_order_id,         role: "source_input" });
  }
  if (media.customer_id) {
    result.push({ ...baseFields, target_type: "customer",      target_id: media.customer_id,            role: "supporting" });
  }
  if (media.vehicle_id) {
    result.push({ ...baseFields, target_type: "vehicle",       target_id: media.vehicle_id,             role: "supporting" });
  }
  if (media.completion_report_id) {
    result.push({ ...baseFields, target_type: "completion_report", target_id: media.completion_report_id, role: "evidence" });
  }

  return result;
}
