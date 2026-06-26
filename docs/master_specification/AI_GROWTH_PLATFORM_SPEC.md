# AI Growth Platform Specification
## GYEON Detailer Agent — Sprint 11H

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Foundation Complete — AI Execution Deferred |
| **Sprint** | 11H |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/growth/` |
| **AI Execution Status** | Deferred — Phase 11I+ |

---

## §1 — Overview

The AI Growth Platform is the canonical business intelligence and growth advisory layer for GYEON Detailer Agent dealers. It is a first-class business domain alongside Marketing, Reputation, and LINE Automation.

### Purpose

The Growth Platform answers the dealer's fundamental business question:

> "How is my business doing, and what should I do to grow it?"

It does this by:
1. Consuming data from all core subsystems (customers, work orders, payments, media, marketing, reputation, LINE)
2. Computing KPIs across 10 business dimensions
3. Generating prioritized recommendations through the growth_agent
4. Producing structured reports and dashboard data for multiple user roles

### Key design decisions

- **execution_deferred: true** — No AI inference fires in Sprint 11H. All execution plans are typed structures describing WHAT WILL happen in Phase 11I+.
- **dealer_id always from getCurrentDealer()** — Every server-side consumer must source dealer_id from the auth layer, never from client input.
- **Provider-agnostic AI** — All AI calls go through the AI Gateway. The platform declares agent IDs and task types — never provider-specific parameters.
- **Read-only cross-platform** — The Growth Platform reads from all subsystems but NEVER writes to them. Mutations always go through the source platform's own API.
- **Pure modules** — All Sprint 11H files are pure TypeScript with no `"use server"`, no async, no DB calls, and no external network calls.

---

## §2 — Architecture

```
Data Sources (read-only)
  ├── Customers           src/lib/customers
  ├── Vehicles            src/lib/vehicles
  ├── Estimates           src/lib/estimates
  ├── Work Orders         src/lib/work-orders
  ├── Completion Reports  src/lib/completion-reports
  ├── Payments            src/lib/payments
  ├── Products            src/lib/products
  ├── Media Platform      src/lib/media
  ├── AI Marketing        src/lib/marketing
  ├── AI Reputation       src/lib/reputation
  └── LINE Automation     src/lib/line-automation
         │
         ▼ (Phase 11I+: query layer built here)
Growth Data Layer (deferred)
  └── GrowthAIContext (metric_snapshot)
         │
         ▼
KPI Computation (Phase 11I+)
  └── GrowthMetric[]  (15 KPIs across 10 dimensions)
         │
         ▼
AI Gateway
  └── growth_agent.execute(GrowthAIContext)
        ├── WORKFLOW: growth_analysis
        ├── WORKFLOW: recommendation_generation
        └── WORKFLOW: monthly_report
         │
         ▼  Cross-feeds (gateway-routed, never direct)
  marketing_agent ──► growth_agent (marketing dimension)
  reputation_agent ──► growth_agent (reputation dimension)
         │
         ▼
Growth Output
  ├── GrowthScore          (0–100 composite, per-dimension breakdown)
  ├── GrowthInsight[]      (observed patterns across dimensions)
  ├── GrowthRecommendation[] (prioritized dealer actions)
  ├── GrowthOpportunity[]  (specific actionable growth opportunities)
  └── GrowthReport / GrowthDashboard
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `growth-types.ts` | A | Core domain: GrowthDimension (10), GrowthMetric, GrowthTrend, GrowthScore, GrowthInsight, GrowthOpportunity, GrowthRecommendation, GrowthReport, GrowthDashboard |
| `data-source-registry.ts` | B | DATA_SOURCE_REGISTRY (11 sources), KPI/dimension contribution mapping, availability tracking |
| `kpi-model.ts` | C | KPI_REGISTRY (15 KPIs), GrowthKPIDefinition, buildBlankMetric, formula descriptions and benchmarks |
| `recommendation-model.ts` | D | RECOMMENDATION_TEMPLATE_REGISTRY (9 categories), GrowthRecommendationTemplate, buildRecommendationShell |
| `dashboard-compat.ts` | E | DASHBOARD_REGISTRY (6 types), GrowthDashboardDescriptor, buildEmptyDashboard, getDashboardDataRequirement |
| `growth-ai.ts` | F | GROWTH_AI_WORKFLOW_REGISTRY (3 workflows), GrowthAIContext, GrowthAIExecutionPlan (deferred), cross-feed builders |
| `index.ts` | — | Public barrel export for `@/lib/growth` |

---

## §4 — Growth Dimensions

10 business dimensions that organize all KPIs, insights, and recommendations:

