// Phase 5 Sprint 2 — Enqueue a transactional reservation booking confirmation to the
// existing LINE notification queue. NON-BLOCKING and best-effort: reservation creation
// must never fail or be delayed-to-failure because of it.
//
// Gates (all must pass): (1) dealer opt-in — auto_notifications plan feature; (2) dealer
// LINE credentials present (line_enabled + token); (3) customer line_connected + a friend
// line_customer. Deduped per reservation (payload.dedup_ref). NO send here — delivery is
// the existing credential-gated LINE queue cron (Phase 4 S3 / Phase 5 S1 retry+reaper).
//
// dealer_id is the trusted value passed by the guarded createReservation (resolved from
// getCurrentDealer()); it is NEVER taken from client input. No new tables / schema.

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBookingNotificationOptIn, buildBookingNotificationBody } from "./booking-notification";
import { serviceTypeLabel, type ReservationServiceType } from "./reservation-types";
import { queueLineNotification } from "@/lib/line/queue-line-notification";

export async function enqueueBookingNotification(
  supabase:        SupabaseClient,
  dealerId:        string,
  reservationId:   string,
  customerId:      string,
  reservationDate: string,
  startTime:       string | null,
  serviceType:     ReservationServiceType,
): Promise<void> {
  try {
    // (1) Opt-in / eligibility (plan feature) — no per-dealer column (Future).
    if (!(await resolveBookingNotificationOptIn())) return;

    // (2) Dealer LINE credentials present (the cron also re-gates at send).
    const { data: settings } = await supabase
      .from("dealer_settings")
      .select("line_enabled, line_access_token")
      .eq("dealer_id", dealerId)
      .maybeSingle();
    if (!settings?.line_enabled || !settings.line_access_token) return;

    // (3) Customer LINE-connected.
    const { data: cust } = await supabase
      .from("customers")
      .select("line_connected")
      .eq("id",        customerId)
      .eq("dealer_id", dealerId)
      .maybeSingle();
    if (!cust?.line_connected) return;

    // Friend line_customer for delivery.
    const { data: lc } = await supabase
      .from("line_customers")
      .select("id")
      .eq("dealer_id",   dealerId)
      .eq("customer_id", customerId)
      .eq("is_friend",   true)
      .maybeSingle();
    if (!lc) return;

    // Dedup — at most one booking notification per reservation.
    const dedupRef = `reservation:${reservationId}`;
    const { data: existing } = await supabase
      .from("line_notification_queue")
      .select("id")
      .eq("dealer_id",   dealerId)
      .eq("customer_id", customerId)
      .in("status", ["scheduled", "processing", "sent"])
      .contains("payload", { dedup_ref: dedupRef })
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const body = buildBookingNotificationBody({
      reservationDate,
      startTime,
      serviceLabel: serviceTypeLabel(serviceType),
    });

    await queueLineNotification({
      customer_id:      customerId,
      line_customer_id: lc.id,
      scheduled_at:     new Date().toISOString(),
      message_type:     "text",
      purpose:          "reservation",
      title:            "ご予約確認",
      body,
      payload:          { dedup_ref: dedupRef, messages: [{ type: "text", text: body }] },
    });
  } catch (err) {
    console.error("[enqueueBookingNotification] error:", err);
  }
}
