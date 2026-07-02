// DealerOS — Service Duration Settings foundation (Batch B2).
//
// Pure types + helpers, NO data access and NO "use server".
//
// Persistence reuses the EXISTING dealer_settings.business_days jsonb column
// (already used by B1 for hours) under a dedicated key `service_durations`.
// No new column, no schema change, no migration, no new table.
//
// NOTE: because business_days is a shared jsonb container, every writer must
// READ-MERGE (preserve keys it does not own). See save-service-durations.ts and
// save-business-hours.ts.
//
// B2 is FOUNDATION ONLY: the calendar does not auto-calculate from these values
// and reservation creation does not enforce them.

import { ReservationServiceType } from "@/lib/reservations/reservation-types";

export interface ServiceDuration {
  hours: number | null;              // estimated hours (same-day work)
  days: number | null;               // estimated days (multi-day work)
  buffer_before_min: number | null;  // optional buffer before, minutes
  buffer_after_min: number | null;   // optional buffer after, minutes
}

export type ServiceDurationMap = Partial<Record<ReservationServiceType, ServiceDuration>>;

export const SERVICE_TYPES: ReservationServiceType[] = [
  "coating", "maintenance", "ppf", "window", "wheel", "interior", "other",
];

export const EMPTY_SERVICE_DURATION: ServiceDuration = {
  hours: null,
  days: null,
  buffer_before_min: null,
  buffer_after_min: null,
};

// Sensible upper bounds — defensive validation only (no scheduling logic here).
const MAX_HOURS  = 24;
const MAX_DAYS   = 60;
const MAX_BUFFER = 1440; // 24h in minutes

function numOrNull(v: unknown, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

/** Defensively normalize an unknown jsonb value into a ServiceDurationMap. */
export function normalizeServiceDurations(raw: unknown): ServiceDurationMap {
  const out: ServiceDurationMap = {};
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;

  for (const st of SERVICE_TYPES) {
    const v = o[st];
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const hours             = numOrNull(r.hours, MAX_HOURS);
    const days              = numOrNull(r.days, MAX_DAYS);
    const buffer_before_min = numOrNull(r.buffer_before_min, MAX_BUFFER);
    const buffer_after_min  = numOrNull(r.buffer_after_min, MAX_BUFFER);
    // Skip entries with no meaningful value.
    if (hours === null && days === null && buffer_before_min === null && buffer_after_min === null) continue;
    out[st] = { hours, days, buffer_before_min, buffer_after_min };
  }
  return out;
}
