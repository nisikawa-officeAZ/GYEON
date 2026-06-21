# Staging Smoke Test Checklist — DealerOS / GYEON Detailer Agent

## Purpose

End-to-end functional verification on the staging environment after all migrations are applied.
Run this checklist with a Pro plan test dealer (e.g., GYEON Test Osaka).

> Staging URL: set in `.env.local` / Vercel Preview environment
> Use: `owner-a@gyeon-test.local` (Pro plan, GYEON Test Osaka)

---

## 1. Login

```
□ Navigate to /login
□ Enter owner-a@gyeon-test.local and password
□ Click "ログイン"
□ Redirected to /onboarding (if first login) or / (if already completed)
□ No 500 error or blank screen
```

---

## 2. Onboarding Wizard

> Skip this if onboarding already completed. If first login, verify full wizard.

```
□ Step 1 — Basic Info:
  □ Enter business name: GYEON Test Osaka
  □ Enter phone, email, address
  □ Click "次へ" — advances to Step 2

□ Step 2 — Staff:
  □ Staff list renders without error
  □ Link to /settings/staff shown
  □ Click "次へ" — advances to Step 3

□ Step 3 — Subscription:
  □ Plan name shown (プロ)
  □ Click "次へ" — advances to Step 4

□ Step 4 — Estimates:
  □ Tax rate field shown (default: 10%)
  □ Click "次へ" — advances to Step 5

□ Step 5 — LINE:
  □ FeatureLocked shown (Pro Plus required for LINE)  -- OR LINE fields if Pro Plus
  □ Click "次へ" — advances to Step 6

□ Step 6 — PDF Settings:
  □ PDF footer field shown
  □ Click "次へ" — advances to Step 7

□ Step 7 — Finish:
  □ Completion summary shown
  □ Click "完了する"
  □ Redirected to /
  □ Dashboard loads without error
  □ OnboardingCard hidden (completed)
```

---

## 3. Customer Create

```
□ Navigate to /customers
□ Click "新規顧客" or "+"
□ Enter:
  Name: テスト顧客スモーク
  Email: smoke@gyeon-test.local
  Phone: 06-9999-9999
□ Click "保存"
□ Customer appears in customer list
□ Customer detail page opens
□ No 500 error
```

---

## 4. Vehicle Create

```
□ From customer detail, click "車両追加" or navigate to /vehicles
□ Enter:
  Make: トヨタ
  Model: クラウン
  Year: 2024
  Plate: テスト 300 ス 0001
□ Click "保存"
□ Vehicle appears in vehicle list
□ Vehicle linked to smoke test customer
```

---

## 5. Estimate Create

```
□ Navigate to /estimates → "新規見積書"
□ Select smoke test customer and vehicle
□ Add line item:
  Description: スモークテストコーティング
  Quantity: 1
  Unit price: 50000
□ Verify subtotal and tax calculated correctly
□ Click "保存"
□ Estimate number auto-generated (e.g., EST-2026-0001)
□ Estimate appears in estimate list
□ Estimate detail page opens
```

---

## 6. Estimate PDF Preview

```
□ From estimate detail, click "プレビュー" or "PDF確認"
□ PDF preview renders in browser
□ No blank page or error
□ Dealer name (GYEON Test Osaka) visible
□ Customer name visible
□ Line items visible
□ Tax total calculated correctly
□ Japanese text renders without tofu (□) boxes
```

---

## 7. Estimate PDF Generation (Real File)

```
□ From estimate detail, click "PDFを生成" or "PDF保存"
□ Loading indicator shown during generation
□ Success: PDF download link or preview shown
□ document_files record created (verify in Supabase Dashboard or SQL)
□ PDF accessible via signed URL (link works in browser)
□ File size reasonable (< 2 MB)
□ Audit log entry created (action = 'generate_pdf')
```

---

## 8. Work Order Create

```
□ Navigate to /work-orders → "新規作業指示書"
□ Select the estimate created in step 5 (or create independently)
□ Set scheduled date to today
□ Assign staff (if available)
□ Click "保存"
□ Work order number auto-generated
□ Work order appears in list
□ Work order detail page opens
```

---

## 9. Completion Report Create

