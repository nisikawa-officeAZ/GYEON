# PDF Generation Release Checklist — DealerOS / GYEON Detailer Agent

## Purpose

Verify PDF generation works correctly for all document types before production deployment.

---

## 1. Next.js Configuration

```typescript
// next.config.ts — must contain:
serverExternalPackages: ['@react-pdf/renderer']
```

```
□ @react-pdf/renderer in serverExternalPackages in next.config.ts
□ PDF package NOT included in client bundle (server-only rendering)
```

---

## 2. PDF Generation — All Document Types

Test each document type end-to-end:

```
□ Estimate PDF
  □ Renders without errors
  □ Correct dealer name, address, phone
  □ Customer name and vehicle info displayed
  □ Line items with quantities and prices
  □ Subtotal, tax rate, total calculated correctly
  □ Estimate number displayed (auto-numbered)
  □ Japanese text renders correctly (no tofu/boxes)

□ Work Order PDF
  □ Renders without errors
  □ Work order number displayed
  □ Assigned staff shown
  □ Scheduled date shown
  □ Japanese text renders correctly

□ Completion Report PDF
  □ Renders without errors
  □ Completion date shown
  □ Completion notes rendered
  □ Japanese text renders correctly

□ Invoice PDF
  □ Renders without errors
  □ Invoice number displayed
  □ Payment due date shown
  □ Tax breakdown correct (taxable / non-taxable)
  □ Invoice note rendered (from dealer_settings.invoice_note)
  □ Japanese text renders correctly

□ Product Order PDF
  □ Renders without errors
  □ GYEON product line items displayed
  □ Quantities and prices correct
  □ Japanese text renders correctly
```

---

## 3. Dealer Info in PDFs

All PDFs must pull dealer info from `dealer_settings`:

```
□ business_name appears in PDF header
□ business_address appears in PDF
□ business_phone appears in PDF
□ business_email appears in PDF (if set)
□ logo_url renders logo image (if set)
□ stamp_url renders stamp image (if set)
□ pdf_footer text appears in footer (if set)
```

---

## 4. Tax Calculation

```
□ tax_rate from dealer_settings is applied (default: 10%)
□ Tax amount calculated correctly: total_amount * tax_rate / 100
□ Tax-exclusive and tax-inclusive totals displayed where applicable
□ Estimate items respect individual taxable flag (if applicable)
```

---

## 5. Document Auto-Numbering

```
□ Estimate numbers: EST-YYYY-NNNN format
□ Invoice numbers: INV-YYYY-NNNN format
□ Work order numbers: WO-YYYY-NNNN format
□ Numbers are unique per dealer (not global)
□ document_sequences table increments correctly
□ No duplicate numbers issued (even under concurrent generation)
```

---

## 6. File Storage

```
□ PDF saved to Supabase Storage at {dealer_id}/{type}/{filename}.pdf
□ document_files record created/updated
□ Signed URL returned and works
□ PDF file size < 2 MB for typical documents
□ Old versions archived (is_active = false)
```

---

## 7. Audit Logging

```
□ PDF generation logged to audit_logs (action = 'pdf_generated')
□ Log includes document_type and document_id
□ Log is fire-and-forget (does not block PDF response)
```

---

## 8. Error Handling

```
□ If PDF generation fails, user sees clear error message
□ Failed generation does not leave orphaned Storage files
□ Failed generation does not create document_files record
□ Error is logged to Vercel function logs
```

---

## 9. Japanese Text / Font Rendering

```
□ Japanese characters render correctly (no tofu boxes)
□ Font is embedded in PDF (not system font dependent)
□ Mixed Japanese/English text renders on same line
□ Long Japanese text wraps correctly
□ Table cells with Japanese text align properly
```

---

## See Also

- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/STORAGE_VERIFICATION_CHECKLIST.md`
- `supabase/migrations/046_create_document_sequences.sql`
- `supabase/migrations/053_create_document_files.sql`
