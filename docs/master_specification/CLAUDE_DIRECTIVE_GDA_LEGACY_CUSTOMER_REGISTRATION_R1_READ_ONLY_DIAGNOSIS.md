# Claude Directive — GDA Legacy Customer Registration R1 Read-Only Diagnosis

## Authority

This directive is a future instruction only. It becomes executable only after it is committed and pushed to a dedicated open Draft PR and MacBook Codex publishes the exact execution identity in the newest non-superseded PR comment.

Required result marker: `GDA_LEGACY_CUSTOMER_REGISTRATION_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Fixed base

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Commit: `7ef5c0902e7eb4f7c7d0308a32d576b616a3a355`
- Tree: `c75ee777b8c8f3661d2952604eec6c665bfc2fec`
- Candidate branch: `agent/gda-legacy-customer-registration-r1-governance`

## Required first reads

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_LEGACY_CUSTOMER_REGISTRATION_IMPLEMENTATION_CONTRACT_V1.md`

## Exact private read allowlist

- `src/app/hub/customers/page.tsx`
- `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx`
- `src/components/estimates/EstimatesClient.tsx`
- `src/components/vehicle-registration/VehicleRegistrationUpload.tsx`
- `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx`
- `src/lib/auth/resolve-estimate-save-actor-context.ts`
- `src/lib/customers/create-customer.ts`
- `src/lib/customers/search-dealer-customers-action.ts`
- `src/lib/customers/search-dealer-customers-core.ts`
- `src/lib/customers/find-wizard-customer-duplicates-action.ts`
- `src/lib/customers/find-wizard-customer-duplicates-core.ts`
- `src/lib/vehicles/create-vehicle.ts`
- `src/lib/vehicles/find-vehicle-by-vin-or-plate.ts`
- `src/lib/vehicles/body-size-estimate.ts`
- `src/lib/vehicle-registration/actions.ts`
- `src/lib/vehicle-registration/ocr-quality.ts`
- `src/lib/vehicle-registration/vehicle-registration-types.ts`
- `src/lib/ocr/customer-mapper.ts`
- `src/lib/ocr/vehicle-mapper.ts`
- `supabase/migrations/001_create_core_tables.sql`
- `supabase/migrations/102_estimate_wizard_atomic_save.sql`
- `supabase/migrations/104_least_privilege_grants.sql`
- `supabase/migrations/20260727112326_add_customer_match_keys.sql`

No other repository content may be opened. If one required fact cannot be established from this scope, return `READ_SCOPE_EXPANSION_REQUIRED` with exact paths and stop.

## Protected metadata only

Do not open, read, diff, copy, stage, or modify these files. Verify only pathname, mode, blob, and Git state:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` — `100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` — `100644 accd22345054f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — `100644 32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — `100644 fe3c80f22fd80dcbfab076082473216dda582c14`

Nine known LFS-materialized design-image paths are unrelated and must remain untouched and excluded from every proposed write, stage, diff-acceptance, and result claim.

## Required diagnosis

1. Prove which customer, vehicle, OCR, duplicate, membership, and body-size authorities can be reused without duplication.
2. Identify the exact canonical customer/vehicle columns and tenant-bound foreign-key patterns.
3. Diagnose the smallest safe `vehicle_service_history` schema, constraints, indexes, RLS, grants, and audit boundary.
4. Diagnose one atomic/idempotent save contract for new/existing customer and vehicle combinations plus zero-or-more history rows.
5. Prove whether the function can remain security invoker. If not, state the exact non-exposed privileged-function boundary and grants.
6. Identify all direct-Data-API and raw-DML bypasses that must fail closed.
7. Return literal, non-overlapping later write allowlists for DB, server binding, UI, estimates cleanup, and tests.
8. Return exact focused verification commands, including migration contract, RLS/grant, rollback, idempotency, cross-tenant, and duplicate-concurrency cases.
9. Confirm that no estimate, invoice, delivery note, work order, payment, inventory, TOP, sidebar, PDF, pricing, or customer-CRM redesign is required.

## Prohibited

- Any file creation or modification
- Tests, typecheck, build, formatter, or dependency command
- Supabase CLI, Docker, Colima, SQL, database, Auth, Storage, or environment access
- Git stage, commit, branch, push, PR mutation, Ready, merge, or deployment
- Network or provider access
- Reading secrets or environment files
- Automatic merge/overwrite design

## Required result schema

Return one concise report containing:

- result marker
- verdict: `READY_FOR_IMPLEMENTATION_GOVERNANCE`, `CHANGES_REQUIRED_GOVERNANCE`, `READ_SCOPE_EXPANSION_REQUIRED`, or `OWNER_DECISION_REQUIRED`
- verified base commit/tree and clean/known-unrelated state
- reusable authorities
- confirmed schema and atomic-save findings
- exact future write allowlists
- exact verification commands
- unresolved facts
- protected metadata result
- mutation flags, all false

Stop after the report.
