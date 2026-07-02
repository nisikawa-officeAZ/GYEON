// DealerOS — Workshop Capacity recommendation levels (Phase C1.1). Pure.

import type { RecommendationLevel } from "./capacity-types";

export interface CapacityThresholds {
  limited: number;    // >= → Limited
  warning: number;    // >= → Warning
  high_load: number;  // >= → High Load
}

// Fractions of capacity (1.0 = 100%). Configurable later via B3 rules.
export const DEFAULT_THRESHOLDS: CapacityThresholds = {
  limited: 0.70,
  warning: 0.90,
  high_load: 1.0,
};

/** Map a bottleneck utilization fraction to a recommendation level. */
export function recommendationLevel(
  util: number,
  t: CapacityThresholds = DEFAULT_THRESHOLDS,
): RecommendationLevel {
  if (util >= t.high_load) return "high_load";
  if (util >= t.warning) return "warning";
  if (util >= t.limited) return "limited";
  return "available";
}

export function recommendationLabel(level: RecommendationLevel): string {
  switch (level) {
    case "available": return "空きあり";
    case "limited":   return "やや混雑";
    case "warning":   return "要注意";
    case "high_load": return "高負荷";
  }
}

// Capacity color rules: Available=green, Limited=yellow, Warning=orange, High Load=red.
export function levelDotClass(level: RecommendationLevel): string {
  switch (level) {
    case "available": return "bg-emerald-500";
    case "limited":   return "bg-yellow-500";
    case "warning":   return "bg-orange-500";
    case "high_load": return "bg-red-500";
  }
}

/** Faint cell tint — only for busy levels, to keep quiet days uncluttered. */
export function levelTintClass(level: RecommendationLevel): string {
  switch (level) {
    case "warning":   return "bg-orange-500/10";
    case "high_load": return "bg-red-500/10";
    default:          return "";
  }
}
