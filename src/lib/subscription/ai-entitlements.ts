// GYEON Business Hub — Subscription & Billing Center: AI Entitlements (Sprint 11Y)
//
// Defines the 10 AI entitlement levels used to differentiate subscription plans.
// Each entitlement level represents a capability tier — higher levels include lower ones.
//
// These entitlements are DECLARATIONS ONLY — no AI execution, no provider calls.
// Runtime enforcement happens through the AI Gateway (src/lib/ai/).
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AIEntitlementDescriptor,
  AIEntitlementId,
} from "./subscription-center-types";

// ─── AI entitlement registry ──────────────────────────────────────────────────

const AI_ENTITLEMENT_LIST: AIEntitlementDescriptor[] = [
  {
    entitlement_id:   "no_ai",
    display_name:     "No AI",
    description:      "AI features are not included. All operations are manual.",
    included_features: [],
    available_from_detailer: "starter",
    available_from_gyeon:    "free",
  },
  {
    entitlement_id:   "basic_ai",
    display_name:     "Basic AI",
    description:      "Entry-level AI assistance for common text tasks. " +
                      "Includes spell check, grammar suggestions, and simple auto-complete for estimate descriptions and notes.",
    included_features: [
      "Spell check and grammar correction",
      "Text auto-complete for estimates and notes",
      "Basic AI assistant for internal staff use",
    ],
    available_from_detailer: "professional",
    available_from_gyeon:    "pro",
  },
  {
    entitlement_id:   "ocr_ai",
    display_name:     "OCR AI",
    description:      "Optical character recognition for vehicle registration documents and license plates. " +
                      "Reduces manual entry errors and speeds up vehicle intake.",
    included_features: [
      "Vehicle registration document OCR",
      "License plate recognition",
      "Auto-fill vehicle fields from scanned document",
    ],
    available_from_detailer: "professional",
    available_from_gyeon:    "pro",
  },
  {
    entitlement_id:   "marketing_ai",
    display_name:     "Marketing AI",
    description:      "AI-generated marketing content including SNS captions, hashtag suggestions, " +
                      "and metadata generation for SEO, MEO, AEO, LLMO, and AIO optimization.",
    included_features: [
      "SNS caption generation (Instagram, X, LINE)",
      "Hashtag strategy suggestions",
      "SEO metadata generation (title, description, keywords)",
      "MEO optimization for Google Business Profile",
      "AEO (Answer Engine Optimization) content structuring",
      "LLMO (Large Language Model Optimization) content signals",
      "AIO (AI Overview) content preparation",
    ],
    available_from_detailer: "business_ai",
    available_from_gyeon:    "pro_plus",
  },
  {
    entitlement_id:   "communication_ai",
    display_name:     "Communication AI",
    description:      "AI-assisted customer communication including reply generation, tone adjustment, " +
                      "and translation. All AI communication requires customer ai_communication_permission consent.",
    included_features: [
      "AI reply generation for customer messages (staff review required)",
      "AI tone adjustment for outbound drafts",
      "AI message translation (inbound and outbound)",
      "AI-drafted maintenance reminders",
    ],
    available_from_detailer: "professional",
    available_from_gyeon:    "pro",
  },
  {
    entitlement_id:   "video_ai",
    display_name:     "Video AI",
    description:      "AI video generation for before/after showcase content and social media marketing. " +
                      "Generate short-form videos from photo sets.",
    included_features: [
      "Before/after video generation from photo sequences",
      "Social media short-form video creation",
      "AI voiceover and background music selection",
    ],
    available_from_detailer: "business_ai",
    available_from_gyeon:    "pro_plus",
  },
  {
    entitlement_id:   "growth_ai",
    display_name:     "Growth AI",
    description:      "AI-powered business intelligence and growth insights. " +
                      "Revenue trend analysis, customer retention scoring, and AI-driven recommendations " +
                      "for business growth.",
    included_features: [
      "Revenue trend analysis and forecasting",
      "Customer retention risk scoring",
      "Maintenance cycle opportunity identification",
      "AI growth recommendations dashboard",
      "Review performance analysis and response strategy",
      "Peak period prediction and scheduling optimization",
    ],
    available_from_detailer: "business_ai",
    available_from_gyeon:    "pro_plus",
  },
  {
    entitlement_id:   "marketplace_ai",
    display_name:     "AI Marketplace",
    description:      "Full access to the AI Marketplace: a curated catalog of AI capabilities " +
                      "that dealers can activate, configure, and use without managing AI infrastructure directly.",
    included_features: [
      "AI Marketplace catalog access",
      "One-click AI capability activation",
      "Pre-built AI agents for detailing workflows",
      "AI review request automation",
      "AI follow-up sequence builder",
      "AI social media scheduler integration",
      "Usage analytics per AI capability",
    ],
    available_from_detailer: "business_ai",
    available_from_gyeon:    "pro_plus",
  },
  {
    entitlement_id:   "dealer_owned_provider",
    display_name:     "Dealer-Owned AI Provider",
    description:      "Dealers bring their own AI provider credentials (OpenAI, Anthropic, Google Gemini, etc.). " +
                      "Select the AI model per capability. AI costs billed directly to the dealer's provider account. " +
                      "Budget limits and usage policies configurable by dealer.",
    included_features: [
      "Custom AI provider key configuration (OpenAI, Anthropic, Google Gemini)",
      "Per-capability model selection",
      "AI usage budget limits",
      "Per-dealer cost tracking (separate from platform AI costs)",
      "Provider failover configuration",
      "Capability-level provider routing",
    ],
    available_from_detailer: "enterprise_ai",
    available_from_gyeon:    "enterprise",
  },
  {
    entitlement_id:   "enterprise_ai",
    display_name:     "Enterprise AI",
    description:      "Full AI platform access including all AI Marketplace capabilities, " +
                      "dealer-owned provider configuration, advanced budget controls, " +
                      "enterprise usage policies, and dedicated AI support.",
    included_features: [
      "All AI Marketplace capabilities",
      "Dealer-owned provider configuration",
      "Enterprise budget controls and usage policies",
      "AI usage audit logs",
      "Priority AI support",
      "Advanced AI analytics and ROI reporting",
      "Custom AI capability integration (via API)",
    ],
    available_from_detailer: "enterprise_ai",
    available_from_gyeon:    "enterprise",
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AI_ENTITLEMENT_REGISTRY: AIEntitlementDescriptor[] = AI_ENTITLEMENT_LIST;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getAIEntitlement(
  entitlement_id: AIEntitlementId,
): AIEntitlementDescriptor | undefined {
  return AI_ENTITLEMENT_REGISTRY.find((e) => e.entitlement_id === entitlement_id);
}

export function getAIEntitlementsForDetailerTier(
  tier_id: import("./subscription-center-types").DetailerAgentTierId,
): AIEntitlementDescriptor[] {
  const tierOrder: Record<import("./subscription-center-types").DetailerAgentTierId, number> = {
    starter:       1,
    professional:  2,
    business_ai:   3,
    enterprise_ai: 4,
  };
  return AI_ENTITLEMENT_REGISTRY.filter(
    (e) =>
      e.available_from_detailer !== null &&
      tierOrder[e.available_from_detailer] <= tierOrder[tier_id],
  );
}

export function getAIEntitlementsForGyeonPlan(
  plan_id: import("./subscription-center-types").GyeonHubPlanId,
): AIEntitlementDescriptor[] {
  const planOrder: Record<import("./subscription-center-types").GyeonHubPlanId, number> = {
    free:       0,
    basic:      1,
    pro:        2,
    pro_plus:   3,
    enterprise: 4,
  };
  return AI_ENTITLEMENT_REGISTRY.filter(
    (e) =>
      e.available_from_gyeon !== null &&
      planOrder[e.available_from_gyeon] <= planOrder[plan_id],
  );
}
