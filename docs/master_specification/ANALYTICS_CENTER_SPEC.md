# GYEON Business Hub — Analytics & Reporting Center Specification

**Module**: `src/lib/analytics/`  
**Version**: 1.0.0 — Sprint 11Z  
**Status**: Foundation implemented  
**Last Updated**: 2026-06-26

---

## 1. Purpose

The Analytics & Reporting Center is the platform-level shared business intelligence layer for all GYEON Business Hub applications.

| Layer | Responsibility |
|---|---|
| Analytics Center | Metric registry, dashboard model, report model, AI insight types, policies |
| Application layer | Application-specific data queries and UI |
| AI Gateway (`src/lib/ai/`) | Produces AI insight objects using Analytics types as contract |
| Growth module (`src/lib/growth/`) | Dealer-specific growth KPIs (parallel, not layered) |

**Analytics vs. Growth module distinction**:  
`src/lib/growth/` — dealer AI growth domain types (GrowthInsight, GrowthReport).  
`src/lib/analytics/` — platform-level cross-application metric registry and dashboard model.  
These modules are parallel and do not import each other.

---

## 2. Module Structure

```
src/lib/analytics/
├── index.ts                  — package barrel (public API)
├── analytics-types.ts        — all domain types
├── metric-registry.ts        — 14 groups, 84 metric descriptors
├── dashboard-registry.ts     — 8 dashboard definitions
├── report-registry.ts        — 10 report definitions
├── ai-insights.ts            — 6 AI insight type definitions
├── analytics-policy.ts       — ANL-001 through ANL-008
└── platform-core-bridge.ts   — Platform Core integration
```

**Dependency direction:**
```
analytics/ → platform-core/ (one-way)
```
`platform-core/` does not import from `analytics/`. No circular dependencies.

---

## 3. Metric Registry

84 metrics across 14 metric groups.

### 3.1 Metric Groups Summary

| Group | ID | Metrics | Source Application | Scope |
|---|---|---|---|---|
| Dealer Operations | `dealer_operations` | 6 | `dealer_agent` | dealer / staff |
| Sales | `sales` | 6 | `dealer_agent` | dealer |
| Estimates | `estimates` | 6 | `dealer_agent` | dealer / staff |
| Work Orders | `work_orders` | 6 | `dealer_agent` | dealer / staff |
| Maintenance | `maintenance` | 6 | `dealer_agent` | dealer / staff |
| Communication | `communication` | 6 | `dealer_agent` | dealer |
| Reviews | `reviews` | 6 | `dealer_agent` | dealer |
| SNS / Marketing | `sns_marketing` | 6 | `dealer_agent` | dealer |
| AI Usage | `ai_usage` | 6 | `ai_operations` | dealer |
| Subscription / Billing | `subscription_billing` | 6 | `dealer_agent` | dealer / platform |
| Distribution | `distribution` | 6 | `enterprise_distribution` | company |
| Warehouse | `warehouse` | 6 | `warehouse` | branch / company |
| Accounting | `accounting` | 6 | `accounting` | company |
| CRM | `crm` | 6 | `crm` | dealer |

### 3.2 Metric Identifier Format

All metrics follow `{group}.{slug}` format:

```
sales.monthly_revenue
maintenance.conversion_rate
ai_usage.tokens_consumed
accounting.days_sales_outstanding
```

### 3.3 Visibility Scopes

| Scope | Access Level | Roles |
|---|---|---|
| `platform` | Cross-tenant aggregates only | `platform_admin` |
| `company` | Company-level data | `company_admin`, `platform_admin` |
| `dealer` | Single dealer data | `dealer_owner`, `branch_manager`, and above |
| `branch` | Branch operations | `warehouse_manager`, `branch_manager`, and above |
| `staff` | Operational counts only (no PII, no financials) | All authenticated staff |

---

## 4. Dashboard Model

8 dashboards — no UI implementation. Metadata and routing declarations only.

| Dashboard | ID | Scope | Primary Audience | AI Insights | Sprint |
|---|---|---|---|---|---|
| Executive Dashboard | `executive` | platform | `platform_admin`, `company_admin` | Yes | 12+ |
| Dealer Owner Dashboard | `dealer_owner` | dealer | `dealer_owner`, `branch_manager` | Yes | 12+ |
| Staff Dashboard | `staff` | staff | `dealer_staff` | No | 12+ |
| GYEON Distribution Dashboard | `distribution` | company | `company_admin`, `division_manager` | Yes | 13+ |
| Warehouse Dashboard | `warehouse` | branch | `warehouse_manager` | No | 13+ |
| Accounting Dashboard | `accounting` | company | `company_admin` | Yes | 13+ |
| AI Operations Dashboard | `ai_operations` | dealer | `dealer_owner`, `platform_admin` | No | 12+ |
| Subscription Dashboard | `subscription` | platform | `platform_admin` | Yes | 12+ |

### Dashboard Metric Group Coverage

| Dashboard | Metric Groups Included |
|---|---|
| Executive | sales, dealer_operations, subscription_billing, distribution, accounting, ai_usage |
| Dealer Owner | sales, dealer_operations, estimates, work_orders, maintenance, communication, reviews, sns_marketing, ai_usage |
| Staff | dealer_operations, work_orders, estimates, communication |
| Distribution | distribution, warehouse |
| Warehouse | warehouse |
| Accounting | accounting, subscription_billing |
| AI Operations | ai_usage |
| Subscription | subscription_billing |

