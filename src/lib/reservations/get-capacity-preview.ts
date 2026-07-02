"use server";

// DealerOS — Capacity Warning Preview (Batch B4).
//
// SOFT preview only. Given a selected date + time range, counts EXISTING
// reservations that overlap it (dealer-scoped) and returns soft capacity
// warnings derived from the B3 scheduling settings. Never blocks, never writes.
//
// Security:
//   - dealer_id ALWAYS from getCurrentDealer(); never from client input.
//   - Read-only: no persistence, no schema change, no new table.
//   - No persistent staff/bay assignment is read or written.

import { createClient }             from "@/lib/supabase/server";
import { getCurrentDealer }         from "@/lib/auth/get-current-dealer";
import { getStaffCapacitySettings } from "@/lib/dealer-settings/save-staff-capacity";
import { computeCapacityWarnings }  from "@/lib/dealer-settings/staff-capacity";
import { getBayOptions }            from "@/lib/work-bays/get-work-bays";
import { WORK_BAYS_SCHEMA_READY }   from "@/lib/flags";
import { getDayCapacity }           from "@/lib/capacity/get-day-capacity";
import type { RecommendationLevel } from "@/lib/capacity/capacity-types";
import type { ReservationServiceType } from "@/lib/reservations/reservation-types";

export interface CapacityPreviewInput {
  date: string;        // "YYYY-MM-DD"
  start: string;       // "HH:MM"
  end: string;         // "HH:MM"
  excludeId?: string | null;
  /** B5a: selected technician — enables precise per-staff overlap warnings. */
  staffId?: string | null;
  /** B6b: selected work bay — enables precise per-bay overlap warnings. */
  bayId?: string | null;
  /** C1.2: selected service — enables the projected workshop-capacity preview. */
  serviceType?: ReservationServiceType | null;
}

/** C1.2: soft workshop-capacity recommendation for the selected slot (projected). */
export interface CapacityRecommendation {
  level: RecommendationLevel;
  workshopPct: number | null;   // rounded peak % (null when no dimensions known)
  staffPct: number | null;
  bayPct: number | null;
  vehiclePct: number | null;
  confidence: "measured" | "estimated";
}

export interface CapacityPreviewResult {
  overlapCount: number;
  warnings: string[];
  requireReason: boolean;
  capacity: CapacityRecommendation | null;
}

const EMPTY: CapacityPreviewResult = { overlapCount: 0, warnings: [], requireReason: false, capacity: null };

function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export async function getCapacityPreview(input: CapacityPreviewInput): Promise<CapacityPreviewResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return EMPTY;

    const startMin = toMin(input?.start);
    const endMin = toMin(input?.end);
    if (!input?.date || startMin === null || endMin === null || endMin <= startMin) return EMPTY;

    const supabase = await createClient();
    // Only select work_bay_id once the column exists (avoids 42703 pre-migration).
    const cols = WORK_BAYS_SCHEMA_READY
      ? "id, start_time, end_time, assigned_staff_id, work_bay_id"
      : "id, start_time, end_time, assigned_staff_id";
    const { data, error } = await supabase
      .from("reservations")
      .select(cols)
      .eq("dealer_id", dealer.dealer_id)
      .eq("reservation_date", input.date)
      .not("start_time", "is", null);

    if (error) {
      console.warn("[getCapacityPreview] query error — no warnings:", error.message);
      return EMPTY;
    }

    const selectedStaff = input.staffId || null;
    const selectedBay = (WORK_BAYS_SCHEMA_READY && input.bayId) || null;
    let overlapCount = 0;
    let staffOverlapCount = 0;
    let bayOverlapCount = 0;
    for (const r of (data ?? []) as unknown as Array<{ id: string; start_time: string | null; end_time: string | null; assigned_staff_id: string | null; work_bay_id?: string | null }>) {
      if (input.excludeId && r.id === input.excludeId) continue;
      const s = toMin(r.start_time);
      if (s === null) continue;
      const e = toMin(r.end_time) ?? s + 60; // display default when no end time
      // Half-open overlap test.
      if (s < endMin && startMin < e) {
        overlapCount++;
        if (selectedStaff && r.assigned_staff_id === selectedStaff) staffOverlapCount++;
        if (selectedBay && r.work_bay_id === selectedBay) bayOverlapCount++;
      }
    }

    // Resolve the selected bay's capacity for a precise per-bay warning.
    let bayCapacity: number | null = null;
    if (selectedBay) {
      const bay = (await getBayOptions()).find((b) => b.id === selectedBay);
      bayCapacity = bay ? bay.capacity : null;
    }

    const settings = await getStaffCapacitySettings();
    const warnings = computeCapacityWarnings(overlapCount, settings, {
      staffOverlapCount: selectedStaff ? staffOverlapCount : null,
      bayOverlapCount: selectedBay ? bayOverlapCount : null,
      bayCapacity,
    });

    // C1.2: projected workshop-capacity recommendation (includes the candidate).
    let capacity: CapacityRecommendation | null = null;
    if (input.serviceType) {
      const day = await getDayCapacity(input.date, {
        excludeReservationId: input.excludeId ?? null,
        candidate: {
          start: input.start,
          end: input.end,
          service_type: input.serviceType,
          staffId: selectedStaff,
          bayId: selectedBay,
        },
      });
      const pct = (v: number, cap: number | null): number | null =>
        cap && cap > 0 ? Math.round(v * 100) : null;
      capacity = {
        level: day.level,
        workshopPct: day.bottleneck ? Math.round(day.workshop.peak * 100) : null,
        staffPct: pct(day.staff.peak, day.staff.cap),
        bayPct: pct(day.bay.peak, day.bay.cap),
        vehiclePct: pct(day.vehicle.peak, day.vehicle.cap),
        confidence: day.confidence,
      };
    }

    // Override reason is required when settings mandate it AND there is either an
    // overlap warning or a High-Load capacity recommendation.
    const requireReason =
      settings.rules.override.require_reason &&
      (warnings.length > 0 || capacity?.level === "high_load");

    return { overlapCount, warnings, requireReason, capacity };
  } catch (err) {
    console.warn("[getCapacityPreview] failed — no warnings:", err);
    return EMPTY;
  }
}
