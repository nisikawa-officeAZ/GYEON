# Staging Deployment Checklist — Version 1.0 RC

**Project:** GYEON Detailer Agent (DealerOS)  
**Target:** Vercel Staging / Preview Environment  
**Requires CTO approval before production deployment.**

---

## 1. Environment Variables

Set the following in Vercel project settings (staging environment):

### Supabase

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Staging Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Staging anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — server-only, never expose to client |

Verification:
```bash
# Confirm anon key is NEXT_PUBLIC_ prefixed (accessible to browser)
# Confirm service role key has NO NEXT_PUBLIC_ prefix
```

### OpenAI

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Yes | Used for AI gateway and OCR features |
| `DEALER_AI_KEY_SECRET` | Yes | AES-256-GCM encryption key for per-dealer AI API key storage (32-byte hex) |

Verification:
```bash
# DEALER_AI_KEY_SECRET must be exactly 32 bytes (64 hex characters)
echo -n "$DEALER_AI_KEY_SECRET" | wc -c  # expect 64
```

### LINE Integration

| Variable | Required | Notes |
|----------|----------|-------|
| `LINE_CHANNEL_SECRET` | Yes (Pro Plus) | LINE Messaging API channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Yes (Pro Plus) | LINE Messaging API long-lived token |
| `NEXT_PUBLIC_LIFF_ID` | Yes (Pro Plus) | LINE LIFF app ID for customer-facing flow |
| `LINE_WEBHOOK_URL` | Yes (Pro Plus) | Full URL: `https://<staging-domain>/api/line/webhook` |

Note: If staging does not test LINE features, set placeholder values. LINE features are behind `FeatureGate feature="line"` (Pro Plus only).

### Cron

| Variable | Required | Notes |
|----------|----------|-------|
| `CRON_SECRET` | Yes | Random secret for `POST /api/admin/cron/downgrade-trials` — `Authorization: Bearer <secret>` |

Generation:
```bash
openssl rand -hex 32
```

### App URL

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_APP_URL` | Yes | Full staging URL, e.g. `https://gyeon-staging.vercel.app` |

---

## 2. Supabase Database — Migration Verification

Confirm the following migrations have been applied to the **staging** Supabase project:

```sql
-- Verify migration 080: 'pending' subscription status
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'dealers_subscription_status_check';
-- Expected: includes 'pending'

-- Verify migration 081: 'suspended' subscription status
-- Expected: includes 'suspended'
```

Migrations to apply if not yet applied:

| Migration | File | Purpose |
|-----------|------|---------|
| 080 | `supabase/migrations/080_subscription_status_pending.sql` | Adds `'pending'` to subscription status CHECK |
| 081 | `supabase/migrations/081_subscription_status_suspended.sql` | Adds `'suspended'` to subscription status CHECK |

**Do NOT modify migration files. Apply via Supabase SQL Editor only.**

---

## 3. Supabase Storage Buckets

| Bucket | Access | Required for |
|--------|--------|-------------|
| `completion-reports` | Private (signed URLs) | Completion report file attachments |
| `ocr-uploads` | Private | OCR vehicle registration scan uploads |
| `line-media` | Private | LINE message media (Pro Plus) |

Verification:
1. Open Supabase Dashboard → Storage
2. Confirm buckets exist with correct RLS policies
3. Confirm public access is disabled on all buckets

---

## 4. Supabase RLS Verification

```sql
-- Confirm RLS is enabled on all dealer tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'dealers', 'dealer_members', 'customers', 'vehicles',
    'estimates', 'estimate_items', 'work_orders', 'completion_reports',
    'invoices', 'invoice_items', 'payments', 'product_orders',
    'product_order_items', 'reservations', 'maintenance_reminders',
    'activity_logs', 'notifications'
  );
-- Expected: rowsecurity = true for all rows
```

---

## 5. Admin Account Setup

### Super Admin
```sql
-- Create Super Admin (run in Supabase SQL Editor after creating auth user)
INSERT INTO admin_users (user_id, email, name, role, is_active)
VALUES (
  '<auth-user-uuid>',
  'admin@gyeon.jp',
  'GYEON Super Admin',
  'super_admin',
  true
);
```

### GYEON Admin (optional for staging)
```sql
INSERT INTO admin_users (user_id, email, name, role, is_active)
VALUES (
  '<auth-user-uuid>',
  'gyeon@gyeon.jp',
  'GYEON Admin',
  'gyeon_admin',
  true
);
```

