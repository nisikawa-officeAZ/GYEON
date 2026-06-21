"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { LineMessageLogDB, LineMessageStatus, LineMessagePurpose } from "./line-message-types";

export interface LineMessageLogFilter {
  status?:      LineMessageStatus;
  purpose?:     LineMessagePurpose;
  customer_id?: string;
  date_from?:   string;  // ISO date
  date_to?:     string;  // ISO date
  limit?:       number;
}

export async function getLineMessageLogs(
  filter: LineMessageLogFilter = {}
): Promise<LineMessageLogDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { limit = 100 } = filter;

  let query = supabase
    .from("line_message_logs")
    .select(`
      id, dealer_id, customer_id, line_customer_id, line_user_id,
      message_type, purpose, title, body, payload,
      status, sent_at, failed_at, error_message, retry_count,
      created_at, updated_at,
      customers ( last_name, first_name ),
      line_customers ( display_name, picture_url )
    `)
    .eq("dealer_id", dealer.dealer_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.status)      query = query.eq("status", filter.status);
  if (filter.purpose)     query = query.eq("purpose", filter.purpose);
  if (filter.customer_id) query = query.eq("customer_id", filter.customer_id);
  if (filter.date_from)   query = query.gte("created_at", filter.date_from);
  if (filter.date_to)     query = query.lte("created_at", `${filter.date_to}T23:59:59`);

  const { data, error } = await query;
  if (error) {
    console.error("getLineMessageLogs error:", error);
    return [];
  }

  return (data ?? []) as unknown as LineMessageLogDB[];
}

// ─── Monthly stats for dashboard ─────────────────────────────────────────────

export interface LineMessageStats {
  this_month_sent:   number;
  this_month_failed: number;
  total_sent:        number;
}

export async function getLineMessageStats(): Promise<LineMessageStats> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { this_month_sent: 0, this_month_failed: 0, total_sent: 0 };

  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartStr = monthStart.toISOString();

  const [monthlySent, monthlyFailed, totalSent] = await Promise.all([
    supabase
      .from("line_message_logs")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", "sent")
      .gte("sent_at", monthStartStr),
    supabase
      .from("line_message_logs")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", "failed")
      .gte("failed_at", monthStartStr),
    supabase
      .from("line_message_logs")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", "sent"),
  ]);

  return {
    this_month_sent:   monthlySent.count   ?? 0,
    this_month_failed: monthlyFailed.count ?? 0,
    total_sent:        totalSent.count     ?? 0,
  };
}
