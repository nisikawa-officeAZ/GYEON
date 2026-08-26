"use server";

import "server-only";

import { requireRole } from "@/lib/staff/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  parsePpfR1InstallationCoefficientSettings,
  type PpfR1InstallationCoefficientSettings,
} from "./ppf-r1-installation-coefficient-contract";
import { parsePpfR1PriceSettings, type PpfR1PriceSettings } from "./ppf-r1-price-contract";

export type AuthoritativePpfR1SaveResult =
  | { status: "SAVED"; settings: PpfR1PriceSettings; coefficients: PpfR1InstallationCoefficientSettings }
  | { status: "INVALID_PAYLOAD" }
  | { status: "UNAUTHORIZED" }
  | { status: "SAVE_FAILED" };

/**
 * Saves the exact PPF R1 payload for the current dealer.
 * Dealer identity is always server-derived and is re-authorized inside the RPC.
 */
export async function saveAuthoritativePpfR1PriceSettings(
  ppf: unknown,
  coefficients: unknown,
): Promise<AuthoritativePpfR1SaveResult> {
  let parsed: PpfR1PriceSettings;
  let parsedCoefficients: PpfR1InstallationCoefficientSettings;
  try {
    parsed = parsePpfR1PriceSettings(ppf);
    parsedCoefficients = parsePpfR1InstallationCoefficientSettings(coefficients);
  } catch {
    return { status: "INVALID_PAYLOAD" };
  }

  let dealerId: string;
  try {
    ({ dealerId } = await requireRole(["owner", "manager"]));
  } catch {
    return { status: "UNAUTHORIZED" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_ppf_r1_price_settings", {
      p_dealer_id: dealerId,
      p_ppf: parsed,
      p_coefficients: parsedCoefficients,
    });

    if (error || data === null) return { status: "SAVE_FAILED" };
    if (typeof data !== "object" || Array.isArray(data)) return { status: "SAVE_FAILED" };
    const saved = data as Record<string, unknown>;
    return {
      status: "SAVED",
      settings: parsePpfR1PriceSettings(saved.ppf),
      coefficients: parsePpfR1InstallationCoefficientSettings(saved.coefficients),
    };
  } catch {
    return { status: "SAVE_FAILED" };
  }
}
