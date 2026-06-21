"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { DocumentSequenceType, DocumentResetPolicy, computeFiscalYear } from "./numbering-types";

interface UpdateSequenceInput {
  sequence_type: DocumentSequenceType;
  prefix:        string;
  padding:       number;
  reset_policy:  DocumentResetPolicy;
}

/**
 * Updates prefix, padding, and reset_policy for a sequence.
 * current_number is never directly updatable via this function.
 */
export async function updateDocumentSequence(
  input: UpdateSequenceInput,
): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "認証エラー" };

  const supabase = await createClient();
  const did = dealer.dealer_id;
  const fiscalYear = computeFiscalYear(input.reset_policy);

  // Upsert the sequence config (creates row if it doesn't exist yet)
  const { error } = await supabase
    .from("document_sequences")
    .upsert(
      {
        dealer_id:      did,
        sequence_type:  input.sequence_type,
        fiscal_year:    fiscalYear,
        prefix:         input.prefix.trim(),
        padding:        input.padding,
        reset_policy:   input.reset_policy,
      },
      { onConflict: "dealer_id,sequence_type,fiscal_year" },
    );

  if (error) return { success: false, error: error.message };
  return { success: true };
}
