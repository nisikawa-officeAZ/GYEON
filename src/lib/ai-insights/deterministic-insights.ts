// GYEON Business Hub — AI Insights Dashboard: Deterministic Insight Builders (Sprint 12B)
//
// Pure builder functions that convert real dashboard data into AIInsight objects.
// No AI execution. No provider calls. No external requests.
//
// Each builder produces an insight from live DashboardSummary data:
//   - If actionable data exists → insight with data_status: "connected" and real counts
//   - If data source is not integrated → data_status: "not_connected"
//   - If AI Gateway is required → data_status: "ai_required"
//
// Revenue-tagged insights (contains_revenue_data: true) are ONLY included when
// canViewFinance(role) === true. The orchestrator enforces this before returning.
//
// Pure — no "use server", no async, no DB calls, no external calls, no AI execution.

import { canViewFinance }   from "@/lib/staff/staff-types";
import type { DealerStaffRole }     from "@/lib/staff/staff-types";
import type {
  MaintenanceDashboardStats,
  EstimateCounts,
  LineStats,
  InvoiceCounts,
} from "@/lib/dashboard/get-dashboard-summary";
import type { AIInsight }   from "./ai-insight-types";

// ─── Input shape ──────────────────────────────────────────────────────────────

export interface DashboardInsightInput {
  maintenance:    MaintenanceDashboardStats;
  estimates:      EstimateCounts;
  line_stats:     LineStats;
  invoices:       InvoiceCounts;
  customer_count: number;
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function shell(id: string): Pick<AIInsight, "id" | "created_at" | "status" | "ai_generated" | "ai_agent_id" | "execution_deferred"> {
  return {
    id,
    created_at:         nowIso(),
    status:             "active",
    ai_generated:       false,
    ai_agent_id:        null,
    execution_deferred: true,
  };
}

// ─── Individual builders ──────────────────────────────────────────────────────

function buildMaintenanceInsight(stats: MaintenanceDashboardStats): AIInsight {
  const hasPending = stats.pending > 0;
  const hasSoon    = stats.next_7_days > 0;

  const severity   = hasPending ? "warning" : "info";
  const summary    = hasPending
    ? `${stats.pending}件のメンテナンスリマインダーが未送信です`
    : hasSoon
      ? `7日以内に${stats.next_7_days}件のメンテナンス対象がいます`
      : "メンテナンス対象の顧客はいません";

  const action = hasPending
    ? { label: "メンテナンス管理", href: "/maintenance", style: "primary" as const }
    : hasSoon
      ? { label: "メンテナンス確認", href: "/maintenance", style: "secondary" as const }
      : null;

  return {
    ...shell("maintenance_opportunity"),
    type_id:                 "next_action_suggestion",
    severity,
    source:                  "deterministic",
    title:                   "メンテナンス機会",
    summary,
    detail:                  hasPending
      ? `リマインダー未送信: ${stats.pending}件 / 今月対象: ${stats.this_month}件`
      : null,
    recommendation:          hasPending
      ? {
          action_label: "LINE で一括リマインダーを送信",
          rationale:    "リマインダー送信により再来店率が向上します",
          priority:     1,
        }
      : null,
    actions:                 action ? [action] : [],
    visible_to_roles:        ["owner", "manager", "staff", "readonly"],
    contains_revenue_data:   false,
    requires_ai_entitlement: null,
    metrics_referenced:      ["maintenance.maintenance_due_count"],
    data_status:             "connected",
  };
}

function buildEstimateInsight(estimates: EstimateCounts): AIInsight {
  const hasSent = estimates.sent > 0;
  const summary = hasSent
    ? `${estimates.sent}件の見積が返答待ちです`
    : "返答待ちの見積はありません";

  return {
    ...shell("estimate_followup"),
    type_id:                 "next_action_suggestion",
    severity:                hasSent ? "info" : "info",
    source:                  "deterministic",
    title:                   "見積フォローアップ",
    summary,
    detail:                  hasSent
      ? `送付済み: ${estimates.sent}件 / 承認済み: ${estimates.approved}件 / 下書き: ${estimates.draft}件`
      : null,
    recommendation:          hasSent
      ? {
          action_label: "送付済み見積を確認する",
          rationale:    "返答のない見積への早期フォローアップで承認率が向上します",
          priority:     2,
        }
      : null,
    actions:                 hasSent
      ? [{ label: "見積一覧", href: "/estimates", style: "primary" as const }]
      : [],
    visible_to_roles:        ["owner", "manager", "staff", "readonly"],
    contains_revenue_data:   false,
    requires_ai_entitlement: null,
    metrics_referenced:      ["estimates.pending_estimates", "estimates.estimate_approval_rate"],
    data_status:             "connected",
  };
}

function buildCommunicationInsight(lineStats: LineStats): AIInsight {
  const linked = lineStats.linked_count;

  const severity = linked === 0 ? "warning" : "info";
  const summary  = linked === 0
    ? "LINE連携顧客がいません — 設定を確認してください"
    : `${linked.toLocaleString()}人の顧客がLINE連携済みです`;

  return {
    ...shell("communication_setup"),
    type_id:                 "next_action_suggestion",
    severity,
    source:                  "deterministic",
    title:                   "コミュニケーション連携",
    summary,
    detail:                  `友達数: ${lineStats.friends_count.toLocaleString()} / 今月の新規: ${lineStats.this_month_new}`,
    recommendation:          linked === 0
      ? {
          action_label: "LINE設定を確認する",
          rationale:    "LINE連携によりメンテナンスリマインダーや見積通知を送信できます",
          priority:     2,
        }
      : null,
    actions:                 [{ label: "LINE管理", href: "/line", style: linked === 0 ? "primary" as const : "secondary" as const }],
    visible_to_roles:        ["owner", "manager", "staff", "readonly"],
    contains_revenue_data:   false,
    requires_ai_entitlement: null,
    metrics_referenced:      ["communication.line_opt_in_rate", "crm.active_customers"],
    data_status:             "connected",
  };
}

function buildReviewInsight(): AIInsight {
  return {
    ...shell("review_opportunity"),
    type_id:                 "growth_opportunity",
    severity:                "info",
    source:                  "ai_gateway_pending",
    title:                   "レビュー機会",
    summary:                 "Googleビジネスプロフィール連携後に有効化されます",
    detail:                  null,
    recommendation:          null,
    actions:                 [{ label: "設定確認", href: "/settings", style: "secondary" as const }],
    visible_to_roles:        ["owner", "manager", "staff", "readonly"],
    contains_revenue_data:   false,
    requires_ai_entitlement: null,
    metrics_referenced:      ["reviews.review_conversion_rate", "reviews.review_requests_sent"],
    data_status:             "not_connected",
  };
}

function buildCustomerInactivityInsight(customerCount: number): AIInsight {
  const hasCustomers = customerCount > 0;
  return {
    ...shell("customer_inactivity_risk"),
    type_id:                 "risk_warning",
    severity:                "info",
    source:                  "ai_gateway_pending",
    title:                   "顧客離脱リスク",
    summary:                 hasCustomers
      ? `${customerCount.toLocaleString()}人の顧客の来店パターンをAIがスコアリング予定`
      : "顧客データ蓄積後にAIリスクスコアリングが有効化されます",
    detail:                  null,
    recommendation:          null,
    actions:                 [{ label: "顧客一覧", href: "/customers", style: "secondary" as const }],
    visible_to_roles:        ["owner", "manager", "staff"],
    contains_revenue_data:   false,
    requires_ai_entitlement: "growth_ai",
    metrics_referenced:      ["crm.customer_retention_rate", "crm.repeat_visit_rate"],
    data_status:             "ai_required",
  };
}

function buildMarketingInsight(): AIInsight {
  return {
    ...shell("marketing_opportunity"),
    type_id:                 "growth_opportunity",
    severity:                "info",
    source:                  "ai_gateway_pending",
    title:                   "マーケティング機会",
    summary:                 "SNS・MEO連携後にAIキャンペーン提案が有効化されます",
    detail:                  null,
    recommendation:          null,
    actions:                 [{ label: "AI設定", href: "/settings/ai", style: "secondary" as const }],
    visible_to_roles:        ["owner", "manager", "staff"],
    contains_revenue_data:   false,
    requires_ai_entitlement: "marketing_ai",
    metrics_referenced:      ["sns_marketing.campaign_conversion_rate"],
    data_status:             "not_connected",
  };
}

function buildRevenueRiskInsight(invoices: InvoiceCounts): AIInsight {
  const hasOverdue = invoices.overdue > 0;
  const severity   = hasOverdue ? "critical" : "info";

  const summary = hasOverdue
    ? `${invoices.overdue}件の請求書が延滞中です`
    : invoices.issued > 0
      ? `${invoices.issued}件の未払い請求書があります`
      : "延滞請求書はありません";

  return {
    ...shell("revenue_risk"),
    type_id:                 "risk_warning",
    severity,
    source:                  "deterministic",
    title:                   "売上リスク",
    summary,
    detail:                  hasOverdue
      ? `延滞: ${invoices.overdue}件 / 発行済み: ${invoices.issued}件`
      : null,
    recommendation:          hasOverdue
      ? {
          action_label: "延滞請求書を確認する",
          rationale:    "延滞請求書の早期対応でキャッシュフローが改善します",
          priority:     1,
        }
      : null,
    actions:                 [{ label: "請求書管理", href: "/invoices", style: hasOverdue ? "primary" as const : "secondary" as const }],
    visible_to_roles:        ["owner", "manager"],
    contains_revenue_data:   true,
    requires_ai_entitlement: null,
    metrics_referenced:      ["accounting.accounts_receivable"],
    data_status:             "connected",
  };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Build all deterministic insights for the current role and dashboard data.
 *
 * Revenue-tagged insights are excluded unless canViewFinance(role) passes.
 * The result is safe to pass to server-rendered components.
 *
 * Insight order: revenue risk (if authorized) → maintenance → estimate
 *   → communication → review → customer inactivity → marketing.
 */
export function buildDeterministicInsights(
  data:  DashboardInsightInput,
  role:  DealerStaffRole,
): AIInsight[] {
  const showFinance = canViewFinance(role);

  const insights: AIInsight[] = [];

  // Revenue risk — owner/manager only (server-side filter enforces AIP-002)
  if (showFinance) {
    insights.push(buildRevenueRiskInsight(data.invoices));
  }

  // Operational insights — all roles
  insights.push(buildMaintenanceInsight(data.maintenance));
  insights.push(buildEstimateInsight(data.estimates));
  insights.push(buildCommunicationInsight(data.line_stats));

  // Placeholder insights — all roles (no revenue data, safe to show)
  insights.push(buildReviewInsight());
  insights.push(buildCustomerInactivityInsight(data.customer_count));
  insights.push(buildMarketingInsight());

  return insights;
}
