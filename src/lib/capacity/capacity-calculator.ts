// DealerOS — Workshop Capacity calculator (Phase C1.1). Pure — no I/O.
//
// Time-resolves occupancy intervals for one date into per-dimension utilization
// (staff / bay / vehicle), a weighted composite "workshop" score, the bottleneck
// dimension, and a recommendation level. Soft only — never blocks.

import type { OccupancyInterval, CapacityResult, DimensionUtil } from "./capacity-types";
import { recommendationLevel, type CapacityThresholds } from "./recommendation";

const DEFAULT_WINDOW = { openMin: 8 * 60, closeMin: 20 * 60 };
const DEFAULT_SLOT = 15;

export interface ComputeDayCapacityInput {
  date: string;
  operatingWindow: { openMin: number; closeMin: number } | null; // null when closed/unset
  closed: boolean;
  intervals: OccupancyInterval[];
  bookableStaffCount: number | null;
  bayCapacityTotal: number | null;
  vehicleCap: number | null;
  weights?: { staff: number; bay: number; vehicle: number };
  thresholds?: CapacityThresholds;
  slotMin?: number;
}

export function computeDayCapacity(input: ComputeDayCapacityInput): CapacityResult {
  const slot = input.slotMin && input.slotMin > 0 ? input.slotMin : DEFAULT_SLOT;

  // Resolve the operating window (fall back to interval extents, then default).
  let win = input.operatingWindow;
  if (!win) {
    const times = input.intervals
      .filter((iv) => iv.startMin !== null)
      .flatMap((iv) => [iv.startMin as number, (iv.endMin ?? iv.startMin) as number]);
    win = times.length
      ? { openMin: Math.min(...times, DEFAULT_WINDOW.openMin), closeMin: Math.max(...times, DEFAULT_WINDOW.closeMin) }
      : { ...DEFAULT_WINDOW };
  }
  const openMin = win.openMin;
  const closeMin = Math.max(win.closeMin, openMin + slot);
  const T = Math.max(1, Math.ceil((closeMin - openMin) / slot));

  // Resolve interval bounds (null → full window) and clamp to the window.
  const resolved = input.intervals.map((iv) => {
    const s = Math.max(iv.startMin ?? openMin, openMin);
    const e = Math.min(Math.max(iv.endMin ?? closeMin, s), closeMin);
    return { iv, s, e };
  });

  let vSum = 0, sSum = 0, bSum = 0, vPeak = 0, sPeak = 0, bPeak = 0;
  for (let t = 0; t < T; t++) {
    const mid = openMin + t * slot + slot / 2;
    let v = 0, st = 0, b = 0;
    for (const { iv, s, e } of resolved) {
      if (mid >= s && mid < e) {
        v++;
        if (iv.needsStaff) st++;
        if (iv.needsBay) b++;
      }
    }
    vSum += v; sSum += st; bSum += b;
    if (v > vPeak) vPeak = v;
    if (st > sPeak) sPeak = st;
    if (b > bPeak) bPeak = b;
  }

  const dim = (peakCount: number, sumCount: number, cap: number | null): DimensionUtil => {
    if (cap === null || cap <= 0) return { peak: 0, avg: 0, cap: cap ?? null };
    return { peak: peakCount / cap, avg: sumCount / (cap * T), cap };
  };
  const staff = dim(sPeak, sSum, input.bookableStaffCount);
  const bay = dim(bPeak, bSum, input.bayCapacityTotal);
  const vehicle = dim(vPeak, vSum, input.vehicleCap);

  // Composite over dimensions with a known, positive capacity.
  const w = input.weights ?? { staff: 1, bay: 1, vehicle: 1 };
  const present: Array<{ key: "staff" | "bay" | "vehicle"; d: DimensionUtil; w: number }> = [];
  if (staff.cap && staff.cap > 0) present.push({ key: "staff", d: staff, w: w.staff });
  if (bay.cap && bay.cap > 0) present.push({ key: "bay", d: bay, w: w.bay });
  if (vehicle.cap && vehicle.cap > 0) present.push({ key: "vehicle", d: vehicle, w: w.vehicle });

  let workshopPeak = 0, workshopAvg = 0;
  let bottleneck: "staff" | "bay" | "vehicle" | null = null;
  if (present.length) {
    const wsum = present.reduce((a, x) => a + x.w, 0) || 1;
    workshopPeak = present.reduce((a, x) => a + x.d.peak * x.w, 0) / wsum;
    workshopAvg = present.reduce((a, x) => a + x.d.avg * x.w, 0) / wsum;
    bottleneck = present.reduce((best, x) => (x.d.peak > best.d.peak ? x : best), present[0]).key;
  }

  const bottleneckPeak =
    bottleneck === "staff" ? staff.peak : bottleneck === "bay" ? bay.peak : bottleneck === "vehicle" ? vehicle.peak : 0;
  const level = recommendationLevel(bottleneckPeak, input.thresholds);
  const confidence: "measured" | "estimated" =
    staff.cap && bay.cap && vehicle.cap ? "measured" : "estimated";

  const reservationCount = new Set(input.intervals.map((iv) => iv.reservationId)).size;

  return {
    date: input.date,
    closed: input.closed,
    operatingMinutes: input.closed ? 0 : closeMin - openMin,
    workshop: { peak: workshopPeak, avg: workshopAvg },
    staff,
    bay,
    vehicle,
    bottleneck,
    level,
    confidence,
    reservationCount,
  };
}
