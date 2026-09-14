# Claude Directive — GDA Estimate Detail Documents R1 Read-Only Diagnosis

## Authority

This instruction authorizes diagnosis only. It does not authorize file changes, tests, dependency work, Git mutation, database/Supabase access, environment changes, Ready conversion, merge, or deployment.

## Phase and fixed base

- Phase: `GDA-ESTIMATE-DETAIL-DOCUMENTS-R1`
- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Base commit: `7dbcef0d1606f09918a94fc60cf915becf512f42`
- Base tree: `62534569591c5f49058aae10cf47359bab94fc81`
- Candidate branch: `fix/estimate-detail-documents-r1`

## Required first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

Then state the phase, base, read scope, protected paths, prohibitions, and result marker before inspecting source.

## Exact read scope

- `src/app/estimates/[id]/page.tsx`
- `src/components/estimates/EstimateDetailView.tsx`
- `src/components/estimates/EstimateDetail.tsx`
- `src/lib/invoices/get-invoice.ts`
- `src/lib/invoices/invoice-types.ts`
- `src/lib/invoices/invoice-delivery-date.ts`
- `src/components/invoices/InvoicePdfIssueActions.tsx`
- `src/components/estimates/wizard/production/SavedEstimateDocuments.tsx`
- `src/components/estimates/wizard/production/saved-estimate-invoice-controller.ts`
- `src/app/pdf/delivery-note/route.ts`
- `src/lib/pdf/get-delivery-note-pdf-data.ts`
- `src/lib/pdf/delivery-note-document-data.ts`
- `src/components/estimates/wizard/production/SavedEstimateDocuments.test.tsx`
- `src/lib/pdf/__tests__/template-c2/delivery-note-binding-boundary.test.ts`

No other repository source or test path may be opened. The three governance documents may be read as required above.

## Protected metadata-only paths

Do not open, read, diff, copy, stage, or modify these paths. Only pathname, mode, object id, hash, and Git state may be reported:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## Confirmed observation to diagnose

Authenticated production inspection at `https://app.detailer-ag.com/estimates/<saved-estimate-id>` showed:

- estimate PDF display and download are present;
- invoice creation is present for an approved estimate;
- delivery-note display is absent from the reopened saved-estimate detail screen;
- the post-save same-URL surface already contains estimate, invoice, and delivery-note controls.

Do not treat the observation as permission to implement. Confirm the source call chain and identify the smallest fail-closed repair.

## Required diagnosis

1. Prove why the reopened saved-estimate detail screen cannot render delivery-note eligibility.
2. Identify the tenant-scoped read needed to find the single non-deleted invoice related to the saved estimate without creating or mutating anything.
3. Preserve the existing delivery-note business gate: issued/paid/partially-paid/overdue status, valid persisted `invoices.delivery_date`, valid invoice identity, and authenticated dealer scope.
4. Decide whether the existing pure eligibility authorities can be reused without importing a server-only module into a client component.
5. Define the exact UI states for no invoice, draft invoice, eligible issued invoice, malformed/ambiguous readback, and read failure. All uncertainty must fail closed.
6. Confirm that estimate PDF, invoice creation, invoice issuance, delivery-note rendering, numbering, pricing, authorization, RLS, and persistence behavior remain unchanged.
7. Return the smallest literal implementation and test allowlist. No migration or dependency should be proposed unless the inspected source proves it unavoidable.

## Candidate implementation ceiling

The diagnosis may recommend only from these paths; it may narrow but must not broaden them:

- `src/app/estimates/[id]/page.tsx`
- `src/components/estimates/EstimateDetailView.tsx`
- `src/components/estimates/EstimateDetail.tsx`
- `src/lib/invoices/get-invoice.ts`
- `src/components/estimates/EstimateDetail.documents.test.tsx`

## Prohibitions

- No file creation, edit, formatting, or generated plan file.
- No tests, typecheck, build, lint, or dependency command.
- No database, Supabase, Auth, Storage, HTTP application probe, provider, or production access.
- No stage, commit, push, branch mutation, PR mutation, Ready conversion, merge, or deployment.
- No inspection or modification outside the exact read scope.
- No use of the protected paths beyond metadata.
- No automatic invoice creation, issuance, delivery-date inference, estimate status change, or document generation.

## Required result

Return exactly one report headed:

`GDA_ESTIMATE_DETAIL_DOCUMENTS_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

Include:

- `VERDICT=READY_FOR_IMPLEMENTATION_GOVERNANCE|CHANGES_REQUIRED_SCOPE|BLOCKED`
- exact root cause and call chain;
- state-by-state fail-closed behavior;
- exact recommended implementation/test allowlist;
- focused test commands for a later separately authorized verification gate;
- proof that no repository, Git, database, environment, or external state changed.

Post the report only to the active coordination Draft PR after Codex supplies its URL. Stop after posting.
