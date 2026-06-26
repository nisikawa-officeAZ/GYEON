// DealerOS — Customer Engagement Platform: Context Factory
//
// Server-side utility — NOT a "use server" action.
// Called by server actions that emit engagement events.
//
// Security guarantee:
//   - dealer_id is ALWAYS from getCurrentDealer() — never from event payload or client input
//   - Returns null if the dealer is not authenticated
//   - trace_id is generated server-side via crypto.randomUUID()

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { randomUUID }        from "crypto";
import type { EngagementContext } from "./types";
import type { EngagementEvent, EngagementEventType } from "./events";

// ─── Context factory ──────────────────────────────────────────────────────────

/**
 * Builds an EngagementContext from a server-verified dealer session and
 * a typed EngagementEvent. Returns null if the dealer is not authenticated.
 *
 * The dealer_id in the returned context is always the authenticated dealer —
 * it is NEVER taken from the event payload (which could be from client input).
 */
export async function createEngagementContext<T extends EngagementEventType>(
  event: EngagementEvent<T>,
): Promise<EngagementContext | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  return {
    dealer_id:    dealer.dealer_id,
    customer_id:  event.customer_id,
    vehicle_id:   event.vehicle_id,
    job_id:       event.job_id,
    event_type:   event.event_type,
    trace_id:     randomUUID(),
    triggered_at: new Date().toISOString(),
  };
}

// ─── Event builder ────────────────────────────────────────────────────────────

/**
 * Creates a typed EngagementEvent with dealer_id from getCurrentDealer().
 * Returns null if the dealer is not authenticated.
 *
 * Use this to safely emit events from server actions — never construct
 * EngagementEvent manually with dealer_id from client-provided data.
 */
export async function createEngagementEvent<T extends EngagementEventType>(
  event_type: T,
  customer_id: string,
  payload: import("./events").EngagementEventPayloadMap[T],
  opts?: {
    vehicle_id?: string;
    job_id?:     string;
    trace_id?:   string;
  },
): Promise<EngagementEvent<T> | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  return {
    event_type,
    dealer_id:   dealer.dealer_id,
    customer_id,
    vehicle_id:  opts?.vehicle_id,
    job_id:      opts?.job_id,
    payload,
    occurred_at: new Date().toISOString(),
    trace_id:    opts?.trace_id ?? randomUUID(),
  };
}
