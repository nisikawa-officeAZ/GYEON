"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getLineStats } from "@/lib/line/get-line-customers";
import { getLineMessageStats } from "@/lib/line/get-line-message-logs";
import { getLineQueueStats } from "@/lib/line/get-line-notification-queue";
import { getMaintenanceStats } from "@/lib/maintenance/get-maintenance-reminders";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EstimateCounts {
  draft:    number;
  sent:     number;
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
  today_work_orders:     TodayWorkOrder[];
  upcoming_work_orders:  UpcomingWorkOrder[];
  recent_activities:     RecentActivity[];
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function countByStatus<T extends { status: string }>(
  rows: T[],
  statuses: string[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of statuses) map[s] = 0;
  for (const row of rows) {
    const s = row.status.toLowerCase();
    if (s in map) map[s]++;
  }
  return map;
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const did = dealer.dealer_id;

  const now       = new Date();
  const todayStr  = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const yearStart  = `${now.getFullYear()}-01-01`;
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysStr = sevenDaysLater.toISOString().slice(0, 10);

  const todayStart = `${todayStr}T00:00:00`;
  const todayEnd   = `${todayStr}T23:59:59`;

  const [
    customerResult,
    vehicleResult,
    estimateResult,
    workOrderResult,
    invoiceResult,
    paymentResult,
    todayWOResult,
    upcomingWOResult,
    recentEstimates,
    recentWOs,
    recentInvoices,
    recentPayments,
    lineStatsResult,
    lineMsgStatsResult,
    lineQueueStatsResult,
    maintenanceStatsResult,
  ] = await Promise.all([
    // Customer count
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", did),

    // Vehicle count
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", did),

    // Estimates by status
    supabase
      .from("estimates")
      .select("status")
      .eq("dealer_id", did),

    // Work orders by status
    supabase
      .from("work_orders")
      .select("status")
      .eq("dealer_id", did),

    // Invoices: status + financial fields
    supabase
      .from("invoices")
      .select("status, total, balance_due, issue_date")
      .eq("dealer_id", did)
      .is("deleted_at", null),

    // Payments: completed this month
    supabase
      .from("payments")
      .select("amount, payment_date, status")
      .eq("dealer_id", did)
      .eq("status", "completed")
      .gte("payment_date", monthStart),

    // Today's work orders
    supabase
      .from("work_orders")
      .select(`
        id, work_order_number, title, status, assigned_staff,
        scheduled_start_at, scheduled_end_at,
        customers ( last_name, first_name ),
        vehicles  ( maker, model, plate_number )
      `)
      .eq("dealer_id", did)
      .gte("scheduled_start_at", todayStart)
      .lte("scheduled_start_at", todayEnd)
      .order("scheduled_start_at", { ascending: true }),

    // Upcoming 7 days (excluding today, scheduled/in_progress)
    supabase
      .from("work_orders")
      .select(`
        id, work_order_number, title, status, scheduled_start_at,
        customers ( last_name, first_name ),
        vehicles  ( maker, model )
      `)
      .eq("dealer_id", did)
      .in("status", ["scheduled", "in_progress"])
      .gt("scheduled_start_at", todayEnd)
      .lte("scheduled_start_at", `${sevenDaysStr}T23:59:59`)
      .order("scheduled_start_at", { ascending: true })
      .limit(20),

    // Recent estimates
    supabase
      .from("estimates")
      .select("id, estimate_number, status, created_at, customers ( last_name, first_name )")
      .eq("dealer_id", did)
      .order("created_at", { ascending: false })
      .limit(5),

    // Recent completed work orders
    supabase
      .from("work_orders")
      .select("id, work_order_number, status, actual_end_at, updated_at, customers ( last_name, first_name )")
      .eq("dealer_id", did)
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(5),

    // Recent invoices
    supabase
      .from("invoices")
      .select("id, invoice_number, status, created_at, customers ( last_name, first_name )")
      .eq("dealer_id", did)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),

    // Recent payments
    supabase
      .from("payments")
      .select("id, payment_number, amount, payment_date, status, customers ( last_name, first_name )")
      .eq("dealer_id", did)
      .order("created_at", { ascending: false })
      .limit(5),

    // LINE stats
    getLineStats(),

    // LINE message stats
    getLineMessageStats(),

    // LINE queue stats
    getLineQueueStats(),

    // Maintenance stats
    getMaintenanceStats(),
  ]);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const customerCount = customerResult.count ?? 0;
  const vehicleCount  = vehicleResult.count  ?? 0;

  const estimateRows  = (estimateResult.data ?? []) as { status: string }[];
  const workOrderRows = (workOrderResult.data ?? []) as { status: string }[];

  const estCounts = countByStatus(estimateRows, ["draft", "sent", "approved", "rejected", "expired"]);
  const woCounts  = countByStatus(workOrderRows, ["scheduled", "in_progress", "completed", "on_hold", "cancelled"]);

  const invoiceRows = (invoiceResult.data ?? []) as {
    status: string; total: number; balance_due: number; issue_date: string | null;
  }[];
  const invCounts = countByStatus(invoiceRows, ["draft", "issued", "paid", "partially_paid", "overdue", "cancelled"]);

  // ── Sales summary ──────────────────────────────────────────────────────────
  const outstanding = invoiceRows
    .filter((r) => r.balance_due > 0 && r.status !== "cancelled")
    .reduce((s, r) => s + r.balance_due, 0);

  const monthlySales = invoiceRows
    .filter((r) => r.status === "paid" && r.issue_date && r.issue_date >= monthStart)
    .reduce((s, r) => s + r.total, 0);

  const yearlySales = invoiceRows
    .filter((r) => r.status === "paid" && r.issue_date && r.issue_date >= yearStart)
    .reduce((s, r) => s + r.total, 0);

  const monthlyReceived = ((paymentResult.data ?? []) as { amount: number }[])
    .reduce((s, p) => s + p.amount, 0);

  // ── Recent activities ──────────────────────────────────────────────────────
  type CustomerJoin = { last_name: string | null; first_name: string | null } | null;

  function customerName(c: CustomerJoin): string {
    if (!c) return "—";
    return [c.last_name, c.first_name].filter(Boolean).join(" ") || "—";
  }

  const activities: RecentActivity[] = [
    ...((recentEstimates.data ?? []) as unknown as {
      id: string; estimate_number: string | null; status: string;
      created_at: string; customers: CustomerJoin;
    }[]).map((r) => ({
      id:        r.id,
      type:      "estimate" as const,
      label:     customerName(r.customers),
      sub_label: `見積 ${r.estimate_number ?? r.id.slice(0, 6)}`,
      date:      r.created_at,
      status:    r.status,
    })),

    ...((recentWOs.data ?? []) as unknown as {
      id: string; work_order_number: string | null; status: string;
      actual_end_at: string | null; updated_at: string; customers: CustomerJoin;
    }[]).map((r) => ({
      id:        r.id,
      type:      "work_order" as const,
      label:     customerName(r.customers),
      sub_label: `施工完了 ${r.work_order_number ?? r.id.slice(0, 6)}`,
      date:      r.actual_end_at ?? r.updated_at,
      status:    r.status,
    })),

    ...((recentInvoices.data ?? []) as unknown as {
      id: string; invoice_number: string | null; status: string;
      created_at: string; customers: CustomerJoin;
    }[]).map((r) => ({
      id:        r.id,
      type:      "invoice" as const,
      label:     customerName(r.customers),
      sub_label: `請求書 ${r.invoice_number ?? r.id.slice(0, 6)}`,
      date:      r.created_at,
      status:    r.status,
    })),

    ...((recentPayments.data ?? []) as unknown as {
      id: string; payment_number: string | null; amount: number;
      payment_date: string | null; status: string; customers: CustomerJoin;
    }[]).map((r) => ({
      id:        r.id,
      type:      "payment" as const,
      label:     customerName(r.customers),
      sub_label: `入金 ¥${r.amount.toLocaleString("ja-JP")}`,
      date:      r.payment_date ?? "",
      status:    r.status,
    })),
  ]
    .filter((a) => !!a.date)
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 10);

  return {
    customer_count: customerCount,
    vehicle_count:  vehicleCount,
    estimates: {
      draft:    estCounts["draft"]    ?? 0,
      sent:     estCounts["sent"]     ?? 0,
      approved: estCounts["approved"] ?? 0,
      rejected: estCounts["rejected"] ?? 0,
      expired:  estCounts["expired"]  ?? 0,
    },
    work_orders: {
      scheduled:   woCounts["scheduled"]   ?? 0,
      in_progress: woCounts["in_progress"] ?? 0,
      completed:   woCounts["completed"]   ?? 0,
      on_hold:     woCounts["on_hold"]     ?? 0,
      cancelled:   woCounts["cancelled"]   ?? 0,
    },
    invoices: {
      draft:          invCounts["draft"]          ?? 0,
      issued:         invCounts["issued"]         ?? 0,
      paid:           invCounts["paid"]           ?? 0,
      partially_paid: invCounts["partially_paid"] ?? 0,
      overdue:        invCounts["overdue"]        ?? 0,
      cancelled:      invCounts["cancelled"]      ?? 0,
    },
    sales: {
      monthly_sales:    monthlySales,
      monthly_received: monthlyReceived,
      outstanding,
      yearly_sales:     yearlySales,
    },
    line_stats:            lineStatsResult,
    line_message_stats:    lineMsgStatsResult,
    line_queue_stats:      lineQueueStatsResult,
    maintenance_stats:     maintenanceStatsResult,
    today_work_orders:    (todayWOResult.data ?? []) as unknown as TodayWorkOrder[],
    upcoming_work_orders: (upcomingWOResult.data ?? []) as unknown as UpcomingWorkOrder[],
    recent_activities:    activities,
  };
}
