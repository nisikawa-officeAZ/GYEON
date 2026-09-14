# Claude Directive — GDA Estimate Detail Invoice Same-Page R1 Read-Only Diagnosis

## Authority

This instruction authorizes diagnosis only. It does not authorize file changes, tests, dependency work, Git mutation, database/Supabase access, environment changes, implementation, Ready conversion, merge, or deployment.

## Phase and fixed base

- Phase: `GDA-ESTIMATE-DETAIL-INVOICE-SAME-PAGE-R1`
- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Base commit: `6748ad78d6f577d3db630e631fca6a700e93281d`
- Base tree: `fbe7f16b9841d3793fdd6d6369acb28d8e52d012`
- Candidate branch: `docs/gda-estimate-detail-invoice-same-page-r1`

## Required first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

Then state the phase, base, read scope, protected paths, prohibitions, and result marker before inspecting source.

## Exact read scope

- `src/app/estimates/[id]/page.tsx`
- `src/app/estimates/new/page.tsx`
- `src/components/estimates/EstimateDetailView.tsx`
- `src/components/estimates/EstimateDetail.tsx`
- `src/components/estimates/EstimateDetail.documents.test.tsx`
- `src/components/estimates/wizard/production/SavedEstimateDocuments.tsx`
- `src/components/estimates/wizard/production/SavedEstimateInvoice.tsx`
- `src/components/estimates/wizard/production/saved-estimate-invoice-controller.ts`
- `src/components/estimates/wizard/production/SavedEstimateInvoice.test.tsx`
- `src/components/estimates/wizard/production/saved-invoice-issuance.test.tsx`
- `src/lib/invoices/create-invoice.ts`
- `src/lib/invoices/get-invoice.ts`
- `src/lib/invoices/save-invoice-delivery-date.ts`
- `src/lib/invoices/issue-invoice.ts`
- `src/lib/invoices/invoice-delivery-date.ts`

No other repository source or test path may be opened. The governance documents may be read as required above.

## Protected metadata-only paths

Do not open, read, diff, copy, stage, or modify these paths. Only pathname, mode, object id, hash, and Git state may be reported:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## Confirmed observation to diagnose

- The post-save same-URL surface already supports explicit invoice draft creation/readback, delivery-date save, confirmed issue, issued-PDF retrieval, and delivery-note activation.
- The reopened saved-estimate detail page instead imports `createInvoiceFromEstimate` in its client component and navigates to `/invoices` after creation.
- The reopened detail route already reads one dealer-scoped related invoice for delivery-note eligibility.
- A focused read-only baseline completed `65/65` tests successfully on 2026-09-14.

Do not treat these observations as permission to implement. Confirm the source call chain and identify the smallest reuse-only repair.

## Required diagnosis

1. Prove the exact call chain that leaves the reopened detail page after invoice creation.
2. Decide how the route can inject the existing canonical create, read, delivery-date-save, issue, and issued-PDF actions without adding a parallel invoice controller.
3. Prove whether `SavedEstimateInvoice` and `saved-estimate-invoice-controller` can be reused unchanged.
4. Preserve the server rule that only an approved estimate can create or reuse its invoice; never auto-approve an estimate.
5. Define fail-closed UI states for unapproved, approved-without-invoice, existing draft, issued-or-later, cancelled, malformed/ambiguous readback, read failure, and lost write response.
6. Preserve explicit confirmation before invoice issue. No mount, reload, status change, estimate save, or PDF view may create, date, issue, reissue, or mark an invoice paid.
7. Keep estimate PDF, delivery-note eligibility, invoice numbering, pricing, authorization, RLS, persistence, PDF layout, and Genspark's separate logo-layout work unchanged.
8. Return the smallest literal implementation and test allowlist. No migration, dependency, package, lockfile, or PDF-template change should be proposed unless the inspected source proves it unavoidable.

## Candidate implementation ceiling

The diagnosis may recommend only from these paths; it may narrow but must not broaden them:

- `src/app/estimates/[id]/page.tsx`
- `src/components/estimates/EstimateDetailView.tsx`
- `src/components/estimates/EstimateDetail.tsx`
- `src/components/estimates/EstimateDetail.documents.test.tsx`

The existing saved-invoice components, controller, invoice actions, database schema, migrations, and PDF templates are reuse-only and frozen for this phase.

## Prohibitions

- No file creation, edit, formatting, or generated plan file.
- No tests, typecheck, build, lint, or dependency command.
- No database, Supabase, Auth, Storage, HTTP application probe, provider, or production access.
- No stage, commit, push, branch mutation, PR mutation, Ready conversion, merge, or deployment.
- No inspection or modification outside the exact read scope.
- No use of protected paths beyond metadata.
- No new invoice workflow, duplicate controller, automatic invoice operation, or navigation to `/invoices` as the successful same-page result.

## Required result

Return exactly one report headed:

`GDA_ESTIMATE_DETAIL_INVOICE_SAME_PAGE_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

Include:

- `VERDICT=READY_FOR_IMPLEMENTATION_GOVERNANCE|CHANGES_REQUIRED_SCOPE|BLOCKED`
- exact root cause and call chain;
- exact route-level action-injection design;
- state-by-state fail-closed behavior;
- proof whether the existing saved-invoice core remains unchanged;
- exact recommended implementation/test allowlist;
- focused test commands for a later separately authorized verification gate;
- proof that no repository, Git, database, environment, or external state changed.

Post the report only to the active coordination Draft PR after Codex supplies its URL. Stop after posting.
