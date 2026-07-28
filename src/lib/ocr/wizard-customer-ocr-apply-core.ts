// B2-C.2 — Estimate Wizard Screen 1: apply an ALREADY-OBTAINED vehicle-registration OCR result to
// the editable customer draft. PURE CORE.
//
// No React, no Supabase, no Server Action, no Storage, no OpenAI, no clock, no `any`, no cast. This
// module is handed an OCR result that an earlier step already produced and returns a PATCH. It
// performs no I/O of any kind, so it cannot register a customer, a vehicle, an estimate or an OCR
// record even by accident: there is no seam here through which a write could be issued, and adding
// one would mean adding an import this file deliberately does not have.
//
// ── WHAT THIS MODULE DECIDES ────────────────────────────────────────────────────
// Whether an operator-confirmed candidate is present, and which draft fields are eligible at all.
//
// ── WHAT IT DELIBERATELY DOES NOT DECIDE ────────────────────────────────────────
// Owner-versus-user selection, and which party each of name / kana / address comes from. That rule
// lives ENTIRELY in `analyzeOcrCustomer` / `effectiveCustomerParty` / `resolveCustomer` in
// vehicle-registration/ocr-customer-mapping.ts. An earlier revision of this file kept its own
// effective-party helper alongside that one; two spellings of a business rule are two things that
// have to stay correct, and they drift the first time only one is updated — so the local copy has
// been removed and the shared resolver, which now returns kana as well, is the only contract.
//
// Duplicate matching. The applied values land in the same draft fields a manual typist fills, and
// Screen 1 re-runs the SAME B2-D check on them. There is no OCR branch in that path and this module
// adds none: an OCR-filled 山田太郎 and a hand-typed 山田太郎 produce identical match keys, so they
// produce identical advisories. `wizard-customer-ocr-apply-core.test.ts` asserts that equivalence
// against the real duplicate core rather than a local copy of its rules.
//
// ── WHY THE PATCH IS A NARROW TYPE RATHER THAN Partial<CustomerDraft> ───────────
// A 車検証 carries a name, sometimes furigana and an address. It carries no telephone number, no
// email, no postal code and no LINE id. Typing the return value as the full draft would make
// `patch.phone = …` a legal edit to this file; typing it as these three fields makes it a compile
// error. That matters specifically for phone: the duplicate reason precedence is phone > name+kana >
// name, so an OCR path that could write phone could change which reason an operator is shown. It
// cannot, because the type gives it nowhere to write.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";
import {
  analyzeOcrCustomer,
  resolveCustomer,
  type CustomerSource,
} from "@/lib/vehicle-registration/ocr-customer-mapping";

/**
 * The ONLY customer-draft fields an OCR result may touch.
 *
 * Exported so a test can assert the emitted key set against it: a future edit that starts writing a
 * fourth field fails that assertion rather than quietly widening what OCR controls.
 */
export const OCR_APPLICABLE_DRAFT_FIELDS = ["name", "kana", "address"] as const;

export type OcrApplicableDraftField = (typeof OCR_APPLICABLE_DRAFT_FIELDS)[number];

/**
 * A patch over the Screen 1 customer draft.
 *
 * Every field is OPTIONAL and an absent key means "the certificate did not supply this" — never
 * "clear it". Screen 1 applies the patch by spreading it over the current draft, so an absent key
 * leaves whatever the operator already typed exactly as it was.
 */
export type WizardCustomerOcrPatch = {
  readonly [K in OcrApplicableDraftField]?: string;
};

/**
 * A value worth applying, or null.
 *
 * Trimmed, because surrounding whitespace is an OCR artefact rather than something the operator
 * typed. Trimmed and nothing more: the draft is operator-facing text, so it is NOT NFKC-folded here.
 * Match normalisation (NFKC, whitespace stripped) belongs to the duplicate core and is applied to a
 * COPY of this value at match time — folding it into the draft itself would silently rewrite what
 * the operator sees and is asked to confirm.
 */
function applied(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Build the Screen 1 customer-draft patch from an already-obtained OCR result.
 *
 * ── PRECEDENCE: A CONFIRMED CANDIDATE WINS ──────────────────────────────────────
 * `customer_candidate_name` is not another OCR field. It is the OUTPUT of the review screen, where
 * the operator saw 所有者 and 使用者 side by side, possibly corrected the values, and possibly chose
 * which party is the customer. Re-deriving from the raw `owner_*` / `user_*` fields would discard
 * that decision and silently substitute the default recommendation — so an operator who explicitly
 * chose 所有者 would watch the 使用者 appear in the draft instead. A non-blank candidate name is
 * therefore taken as authoritative and the raw fields in the same payload are ignored entirely.
 *
 * ── THE ANTI-MIXING RULE ────────────────────────────────────────────────────────
 * When the candidate is authoritative, an ABSENT candidate field stays absent. Address is applied
 * only when the candidate carries one, and kana is not applied at all — there is no
 * `customer_candidate_kana` yet, and deriving one from the raw fields is exactly the mistake this
 * rule exists to prevent: the candidate name may have come from 所有者 while the raw derivation
 * would default to 使用者, producing a name and a kana read off two different lines. An absent
 * field is left blank and editable, which costs the operator a moment of typing; a mixed field is
 * wrong in a way nobody is prompted to check, and a name+kana pair is a duplicate matching RULE.
 *
 * ── FALLBACK ────────────────────────────────────────────────────────────────────
 * Only when no candidate name is present does this fall back to the shared mapping. `source` is the
 * party to resolve for; omitted, the established recommendation from `analyzeOcrCustomer` is used.
 * This function does NOT decide whether the operator should have been asked —
 * `analyzeOcrCustomer().requireSelection` owns that and is unchanged.
 *
 * A blank result yields an EMPTY patch, not a patch of empty strings. Spreading `{}` over the draft
 * is a no-op, so a certificate that read badly can never wipe fields the operator already filled in.
 */
export function buildWizardCustomerOcrPatch(
  result: Partial<VehicleRegistrationOcrResult>,
  source?: CustomerSource,
): WizardCustomerOcrPatch {
  const patch: { name?: string; kana?: string; address?: string } = {};

  const confirmedName = applied(result.customer_candidate_name);
  if (confirmedName !== null) {
    patch.name = confirmedName;
    const confirmedAddress = applied(result.customer_candidate_address);
    if (confirmedAddress !== null) patch.address = confirmedAddress;
    // No kana branch, deliberately. See THE ANTI-MIXING RULE above.
    return patch;
  }

  const chosen = source ?? analyzeOcrCustomer(result).recommendedSource;
  const resolved = resolveCustomer(result, chosen);

  const name = applied(resolved.name);
  if (name !== null) patch.name = name;

  const kana = applied(resolved.kana);
  if (kana !== null) patch.kana = kana;

  const address = applied(resolved.address);
  if (address !== null) patch.address = address;

  return patch;
}
