# GYEON Business Hub — AI Insights Dashboard Specification

**Version**: 1.0.0 — Sprint 12B  
**Status**: Foundation implemented  
**Last Updated**: 2026-06-26

---

## 1. Purpose

The AI Insights Dashboard is a role-aware, privacy-safe layer on top of the Dealer Owner Dashboard that surfaces actionable observations derived from real business data. In Sprint 12B, all insights are deterministic — computed from live `DashboardSummary` data with no AI execution. The architecture is designed to accept AI-generated content from the AI Gateway in Sprint 12C+.

---

## 2. Architecture Position

```
AI Gateway (Sprint 12C+)
   ↓ produces AIInsight objects
AI Orchestrator (Sprint 12C+)
   ↓ routes to dashboards
src/lib/ai-insights/                  ← THIS MODULE
   ↓ defines types, registry, builders
src/components/dashboard/AIInsightPanel.tsx
   ↓ renders role-filtered insights
src/app/dashboard/page.tsx (Server)
   ↓ orchestrates data + role checks
```

### Relationship to other modules

| Module | Relationship |
|---|---|
| `src/lib/analytics/` | Analytics Center defines `AnalyticsInsightType` and `AnalyticsInsightSeverity` — AI Insights reuses these types |
| `src/lib/growth/` | Growth module defines `GrowthInsight` (domain-specific AI output) — separate from `AIInsight` (display layer) |
| `src/lib/subscription/` | Subscription module defines `AIEntitlementId` — AI Insights references it for gating |
| `src/lib/ai/` | AI Gateway module defines `checkAiGatewayReady()` — AI Insights will call it in Sprint 12C+ |
| `src/lib/communication/` | Communication Center channels surface AI-generated messages — future integration |

---

## 3. Module Structure

```
src/lib/ai-insights/
├── ai-insight-types.ts         Core type definitions
├── insight-policy.ts           AIP-001 through AIP-007 governance policies
├── insight-registry.ts         Static registry of insight type metadata
├── deterministic-insights.ts   Builder functions (pure, no AI, no async)
├── subscription-gate.ts        Entitlement mapping for plan gating
└── index.ts                    Package barrel
```

---

## 4. Core Type: AIInsight

```typescript
interface AIInsight {
  id:                      string;
  type_id:                 AnalyticsInsightType;
  severity:                AnalyticsInsightSeverity;
  source:                  AIInsightSource;
  title:                   string;
  summary:                 string;
  detail:                  string | null;
  recommendation:          AIInsightRecommendation | null;
  actions:                 AIInsightAction[];
  visible_to_roles:        DealerStaffRole[];
  contains_revenue_data:   boolean;
  requires_ai_entitlement: AIEntitlementId | null;
  metrics_referenced:      string[];   // "group.slug" format
  data_status:             AIInsightDataStatus;
  created_at:              string;
  status:                  AIInsightStatus;
  ai_generated:            false;      // Always false in Sprint 12B
  ai_agent_id:             null;
  execution_deferred:      true;
}
```

### AIInsightSource

| Value | Meaning |
|---|---|
| `deterministic` | Computed from real data with no AI involvement |
| `ai_gateway_pending` | Reserved slot for future AI Gateway output |
| `ai_orchestrator_pending` | Reserved slot for AI Orchestrator |
| `ai_generated` | Content produced by an AI agent (Sprint 12C+) |

### AIInsightDataStatus

| Value | UI State |
|---|---|
| `connected` | Real data used — values are genuine, no badge |
| `not_connected` | "未接続" grey badge |
| `ai_required` | "AI必要" blue badge |
| `insufficient` | "データ不足" amber badge |

---

## 5. Governance Policies

| Policy | Title | Enforcement |
|---|---|---|
| AIP-001 | No AI Execution Without Gateway | Strict |
| AIP-002 | Revenue Insights Require Finance Role | Strict |
| AIP-003 | No Fake Metrics or Fabricated Insight Content | Strict |
| AIP-004 | Data Status Must Be Declared | Strict |
| AIP-005 | KPI Names Must Not Leak Through UI Labels | Strict |
| AIP-006 | Advanced AI Insights Require Subscription Entitlement | Advisory |
| AIP-007 | Insights Must Reference Source Metrics | Advisory |

---

## 6. Role & Privacy Rules (Phase E)

### Role visibility matrix

| Insight | Owner | Manager | Staff | Readonly |
|---|---|---|---|---|
| Revenue Risk (延滞請求書) | Visible | Visible | **Hidden** | **Hidden** |
| Maintenance Opportunity | Visible | Visible | Visible | Visible |
| Estimate Follow-up | Visible | Visible | Visible | Visible |
| Communication Setup | Visible | Visible | Visible | Visible |
| Review Opportunity | Visible | Visible | Visible | Visible |
| Customer Inactivity Risk | Visible | Visible | Visible | — |
| Marketing Opportunity | Visible | Visible | Visible | — |

### Privacy guarantee

Revenue risk insight (`contains_revenue_data: true`) is **only built** for roles where `canViewFinance(role)` returns true. The filter is applied inside `buildDeterministicInsights()` before any insight object is created. No revenue data is passed to `AIInsightPanel` for staff or readonly roles.

KPI metric IDs (e.g., `accounting.accounts_receivable`) only appear in the `metrics_referenced` array of each `AIInsight` object. This array is never rendered in the UI and never included in any HTML or client-side JSON for staff roles, because the revenue insight itself is excluded from the insights array passed to the panel.

### Enforcement code path

```
page.tsx (SERVER)
  │
  ├── getCurrentStaff() → role
  ├── canViewFinance(role) → showRevenue
  ├── buildDeterministicInsights(data, role)
  │     └── if canViewFinance(role) → include revenueRiskInsight
  │         else → omit revenueRiskInsight entirely
  │
  └── <AIInsightPanel insights={aiInsights} role={role} />
        └── renders only what was passed — no role check inside panel
```

