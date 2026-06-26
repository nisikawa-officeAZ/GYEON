// GYEON Business Hub — Subscription & Billing Center: Domain Types (Sprint 11Y)
//
// Foundation-level types for the Subscription & Billing Center.
// Covers two product families: GYEON Business Hub and Detailer Agent.
//
// Does NOT modify existing subscription types (PlanCode, DealerPlan, FeatureKey, etc.)
// which remain authoritative for the current runtime subscription system.
// These types model the FUTURE pricing architecture and platform-level subscription strategy.
//
// Pure — no "use server", no async, no DB calls, no external calls, no Stripe imports.

// ─── Product families ─────────────────────────────────────────────────────────

export type ProductFamilyId =
  | "gyeon_business_hub"  // GYEON-specific multi-app platform
  | "detailer_agent";     // Generic multi-brand detailing shop platform

// ─── Subscription tier IDs ────────────────────────────────────────────────────

/** Detailer Agent four-tier pricing model. */
export type DetailerAgentTierId =
  | "starter"
  | "professional"
  | "business_ai"
  | "enterprise_ai";

/** GYEON Business Hub plan identifiers. */
export type GyeonHubPlanId =
  | "free"
  | "basic"
  | "pro"
  | "pro_plus"
  | "enterprise";

/** Union for any plan in either product family. */
export type AnyPlanId = DetailerAgentTierId | GyeonHubPlanId;

// ─── Billing ──────────────────────────────────────────────────────────────────

export type BillingCycleId =
  | "monthly"
  | "annual"
  | "manual"               // Invoice-based, bank transfer
  | "enterprise_contract"; // Custom pricing, negotiated contract

// ─── Entitlements ─────────────────────────────────────────────────────────────

export type EntitlementStatus =
  | "included"       // Included in the base plan price
  | "addon"          // Available as a paid add-on
  | "not_available"  // Not available on this plan
  | "contact_sales"; // Available via enterprise negotiation

/** AI capability entitlement levels. Each level is cumulative (higher includes lower). */
export type AIEntitlementId =
  | "no_ai"                 // No AI features
  | "basic_ai"              // Spell check, basic text suggestions
  | "ocr_ai"                // OCR for vehicle registration and documents
  | "marketing_ai"          // SNS captions, SEO/MEO/AEO metadata generation
  | "communication_ai"      // AI-assisted customer messaging (LINE, Email)
  | "video_ai"              // AI video generation for social media (planned)
  | "growth_ai"             // AI growth insights, analytics, business intelligence
  | "marketplace_ai"        // Full AI Marketplace access
  | "dealer_owned_provider" // Dealer configures own AI provider (OpenAI, Anthropic, etc.)
  | "enterprise_ai";        // All AI + budget controls + usage policies

/** Applications that can be enabled or disabled per plan. */
export type ApplicationEntitlementId =
  | "dealer_agent"          // Core detailing shop management
  | "distribution"          // B2B product distribution
  | "warehouse"             // Inventory and warehouse management
  | "crm"                   // Customer relationship management
  | "accounting"            // Financial management
  | "ai_center"             // AI platform and marketplace
  | "communication_center"; // Unified multi-channel communication

// ─── Descriptors ──────────────────────────────────────────────────────────────

/** Full descriptor for a subscription plan in either product family. */
export interface SubscriptionPlanDescriptor {
  plan_id:                string;
  display_name:           string;
  family_id:              ProductFamilyId;
  tier_position:          number;    // 1 = lowest / entry-level
  status:                 "active" | "planned";
  billing_cycles:         BillingCycleId[];
  price_reference:        string | null; // "contact_sales" or "example_only" — never production price
  ai_entitlements:        AIEntitlementId[];
  application_entitlements: Record<ApplicationEntitlementId, EntitlementStatus>;
  feature_highlights:     string[];
  target_customer:        string;
  requires_sales_approval: boolean;
  spec_document:          string | null;
}

/** Descriptor for a single AI entitlement level. */
export interface AIEntitlementDescriptor {
  entitlement_id:    AIEntitlementId;
  display_name:      string;
  description:       string;
  included_features: string[];
  available_from_detailer: DetailerAgentTierId | null;
  available_from_gyeon:    GyeonHubPlanId | null;
}

/** Descriptor for a single application entitlement slot. */
export interface ApplicationEntitlementDescriptor {
  entitlement_id:           ApplicationEntitlementId;
  display_name:             string;
  platform_application_ref: string;   // BusinessApplicationId equivalent
  minimum_detailer_tier:    DetailerAgentTierId | null;
  minimum_gyeon_plan:       GyeonHubPlanId | null;
  is_future:                boolean;
}

/** Descriptor for a product family. */
export interface ProductFamilyDescriptor {
  family_id:       ProductFamilyId;
  display_name:    string;
  description:     string;
  target_market:   string;
  plan_ids:        string[];
  billing_cycles:  BillingCycleId[];
  status:          "active" | "planned";
  application_ids: ApplicationEntitlementId[];
  spec_document:   string | null;
}

// ─── Subscription policy ──────────────────────────────────────────────────────

export type SubPolicyEnforcement = "strict" | "advisory";

export interface SubscriptionPolicy {
  policy_id:   string;   // SUB-001...
  title:       string;
  description: string;
  enforcement: SubPolicyEnforcement;
  rationale:   string;
  applies_to:  ProductFamilyId[] | "all";
}

// ─── Plan upgrade path ────────────────────────────────────────────────────────

export interface UpgradePath {
  from_plan: AnyPlanId;
  to_plan:   AnyPlanId;
  family_id: ProductFamilyId;
  features_unlocked: string[];
  requires_sales_approval: boolean;
}

// ─── Subscription Center descriptor ──────────────────────────────────────────

export interface SubscriptionCenterDescriptor {
  version:                    string;
  sprint:                     string;
  product_family_count:       number;
  detailer_agent_tier_count:  number;
  gyeon_hub_plan_count:       number;
  ai_entitlement_count:       number;
  application_entitlement_count: number;
  policy_count:               number;
  platform_core_integrated:   true;
  persistence_required:       false;
  stripe_integrated:          false;
  target_billing_sprint:      string;
}
