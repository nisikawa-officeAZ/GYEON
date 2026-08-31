// GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_A — Estimate Wizard: apply an ALREADY-OBTAINED
// vehicle-registration OCR result to the editable vehicle draft. PURE CORE, shared by Step 1's
// atomic single-scan apply and Step 2's optional rescan.
//
// No React, no Supabase, no Server Action, no Storage, no clock, no randomness, no generated ID,
// no `any`, no cast. This module is handed an OCR result an earlier step already produced and
// returns a PATCH; it performs no I/O of any kind.
//
// ── WHY A NARROW PATCH TYPE RATHER THAN Partial<VehicleDraft> ───────────────────
// `existingId`, `suggestedSize`, `confirmedSize` and `grade` are vehicle-IDENTITY and
// operator-authoritative fields, never OCR fields. Typing the return value as the full draft
// would make `patch.confirmedSize = …` a legal edit to this file; typing it as exactly the ten
// draft fields below makes it a compile error — there is no key here through which OCR could
// touch identity, the operator's final size choice, or grade.
//
// ── GRADE IS ALWAYS MANUAL ───────────────────────────────────────────────────────
// A vehicle-registration certificate carries no reliable grade field, so no evidence exists for
// OCR to read. Grade is operator-entered only; this core never emits it, so a certificate value
// (real or malformed) can never populate or overwrite it.
//
// ── BLANK HANDLING ───────────────────────────────────────────────────────────────
// Every scalar and plate fragment is trimmed SOLELY to decide whether it is blank
// (`typeof value === "string"` alone accepts `""` and whitespace-only text, which is wrong). A
// blank value is OMITTED entirely — never emitted as an empty string — so a certificate field
// that read badly can never clear text the operator already typed. The APPLIED value is the
// trimmed text and nothing more: no aliasing, fallback mapping, or inference. The single
// exception is `vehicleCode` (built from 型式/result.model), which is additionally
// NFKC-normalized because it is a machine-matched code, not display text — see its own comment.

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

/**
 * The ONLY vehicle-draft fields an OCR result may touch.
 *
 * Exported so a test can assert the emitted key set against it: a future edit that starts writing
 * an identity or operator-authoritative field fails that assertion rather than quietly widening
 * what OCR controls.
 */
export const OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS = [
  "maker",
  "model",
  "vehicleCode",
  "displacement",
  "vin",
  "firstRegYearMonth",
  "registrationDate",
  "inspectionExpiry",
  "color",
  "plateNumber",
] as const;

export type OcrApplicableVehicleDraftField = (typeof OCR_APPLICABLE_VEHICLE_DRAFT_FIELDS)[number];

/**
 * A patch over the vehicle draft.
 *
 * Every field is OPTIONAL and an absent key means "the certificate did not supply this" — never
 * "clear it". The wizard applies the patch through the canonical patch adapter, so an absent key
 * leaves whatever the operator already typed exactly as it was.
 */
export type WizardVehicleOcrPatch = {
  readonly [K in OcrApplicableVehicleDraftField]?: string;
};

/**
 * A value worth applying, or null.
 *
 * Trimmed, because surrounding whitespace is an OCR artefact rather than something the operator
 * typed. Trimmed and nothing more — see BLANK HANDLING above.
 */
function applied(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Build the vehicle-draft patch from an already-obtained OCR result.
 *
 * The plate fragments are joined in their official display order — region, class, kana, number —
 * with exactly one space, and a blank fragment is skipped rather than leaving a doubled space or
 * an empty leading/trailing segment. `plateNumber` is omitted entirely when every fragment is blank.
 */
export function buildWizardVehicleOcrPatch(
  result: Partial<VehicleRegistrationOcrResult>,
): WizardVehicleOcrPatch {
  const patch: { -readonly [K in OcrApplicableVehicleDraftField]?: string } = {};

  const maker = applied(result.maker);
  if (maker !== null) patch.maker = maker;

  const model = applied(result.vehicle_name);
  if (model !== null) patch.model = model;

  // 型式 (result.model) is the only field NFKC-normalized here — it becomes vehicleCode,
  // a machine-matched code, so full-width digits/letters/hyphen (e.g. "６ＢＡ－ＪＧ３")
  // must fold to their half-width form (e.g. "6BA-JG3"). Every other field in this core
  // stays exactly as printed; see the no-NFKC test for maker below.
  const vehicleCode = applied(result.model);
  if (vehicleCode !== null) patch.vehicleCode = vehicleCode.normalize("NFKC");

  const displacement = applied(result.displacement);
  if (displacement !== null) patch.displacement = displacement;

  const vin = applied(result.chassis_number);
  if (vin !== null) patch.vin = vin;

  const firstRegYearMonth = applied(result.first_registration_date);
  if (firstRegYearMonth !== null) patch.firstRegYearMonth = firstRegYearMonth;

  const registrationDate = applied(result.registration_date);
  if (registrationDate !== null) patch.registrationDate = registrationDate;

  const inspectionExpiry = applied(result.inspection_expiry_date);
  if (inspectionExpiry !== null) patch.inspectionExpiry = inspectionExpiry;

  const color = applied(result.color);
  if (color !== null) patch.color = color;

  const plateFragments = [
    applied(result.license_plate_region),
    applied(result.license_plate_class),
    applied(result.license_plate_kana),
    applied(result.license_plate_number),
  ].filter((fragment): fragment is string => fragment !== null);
  if (plateFragments.length > 0) patch.plateNumber = plateFragments.join(" ");

  return patch;
}
