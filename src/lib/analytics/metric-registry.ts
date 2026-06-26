// GYEON Business Hub — Analytics & Reporting Center: Metric Registry (Sprint 11Z)
//
// Shared metric registry covering all 14 metric groups across all platform applications.
// Metadata declarations only — no values, no calculations, no DB queries.
//
// Metrics are identified by "{group}.{slug}" format: e.g. "sales.monthly_revenue".
// Each metric declares its source application, visibility scope, value type, and
// available timeframes.
//
// Pure — no "use server", no async, no DB calls, no external calls, no calculations.

import type {
  AnalyticsMetricDescriptor,
  AnalyticsMetricGroupId,
  AnalyticsMetricValueType,
  AnalyticsTimeframe,
  AnalyticsVisibilityScope,
} from "./analytics-types";

// ─── Builder helper ───────────────────────────────────────────────────────────

const STANDARD_TIMEFRAMES: AnalyticsTimeframe[] = [
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "last_12_months",
  "month_to_date",
  "year_to_date",
];

function metric(
  slug:               string,
  display_name:       string,
  group:              AnalyticsMetricGroupId,
  description:        string,
  value_type:         AnalyticsMetricValueType,
  unit:               string | null,
  visibility:         AnalyticsVisibilityScope,
  source_application: string,
  requires_ai:        boolean = false,
  status:             "active" | "planned" = "planned",
  timeframes:         AnalyticsTimeframe[] = STANDARD_TIMEFRAMES,
): AnalyticsMetricDescriptor {
  return {
    metric_id:            `${group}.${slug}`,
    display_name,
    group,
    description,
    value_type,
    unit,
    available_timeframes: timeframes,
    visibility_scope:     visibility,
    source_application,
    requires_ai,
    status,
  };
}

// ─── Group 1: Dealer Operations ───────────────────────────────────────────────

const DEALER_OPERATIONS_METRICS: AnalyticsMetricDescriptor[] = [
  metric("monthly_throughput",       "Monthly Vehicle Throughput",     "dealer_operations", "Total vehicles completed in the period.",                "count",      null,      "dealer",  "dealer_agent"),
  metric("work_order_completion_rate","Work Order Completion Rate",     "dealer_operations", "Percentage of open work orders completed on schedule.",  "percentage", "%",       "dealer",  "dealer_agent"),
  metric("average_job_duration",     "Average Job Duration",           "dealer_operations", "Mean hours from work order open to completion.",         "duration",   "hours",   "dealer",  "dealer_agent"),
  metric("staff_utilization_rate",   "Staff Utilization Rate",         "dealer_operations", "Billable hours as a percentage of available staff hours.","percentage", "%",       "dealer",  "dealer_agent"),
  metric("peak_hour_load",           "Peak Hour Load Index",           "dealer_operations", "Ratio of busiest hour bookings to capacity.",            "ratio",      null,       "dealer",  "dealer_agent"),
  metric("active_jobs_in_shop",      "Active Jobs In Shop",            "dealer_operations", "Current count of vehicles being processed.",             "count",      null,       "staff",   "dealer_agent"),
];

// ─── Group 2: Sales ───────────────────────────────────────────────────────────

const SALES_METRICS: AnalyticsMetricDescriptor[] = [
  metric("monthly_revenue",         "Monthly Revenue",                 "sales", "Total invoiced revenue for the period.",                     "currency",   "JPY",     "dealer",  "dealer_agent"),
  metric("average_order_value",     "Average Order Value",             "sales", "Mean revenue per completed work order.",                     "currency",   "JPY",     "dealer",  "dealer_agent"),
  metric("revenue_per_vehicle",     "Revenue Per Vehicle",             "sales", "Total revenue divided by vehicles serviced.",                "currency",   "JPY",     "dealer",  "dealer_agent"),
  metric("revenue_growth_rate",     "Revenue Growth Rate",             "sales", "Period-over-period revenue growth as a percentage.",         "percentage", "%",       "dealer",  "dealer_agent"),
  metric("top_service_revenue",     "Top Service by Revenue",          "sales", "Revenue breakdown by service category.",                    "currency",   "JPY",     "dealer",  "dealer_agent"),
  metric("discount_rate",           "Discount Rate",                   "sales", "Discounts applied as a percentage of gross revenue.",       "percentage", "%",       "dealer",  "dealer_agent"),
];