Verification:
- Log in as Super Admin at `/admin/login`
- Confirm Dealer Approval Center is accessible
- Confirm User Management is accessible
- Confirm Audit Log is accessible

---

## 6. First Dealer Test Account Setup

1. Navigate to `/signup` on staging
2. Register with test business name and email
3. Log in as Super Admin → `/admin/dealers`
4. Approve the test dealer (30-day Pro Plus trial)
5. Log out of admin
6. Log in as test dealer
7. Confirm:
   - Dashboard loads
   - Trial banner shows remaining days
   - All Pro Plus features accessible
   - Sidebar navigation renders correctly

---

## 7. Build Verification

```bash
npm run build
# Expected: ✓ Compiled successfully
# Expected: 0 errors
```

Note: `npm run lint` and `npm run typecheck` scripts do not exist in this project. TypeScript type checking is performed implicitly by `npm run build` via Next.js's built-in type checking.

---

## 8. Cron Job Configuration (Vercel)

Add to `vercel.json` (or configure in Vercel Dashboard → Cron Jobs):

```json
{
  "crons": [
    {
      "path": "/api/admin/cron/downgrade-trials",
      "schedule": "0 17 * * *"
    }
  ]
}
```

Schedule: `0 17 * * *` = 02:00 JST daily (17:00 UTC).

The cron request must include:
```
Authorization: Bearer <CRON_SECRET>
```

Verify cron works:
```bash
curl -X POST https://<staging-domain>/api/admin/cron/downgrade-trials \
  -H "Authorization: Bearer <CRON_SECRET>"
# Expected: {"ok":true,"downgraded":0,"errors":[],"ts":"..."}
```

---

## 9. Smoke Test Checklist

Execute in order after deployment:

### Auth Flow
- [ ] `/signup` — register new dealer → redirected to `/signup/pending`
- [ ] `/login` — login with pending dealer → redirected to `/no-dealer` (pending message shown)
- [ ] `/admin/login` — login as Super Admin → admin dashboard shown
- [ ] Admin → approve test dealer (30-day Pro Plus trial)
- [ ] Dealer login → dashboard shown, trial banner shows "残り30日"

### Core Workflow
- [ ] Create customer
- [ ] Create vehicle linked to customer
- [ ] Create estimate → confirm auto-numbered (EST-001)
- [ ] View estimate PDF at `/pdf?estimateId=<id>`
- [ ] Create work order from estimate
- [ ] Create completion report from work order
- [ ] Create invoice → confirm Pro feature gated on Basic plan
- [ ] Create payment → confirm `recalculateInvoicePayment()` updates balance_due
- [ ] Create maintenance reminder
- [ ] Create reservation → confirm calendar entry visible

### Plan Gating
- [ ] Downgrade test dealer to Basic plan in Supabase
- [ ] Confirm work_orders page shows "この機能は利用できません"
- [ ] Confirm invoices page shows "この機能は利用できません"
- [ ] Confirm products and estimates remain accessible on Basic

### Suspension Flow
- [ ] Admin → suspend test dealer
- [ ] Attempt dealer login → `/no-dealer` shows "アカウントが停止されています"
- [ ] Admin → reactivate dealer → dealer can log in again

### Trial Auto-Downgrade
- [ ] Manually set `trial_end_date` to yesterday in Supabase for test dealer
- [ ] POST to cron endpoint with `CRON_SECRET`
- [ ] Confirm dealer plan downgraded to Basic, `trial_status = 'ended'`
- [ ] Confirm trial banner shows "Basicプランへ移行済み"

### Admin Security
- [ ] Log in as GYEON Admin → confirm Dealer Approval Center accessible
- [ ] Confirm GYEON Admin cannot access User Management (`/admin/users`)
- [ ] Log in as Logistics Admin → confirm no access to Dealer Approval Center
- [ ] Attempt to create Super Admin via GYEON Admin → confirm blocked (type guard)

---

## 10. Pre-Production Gate

Before promoting staging → production:

- [ ] All smoke test items checked
- [ ] CTO has reviewed `VERSION_1_0_RC_ACCEPTANCE_REPORT.md`
- [ ] CTO has approved production deployment
- [ ] Production Supabase migrations 080 and 081 applied
- [ ] Production environment variables set
- [ ] DNS / custom domain configured
- [ ] Vercel production deployment confirmed

**Do NOT deploy to production without CTO approval.**
