// Phase 4 Sprint 3 — Cron-safe LINE notification queue processor (all dealers).
//
// Invoked only by the secret-guarded cron route (server-side); NOT a client-callable
// action. A scheduled job has no user/dealer session, so this uses the service-role
// admin client and carries dealer_id from each TRUSTED DB ROW (never from client).
// RLS remains enabled; this is the guarded server-only cron path, and every write is
// explicitly scoped by the row's dealer_id.
//
// Credential-gated: an item is SENT only when its dealer has line_enabled + a valid
// line_access_token. Items for dealers without valid credentials are SKIPPED (left
// "scheduled") so they process later once credentials are configured — never sent.
// Retry-safe / idempotent via the shared send helper (only status="scheduled" items
// are picked; each becomes a terminal sent/failed).

import { createAdminClient } from "@/lib/supabase/admin";
import { sendQueuedLineItem, type QueuedLineItem } from "./send-queued-line-item";

export interface ProcessQueueCronResult {
  processed: number;
  sent:      number;
  failed:    number;
  skipped:   number;   // dealers without valid LINE credentials
  errors:    string[];
}

export async function processLineNotificationQueueForCron(): Promise<ProcessQueueCronResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const result: ProcessQueueCronResult = {
    processed: 0, sent: 0, failed: 0, skipped: 0, errors: [],
  };

  // Due scheduled items across ALL dealers.
  const { data: items, error } = await supabase
    .from("line_notification_queue")
    .select(`
      id, dealer_id, customer_id, line_customer_id,
      scheduled_at, message_type, purpose, title, body, payload,
      status, attempts,
      line_customers ( line_user_id )
    `)
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(500);

  if (error) {
    result.errors.push(error.message);
    return result;
  }
  if (!items || items.length === 0) return result;

  // Per-dealer credential cache (avoid refetching dealer_settings per item).
  const credCache = new Map<string, { enabled: boolean; token: string | null }>();
  async function getCreds(did: string): Promise<{ enabled: boolean; token: string | null }> {
    const cached = credCache.get(did);
    if (cached) return cached;
    const { data: s } = await supabase
      .from("dealer_settings")
      .select("line_access_token, line_enabled")
      .eq("dealer_id", did)
      .maybeSingle();
    const creds = {
      enabled: !!s?.line_enabled,
      token:   (s?.line_access_token as string | null) ?? null,
    };
    credCache.set(did, creds);
    return creds;
  }

  for (const raw of items) {
    const item = raw as unknown as QueuedLineItem & { dealer_id: string };
    result.processed++;
    try {
      const creds = await getCreds(item.dealer_id);
      // Credential gate: never send for dealers without valid LINE credentials.
      if (!creds.enabled || !creds.token) {
        result.skipped++;
        continue;
      }
      const { outcome, error: e } = await sendQueuedLineItem(
        supabase, item.dealer_id, creds.token, item, now,
      );
      if (outcome === "sent") result.sent++;
      else {
        result.failed++;
        if (e) result.errors.push(`Queue ${item.id}: ${e}`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`Queue ${item.id}: ${String(err)}`);
    }
  }

  return result;
}
