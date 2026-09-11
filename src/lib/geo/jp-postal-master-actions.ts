"use server";

// GDA-2A-OCR-POSTAL-MASTER-R2 — authenticated Server Actions for the Japan Post postal master.
//
// ── WHY THIS FILE ONLY EXPORTS TWO ASYNC FUNCTIONS ───────────────────────────────────────────────
// A `"use server"` module may only export async functions; every other export is a Next.js build
// error. All pure shape-validation/normalization logic therefore lives in `jp-postal-master-contract`
// (unit-testable without a live Supabase/Next.js request) and is only CALLED from here.
//
// ── WHY THIS FILE DOES ITS OWN NORMALIZATION AND NOTHING ELSE ────────────────────────────────────
// Input normalization happens before any network/database call, so an already-invalid input never
// reaches the database. The AUTHORIZATION decision — "is this actor a non-null, actively-membered
// dealer user" — is deliberately NOT re-implemented here: the RPC itself enforces it (see the
// migration's forward/reverse lookup functions), because a direct PostgREST call to the RPC must be
// refused on exactly the same terms as a call routed through this action. Duplicating the check here
// would create two authorities that could silently drift.
//
// ── WHY EVERY DATABASE OR SHAPE FAILURE COLLAPSES TO MASTER_UNAVAILABLE ──────────────────────────
// The Wizard planner (`postal-master-apply.ts`) treats every non-`FOUND` code identically: no write,
// short manual-entry notice. There is therefore no operator-visible reason to distinguish "the RPC
// does not exist yet", "the client could not be constructed", "the query errored", or "the RPC
// returned a shape this action does not recognize" — all four are the same fact for the caller: the
// master cannot answer right now. This action never throws and never returns a raw error/message.
//
// ── ASSUMED SUPABASE CLIENT SEAM ─────────────────────────────────────────────────────────────────
// This project documents its server Supabase client at `src/lib/supabase/server` (see CLAUDE.md,
// "lib/supabase/ # Supabase client (browser + server)"). That module is outside this phase's read
// and write allowlist, so its exact export could not be inspected before writing this file; the
// call below assumes the standard `@supabase/ssr` Next.js App Router shape, an async
// `createClient()` returning a request-scoped client. If the real export differs, this is the one
// place that needs correcting — no other file in this candidate touches Supabase construction.

import { createClient } from "@/lib/supabase/server";
import {
  normalizeJpPostalCode,
  normalizeJpAddressInput,
  mapJpPostalForwardRpcPayload,
  mapJpPostalReverseRpcPayload,
  type JpPostalForwardLookupResult,
  type JpPostalReverseLookupResult,
} from "./jp-postal-master-contract";

/**
 * Forward lookup: a normalized 7-digit postal code → at most one authoritative master address.
 * Never throws. Every failure — malformed input, absent session, RPC error, or an unrecognized
 * payload shape — maps to a result the Wizard planner already treats as "do not write".
 */
export async function lookupJpPostalMasterForwardAction(rawPostalCode: unknown): Promise<JpPostalForwardLookupResult> {
  const normalized = normalizeJpPostalCode(rawPostalCode);
  if (normalized === null) return { code: "INVALID_INPUT" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("jp_postal_master_lookup_forward", { p_postal_code: normalized });
    if (error) return { code: "MASTER_UNAVAILABLE" };
    return mapJpPostalForwardRpcPayload(data);
  } catch {
    return { code: "MASTER_UNAVAILABLE" };
  }
}

/**
 * Reverse lookup: a normalized address string → at most one unambiguous postal code. Same
 * never-throw, fail-closed-to-`MASTER_UNAVAILABLE` discipline as the forward action.
 */
export async function lookupJpPostalMasterReverseAction(rawAddress: unknown): Promise<JpPostalReverseLookupResult> {
  const normalized = normalizeJpAddressInput(rawAddress);
  if (normalized === null) return { code: "INVALID_INPUT" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("jp_postal_master_lookup_reverse", { p_address: normalized });
    if (error) return { code: "MASTER_UNAVAILABLE" };
    return mapJpPostalReverseRpcPayload(data);
  } catch {
    return { code: "MASTER_UNAVAILABLE" };
  }
}
