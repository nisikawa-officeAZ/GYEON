"use server";

// DealerOS — Staff / Capacity read/save (Batch B3).
//
// Security rules (mirrors saveBusinessHours / saveServiceDurations):
//   - dealer_id is ALWAYS resolved server-side via requireRole → getCurrentDealer().
//     It is NEVER read from client input.
//   - Writes require owner or manager.
//   - Reuses the existing dealer_settings.business_days jsonb (key: scheduling).
//     No schema change, no migration, no new table.
//   - READ-MERGE: preserves other business_days keys (B1 hours, B2 durations).
//   - Per-staff keys are reconciled against the dealer's live dealer_staff set,
//     so cross-dealer / orphaned ids can never be persisted or returned.
//
// FOUNDATION ONLY: not wired into the calendar or reservation creation; no
// conflict detection and no hard blocking.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireRole }      from "@/lib/staff/require-role";
import { getStaffList }     from "@/lib/staff/get-staff-list";
import {
  type StaffCapacitySettings,
  defaultStaffCapacitySettings,
  normalizeStaffCapacitySettings,
  reconcileStaffCapacity,
} from "./staff-capacity";

function readBusinessDays(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const bd = (row as Record<string, unknown>).business_days;
  return bd && typeof bd === "object" ? (bd as Record<string, unknown>) : {};
}

export async function getStaffCapacitySettings(): Promise<StaffCapacitySettings> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return defaultStaffCapacitySettings();

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("business_days")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    const settings = error || !data
      ? defaultStaffCapacitySettings()
      : normalizeStaffCapacitySettings(readBusinessDays(data).scheduling);

    // Drop per-staff entries for staff who no longer exist in this dealer.
    const staff = await getStaffList();
    settings.staff_capacity = reconcileStaffCapacity(
      settings.staff_capacity,
      new Set(staff.map((s) => s.id)),
    );
    return settings;
  } catch (err) {
    console.warn("[getStaffCapacitySettings] failed — returning defaults:", err);
    return defaultStaffCapacitySettings();
  }
}

export async function saveStaffCapacity(
  input: StaffCapacitySettings,
): Promise<{ success: true } | { error: string }> {
  try {
    // dealer_id resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const normalized = normalizeStaffCapacitySettings(input);

    // Only keep per-staff entries that belong to THIS dealer's staff set.
    const staff = await getStaffList();
    normalized.staff_capacity = reconcileStaffCapacity(
      normalized.staff_capacity,
      new Set(staff.map((s) => s.id)),
    );

    const supabase = await createClient();

    // Read-merge: business_days is a shared jsonb container. Preserve keys owned
    // by other features (B1 hours, B2 durations) — only overwrite `scheduling`.
    const { data: existing } = await supabase
      .from("dealer_settings")
      .select("business_days")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    const business_days = { ...readBusinessDays(existing), scheduling: normalized };

    const { error } = await supabase
      .from("dealer_settings")
      .upsert(
        {
          dealer_id: dealerId,
          business_days,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dealer_id" },
      );

    if (error) {
      console.error("[saveStaffCapacity] error:", error);
      return { error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[saveStaffCapacity] failed:", err);
    const msg = err instanceof Error ? err.message : "保存に失敗しました";
    return { error: msg };
  }
}
