// DealerOS — Reservation Advisor + Recommendation Engine (Phase C2 / C2.6).
// Pure, independent, reusable. The single recommendation service for reservations.
//
// Given a computed day CapacityResult + the selected service + a config context,
// it produces:
//   - a recommendation level (Available / Limited / Warning / High Load)
//   - WHY (human-readable reasons, C2.1 / C2.4)
//   - CAPACITY-RANKED suggested alternatives (C2.6) — NOT a fixed list. Ranking
//     evaluates remaining capacity, service duration, blocking rules, parallel
//     rules, and store policy (heavy/medium/light tiers, accepted-during-heavy,
//     accepted-during-drying). Config is injectable so each dealer can define it.
//
// No I/O, no dealer data access — deterministic. Future AI / Google workflows are
// expected to REUSE this engine rather than re-derive recommendations.

import type { CapacityResult, RecommendationLevel } from "./capacity-types";
import { recommendationLabel } from "./recommendation";
import {
  type ServicePolicy,
  DEFAULT_SERVICE_POLICY,
  serviceWeightOf,
  isHeavyService,
  weightLabel,
} from "./service-classification";
import { SERVICE_TYPES } from "@/lib/dealer-settings/service-durations";
import type { ServiceDurationMap } from "@/lib/dealer-settings/service-durations";
import { type ReservationServiceType, serviceTypeLabel } from "@/lib/reservations/reservation-types";
import { evaluateServiceCompatibility } from "./service-compatibility";

export type ReasonSeverity = "info" | "notice" | "warn";

export interface AdvisorReason {
  kind: "workshop" | "staff" | "bay" | "vehicle" | "service" | "closed";
  label: string;
  severity: ReasonSeverity;
}

export interface ServiceSuggestion {
  service_type: ReservationServiceType;
  label: string;
  reason?: string;
}

/** C2.7: plain-language remaining-capacity factor for the explanation panel. */
export interface AdviceFactor {
  label: string;
  value: string;
  tone: "good" | "tight" | "full" | "info";
}

export interface ReservationAdvice {
  level: RecommendationLevel;
  headline: string;
  reasons: AdvisorReason[];
  suggestedAlternatives: ServiceSuggestion[];
  /** C2.10: compatibility of the SELECTED service with the current schedule. */
  selectedCompatibility: {
    status: "compatible" | "caution" | "not_recommended";
    reason: string;
    phase: "heavy" | "drying" | "buffer" | "none";
  };
  /** C2.7: remaining-capacity factors, in plain language. */
  factors: AdviceFactor[];
  metrics: {
    workshopPct: number | null;
    staff: string | null;
    bay: string | null;
    vehicle: string | null;
  };
}

/** Injectable configuration for the recommendation engine. */
export interface AdviceEngineContext {
  durations: ServiceDurationMap;
  policy?: ServicePolicy;
  blockedCombinations: Array<[ReservationServiceType, ReservationServiceType]>;
  parallelAllowed: boolean;
}

function severityFor(peak: number): ReasonSeverity {
  if (peak >= 1) return "warn";
  if (peak >= 0.9) return "notice";
  return "info";
}

function occ(peak: number, cap: number | null): string | null {
  return cap && cap > 0 ? `${Math.round(peak * cap)}/${cap}` : null;
}

function toneFromPeak(peak: number): AdviceFactor["tone"] {
  if (peak >= 1) return "full";
  if (peak >= 0.7) return "tight";
  return "good";
}

function durationText(dur: ServiceDurationMap[ReservationServiceType] | undefined): string {
  if (!dur) return "設定なし";
  const parts: string[] = [];
  if (dur.days && dur.days > 1) parts.push(`${dur.days}日（乾燥/複数日）`);
  if (dur.hours) parts.push(`${dur.hours}時間`);
  const buf: string[] = [];
  if (dur.buffer_before_min) buf.push(`前${dur.buffer_before_min}分`);
  if (dur.buffer_after_min) buf.push(`後${dur.buffer_after_min}分`);
  if (buf.length) parts.push(`バッファ ${buf.join("/")}`);
  return parts.length ? parts.join(" ・ ") : "標準";
}

function candidateCost(
  service: ReservationServiceType,
  durations: ServiceDurationMap,
  policy: ServicePolicy,
  operatingMinutes: number,
): number {
  const dur = durations[service];
  if (dur?.hours && dur.hours > 0 && operatingMinutes > 0) {
    return Math.min(0.9, (dur.hours * 60) / operatingMinutes);
  }
  return policy.weightCost[serviceWeightOf(service, policy)];
}

/**
 * Rank candidate services by fit against REMAINING capacity (C2.6).
 * fit = remainingHeadroom − candidateCost, plus policy bonuses; blocked
 * combinations are excluded. Returns the best-fitting services (max 4).
 */
