"use server";

// DealerOS — Store Business Hours read/save (Batch B1).
//
// Security rules (mirrors saveCompanySettings):
//   - dealer_id is ALWAYS resolved server-side via requireRole → getCurrentDealer().
//     It is NEVER read from client input.
//   - Writes require owner or manager (requireRole enforces + throws otherwise).
//   - Reuses existing dealer_settings columns only (business_days, closed_weekdays,
//     temp_holidays). No schema change, no migration, no new table.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireRole }      from "@/lib/staff/require-role";
import {
  type BusinessHoursSettings,
  type BusinessHoursConfig,
  DEFAULT_BUSINESS_HOURS_SETTINGS,
  normalizeBusinessHoursConfig,
  isValidDateStr,
} from "./business-hours";

export async function getBusinessHoursSettings(): Promise<BusinessHoursSettings> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { ...DEFAULT_BUSINESS_HOURS_SETTINGS };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("business_days, closed_weekdays, temp_holidays")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error || !data) return { ...DEFAULT_BUSINESS_HOURS_SETTINGS };

    const row = data as Record<string, unknown>;
    return {
      business_hours: normalizeBusinessHoursConfig(row.business_days),
      closed_weekdays: Array.isArray(row.closed_weekdays)
        ? (row.closed_weekdays as unknown[]).filter(
            (n): n is number => typeof n === "number" && n >= 0 && n <= 6,
          )
        : [],
      temp_holidays: Array.isArray(row.temp_holidays)
        ? (row.temp_holidays as unknown[]).filter(isValidDateStr)
        : [],
    };
  } catch (err) {
    console.warn("[getBusinessHoursSettings] failed — returning defaults:", err);
    return { ...DEFAULT_BUSINESS_HOURS_SETTINGS };
  }
}

export interface SaveBusinessHoursInput {
  business_hours: BusinessHoursConfig;
  closed_weekdays: number[];
  temp_holidays: string[];
}

export async function saveBusinessHours(
  input: SaveBusinessHoursInput,
): Promise<{ success: true } | { error: string }> {
  try {
    // dealer_id resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    // Server-side validation / normalization — never trust the client-supplied shape.
    const business_days = normalizeBusinessHoursConfig(input?.business_hours);
    const closed_weekdays = Array.isArray(input?.closed_weekdays)
      ? Array.from(
          new Set(
            input.closed_weekdays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
          ),
        ).sort((a, b) => a - b)
      : [];
    const temp_holidays = Array.isArray(input?.temp_holidays)
      ? Array.from(new Set(input.temp_holidays.filter(isValidDateStr))).sort()
      : [];

    const supabase = await createClient();
    const { error } = await supabase
      .from("dealer_settings")
      .upsert(
        {
          dealer_id: dealerId,
          business_days,
          closed_weekdays,
          temp_holidays,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dealer_id" },
      );

    if (error) {
      console.error("[saveBusinessHours] error:", error);
      return { error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error("[saveBusinessHours] failed:", err);
    const msg = err instanceof Error ? err.message : "保存に失敗しました";
    return { error: msg };
  }
}
