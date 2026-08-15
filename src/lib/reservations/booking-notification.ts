// Phase 5 Sprint 2 — Booking notification eligibility + message builder.
//
// Opt-in WITHOUT a schema column: a dealer is "opted-in" to reservation booking
// notifications when its plan enables auto notifications (checkFeatureAccess
// "auto_notifications") — the same gate used for the maintenance follow-up. A persisted
// PER-DEALER toggle remains Future Scope (would require a separately-approved migration).
// Fail-safe OFF on any error, so nothing is ever auto-sent for ineligible dealers.

import { checkFeatureAccess } from "@/lib/plans/can-use-feature";

export const BOOKING_NOTIFICATION_DEFAULT_OPT_IN = false;

export async function resolveBookingNotificationOptIn(): Promise<boolean> {
  try {
    return await checkFeatureAccess("auto_notifications");
  } catch {
    return BOOKING_NOTIFICATION_DEFAULT_OPT_IN;
  }
}

/** Pure builder for the transactional booking-confirmation text (no I/O). */
export function buildBookingNotificationBody(input: {
  reservationDate: string;
  startTime?:      string | null;
  serviceLabel:    string;
}): string {
  const when = input.startTime
    ? `${input.reservationDate} ${input.startTime.slice(0, 5)}`
    : input.reservationDate;
  return `ご予約を承りました。\n日時: ${when}\nサービス: ${input.serviceLabel}\nご来店をお待ちしております。`;
}
