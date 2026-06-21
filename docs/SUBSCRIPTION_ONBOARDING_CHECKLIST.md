# Subscription & Onboarding Release Checklist — DealerOS / GYEON Detailer Agent

## Purpose

Verify subscription plan feature gates and dealer onboarding flow work correctly before production deployment.

---

## Part A: Subscription Plans

### 1. Database Setup

```sql
-- Verify subscription_plans seeded correctly
SELECT code, name, monthly_price, sort_order FROM subscription_plans ORDER BY sort_order;
-- Expected 3 rows:
--   basic    | ベーシック  | 0      | 1
--   pro      | プロ        | 12000  | 2
--   pro_plus | プロプラス  | 0      | 3
```

```
□ subscription_plans table exists and has 3 records
□ basic plan: monthly_price = 0
□ pro plan: monthly_price = 12000
□ pro_plus plan: monthly_price = 0 (or set correctly)
□ dealer_subscriptions table exists
```

---

### 2. Feature Gate Tests

Test with accounts on each plan level:

**Basic Plan:**
```
□ /customers — accessible
□ /vehicles — accessible
□ /estimates — accessible
□ /work-orders — shows FeatureLocked (Pro required)
□ /invoices — shows FeatureLocked (Pro required)
□ /reservations — shows FeatureLocked (Pro required)
□ /maintenance — shows FeatureLocked (Pro required)
□ /line — shows FeatureLocked (Pro Plus required)
```

**Pro Plan:**
```
□ /customers — accessible
□ /vehicles — accessible
□ /estimates — accessible
□ /work-orders — accessible
□ /invoices — accessible
□ /reservations — accessible
□ /maintenance — accessible
□ /line — shows FeatureLocked (Pro Plus required)
```

**Pro Plus Plan:**
```
□ All pages accessible
□ /line — accessible
```

---

### 3. Subscription Status Display

```
□ /settings shows SubscriptionStatusCard
□ Plan name displayed correctly (ベーシック / プロ / プロプラス)
□ Status badge shows correct color (active=green, trial=blue, past_due=amber, suspended/cancelled=red)
□ Trial expiry warning shown when ≤7 days remaining
□ Period expiry warning shown when ≤14 days remaining
□ Upgrade prompt shown for Basic → Pro
□ Upgrade prompt shown for Pro → Pro Plus
```

---

### 4. Admin Subscription Management

```
□ /admin/subscriptions page loads
□ All dealers listed with their plan/status
□ Edit modal: can change plan, status, dates, notes
□ Trial Extend modal: sets new trial_ends_at date
□ Note modal: saves internal admin notes
□ All changes logged to admin_audit_logs
□ Plan change syncs dealers.plan column (legacy field)
□ Suspension flow: status set to 'suspended', feature access denied
```

---

### 5. Subscription Sync

When a dealer's subscription is updated via admin:

```
□ dealer_subscriptions record created/updated
□ dealers.plan column updated to match (via upsertDealerSubscription)
□ dealers.subscription_status updated
□ audit log written (action: 'subscription_updated')
□ admin_audit_logs record written (action: 'subscription_updated')
```

---

## Part B: Dealer Onboarding

### 6. First-Login Redirect

```
□ New dealer (no dealer_settings) is redirected from / to /onboarding
□ Dealer with onboarding_step=1, completed=false is redirected to /onboarding
□ Dealer with onboarding_step>1, completed=false is NOT redirected (stays on /)
□ Dealer with completed=true is NOT redirected to /onboarding
□ Migration 059 not applied: redirect check fails gracefully (no redirect, no error)
```

---

### 7. Onboarding Wizard Steps

```
□ Step 1 — Basic Info: saves business_name, phone, email, address, website, logo_url
□ Step 2 — Staff: shows current staff list, links to /settings/staff
□ Step 3 — Subscription: shows current plan and status
□ Step 4 — Estimates: saves tax_rate, terms_and_conditions
□ Step 5 — LINE: shows LINE config (requires Pro Plus), saves line_enabled, line_liff_id, webhook_url
□ Step 6 — PDF Settings: saves stamp_url, pdf_footer, invoice_note, completion_note
□ Step 7 — Finish: shows completion summary, "完了する" button
```

---

### 8. Onboarding Navigation

```
□ "次へ" (Next) saves current step data and advances
□ "戻る" (Back) navigates to previous step without saving
□ "このステップをスキップ" skips current step without saving
□ "後で続ける" sets onboarding_step=8, redirects to dashboard
□ Dashboard shows OnboardingCard for dealers with step<8, completed=false
□ "完了する" on Step 7 sets onboarding_completed=true, redirects to dashboard
□ Dashboard OnboardingCard hidden after completion
```

---

### 9. Skip / Resume Flow

```
□ "後で続ける" (skip): onboarding_step=8, completed=false
□ Dashboard OnboardingCard shows "セットアップ開始" for skipped state
□ Clicking card link returns to /onboarding
□ /onboarding for skipped dealer: starts from step 1 (not step 8)
□ Completing from skipped state: sets onboarding_completed=true
```

---

### 10. Onboarding Audit & Notifications

```
□ Step saves logged to audit_logs (action='onboarding_step_completed')
□ Onboarding completion logged to audit_logs (action='onboarding_completed')
□ Welcome notification created on completion (visible in notification bell)
□ Notifications are fire-and-forget (do not block wizard navigation)
```

---

### 11. Existing Dealers After Migration 059

```
□ Migration 059 ran UPDATE: all existing dealers have onboarding_completed=true
□ Existing dealers are NOT redirected to /onboarding
□ Existing dealers do NOT see OnboardingCard on dashboard
□ POST-migration row check: SELECT count(*) FROM dealer_settings WHERE onboarding_completed=false; — expected 0
```

---

## See Also

- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/MIGRATION_APPLICATION_ORDER.md`
- `supabase/migrations/058_subscription_license_management.sql`
- `supabase/migrations/059_dealer_onboarding.sql`
- `src/lib/subscription/subscription.ts`
- `src/lib/onboarding/onboarding.ts`
