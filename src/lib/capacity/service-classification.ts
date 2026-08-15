// DealerOS — Service classification + recommendation POLICY (Phase C2 / C2.6). Pure.
//
// Configurable policy that drives the recommendation engine (reservation-advisor).
// Nothing is hardcoded in the ranking logic — it reads this policy. The policy is
// injectable so a dealer can (in future) define heavy/medium/light tiers,
// parallel-eligible services, and services acceptable while heavy work is in
// progress or during PPF drying/buffer periods. Defaults are provided here.
//
// Multi-day day-types (active / drying / buffer) are emitted by
// occupancy-expander.ts; MULTIDAY_PRONE marks services that require drying/curing.

import type { ReservationServiceType } from "@/lib/reservations/reservation-types";

export type ServiceWeight = "heavy" | "medium" | "light";

export interface ServicePolicy {
  /** Workload tier per service. */
  weight: Record<ReservationServiceType, ServiceWeight>;
  /** Approx capacity fraction a job of each tier consumes (fallback when no duration). */
  weightCost: Record<ServiceWeight, number>;
  /** Services that may run in parallel with others. */
  parallelEligible: ReservationServiceType[];
  /** Services acceptable while heavy work is actively in progress. */
  acceptedDuringHeavy: ReservationServiceType[];
  /** Services acceptable during PPF drying / buffer periods. */
  acceptedDuringDrying: ReservationServiceType[];
}

// Services requiring drying/curing (multi-day prone).
export const MULTIDAY_PRONE = new Set<ReservationServiceType>(["coating", "ppf"]);

// Default policy — future dealer configuration can override this shape.
export const DEFAULT_SERVICE_POLICY: ServicePolicy = {
  weight: {
    coating: "heavy",
    ppf: "heavy",
    wheel: "medium",
    interior: "medium",
    maintenance: "light",
    window: "light",
    other: "light",
  },
  weightCost: { heavy: 0.6, medium: 0.35, light: 0.15 },
  parallelEligible: ["maintenance", "window", "other"],
  acceptedDuringHeavy: ["maintenance", "window", "other"],
  acceptedDuringDrying: ["interior", "maintenance", "window", "other"],
};

export function serviceWeightOf(
  t: ReservationServiceType,
  policy: ServicePolicy = DEFAULT_SERVICE_POLICY,
): ServiceWeight {
  return policy.weight[t] ?? "light";
}

export function isHeavyService(
  t: ReservationServiceType,
  policy: ServicePolicy = DEFAULT_SERVICE_POLICY,
): boolean {
  return serviceWeightOf(t, policy) === "heavy";
}

export function isMultiDayProne(t: ReservationServiceType): boolean {
  return MULTIDAY_PRONE.has(t);
}

export function weightLabel(w: ServiceWeight): string {
  switch (w) {
    case "heavy":  return "重";
    case "medium": return "中";
    case "light":  return "軽";
  }
}
