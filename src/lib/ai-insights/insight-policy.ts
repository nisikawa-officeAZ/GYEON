// GYEON Business Hub — AI Insights Dashboard: Policy Registry (Sprint 12B)
//
// Governance policies for the AI Insights module.
// All AI insight generation, display, and access must comply with these policies.
//
// Pure — no "use server", no async, no DB calls, no external calls, no AI execution.

// ─── Policy type ──────────────────────────────────────────────────────────────

export type AIInsightPolicyEnforcement = "strict" | "advisory";

export interface AIInsightPolicy {
  policy_id:   string;             // AIP-001...
  title:       string;
  description: string;
  enforcement: AIInsightPolicyEnforcement;
  rationale:   string;
}

// ─── Policy registry ──────────────────────────────────────────────────────────

export const AI_INSIGHT_POLICIES: AIInsightPolicy[] = [
  {
    policy_id:   "AIP-001",
    title:       "No AI Execution Without Gateway",
    description: "AI insights must not invoke any AI provider, model, or external service " +
                 "unless the AI Gateway (src/lib/ai/check-ai-gateway.ts) confirms 'ready' status " +
                 "for the dealer's configured provider. Deterministic insights are always allowed.",
    enforcement: "strict",
    rationale:   "Prevents unintentional API key usage, cost overruns, and privacy leaks. " +
                 "The gateway check also validates plan entitlement before AI execution.",
  },
  {
    policy_id:   "AIP-002",
    title:       "Revenue Insights Require Finance Role",
    description: "Any insight that references financial data (sales totals, invoice amounts, " +
                 "receivables, outstanding balances) must only be rendered when canViewFinance(role) " +
                 "returns true. The filter must be applied server-side before passing insights to " +
                 "any React component. Revenue insight titles and labels must not appear in any " +
                 "response delivered to staff or readonly roles.",
    enforcement: "strict",
    rationale:   "Financial data visibility is an ownership and legal concern. Staff roles " +
                 "must not be able to infer revenue figures through indirect means such as " +
                 "insight labels, tooltips, placeholders, or error messages.",
  },
  {
    policy_id:   "AIP-003",
    title:       "No Fake Metrics or Fabricated Insight Content",
    description: "Insight content must be derived from real data from getDashboardSummary() " +
                 "or declared as a placeholder with data_status: 'not_connected' or 'ai_required'. " +
                 "It is strictly forbidden to display fabricated numbers, example values, or " +
                 "mock AI output as if they were real. All placeholder states must be clearly " +
                 "labelled as such in the UI.",
    enforcement: "strict",
    rationale:   "Fabricated data causes incorrect business decisions. Dealers must be able " +
                 "to trust that every number shown on the dashboard reflects their actual data.",
  },
  {
    policy_id:   "AIP-004",
    title:       "Data Status Must Be Declared",
    description: "Every AIInsight object must set a data_status field: 'connected', " +
                 "'not_connected', 'insufficient', or 'ai_required'. The UI panel must " +
                 "render an appropriate visual state for each status. A 'connected' status " +
                 "must only be used when the data source is genuinely integrated.",
    enforcement: "strict",
    rationale:   "Dealers need to know which insights are grounded in real data vs. future " +
                 "capabilities. Undeclared status leads to confusion about dashboard reliability.",
  },
  {
    policy_id:   "AIP-005",
    title:       "KPI Names Must Not Leak Through UI Labels",
    description: "Revenue or sensitive KPI metric IDs (e.g., 'sales.monthly_revenue', " +
                 "'accounting.accounts_receivable') must not appear in UI labels, tooltips, " +
                 "ARIA attributes, or HTML comments in any page response delivered to staff " +
                 "or readonly roles. Insights are filtered by role before being passed to " +
                 "components. Components must not access metric IDs from hidden props.",
    enforcement: "strict",
    rationale:   "Internal metric identifiers could indirectly reveal financial structure or " +
                 "data schemas to unauthorized users through browser DevTools inspection.",
  },
  {
    policy_id:   "AIP-006",
    title:       "Advanced AI Insights Require Subscription Entitlement",
    description: "AI-powered insights (growth_opportunity, anomaly_detection, ai_summary) " +
                 "require the 'growth_ai' or higher subscription entitlement. The dashboard " +
                 "may show that these insights exist but must label them as requiring a plan " +
                 "upgrade. The requires_ai_entitlement field on AIInsight declares the minimum " +
                 "required entitlement. Do not fake entitlement status.",
    enforcement: "advisory",
    rationale:   "AI inference costs are significant. Plan gating ensures costs are aligned " +
                 "with the dealer's subscription tier. Advisory in Sprint 12B as gating is " +
                 "not yet enforced at runtime.",
  },
  {
    policy_id:   "AIP-007",
    title:       "Insights Must Reference Source Metrics",
    description: "Every AIInsight with data_status 'connected' should populate " +
                 "metrics_referenced with at least one metric ID from the Analytics Center " +
                 "registry. This supports future audit trails and AI agent traceability.",
    enforcement: "advisory",
    rationale:   "Metric references allow the AI Gateway to verify that insight content " +
                 "is grounded in declared platform metrics, not hallucinated data.",
  },
] as const;

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function getAIInsightPolicy(policy_id: string): AIInsightPolicy | undefined {
  return AI_INSIGHT_POLICIES.find(p => p.policy_id === policy_id);
}

export function getStrictAIInsightPolicies(): AIInsightPolicy[] {
  return AI_INSIGHT_POLICIES.filter(p => p.enforcement === "strict");
}

export function getAdvisoryAIInsightPolicies(): AIInsightPolicy[] {
  return AI_INSIGHT_POLICIES.filter(p => p.enforcement === "advisory");
}
