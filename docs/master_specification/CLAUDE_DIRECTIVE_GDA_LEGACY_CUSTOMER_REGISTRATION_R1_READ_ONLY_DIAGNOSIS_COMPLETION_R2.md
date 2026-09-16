# Claude Directive — GDA Legacy Customer Registration R1 Read-Only Diagnosis Completion R2

## Authority and supersession

This directive is a correction and completion pass only. It supersedes the protected-hash and remaining-read-scope fields in:

- `docs/master_specification/CLAUDE_DIRECTIVE_GDA_LEGACY_CUSTOMER_REGISTRATION_R1_READ_ONLY_DIAGNOSIS.md`
- PR #79 comment `https://github.com/nisikawa-officeAZ/GYEON/pull/79#issuecomment-5674742805`

It becomes executable only after this correction is committed and pushed to the open Draft PR and MacBook Codex publishes the exact candidate HEAD/tree in a new superseding PR comment.

Required result marker: `GDA_LEGACY_CUSTOMER_REGISTRATION_R1_READ_ONLY_DIAGNOSIS_COMPLETION_R2_RESULT_V1`

## Fixed base

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Base commit: `7ef5c0902e7eb4f7c7d0308a32d576b616a3a355`
- Base tree: `c75ee777b8c8f3661d2952604eec6c665bfc2fec`
- Candidate branch: `agent/gda-legacy-customer-registration-r1-governance`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/79`

## Accepted prior evidence

- Prior result marker: `GDA_LEGACY_CUSTOMER_REGISTRATION_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Prior report SHA-256: `9fa89304fc19aebe02b4f99addcbd443bb729d3c19c75b72ef3be03dd0e0ddb0`
- Prior verdict: `CHANGES_REQUIRED_GOVERNANCE`
- The prior pass content-proved 9 of the 23 private allowlisted paths.
- The prior report incorrectly described the remaining count as 13; its literal list contains 14 paths. This R2 count of 14 governs.
- No repository, test, dependency, database, Supabase, Auth, Storage, environment, Git, PR, Ready, merge, or deployment mutation occurred.

## Required first reads

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_LEGACY_CUSTOMER_REGISTRATION_IMPLEMENTATION_CONTRACT_V1.md`
5. This R2 directive

## Exact private completion read allowlist

- `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx`
- `src/components/estimates/EstimatesClient.tsx`
- `src/components/vehicle-registration/VehicleRegistrationUpload.tsx`
- `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx`
- `src/lib/customers/search-dealer-customers-action.ts`
- `src/lib/customers/search-dealer-customers-core.ts`
- `src/lib/customers/find-wizard-customer-duplicates-action.ts`
- `src/lib/customers/find-wizard-customer-duplicates-core.ts`
- `src/lib/vehicles/body-size-estimate.ts`
- `src/lib/vehicle-registration/actions.ts`
- `src/lib/vehicle-registration/ocr-quality.ts`
- `src/lib/vehicle-registration/vehicle-registration-types.ts`
- `src/lib/ocr/customer-mapper.ts`
- `src/lib/ocr/vehicle-mapper.ts`

No other private source content may be opened. If one required fact cannot be established from this scope, return `READ_SCOPE_EXPANSION_REQUIRED` with exact paths and stop.

## Corrected protected metadata only

Do not open, read, diff, copy, stage, or modify these files. Verify pathname, mode, blob, and Git state only:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` — `100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` — `100644 accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — `100644 32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — `100644 fe3c80f22fd80dcbfab076082473216dda582c14`

The earlier `accd22345054f3a17cc85e313b62d5bb6a4fda3f` value was a transcription error. Nine known LFS-materialized design-image paths remain unrelated and excluded.

## Required completion diagnosis

1. Content-prove which customer search, customer duplicate, OCR upload/review/action/mapping, body-size, onboarding, and estimates-list authorities are reusable without duplication.
2. Identify exact reusable exports, input/output shapes, tenant/authorization boundaries, and any UI-only adapter required.
3. Confirm the literal current estimate-list actions and the smallest later cleanup of duplicate estimate creation controls.
4. Reconcile these findings with the prior report's proposed non-overlapping DB, server-binding, UI, estimates-cleanup, and test write allowlists.
5. State whether either unresolved architecture choice requires Owner ratification:
   - a minimal durable registration-receipt idempotency anchor because zero history rows are valid;
   - SECURITY INVOKER with RLS-bounded same-tenant raw insert versus strict RPC-only writes through a non-exposed privileged boundary.
6. Confirm that no estimate, invoice, delivery note, work order, payment, inventory, TOP, sidebar, PDF, pricing, or customer-CRM redesign is required.

## Prohibited

- Any file creation or modification
- Tests, typecheck, build, formatter, or dependency command
- Supabase CLI, Docker, Colima, SQL, database, Auth, Storage, environment, secret, or Chrome access
- Git stage, commit, branch, push, PR mutation, Ready, merge, or deployment
- Reading any private source outside the exact 14-path completion allowlist

## Required result schema

Return one concise report containing:

- result marker
- verdict: `READY_FOR_IMPLEMENTATION_GOVERNANCE`, `CHANGES_REQUIRED_GOVERNANCE`, `READ_SCOPE_EXPANSION_REQUIRED`, or `OWNER_DECISION_REQUIRED`
- verified base/candidate identity and known-unrelated state
- content-proven reusable authorities for all 14 completion paths
- reconciled literal future write allowlists
- exact current estimates-list action findings
- owner decisions, if any
- unresolved facts
- corrected protected metadata result
- mutation flags, all false

Stop after the report.
