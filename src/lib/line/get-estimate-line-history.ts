"use server";

// GYEON-EST-LINE-F1-R1 — the tenant-scoped estimate LINE transmission-history
// reader (A2-R2 security contract).
//
// ── WHY THE ADMIN CLIENT ────────────────────────────────────────────────────
// Authorization rests on getCurrentDealer, which requires an ACTIVE dealer
// membership — stricter than the historical line_message_logs RLS predicate
// (hardened separately in migration 20260731054835, not yet applied). The
// admin client is used ONLY after that derivation succeeds, and every query is
// explicitly constrained to the derived dealer_id + purpose + estimate
// linkage. The client supplies exactly ONE value: the estimate id. A dealer
// id, filter, or projection has nowhere to enter.
//
// ── WHY NOTHING UNSAFE CAN CROSS THE BOUNDARY ──────────────────────────────
// Rows pass through the pure whitelist projection in send-estimate-line-core
// (projectEstimateLineHistoryRow): line_user_id, line_customer_id, the raw
// payload (share/document ids), error_message and credentials are not fields
// of the output shape. This module is "use server" and transitively imports
// the server-only admin client, so its body can never enter a client bundle.
//
// ── TRUTHFUL STATES ────────────────────────────────────────────────────────
// {kind:"ok", rows:[]} means "the read SUCCEEDED and there is no history" —
// the ONLY state the UI may render as 送付履歴はありません. Every failure
// (no active dealer, query error, thrown) is {kind:"error"}, which the UI
// renders as a read failure, never as an empty history. A foreign or unknown
// estimate id yields the ok-empty state under the self-dealer predicate —
// indistinguishable from "no history yet", so existence is never disclosed.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  isValidEstimateId,
  projectEstimateLineHistoryRow,
  type EstimateLineHistoryRow,
} from "./send-estimate-line-core";

export type EstimateLineHistoryResult =
  | { readonly kind: "ok"; readonly rows: EstimateLineHistoryRow[] }
  | { readonly kind: "error" };

const HISTORY_LIMIT = 10;

export async function getEstimateLineHistory(
  estimateId: string,
): Promise<EstimateLineHistoryResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { kind: "error" };

    // A malformed id can match nothing; answer ok-empty exactly like a foreign
    // id so the error channel never becomes an existence probe.
    if (!isValidEstimateId(estimateId)) return { kind: "ok", rows: [] };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("line_message_logs")
      .select("id, status, body, payload, created_at, sent_at")
      .eq("dealer_id", dealer.dealer_id)
      .eq("purpose", "estimate")
      .contains("payload", { metadata: { estimateId } })
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) return { kind: "error" };

    const rows: EstimateLineHistoryRow[] = [];
    for (const raw of data ?? []) {
      const row = projectEstimateLineHistoryRow(raw);
      if (row) rows.push(row);
    }
    return { kind: "ok", rows };
  } catch {
    return { kind: "error" };
  }
}
