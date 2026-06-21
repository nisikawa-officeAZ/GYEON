"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { DocumentSequenceDB, DocumentSequenceType, defaultPrefix } from "./numbering-types";

const ALL_TYPES: DocumentSequenceType[] = [
  "estimate",
  "work_order",
  "completion_report",
  "invoice",
  "payment",
  "maintenance_reminder",
];

/**
 * Returns current sequences for all 6 types for the current dealer.
 * If a sequence row doesn't exist yet, returns a default placeholder.
 */
export async function getDocumentSequences(): Promise<DocumentSequenceDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const did = dealer.dealer_id;

  const { data } = await supabase
    .from("document_sequences")
    .select("*")
    .eq("dealer_id", did)
    .order("sequence_type");

  const existing = (data ?? []) as DocumentSequenceDB[];
  const existingTypes = new Set(existing.map((s) => s.sequence_type));

  // Fill in defaults for any missing types so the UI always shows all 6
  const defaults: DocumentSequenceDB[] = ALL_TYPES.filter((t) => !existingTypes.has(t)).map(
    (t) => ({
      id:             "",
      dealer_id:      did,
      sequence_type:  t,
      prefix:         defaultPrefix(t),
      padding:        5,
      reset_policy:   "never",
      fiscal_year:    0,
      current_number: 0,
      created_at:     "",
      updated_at:     "",
    }),
  );

  return [...existing, ...defaults].sort((a, b) =>
    ALL_TYPES.indexOf(a.sequence_type) - ALL_TYPES.indexOf(b.sequence_type),
  );
}
