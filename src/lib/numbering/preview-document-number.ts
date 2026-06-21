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
 * Returns what the NEXT document number would look like without consuming it.
 * (current_number + 1, not written to DB)
 */
export async function previewDocumentNumber(
  sequenceType: DocumentSequenceType,
): Promise<string | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();
  const did = dealer.dealer_id;

  const { data: seq } = await supabase
    .from("document_sequences")
    .select("prefix, padding, reset_policy, current_number")
    .eq("dealer_id", did)
    .eq("sequence_type", sequenceType)
    .maybeSingle();

  const prefix      = seq?.prefix      ?? defaultPrefix(sequenceType);
  const padding     = seq?.padding     ?? 5;
  const resetPolicy = (seq?.reset_policy ?? "never") as "never" | "yearly" | "monthly";
  const fiscalYear  = computeFiscalYear(resetPolicy);
  const nextNumber  = (seq?.current_number ?? 0) + 1;

  return formatDocumentNumber(prefix, nextNumber, padding, fiscalYear);
}
