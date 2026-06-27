# RC-20 — Pre-RC Manual Setup Guide

**Version:** 1.0 RC  
**Date:** 2026-06-27  
**Audience:** CTO / DevOps  
**Prerequisite:** RC-19 database deployment complete (all 43 migrations applied)

---

## PART 1 — Supabase Storage Buckets

### Buckets to Create

Navigate to: **Supabase Dashboard → Storage → New Bucket**

Create exactly **3 buckets** in this order:

| # | Bucket Name | Public | Purpose |
|---|---|---|---|
| 1 | `documents` | **No (Private)** | PDF files — estimates, invoices, completion reports, product orders |
| 2 | `work-order-files` | **No (Private)** | Work order photos and video files (max 20 MB per file) |
| 3 | `vehicle-registration-documents` | **No (Private)** | Vehicle registration OCR source images (1-hour signed URLs) |

> **Note:** `completion-reports` and `ocr-uploads` are NOT separate buckets.
> Completion report PDFs upload to `documents`. OCR images upload to `vehicle-registration-documents`.
> This is confirmed in source: `generate-pdf-and-upload.ts`, `storage.ts`.

### Bucket Settings (apply to all 3)

- **Public bucket:** OFF
- **File size limit:** 50 MB (work-order-files can set 20 MB if desired)
- **Allowed MIME types:** leave empty (enforced in application code)

### Storage Policies

All three buckets use **service_role only** access. The application always calls Supabase from server-side Server Actions using `createAdminClient()` (service role) or `createClient()` (user session with RLS). No bucket-level policies need to be created in the Dashboard — storage access is controlled entirely at the application layer.

> Do not enable public access policies on any bucket.

---

## PART 2 — Environment Variables Checklist

Set all variables in: **Vercel Dashboard → Project → Settings → Environment Variables**  
(or `.env.local` for local development only — never commit)

### 2-1 Supabase

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL. Found in: Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Public anon key. Found in: Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service role secret. Found in: Project Settings → API. **Never expose to client.** |

### 2-2 Application

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **Yes** | Production URL, e.g. `https://dealeros.vercel.app` — no trailing slash |
| `STORAGE_BUCKET` | Optional | Override default PDF bucket name. Default: `documents`. Leave unset unless bucket was named differently. |

### 2-3 OpenAI / AI Gateway

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | **Yes** | Standard OpenAI API key. Used for vehicle registration OCR (GPT-4o Vision). |
| `DEALER_AI_KEY_SECRET` | **Yes** | 64 hex characters (= 32 bytes). Used to AES-256-GCM encrypt dealer-provided API keys stored in `dealer_settings`. Generate with: `openssl rand -hex 32` |

### 2-4 LINE Messaging API

| Variable | Required | Description |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | **Yes** | Long-lived channel access token from LINE Developers console |
| `LINE_CHANNEL_SECRET` | **Yes** | Channel secret for webhook signature verification |
| `LINE_CHANNEL_ID` | **Yes** | Numeric channel ID |
| `NEXT_PUBLIC_LIFF_ID` | **Yes** | LIFF app ID (format: `1234567890-xxxxxxxx`) |

### 2-5 Cron / Scheduler

| Variable | Required | Description |
|---|---|---|
| `CRON_SECRET` | **Yes** | Arbitrary secret string. Sent as `Authorization: Bearer <CRON_SECRET>` by the scheduler. Generate with: `openssl rand -base64 32` |

### Vercel Cron Configuration

Add to `vercel.json` (or confirm already present):

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

Schedule `0 17 * * *` = 02:00 JST daily (UTC+9 offset).

---

## PART 3 — Super Admin Creation

### Step 1: Create Auth Account in Supabase

Navigate to: **Supabase Dashboard → Authentication → Users → Add User**

| Field | Value |
|---|---|
| Email | `nisikawa@office-az.com` |
| Password | Set a strong temporary password |
| Auto Confirm Email | **Yes** |

After creation, copy the **User UID** from the users list (UUID format).

### Step 2: Insert admin_users Record

