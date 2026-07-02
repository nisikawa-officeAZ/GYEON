// DealerOS — Service classification for the reservation engine (Phase C2). Pure.
//
// Classifies detailing services by workload weight and provides light-work
// alternatives. Also documents the multi-day day-type model the capacity engine
// understands (C2.3): "active" (working), "drying" (bay held, no staff), and
// "buffer" days — see occupancy-expander.ts, which already emits these types.
// Full multi-day scheduling logic is intentionally NOT implemented here.

import type { ReservationServiceType } from "@/lib/reservations/reservation-types";

export type ServiceWeight = "heavy" | "light";

// Heavy = long / resource-intensive / often multi-day (drying).
const HEAVY_SERVICES = new Set<ReservationServiceType>(["coating", "ppf", "wheel", "interior"]);

// Multi-day-prone services (require drying/curing days) — used by the multi-day
// awareness architecture; the expander derives the active/drying profile.
export const MULTIDAY_PRONE = new Set<ReservationServiceType>(["coating", "ppf"]);

// Suggested light alternatives when heavy work lands on a busy day.
export const LIGHT_ALTERNATIVES: ReservationServiceType[] = ["maintenance", "window", "other"];

export function serviceWeight(t: ReservationServiceType): ServiceWeight {
  return HEAVY_SERVICES.has(t) ? "heavy" : "light";
}

export function isHeavyService(t: ReservationServiceType): boolean {
  return HEAVY_SERVICES.has(t);
}

export function isMultiDayProne(t: ReservationServiceType): boolean {
  return MULTIDAY_PRONE.has(t);
}