// ─── Group 3: Estimates ───────────────────────────────────────────────────────

const ESTIMATES_METRICS: AnalyticsMetricDescriptor[] = [
  metric("estimate_count",          "Estimates Created",               "estimates", "Total estimate documents created in the period.",           "count",      null,      "dealer",  "dealer_agent"),
  metric("estimate_approval_rate",  "Estimate Approval Rate",          "estimates", "Percentage of estimates approved by customers.",            "percentage", "%",       "dealer",  "dealer_agent"),
  metric("average_estimate_value",  "Average Estimate Value",          "estimates", "Mean value of all estimates created.",                     "currency",   "JPY",     "dealer",  "dealer_agent"),
  metric("estimate_to_wo_rate",     "Estimate to Work Order Rate",     "estimates", "Percentage of approved estimates converted to work orders.","percentage", "%",       "dealer",  "dealer_agent"),
  metric("pending_estimates",       "Pending Estimates",               "estimates", "Estimates awaiting customer decision.",                     "count",      null,      "staff",   "dealer_agent"),
  metric("rejected_estimate_rate",  "Rejected Estimate Rate",          "estimates", "Percentage of estimates rejected or abandoned.",           "percentage", "%",       "dealer",  "dealer_agent"),
];

// ─── Group 4: Work Orders ─────────────────────────────────────────────────────

const WORK_ORDERS_METRICS: AnalyticsMetricDescriptor[] = [
  metric("open_work_orders",        "Open Work Orders",                "work_orders", "Work orders currently in progress.",                         "count",    null,      "staff",   "dealer_agent"),
  metric("completed_work_orders",   "Completed Work Orders",           "work_orders", "Work orders completed in the period.",                      "count",    null,      "dealer",  "dealer_agent"),
  metric("average_completion_time", "Average Completion Time",         "work_orders", "Mean duration in hours from open to completion.",           "duration", "hours",   "dealer",  "dealer_agent"),
  metric("overdue_work_orders",     "Overdue Work Orders",             "work_orders", "Work orders past their promised completion date.",          "count",    null,      "dealer",  "dealer_agent"),
  metric("work_order_revenue",      "Work Order Revenue",              "work_orders", "Total revenue from completed work orders.",                 "currency", "JPY",     "dealer",  "dealer_agent"),
  metric("rework_rate",             "Rework Rate",                     "work_orders", "Percentage of completed jobs requiring rework.",            "percentage","%",      "dealer",  "dealer_agent"),
];

// ─── Group 5: Maintenance ─────────────────────────────────────────────────────

const MAINTENANCE_METRICS: AnalyticsMetricDescriptor[] = [
  metric("reminders_sent",          "Maintenance Reminders Sent",      "maintenance", "Total maintenance reminder messages sent in the period.",   "count",      null,      "dealer",  "dealer_agent"),
  metric("conversion_rate",         "Maintenance Conversion Rate",     "maintenance", "Percentage of reminders that resulted in a booked job.",    "percentage", "%",       "dealer",  "dealer_agent"),
  metric("average_interval",        "Average Maintenance Interval",    "maintenance", "Mean days between a customer's maintenance visits.",        "duration",   "days",    "dealer",  "dealer_agent"),
  metric("overdue_count",           "Overdue Maintenance Count",       "maintenance", "Customers past their recommended maintenance date.",        "count",      null,      "staff",   "dealer_agent"),
  metric("coating_distribution",    "Coating Type Distribution",       "maintenance", "Breakdown of active coating types requiring maintenance.",  "count",      null,      "dealer",  "dealer_agent"),
  metric("maintenance_revenue",     "Maintenance Revenue",             "maintenance", "Revenue from maintenance-driven service bookings.",         "currency",   "JPY",     "dealer",  "dealer_agent"),
];

// ─── Group 6: Communication ───────────────────────────────────────────────────