Navigate to: **Supabase Dashboard → SQL Editor**

Replace `<AUTH_USER_UID_HERE>` with the UUID copied in Step 1.

```sql
INSERT INTO public.admin_users (
  user_id,
  email,
  name,
  role,
  status
)
VALUES (
  '<AUTH_USER_UID_HERE>',
  'nisikawa@office-az.com',
  'Nishikawa',
  'super_admin',
  'active'
)
ON CONFLICT (user_id) DO NOTHING;
```

### Step 3: Verify

```sql
SELECT id, user_id, email, name, role, status, created_at
FROM public.admin_users
WHERE email = 'nisikawa@office-az.com';
```

Expected result: 1 row, `role = 'super_admin'`, `status = 'active'`.

### Step 4: Set Permanent Password

Navigate to: **Supabase Dashboard → Authentication → Users**  
Find `nisikawa@office-az.com` → Reset password → set the production admin password.

> Security note: The `admin_users` table has `user_id = auth.uid()` self-select RLS only.
> INSERT was performed via service role (SQL Editor). No user-facing INSERT policy exists.

---

## PART 4 — RC Functional Test Checklist

Once all manual setup steps above are complete, execute tests in this order.

### Test Environment

- URL: `NEXT_PUBLIC_APP_URL` value
- Admin URL: `{APP_URL}/admin`
- Test dealer email: use a separate test account (not the admin account)

---

### Block A — Dealer Signup & Admin Approval

| # | Test | Expected Result |
|---|---|---|
| A-1 | Open `/signup` as a new user | Signup form renders |
| A-2 | Complete signup form with test dealer info | Account created, redirected to `/signup/pending` |
| A-3 | Check Supabase Auth — confirm test user appears | User record visible |
| A-4 | Login to `/admin` as `nisikawa@office-az.com` | Admin dashboard renders |
| A-5 | Navigate to Admin → Dealers | Pending dealer appears in list |
| A-6 | Open dealer detail, click Approve, set trial plan | Approval status changes to `approved` |
| A-7 | Verify `dealers.approval_status = 'approved'` in DB | SQL confirms row updated |

---

### Block B — Dealer Login & Dashboard

| # | Test | Expected Result |
|---|---|---|
| B-1 | Login as test dealer at `/login` | Redirected to `/dashboard` |
| B-2 | Dashboard loads without errors | KPI cards render (zeros expected on fresh account) |
| B-3 | Navigate to `/settings` | Settings page renders |
| B-4 | Update store name in Basic Info settings | Save succeeds, name persists on reload |

---

### Block C — OCR (Vehicle Registration)

| # | Test | Expected Result |
|---|---|---|
| C-1 | Navigate to Vehicles → Upload Registration | Upload form renders |
| C-2 | Upload a vehicle registration image (JPEG/PNG) | File uploads to `vehicle-registration-documents` bucket |
| C-3 | OCR processing runs | GPT-4o Vision extracts registration fields |
| C-4 | Review OCR results screen | Fields populated: plate number, owner name, model, etc. |
| C-5 | Confirm and create customer + vehicle | Customer and vehicle records created in DB |

---

### Block D — Customer & Vehicle Creation

| # | Test | Expected Result |
|---|---|---|
| D-1 | Navigate to `/customers` → New Customer | Customer form renders |
| D-2 | Create customer manually (without OCR) | Customer saved, visible in list |
| D-3 | Navigate to `/vehicles` → Add Vehicle | Vehicle form renders |
| D-4 | Create vehicle linked to customer above | Vehicle saved, linked correctly |

---

### Block E — Estimate

| # | Test | Expected Result |
|---|---|---|
| E-1 | Navigate to `/estimates` → New Estimate | Estimate builder renders |
| E-2 | Select customer and vehicle | Fields populate |
| E-3 | Add at least one GYEON service item | Line item appears, subtotal calculates |
| E-4 | Save estimate as draft | Estimate saved with document number |
| E-5 | Confirm estimate | Status changes to confirmed |

---

### Block F — PDF Generation

