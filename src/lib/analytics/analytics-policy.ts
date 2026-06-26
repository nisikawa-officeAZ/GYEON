// GYEON Business Hub — Analytics & Reporting Center: Privacy & Role Policy (Sprint 11Z)
//
// Governance rules for analytics visibility, data access, and role-based restrictions.
//
// ANL-001 through ANL-006: strict — must never be violated
// ANL-007 through ANL-008: advisory — best-practice guidelines
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  AnalyticsPolicy,
  AnalyticsVisibilityScope,
} from "./analytics-types";

// ─── Policy declarations ──────────────────────────────────────────────────────

const ANL_POLICIES: AnalyticsPolicy[] = [
  {
    policy_id:   "ANL-001",
    title:       "Analytics Data Isolated Per Tenant",
    description:
      "All analytics data (metrics, reports, insights, dashboard state) must be scoped " +
      "to the tenant (dealer_id for Dealer Agent; company_id for GYEON Distribution). " +
      "Cross-tenant reads are prohibited at the application layer. " +
      "Platform-level aggregates visible to platform admins must be anonymized — " +
      "they must not reveal individual tenant values unless the requesting user has " +
      "explicit platform admin authority.",
    enforcement: "strict",
    rationale:
      "Revenue, order volume, and customer count are commercially sensitive. " +
      "A dealer must never see another dealer's performance data. " +
      "This policy applies even when tenants share a Supabase instance or organization.",
    applies_to:  "all",
  },
  {
    policy_id:   "ANL-002",
    title:       "Revenue and Financial Data Restricted to Authorized Roles",
    description:
      "Metrics in the 'sales', 'accounting', and 'subscription_billing' groups — " +
      "including monthly_revenue, average_order_value, accounts_receivable, " +
      "and MRR — must only be visible to roles with dealer or company scope: " +
      "dealer_owner, branch_manager, company_admin, platform_admin. " +
      "dealer_staff may NOT view revenue or financial metrics unless explicitly " +
      "granted by the dealer_owner via a future role permission override.",
    enforcement: "strict",
    rationale:
      "Revenue data is sensitive internally. Staff knowing exact revenue figures " +
      "creates negotiation leverage and compensation disputes. Default to restricting " +
      "financial visibility to owners and managers only.",
    applies_to:  ["dealer", "company", "platform"] satisfies AnalyticsVisibilityScope[],
  },
  {
    policy_id:   "ANL-003",
    title:       "Staff-Level Analytics Must Exclude Personally Identifiable Customer Data",
    description:
      "Dashboards and reports visible at the 'staff' scope must not include " +
      "customer names, phone numbers, LINE IDs, email addresses, or any other PII. " +
      "Staff dashboards may show aggregate counts and operational metrics " +
      "(work order count, pending estimates) but must not surface customer identities " +
      "in analytics views.",
    enforcement: "strict",
    rationale:
      "Analytics views aggregate data for trend analysis — they are not customer lookup tools. " +
      "Including PII in analytics outputs creates unnecessary privacy exposure and " +
      "conflicts with GDPR and APPI (個人情報保護法) data minimization principles.",
    applies_to:  ["staff"] satisfies AnalyticsVisibilityScope[],
  },
  {
    policy_id:   "ANL-004",
    title:       "AI Insights Require Minimum Data Points Before Display",
    description:
      "An AI insight must not be displayed unless its requires_minimum_data_points " +
      "threshold has been met in the relevant metric group. " +
      "A dashboard or report that has insufficient data must display a " +
      "'Insufficient data — check back after [date]' message rather than " +
      "a low-confidence AI insight. The minimum thresholds are declared per insight " +
      "type in the Analytics Insight Registry.",
    enforcement: "strict",
    rationale:
      "AI insights based on sparse data produce false signals. A dealer who receives " +
      "an 'anomaly detected' warning on day 3 of using the platform will lose trust " +
      "in the analytics system. Minimum data thresholds are a quality gate, not an " +
      "option.",
    applies_to:  "all",
  },
  {
    policy_id:   "ANL-005",
    title:       "Analytics Data Must Not Be Cached Beyond Session Without Encryption",
    description:
      "Analytics query results, dashboard metric values, and report data must not " +
      "be persisted in the browser (localStorage, sessionStorage, IndexedDB) or in " +
      "unencrypted server-side caches beyond the active user session. " +
      "Server-side caching for performance is permitted only with encryption at rest " +
      "and a TTL of no more than 1 hour for financial metrics.",
    enforcement: "strict",
    rationale:
      "Revenue and financial metrics cached in the browser can be read by other " +
      "users on shared devices or by browser extensions. The risk is highest for " +
      "dealer workshops where multiple staff share a workstation.",
    applies_to:  "all",
  },
  {
    policy_id:   "ANL-006",
    title:       "Platform-Level Aggregates Must Not Reveal Individual Dealer Identities",
    description:
      "When platform admins view cross-tenant analytics (Executive Dashboard, " +
      "Subscription Dashboard), aggregated metrics must not identify individual " +
      "tenants unless the admin navigates explicitly to a dealer's detail view. " +
      "Summary charts and totals must use cohort or tier-level grouping, " +
      "not dealer names or IDs.",
    enforcement: "strict",
    rationale:
      "Platform admins should see health of the platform, not a ranked list of " +
      "dealer revenues that could create preferential treatment or information leakage " +
      "between franchise partners.",
    applies_to:  ["platform"] satisfies AnalyticsVisibilityScope[],
  },
  {
    policy_id:   "ANL-007",
    title:       "Dashboards Should Default to the Most Conservative Visibility Scope",
    description:
      "When a user's role is ambiguous or a permission check cannot be resolved, " +
      "dashboards should default to the 'staff' visibility scope — the most restricted. " +
      "Promoted scope (dealer, company, platform) requires an affirmative permission " +
      "grant, not assumed from the user's session.",
    enforcement: "advisory",
    rationale:
      "Defaulting to maximum visibility when permissions are unclear is a security " +
      "anti-pattern. Defaulting to minimum visibility ensures no accidental exposure " +
      "while the correct permission is established.",
    applies_to:  "all",
  },
  {
    policy_id:   "ANL-008",
    title:       "AI Summaries Should Be Reviewed for Accuracy Before External Sharing",
    description:
      "AI-generated report summaries (from 'ai_summary' insight type) should include " +
      "a 'generated by AI' disclosure when displayed and should present a review " +
      "step before the summary can be exported or shared externally (e.g. copied " +
      "into a message to a GYEON Japan regional contact).",
    enforcement: "advisory",
    rationale:
      "AI-generated text can occasionally misrepresent nuanced business situations. " +
      "A review step before external sharing prevents a dealer from sending an " +
      "inaccurate or misleading performance summary to their distributor or franchisor.",
    applies_to:  "all",
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ANALYTICS_POLICIES: AnalyticsPolicy[] = ANL_POLICIES;

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getAnalyticsPolicy(
  policy_id: string,
): AnalyticsPolicy | undefined {
  return ANALYTICS_POLICIES.find((p) => p.policy_id === policy_id);
}

export function getStrictAnalyticsPolicies(): AnalyticsPolicy[] {
  return ANALYTICS_POLICIES.filter((p) => p.enforcement === "strict");
}

export function getAdvisoryAnalyticsPolicies(): AnalyticsPolicy[] {
  return ANALYTICS_POLICIES.filter((p) => p.enforcement === "advisory");
}

export function getPoliciesForScope(
  scope: AnalyticsVisibilityScope,
): AnalyticsPolicy[] {
  return ANALYTICS_POLICIES.filter(
    (p) =>
      p.applies_to === "all" ||
      (Array.isArray(p.applies_to) && p.applies_to.includes(scope)),
  );
}

export function getUniversalAnalyticsPolicies(): AnalyticsPolicy[] {
  return ANALYTICS_POLICIES.filter((p) => p.applies_to === "all");
}
