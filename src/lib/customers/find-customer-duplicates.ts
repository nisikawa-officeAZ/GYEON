"use server";

// Phase 2 Sprint 1 — Customer duplicate detection (dealer-scoped).
//
// Architecture rule:
//   dealer_id ALWAYS comes from getCurrentDealer() — never from client input.
//   Only customers belonging to the current dealer are ever returned, layered
//   on top of the existing RLS policy as defense-in-depth.
//
// Matching strategy (non-destructive — this only reads):
//   1. Exact surname match (last_name) within the dealer.
//   2. Phone match by normalized digits (ignores hyphens / spacing differences).
//   Results from both strategies are merged and de-duplicated by id.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type { CustomerDB, CustomerDuplicateQuery } from "./customer-types";

const PHONE_SCAN_LIMIT = 200; // upper bound for the normalized-phone scan

function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

export async function findCustomerDuplicates(
  query: CustomerDuplicateQuery,
): Promise<CustomerDB[]> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return [];

    const lastName = query.last_name?.trim();
    const phone    = query.phone?.trim();
    if (!lastName && !phone) return [];

    const supabase = await createClient();
    const byId = new Map<string, CustomerDB>();

    // 1. Surname match — same dealer, not soft-deleted
    if (lastName) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("dealer_id", dealer.dealer_id)
        .is("deleted_at", null)
        .eq("last_name", lastName)
        .limit(10);

      if (error) {
        console.error("[findCustomerDuplicates] surname query error:", error.message);
      } else {
        for (const row of (data ?? []) as CustomerDB[]) byId.set(row.id, row);
      }
    }

    // 2. Phone match — normalized digit comparison
    const target = phone ? digitsOnly(phone) : "";
    if (target.length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("dealer_id", dealer.dealer_id)
        .is("deleted_at", null)
        .not("phone", "is", null)
        .limit(PHONE_SCAN_LIMIT);

      if (error) {
        console.error("[findCustomerDuplicates] phone query error:", error.message);
      } else {
        for (const row of (data ?? []) as CustomerDB[]) {
          if (row.phone && digitsOnly(row.phone) === target) byId.set(row.id, row);
        }
      }
    }

    return Array.from(byId.values());
  } catch (err) {
    console.error("[findCustomerDuplicates] error:", err);
    return [];
  }
}
