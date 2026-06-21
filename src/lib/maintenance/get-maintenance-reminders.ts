"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { MaintenanceReminderDB, MaintenanceReminderStatus, MaintenanceReminderType } from "./maintenance-types";

export interface MaintenanceReminderFilter {
  status?:       MaintenanceReminderStatus | MaintenanceReminderStatus[];
  reminder_type?: MaintenanceReminderType;
  customer_id?:  string;
  due_from?:     string;   // ISO date "YYYY-MM-DD"
  due_to?:       string;
  limit?:        number;
}

const REMINDER_SELECT = `
  id, dealer_id, customer_id, vehicle_id, work_order_id,
  reminder_number, title, reminder_type, status,
  due_date, scheduled_send_at, sent_at, line_queue_id,
  message_title, message_body, notes, internal_memo,
  created_at, updated_at,
  customers ( last_name, first_name, phone ),
  vehicles  ( maker, model, grade, plate_number ),
  work_orders ( work_order_number, title, status )
`;

export async function getMaintenanceReminders(
  filter: MaintenanceReminderFilter = {}
): Promise<MaintenanceReminderDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { limit = 100 } = filter;

  let query = supabase
    .from("maintenance_reminders")
    .select(REMINDER_SELECT)
    .eq("dealer_id", dealer.dealer_id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query = query.in("status", filter.status);
    } else {
      query = query.eq("status", filter.status);
    }
  }
  if (filter.reminder_type) query = query.eq("reminder_type", filter.reminder_type);
  if (filter.customer_id)   query = query.eq("customer_id",   filter.customer_id);
  if (filter.due_from)      query = query.gte("due_date",     filter.due_from);
  if (filter.due_to)        query = query.lte("due_date",     filter.due_to);

  const { data, error } = await query;
  if (error) {
    console.error("getMaintenanceReminders error:", error);
    return [];
  }

  return (data ?? []) as unknown as MaintenanceReminderDB[];
}

export async function getMaintenanceRemindersByWorkOrder(
  workOrderId: string
): Promise<MaintenanceReminderDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_reminders")
    .select(REMINDER_SELECT)
    .eq("dealer_id", dealer.dealer_id)
    .eq("work_order_id", workOrderId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("getMaintenanceRemindersByWorkOrder error:", error);
    return [];
  }

  return (data ?? []) as unknown as MaintenanceReminderDB[];
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export interface MaintenanceStats {
  this_month:     number;  // due_date in current month
  next_7_days:    number;  // scheduled_send_at within 7 days
  pending:        number;  // status = scheduled or queued
  sent_this_month: number; // status = sent, sent_at in current month
}

export async function getMaintenanceStats(): Promise<MaintenanceStats> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { this_month: 0, next_7_days: 0, pending: 0, sent_this_month: 0 };

  const supabase = await createClient();
  const now = new Date();
  const todayStr   = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const sevenDays  = new Date(now);
  sevenDays.setDate(sevenDays.getDate() + 7);
  const sevenDaysStr = sevenDays.toISOString();

  const [thisMonth, nextWeek, pending, sentThisMonth] = await Promise.all([
    supabase
      .from("maintenance_reminders")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd),
    supabase
      .from("maintenance_reminders")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .gte("scheduled_send_at", now.toISOString())
      .lte("scheduled_send_at", sevenDaysStr)
      .in("status", ["scheduled", "queued"]),
    supabase
      .from("maintenance_reminders")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .in("status", ["scheduled", "queued"]),
    supabase
      .from("maintenance_reminders")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", "sent")
      .gte("sent_at", monthStart),
  ]);

  return {
    this_month:      thisMonth.count     ?? 0,
    next_7_days:     nextWeek.count      ?? 0,
    pending:         pending.count       ?? 0,
    sent_this_month: sentThisMonth.count ?? 0,
  };
}
