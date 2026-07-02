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

export interface CapacityPreviewInput {
  date: string;        // "YYYY-MM-DD"
  start: string;       // "HH:MM"
  end: string;         // "HH:MM"
  excludeId?: string | null;
}

export interface CapacityPreviewResult {
  overlapCount: number;
  warnings: string[];
  requireReason: boolean;
}

const EMPTY: CapacityPreviewResult = { overlapCount: 0, warnings: [], requireReason: false };

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
    const { data, error } = await supabase
      .from("reservations")
      .select("id, start_time, end_time")
      .eq("dealer_id", dealer.dealer_id)
      .eq("reservation_date", input.date)
      .not("start_time", "is", null);

    if (error) {
      console.warn("[getCapacityPreview] query error — no warnings:", error.message);
      return EMPTY;
    }

    let overlapCount = 0;
    for (const r of (data ?? []) as Array<{ id: string; start_time: string | null; end_time: string | null }>) {
      if (input.excludeId && r.id === input.excludeId) continue;
      const s = toMin(r.start_time);
      if (s === null) continue;
      const e = toMin(r.end_time) ?? s + 60; // display default when no end time
      // Half-open overlap test.
      if (s < endMin && startMin < e) overlapCount++;
    }

    const settings = await getStaffCapacitySettings();
    const warnings = computeCapacityWarnings(overlapCount, settings);
    const requireReason = warnings.length > 0 && settings.rules.override.require_reason;

    return { overlapCount, warnings, requireReason };
  } catch (err) {
    console.warn("[getCapacityPreview] failed — no warnings:", err);
    return EMPTY;
  }
}
