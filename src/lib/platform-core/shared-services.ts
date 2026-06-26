// DealerOS — Platform Core: Shared Services Registry (Sprint 11T Phase C)
//
// Module manifests for all 10 shared platform services.
// Each manifest declares what the module provides, its status,
// its source path, and which applications consume it.
//
// Shared services are the only cross-application communication channel.
// Applications must never import directly from each other's source trees.
//
// Service status summary:
//   Active (3):   authentication, authorization, pdf
//   Planned (7):  ai_gateway, ai_marketplace, ocr, line, media, notification, analytics
//
// Note: "planned" here reflects adapter/activation status, not code existence.
// Authentication, AI Gateway, OCR, LINE, and Media code is already written
// in the Dealer Agent context. "planned" indicates they are not yet production-
// activated or fully available to all platform applications.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  ModuleManifest,
  PlatformApplicationId,
  PlatformCapability,
  PlatformModuleId,
} from "./platform-types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function cap(
  capability_id:          string,
  display_name:           string,
  description:            string,
  module:                 PlatformModuleId,
  status:                 PlatformCapability["status"],
  implementation_sprint:  string,
  consuming_applications: PlatformApplicationId[],
): PlatformCapability {
  return {
    capability_id,
    display_name,
    description,
    module,
    status,
    implementation_sprint,
    consuming_applications,
  };
}

// ─── Authentication module ────────────────────────────────────────────────────