const COMMUNICATION_METRICS: AnalyticsMetricDescriptor[] = [
  metric("messages_sent",           "Messages Sent",                   "communication", "Total outbound messages across all channels.",              "count",      null,      "dealer",  "dealer_agent"),
  metric("messages_received",       "Messages Received",               "communication", "Total inbound messages received from customers.",           "count",      null,      "dealer",  "dealer_agent"),
  metric("response_rate",           "Customer Response Rate",          "communication", "Percentage of sent messages that received a reply.",        "percentage", "%",       "dealer",  "dealer_agent"),
  metric("average_response_time",   "Average Response Time",           "communication", "Mean time from message receipt to staff reply.",            "duration",   "minutes", "dealer",  "dealer_agent"),
  metric("channel_distribution",    "Channel Distribution",            "communication", "Message volume breakdown by channel (LINE, Email, SMS).",   "count",      null,      "dealer",  "dealer_agent"),
  metric("opt_out_rate",            "Opt-Out Rate",                    "communication", "Percentage of contacts who unsubscribed in the period.",    "percentage", "%",       "dealer",  "dealer_agent"),
];

// ─── Group 7: Reviews ─────────────────────────────────────────────────────────

const REVIEWS_METRICS: AnalyticsMetricDescriptor[] = [
  metric("total_reviews",           "Total Reviews",                   "reviews", "Cumulative review count across all platforms.",               "count",      null,      "dealer",  "dealer_agent"),
  metric("average_rating",          "Average Rating",                  "reviews", "Mean star rating across all review platforms.",               "score",      "stars",   "dealer",  "dealer_agent"),
  metric("review_conversion_rate",  "Review Conversion Rate",          "reviews", "Percentage of completed jobs that resulted in a review.",     "percentage", "%",       "dealer",  "dealer_agent"),
  metric("review_requests_sent",    "Review Requests Sent",            "reviews", "Total review request messages sent.",                         "count",      null,      "dealer",  "dealer_agent"),
  metric("review_response_rate",    "Review Response Rate",            "reviews", "Percentage of reviews that received an owner response.",      "percentage", "%",       "dealer",  "dealer_agent"),
  metric("rating_trend",            "Rating Trend",                    "reviews", "Direction of average rating over the selected period.",       "score",      null,      "dealer",  "dealer_agent"),
];

// ─── Group 8: SNS / Marketing ─────────────────────────────────────────────────

const SNS_MARKETING_METRICS: AnalyticsMetricDescriptor[] = [
  metric("posts_published",         "Social Posts Published",          "sns_marketing", "Total posts published across social platforms.",             "count",      null,      "dealer",  "dealer_agent"),
  metric("estimated_reach",         "Estimated Social Reach",          "sns_marketing", "Combined audience reach across platforms (estimated).",     "count",      null,      "dealer",  "dealer_agent", true),
  metric("engagement_rate",         "Engagement Rate",                 "sns_marketing", "Likes + comments + shares as a percentage of reach.",       "percentage", "%",       "dealer",  "dealer_agent"),
  metric("ai_captions_generated",   "AI Captions Generated",           "sns_marketing", "Number of SNS captions generated using AI assistance.",     "count",      null,      "dealer",  "dealer_agent", true),
  metric("campaign_count",          "Campaigns Published",             "sns_marketing", "Total marketing campaigns run in the period.",              "count",      null,      "dealer",  "dealer_agent"),
  metric("follower_growth",         "Follower Growth",                 "sns_marketing", "Net new followers across tracked social accounts.",         "count",      null,      "dealer",  "dealer_agent"),
];

// ─── Group 9: AI Usage ────────────────────────────────────────────────────────

const AI_USAGE_METRICS: AnalyticsMetricDescriptor[] = [
  metric("requests_total",          "Total AI Requests",               "ai_usage", "Total AI API calls made in the period.",                    "count",    null,       "dealer",  "ai_operations", true),
  metric("tokens_consumed",         "AI Tokens Consumed",              "ai_usage", "Total LLM tokens consumed across all AI capabilities.",     "count",    "tokens",   "dealer",  "ai_operations", true),
  metric("cost_estimate",           "AI Cost Estimate",                "ai_usage", "Estimated AI API cost for the period (dealer-owned keys).","currency", "JPY",      "dealer",  "ai_operations", true),
  metric("capability_breakdown",    "AI Usage by Capability",          "ai_usage", "Request count broken down by AI capability type.",          "count",    null,       "dealer",  "ai_operations", true),
  metric("acceptance_rate",         "AI Suggestion Acceptance Rate",   "ai_usage", "Percentage of AI suggestions accepted by staff.",           "percentage","%",       "dealer",  "ai_operations", true),
  metric("time_saved_estimate",     "Estimated Time Saved",            "ai_usage", "AI-assisted tasks vs estimated manual time equivalent.",    "duration", "minutes",  "dealer",  "ai_operations", true),
];

