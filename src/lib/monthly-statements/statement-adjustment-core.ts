// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — pure statement-adjustment core.
//
// PURE: no Supabase, no network. A monthly-statement adjustment is a SIGNED amount with an explicit
// non-blank reason. adjustments_total is the deterministic sum of signed amounts and feeds the closing
// balance. Non-finite or zero amounts and blank reasons are REJECTED (thrown), never coerced. Issued /
// voided immutability is enforced in the database (the adjustment trigger), not here.

export interface CandidateAdjustment {
  signed_amount: number;
  reason:        string;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A single adjustment is valid only with a finite non-zero amount and a non-blank reason. */
export function isValidAdjustment(adj: CandidateAdjustment): boolean {
  return isFiniteNumber(adj.signed_amount) && adj.signed_amount !== 0 && (adj.reason ?? "").trim() !== "";
}

/**
 * adjustments_total = deterministic sum of signed amounts.
 * @throws if any amount is non-finite, any amount is zero, or any reason is blank (never coerced).
 */
export function aggregateAdjustmentsTotal(adjustments: readonly CandidateAdjustment[]): number {
  let total = 0;
  for (const adj of adjustments) {
    if (!isFiniteNumber(adj.signed_amount)) {
      throw new Error("statement-adjustment-core: non-finite signed_amount");
    }
    if (adj.signed_amount === 0) {
      throw new Error("statement-adjustment-core: signed_amount must be non-zero");
    }
    if ((adj.reason ?? "").trim() === "") {
      throw new Error("statement-adjustment-core: reason must be non-blank");
    }
    total += adj.signed_amount;
  }
  return total;
}
