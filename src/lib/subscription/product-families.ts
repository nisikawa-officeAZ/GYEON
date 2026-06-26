// GYEON Business Hub — Subscription & Billing Center: Product Families (Sprint 11Y)
//
// Declares the two product families supported by the Subscription & Billing Center:
//   1. GYEON Business Hub  — GYEON Japan ecosystem, multi-application B2B platform
//   2. Detailer Agent       — Generic multi-brand detailing shop management SaaS
//
// Each family has its own plan model, billing model, and application scope.
// Pricing strategies and plan structures are kept entirely separate.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  ProductFamilyDescriptor,
  ProductFamilyId,
  ApplicationEntitlementId,
} from "./subscription-center-types";

// ─── GYEON Business Hub ───────────────────────────────────────────────────────

const GYEON_BUSINESS_HUB_FAMILY: ProductFamilyDescriptor = {
  family_id:     "gyeon_business_hub",
  display_name:  "GYEON Business Hub",
  description:
    "Multi-application B2B platform for the GYEON Japan ecosystem. " +
    "Includes GYEON Dealer Agent, GYEON Distribution, GYEON Warehouse, " +
    "GYEON CRM, GYEON Accounting, and GYEON AI Center. " +
    "Designed for Office AZ Group, Attraction Co., Ltd., and the GYEON Japan franchise network.",
  target_market:
    "GYEON Japan authorized dealers, distributors, and franchise partners. " +
    "Office AZ Group internal operations. Attraction Co., Ltd. business units.",
  plan_ids:      ["free", "basic", "pro", "pro_plus", "enterprise"],
  billing_cycles: ["manual", "enterprise_contract"],
  status:        "planned",
  application_ids: [
    "dealer_agent",
    "distribution",
    "warehouse",
    "crm",
    "accounting",
    "ai_center",
    "communication_center",
  ] satisfies ApplicationEntitlementId[],
  spec_document: "docs/master_specification/GYEON_BUSINESS_HUB_BRANDING_SPEC.md",
};

// ─── Detailer Agent ───────────────────────────────────────────────────────────

const DETAILER_AGENT_FAMILY: ProductFamilyDescriptor = {
  family_id:     "detailer_agent",
  display_name:  "Detailer Agent",
  description:
    "Generic multi-brand detailing shop management SaaS. " +
    "Purpose-built for professional automotive detailing businesses of any brand affiliation. " +
    "Four AI-based pricing tiers: Starter, Professional, Business AI, Enterprise AI. " +
    "Designed to operate independently of GYEON branding; " +
    "the GYEON-specific Dealer Agent is powered by the Detailer Agent platform.",
  target_market:
    "Professional automotive detailing shops worldwide. " +
    "Independent detailers, multi-location shop owners, detailing franchise operators. " +
    "Any shop using professional-grade coating products — not limited to GYEON.",
  plan_ids:      ["starter", "professional", "business_ai", "enterprise_ai"],
  billing_cycles: ["monthly", "annual", "enterprise_contract"],
  status:        "planned",
  application_ids: [
    "dealer_agent",
    "communication_center",
    "ai_center",
    "crm",
    "distribution",
    "warehouse",
    "accounting",
  ] satisfies ApplicationEntitlementId[],
  spec_document: null,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PRODUCT_FAMILY_REGISTRY: ProductFamilyDescriptor[] = [
  GYEON_BUSINESS_HUB_FAMILY,
  DETAILER_AGENT_FAMILY,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getProductFamily(
  family_id: ProductFamilyId,
): ProductFamilyDescriptor | undefined {
  return PRODUCT_FAMILY_REGISTRY.find((f) => f.family_id === family_id);
}

export function getActiveProductFamilies(): ProductFamilyDescriptor[] {
  return PRODUCT_FAMILY_REGISTRY.filter((f) => f.status === "active");
}

export function getPlannedProductFamilies(): ProductFamilyDescriptor[] {
  return PRODUCT_FAMILY_REGISTRY.filter((f) => f.status === "planned");
}
