# GDA_ESTIMATE_WIZARD_OCR_MANUAL_MODEL_GRADE_R1_IMPLEMENTATION

Result marker: `GDA_ESTIMATE_WIZARD_OCR_MANUAL_MODEL_GRADE_R1_IMPLEMENTATION_RESULT_V1`

## Authority and objective

Apply one bounded correction to the already accepted, unstaged/uncommitted GDA-2A single-scan candidate.

Owner-ratified behavior:

- One reviewed OCR result continues to populate customer and vehicle data in one operation.
- OCR may immediately populate maker, full vehicle type/model code, physical dimensions, and the other already accepted certificate fields.
- Vehicle model name is not inferred without a free approved internal exact-match authority. No such authority currently exists in the repository, so model name remains operator-entered unless the certificate itself supplies a distinct nonblank vehicle name.
- Grade is never inferred or populated by OCR. It remains blank or preserves an operator-entered value and is entered manually.
- No AI, paid API, external vehicle-master connection, fuzzy matching, or blocking resolver may be introduced.
- OCR and 3M size recommendation must remain fast and must not wait for model/grade resolution.

Repository/worktree:

- branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- fixed HEAD: `501ede8c06b0c397a47996f9dfe0833f8779376c`
- fixed tree: `fda91137ce537f5a6f60f82d229b6aa1ac6c13e6`
- existing accepted eight-path single-scan candidate: dirty, unstaged, uncommitted

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. the latest GDA-2A OCR entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. this directive

Then state the active phase, fixed base, dirty-candidate boundary, exact write allowlist, protected paths, prohibitions, and responsibility boundary.

## Exact write allowlist

Only these four paths may be edited:

1. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts`
2. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts`
3. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
4. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`

All other paths are read-only or out of scope. Do not modify governance files.

## Required implementation

1. Remove `grade` from the OCR-applicable vehicle-draft field allowlist and from `buildWizardVehicleOcrPatch` output.
2. Prove that a nonblank OCR `grade` is ignored and cannot overwrite an operator-entered grade.
3. Preserve the accepted nonblank `vehicle_name -> model` behavior. Do not fall back from `model` (the certificate type/model code) into the vehicle-name field.
4. Keep `model -> vehicleCode`, maker, dimensions/3M recommendation, and all other accepted mappings unchanged.
5. Add a visible manual `グレード` input to the active Step-2 vehicle form. State clearly that OCR does not auto-fill it and manual entry is optional unless an existing validation contract already requires it.
6. Adjust the vehicle-name hint so it does not promise unsupported automatic identification. A certificate-supplied distinct vehicle name may still appear, but no AI/fuzzy/vendor lookup exists in this phase.
7. Do not add any wait, loading gate, API call, server action, database lookup, timeout, dependency, migration, provider, or configuration.

## Required verification

Run only the focused tests needed for the four paths, including at minimum:

- `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts`
- `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`

Also run `git diff --check` limited to the four allowlisted paths. If the repository's existing focused command requires adjacent already accepted wizard tests, list them before execution and do not broaden to a whole-suite run.

## Protected metadata-only paths

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Never open, read, diff, copy, stage, or modify protected content. Metadata proof only.

## Prohibitions

- No stage, commit, push, PR mutation, Ready, merge, deployment, migration, provider configuration, or production action.
- No database, Supabase, browser, web search, external API, paid service, package installation, or dependency/configuration change.
- No AI-based vehicle name or grade inference.
- No internal mapping table fabrication.
- No edits outside the exact four-path write allowlist.

## Required result

Return one report headed by the result marker and include:

- verdict: `PASS`, `CHANGES_REQUIRED`, or `BLOCKED_ENVIRONMENT`
- exact changed paths
- proof that OCR never emits `grade`
- proof that operator-entered grade survives OCR application
- proof that the active UI exposes manual grade entry
- proof that vehicle-name behavior is non-fabricating and non-blocking
- exact focused test commands/counts/results
- `git diff --check` result
- protected-path metadata and zero-Git/DB/provider/deployment proof

Leave all source changes unstaged and uncommitted for Codex review.
