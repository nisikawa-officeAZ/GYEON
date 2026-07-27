"use server";

// B2-D.3 — Screen 1 duplicate WARNING (SERVER ACTION).
//
// ── TENANCY IS STRUCTURAL, NOT CONVENTIONAL ─────────────────────────────────────
// The browser sends three untrusted strings and nothing else. There is deliberately no dealer
// parameter, so a client cannot express a cross-tenant check at all. The dealer comes from
// `getEstimateSaveActorContext()`, whose `{ userId, dealerId, role }` triple is branded and derives
// dealer and role from the SAME active membership.
//
// `getCurrentDealer()` is NOT used, which is also why the pre-existing
// `find-customer-duplicates.ts` is not reused: its `.limit(1).single()` picks an arbitrary dealer for
// a multi-membership user. That helper additionally caps its phone scan at 200 rows and normalises in
// JavaScript, so it silently stops matching as a dealer grows. Neither property is acceptable here.
//
// Every query carries an explicit `.eq("dealer_id", …)` in addition to RLS, because relying on RLS
// alone would leave a single policy edit as the only thing between tenants.
//
// ── ADVISORY ONLY ───────────────────────────────────────────────────────────────
// Nothing this action returns can block registration. Every failure is a code the operator is shown;
// none of them gates saving, and the caller is free to ignore all of them.
//
// ── EQUALITY IN THE DATABASE, NOT IN JAVASCRIPT ─────────────────────────────────
// Both branches are equality against the STORED generated columns added by 20260727112326, each
// backed by a partial index. There is no row window, no client-side filtering, and therefore no size
// of dealer at which this quietly stops working.

import { createClient } from "@/lib/supabase/server";
import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { toCustomerReference } from "@/lib/estimates/wizard-entity-references";
import type {
  WizardDuplicateCandidate,
  WizardDuplicateCheckResult,
} from "@/components/estimates/wizard/contract/wizard-runtime-inputs";
import {
  planDuplicateCheck,
  buildDuplicateOrFilter,
  classifyReason,
  applyCandidateCap,
  DUPLICATE_SELECT_COLUMNS,
  FETCH_LIMIT,
} from "./find-wizard-customer-duplicates-core";

/** Row shape the select above returns. `name` is present so the legacy label fallback can fire. */
type DuplicateRow = {
  id: string;
  dealer_id: string;
  last_name: string | null;
  first_name: string | null;
  name: string | null;
  phone: string | null;
  match_phone_digits: string | null;
  match_name_norm: string | null;
  match_kana_norm: string | null;
};

/**
 * Find customers in the ACTIVE dealer that the operator may be about to duplicate.
 *
 * Warns on exactly two rules, both exact equality: a 10–11 digit phone, or name AND kana together.
 * Never on a surname alone, an address, an email, or a name without its kana.
 */
export async function findWizardCustomerDuplicatesAction(raw: {
  name?: unknown;
  kana?: unknown;
  phone?: unknown;
}): Promise<WizardDuplicateCheckResult> {
  // 1. Input first: an unusable input must never reach the database. NOT_APPLICABLE says the rule
  //    cannot fire — distinct from "checked, found nothing".
  const planned = planDuplicateCheck(raw ?? {});
  if (!planned.ok) return { ok: false, code: planned.code };
  const keys = planned.keys;

  // 2. Tenant + authorization. `permission-denied` is reported as DEALER_CONTEXT_REQUIRED rather than
  //    as a distinct code: a caller who may not edit business data learns only that they have no
  //    usable context, not why.
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

    const { data, error } = await supabase
      .from("customers")
      .select(DUPLICATE_SELECT_COLUMNS)
      .eq("dealer_id", dealerId)
      .is("deleted_at", null)
      .or(buildDuplicateOrFilter(keys))
      .limit(FETCH_LIMIT);

    if (error || !Array.isArray(data)) return { ok: false, code: "LOOKUP_FAILED" };

    const rows = data as unknown as DuplicateRow[];

    // 3. Re-assert the tenant on every row before it is narrowed. RLS and the predicate above should
    //    already guarantee this; a row that still disagrees is a defect, not a candidate.
    if (rows.some((r) => r.dealer_id !== dealerId)) return { ok: false, code: "LOOKUP_FAILED" };

    // 4. Narrow to the minimal projection and attach the reason. A row neither rule explains is
    //    DROPPED rather than shown: the operator must never be asked to judge a match the server
    //    cannot justify.
    const candidates: WizardDuplicateCandidate[] = [];
    for (const row of rows) {
      const reason = classifyReason(row, keys);
      if (reason === null) continue;
      candidates.push({ ...toCustomerReference(row), reason });
    }

    const capped = applyCandidateCap(candidates);
    return { ok: true, candidates: capped.rows, truncated: capped.truncated };
  } catch {
    // No raw exception text is surfaced; the caller gets the stable code only.
    return { ok: false, code: "LOOKUP_FAILED" };
  }
}
