// GYEON Business Hub — Subscription & Billing Center: Detailer Agent Pricing Tiers (Sprint 11Y)
//
// Four AI-based pricing tiers for the Detailer Agent product family.
//
// Tier strategy:
//   Starter      — Operational foundation. No AI. For new or small shops.
//   Professional — Operational + communication + entry AI. Established shops.
//   Business AI  — Full AI marketing, growth, and marketplace. Growth-stage shops.
//   Enterprise AI — Full platform, dealer-owned AI, multi-channel, future apps.
//
// IMPORTANT: No prices are hardcoded. Price references are documented as
// "example_only" and must not be used for billing. Actual pricing requires
// business approval and should come from a database or CMS.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  SubscriptionPlanDescriptor,
  DetailerAgentTierId,
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

// ─── Tier 1 — Starter ─────────────────────────────────────────────────────────
//
// Purpose: Basic shop management. Estimate flow, customer and vehicle records, PDF.
// AI: None.
// Target: New shops, solo operators, budget-conscious.

const TIER_STARTER: SubscriptionPlanDescriptor = {
  plan_id:       "starter",
  display_name:  "Starter",
  family_id:     "detailer_agent",
  tier_position: 1,
  status:        "planned",
  billing_cycles: ["monthly", "annual"],
  price_reference: "example_only",
  ai_entitlements: ["no_ai"] satisfies AIEntitlementId[],
  application_entitlements: appEntitlements(
    ["dealer_agent"],
    [],
  ),
  feature_highlights: [
    "Customer management",
    "Vehicle management",
    "Estimate creation",
    "PDF estimate generation",
    "Product catalog",
    "Product orders",
    "Staff management (up to 3 staff)",
    "Basic dashboard",
  ],
  target_customer: "Solo detailers and new shops just getting started with digital shop management.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Tier 2 — Professional ────────────────────────────────────────────────────
//
// Purpose: Full operational management for established shops.
// AI: Basic AI (spell check, text suggestions), OCR (vehicle registration),
//     Communication AI (LINE messaging, AI reply drafts).
// Target: Established shops with multiple staff.

const TIER_PROFESSIONAL: SubscriptionPlanDescriptor = {
  plan_id:       "professional",
  display_name:  "Professional",
  family_id:     "detailer_agent",
  tier_position: 2,
  status:        "planned",
  billing_cycles: ["monthly", "annual"],
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
    "All Starter features",
    "Work order management",
    "Calendar and reservations",
    "Completion reports",
    "Invoicing and payments",
    "Maintenance reminders",
    "LINE messaging integration",
    "Communication Center (LINE, Email, SMS)",
    "Basic AI (spell check, text auto-complete)",
    "OCR for vehicle registration documents",
    "AI reply drafts for customer messages (staff review required)",
    "Unlimited staff",
  ],
  target_customer:
    "Established detailing shops running full operational workflows with customer communication.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Tier 3 — Business AI ─────────────────────────────────────────────────────
//
// Purpose: AI marketing, growth automation, and AI Marketplace access.
// AI: Marketing AI (SNS, SEO/MEO/AEO/LLMO/AIO), Video AI, Growth AI,
//     AI Marketplace, Communication AI (full).
// Target: Growth-oriented shops, multi-location operators.

const TIER_BUSINESS_AI: SubscriptionPlanDescriptor = {
  plan_id:       "business_ai",
  display_name:  "Business AI",
  family_id:     "detailer_agent",
  tier_position: 3,
  status:        "planned",
  billing_cycles: ["monthly", "annual"],
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
    "All Professional features",
    "SNS caption generation (Instagram, X, LINE)",
    "SEO / MEO / AEO / LLMO / AIO metadata generation",
    "AI review request automation",
    "AI follow-up sequence builder",
    "AI social media scheduler",
    "Before/after video generation",
    "AI growth insights and revenue forecasting",
    "Customer retention risk scoring",
    "AI Marketplace access",
    "CRM (future — planned for this tier)",
    "Advanced analytics dashboard",
  ],
  target_customer:
    "Growth-stage shops leveraging AI for marketing, customer retention, and operational efficiency.",
  requires_sales_approval: false,
  spec_document: null,
};

// ─── Tier 4 — Enterprise AI ───────────────────────────────────────────────────
//
// Purpose: Full platform access, dealer-owned AI provider, advanced automation.
// AI: All entitlements including dealer_owned_provider and enterprise_ai.
//     Dealer sets their own OpenAI/Anthropic/Gemini keys.
//     Budget policies and usage controls per capability.
// Target: Large shops, franchise networks, enterprise dealers.

const TIER_ENTERPRISE_AI: SubscriptionPlanDescriptor = {
  plan_id:       "enterprise_ai",
  display_name:  "Enterprise AI",
  family_id:     "detailer_agent",
  tier_position: 4,
  status:        "planned",
  billing_cycles: ["monthly", "annual", "enterprise_contract"],
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
    "All Business AI features",
    "Dealer-owned AI provider configuration (OpenAI, Anthropic, Google Gemini)",
    "Per-capability AI model selection",
    "AI usage budget limits and controls",
    "Provider failover configuration",
    "Multi-channel communication (WhatsApp, Instagram, X — future)",
    "Communication Center full feature set",
    "CRM advanced features",
    "Distribution (future)",
    "Warehouse (future)",
    "Accounting (future)",
    "Enterprise AI usage audit logs",
    "Priority support",
    "Custom AI capability integration (via API)",
  ],
  target_customer:
    "Large shops, franchise networks, and enterprise dealers requiring full platform control " +
    "and the ability to own their AI infrastructure.",
  requires_sales_approval: true,
  spec_document: null,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const DETAILER_AGENT_PLAN_REGISTRY: SubscriptionPlanDescriptor[] = [
  TIER_STARTER,
  TIER_PROFESSIONAL,
  TIER_BUSINESS_AI,
  TIER_ENTERPRISE_AI,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getDetailerAgentPlan(
  tier_id: DetailerAgentTierId,
): SubscriptionPlanDescriptor | undefined {
  return DETAILER_AGENT_PLAN_REGISTRY.find((p) => p.plan_id === tier_id);
}

export function getDetailerAgentTierOrder(): DetailerAgentTierId[] {
  return ["starter", "professional", "business_ai", "enterprise_ai"];
}

export function isDetailerAgentUpgradeRequired(
  current_tier: DetailerAgentTierId,
  required_tier: DetailerAgentTierId,
): boolean {
  const order = getDetailerAgentTierOrder();
  return order.indexOf(current_tier) < order.indexOf(required_tier);
}
