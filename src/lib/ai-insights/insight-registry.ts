// GYEON Business Hub — AI Insights Dashboard: Insight Type Registry (Sprint 12B)
//
// Static registry of insight type metadata.
// Maps each AnalyticsInsightType to:
//   - display name and description
//   - minimum data points required for reliable AI output
//   - subscription entitlement required for advanced AI content
//   - which staff roles may see this insight type
//   - applicable Analytics Center metric groups
//   - target sprint for live AI generation
//
// This registry is consumed by the dashboard panel and by the AI Gateway
// (Sprint 12C+) to understand what to produce for each insight type.
//
// Pure — no "use server", no async, no DB calls, no external calls, no AI execution.

import type { AnalyticsInsightType }  from "@/lib/analytics/analytics-types";
import type { DealerStaffRole }        from "@/lib/staff/staff-types";
import type { AIEntitlementId }        from "@/lib/subscription/subscription-center-types";
import type { AnalyticsMetricGroupId } from "@/lib/analytics/analytics-types";

// ─── Registry entry type ──────────────────────────────────────────────────────

export interface AIInsightTypeDescriptor {
  type_id:                     AnalyticsInsightType;
  display_name:                string;
  description:                 string;
  icon:                        string;   // emoji icon for UI
  requires_minimum_data_points: number;
  requires_ai_entitlement:     AIEntitlementId | null;
  visible_to_roles:            DealerStaffRole[];
  applicable_metric_groups:    AnalyticsMetricGroupId[];
  target_sprint:               string;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

export const AI_INSIGHT_TYPE_REGISTRY: AIInsightTypeDescriptor[] = [
  {
    type_id:                     "next_action_suggestion",
    display_name:                "次のアクション提案",
    description:                 "The single highest-priority action the dealer should take today " +
                                 "based on operational data. Derived deterministically from " +
                                 "dashboard metrics in Sprint 12B; AI-enhanced from Sprint 12C+.",
    icon:                        "⚡",
    requires_minimum_data_points: 7,
    requires_ai_entitlement:     null,    // Deterministic in 12B; no AI entitlement needed
    visible_to_roles:            ["owner", "manager", "staff", "readonly"],
    applicable_metric_groups:    ["dealer_operations", "work_orders", "estimates", "maintenance"],
    target_sprint:               "Sprint 12B (deterministic) / Sprint 12C (AI-enhanced)",
  },
  {
    type_id:                     "ai_summary",
    display_name:                "AIパフォーマンスサマリー",
    description:                 "A concise AI-generated narrative of business performance for the " +
                                 "current period. Requires AI Gateway and minimum 30 days of data.",
    icon:                        "📊",
    requires_minimum_data_points: 30,
    requires_ai_entitlement:     "growth_ai",
    visible_to_roles:            ["owner", "manager"],
    applicable_metric_groups:    ["sales", "dealer_operations", "reviews", "maintenance", "communication"],
    target_sprint:               "Sprint 12C+",
  },
  {
    type_id:                     "ai_recommendation",
    display_name:                "AI推奨アクション",
    description:                 "A specific, evidence-based recommendation for improving a KPI. " +
                                 "Tied to at least two supporting data points.",
    icon:                        "💡",
    requires_minimum_data_points: 14,
    requires_ai_entitlement:     "growth_ai",
    visible_to_roles:            ["owner", "manager", "staff"],
    applicable_metric_groups:    ["sales", "maintenance", "reviews", "communication", "crm"],
    target_sprint:               "Sprint 12C+",
  },
  {
    type_id:                     "anomaly_detection",
    display_name:                "異常検知",
    description:                 "Detection of unusual movements in tracked metrics, such as " +
                                 "sudden drops in LINE engagement or spikes in cancellations.",
    icon:                        "🔍",
    requires_minimum_data_points: 30,
    requires_ai_entitlement:     "growth_ai",
    visible_to_roles:            ["owner", "manager"],
    applicable_metric_groups:    ["dealer_operations", "communication", "sales", "reviews"],
    target_sprint:               "Sprint 12C+",
  },
  {
    type_id:                     "growth_opportunity",
    display_name:                "成長機会",
    description:                 "Untapped revenue or retention opportunities identified by " +
                                 "analyzing customer behavior patterns and service history.",
    icon:                        "📈",
    requires_minimum_data_points: 60,
    requires_ai_entitlement:     "growth_ai",
    visible_to_roles:            ["owner", "manager"],
    applicable_metric_groups:    ["crm", "maintenance", "sales", "reviews"],
    target_sprint:               "Sprint 12C+",
  },
  {
    type_id:                     "risk_warning",
    display_name:                "リスク警告",
    description:                 "Early warning of potential risks to business performance, " +
                                 "including customer churn risk and revenue concentration risk.",
    icon:                        "⚠️",
    requires_minimum_data_points: 7,
    requires_ai_entitlement:     null,    // Deterministic version available (overdue invoices)
    visible_to_roles:            ["owner", "manager"],   // Revenue-adjacent; restricted
    applicable_metric_groups:    ["sales", "crm", "accounting"],
    target_sprint:               "Sprint 12B (deterministic) / Sprint 12C (AI-enhanced)",
  },
] as const satisfies AIInsightTypeDescriptor[];

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function getInsightTypeDescriptor(
  type_id: AnalyticsInsightType,
): AIInsightTypeDescriptor | undefined {
  return AI_INSIGHT_TYPE_REGISTRY.find(d => d.type_id === type_id);
}

export function getInsightTypesForRole(role: DealerStaffRole): AIInsightTypeDescriptor[] {
  return AI_INSIGHT_TYPE_REGISTRY.filter(d => d.visible_to_roles.includes(role));
}

export function getInsightTypeRequiredEntitlement(
  type_id: AnalyticsInsightType,
): AIEntitlementId | null {
  return getInsightTypeDescriptor(type_id)?.requires_ai_entitlement ?? null;
}

export function getDeterministicInsightTypes(): AIInsightTypeDescriptor[] {
  return AI_INSIGHT_TYPE_REGISTRY.filter(d => d.requires_ai_entitlement === null);
}
