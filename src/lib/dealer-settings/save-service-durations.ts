"use server";

// DealerOS — Service Duration read/save (Batch B2).
//
// Security rules (mirrors saveBusinessHours):
//   - dealer_id is ALWAYS resolved server-side via requireRole → getCurrentDealer().
//     It is NEVER read from client input.
//   - Writes require owner or manager.
//   - Reuses the existing dealer_settings.business_days jsonb (key: service_durations).
//     No schema change, no migration, no new table.
//   - READ-MERGE: preserves other business_days keys (e.g. B1 business hours).

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireRole }      from "@/lib/staff/require-role";
import {
  type ServiceDurationMap,
  normalizeServiceDurations,
} from "./service-durations";

function readBusinessDays(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object") return {};
  const bd = (row as Record<string, unknown>).business_days;
  return bd && typeof bd === "object" ? (bd as Record<string, unknown>) : {};
}

export async function getServiceDurations(): Promise<ServiceDurationMap> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return {};

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("business_days")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error || !data) return {};
    return normalizeServiceDurations(readBusinessDays(data).service_durations);
  } catch (err) {
    console.warn("[getServiceDurations] failed — returning defaults:", err);
    return {};
  }
}

export async function saveServiceDurations(
  input: ServiceDurationMap,
): Promise<{ success: true } | { error: string }> {
  try {
    // dealer_id resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const service_durations = normalizeServiceDurations(input);

    const supabase = await createClient();

    // Read-merge: business_days is a shared jsonb container. Preserve keys owned
    // by other features (e.g. B1 business hours) — only overwrite service_durations.
    const { data: existing } = await supabase
      .from("dealer_settings")
      .select("business_days")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    const business_days = { ...readBusinessDays(existing), service_durations };

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
      console.error("[saveServiceDurations] error:", error);
      return { error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[saveServiceDurations] failed:", err);
    const msg = err instanceof Error ? err.message : "保存に失敗しました";
    return { error: msg };
  }
}