const AUTHENTICATION_MANIFEST: ModuleManifest = {
  module_id:    "authentication",
  display_name: "Authentication",
  description:  "Supabase Auth — shared identity provider for all platform applications. Handles sign-in, session management, and JWT token issuance.",
  status:       "active",
  version:      "1.0.0",
  source_path:  "supabase/",
  capabilities: [
    cap("auth.session",       "Session Management",    "Server-side session via Supabase Auth cookies",     "authentication", "active",  "Sprint 1", ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm"]),
    cap("auth.invite",        "Invite-Based Onboarding","Secure email invite flow for new users",           "authentication", "active",  "Sprint 1", ["dealer_agent", "enterprise_distribution"]),
    cap("auth.mfa",           "Multi-Factor Auth",     "TOTP and email-based MFA via Supabase",             "authentication", "planned", "Sprint 12+", ["enterprise_distribution", "accounting"]),
    cap("auth.sso",           "Enterprise SSO",        "SAML 2.0 / Azure AD for enterprise deployments",   "authentication", "planned", "Sprint 12+", ["enterprise_distribution", "accounting", "crm"]),
  ],
  dependencies: [],
  consuming_applications: ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm"],
  spec_document:          "02_SYSTEM_ARCHITECTURE.md",
  implementation_sprint:  "Sprint 1",
};

// ─── Authorization module ─────────────────────────────────────────────────────

const AUTHORIZATION_MANIFEST: ModuleManifest = {
  module_id:    "authorization",
  display_name: "Authorization",
  description:  "Row-Level Security (RLS) policies + plan-based feature gates. Ensures each tenant can only access their own data. Feature gates enforce subscription plan requirements.",
  status:       "active",
  version:      "1.0.0",
  source_path:  "plans/",
  capabilities: [
    cap("authz.rls",          "Row-Level Security",    "PostgreSQL RLS isolates tenant data server-side",   "authorization", "active",  "Sprint 1",  ["dealer_agent"]),
    cap("authz.feature_gate", "Feature Gates",         "Plan-based feature access control (basic/pro/pro+)","authorization", "active",  "Sprint 1",  ["dealer_agent"]),
    cap("authz.role_check",   "Role-Based Access",     "Staff role validation (owner/manager/staff)",       "authorization", "active",  "Sprint 1",  ["dealer_agent"]),
    cap("authz.multi_tenant", "Multi-Tenant Isolation","Per-company data isolation via company_id RLS",     "authorization", "planned", "Sprint 12+", ["enterprise_distribution", "warehouse", "accounting", "crm"]),
  ],
  dependencies: [
    { module_id: "authentication", dependency_type: "required", reason: "Authorization requires an authenticated session" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm"],
  spec_document:          "02_SYSTEM_ARCHITECTURE.md",
  implementation_sprint:  "Sprint 1",
};

// ─── AI Gateway module ────────────────────────────────────────────────────────

const AI_GATEWAY_MANIFEST: ModuleManifest = {
  module_id:    "ai_gateway",
  display_name: "AI Gateway",
  description:  "Provider-agnostic AI routing layer. Dealer-owned API keys (AES-256-GCM encrypted). Supports OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI, and OpenRouter. No Office AZ inference costs for dealer features.",
  status:       "planned",
  version:      "1.1.0-persisted",
  source_path:  "ai/",
  capabilities: [
    cap("ai.key_storage",     "Encrypted Key Storage", "AES-256-GCM encrypted provider API keys",          "ai_gateway", "active",  "Sprint 10C", ["dealer_agent"]),
    cap("ai.settings",        "AI Settings Platform",  "Per-dealer provider selection and budget policies", "ai_gateway", "active",  "Sprint 11R", ["dealer_agent"]),
    cap("ai.provider_adapters","Provider Adapters",    "5-provider adapter registry (all adapters planned)","ai_gateway", "planned", "Sprint 11O+", ["dealer_agent"]),
    cap("ai.execution_guard", "Execution Guard",       "13-check pre-execution safety guard",               "ai_gateway", "active",  "Sprint 11M", ["dealer_agent"]),
    cap("ai.usage_tracking",  "Usage Tracking",        "Per-dealer AI spend tracking (requires migration 073)","ai_gateway","planned","Sprint 11R+",["dealer_agent"]),
    cap("ai.budget_enforcement","Budget Enforcement",  "Monthly spend limits with hard/soft stop",          "ai_gateway", "planned", "Sprint 11R+", ["dealer_agent"]),
    cap("ai.edp_gateway",     "EDP AI Gateway",        "AI gateway instance for Enterprise Distribution",   "ai_gateway", "planned", "Sprint 12+", ["enterprise_distribution"]),
  ],
  dependencies: [
    { module_id: "authentication", dependency_type: "required", reason: "dealer_id always from getCurrentDealer()" },
    { module_id: "authorization",  dependency_type: "required", reason: "Pro+ feature gate required" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution"],
  spec_document:          "AI_GATEWAY_SPEC.md",
  implementation_sprint:  "Sprint 10C",
};

// ─── AI Marketplace module ────────────────────────────────────────────────────

const AI_MARKETPLACE_MANIFEST: ModuleManifest = {
  module_id:    "ai_marketplace",
  display_name: "AI Marketplace",
  description:  "Capability marketplace for per-capability AI provider selection. 19 capabilities, 11 providers (5 gateway + 6 extension), recommendation engine with 4 modes, AI Settings bridge.",
  status:       "planned",
  version:      "1.0.0",
  source_path:  "ai-marketplace/",
  capabilities: [
    cap("marketplace.catalog",       "Capability Catalog",     "19-capability catalog with 14 categories",    "ai_marketplace", "active",  "Sprint 11S", ["dealer_agent"]),
    cap("marketplace.profiles",      "Provider Profiles",      "11 provider profiles (5 gateway + 6 extension)","ai_marketplace","active","Sprint 11S", ["dealer_agent"]),
    cap("marketplace.recommendations","Recommendations",       "4-mode recommendation engine (75 benchmarks)","ai_marketplace", "active",  "Sprint 11S", ["dealer_agent"]),
    cap("marketplace.routing",       "Capability Routing",     "Per-capability provider routing with bridge", "ai_marketplace", "active",  "Sprint 11S", ["dealer_agent"]),
    cap("marketplace.ui",            "Marketplace UI",         "Dealer-facing capability selector UI",        "ai_marketplace", "planned", "Sprint 11T+", ["dealer_agent"]),
    cap("marketplace.edp",           "EDP Marketplace",        "AI capability routing for EDP AI modules",    "ai_marketplace", "planned", "Sprint 12+", ["enterprise_distribution"]),
  ],
  dependencies: [
    { module_id: "ai_gateway", dependency_type: "required", reason: "Marketplace routes to gateway providers" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution"],
  spec_document:          "AI_MARKETPLACE_SPEC.md",
  implementation_sprint:  "Sprint 11S",
};

// ─── OCR module ───────────────────────────────────────────────────────────────

const OCR_MANIFEST: ModuleManifest = {
  module_id:    "ocr",
  display_name: "OCR",
  description:  "Optical character recognition for structured document parsing. Initial use case: Japanese vehicle registration (車検証) field extraction for estimate pre-fill. Requires human review for all extracted data.",
  status:       "planned",
  version:      "1.0.0",
  source_path:  "ocr/",
  capabilities: [
    cap("ocr.vehicle_registration", "Vehicle Registration OCR", "車検証 field extraction for estimate pre-fill", "ocr", "planned", "Phase B (env provisioning)", ["dealer_agent"]),
    cap("ocr.document",             "General Document OCR",     "General structured document parsing",          "ocr", "planned", "Sprint 12+", ["dealer_agent", "enterprise_distribution"]),
    cap("ocr.invoice",              "Invoice OCR",              "Supplier invoice field extraction for EDP",    "ocr", "planned", "Sprint 12+", ["enterprise_distribution", "accounting"]),
  ],
  dependencies: [
    { module_id: "ai_gateway",      dependency_type: "required", reason: "OCR routes through AI provider (gpt-4o vision)" },
    { module_id: "authentication",  dependency_type: "required", reason: "dealer_id required for key routing" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution", "accounting"],
  spec_document:          "06_OCR_REQUIREMENTS.md",
  implementation_sprint:  "Sprint 10C (code complete; activation pending env)",
};

// ─── LINE module ──────────────────────────────────────────────────────────────

const LINE_MANIFEST: ModuleManifest = {
  module_id:    "line",
  display_name: "LINE",
  description:  "LINE / LIFF integration for customer messaging, automation workflows, and Rich Menu management. Dealer configures their own LINE Business account credentials.",
  status:       "planned",
  version:      "1.0.0",
  source_path:  "line/",
  capabilities: [
    cap("line.liff",           "LIFF Integration",       "LINE Front-end Framework app (booking, reviews)",  "line", "planned", "Phase B",     ["dealer_agent"]),
    cap("line.push",           "Push Messages",          "Dealer-triggered LINE push notifications",         "line", "planned", "Phase B",     ["dealer_agent"]),
    cap("line.webhook",        "Webhook Receiver",       "Inbound LINE message and event handling",          "line", "planned", "Phase B",     ["dealer_agent"]),
    cap("line.automation",     "Automation Workflows",   "10 pre-built automation workflows",                "line", "planned", "Sprint 11G",  ["dealer_agent"]),
    cap("line.rich_menu",      "Rich Menu Management",   "6-button Rich Menu layout management (Pro+)",      "line", "active",   "Sprint 9",    ["dealer_agent"]),
    cap("line.review_request", "Review Requests",        "Compliant LINE review request after job completion","line","planned", "Sprint 11F",  ["dealer_agent"]),
    cap("line.edp_statements", "EDP Statement Delivery", "Future: monthly statement delivery via LINE",      "line", "planned", "Sprint 12+",  ["enterprise_distribution"]),
  ],
  dependencies: [
    { module_id: "authentication",  dependency_type: "required", reason: "LINE secrets never returned to client; dealer session required" },
    { module_id: "notification",    dependency_type: "optional", reason: "Notification module orchestrates LINE and email dispatch" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution"],
  spec_document:          "07_LINE_REQUIREMENTS.md",
  implementation_sprint:  "Sprint 9+ (Rich Menu active; LIFF pending Phase B)",
};

// ─── Media module ─────────────────────────────────────────────────────────────

const MEDIA_MANIFEST: ModuleManifest = {
  module_id:    "media",
  display_name: "Media",
  description:  "Media asset management for images and video. Manages lifecycle, privacy consent, retention policy, and AI-ready asset packaging. Foundation for AI Marketing content pipeline.",
  status:       "planned",
  version:      "1.0.0",
  source_path:  "media/",
  capabilities: [
    cap("media.images",         "Image Management",      "Before/after photo management with consent",       "media", "planned", "Sprint 10I+", ["dealer_agent"]),
    cap("media.video",          "Video Assets",          "Marketing video storage and lifecycle management", "media", "planned", "Sprint 10I+", ["dealer_agent"]),
    cap("media.privacy",        "Privacy / Blur",        "Server-side blur for faces and license plates",    "media", "planned", "Sprint 11A",  ["dealer_agent"]),
    cap("media.ai_packaging",   "AI Media Packaging",    "MediaForAI type for safe AI agent consumption",    "media", "planned", "Sprint 10J+", ["dealer_agent"]),
    cap("media.retention",      "Retention Policy",      "Configurable video/image retention (7/30/90 day)", "media", "planned", "Sprint 10K",  ["dealer_agent"]),
    cap("media.edp_products",   "EDP Product Media",     "Product images for EDP catalog",                  "media", "planned", "Sprint 12+",  ["enterprise_distribution"]),
  ],
  dependencies: [
    { module_id: "authentication", dependency_type: "required", reason: "Media is always dealer-scoped" },
    { module_id: "authorization",  dependency_type: "required", reason: "Consent and visibility rules require authorization" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution"],
  spec_document:          "MEDIA_PLATFORM_SPEC.md",
  implementation_sprint:  "Sprint 10I (foundation); Sprint 10L (platform)",
};

// ─── Notification module ──────────────────────────────────────────────────────

const NOTIFICATION_MANIFEST: ModuleManifest = {
  module_id:    "notification",
  display_name: "Notification",
  description:  "Multi-channel notification dispatch. Orchestrates email and LINE push delivery. Used for maintenance reminders, review requests, order confirmations, and statement delivery.",
  status:       "planned",
  version:      "0.1.0",
  source_path:  "notifications/",
  capabilities: [
    cap("notification.email",      "Email Notification",    "Transactional email dispatch (Resend / SMTP)",    "notification", "planned", "Phase B",    ["dealer_agent", "enterprise_distribution", "accounting"]),
    cap("notification.line_push",  "LINE Push Dispatch",    "LINE push message dispatch orchestration",        "notification", "planned", "Phase B",    ["dealer_agent", "enterprise_distribution"]),
    cap("notification.template",   "Message Templates",     "Reusable notification templates per channel",     "notification", "planned", "Sprint 12+", ["dealer_agent", "enterprise_distribution"]),
    cap("notification.scheduler",  "Scheduled Delivery",    "Cron-based scheduled notification dispatch",      "notification", "planned", "Sprint 12+", ["dealer_agent", "enterprise_distribution"]),
  ],
  dependencies: [
    { module_id: "authentication", dependency_type: "required", reason: "Notification targets are always scoped to an authenticated entity" },
    { module_id: "line",           dependency_type: "optional", reason: "LINE push requires LINE module active" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution", "accounting"],
  spec_document:          null,
  implementation_sprint:  "Phase B (partial — maintenance reminders active)",
};

// ─── PDF module ───────────────────────────────────────────────────────────────

const PDF_MANIFEST: ModuleManifest = {
  module_id:    "pdf",
  display_name: "PDF",
  description:  "Server-side PDF generation via @react-pdf/renderer. Produces estimates, invoices, work order completion reports, and delivery notes. Active for Dealer Agent; planned for EDP.",
  status:       "active",
  version:      "1.0.0",
  source_path:  "pdf/",
  capabilities: [
    cap("pdf.estimate",        "Estimate PDF",           "Quote PDF generation for dealer customers",         "pdf", "active",  "Sprint 1",   ["dealer_agent"]),
    cap("pdf.invoice",         "Invoice PDF",            "Invoice PDF for dealer work order completion",      "pdf", "active",  "Sprint 1",   ["dealer_agent"]),
    cap("pdf.completion_report","Completion Report PDF", "Work order completion report with photos",          "pdf", "active",  "Sprint 1",   ["dealer_agent"]),
    cap("pdf.delivery_note",   "Delivery Note PDF",      "EDP delivery note (with or without prices)",        "pdf", "planned", "Sprint 12+", ["enterprise_distribution"]),
    cap("pdf.statement",       "Statement PDF",          "EDP monthly B2B billing statement",                 "pdf", "planned", "Sprint 12+", ["enterprise_distribution", "accounting"]),
  ],
  dependencies: [
    { module_id: "authentication", dependency_type: "required", reason: "PDFs are always scoped to an entity (dealer or company)" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution", "accounting"],
  spec_document:          null,
  implementation_sprint:  "Sprint 1",
};

// ─── Analytics module ─────────────────────────────────────────────────────────

const ANALYTICS_MANIFEST: ModuleManifest = {
  module_id:    "analytics",
  display_name: "Analytics",
  description:  "Business analytics and reporting. AI-powered growth insights, reputation analytics, and sales dashboards. Each application defines its own analytics domain objects on top of this shared module.",
  status:       "planned",
  version:      "0.1.0",
  source_path:  "dashboard/",
  capabilities: [
    cap("analytics.growth",      "Growth Analytics",      "AI Growth Platform — 15 KPIs, 9 recommendation categories","analytics","planned","Sprint 11H", ["dealer_agent"]),
    cap("analytics.reputation",  "Reputation Analytics",  "Review metrics, MEO signal health, trend data",   "analytics", "planned", "Sprint 11C+", ["dealer_agent"]),
    cap("analytics.sales",       "Sales Analytics",       "Revenue by customer/salesperson, gross profit",   "analytics", "planned", "Sprint 12+",  ["enterprise_distribution"]),
    cap("analytics.ai_usage",    "AI Usage Analytics",    "Per-dealer AI spend and token usage reporting",   "analytics", "planned", "Sprint 11R+", ["dealer_agent"]),
  ],
  dependencies: [
    { module_id: "authentication", dependency_type: "required", reason: "Analytics are always tenant-scoped" },
    { module_id: "authorization",  dependency_type: "required", reason: "Analytics access requires role check" },
  ],
  consuming_applications: ["dealer_agent", "enterprise_distribution"],
  spec_document:          "AI_GROWTH_PLATFORM_SPEC.md",
  implementation_sprint:  "Sprint 11H (foundation)",
};

// ─── Shared Services Registry ─────────────────────────────────────────────────

export const SHARED_SERVICES_REGISTRY: ModuleManifest[] = [
  AUTHENTICATION_MANIFEST,
  AUTHORIZATION_MANIFEST,
  AI_GATEWAY_MANIFEST,
  AI_MARKETPLACE_MANIFEST,
  OCR_MANIFEST,
  LINE_MANIFEST,
  MEDIA_MANIFEST,
  NOTIFICATION_MANIFEST,
  PDF_MANIFEST,
  ANALYTICS_MANIFEST,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getModuleManifest(
  module_id: PlatformModuleId,
): ModuleManifest | undefined {
  return SHARED_SERVICES_REGISTRY.find((m) => m.module_id === module_id);
}

export function getActiveModules(): ModuleManifest[] {
  return SHARED_SERVICES_REGISTRY.filter((m) => m.status === "active");
}

export function getPlannedModules(): ModuleManifest[] {
  return SHARED_SERVICES_REGISTRY.filter((m) => m.status === "planned");
}

export function isModuleAvailable(module_id: PlatformModuleId): boolean {
  const manifest = getModuleManifest(module_id);
  return manifest?.status === "active" || manifest?.status === "experimental";
}

export function getAllCapabilities(): PlatformCapability[] {
  return SHARED_SERVICES_REGISTRY.flatMap((m) => m.capabilities);
}

export function getCapabilitiesForModule(
  module_id: PlatformModuleId,
): PlatformCapability[] {
  return getModuleManifest(module_id)?.capabilities ?? [];
}