| # | Test | Expected Result |
|---|---|---|
| F-1 | On confirmed estimate, click Generate PDF | PDF generation triggers |
| F-2 | PDF appears in document viewer | PDF renders with dealer logo, line items, total |
| F-3 | Verify signed URL is accessible | PDF URL opens in browser |
| F-4 | Check `document_files` table | 1 active row for this estimate |
| F-5 | Check `documents` storage bucket | PDF file exists at expected path |

---

### Block G — Work Order

| # | Test | Expected Result |
|---|---|---|
| G-1 | Navigate to `/work-orders` → New Work Order | Form renders |
| G-2 | Link to confirmed estimate | Work order created |
| G-3 | Upload before-service photo | Photo uploads to `work-order-files` bucket |
| G-4 | Advance work order to in-progress | Status updates |

---

### Block H — Completion Report

| # | Test | Expected Result |
|---|---|---|
| H-1 | Complete the work order | Completion report form accessible |
| H-2 | Fill completion report details | Report saved |
| H-3 | Upload after-service photo | Photo saved |
| H-4 | Generate completion report PDF | PDF created in `documents` bucket |
| H-5 | Check invoice auto-created | Invoice appears in `/invoices` |

---

### Block I — Maintenance Reminder

| # | Test | Expected Result |
|---|---|---|
| I-1 | Navigate to `/maintenance` | Reminder list renders |
| I-2 | Create manual reminder for test customer + vehicle | Reminder saved with due date |
| I-3 | Verify reminder appears in list | Row visible |

---

### Block J — LINE Setup Preparation

| # | Test | Expected Result |
|---|---|---|
| J-1 | Navigate to Settings → LINE | LINE settings panel renders |
| J-2 | Confirm LINE channel env vars are loaded | No "unconfigured" error shown |
| J-3 | Navigate to `/line` | LINE customers list renders |
| J-4 | Verify webhook URL is accessible at `/api/line/webhook` | Returns 200 or 401 (not 500) |
| J-5 | LIFF link page accessible at `/liff/link` | Page renders |

---

### Block K — Warehouse & Logistics Basic Check

| # | Test | Expected Result |
|---|---|---|
| K-1 | Admin → Logistics → Inventory | Inventory list renders (empty) |
| K-2 | Admin → Logistics → Receiving | Receiving form renders |
| K-3 | Navigate to `/products` as dealer | GYEON product catalog renders |
| K-4 | Navigate to `/product-orders` as dealer | Product orders list renders |
| K-5 | Admin → Logistics → Stocktaking | Stocktaking list renders |
| K-6 | Admin → Logistics → Shipments | Shipments list renders |

---

## PART 5 — Go / No-Go Gate

All blocks A through K must pass before Version 1.0 RC is declared ready for external testing.

| Block | Description | Gate |
|---|---|---|
| A | Signup & Approval | Required |
| B | Login & Dashboard | Required |
| C | OCR | Required |
| D | Customer & Vehicle | Required |
| E | Estimate | Required |
| F | PDF | Required |
| G | Work Order | Required |
| H | Completion Report | Required |
| I | Maintenance Reminder | Required |
| J | LINE Preparation | Conditional (LINE credentials required) |
| K | Warehouse / Logistics | Required |

---

## Appendix — Useful Verification SQL

Run in Supabase SQL Editor at any time during testing.

```sql
-- Confirm all 45 tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type   = 'BASE TABLE'
ORDER BY table_name;

-- Confirm RLS is enabled on all tables
SELECT relname AS table_name,
       relrowsecurity AS rls_enabled
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND pg_class.relkind = 'r'
  AND NOT relrowsecurity
ORDER BY relname;

-- Confirm all 6 functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type   = 'FUNCTION'
ORDER BY routine_name;

-- Confirm all 7 triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Confirm subscription plans seeded
SELECT code, name, is_active FROM subscription_plans ORDER BY id;

-- Confirm super_admin exists
SELECT id, email, role, status FROM admin_users WHERE role = 'super_admin';
```

---

*RC-20 Pre-RC Manual Setup — DealerOS Version 1.0 RC*
