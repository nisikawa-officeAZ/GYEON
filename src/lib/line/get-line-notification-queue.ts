"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { LineNotificationQueueDB, LineQueueStatus } from "./line-message-types";

export interface LineQueueFilter {
  status?: LineQueueStatus | LineQueueStatus[];
  limit?:  number;
  /** Observability: order by most-recently-updated first (default: next-scheduled first). */
  orderByRecent?: boolean;
}

export async function getLineNotificationQueue(
  filter: LineQueueFilter = {}
): Promise<LineNotificationQueueDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { limit = 100 } = filter;

  let query = supabase
    .from("line_notification_queue")
    .select(`
      id, dealer_id, customer_id, line_customer_id,
      scheduled_at, message_type, purpose, title, body, payload,
      status, attempts, last_attempt_at, sent_log_id, error_message,
      created_at, updated_at,
      customers ( last_name, first_name ),
      line_customers ( display_name, picture_url )
    `)
    .eq("dealer_id", dealer.dealer_id);

  query = filter.orderByRecent
    ? query.order("updated_at",   { ascending: false })
    : query.order("scheduled_at", { ascending: true });

  query = query.limit(limit);

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query = query.in("status", filter.status);
    } else {
      query = query.eq("status", filter.status);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("getLineNotificationQueue error:", error);
    return [];
  }

  return (data ?? []) as unknown as LineNotificationQueueDB[];
}

export interface LineQueueStats {
  scheduled:  number;
  processing: number;
  sent:       number;
  failed:     number;
}

export async function getLineQueueStats(): Promise<LineQueueStats> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { scheduled: 0, processing: 0, sent: 0, failed: 0 };

  const supabase = await createClient();
  const countFor = (status: LineQueueStatus) =>
    supabase
      .from("line_notification_queue")
      .select("*", { count: "exact", head: true })
      .eq("dealer_id", dealer.dealer_id)
      .eq("status", status);

  const [scheduled, processing, sent, failed] = await Promise.all([
    countFor("scheduled"),
    countFor("processing"),
    countFor("sent"),
    countFor("failed"),
  ]);

  return {
    scheduled:  scheduled.count  ?? 0,
    processing: processing.count ?? 0,
    sent:       sent.count       ?? 0,
    failed:     failed.count     ?? 0,
  };
}