export function rankServiceRecommendations(
  selected: ReservationServiceType,
  capacity: CapacityResult,
  ctx: AdviceEngineContext,
): ServiceSuggestion[] {
  const policy = ctx.policy ?? DEFAULT_SERVICE_POLICY;
  const dayCtx = capacity.dayContext ?? { services: [], dryingActive: false, heavyActive: false, bufferActive: false };
  const bottleneckPeak = capacity.bottleneck ? capacity[capacity.bottleneck].peak : capacity.workshop.peak;
  const remainingHeadroom = Math.max(0, 1 - bottleneckPeak);
  const operatingMinutes = capacity.operatingMinutes || 12 * 60;

  // C2.9: service compatibility gate — only recommend services that can coexist.
  const compatCtx = {
    dayServices: dayCtx.services,
    dryingActive: dayCtx.dryingActive,
    heavyActive: dayCtx.heavyActive,
    blockedCombinations: ctx.blockedCombinations,
    policy,
  };

  const scored = SERVICE_TYPES.filter((c) => c !== selected)
    .map((c) => ({ c, verdict: evaluateServiceCompatibility(c, compatCtx) }))
    .filter((x) => x.verdict.compatibility === "compatible")
    .map(({ c, verdict }) => {
      const cost = candidateCost(c, ctx.durations, policy, operatingMinutes);
      let score = remainingHeadroom - cost;
      if (ctx.parallelAllowed && policy.parallelEligible.includes(c)) score += 0.1;
      if (dayCtx.heavyActive && policy.acceptedDuringHeavy.includes(c)) score += 0.15;
      if (dayCtx.dryingActive && policy.acceptedDuringDrying.includes(c)) score += 0.15;
      const reason = `${weightLabel(serviceWeightOf(c, policy))}作業 ・ ${verdict.reason}`;
      return { c, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return scored.map((x) => ({
    service_type: x.c,
    label: serviceTypeLabel(x.c),
    reason: x.reason,
  }));
}

export function adviseReservation(
  capacity: CapacityResult,
  serviceType: ReservationServiceType,
  ctx?: AdviceEngineContext,
): ReservationAdvice {
  const policy = ctx?.policy ?? DEFAULT_SERVICE_POLICY;
  const level = capacity.level;
  const dayCtx = capacity.dayContext ?? { services: [], dryingActive: false, heavyActive: false, bufferActive: false };
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

  const busy = level === "warning" || level === "high_load";
  const heavySelected = isHeavyService(serviceType, policy);

  if (dayCtx.dryingActive) {
    reasons.push({ kind: "service", label: "乾燥期間中の作業があります（対応可能な軽作業を推奨）", severity: "notice" });
  }
  if (busy && heavySelected) {
    reasons.push({ kind: "service", label: `${serviceTypeLabel(serviceType)}などの重作業は混雑日には推奨されません`, severity: "warn" });
  }

  // C2.9/C2.10: compatibility of the SELECTED service with OTHER reservations present.
  const otherServices = dayCtx.services.filter((s) => s !== serviceType);
  const heavyActiveOther = otherServices.some((s) => isHeavyService(s, policy));
  const selVerdict = evaluateServiceCompatibility(serviceType, {
    dayServices: otherServices,
    dryingActive: dayCtx.dryingActive,
    heavyActive: heavyActiveOther,
    blockedCombinations: ctx?.blockedCombinations ?? [],
    policy,
  });

  // Phase highlight: acceptable during heavy / drying / buffer.
  let phase: "heavy" | "drying" | "buffer" | "none" = "none";
  if (heavyActiveOther && policy.acceptedDuringHeavy.includes(serviceType)) phase = "heavy";
  else if (dayCtx.dryingActive && policy.acceptedDuringDrying.includes(serviceType)) phase = "drying";
  else if (dayCtx.bufferActive && policy.acceptedDuringDrying.includes(serviceType)) phase = "buffer";

  const compatStatus: "compatible" | "caution" | "not_recommended" =
    selVerdict.compatibility === "not_recommended" ? "not_recommended" : busy ? "caution" : "compatible";
  const compatReason =
    compatStatus === "caution" && selVerdict.compatibility === "compatible"
      ? `${selVerdict.reason}（混雑気味）`
      : selVerdict.reason;
  const selectedCompatibility = { status: compatStatus, reason: compatReason, phase };

  // C2.6: capacity-ranked alternatives (only when it helps: busy or drying context).
  const shouldSuggest = !!ctx && (busy || dayCtx.dryingActive);
  const suggestedAlternatives = shouldSuggest && ctx
    ? rankServiceRecommendations(serviceType, capacity, ctx)
    : [];

  const headline =
    suggestedAlternatives.length > 0
      ? `${recommendationLabel(level)} — 代替候補あり`
      : recommendationLabel(level);

  // C2.7: plain-language remaining-capacity factors.
  const factors: AdviceFactor[] = [];
  if (workshopPct !== null) {
    factors.push({
      label: "工房の余裕",
      value: `${Math.max(0, 100 - workshopPct)}%`,
      tone: toneFromPeak(capacity.workshop.peak),
    });
  }
  if (capacity.staff.cap && capacity.staff.cap > 0) {
    const occupied = Math.round(capacity.staff.peak * capacity.staff.cap);
    factors.push({
      label: "スタッフの空き",
      value: `${Math.max(0, capacity.staff.cap - occupied)}/${capacity.staff.cap}名`,
      tone: toneFromPeak(capacity.staff.peak),
    });
  }
  if (capacity.bay.cap && capacity.bay.cap > 0) {
    const occupied = Math.round(capacity.bay.peak * capacity.bay.cap);
    factors.push({
      label: "ベイの空き",
      value: `${Math.max(0, capacity.bay.cap - occupied)}/${capacity.bay.cap}`,
      tone: toneFromPeak(capacity.bay.peak),
    });
  }
  if (ctx) {
    factors.push({
      label: "所要時間の影響",
      value: durationText(ctx.durations[serviceType]),
      tone: "info",
    });
    const blockedHits = ctx.blockedCombinations.filter(
      ([a, b]) =>
        (a === serviceType && dayCtx.services.includes(b)) ||
        (b === serviceType && dayCtx.services.includes(a)),
    );
    factors.push({
      label: "作業ルール",
      value: blockedHits.length
        ? "本日の予約と同時実施を避ける組合せあり"
        : ctx.parallelAllowed
          ? "並行作業 可"
          : "並行作業 不可",
      tone: blockedHits.length ? "full" : "info",
    });
  }

  return {
    level,
    headline,
    reasons,
    suggestedAlternatives,
    selectedCompatibility,
    factors,
    metrics: { workshopPct, staff, bay, vehicle },
  };
}