---

## 7. Sprint 12B Insight Inventory

| Insight ID | Title | Type | Source | Data Status | Revenue? |
|---|---|---|---|---|---|
| `revenue_risk` | 売上リスク | `risk_warning` | deterministic | connected | Yes (owner/manager only) |
| `maintenance_opportunity` | メンテナンス機会 | `next_action_suggestion` | deterministic | connected | No |
| `estimate_followup` | 見積フォローアップ | `next_action_suggestion` | deterministic | connected | No |
| `communication_setup` | コミュニケーション連携 | `next_action_suggestion` | deterministic | connected | No |
| `review_opportunity` | レビュー機会 | `growth_opportunity` | ai_gateway_pending | not_connected | No |
| `customer_inactivity_risk` | 顧客離脱リスク | `risk_warning` | ai_gateway_pending | ai_required | No |
| `marketing_opportunity` | マーケティング機会 | `growth_opportunity` | ai_gateway_pending | not_connected | No |

---

## 8. Deterministic Insight Logic

### Revenue Risk
- Source: `InvoiceCounts.overdue`, `InvoiceCounts.issued`
- Critical: `overdue > 0` → `"${overdue}件の請求書が延滞中です"`
- Info: `overdue === 0 && issued > 0` → `"${issued}件の未払い請求書"`
- Metric: `accounting.accounts_receivable`

### Maintenance Opportunity
- Source: `MaintenanceDashboardStats.pending`, `.next_7_days`
- Warning: `pending > 0` → `"${pending}件のリマインダーが未送信"`
- Info: `next_7_days > 0` → `"7日以内に${next_7_days}件が対象"`
- Metric: `maintenance.maintenance_due_count`

### Estimate Follow-up
- Source: `EstimateCounts.sent`
- Info: `sent > 0` → `"${sent}件の見積が返答待ち"`
- Metric: `estimates.pending_estimates`

### Communication Setup
- Source: `LineStats.linked_count`
- Warning: `linked_count === 0` → "LINE連携顧客がいません"
- Info: `linked_count > 0` → `"${linked_count}人がLINE連携済み"`
- Metric: `communication.line_opt_in_rate`

---

## 9. AI Gateway Compatibility (Phase F)

The `AIInsight` object is designed to accept AI-generated content from Sprint 12C+:

```typescript
// Sprint 12B — all placeholders:
ai_generated:       false,
ai_agent_id:        null,
execution_deferred: true,
source:             "deterministic" | "ai_gateway_pending"

// Sprint 12C+ — AI fills:
ai_generated:       true,
ai_agent_id:        "growth_agent",
execution_deferred: false,
source:             "ai_generated"
```

The AI Gateway will:
1. Call `checkAiGatewayReady()` to verify provider configuration
2. Check `planCanGenerateInsight(plan_id, type_id)` from `subscription-gate.ts`
3. Read insight type metadata from `AI_INSIGHT_TYPE_REGISTRY`
4. Generate content using `requires_minimum_data_points` as a threshold guard
5. Return an `AIInsight` with `ai_generated: true` and `execution_deferred: false`
6. The dashboard page will receive these from a future `getAIInsights()` server action

---

## 10. Subscription Gating (Phase G)

| Insight Type | Required Entitlement | Minimum Plan (Detailer Agent) |
|---|---|---|
| `next_action_suggestion` | None | All plans |
| `risk_warning` (deterministic) | None | All plans |
| `ai_summary` | `growth_ai` | Business AI |
| `ai_recommendation` | `growth_ai` | Business AI |
| `anomaly_detection` | `growth_ai` | Business AI |
| `growth_opportunity` | `growth_ai` | Business AI |

Gating is **advisory** in Sprint 12B. The `planCanGenerateInsight()` function in `subscription-gate.ts` provides the runtime check for the AI Gateway to use in Sprint 12C+.

---

## 11. Component: AIInsightPanel

**File**: `src/components/dashboard/AIInsightPanel.tsx`  
**Type**: React Server Component (no `"use client"`)

### Props

```typescript
interface Props {
  insights:       AIInsight[];          // Pre-filtered by role server-side
  role:           DealerStaffRole;
  gateway_status: "not_configured" | "configured" | "unknown";
}
```

### Visual design

| Severity | Left border color | Dot color |
|---|---|---|
| `critical` | red-600 | red-500 |
| `warning` | amber-500 | amber-400 |
| `opportunity` | green-600 | green-400 |
| `info` | slate-700 | slate-600 |

| Data status | Badge |
|---|---|
| `connected` | No badge |
| `not_connected` | "未接続" grey |
| `ai_required` | "AI必要" blue |
| `insufficient` | "データ不足" amber |

---

## 12. Remaining Work Before Sprint 12C

| Item | Notes |
|---|---|
| AI Gateway connection | Call `checkAiGatewayReady()` in the page; pass real gateway_status |
| AI-generated insights | Sprint 12C — growth_agent produces ai_summary, ai_recommendation |
| Insight persistence | Store generated insights in Supabase for history (requires schema migration) |
| Insight acknowledgement | Dealer marks insights as acknowledged — requires persistence |
| Anomaly detection | Sprint 12C+ — requires 30+ days of metric history |
| Google Business Profile | Connect GBP for review opportunity data |
| SNS data integration | Connect for marketing opportunity data |
| Customer inactivity scoring | Sprint 12C — growth_ai entitlement, requires churn model |
| Plan gating enforcement | Runtime enforcement of requires_ai_entitlement at AI Gateway level |
| Real gateway_status | Call `checkAiGatewayReady()` in dashboard page and pass result to panel |