// ─── Group 10: Subscription / Billing ────────────────────────────────────────

const SUBSCRIPTION_BILLING_METRICS: AnalyticsMetricDescriptor[] = [
  metric("current_plan",            "Current Subscription Plan",       "subscription_billing", "Active subscription plan tier.",                           "count",    null,   "dealer",   "dealer_agent"),
  metric("mrr",                     "Monthly Recurring Revenue",       "subscription_billing", "Platform-level MRR across all active subscriptions.",      "currency", "JPY",  "platform", "dealer_agent"),
  metric("plan_upgrade_events",     "Plan Upgrade Events",             "subscription_billing", "Number of plan upgrades recorded in the period.",          "count",    null,   "platform", "dealer_agent"),
  metric("ai_budget_utilization",   "AI Budget Utilization",           "subscription_billing", "Percentage of configured AI budget consumed.",             "percentage","%",  "dealer",   "ai_operations", true),
  metric("feature_activation_rate", "Feature Activation Rate",         "subscription_billing", "Percentage of available features that are active.",        "percentage","%",  "dealer",   "dealer_agent"),
  metric("trial_to_paid",           "Trial to Paid Conversion Rate",   "subscription_billing", "Percentage of trials that converted to paid plans.",       "percentage","%",  "platform", "dealer_agent"),
];

// ─── Group 11: Distribution ───────────────────────────────────────────────────

const DISTRIBUTION_METRICS: AnalyticsMetricDescriptor[] = [
  metric("orders_received",         "B2B Orders Received",             "distribution", "Total B2B orders received from distributors.",               "count",    null,   "company", "enterprise_distribution"),
  metric("orders_fulfilled",        "Orders Fulfilled",                "distribution", "B2B orders shipped and completed.",                          "count",    null,   "company", "enterprise_distribution"),
  metric("average_order_value_b2b", "Average B2B Order Value",         "distribution", "Mean value of B2B distribution orders.",                     "currency", "JPY",  "company", "enterprise_distribution"),
  metric("distributor_count",       "Active Distributors",             "distribution", "Number of active distributor accounts.",                     "count",    null,   "company", "enterprise_distribution"),
  metric("sell_through_rate",       "Product Sell-Through Rate",       "distribution", "Percentage of distributed stock sold at point of service.", "percentage","%",   "company", "enterprise_distribution"),
  metric("backorder_rate",          "Backorder Rate",                  "distribution", "Percentage of orders with at least one backordered item.",  "percentage","%",   "company", "enterprise_distribution"),
];

// ─── Group 12: Warehouse ──────────────────────────────────────────────────────

const WAREHOUSE_METRICS: AnalyticsMetricDescriptor[] = [
  metric("inventory_items",         "Inventory Item Count",            "warehouse", "Total distinct SKUs in active inventory.",                   "count",    null,    "branch", "warehouse"),
  metric("stock_turnover_rate",     "Stock Turnover Rate",             "warehouse", "Times average inventory was sold/consumed per year.",        "ratio",    null,    "branch", "warehouse"),
  metric("low_stock_alerts",        "Low Stock Alerts",                "warehouse", "Items currently below reorder threshold.",                   "count",    null,    "branch", "warehouse"),
  metric("average_reorder_time",    "Average Reorder Lead Time",       "warehouse", "Mean days from reorder trigger to stock arrival.",           "duration", "days",  "branch", "warehouse"),
  metric("shrinkage_rate",          "Inventory Shrinkage Rate",        "warehouse", "Unaccounted inventory loss as a percentage of total stock.", "percentage","%",   "company","warehouse"),
  metric("capacity_utilization",    "Warehouse Capacity Utilization",  "warehouse", "Used storage space as a percentage of total capacity.",      "percentage","%",   "branch", "warehouse"),
];

// ─── Group 13: Accounting ─────────────────────────────────────────────────────

