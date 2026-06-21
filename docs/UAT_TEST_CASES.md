# UAT Test Cases — DealerOS / GYEON Detailer Agent

## Purpose

This document defines test cases for UAT participants to execute during the staging trial.
UAT is conducted on the STAGING environment only.

Each test case includes steps, expected result, and a space to record actual result and rating.

---

## How to Record Results

For each test case:
1. Perform the steps on the staging URL
2. Note the actual result
3. Rate your experience: 1 (very poor) → 5 (excellent)
4. Submit feedback via the admin feedback form or the UAT Feedback Template

---

## TC-01: Login

**Category**: Auth

**Steps:**
1. Navigate to staging URL
2. Enter your test account email and password
3. Click "ログイン"

**Expected Result:**
- Redirected to dashboard or /onboarding (first login)
- No error messages
- User name/email visible

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-02: Customer Create

**Category**: Customer Management

**Steps:**
1. Navigate to /customers
2. Click "新規顧客" or "+"
3. Enter: name, email, phone
4. Click "保存"

**Expected Result:**
- Customer appears in customer list
- Customer detail page opens
- All entered data visible

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-03: Vehicle Create

**Category**: Vehicle Management

**Steps:**
1. Navigate to customer detail
2. Click "車両追加"
3. Enter: make, model, year, plate number
4. Click "保存"

**Expected Result:**
- Vehicle appears linked to customer
- Vehicle detail page opens

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-04: Estimate Create

**Category**: Estimate

**Steps:**
1. Navigate to /estimates → "新規見積書"
2. Select customer and vehicle
3. Add at least 2 line items with quantity and price
4. Click "保存"

**Expected Result:**
- Estimate number auto-generated (EST-YYYY-NNNN)
- Subtotal, tax, and total calculated correctly
- Estimate visible in list

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-05: Estimate PDF

**Category**: PDF Generation

**Steps:**
1. Open estimate created in TC-04
2. Click "PDFプレビュー"
3. Review the PDF in browser
4. Click "PDF生成" to create the actual file

**Expected Result:**
- PDF renders all line items
- Dealer name, address, phone visible
- Japanese text displays correctly (no □ boxes)
- Total / tax correct
- PDF downloadable via link

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-06: Invoice

**Category**: Invoice

**Steps:**
1. Navigate to /invoices → "新規請求書"
2. Link to existing work order or estimate
3. Set due date
4. Click "保存"
5. Generate Invoice PDF

**Expected Result:**
- Invoice number auto-generated (INV-YYYY-NNNN)
- Invoice PDF renders correctly
- Invoice visible in list

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-07: Payment Record

**Category**: Payment

**Steps:**
1. Open invoice from TC-06
2. Click "入金を記録"
3. Enter amount and payment method
4. Click "保存"

**Expected Result:**
- Payment appears in invoice detail
- Invoice balance updates
- Full payment → invoice status changes to 入金済み

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-08: Work Order Create

**Category**: Work Order

**Steps:**
1. Navigate to /work-orders → "新規作業指示書"
2. Select customer, vehicle, and estimate
3. Set scheduled date
4. Click "保存"

**Expected Result:**
- Work order number auto-generated
- Work order appears in list
- PDF generation available

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-09: Completion Report Create

**Category**: Completion Report

**Steps:**
1. Open work order from TC-08
2. Click "完了報告書を作成"
3. Enter completion notes
4. Click "保存"

**Expected Result:**
- Completion report created and linked
- PDF generation works
- Work order status updated

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-10: Reservation

**Category**: Reservation

*Requires Pro plan.*

**Steps:**
1. Navigate to /reservations
2. Click "新規予約"
3. Select customer, vehicle, date, time
4. Click "保存"

**Expected Result:**
- Reservation appears in calendar/list
- Customer and vehicle linked correctly

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-11: LINE Integration

**Category**: LINE Integration

*Requires Pro Plus plan and LINE configuration.*

**Steps:**
1. Navigate to /line
2. Verify LINE settings visible
3. Send a test message to a linked LINE user
4. Verify message received in LINE app

**Expected Result:**
- LINE settings page loads
- Test message sent successfully
- Message log entry created
- Failed send creates error log

**Rating:** ___ / 5  
**Actual Result:** _________________________________  
**Skip if not applicable:** □

---

## TC-12: Notification

**Category**: Notification

**Steps:**
1. Complete onboarding (or verify it was completed)
2. Check the notification bell/list in the app
3. Verify welcome notification appears

**Expected Result:**
- Welcome notification visible: "セットアップ完了しました"
- Notification list renders
- Clicking marks as read

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-13: Activity Timeline

**Category**: Activity Timeline

**Steps:**
1. Open a customer detail page
2. Scroll to the activity timeline section

**Expected Result:**
- Recent actions listed (estimate created, invoice created, etc.)
- Timestamps shown correctly
- No errors

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-14: Subscription Feature Gates

**Category**: Subscription

*Test with a Basic plan account.*

**Steps:**
1. Log in as a Basic plan dealer
2. Navigate to /work-orders
3. Navigate to /invoices
4. Navigate to /line

**Expected Result:**
- /work-orders → FeatureLocked screen (Pro required)
- /invoices → FeatureLocked screen (Pro required)
- /line → FeatureLocked screen (Pro Plus required)
- Upgrade prompt shown with plan name

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-15: Onboarding Flow

**Category**: Onboarding

*Test with a brand-new account (no prior configuration).*

**Steps:**
1. Log in as a new test account
2. Follow the onboarding wizard steps 1–7
3. Complete onboarding

**Expected Result:**
- Redirected to /onboarding on first login
- All 7 steps accessible
- Skip ("後で続ける") works — returns to dashboard
- Complete ("完了する") → dashboard shows, OnboardingCard hidden

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-16: Audit Log

**Category**: Audit

*Requires Super Admin access.*

**Steps:**
1. Log in as Super Admin
2. Navigate to /admin/audit
3. Review recent entries
4. Filter by action type (PDF generation)

**Expected Result:**
- Audit entries visible for actions performed in TC-04 through TC-09
- Filter by action type works
- CSV export works

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-17: Health Dashboard

**Category**: Health

*Requires Super Admin access.*

**Steps:**
1. Navigate to /admin
2. Locate SystemHealthCard
3. Review all health indicators

**Expected Result:**
- Supabase: Healthy
- Storage: Healthy
- No red indicators (unless expected)

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## TC-18: Release Readiness

**Category**: Release Readiness

*Requires Super Admin access.*

**Steps:**
1. Navigate to /admin/release-readiness
2. Review check results

**Expected Result:**
- Page loads without error
- Environment checks visible
- Overall status: READY or WARNING
- No BLOCKED status after all migrations applied

**Rating:** ___ / 5  
**Actual Result:** _________________________________

---

## Summary Ratings

After completing all test cases, record overall ratings:

| Feature Area | Rating (1–5) | Key Issues |
|---|---|---|
| Login / Auth | | |
| Customer / Vehicle | | |
| Estimate | | |
| PDF Generation | | |
| Work Order / Completion | | |
| Invoice / Payment | | |
| Reservation | | |
| LINE Integration | | |
| Subscription Gates | | |
| Onboarding | | |
| Notifications | | |
| Admin / Audit | | |
| **Overall** | | |

---

## See Also

- `docs/UAT_FEEDBACK_TEMPLATE.md` — feedback submission format
- `docs/UAT_KNOWN_LIMITATIONS.md` — known staging limitations
- `docs/UAT_EXIT_CRITERIA.md` — what determines UAT pass/fail
