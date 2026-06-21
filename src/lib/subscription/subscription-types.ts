// Pure types — no "use server" directive
// PHASE58: Subscription & License Management

// ─── Plan & Status ────────────────────────────────────────────────────────────

export type PlanCode = "basic" | "pro" | "pro_plus";

/** Extended status including billing states not present in the legacy dealers.subscription_status */
export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

// ─── Feature & Limit Keys ─────────────────────────────────────────────────────

export type FeatureKey =
  | "customers"
  | "vehicles"
  | "estimates"
  | "pdf_preview"
  | "pdf_generation"
  | "product_orders"
  | "work_orders"
  | "completion_reports"
  | "invoices"
  | "payments"
  | "reservations"
  | "maintenance_reminders"
  | "line_integration"
  | "line_messages"
  | "automatic_reminders"
  | "audit_logs"
  | "admin_dashboard";

export type LicenseLimitKey =
  | "staff"
  | "monthly_pdf_generations"
  | "monthly_line_messages";

// ─── DB Shapes ────────────────────────────────────────────────────────────────

export interface SubscriptionPlanDB {
  id:            string;
  code:          PlanCode;
  name:          string;
  description:   string | null;
  monthly_price: number;
  yearly_price:  number;
  currency:      string;
  is_active:     boolean;
  features:      Record<string, boolean | number>;
  limits:        Record<string, boolean | number>;
  sort_order:    number;
  created_at:    string;
  updated_at:    string;
}

export interface DealerSubscriptionDB {
  id:                        string;
  dealer_id:                 string;
  plan_code:                 PlanCode;
  status:                    SubscriptionStatus;
  trial_started_at:          string | null;
  trial_ends_at:             string | null;
  current_period_started_at: string | null;
  current_period_ends_at:    string | null;
  cancelled_at:              string | null;
  suspended_at:              string | null;
  notes:                     string | null;
  created_at:                string;
  updated_at:                string;
}

export interface DealerSubscriptionWithPlan extends DealerSubscriptionDB {
  plan?: SubscriptionPlanDB;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPlanLabel(code: PlanCode): string {
  switch (code) {
    case "basic":    return "Basic";
    case "pro":      return "Pro";
    case "pro_plus": return "Pro Plus";
  }
}

export function getStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "trial":     return "トライアル";
    case "active":    return "有効";
    case "past_due":  return "支払い遅延";
    case "suspended": return "停止中";
    case "cancelled": return "解約済み";
  }
}

export function getStatusBadgeColor(status: SubscriptionStatus): string {
  switch (status) {
    case "trial":     return "bg-amber-900/40 text-amber-300 border-amber-700";
    case "active":    return "bg-green-900/40 text-green-300 border-green-700";
    case "past_due":  return "bg-orange-900/40 text-orange-300 border-orange-700";
    case "suspended": return "bg-red-900/40 text-red-300 border-red-700";
    case "cancelled": return "bg-slate-800 text-slate-500 border-slate-700";
  }
}

export function isActiveSubscriptionStatus(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trial";
}
