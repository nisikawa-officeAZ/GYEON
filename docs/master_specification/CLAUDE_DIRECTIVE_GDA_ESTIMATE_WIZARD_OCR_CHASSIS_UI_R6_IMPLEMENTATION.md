# GDA_ESTIMATE_WIZARD_OCR_CHASSIS_UI_R6_IMPLEMENTATION

Directive ID: `GDA_ESTIMATE_WIZARD_OCR_CHASSIS_UI_R6_IMPLEMENTATION_V1`

## Objective

Implement only the already-diagnosed presentation gap in PR #48: the active Step-2 new-vehicle form must display an editable `車台番号` field bound to the existing Wizard `vehicle.vin` state. Do not redesign or extend OCR, save, schema, postal, vehicle-name, grade, or body-size behavior.

## Dispatch identity

- Repository: `nisikawa-officeAZ/GYEON`
- PR: `#48`, required `OPEN` and `Draft`
- Base branch: `main`
- Source baseline commit: `c6155bfa7ae342e6a0a9394e1c7eddf9bfdfacd6`
- Source baseline tree: `e77931bc7c1f4f1bff91b2b4769f45a9cbf67163`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- A later owner-approved dispatch must supply exact `DISPATCH_HEAD` and `DISPATCH_TREE` after this three-path governance candidate is committed and normally pushed.
- The source baseline must be an ancestor of `DISPATCH_HEAD`; the baseline-to-dispatch delta must be exactly the three governance paths recorded in the completion plan and ledger.
- Responsible implementer: MacBook terminal Claude Code
- Independent acceptance: MacBook Codex

Return `BLOCKED_CANDIDATE_DRIFT` without editing if identity, ancestry, clean committed state, protected metadata, or the exact governance delta differs.

## Mandatory complete read scope

Read only these paths completely before editing:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_CHASSIS_UI_R6_IMPLEMENTATION.md`
6. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
7. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
8. `src/components/estimates/wizard/wizard-types.ts`
9. `src/components/estimates/wizard/useEstimateWizard.ts`
10. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
11. `src/components/estimates/wizard/ui.tsx`
12. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts`
13. `src/lib/vehicle-registration/vehicle-registration-types.ts`
14. `package.json`

If one additional existing path is essential, stop with `BLOCKED_READ_SCOPE` and name the exact path and reason. Do not read it.

## Exact write allowlist

Edit or create only:

1. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
2. `src/components/estimates/wizard/steps/Step2Vehicle.test.tsx` (new)

Every other path is read-only or prohibited.

## Required implementation

1. In the active Step-2 new-vehicle editable form, add one `Field` labeled exactly `車台番号`.
2. Bind its input value to `v.vin`.
3. Bind editing to the existing one-key discipline: `setV({ vin: value })`.
4. Place it consistently within the current vehicle-information grid. Do not change the existing-field order except for the minimal insertion.
5. Do not add validation, normalization, provider lookup, AI inference, automatic save, schema work, or new dependencies.

## Required focused proof

Create `src/components/estimates/wizard/steps/Step2Vehicle.test.tsx` and prove through the real component behavior:

- `車台番号` renders with the current `v.vin` value, including an OCR-populated value.
- Editing it emits exactly `{ vehicle: { vin: "<new value>" } }` with no unrelated key.
- Existing maker, vehicle name, type, grade, size, plate, displacement, and selected-identity state are not emitted by that edit.
- The existing OCR apply contract still preserves a nonblank operator VIN when OCR chassis data is blank.

Do not weaken an assertion to make it pass. Do not replace behavior proof with source-text matching when the real component callback can be exercised using the repository's established React render/capture seam.

## Frozen contracts

- One OCR review can update customer and vehicle draft state together.
- Blank OCR data never erases operator input.
- Vehicle name remains manual unless printed or a separately authorized local authority exists.
- Grade is always manual-only.
- Existing maker/type/dimensions/plate/date/displacement and `SS/S/M/ML/L/LL/XL` behavior remain unchanged.
- Existing-vehicle selection and one-key field patches remain unchanged.
- Explicit final save remains the sole persistence boundary.
- No DB, migration, RPC, provider, environment, route, permission, dependency, or UI redesign.

## Protected paths

`src/components/estimates/wizard/screens/ScreensPreview.tsx` is pathname/mode/blob/status metadata only. Never open, read, diff, copy, stage, or modify it.

These closed paths also remain unchanged:

- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## Authorized commands

Run exactly:

1. `node --import tsx --test src/components/estimates/wizard/steps/Step2Vehicle.test.tsx`
2. `node --import tsx --test src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
3. `npm run typecheck`
4. `git diff --check -- src/components/estimates/wizard/steps/Step2Vehicle.tsx src/components/estimates/wizard/steps/Step2Vehicle.test.tsx`

No other test, build, lint, browser, dev-server, network, provider, database, Supabase, migration, OCR upload, or environment command is authorized.

## Git boundary

Do not stage, commit, push, comment on GitHub, mark Ready, merge, deploy, clean, stash, restore, or modify branch metadata. Leave the two-path candidate unstaged and uncommitted for Codex review.

## Required result

Return identifier:

`GDA_ESTIMATE_WIZARD_OCR_CHASSIS_UI_R6_IMPLEMENTATION_RESULT_V1`

Then report:

1. `VERDICT`: `CANDIDATE_READY_FOR_CODEX_REVIEW`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, or `BLOCKED_READ_SCOPE`
2. `BASE_AND_SCOPE_PROOF`
3. `ACTUAL_CHANGED_PATHS`
4. `IMPLEMENTATION_SUMMARY`
5. `FOCUSED_TEST_RESULTS`
6. `TYPECHECK_AND_DIFF_CHECK`
7. `PROTECTED_AND_NO_EXTERNAL_ACTION_PROOF`

Stop after the result. Do not stage, commit, push, or deploy.
