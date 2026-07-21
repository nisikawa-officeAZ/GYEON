import "server-only";

// B7-3 — server-only dealer-bound entity-reference loader.
//
// The thin CLIENT half of the split: it constructs exactly one normal
// authenticated Supabase client and wires two dealer-scoped, minimal-projection
// reads. Every DECISION — validation, concurrency, failure precedence — belongs
// to the pure core it delegates to.
//
// ── WHY THIS REPLACES getCustomers/getVehicles FOR THE WIZARD ────────────────
// Those legacy loaders rediscover the tenant through `getCurrentDealer()` (a
// second, `.limit(1)` tenant authority) and collapse BOTH a read error AND a
// missing dealer to `[]`, so a failure is indistinguishable from "the dealer has
// no rows". This loader instead binds the tenant to the branded actor context,
// filters explicitly by that dealer id, and returns a discriminated result where
// only a genuine successful array can be empty.

import { createClient } from "@/lib/supabase/server";
import type { EstimateSaveActorContext } from "@/lib/auth/estimate-save-actor-context";
import {
  resolveDealerWizardEntityReferences,
  type DealerWizardEntityReferencesResult,
} from "./dealer-wizard-entity-references";

/**
 * Load the dealer's customer and vehicle references for exactly the tenant the
 * actor context authorizes.
 *
 * The client is built ONCE and shared by both reader closures. A client that
 * cannot be constructed is an expected operational failure, mapped into the typed
 * result (`dependency-threw`) rather than allowed to escape as an uncaught throw.
 *
 * The reader closures deliberately do NOT catch query exceptions: a rejected
 * query rejects its reader, and the pure core converts that — via
 * `Promise.allSettled` — into `dependency-threw`. Only a real successful array
 * (`Array.isArray(data)`) is a successful read; null/undefined/non-array is a
 * failed read.
 */
export async function loadDealerWizardEntityReferences(
  context: EstimateSaveActorContext,
): Promise<DealerWizardEntityReferencesResult> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, reason: "dependency-threw" };
  }

  return resolveDealerWizardEntityReferences(context, {
    readCustomers: async (dealerId) => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, dealer_id, last_name, first_name, phone")
        .eq("dealer_id", dealerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error || !Array.isArray(data)) return { ok: false };
      return { ok: true, rows: data };
    },
    readVehicles: async (dealerId) => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, dealer_id, customer_id, maker, model, plate_number, body_size")
        .eq("dealer_id", dealerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error || !Array.isArray(data)) return { ok: false };
      return { ok: true, rows: data };
    },
  });
}
