// Phase 4 Sprint 4 — Booking notification opt-in readiness (PREPARATION ONLY).
//
// This module prepares the opt-in GATE that a future sprint will consult before
// sending a reservation/booking notification. No message is sent in this sprint
// (reservation LINE/email sending is explicitly out of scope), and NO schema change
// is made: there is currently no per-dealer/per-reservation opt-in column, so the
// resolver returns the safe default (OFF). A future sprint may persist a per-dealer
// flag (which would require a separately-approved migration) and read it here.

export const BOOKING_NOTIFICATION_DEFAULT_OPT_IN = false;

/**
 * Resolve whether booking notifications are opted-in. Fail-safe OFF until a
 * persisted per-dealer flag exists. Returning false guarantees nothing is auto-sent.
 */
export async function resolveBookingNotificationOptIn(): Promise<boolean> {
  // Extension point (future, migration-gated): look up a per-dealer opt-in flag.
  return BOOKING_NOTIFICATION_DEFAULT_OPT_IN;
}
