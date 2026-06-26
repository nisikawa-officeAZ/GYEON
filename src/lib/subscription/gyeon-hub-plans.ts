// GYEON Business Hub — Subscription & Billing Center: GYEON Hub Plan Model (Sprint 11Y)
//
// Five plan tiers for the GYEON Business Hub product family.
// Kept entirely separate from Detailer Agent pricing.
//
// GYEON Hub is deployed for Office AZ Group, Attraction Co., Ltd., and the
// GYEON Japan franchise network. Pricing is manual/invoice-based.
//
// IMPORTANT: No prices are hardcoded. Plan tiers are for entitlement modelling only.
// Actual pricing is negotiated per contract and stored separately.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  SubscriptionPlanDescriptor,
  GyeonHubPlanId,
  ApplicationEntitlementId,
  AIEntitlementId,
  EntitlementStatus,
} from "./subscription-center-types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function appEntitlements(
  included: ApplicationEntitlementId[],
  addon:    ApplicationEntitlementId[],
): Record<ApplicationEntitlementId, EntitlementStatus> {
  const all: ApplicationEntitlementId[] = [
    "dealer_agent",
    "communication_center",
    "ai_center",
    "crm",
    "distribution",
    "warehouse",
    "accounting",
  ];
  return Object.fromEntries(
    all.map((id) => [
      id,
      included.includes(id)
        ? ("included" as const)
        : addon.includes(id)
          ? ("addon" as const)
          : ("not_available" as const),
    ]),
  ) as Record<ApplicationEntitlementId, EntitlementStatus>;
}

// ─── Free ─────────────────────────────────────────────────────────────────────

