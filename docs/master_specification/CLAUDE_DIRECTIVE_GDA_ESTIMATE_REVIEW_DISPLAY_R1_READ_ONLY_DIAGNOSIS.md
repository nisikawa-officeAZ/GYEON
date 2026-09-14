# Claude Directive — GDA Estimate Review Display R1 Read-Only Diagnosis

```yaml
phase: GDA_ESTIMATE_REVIEW_DISPLAY_R1
marker: GDA_ESTIMATE_REVIEW_DISPLAY_R1_READ_ONLY_DIAGNOSIS_V1
mode: READ_ONLY_DIAGNOSIS_ONLY
repository: nisikawa-officeAZ/GYEON
coordination_pr: https://github.com/nisikawa-officeAZ/GYEON/pull/73
base_branch: release/saved-delivery-note-r1
base_commit: 1dc5b2dd197c97d9860ab4511cea8baa084c5954
base_tree: 7d4a235f832ca5ba693ef6fc3cb2f961cd39c38a
owner: Office AZ
implementation_agent: MacBook Claude after a later separate authorization
acceptance_authority: MacBook Codex
```

## Objective

Diagnose the smallest presentation-only correction for the Estimate Wizard final review so an
effective existing customer and vehicle render their server-composed `displayName` values and known
service-category ids render their canonical Japanese labels. Preserve all save, pricing, persistence,
tenant, PDF, invoice, delivery-note, and document behavior.

## Required first reads

Read these files completely before returning the diagnosis:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

Then read only these private source paths:

1. `src/components/estimates/wizard/steps/Step7Review.tsx`
2. `src/components/estimates/wizard/EstimateWizard.tsx`
3. `src/components/estimates/wizard/steps/existing-entity-selection.ts`
4. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
5. `src/components/estimates/wizard/useEstimateWizard.ts`
6. `src/lib/estimates/service-categories.ts`
7. `src/components/estimates/wizard/steps/existing-entity-selection.test.tsx`

No other private source path may be opened. Direct imports required only to understand a type may be
reported as `READ_SCOPE_EXPANSION_REQUIRED`; do not open them.

## Protected metadata-only paths

These paths may be checked only with `git ls-tree`, pathname, mode, blob hash, and Git-state commands.
Never open, read, diff, copy, stage, or modify them.

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs at the fixed base are respectively:

- `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `32fda49583ae1217bc13711784ad8fa31744726c`
- `fe3c80f22fd80dcbfab076082473216dda582c14`

## Required diagnosis

1. Confirm whether Step 7 currently reads new-entity draft fields even when existing ids are the
   effective selection authority.
2. Confirm whether `EstimateWizard` already owns the dealer-scoped customer and vehicle references
   and can pass them to Step 7 without another fetch, state store, or persistence field.
3. Confirm the exact fail-closed behavior for missing, duplicate, stale, or wrong-owner references.
4. Confirm that server-composed `displayName` is the only permitted existing-entity display source.
5. Confirm the canonical service-category label authority and the exact correction for `other`.
6. Confirm that no save, pricing, DTO, RPC, database, PDF, invoice, or delivery-note change is needed.
7. Confirm or correct this proposed later implementation allowlist:
   - `src/components/estimates/wizard/steps/Step7Review.tsx`
   - `src/components/estimates/wizard/EstimateWizard.tsx`
   - `src/components/estimates/wizard/steps/Step7Review.test.tsx` (new)
8. Return exact focused test and typecheck commands for a later implementation gate.

## Prohibitions

Do not edit, create, delete, rename, format, stage, commit, push, comment on GitHub, mark Ready, merge,
or deploy. Do not run tests, typecheck, build, dependency installation, package commands, browser
automation, database, Supabase, Docker, Colima, Auth, Storage, Vercel, provider, or external-service
commands. Do not inspect environment or credential files. Do not redesign the Step 7 layout or touch
customer-management behavior.

## Required result

Return one report with this exact marker:

`GDA_ESTIMATE_REVIEW_DISPLAY_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

The report must include:

- `VERDICT=READY_FOR_IMPLEMENTATION_GOVERNANCE` or `VERDICT=CHANGES_REQUIRED_GOVERNANCE`
- exact execution branch, commit, and tree
- exact read paths and SHA-256 values
- protected path modes, blobs, and clean/dirty state without content access
- root-cause ledger for customer, vehicle, and category rendering
- confirmed or corrected literal implementation allowlist
- exact later verification commands
- explicit mutation flags, all false
- any required owner decision or read-scope correction

Stop after returning the report to PR #73. This instruction authorizes diagnosis only.