| Dimension | Description | Key KPIs |
|-----------|-------------|----------|
| `revenue` | Revenue and repair order value | average_repair_order_value, average_coating_revenue |
| `customer_retention` | Repeat visit rate, churn, loyalty | customer_retention_rate, repeat_visit_rate, maintenance_conversion_rate |
| `acquisition` | New customer growth | new_customer_rate |
| `operations` | Work order throughput, staff efficiency | work_order_completion_rate, estimate_approval_rate |
| `marketing` | Campaign ROI, channel performance | campaign_conversion_rate |
| `reputation` | Review volume, rating, response rate | review_conversion_rate, review_response_rate |
| `line_engagement` | LINE open rates, click-through | line_engagement_rate, line_opt_in_rate |
| `inventory` | Product and coating stock | (via work orders + products) |
| `seasonal` | Seasonal demand patterns | (cross-KPI analysis) |
| `ai_performance` | AI agent ROI (Phase 11I+) | monthly_growth_score (partial) |

---

## §5 — KPI Registry

15 canonical KPIs with formulas, benchmarks, and data source requirements:

| KPI ID | Label | Unit | Benchmark | Dimensions |
|--------|-------|------|-----------|------------|
| `customer_retention_rate` | Customer Retention Rate | % | 45% | customer_retention |
| `repeat_visit_rate` | Repeat Visit Rate | % | 55% | customer_retention |
| `average_repair_order_value` | Average RO Value | JPY | ¥65,000 | revenue |
| `average_coating_revenue` | Average Coating Revenue | JPY | ¥80,000 | revenue |
| `maintenance_conversion_rate` | Maintenance Conversion | % | 30% | customer_retention |
| `review_conversion_rate` | Review Conversion Rate | % | 20% | reputation |
| `review_response_rate` | Review Response Rate | % | 80% | reputation |
| `line_engagement_rate` | LINE Engagement Rate | % | 35% | line_engagement |
| `campaign_conversion_rate` | Campaign Conversion | % | 8% | marketing |
| `monthly_growth_score` | Monthly Growth Score | score | 65 | revenue (composite) |
| `new_customer_rate` | New Customer Rate | % | 25% | acquisition |
| `customer_lifetime_value` | Customer LTV | JPY | ¥150,000 | customer_retention |
| `work_order_completion_rate` | WO Completion Rate | % | 92% | operations |
| `estimate_approval_rate` | Estimate Approval Rate | % | 68% | operations |
| `line_opt_in_rate` | LINE Opt-In Rate | % | 40% | line_engagement |

All KPIs have `calculation_deferred: true` in Sprint 11H. Real calculation requires Phase 11I data layer.

---

## §6 — Data Source Registry

11 data sources with KPI contribution mapping:

| Source | Module | Availability | Key KPIs |
|--------|--------|--------------|----------|
| customers | src/lib/customers | available | retention_rate, new_customer_rate, LTV |
| vehicles | src/lib/vehicles | available | maintenance_conversion, coating_revenue |
| estimates | src/lib/estimates | available | approval_rate, RO_value |
| work_orders | src/lib/work-orders | available | completion_rate, RO_value, retention |
| completion_reports | src/lib/completion-reports | available | review_conversion, completion_rate |
| payments | src/lib/payments | available | RO_value, LTV |
| products | src/lib/products | available | coating_revenue, RO_value |
| media_platform | src/lib/media | partial | campaign_conversion, growth_score |
| ai_marketing_platform | src/lib/marketing | partial | campaign_conversion, line_engagement |
| ai_reputation_platform | src/lib/reputation | partial | review_conversion, review_response |
| line_automation_platform | src/lib/line-automation | partial | line_engagement, opt_in_rate |

"partial" = module exists but Growth Platform query integration is Sprint 11I+.

---

## §7 — Recommendation Model

9 recommendation categories with templates:

| Category | Dimension | Default Priority | Effort | AI Required |
|----------|-----------|-----------------|--------|-------------|
| revenue_growth | revenue | 1 (highest) | medium | Yes |
| customer_retention | customer_retention | 1 | medium | No |
| maintenance_reminders | customer_retention | 2 | low | No |
| marketing_opportunities | marketing | 2 | medium | Yes |
| review_improvement | reputation | 2 | low | No |
| inventory_optimization | inventory | 3 | low | No |
| staff_productivity | operations | 3 | medium | No |
| service_mix_optimization | revenue | 2 | medium | Yes |
| seasonal_campaigns | seasonal | 2 | medium | Yes |

Each template includes:
- `trigger_kpis`: which KPIs below benchmark trigger this recommendation
- `action_step_templates`: 4 concrete action steps (AI personalizes these in Phase 11I+)
- `expected_lift`: estimated improvement from executing the recommendation

---

## §8 — Dashboard Compatibility

6 dashboard types with their data requirements:

| Dashboard | Audience | KPIs | Recs | AI Narrative | Refresh |
|-----------|----------|------|------|--------------|---------|
| executive | owner | 5 | 3 | Yes | daily |
| dealer | dealer | 5 | 5 | No | daily |
| staff | staff | 2 | 2 | No | realtime |
| ai_summary | dealer | 1 | 1 | Yes | daily |
| monthly_report | owner | 9 | 9 | Yes | monthly |
| weekly_insights | dealer | 3 | 1 | No | weekly |

