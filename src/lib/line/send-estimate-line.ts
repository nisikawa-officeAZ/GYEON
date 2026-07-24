"use server";

// R90B Phase 1 — the ONE client-callable boundary for sending a saved estimate
// over LINE.
//
// ── WHY THIS SHELL HOLDS NO DECISIONS ───────────────────────────────────────
// Every branch lives in `send-estimate-line-core.ts`, which is pure and directly
// executable under node:test. This file only builds the injected world out of
// server-only modules and hands it to the core. Ordering, recipient authority,
// the customer-visible text and the typed outcome are therefore proved against
// the code that ships, not against a re-implementation.
//
// ── WHAT A CLIENT MAY SAY ───────────────────────────────────────────────────
// Exactly two values: a persisted `estimateId` and a closed authorization union.
// Neither is authoritative. The dealer comes from the session, the customer from
// the persisted estimate, the recipient from a dealer+customer+friend lookup,
// the message from persisted fields, and the log metadata from this file. A
// lineUserId, dealerId, customerId, message body, access token or log payload
// supplied by a caller has nowhere to enter.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { sendLineTextMessage, type LineLogMetadata } from "./send-line-message";
import { createEstimateShare } from "@/lib/estimates/create-estimate-share";
import {
  runEstimateLineSend,
  type EstimateLineCoreDeps,
  type EstimateLineResult,
  type EstimateLineTransportOutcome,
  type EstimateResendAuthorization,
} from "./send-estimate-line-core";

export async function sendEstimateLine(
  estimateId: string,
  authorization: EstimateResendAuthorization,
): Promise<EstimateLineResult> {
  const dealer = await getCurrentDealer();
  // No dealer context is indistinguishable from "this estimate is not yours".
  if (!dealer) return { kind: "blocked", reason: "estimate-not-found" };

  const supabase = await createClient();
  const dealerId = dealer.dealer_id;

  const deps: EstimateLineCoreDeps = {
    // Dealer-scoped by id AND dealer_id — a foreign id resolves to null.
    loadEstimate: async (id) => {
      const { data } = await supabase
        .from("estimates")
        .select("customer_id, estimate_number, estimate_no, total, valid_until")
        .eq("id", id)
        .eq("dealer_id", dealerId)
        .maybeSingle();
      if (!data) return null;
      const row = data as {
        customer_id: string | null;
        estimate_number: string | null;
        estimate_no: string | null;
        total: number | null;
        valid_until: string | null;
      };
      return {
        customerId: row.customer_id,
        estimateNumber: row.estimate_number ?? row.estimate_no,
        // Passed through UNCHANGED. A null total omits the amount line; it must
        // never be coerced into a ¥0 the customer would read as a real price.
        total: row.total,
        validUntil: row.valid_until,
      };
    },

    // The recipient is DERIVED. is_friend=true is part of the predicate, so an
    // unfollowed customer resolves to null rather than to an unreachable id.
    loadRecipient: async (customerId) => {
      const { data } = await supabase
        .from("line_customers")
        .select("id, line_user_id")
        .eq("dealer_id", dealerId)
        .eq("customer_id", customerId)
        .eq("is_friend", true)
        .maybeSingle();
      if (!data) return null;
      const row = data as { id: string; line_user_id: string };
      return { lineCustomerId: row.id, lineUserId: row.line_user_id };
    },

    loadConfig: async () => {
      const { data } = await supabase
        .from("dealer_settings")
        .select("line_enabled, line_access_token")
        .eq("dealer_id", dealerId)
        .maybeSingle();
      const row = data as { line_enabled: boolean | null; line_access_token: string | null } | null;
      // The token itself is never returned — only whether one exists.
      return { enabled: row?.line_enabled === true, hasAccessToken: Boolean(row?.line_access_token) };
    },

    loadBusinessName: async () => {
      const { data } = await supabase
        .from("dealer_settings")
        .select("business_name")
        .eq("dealer_id", dealerId)
        .maybeSingle();
      const name = (data as { business_name: string | null } | null)?.business_name;
      // Never defaulted: an unset name omits the line entirely.
      return name && name.trim() ? name : null;
    },

    // Read-only preflight. line_message_logs grants `authenticated` SELECT
    // (migration 104), so the session client is the correct principal here.
    //
    // The LATEST RELEVANT attempt wins — ordered by `created_at` alone, NOT by
    // `sent_at`, so a newer `pending` row is never beaten by an older `sent` one.
    // `sent` and `pending` are both relevant; `failed`/`cancelled` prove nothing
    // was delivered and are excluded. The Supabase error is inspected: a failed
    // read is not evidence that nothing was sent, so it fails closed as
    // `unavailable` rather than `none`.
    probeLastSent: async (id) => {
      const { data, error } = await supabase
        .from("line_message_logs")
        .select("status, sent_at, created_at")
        .eq("dealer_id", dealerId)
        .eq("purpose", "estimate")
        .in("status", ["sent", "pending"])
        .contains("payload", { metadata: { estimateId: id } })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return { kind: "unavailable" };
      if (!data) return { kind: "none" };
      const row = data as { status: string; sent_at: string | null; created_at: string | null };
      if (row.status === "sent") return { kind: "sent", sentAt: row.sent_at };
      if (row.status === "pending") return { kind: "indeterminate", attemptedAt: row.created_at };
      // Any status the query should not have returned fails closed.
      return { kind: "unavailable" };
    },

    // pdf-link only. Delegates the whole snapshot→document→share lifecycle to the
    // server-only orchestrator. The raw token is returned ONLY inside share.url;
    // this file never reads it apart from handing the URL to the core for the
    // message body.
    createShareLink: (id) => createEstimateShare(id),

    send: async ({ recipient, customerId, estimateId: id, text, mode, share }): Promise<EstimateLineTransportOutcome> => {
      // Log metadata is composed HERE, never accepted from a caller. The raw
      // token / URL is deliberately NOT among these fields — only the share's
      // identifiers and expiry are audited.
      const logMetadata: LineLogMetadata =
        mode === "pdf-link" && share
          ? {
              estimateId: id,
              mode: "pdf-link",
              shareId: share.shareId,
              documentFileId: share.documentFileId,
              expiresAt: share.expiresAt,
            }
          : { estimateId: id, mode: "text" };
      const result = await sendLineTextMessage(recipient.lineUserId, text, {
        purpose: "estimate",
        title: null,
        customerId,
        lineCustomerId: recipient.lineCustomerId,
        logMetadata,
        requireLog: true,
        // pdf-link only: LINE gets the working URL; the audit log gets a
        // placeholder so no raw token is ever persisted.
        redactLog: mode === "pdf-link",
      });
      if ("success" in result) return { kind: "sent" };
      if (result.reason === "log-unavailable") return { kind: "log-unavailable" };
      return { kind: "failed" };
    },
  };

  return runEstimateLineSend(deps, estimateId, authorization);
}
