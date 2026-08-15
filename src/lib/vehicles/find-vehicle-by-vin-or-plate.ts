"use server";

// Phase 2 Sprint 1 — Vehicle duplicate detection (dealer-scoped).
//
// Architecture rule:
//   dealer_id ALWAYS comes from getCurrentDealer() — never from client input.
//   Only vehicles belonging to the current dealer are ever returned, layered on
//   top of the existing RLS policy as defense-in-depth.
//
// Matching strategy (read-only):
//   - VIN (車台番号): compared with whitespace removed + upper-cased.
//   - Plate number (ナンバー): compared with whitespace removed.
//   Results from both strategies are merged and de-duplicated by id.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type { VehicleDB, VehicleLookupQuery } from "./vehicle-types";

const SCAN_LIMIT = 200; // upper bound per normalized scan

function normVin(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

function normPlate(s: string): string {
  return s.replace(/[\s　]+/g, "");
}

export async function findVehicleByVinOrPlate(
  query: VehicleLookupQuery,
): Promise<VehicleDB[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const vin   = query.vin?.trim();
    const plate = query.plate_number?.trim();
    if (!vin && !plate) return [];

    const supabase = await createClient();
    const byId = new Map<string, VehicleDB>();

    // VIN match — normalized comparison
    const vinTarget = vin ? normVin(vin) : "";
    if (vinTarget.length > 0) {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("dealer_id", dealer.dealer_id)
        .is("deleted_at", null)
        .not("vin", "is", null)
        .limit(SCAN_LIMIT);

      if (error) {
        console.error("[findVehicleByVinOrPlate] vin query error:", error.message);
      } else {
        for (const row of (data ?? []) as VehicleDB[]) {
          if (row.vin && normVin(row.vin) === vinTarget) byId.set(row.id, row);
        }
      }
    }

    // Plate match — normalized comparison
    const plateTarget = plate ? normPlate(plate) : "";
    if (plateTarget.length > 0) {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("dealer_id", dealer.dealer_id)
        .is("deleted_at", null)
        .not("plate_number", "is", null)
        .limit(SCAN_LIMIT);

      if (error) {
        console.error("[findVehicleByVinOrPlate] plate query error:", error.message);
      } else {
        for (const row of (data ?? []) as VehicleDB[]) {
          if (row.plate_number && normPlate(row.plate_number) === plateTarget) byId.set(row.id, row);
        }
      }
    }

    return Array.from(byId.values());
  } catch (err) {
    console.error("[findVehicleByVinOrPlate] error:", err);
    return [];
  }
}
