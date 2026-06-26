// GYEON Business Hub — AI Insights Dashboard: Core Types (Sprint 12B)
//
// Defines the canonical AIInsight object model used across the dashboard,
// analytics, and communication center.
//
// Design principles:
//   - AIInsight is the display-layer object — distinct from GrowthInsight
//     (domain-specific AI output) and AnalyticsInsightDescriptor (type metadata).
//   - `ai_generated` is always false in Sprint 12B. Set to true only when an
//     AI Gateway agent produces the insight content (Sprint 12C+).
//   - `execution_deferred: true` is a permanent flag for non-AI insights; for
//     AI-generated insights it becomes false once the gateway runs.
//   - Revenue-tagged insights must be filtered server-side by role before being
//     passed to any component. Never pass revenue insights to client components.
//
// Pure — no "use server", no async, no DB calls, no external calls, no AI execution.

import type { AnalyticsInsightType, AnalyticsInsightSeverity } from "@/lib/analytics/analytics-types";
import type { DealerStaffRole }     from "@/lib/staff/staff-types";
import type { AIEntitlementId }     from "@/lib/subscription/subscription-center-types";

// Re-export so consumers import from this module, not analytics directly
export type { AnalyticsInsightType  as AIInsightTypeId };
export type { AnalyticsInsightSeverity as AIInsightSeverity };
export type { DealerStaffRole };
export type { AIEntitlementId };

// ─── Source of truth for this insight ────────────────────────────────────────

/**
 * Where the insight content came from.
 *   "deterministic"           — Computed from real dashboard data, no AI involved.
 *   "ai_gateway_pending"      — Slot reserved for AI Gateway output (Sprint 12C+).
 *   "ai_orchestrator_pending" — Slot reserved for AI Orchestrator (Sprint 12C+).
 *   "ai_generated"            — Content was produced by an AI agent.
 */
export type AIInsightSource =
  | "deterministic"
  | "ai_gateway_pending"
  | "ai_orchestrator_pending"
  | "ai_generated";

// ─── Data availability status ─────────────────────────────────────────────────

/**
 * Whether the underlying data source for this insight is available.
 * Used to render appropriate empty states without showing fake metrics.
 */
export type AIInsightDataStatus =
  | "connected"       // Real data used — values are genuine
  | "not_connected"   // Data source not yet integrated into the platform
  | "insufficient"    // Connected but not enough data points for reliability
  | "ai_required";    // Computation requires AI Gateway to be enabled

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export type AIInsightStatus =
  | "active"
  | "acknowledged"
  | "dismissed"
  | "expired";

// ─── Actions and recommendations ──────────────────────────────────────────────

export interface AIInsightAction {
  label: string;
  href:  string;
  style: "primary" | "secondary";
}

export interface AIInsightRecommendation {
  action_label: string;
  rationale:    string;
  priority:     1 | 2 | 3;
}

// ─── Core insight object ──────────────────────────────────────────────────────

/**
 * AIInsight — the canonical display object for a single AI or deterministic insight.
 *
 * Key invariants:
 *   - `ai_generated` is always false until AI Gateway is connected (Sprint 12C+).
 *   - `ai_agent_id` is always null in Sprint 12B.
 *   - `execution_deferred: true` until an AI agent fills the content.
 *   - Revenue-tagged insights (contains_revenue_data: true) must only be rendered
 *     server-side for roles where canViewFinance() returns true.
 *   - metrics_referenced uses "group.slug" format from Analytics Center registry.
 */
export interface AIInsight {
  id:                      string;
  type_id:                 AnalyticsInsightType;
  severity:                AnalyticsInsightSeverity;
  source:                  AIInsightSource;
  title:                   string;
  summary:                 string;
  detail:                  string | null;
  recommendation:          AIInsightRecommendation | null;
  actions:                 AIInsightAction[];

  /** Which staff roles may see this insight. Enforced server-side before passing to components. */
  visible_to_roles:        DealerStaffRole[];

  /** True when this insight references financial data. Gate with canViewFinance() server-side. */
  contains_revenue_data:   boolean;

  /** Required subscription entitlement to unlock full AI content for this insight type. */
  requires_ai_entitlement: AIEntitlementId | null;

  /** Analytics Center metric IDs referenced by this insight. Format: "group.slug" */
  metrics_referenced:      string[];

  data_status:             AIInsightDataStatus;
  created_at:              string;   // ISO 8601
  status:                  AIInsightStatus;

  ai_generated:            false;   // Always false in Sprint 12B
  ai_agent_id:             null;    // Always null until AI Gateway connected
  execution_deferred:      true;
}

// ─── Panel input ──────────────────────────────────────────────────────────────

/**
 * Props passed to AIInsightPanel.
 * Role-filtered by the server page before being passed to the component.
 */
export interface AIInsightPanelInput {
  insights:       AIInsight[];
  gateway_status: "not_configured" | "configured" | "unknown";
  role:           DealerStaffRole;
}