const ACCOUNTING_METRICS: AnalyticsMetricDescriptor[] = [
  metric("accounts_receivable",     "Accounts Receivable Total",       "accounting", "Total outstanding receivables at period end.",               "currency", "JPY",  "company", "accounting"),
  metric("days_sales_outstanding",  "Days Sales Outstanding (DSO)",    "accounting", "Average number of days to collect payment after invoicing.", "duration", "days", "company", "accounting"),
  metric("invoices_issued",         "Invoices Issued",                 "accounting", "Total invoices issued in the period.",                       "count",    null,   "company", "accounting"),
  metric("payment_collection_rate", "Payment Collection Rate",         "accounting", "Percentage of invoices paid within terms.",                  "percentage","%",   "company", "accounting"),
  metric("overdue_invoices",        "Overdue Invoices",                "accounting", "Invoices past payment due date.",                            "count",    null,   "company", "accounting"),
  metric("monthly_cash_flow",       "Monthly Net Cash Flow",           "accounting", "Net receipts minus disbursements for the period.",           "currency", "JPY",  "company", "accounting"),
];

// ─── Group 14: CRM ────────────────────────────────────────────────────────────

const CRM_METRICS: AnalyticsMetricDescriptor[] = [
  metric("active_customers",        "Active Customers",                "crm", "Customers with at least one service in the last 12 months.",  "count",      null,    "dealer", "crm"),
  metric("customer_lifetime_value", "Customer Lifetime Value",         "crm", "Mean total revenue per customer across their relationship.",  "currency",   "JPY",   "dealer", "crm"),
  metric("customer_retention_rate", "Customer Retention Rate",         "crm", "Percentage of customers who return for a second service.",    "percentage", "%",     "dealer", "crm"),
  metric("new_customers",           "New Customers Acquired",          "crm", "Customers with their first service in the period.",           "count",      null,    "dealer", "crm"),
  metric("churn_rate",              "Customer Churn Rate",             "crm", "Customers who have not returned after expected interval.",     "percentage", "%",     "dealer", "crm", true),
  metric("customer_satisfaction",   "Customer Satisfaction Score",     "crm", "Composite score from reviews, responses, and retention.",     "score",      null,    "dealer", "crm", true),
];

// ─── Unified registry ─────────────────────────────────────────────────────────

export const ANALYTICS_METRIC_REGISTRY: AnalyticsMetricDescriptor[] = [
  ...DEALER_OPERATIONS_METRICS,
  ...SALES_METRICS,
  ...ESTIMATES_METRICS,
  ...WORK_ORDERS_METRICS,
  ...MAINTENANCE_METRICS,
  ...COMMUNICATION_METRICS,
  ...REVIEWS_METRICS,
  ...SNS_MARKETING_METRICS,
  ...AI_USAGE_METRICS,
  ...SUBSCRIPTION_BILLING_METRICS,
  ...DISTRIBUTION_METRICS,
  ...WAREHOUSE_METRICS,
  ...ACCOUNTING_METRICS,
  ...CRM_METRICS,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getMetric(
  metric_id: string,
): AnalyticsMetricDescriptor | undefined {
  return ANALYTICS_METRIC_REGISTRY.find((m) => m.metric_id === metric_id);
}

export function getMetricsByGroup(
  group: AnalyticsMetricGroupId,
): AnalyticsMetricDescriptor[] {
  return ANALYTICS_METRIC_REGISTRY.filter((m) => m.group === group);
}

export function getMetricsByApplication(
  application_id: string,
): AnalyticsMetricDescriptor[] {
  return ANALYTICS_METRIC_REGISTRY.filter((m) => m.source_application === application_id);
}

export function getMetricsByVisibility(
  scope: import("./analytics-types").AnalyticsVisibilityScope,
): AnalyticsMetricDescriptor[] {
  const scopeOrder: Record<AnalyticsVisibilityScope, number> = {
    staff:    0,
    branch:   1,
    dealer:   2,
    company:  3,
    platform: 4,
  };
  return ANALYTICS_METRIC_REGISTRY.filter(
    (m) => scopeOrder[m.visibility_scope] <= scopeOrder[scope],
  );
}

export function getAIRequiredMetrics(): AnalyticsMetricDescriptor[] {
  return ANALYTICS_METRIC_REGISTRY.filter((m) => m.requires_ai);
}

export function getActiveMetrics(): AnalyticsMetricDescriptor[] {
  return ANALYTICS_METRIC_REGISTRY.filter((m) => m.status === "active");
}

export function getMetricGroupIds(): AnalyticsMetricGroupId[] {
  return [
    "dealer_operations",
    "sales",
    "estimates",
    "work_orders",
    "maintenance",
    "communication",
    "reviews",
    "sns_marketing",
    "ai_usage",
    "subscription_billing",
    "distribution",
    "warehouse",
    "accounting",
    "crm",
  ];
}
