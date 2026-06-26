// GYEON Business Hub — Media Asset Center: Usage Context Registry (Sprint 12E)
//
// Defines the 10 business entities that can own or reference a media asset.
//
// The existing MediaAssociationTarget (Sprint 10L) defines 11 target types for
// the association model. Sprint 12E formalizes the usage context model with
// typed descriptors and a queryable registry for platform-wide media routing.
//
// Usage contexts answer: "What type of business entity is this media used in?"
// This is distinct from MediaAssociation (which tracks the specific association
// between an asset and a specific entity instance).
//
// The 10 contexts match the spec:
//   customer, vehicle, estimate, work_order, completion_report, invoice,
//   communication, ai_generation, marketing_campaign, distribution_order
//
// No DB calls. No async. No external calls. Registry only.
// Pure — no "use server", no async, no execution.

import type { MediaAssetTypeId } from "./media-asset-type-registry";
import type { MediaLifecyclePolicyId } from "./media-policy";

// ─── Usage context identifier ─────────────────────────────────────────────────

/**
 * MediaUsageContextId — the 10 business entity types that a media asset can belong to.
 *
 * These are usage contexts — not association target IDs. A single asset may
 * be used in multiple contexts simultaneously (e.g., a completion photo is
 * associated with work_order, completion_report, and potentially marketing_campaign).
 */
export type MediaUsageContextId =
  | "customer"            // Associated with a customer record (customer profile photo, ID scans)
  | "vehicle"             // Associated with a vehicle (vehicle profile photo, condition docs)
  | "estimate"            // Attached to an estimate (reference photos, damage evidence)
  | "work_order"          // Captured during or attached to a work order (before/during/after)
  | "completion_report"   // Included in a formal completion report (completion evidence)
  | "invoice"             // Attached to an invoice or billing document
  | "communication"       // Sent or received in a communication thread (LINE, WhatsApp, Email)
  | "ai_generation"       // Used as AI input or is AI output (source photos, generated content)
  | "marketing_campaign"  // Part of a marketing campaign (SNS posts, promotional content)
  | "distribution_order"; // Part of a GYEON Distribution order (product photos, specs)

// ─── Usage context descriptor ─────────────────────────────────────────────────

