"use server";

import { createClient }  from "@/lib/supabase/server";
import { requireRole }   from "@/lib/staff/require-role";
import { DocumentSequenceType, DocumentResetPolicy, computeFiscalYear } from "./numbering-types";

interface UpdateSequenceInput {
  sequence_type: DocumentSequenceType;
  prefix:        string;
  padding:       number;
  reset_policy:  DocumentResetPolicy;
}

// Updates prefix, padding, and reset_policy for a sequence.
// current_number is never directly updatable via this function.
export async function updateDocumentSequence(
  input: UpdateSequenceInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Requires owner or manager — throws if role is insufficient or unauthenticated.
    // dealer_id is resolved server-side via requireRole → getCurrentDealer(); never from client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const supabase = await createClient();
    const fiscalYear = computeFiscalYear(input.reset_policy);

    const { error } = await supabase
      .from("document_sequences")
      .upsert(
        {
          dealer_id:     dealerId,
          sequence_type: input.sequence_type,
          fiscal_year:   fiscalYear,
          prefix:        input.prefix.trim(),
          padding:       input.padding,
          reset_policy:  input.reset_policy,
        },
        { onConflict: "dealer_id,sequence_type,fiscal_year" },
      );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新に失敗しました";
    return { success: false, error: msg };
  }
}