---

## 5. Report Model

10 report definitions — no generation. Metadata and structure only.

| Report | ID | Format | Frequency | AI Summary | Sprint |
|---|---|---|---|---|---|
| Monthly Sales Report | `monthly_sales` | mixed | monthly | Yes | 12+ |
| Dealer Performance Report | `dealer_performance` | mixed | monthly | Yes | 12+ |
| Maintenance Conversion Report | `maintenance_conversion` | mixed | monthly | Yes | 12+ |
| Review Conversion Report | `review_conversion` | mixed | monthly | Yes | 12+ |
| Communication Response Report | `communication_response` | table | weekly | No | 12+ |
| AI Usage Report | `ai_usage` | mixed | monthly | No | 12+ |
| Distribution Sales Report | `distribution_sales` | mixed | monthly | Yes | 13+ |
| Inventory Movement Report | `inventory_movement` | table | weekly | No | 13+ |
| Accounts Receivable Report | `accounts_receivable` | mixed | weekly | No | 13+ |
| Customer Inactivity Report | `customer_inactivity` | table | on_demand | Yes | 12+ |

---

## 6. AI Insight Compatibility

6 AI insight types. All require AI Gateway. No execution in this sprint.

| Insight Type | ID | Severity Levels | Min Data Points | Sprint |
|---|---|---|---|---|
| AI Performance Summary | `ai_summary` | info | 30 days | 12+ |
| AI Actionable Recommendation | `ai_recommendation` | info, opportunity | 14 days | 12+ |
| Metric Anomaly Alert | `anomaly_detection` | critical, warning | 30 days | 12+ |
| Growth Opportunity | `growth_opportunity` | opportunity | 60 days | 12+ |
| Business Risk Warning | `risk_warning` | critical, warning | 7 days | 12+ |
| Next Best Action | `next_action_suggestion` | info, opportunity, warning | 7 days | 12+ |

### AI Insight Contract

The AI Gateway produces insights conforming to these type declarations. The Analytics Center defines the shape; the AI Gateway fills the content. No AI execution occurs in `src/lib/analytics/`.

---

## 7. Privacy & Role Policy

8 governance policies — ANL-001 through ANL-008.

| Rule | Title | Enforcement |
|---|---|---|
| ANL-001 | Analytics Data Isolated Per Tenant | strict |
| ANL-002 | Revenue and Financial Data Restricted to Authorized Roles | strict |
| ANL-003 | Staff-Level Analytics Must Exclude PII | strict |
| ANL-004 | AI Insights Require Minimum Data Points Before Display | strict |
| ANL-005 | Analytics Data Must Not Be Cached Beyond Session Without Encryption | strict |
| ANL-006 | Platform-Level Aggregates Must Not Reveal Individual Dealer Identities | strict |
| ANL-007 | Dashboards Should Default to Most Conservative Visibility Scope | advisory |
| ANL-008 | AI Summaries Should Be Reviewed Before External Sharing | advisory |

### Role Visibility Matrix (Default)

| Metric Type | `dealer_staff` | `branch_manager` | `dealer_owner` | `company_admin` | `platform_admin` |
|---|---|---|---|---|---|
| Operational counts (work orders, queue) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Communication metrics | — | ✓ | ✓ | ✓ | ✓ |
| Revenue / Financial metrics | — | ✓ | ✓ | ✓ | ✓ |
| Review & marketing metrics | — | ✓ | ✓ | ✓ | ✓ |
| AI usage metrics | — | — | ✓ | ✓ | ✓ |
| Cross-tenant aggregates | — | — | — | ✓ | ✓ |
| Platform MRR / subscription data | — | — | — | — | ✓ |

---

## 8. Platform Core Integration

`APPLICATION_METRIC_GROUP_MAP` maps all 6 `PlatformApplicationId` values to their metric groups.

| Application | Metric Groups |
|---|---|
| `dealer_agent` | dealer_operations, sales, estimates, work_orders, maintenance, communication, reviews, sns_marketing, crm |
| `enterprise_distribution` | distribution, warehouse, sales |
| `warehouse` | warehouse |
| `accounting` | accounting, subscription_billing |
| `crm` | crm, communication, reviews |
| `ai_operations` | ai_usage, subscription_billing |

Functions exposed to Platform Core:
- `getMetricGroupsForApplication()` — metric groups for an application
- `getDashboardsForPlatformApp()` — dashboards for an application
- `getReportsForPlatformApp()` — reports for an application
- `ANALYTICS_MODULE_MANIFEST` — module manifest
- `ANALYTICS_CENTER` — center descriptor

---

## 9. Registry Summary

| Item | Count |
|---|---|
| Metric groups | 14 |
| Total metrics | 84 |
| Dashboards | 8 |
| Reports | 10 |
| AI insight types | 6 |
| Governance policies | 8 |
| Strict policies | 6 |
| Advisory policies | 2 |

---

## 10. Next Steps

| Sprint | Work |
|---|---|
| Sprint 12+ | Monthly Sales Report generation (Dealer Agent) |
| Sprint 12+ | Dealer Owner Dashboard UI implementation |
| Sprint 12+ | AI insight production from AI Gateway |
| Sprint 12+ | Customer Inactivity Report + AI churn scoring |
| Sprint 13+ | Distribution Dashboard + Warehouse Dashboard |
| Sprint 13+ | Accounting Dashboard + AR report |
| Sprint 13+ | Cross-tenant Executive Dashboard (platform admin) |