export interface MediaUsageDescriptor {
  context_id:             MediaUsageContextId;
  display_name:           string;
  description:            string;
  /** Which asset types are typically used in this context. */
  compatible_asset_types: MediaAssetTypeId[];
  /** The lifecycle policy most appropriate for assets in this context. */
  typical_lifecycle:      MediaLifecyclePolicyId;
  /** Whether media in this context may be visible to the customer. */
  customer_accessible:    boolean;
  /** Whether media in this context can be used in marketing workflows. */
  marketing_eligible:     boolean;
  /** Maximum number of assets per entity instance (null = no limit). */
  max_assets_per_entity:  number | null;
  /** Whether this context is currently active in the platform. */
  available:              boolean;
  /** Sprint when this context was or will be formally wired. */
  target_sprint:          string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MEDIA_USAGE_REGISTRY: MediaUsageDescriptor[] = [

  {
    context_id:            "customer",
    display_name:          "Customer",
    description:
      "Media directly associated with a customer record. Includes customer-provided " +
      "profile photos and any media attached to the customer profile. " +
      "All customer-associated media requires active consent_status before sharing.",
    compatible_asset_types: ["image", "pdf", "attachment"],
    typical_lifecycle:      "permanent",
    customer_accessible:    true,
    marketing_eligible:     false,
    max_assets_per_entity:  null,
    available:              true,
    target_sprint:          "Sprint 10L",
  },

  {
    context_id:            "vehicle",
    display_name:          "Vehicle",
    description:
      "Media associated with a specific vehicle. Includes vehicle profile photos, " +
      "condition documentation, and pre-/post-detailing records. " +
      "Builds a persistent visual history of the vehicle across multiple visits.",
    compatible_asset_types: ["image", "video", "pdf"],
    typical_lifecycle:      "permanent",
    customer_accessible:    true,
    marketing_eligible:     true,   // With explicit marketing consent
    max_assets_per_entity:  null,
    available:              true,
    target_sprint:          "Sprint 10L",
  },

  {
    context_id:            "estimate",
    display_name:          "Estimate",
    description:
      "Media attached to a specific estimate. Typically photos of the vehicle " +
      "condition at estimate time — used to justify pricing and document the " +
      "vehicle state before any work begins.",
    compatible_asset_types: ["image", "pdf"],
    typical_lifecycle:      "permanent",
    customer_accessible:    true,
    marketing_eligible:     false,
    max_assets_per_entity:  20,
    available:              true,
    target_sprint:          "Sprint 10L",
  },

  {
    context_id:            "work_order",
    display_name:          "Work Order",
    description:
      "Media captured during or attached to a work order. The primary source context " +
      "for before, during, and after documentation photos. Work order photos form the " +
      "basis for completion reports and AI marketing content generation.",
    compatible_asset_types: ["image", "video", "pdf", "attachment"],
    typical_lifecycle:      "permanent",   // Photos are permanent; videos use retention_30d
    customer_accessible:    true,
    marketing_eligible:     true,
    max_assets_per_entity:  null,
    available:              true,
    target_sprint:          "Sprint 10I",
  },

  {
    context_id:            "completion_report",
    display_name:          "Completion Report",
    description:
      "Media included in a formal work completion report. Completion report photos " +
      "must have visibility = customer_visible and is_public = true (work_order_files). " +
      "Used in the printable/shareable PDF completion report sent to customers.",
    compatible_asset_types: ["image", "pdf"],
    typical_lifecycle:      "permanent",
    customer_accessible:    true,
    marketing_eligible:     true,   // Completion photos are strong marketing candidates
    max_assets_per_entity:  30,
    available:              true,
    target_sprint:          "Sprint 10J",
  },

  {
    context_id:            "invoice",
    display_name:          "Invoice",
    description:
      "Media attached to an invoice. Primarily PDF invoices and receipt documents. " +
      "May also include photos used as evidence for invoice line items (e.g., part photos). " +
      "Legal hold applies when invoices are disputed.",
    compatible_asset_types: ["pdf", "image", "attachment"],
    typical_lifecycle:      "permanent",
    customer_accessible:    true,
    marketing_eligible:     false,
    max_assets_per_entity:  5,
    available:              false,
    target_sprint:          "Sprint 13",
  },

  {
    context_id:            "communication",
    display_name:          "Communication",
    description:
      "Media sent or received within a communication thread. Covers LINE image messages, " +
      "WhatsApp media attachments, email attachments, and voice messages. " +
      "Delivered through the Communication Center — requires customer consent. " +
      "Uses shorter retention periods to minimize storage accumulation.",
    compatible_asset_types: ["image", "video", "pdf", "attachment", "voice"],
    typical_lifecycle:      "retention_30d",
    customer_accessible:    true,
    marketing_eligible:     false,
    max_assets_per_entity:  null,
    available:              false,
    target_sprint:          "Sprint 13",
  },

  {
    context_id:            "ai_generation",
    display_name:          "AI Generation",
    description:
      "Media that is either (a) source input for an AI generation process, or " +
      "(b) output produced by an AI agent. Covers AI image generation, AI video generation, " +
      "and OCR processing. ai_generated = true on the DealerMedia record for outputs. " +
      "ai_source_media_id links outputs to their source inputs.",
    compatible_asset_types: [
      "image", "video", "ocr_source_image",
      "ai_generated_image", "ai_generated_video",
    ],
    typical_lifecycle:      "delete_after_ai_processing",  // OCR sources; outputs vary
    customer_accessible:    false,
    marketing_eligible:     false,   // Marketing eligibility set on the output, not here
    max_assets_per_entity:  null,
    available:              false,
    target_sprint:          "Sprint 13",
  },

  {
    context_id:            "marketing_campaign",
    display_name:          "Marketing Campaign",
    description:
      "Media that has been approved for use in a marketing campaign. " +
      "Requires visibility = marketing_approved and consent_status = approved. " +
      "Includes before/after photos, AI-generated SNS posts, and promotional videos. " +
      "No auto-publish — dealer reviews and posts manually.",
    compatible_asset_types: ["image", "video", "ai_generated_image", "ai_generated_video"],
    typical_lifecycle:      "permanent",
    customer_accessible:    false,   // Public after dealer posts — not via platform dispatch
    marketing_eligible:     true,
    max_assets_per_entity:  null,
    available:              false,
    target_sprint:          "Sprint 13",
  },

  {
    context_id:            "distribution_order",
    display_name:          "GYEON Distribution Order",
    description:
      "Media associated with a GYEON Distribution (product order). Includes product " +
      "specification images, delivery photos, and product documentation PDFs. " +
      "Used by the Enterprise Distribution application within the GYEON ecosystem.",
    compatible_asset_types: ["image", "pdf", "attachment"],
    typical_lifecycle:      "permanent",
    customer_accessible:    false,
    marketing_eligible:     false,
    max_assets_per_entity:  20,
    available:              false,
    target_sprint:          "Sprint 15+",
  },

] as const satisfies MediaUsageDescriptor[];

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function getUsageDescriptor(
  context_id: MediaUsageContextId,
): MediaUsageDescriptor | undefined {
  return MEDIA_USAGE_REGISTRY.find(u => u.context_id === context_id);
}

export function getUsageContextsForAssetType(
  type_id: MediaAssetTypeId,
): MediaUsageDescriptor[] {
  return MEDIA_USAGE_REGISTRY.filter(u => u.compatible_asset_types.includes(type_id));
}

export function getCustomerAccessibleContexts(): MediaUsageDescriptor[] {
  return MEDIA_USAGE_REGISTRY.filter(u => u.customer_accessible);
}

export function getMarketingEligibleContexts(): MediaUsageDescriptor[] {
  return MEDIA_USAGE_REGISTRY.filter(u => u.marketing_eligible);
}

export function getAvailableUsageContexts(): MediaUsageDescriptor[] {
  return MEDIA_USAGE_REGISTRY.filter(u => u.available);
}

export function getUsageContextIds(): MediaUsageContextId[] {
  return MEDIA_USAGE_REGISTRY.map(u => u.context_id);
}
