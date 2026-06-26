// Pure types — no "use server" directive

// ─── App identity ─────────────────────────────────────────────────────────────

/** Current app variant. Future: 'detailer' for the generic Detailer Agent. */
export const APP_VARIANT = "gyeon" as const;
export type  AppVariant  = "gyeon" | "detailer";

export const APP_NAME       = "GYEON Detailer Agent";
export const APP_NAME_JA    = "GYEON ディテーラーエージェント";
export const APP_SUBTITLE   = "Powered by GYEON Japan";

// ─── Plans ────────────────────────────────────────────────────────────────────

export type DealerPlan         = "basic" | "pro" | "pro_plus";
export type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled";

export interface DealerPlanInfo {
  plan:                DealerPlan;
  subscription_status: SubscriptionStatus;
  started_at:          string | null;
  expired_at:          string | null;
}

// ─── Feature matrix ───────────────────────────────────────────────────────────

export type AppFeature =
  // Basic
  | "customers"
  | "vehicles"
  | "estimates"
  | "estimate_pdf"
  | "products"
  | "product_orders"
  // Pro
  | "work_orders"
  | "calendar"
  | "reservations"
  | "completion_reports"
  | "invoices"
  | "payments"
  | "maintenance"
  // Pro Plus
  | "line"
  | "line_crm"
  | "line_rich_menu"
  | "message_logs"
  | "notification_queue"
  | "auto_notifications";

/** Maps each plan to the features it includes (cumulative — higher plans include lower). */
export const PLAN_FEATURES: Record<DealerPlan, AppFeature[]> = {
  basic: [
    "customers",
    "vehicles",
    "estimates",
    "estimate_pdf",
    "products",
    "product_orders",
  ],
  pro: [
    // includes all Basic features
    "customers",
    "vehicles",
    "estimates",
    "estimate_pdf",
    "products",
    "product_orders",
    // Pro additions
    "work_orders",
    "calendar",
    "reservations",
    "completion_reports",
    "invoices",
    "payments",
    "maintenance",
  ],
  pro_plus: [
    // includes all Pro features
    "customers",
    "vehicles",
    "estimates",
    "estimate_pdf",
    "products",
    "product_orders",
    "work_orders",
    "calendar",
    "reservations",
    "completion_reports",
    "invoices",
    "payments",
    "maintenance",
    // Pro Plus additions
    "line",
    "line_crm",
    "line_rich_menu",
    "message_logs",
    "notification_queue",
    "auto_notifications",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function canUseFeature(plan: DealerPlan, feature: AppFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export function planLabel(plan: DealerPlan): string {
  switch (plan) {
    case "basic":    return "Basic";
    case "pro":      return "Pro";
    case "pro_plus": return "Pro Plus";
  }
}

export function planBadgeColor(plan: DealerPlan): string {
  switch (plan) {
    case "basic":    return "bg-slate-700 text-slate-300 border-slate-600";
    case "pro":      return "bg-blue-900/60 text-blue-300 border-blue-700";
    case "pro_plus": return "bg-purple-900/60 text-purple-300 border-purple-700";
  }
}

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "active":    return "有効";
    case "trial":     return "トライアル";
    case "expired":   return "期限切れ";
    case "cancelled": return "解約済み";
  }
}

export function subscriptionStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case "active":    return "text-green-400";
    case "trial":     return "text-amber-400";
    case "expired":   return "text-red-400";
    case "cancelled": return "text-slate-500";
  }
}

/** Returns the minimum plan required for a feature. */
export function requiredPlanForFeature(feature: AppFeature): DealerPlan {
  if (PLAN_FEATURES.basic.includes(feature))    return "basic";
  if (PLAN_FEATURES.pro.includes(feature))      return "pro";
  return "pro_plus";
}