const GYEON_FREE: SubscriptionPlanDescriptor = {
  plan_id:       "free",
  display_name:  "Free",
  family_id:     "gyeon_business_hub",
  tier_position: 0,
  status:        "planned",
  billing_cycles: ["manual"],
  price_reference: "example_only",
  ai_entitlements: ["no_ai"] satisfies AIEntitlementId[],
  application_entitlements: appEntitlements([], []),
  feature_highlights: [
    "GYEON Business Hub account registration",
    "Read-only dashboard access",
    "Product catalog browsing",
    "GYEON Japan support portal access",
  ],
  target_customer:
    "New registrations and demo accounts. No operational access — upgrade required for shop management.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Basic ────────────────────────────────────────────────────────────────────

const GYEON_BASIC: SubscriptionPlanDescriptor = {
  plan_id:       "basic",
  display_name:  "Basic",
  family_id:     "gyeon_business_hub",
  tier_position: 1,
  status:        "planned",
  billing_cycles: ["manual"],
  price_reference: "example_only",
  ai_entitlements: ["no_ai"] satisfies AIEntitlementId[],
  application_entitlements: appEntitlements(
    ["dealer_agent"],
    [],
  ),
  feature_highlights: [
    "GYEON Dealer Agent (basic tier features)",
    "Customer and vehicle management",
    "Estimate creation and PDF generation",
    "GYEON product catalog",
    "Product orders",
    "Basic staff management",
  ],
  target_customer:
    "GYEON authorized dealers requiring core shop management without AI or communication features.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Pro ──────────────────────────────────────────────────────────────────────

const GYEON_PRO: SubscriptionPlanDescriptor = {
  plan_id:       "pro",
  display_name:  "Pro",
  family_id:     "gyeon_business_hub",
  tier_position: 2,
  status:        "planned",
  billing_cycles: ["manual"],
  price_reference: "example_only",
  ai_entitlements: [
    "no_ai",
    "basic_ai",
    "ocr_ai",
    "communication_ai",
  ] satisfies AIEntitlementId[],
  application_entitlements: appEntitlements(
    ["dealer_agent", "communication_center"],
    [],
  ),
  feature_highlights: [
    "All Basic features",
    "GYEON Dealer Agent (Pro tier — work orders, invoicing, maintenance)",
    "Communication Center (LINE, Email, SMS)",
    "LINE messaging integration",
    "Basic AI (text suggestions, OCR)",
    "AI-assisted customer communication",
    "Maintenance reminder automation",
  ],
  target_customer:
    "Established GYEON authorized dealers running full operational workflows with LINE communication.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Pro+ ─────────────────────────────────────────────────────────────────────

const GYEON_PRO_PLUS: SubscriptionPlanDescriptor = {
  plan_id:       "pro_plus",
  display_name:  "Pro+",
  family_id:     "gyeon_business_hub",
  tier_position: 3,
  status:        "planned",
  billing_cycles: ["manual"],
  price_reference: "example_only",
  ai_entitlements: [
    "no_ai",
    "basic_ai",
    "ocr_ai",
    "marketing_ai",
    "communication_ai",
    "video_ai",
    "growth_ai",
    "marketplace_ai",
  ] satisfies AIEntitlementId[],
  application_entitlements: appEntitlements(
    ["dealer_agent", "communication_center", "ai_center", "crm"],
    [],
  ),
  feature_highlights: [
    "All Pro features",
    "GYEON AI Center (AI Marketplace)",
    "SNS caption and hashtag generation for GYEON content",
    "SEO / MEO / AEO / LLMO / AIO metadata for GYEON shop profiles",
    "AI review request automation",
    "AI growth insights and customer retention scoring",
    "Before/after video generation for GYEON showcase content",
    "CRM (planned)",
    "Advanced analytics",
  ],
  target_customer:
    "GYEON flagship dealers and multi-location operators leveraging AI for marketing and growth.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Enterprise ───────────────────────────────────────────────────────────────

const GYEON_ENTERPRISE: SubscriptionPlanDescriptor = {
  plan_id:       "enterprise",
  display_name:  "Enterprise",
  family_id:     "gyeon_business_hub",
  tier_position: 4,
  status:        "planned",
  billing_cycles: ["manual", "enterprise_contract"],
  price_reference: "contact_sales",
  ai_entitlements: [
    "no_ai",
    "basic_ai",
    "ocr_ai",
    "marketing_ai",
    "communication_ai",
    "video_ai",
    "growth_ai",
    "marketplace_ai",
    "dealer_owned_provider",
    "enterprise_ai",
  ] satisfies AIEntitlementId[],
  application_entitlements: appEntitlements(
    ["dealer_agent", "communication_center", "ai_center", "crm"],
    ["distribution", "warehouse", "accounting"],
  ),
  feature_highlights: [
    "All Pro+ features",
    "GYEON Distribution (B2B product distribution — planned)",
    "GYEON Warehouse (inventory management — planned)",
    "GYEON Accounting (financial management — planned)",
    "Dealer-owned AI provider configuration",
    "AI usage budget controls",
    "Multi-channel communication (WhatsApp, Instagram, X — future)",
    "Enterprise usage audit logs",
    "Dedicated account manager",
    "Custom integrations via API",
  ],
  target_customer:
    "Office AZ Group, Attraction Co., Ltd., and large GYEON franchise networks requiring the full platform suite.",
  requires_sales_approval: true,
  spec_document: null,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const GYEON_HUB_PLAN_REGISTRY: SubscriptionPlanDescriptor[] = [
  GYEON_FREE,
  GYEON_BASIC,
  GYEON_PRO,
  GYEON_PRO_PLUS,
  GYEON_ENTERPRISE,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getGyeonHubPlan(
  plan_id: GyeonHubPlanId,
): SubscriptionPlanDescriptor | undefined {
  return GYEON_HUB_PLAN_REGISTRY.find((p) => p.plan_id === plan_id);
}

export function getGyeonHubPlanOrder(): GyeonHubPlanId[] {
  return ["free", "basic", "pro", "pro_plus", "enterprise"];
}

export function isGyeonHubUpgradeRequired(
  current_plan: GyeonHubPlanId,
  required_plan: GyeonHubPlanId,
): boolean {
  const order = getGyeonHubPlanOrder();
  return order.indexOf(current_plan) < order.indexOf(required_plan);
}
