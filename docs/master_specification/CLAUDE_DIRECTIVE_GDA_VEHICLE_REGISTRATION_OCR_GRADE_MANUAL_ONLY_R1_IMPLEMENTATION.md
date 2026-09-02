# GDA_VEHICLE_REGISTRATION_OCR_GRADE_MANUAL_ONLY_R1_IMPLEMENTATION

Result marker: `GDA_VEHICLE_REGISTRATION_OCR_GRADE_MANUAL_ONLY_R1_IMPLEMENTATION_RESULT_V1`

## Authority and objective

Make grade manual-only across the shared vehicle-registration OCR extraction and review flow. The owner prioritizes the one-minute estimate workflow and explicitly rejected automatic grade determination. Preserve all accepted customer, maker, certificate type/model code, dimension, and 3M behavior.

Repository/worktree:

- branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- fixed HEAD: `501ede8c06b0c397a47996f9dfe0833f8779376c`
- fixed tree: `fda91137ce537f5a6f60f82d229b6aa1ac6c13e6`
- current accepted candidate: dirty, unstaged, uncommitted

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. latest GDA-2A OCR entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. this directive

Then state the active phase, fixed base, dirty-candidate boundary, exact write allowlist, protected paths, prohibitions, and responsibility boundary.

## Exact write allowlist

Only these seven paths may be edited:

1. `src/lib/vehicle-registration/ocr.ts`
2. `src/lib/vehicle-registration/vehicle-normalize.ts`
3. `src/lib/vehicle-registration/ocr-test-cases.ts`
4. `src/lib/vehicle-registration/ocr-dimensions-contract.test.ts`
5. `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx`
6. `src/components/vehicle-registration/VehicleRegistrationUpload.tsx`
7. `src/lib/vehicle-registration/ocr-customer-mapping.test.ts`

All other paths are read-only or out of scope. Do not modify governance files.

## Required implementation

1. Remove `grade` from the extraction prompt JSON schema.
2. Remove `grade` from the OCR sanitizer's accepted string fields so provider-supplied legacy or hostile grade text is discarded.
3. Remove grade input/output and grade-token derivation from deterministic vehicle normalization.
4. When a combined vehicle-name string contains a maker plus remaining text, preserve the complete remaining text as the model string. Do not treat trailing tokens as grade.
5. Remove grade from the shared OCR review field list and from the upload detected-vehicle summary.
6. Keep the optional legacy `VehicleRegistrationOcrResult.grade` type untouched in this phase for backward compatibility, but do not request, sanitize, normalize, display, select, apply, or summarize it.
7. Preserve the active Estimate Wizard manual grade field and its downstream manual persistence contract unchanged.
8. Preserve maker, `model` as certificate type/model code, distinct `vehicle_name`, dimensions, 3M recommendation, customer mapping, retry, usage logging, and all provider/error behavior.
9. Add focused proof that a nonblank input `grade` is discarded, grade is absent from extraction/review/summary behavior, and the full non-maker vehicle-name remainder is not split as a grade.

## Required verification

Run only:

- `src/lib/vehicle-registration/ocr-dimensions-contract.test.ts`
- `src/lib/vehicle-registration/ocr-customer-mapping.test.ts`
- `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts`
- `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
- `src/lib/vehicles/body-size-estimate.test.ts`

Run `npm run typecheck` and `git diff --check` limited to the seven-path allowlist plus the already accepted Estimate Wizard OCR candidate paths. Do not run a build or whole test suite.

## Protected metadata-only paths

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Never open, read, diff, copy, stage, or modify protected content. Metadata proof only.

## Prohibitions

- No stage, commit, push, PR mutation, Ready, merge, deployment, migration, provider configuration, or production action.
- No database, Supabase, browser, web search, external API call, OCR upload, paid service, package installation, dependency/configuration change, or generated artifact.
- No AI/fuzzy vehicle model or grade inference.
- No edits outside the exact seven-path write allowlist.

## Required result

Return one report headed by the result marker with verdict `PASS`, `CHANGES_REQUIRED`, or `BLOCKED_ENVIRONMENT`, exact changed paths, behavior proof, focused test counts, typecheck, diff check, protected metadata, and zero Git/DB/provider/deployment proof. Leave all changes unstaged and uncommitted.
