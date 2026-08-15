"use server";

// R92B Phase 2 — client-callable actions for the estimate-share revoke UI.
//
// A `"use server"` module: every export is a Server Action reachable from the
// browser, so each one re-resolves the session and scopes every query by
// dealer_id. The list projection is the SAFE shape from the pure core — id,
// createdAt, expiresAt only; never a token_hash, document_file_id, or path.

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isShareActive, toShareListItem } from "./estimate-share-core";
import type { EstimateShareListItem } from "./estimate-share-types";

/** The currently-active (non-revoked, non-expired) shares for an estimate. */
export async function listActiveEstimateShares(estimateId: string): Promise<EstimateShareListItem[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("estimate_shares")
    .select("id, created_at, expires_at, revoked_at")
    .eq("dealer_id", dealer.dealer_id)
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: false });
  if (!data) return [];

  const now = Date.now();
  return data
    .filter((r) => isShareActive({ revokedAt: r.revoked_at, expiresAt: r.expires_at }, now))
    .map((r) => toShareListItem({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at }));
}

/** Revoke a single share. Idempotent: an already-revoked row is left untouched. */
export async function revokeEstimateShare(
  estimateId: string,
  shareId: string,
): Promise<{ ok: boolean }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { ok: false };
  const user = await getCurrentUser();

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("estimate_shares")
    .update({ revoked_at: nowIso, revoked_by: user?.id ?? null, updated_at: nowIso })
    .eq("id", shareId)
    .eq("estimate_id", estimateId)
    .eq("dealer_id", dealer.dealer_id) // tenant scope — never from client
    .is("revoked_at", null);

  return { ok: !error };
}
