"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  DocumentSequenceType,
  defaultPrefix,
  defaultResetPolicy,
  formatDocumentNumber,
  computeFiscalYear,
} from "./numbering-types";

// R56D — DEALER-BOUND, FAIL-CLOSED NUMBERING.
//
// `get_next_document_number` (migrations 046 + 104) is the ONLY authoritative
// increment: a single INSERT ... ON CONFLICT DO UPDATE ... RETURNING current_number.
// A number that did not come out of that statement is not backed by any uniqueness
// guarantee, so the dealer-bound path below NEVER invents one.
//
// The RPC is SECURITY DEFINER and authorizes on auth.uid() (active member or dealer
// owner, else FORBIDDEN). Migration 104 revokes EXECUTE from service_role and grants
// it to `authenticated` only, so numbering MUST use the authenticated server client.
// createAdminClient() would fail twice over: no EXECUTE, and auth.uid() is NULL.

// Resolved sequence configuration.
//
// `ok` separates two outcomes the old code conflated. A LEGITIMATE "no row yet"
// (ok: true, defaults, currentNumber 0) is normal — the RPC creates row number 1.
// A FAILED config query (ok: false) means we know nothing, and the dealer-bound
// allocator refuses to proceed on a guess.
type SequenceConfig = {
  ok:            boolean;
  prefix:        string;
  padding:       number;
  resetPolicy:   "never" | "yearly" | "monthly";
  fiscalYear:    number;
  currentNumber: number;
};

type NumberingClient = Awaited<ReturnType<typeof createClient>>;

// Shared config read. Returns defaults on a missing row AND on a failed query, but
// records which happened in `ok`. It performs NO arithmetic on current_number — the
// legacy +1 lives solely in the wrapper below and is unreachable from here.
async function loadSequenceConfig(
  supabase:     NumberingClient,
  sequenceType: DocumentSequenceType,
  dealerId:     string,
): Promise<SequenceConfig> {
  let seq: {
    prefix?: string | null; padding?: number | null;
    reset_policy?: string | null; current_number?: number | null;
  } | null = null;
  let ok = true;

  try {
    const { data, error } = await supabase
      .from("document_sequences")
      .select("prefix, padding, reset_policy, fiscal_year, current_number")
      .eq("dealer_id", dealerId)
      .eq("sequence_type", sequenceType)
      .maybeSingle();
    if (error) ok = false;
    else seq = data ?? null;
  } catch {
    ok = false;
  }

  const prefix      = seq?.prefix  ?? defaultPrefix(sequenceType);
  const padding     = seq?.padding ?? 5;
  // MONTHLY-DATA-B2: on a MISSING row, the reset default is per-type — monthly_invoice → "monthly",
  // every existing type → "never" (unchanged). A stored reset_policy still wins when the row exists,
  // so this changes no existing type's behaviour. Allocation stays on the authoritative RPC; the
  // legacy guessed-number fallback below is NOT reachable for the dealer-bound (new) path.
  const resetPolicy = (seq?.reset_policy ?? defaultResetPolicy(sequenceType)) as "never" | "yearly" | "monthly";

  return {
    ok,
    prefix,
    padding,
    resetPolicy,
    fiscalYear:    computeFiscalYear(resetPolicy),
    currentNumber: seq?.current_number ?? 0,
  };
}

// Shared authoritative allocation. Returns the RPC's integer, or null for EVERY
// failure and every result that is not a usable sequence value. Raw Supabase /
// Postgres error objects are inspected but never returned or re-thrown.
async function allocateNextNumber(
  supabase:     NumberingClient,
  sequenceType: DocumentSequenceType,
  dealerId:     string,
  cfg:          SequenceConfig,
): Promise<number | null> {
  try {
    const { data: rpcData, error } = await supabase.rpc("get_next_document_number", {
      p_dealer_id:     dealerId,
      p_sequence_type: sequenceType,
      p_fiscal_year:   cfg.fiscalYear,
      p_prefix:        cfg.prefix,
      p_padding:       cfg.padding,
      p_reset_policy:  cfg.resetPolicy,
    });

    if (error) return null;
    // current_number is a PG `integer`. Anything non-numeric, non-finite, fractional,
    // beyond the safe range, or <= 0 indicates a driver/serialization fault rather
    // than a real sequence value. isSafeInteger subsumes isFinite; both are asserted
    // explicitly so the accepted domain is readable at a glance.
    if (typeof rpcData !== "number")      return null;
    if (!Number.isFinite(rpcData))        return null;
    if (!Number.isSafeInteger(rpcData))   return null;
    if (rpcData <= 0)                     return null;
    return rpcData;
  } catch {
    return null;
  }
}

/**
 * Allocates the next formatted document number for EXACTLY the supplied dealer.
 *
 * FAIL-CLOSED. Returns null — never a guessed number — when the dealer id is blank,
 * the client cannot be created, the config query fails, the RPC fails, or the RPC
 * returns anything that is not a positive safe integer. The returned string is
 * formatted ONLY from the integer the authoritative RPC returned.
 *
 * This function never resolves a dealer itself: the caller supplies the tenant that
 * the surrounding server context already proved.
 */
export async function getNextDocumentNumberForDealer(
  sequenceType: DocumentSequenceType,
  dealerId:     string,
): Promise<string | null> {
  if (typeof dealerId !== "string" || dealerId.trim() === "") return null;

  let supabase: NumberingClient;
  try {
    supabase = await createClient();
  } catch {
    return null;
  }

  const cfg = await loadSequenceConfig(supabase, sequenceType, dealerId);
  if (!cfg.ok) return null;   // config unknown -> refuse, and do NOT call the RPC

  const next = await allocateNextNumber(supabase, sequenceType, dealerId, cfg);
  if (next === null) return null;

  return formatDocumentNumber(cfg.prefix, next, cfg.padding, cfg.fiscalYear);
}

/**
 * LEGACY one-argument entry point. Resolves its own dealer, then delegates to the
 * same shared config/RPC implementation.
 *
 * Retained UNCHANGED in behaviour so the ten existing legacy call sites stay
 * byte-identical. New callers must use getNextDocumentNumberForDealer.
 */
export async function getNextDocumentNumber(
  sequenceType: DocumentSequenceType,
): Promise<string | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const did = dealer.dealer_id;

  const cfg  = await loadSequenceConfig(supabase, sequenceType, did);
  const next = await allocateNextNumber(supabase, sequenceType, did, cfg);
  if (next !== null) {
    return formatDocumentNumber(cfg.prefix, next, cfg.padding, cfg.fiscalYear);
  }

  // ─── LEGACY COMPATIBILITY FALLBACK — DEBT. FORBIDDEN FOR NEW CALLERS. ───────
  // This returns a number that was NEVER persisted: document_sequences is not
  // advanced, so the next successful call returns the same integer and two
  // documents collide. It is preserved ONLY so R56D does not silently change
  // behaviour for the ten unaudited legacy flows, and it lives HERE — inside the
  // wrapper, after the dealer-bound function has already returned — so that
  // getNextDocumentNumberForDealer can never reach it. Removing it is a separate
  // phase that must audit each legacy caller. Do not extend or reuse it.
  const fallbackNum = cfg.currentNumber + 1;
  return formatDocumentNumber(cfg.prefix, fallbackNum, cfg.padding, cfg.fiscalYear);
}
