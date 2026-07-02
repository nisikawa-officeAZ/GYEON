"use server";

// DealerOS — Capacity override reason persistence (Batch B5b).
//
// Persists the manual override reason for a capacity warning using the EXISTING
// activity_logs infrastructure (createActivityLog / getActivityLogsByEntity).
// No new table, no new column, no migration.
//
// Security:
//   - dealer_id ALWAYS resolved server-side (getCurrentDealer / createActivityLog);
//     never from client input.
//   - The reservation is verified to belong to the current dealer before logging,
//     so a client cannot log against a reservation it does not own.

import { createClient }           from "@/lib/supabase/server";
import { getCurrentDealer }        from "@/lib/auth/get-current-dealer";
import { createActivityLog, getActivityLogsByEntity } from "@/lib/activity/activity-log";

const OVERRIDE_EVENT = "capacity_override";

export interface LogCapacityOverrideInput {
  reservationId: string;
  reason: string;
  warnings: string[];
  isEdit: boolean;
}

export async function logCapacityOverride(
  input: LogCapacityOverrideInput,
): Promise<{ ok: boolean }> {
  try {
    const reason = (input?.reason ?? "").trim();
    if (!input?.reservationId || !reason) return { ok: false };

    // Verify the reservation belongs to the current dealer (dealer-scoped).
    const dealer = await getCurrentDealer();
    if (!dealer) return { ok: false };
    const supabase = await createClient();
    const { data: owned } = await supabase
      .from("reservations")
      .select("id")
      .eq("id", input.reservationId)
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();
    if (!owned) return { ok: false };

    await createActivityLog({
      entity_type: "reservation",
      entity_id:   input.reservationId,
      action:      input.isEdit ? "updated" : "created",
      title:       "キャパシティ警告を上書き",
      description: reason,
      metadata: {
        event:    OVERRIDE_EVENT,
        reason,
        warnings: Array.isArray(input.warnings) ? input.warnings.slice(0, 10) : [],
      },
    });
    return { ok: true };
  } catch (err) {
    console.warn("[logCapacityOverride] failed:", err);
    return { ok: false };
  }
}

export interface CapacityOverrideRecord {
  reason: string;
  created_at: string;
}

/** Latest capacity-override reason recorded for a reservation, or null. */
export async function getLatestCapacityOverride(
  reservationId: string,
): Promise<CapacityOverrideRecord | null> {
  try {
    if (!reservationId) return null;
    const logs = await getActivityLogsByEntity("reservation", reservationId); // dealer-scoped, newest first
    for (const log of logs) {
      const md = (log.metadata ?? {}) as Record<string, unknown>;
      if (md.event === OVERRIDE_EVENT && typeof md.reason === "string" && md.reason.trim() !== "") {
        return { reason: md.reason, created_at: log.created_at };
      }
    }
    return null;
  } catch (err) {
    console.warn("[getLatestCapacityOverride] failed:", err);
    return null;
  }
}
