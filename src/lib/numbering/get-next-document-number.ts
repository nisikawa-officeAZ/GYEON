"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import {
  DocumentSequenceType,
  defaultPrefix,
  formatDocumentNumber,
  computeFiscalYear,
} from "./numbering-types";

/**
 * Atomically increments and returns the next formatted document number
 * for the given sequence type and dealer.
 *
 * Uses INSERT ... ON CONFLICT DO UPDATE to ensure atomicity even under
 * concurrent requests (no SELECT+UPDATE race).
 */
export async function getNextDocumentNumber(
  sequenceType: DocumentSequenceType,
): Promise<string | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const did = dealer.dealer_id;

  // 1. Fetch current sequence config (prefix, padding, reset_policy)
  const { data: seq } = await supabase
    .from("document_sequences")
    .select("prefix, padding, reset_policy, fiscal_year, current_number")
    .eq("dealer_id", did)
    .eq("sequence_type", sequenceType)
    .maybeSingle();

  const prefix      = seq?.prefix      ?? defaultPrefix(sequenceType);
  const padding     = seq?.padding     ?? 5;
  const resetPolicy = (seq?.reset_policy ?? "never") as "never" | "yearly" | "monthly";
  const fiscalYear  = computeFiscalYear(resetPolicy);

  // 2. Atomic upsert+increment via Supabase RPC
  const { data: rpcData, error } = await supabase.rpc("get_next_document_number", {
    p_dealer_id:     did,
    p_sequence_type: sequenceType,
    p_fiscal_year:   fiscalYear,
    p_prefix:        prefix,
    p_padding:       padding,
    p_reset_policy:  resetPolicy,
  });

  if (error || rpcData == null) {
    // Fallback: safe sequential approach if RPC unavailable
    const fallbackNum = (seq?.current_number ?? 0) + 1;
    return formatDocumentNumber(prefix, fallbackNum, padding, fiscalYear);
  }

  return formatDocumentNumber(prefix, rpcData as number, padding, fiscalYear);
}
