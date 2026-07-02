// DealerOS — Reservation Advisor (Phase C2.5). Pure, independent, reusable.
//
// The single recommendation service for reservations. Given a computed day
// CapacityResult + the selected service, it produces:
//   - a recommendation level (Available / Limited / Warning / High Load)
//   - WHY (human-readable reasons, C2.1 / C2.4)
//   - suggested lighter alternatives when heavy work lands on a busy day (C2.2)
//
// No I/O, no dealer data access — deterministic and unit-friendly. Future AI is
// expected to REUSE this engine rather than re-derive recommendations.

import type { CapacityResult, RecommendationLevel } from "./capacity-types";
import { recommendationLabel } from "./recommendation";
import { isHeavyService, LIGHT_ALTERNATIVES } from "./service-classification";
import { type ReservationServiceType, serviceTypeLabel } from "@/lib/reservations/reservation-types";

export type ReasonSeverity = "info" | "notice" | "warn";

export interface AdvisorReason {
  kind: "workshop" | "staff" | "bay" | "vehicle" | "service" | "closed";
  label: string;
  severity: ReasonSeverity;
}

export interface ServiceSuggestion {
  service_type: ReservationServiceType;
  label: string;
}

export interface ReservationAdvice {
  level: RecommendationLevel;
  headline: string;
  reasons: AdvisorReason[];
  suggestedAlternatives: ServiceSuggestion[];
  metrics: {
    workshopPct: number | null;   // rounded %
    staff: string | null;         // "occupied/cap"
    bay: string | null;
    vehicle: string | null;
  };
}

function severityFor(peak: number): ReasonSeverity {
  if (peak >= 1) return "warn";
  if (peak >= 0.9) return "notice";
  return "info";
}

/** "occupied/cap" text for a dimension, or null when capacity is unknown. */
function occ(peak: number, cap: number | null): string | null {
  return cap && cap > 0 ? `${Math.round(peak * cap)}/${cap}` : null;
}

export function adviseReservation(
  capacity: CapacityResult,
  serviceType: ReservationServiceType,
): ReservationAdvice {
  const level = capacity.level;
  const workshopPct = capacity.bottleneck ? Math.round(capacity.workshop.peak * 100) : null;
  const staff = occ(capacity.staff.peak, capacity.staff.cap);
  const bay = occ(capacity.bay.peak, capacity.bay.cap);
  const vehicle = occ(capacity.vehicle.peak, capacity.vehicle.cap);

  const reasons: AdvisorReason[] = [];
  if (capacity.closed) {
    reasons.push({ kind: "closed", label: "定休日です（予約は作成可能）", severity: "notice" });
  }
  if (workshopPct !== null) {
    reasons.push({
      kind: "workshop",
      label: `工房稼働 ${workshopPct}%`,
      severity: level === "high_load" ? "warn" : level === "warning" ? "notice" : "info",
    });
  }
  if (staff) reasons.push({ kind: "staff", label: `スタッフ ${staff} 稼働`, severity: severityFor(capacity.staff.peak) });
  if (bay) reasons.push({ kind: "bay", label: `作業ベイ ${bay} 稼働`, severity: severityFor(capacity.bay.peak) });
  if (vehicle) reasons.push({ kind: "vehicle", label: `同時対応 ${vehicle}`, severity: severityFor(capacity.vehicle.peak) });

  const heavy = isHeavyService(serviceType);
  const busy = level === "warning" || level === "high_load";
  const suggestedAlternatives: ServiceSuggestion[] = [];
  if (heavy && busy) {
    reasons.push({
      kind: "service",
      label: `${serviceTypeLabel(serviceType)}などの重作業は混雑日には推奨されません`,
      severity: "warn",
    });
    for (const alt of LIGHT_ALTERNATIVES) {
      if (alt !== serviceType) suggestedAlternatives.push({ service_type: alt, label: serviceTypeLabel(alt) });
    }
  }

  const headline =
    heavy && busy ? `${recommendationLabel(level)} — 軽作業がおすすめです` : recommendationLabel(level);

  return {
    level,
    headline,
    reasons,
    suggestedAlternatives,
    metrics: { workshopPct, staff, bay, vehicle },
  };
}