`GrowthDashboardDataRequirement` tells future server actions exactly what to fetch per dashboard type.

---

## §9 — AI Integration

### Three agents in the Growth Platform

| Agent | Role | Cross-Feed Direction |
|-------|------|---------------------|
| growth_agent | Primary — analysis, scoring, recommendation generation | receives from marketing_agent, reputation_agent |
| marketing_agent | Campaign performance data | → growth_agent (marketing dimension) |
| reputation_agent | Review signal data | → growth_agent (reputation dimension) |

### Three AI workflows

| Workflow | Trigger | Primary Agent | Output |
|----------|---------|---------------|--------|
| growth_analysis | On-demand or scheduled | growth_agent | GrowthScore, GrowthInsight[] |
| recommendation_generation | After growth_analysis | growth_agent + marketing_agent | GrowthRecommendation[] |
| monthly_report | End of month | growth_agent | GrowthReport with executive_summary |

### Cross-feed protocol

Agents never call each other directly. All cross-agent data exchange:
1. Uses `GrowthAgentCrossFeed` (typed, versioned payload)
2. Routes through the AI Gateway (`requires_gateway: true`)
3. Is never a direct function call between agent modules

### GrowthAIExecutionPlan

`buildGrowthAIExecutionPlan(workflow, context)` creates a typed plan with `execution_deferred: true` — a literal type that prevents accidental execution in Sprint 11H.

---

## §10 — GrowthScore Design

The `monthly_growth_score` (0–100) is computed as a weighted average of normalized per-dimension scores:

| Dimension | Weight (indicative) |
|-----------|---------------------|
| revenue | 25% |
| customer_retention | 25% |
| operations | 15% |
| reputation | 15% |
| marketing | 10% |
| line_engagement | 10% |

Exact weights are determined by the growth_agent at runtime (Phase 11I+). The weights may be adjusted based on dealer plan, market conditions, and historical performance.

`GrowthScore.breakdown` exposes per-dimension scores so dealers can see which area is dragging their overall score.

---

## §11 — Security Constraints

All security constraints from the master specification apply:

1. **dealer_id**: Always from `getCurrentDealer()` in `GrowthAIContext` and every server-side growth function. Never from client input, URL parameters, or form data.
2. **Read-only**: Growth Platform never writes to source platform tables. No RLS changes needed.
3. **No schema changes without CTO approval**: Phase 11I will require a `growth_reports` and possibly `growth_kpi_cache` table. Both require CTO approval before migration.
4. **AI key isolation**: growth_agent uses the dealer's own AI provider key via the AI Gateway. Office AZ does not pay AI inference costs.
5. **Cross-feed isolation**: `GrowthAgentCrossFeed.requires_gateway = true` (literal) ensures all cross-agent data flows through the gateway, never via direct module imports.

---

## §12 — Phase Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **Sprint 11H** | **AI Growth Platform Foundation** | **Complete (this document)** |
| Sprint 11I | KPI calculation query layer — real data | Planned |
| Sprint 11I | growth_agent runtime + gateway wiring | Planned |
| Sprint 11I | GrowthAIExecutionPlan execution | Planned |
| Sprint 11I | growth_reports DB table (CTO approval required) | Planned |
| Sprint 11J | Executive Dashboard UI component | Planned |
| Sprint 11J | Dealer Dashboard UI component | Planned |
| Sprint 11K | Monthly AI Report generation | Planned |
| Sprint 11K | Weekly Insights digest + LINE delivery | Planned |
| Sprint 11L | Staff Dashboard | Planned |

---

## §13 — Implementation Notes

### execution_deferred: true as a literal type

`GrowthAIExecutionPlan.execution_deferred`, `GrowthScore.execution_deferred`, `GrowthInsight.execution_deferred`, `GrowthRecommendation.execution_deferred`, `GrowthOpportunity.execution_deferred`, `GrowthReport.execution_deferred`, and `GrowthDashboard.execution_deferred` are all typed as the literal `true`. This prevents any code path from accidentally treating AI execution as possible in Sprint 11H.

### KPI benchmark values

Benchmarks are estimates for the Japanese automotive detailing market as of 2026. They are not sourced from a published benchmark study — they represent reasonable targets for a GYEON dealer operating a modern CRM and LINE automation stack. The growth_agent may refine benchmarks using industry data in Phase 11I+.

### Pure modules

All Sprint 11H modules are pure TypeScript — no `"use server"`, no async, no DB calls, no external network calls. They can be imported freely from both server and client contexts.

### Adding a new KPI

1. Add the KPI ID to `GrowthMetricId` in `growth-types.ts`
2. Add the KPI definition to `KPI_REGISTRY` in `kpi-model.ts`
3. Add data source contributions in `DATA_SOURCE_REGISTRY` in `data-source-registry.ts`
4. Add the KPI to relevant dashboard `pinned_kpis` in `dashboard-compat.ts`
5. Export from `index.ts` if new types are needed
