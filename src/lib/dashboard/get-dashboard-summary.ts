"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EstimateCounts {
  draft:    number;
  proposal: number; // 提案中 (was 'sent' — SENT is transmission, not workflow)
  approved: number;
  rejected: number;
  expired:  number;
}

export interface WorkOrderCounts {
  scheduled:   number;
  in_progress: number;
  completed:   number;
  on_hold:     number;
  cancelled:   number;
}

export interface InvoiceCounts {
  draft:          number;
  issued:         number;
  paid:           number;
  partially_paid: number;
  overdue:        number;
  cancelled:      number;
}

export interface SalesSummary {
  monthly_sales:    number;  // sum(total) paid invoices this month
  monthly_received: number;  // sum(amount) completed payments this month
  outstanding:      number;  // sum(balance_due) all active invoices
  yearly_sales:     number;  // sum(total) paid invoices this year
}

export interface TodayWorkOrder {
  id:                  string;
  work_order_number:   string | null;
  title:               string | null;
  status:              string;
  assigned_staff:      string | null;
  scheduled_start_at:  string | null;
  scheduled_end_at:    string | null;
  customers:           { last_name: string | null; first_name: string | null } | null;
  vehicles:            { maker: string | null; model: string | null; plate_number: string | null } | null;
}

export interface UpcomingWorkOrder {
  id:                 string;
  work_order_number:  string | null;
  title:              string | null;
  status:             string;
  scheduled_start_at: string | null;
  customers:          { last_name: string | null; first_name: string | null } | null;
  vehicles:           { maker: string | null; model: string | null } | null;
}

export interface RecentActivity {
  id:         string;
  type:       'estimate' | 'work_order' | 'invoice' | 'payment';
  label:      string;
  sub_label:  string;
  date:       string;
  status:     string;
}

export interface LineStats {
  friends_count:  number;
  linked_count:   number;
  this_month_new: number;
}

export interface LineMessageStats {
  this_month_sent:   number;
  this_month_failed: number;
  total_sent:        number;
}

export interface MaintenanceDashboardStats {
  this_month:      number;
  next_7_days:     number;
  pending:         number;
  sent_this_month: number;
}

export interface ReservationStats {
  today:      number;
  this_week:  number;
  this_month: number;
  pending:    number;
  confirmed:  number;
}

export interface DashboardSummary {
  customer_count:   number;
  vehicle_count:    number;
  estimates:        EstimateCounts;
  work_orders:      WorkOrderCounts;
  invoices:         InvoiceCounts;
  sales:            SalesSummary;
  line_stats:            LineStats;
  line_message_stats:    LineMessageStats;
  line_queue_stats:      { scheduled: number; failed: number };
  maintenance_stats:     MaintenanceDashboardStats;
  reservation_stats:     ReservationStats;
  today_work_orders:     TodayWorkOrder[];
  upcoming_work_orders:  UpcomingWorkOrder[];
  recent_activities:     RecentActivity[];
}


// ─── RPC contract guard ──────────────────────────────────────────────────────

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNumberKeys(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every((key) => typeof value[key] === "number");
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (!isRecord(value)) return false;

  return (
    typeof value.customer_count === "number" &&
    typeof value.vehicle_count === "number" &&
    hasNumberKeys(value.estimates, ["draft", "proposal", "approved", "rejected", "expired"]) &&
    hasNumberKeys(value.work_orders, ["scheduled", "in_progress", "completed", "on_hold", "cancelled"]) &&
    hasNumberKeys(value.invoices, ["draft", "issued", "paid", "partially_paid", "overdue", "cancelled"]) &&
    hasNumberKeys(value.sales, ["monthly_sales", "monthly_received", "outstanding", "yearly_sales"]) &&
    hasNumberKeys(value.line_stats, ["friends_count", "linked_count", "this_month_new"]) &&
    hasNumberKeys(value.line_message_stats, ["this_month_sent", "this_month_failed", "total_sent"]) &&
    hasNumberKeys(value.line_queue_stats, ["scheduled", "failed"]) &&
    hasNumberKeys(value.maintenance_stats, ["this_month", "next_7_days", "pending", "sent_this_month"]) &&
    hasNumberKeys(value.reservation_stats, ["today", "this_week", "this_month", "pending", "confirmed"]) &&
    Array.isArray(value.today_work_orders) &&
    Array.isArray(value.upcoming_work_orders) &&
    Array.isArray(value.recent_activities)
  );
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_dashboard_summary", {
      p_dealer_id: dealer.dealer_id,
    });

    if (error || !isDashboardSummary(data)) {
      console.error("[getDashboardSummary] Aggregate RPC failed or returned an invalid contract.");
      return null;
    }

    return data;
  } catch (error) {
    console.error("[getDashboardSummary] Unexpected error:", error);
    return null;
  }
}
