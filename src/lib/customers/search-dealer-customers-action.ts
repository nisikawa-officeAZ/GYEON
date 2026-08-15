"use server";

// B2.2B — Authenticated, tenant-scoped dealer customer search (SERVER ACTION).
//
// ── TENANCY IS STRUCTURAL, NOT CONVENTIONAL ─────────────────────────────────────
// The browser sends ONE argument: an untrusted search term. There is deliberately no dealer
// parameter, so a client cannot express a cross-tenant request at all. The dealer comes from
// `getEstimateSaveActorContext()`, whose `{ userId, dealerId, role }` triple is branded and is
// guaranteed to derive dealer and role from the SAME active membership. `getCurrentDealer()` is
// NOT used: its `.limit(1).single()` picks an arbitrary dealer for a multi-membership user, which
// is precisely the tenant-isolation defect the actor context exists to remove.
//
// Every query below carries an explicit `.eq("dealer_id", …)` in addition to RLS, because relying
// on RLS alone would leave a single policy edit as the only thing between tenants.
//
// ── PII STAYS ON THE SERVER ─────────────────────────────────────────────────────
// Kana, address and name parts are SELECTED (they are what the operator searches and orders by)
// but never returned. `toCustomerReference` narrows every row to exactly { id, displayName, phone },
// with `displayName` composed here, on the server, exactly as the preload path composes it.
//
// ── FAILURE VOCABULARY ──────────────────────────────────────────────────────────
// Four codes, no raw database text. A read error and an empty result are distinguishable to the
// caller but neither reveals whether another tenant holds matching rows.

import { createClient } from "@/lib/supabase/server";
import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { toCustomerReference } from "@/lib/estimates/wizard-entity-references";
import type { WizardExistingCustomerReference } from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import {
  planCustomerSearch,
  buildCustomerOrFilter,
  plateSuffixCandidates,
  plateLastFourMatches,
  applyResultCap,
  CUSTOMER_SEARCH_ORDER,
  FETCH_LIMIT,
} from "./search-dealer-customers-core";

export type CustomerSearchFailureCode =
  | "UNAUTHENTICATED"
  | "DEALER_CONTEXT_REQUIRED"
  | "QUERY_TOO_SHORT"
  | "SEARCH_FAILED";

export type CustomerSearchResult =
  | {
      readonly ok: true;
      readonly results: readonly WizardExistingCustomerReference[];
      readonly truncated: boolean;
    }
  | { readonly ok: false; readonly code: CustomerSearchFailureCode };

/** Only the columns needed to search, order and compose the label. None of these leave the server. */
const CUSTOMER_COLUMNS =
  "id, dealer_id, last_name, first_name, last_name_kana, phone";

/**
 * Search the ACTIVE dealer's customers by any Ver2.2 key.
 *
 * Keys: kanji name, kana, rough address fragment, phone, and — only for a term of exactly four
 * digits — the last four characters of a vehicle plate.
 */
export async function searchDealerCustomersAction(rawTerm: unknown): Promise<CustomerSearchResult> {
  // 1. Term first: a too-short term must never reach the database.
  const planned = planCustomerSearch(rawTerm);
  if (!planned.ok) return { ok: false, code: planned.code };
  const { likeBody, plateLastFour } = planned.plan;

  // 2. Tenant + authorization. `permission-denied` is reported as DEALER_CONTEXT_REQUIRED rather
  //    than as a distinct code: a caller who may not edit business data learns only that they have
  //    no usable context, not why.
  const actor = await getEstimateSaveActorContext();
  if (!actor.ok) {
    return {
      ok: false,
      code: actor.reason === "unauthenticated" ? "UNAUTHENTICATED" : "DEALER_CONTEXT_REQUIRED",
    };
  }
  const dealerId = actor.context.dealerId;

  try {
    const supabase = await createClient();

    // 3. Plate branch — ONLY for a term of exactly four digits (either width). Tenant-scoped like
    //    every other read.
    //
    //    TWO STAGES, deliberately. The database `ilike` suffix match is only a cheap PRE-FILTER,
    //    and it is run for both the ASCII and the full-width spelling because either may be stored.
    //    A suffix match alone is not sufficient: it cannot tell "ends with 1234" from "ends with
    //    12345 whose tail happens to read 1234" once separators differ. The decision is therefore
    //    made in `plateLastFourMatches`, which trims, width-normalises and reduces the STORED plate
    //    to digits and requires its final four to equal the query exactly.
    let plateCustomerIds: string[] = [];
    if (plateLastFour !== null) {
      const orFilter = plateSuffixCandidates(plateLastFour)
        .map((p) => `plate_number.ilike."${p}"`)
        .join(",");
      const { data, error } = await supabase
        .from("vehicles")
        .select("customer_id, plate_number")
        .eq("dealer_id", dealerId)
        .is("deleted_at", null)
        .or(orFilter)
        .limit(FETCH_LIMIT);
      if (error) return { ok: false, code: "SEARCH_FAILED" };
      plateCustomerIds = Array.from(
        new Set(
          (data ?? [])
            .filter((v) =>
              plateLastFourMatches((v as { plate_number: unknown }).plate_number, plateLastFour),
            )
            .map((v) => (v as { customer_id: string | null }).customer_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );
      // Every candidate failed the exact final-four check ⇒ the plate branch contributes nothing.
      // The text branch still runs; a four-digit term may legitimately match a phone number.
    }

    // 4. ONE ordered, capped customer query. Folding the plate ids in as `id.in.(…)` keeps this a
    //    single ordered result set — merging two queries in JavaScript would need the very
    //    kana/name fields this action refuses to hand out, just to re-sort them.
    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .eq("dealer_id", dealerId)
      .is("deleted_at", null)
      .or(buildCustomerOrFilter(likeBody, plateCustomerIds))
      .order(CUSTOMER_SEARCH_ORDER[0].column, {
        ascending: CUSTOMER_SEARCH_ORDER[0].ascending,
        nullsFirst: CUSTOMER_SEARCH_ORDER[0].nullsFirst,
      })
      .order(CUSTOMER_SEARCH_ORDER[1].column, {
        ascending: CUSTOMER_SEARCH_ORDER[1].ascending,
        nullsFirst: CUSTOMER_SEARCH_ORDER[1].nullsFirst,
      })
      .order(CUSTOMER_SEARCH_ORDER[2].column, {
        ascending: CUSTOMER_SEARCH_ORDER[2].ascending,
        nullsFirst: CUSTOMER_SEARCH_ORDER[2].nullsFirst,
      })
      .limit(FETCH_LIMIT);
    if (error || !Array.isArray(data)) return { ok: false, code: "SEARCH_FAILED" };

    // 5. Re-assert the tenant on every row before it is narrowed. RLS and the predicate above
    //    should already guarantee this; a row that still disagrees is a defect, not a result.
    const rows = data as Array<{
      id: string;
      dealer_id: string;
      last_name: string;
      first_name: string | null;
      phone: string | null;
    }>;
    if (rows.some((r) => r.dealer_id !== dealerId)) return { ok: false, code: "SEARCH_FAILED" };

    const capped = applyResultCap(rows);
    return {
      ok: true,
      results: capped.rows.map((r) => toCustomerReference(r)),
      truncated: capped.truncated,
    };
  } catch {
    // No raw exception text is surfaced; the caller gets the stable code only.
    return { ok: false, code: "SEARCH_FAILED" };
  }
}
