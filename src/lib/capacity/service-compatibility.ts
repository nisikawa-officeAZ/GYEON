// DealerOS — Service Compatibility Engine (Phase C2.9). Pure, reusable.
//
// Determines whether a candidate service category can reasonably coexist with
// the services/phases currently occupying the workshop on a given day. Driven
// entirely by the injectable ServicePolicy + blocking rules — NOT hardcoded to
// any GYEON service. Reused by the reservation advisor, and (future) calendar,
// AI assistant, Google/LINE reservation flows.

import type { ReservationServiceType } from "@/lib/reservations/reservation-types";
import {
  type ServicePolicy,
  DEFAULT_SERVICE_POLICY,
  isHeavyService,
} from "./service-classification";

export type Compatibility = "compatible" | "not_recommended";

export interface CompatibilityContext {
  /** Service categories already present on the day. */
  dayServices: ReservationServiceType[];
  /** A multi-day job is in a drying phase on the day. */
  dryingActive: boolean;
  /** A heavy service is actively worked on the day. */
  heavyActive: boolean;
  /** Configurable "avoid together" pairs (B3 blocking rules). */
  blockedCombinations: Array<[ReservationServiceType, ReservationServiceType]>;
  policy?: ServicePolicy;
}

export interface CompatibilityVerdict {
  compatibility: Compatibility;
  reason: string;
}

function blockedWith(
  service: ReservationServiceType,
  present: ReservationServiceType[],
  blocked: Array<[ReservationServiceType, ReservationServiceType]>,
): boolean {
  return blocked.some(
    ([a, b]) => (a === service && present.includes(b)) || (b === service && present.includes(a)),
  );
}

/**
 * Evaluate whether `candidate` can coexist with the current workshop context.
 * Order: explicit blocking → drying phase → heavy-active phase → default.
 */
export function evaluateServiceCompatibility(
  candidate: ReservationServiceType,
  ctx: CompatibilityContext,
): CompatibilityVerdict {
  const policy = ctx.policy ?? DEFAULT_SERVICE_POLICY;
  const heavyCandidate = isHeavyService(candidate, policy);

  if (blockedWith(candidate, ctx.dayServices, ctx.blockedCombinations)) {
    return { compatibility: "not_recommended", reason: "現在の予約と同時実施できない組合せです" };
  }

  if (ctx.dryingActive) {
    if (policy.acceptedDuringDrying.includes(candidate)) {
      return { compatibility: "compatible", reason: "乾燥期間中に並行作業が可能です" };
    }
    if (heavyCandidate) {
      return { compatibility: "not_recommended", reason: "乾燥期間中の重作業は推奨されません" };
    }
  }

  if (ctx.heavyActive) {
    if (policy.acceptedDuringHeavy.includes(candidate)) {
      return { compatibility: "compatible", reason: "重作業中でも対応可能な軽作業です" };
    }
    if (heavyCandidate) {
      return { compatibility: "not_recommended", reason: "重作業が作業資源を占有しています" };
    }
  }

  return { compatibility: "compatible", reason: "現在のスケジュールと両立可能です" };
}