```
□ From work order detail, click "完了報告書を作成"
□ Enter completion notes: スモークテスト完了
□ Click "保存"
□ Completion report created and linked to work order
□ Completion report detail page opens
□ PDF generation works (optional: generate PDF)
```

---

## 10. Invoice Create

```
□ Navigate to /invoices → "新規請求書"
□ Link to work order or completion report
□ Verify line items pulled from estimate
□ Set due date
□ Click "保存"
□ Invoice number auto-generated (e.g., INV-2026-0001)
□ Invoice appears in list
□ Invoice PDF generation works
```

---

## 11. Payment Create

```
□ From invoice detail, click "入金を記録"
□ Enter payment amount (partial or full)
□ Select payment method (現金, 振込, etc.)
□ Click "保存"
□ Payment record appears in invoice detail
□ Invoice balance updated correctly
□ Full payment: invoice status changes to 入金済み
```

---

## 12. Reservation Create

```
□ Navigate to /reservations (Pro plan required)
□ Click "新規予約"
□ Select customer and vehicle
□ Set date and time
□ Click "保存"
□ Reservation appears in calendar view
□ Reservation detail page opens
```

---

## 13. Notification Appears

```
□ After completing onboarding, check notification bell (top-right or nav)
□ Welcome notification visible: "セットアップ完了しました"
□ Notification list renders without error
□ Clicking notification marks it read (or navigates)
```

---

## 14. Activity Timeline Appears

```
□ Navigate to customer detail page
□ Activity timeline section visible
□ Recent actions (estimate created, invoice created, etc.) logged
□ Timeline renders without error
□ Timestamps correct (JST or displayed correctly)
```

---

## 15. Audit Log Records

```
□ Navigate to /admin/audit (as Super Admin)
□ Recent actions visible:
  □ generate_pdf logged for estimate PDF
  □ create logged for customer, vehicle, estimate, work order, invoice
  □ onboarding_completed logged
□ Filter by action type works
□ Filter by date range works
□ CSV export works (optional)
```

---

## 16. Subscription Gate Works

Using a **Basic plan** test account (owner-b@gyeon-test.local):

```
□ /work-orders → FeatureLocked screen shown
□ /invoices → FeatureLocked screen shown
□ /reservations → FeatureLocked screen shown
□ /maintenance → FeatureLocked screen shown
□ /line → FeatureLocked screen shown (Pro Plus required)
□ FeatureLocked shows correct plan requirement label
□ FeatureLocked shows link to /settings
```

---

## 17. LINE Settings Page Loads

Using Pro plan account (Owner A):

```
□ Navigate to /line
□ FeatureLocked shown (Pro Plus required)  -- OR LINE dashboard if Pro Plus
□ No 500 error
□ Page renders completely
```

---

## 18. Health Dashboard Loads

```
□ Navigate to /admin (as Super Admin)
□ SystemHealthCard visible
□ All health indicators green (or amber/red with clear reason)
□ No unhandled errors on the page
□ Supabase connectivity shown as healthy
```

---

## 19. Release Readiness Page Loads

```
□ Navigate to /admin/release-readiness (as Super Admin)
□ Release Readiness panel loads without error
□ Checks run successfully
□ Environment vars section shows current state
□ Database section shows tables accessible
□ Subscription plans section shows 3 plans
□ Overall status shown: "READY" / "WARNING" / "BLOCKED"
□ No check crashes or shows blank status
```

---

## 20. Migration Status Page Loads

```
□ Navigate to /admin/migration-status (as Super Admin)
□ Migration list loads without error
□ Expected migrations listed
□ Schema verification status shown for each
□ No "Apply" button present (read-only only)
□ Warning banner: "Migrations must be applied manually in Supabase SQL Editor"
```

---

## Pass Criteria

All 20 tests must complete without:
- 500 Internal Server Error
- Blank page / white screen
- TypeScript runtime errors in browser console
- Supabase query errors in Vercel function logs
- Missing or garbled Japanese text in PDFs

---

## See Also

- `docs/STAGING_TEST_DEALER_GUIDE.md`
- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md`
- `docs/PRODUCTION_READINESS_CHECKLIST.md`
