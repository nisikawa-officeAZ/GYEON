"use server";

import "server-only";

import { requireRole } from "@/lib/staff/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  parseCoatingSettingsV34,
  type CoatingSettingsV34,
} from "./coating-v34-contract";

export type AuthoritativeCoatingV34SaveResult =
  | { status: "SAVED"; settings: CoatingSettingsV34 }
  | { status: "INVALID_PAYLOAD" }
  | { status: "UNAUTHORIZED" }
  | { status: "SAVE_FAILED" };

/**
 * Saves the exact V3.4 payload for the current dealer.
 * Dealer identity is always server-derived and is re-authorized inside the RPC.
 */
export async function saveAuthoritativeCoatingV34Settings(
  coating: unknown,
): Promise<AuthoritativeCoatingV34SaveResult> {
  let parsed: CoatingSettingsV34;
  try {
    parsed = parseCoatingSettingsV34(coating);
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
    const { data, error } = await supabase.rpc("save_coating_v34_settings", {
      p_dealer_id: dealerId,
      p_coating: parsed,
    });

    if (error || data === null) return { status: "SAVE_FAILED" };
    return { status: "SAVED", settings: parseCoatingSettingsV34(data) };
  } catch {
    return { status: "SAVE_FAILED" };
  }
}
