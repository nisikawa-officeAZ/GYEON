# Claude directive — GDA-SAVED-DELIVERY-NOTE-R1 read-only diagnosis

## Identity

- Phase: `GDA-SAVED-DELIVERY-NOTE-R1`
- Directive marker: `GDA_SAVED_DELIVERY_NOTE_R1_READ_ONLY_DIAGNOSIS_V1`
- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Base commit: `449d26c3ec5879e19e028471931b51cc707f60eb`
- Base tree: `1a2a0cab42d097e96d9d3e4ca69da34803c8c249`
- Responsible agent: MacBook Claude, diagnosis only

## Owner-approved product outcome

After an estimate is saved, the same saved-estimate surface must allow an operator to display the
estimate PDF, issue or reopen its invoice, and display a delivery-note PDF. The delivery note must
be derived read-only from the already-issued invoice. Its authoritative date is the invoice's
persisted `delivery_date`; no work order is required. The action must not issue or mutate an
invoice, record payment, create a delivery-note database row, write Storage, or resave the estimate.

## Known diagnosis that must be independently checked

1. The existing delivery-note route and renderer are present.
2. The loader currently requires `work_order_id` and `work_orders.actual_end_at`, although the
   accepted invoice flow already requires and persists `invoices.delivery_date` before issuance.
3. The delivery-number adapter accepts only `INV-YYYY-NNNNN`, while production currently allocates
   `INV-NNNNN` (for example `INV-00001`).
4. The saved-estimate surface still exposes a permanently disabled delivery-note control.
5. The invoice detail action still gates delivery-note display on a work-order completion date.

## Literal read-only scope

- `src/components/estimates/wizard/production/SavedEstimateDocuments.tsx`
- `src/components/estimates/wizard/production/SavedEstimateDocuments.test.tsx`
- `src/components/estimates/wizard/production/SavedEstimateInvoice.tsx`
- `src/components/estimates/wizard/production/saved-estimate-invoice-controller.ts`
- `src/components/estimates/wizard/production/saved-invoice-issuance.test.tsx`
- `src/components/invoices/InvoicePdfIssueActions.tsx`
- `src/components/invoices/InvoiceDetail.tsx`
- `src/lib/invoices/invoice-types.ts`
- `src/lib/invoices/invoice-delivery-date.ts`
- `src/lib/pdf/get-delivery-note-pdf-data.ts`
- `src/lib/pdf/delivery-note-document-data.ts`
- `src/lib/pdf/render-delivery-note-document.tsx`
- `src/lib/pdf/__tests__/template-c2/delivery-note-binding-boundary.test.ts`
- `src/app/pdf/delivery-note/route.ts`
- `src/app/pdf/delivery-note/route.test.ts`
- `supabase/migrations/20260913163712_atomic_estimate_invoice_conversion.sql`

## Candidate implementation allowlist for a later, separately authorized repair

- `src/components/estimates/wizard/production/SavedEstimateDocuments.tsx`
- `src/components/estimates/wizard/production/SavedEstimateDocuments.test.tsx`
- `src/components/estimates/wizard/production/SavedEstimateInvoice.tsx`
- `src/components/estimates/wizard/production/saved-invoice-issuance.test.tsx`
- `src/components/invoices/InvoicePdfIssueActions.tsx`
- `src/components/invoices/InvoiceDetail.tsx`
- `src/lib/invoices/invoice-types.ts`
- `src/lib/pdf/get-delivery-note-pdf-data.ts`
- `src/lib/pdf/delivery-note-document-data.ts`
- `src/lib/pdf/__tests__/template-c2/delivery-note-binding-boundary.test.ts`

## Required diagnosis result

Return exactly one result headed by `GDA_SAVED_DELIVERY_NOTE_R1_READ_ONLY_DIAGNOSIS_RESULT_V1` and
include:

- PASS or CHANGES_REQUIRED;
- confirmation or correction of each known diagnosis item;
- the exact minimal implementation allowlist;
- whether any migration, Supabase apply, Storage write, dependency change, environment change, or
  generated artifact is required;
- exact candidate verification commands and expected test counts;
- security review of request-scope authentication, caller-scoped RLS, explicit invoice/dealer
  filters, soft-delete exclusion, allowed invoice statuses, strict date/number validation, coarse
  foreign-tenant responses, and absence of service-role use;
- any conflict with the owner-approved outcome or accepted invoice immutability boundary.

## Prohibitions

This directive authorizes no file change, test execution, dependency installation, Git mutation,
database or Supabase access, Storage action, provider action, deployment, or external message. Do
not open, read, diff, copy, stage, or modify
`src/components/estimates/wizard/screens/ScreensPreview.tsx`. The other protected paths remain
untouched. Stop after the read-only diagnosis result.
