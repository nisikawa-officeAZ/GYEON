# DealerOS — Production Database Readiness Report
## RC-19 Pre-Release Synchronization

**Report Date:** 2026-06-27  
**Sprint:** RC-19 Production Database Synchronization  
**Based on:** RC-18 DB Foundation Audit (see `docs/DB_FOUNDATION_AUDIT.md`)

---

## 1. Database Health Summary

| Metric | Value |
|---|---|
| Total migration files (production) | **43** (including new 000_shared_functions.sql) |
| Tables to be created | **45 production tables** |
| RLS policies | **115+** across all tables |
| Indexes | **100+** across all tables |
| Triggers | **9** (production), 6 (staging-only) |
| Functions | **6** (production), 3 (staging-only) |
| Storage buckets required | **3** |
| Critical bugs fixed this sprint | **1** (`update_updated_at_column` function missing — fixed by migration 000) |
| Critical bugs fixed in RC-18 | **1** (`ocr_sessions` → `vehicle_registration_ocr_sessions`) |

---

## 2. New Migration Added: 000_shared_functions.sql

**Discovery:** Migrations 046, 047, and 048 reference the PostgreSQL function `update_updated_at_column()` in their trigger definitions. This function was **not defined in any existing migration file** — it would cause those triggers to fail with `ERROR: function update_updated_at_column() does not exist` on a fresh database.

**Resolution:** Created `supabase/migrations/000_shared_functions.sql` to define this shared function. It must be applied first, before migration 001.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

Affected migrations:
- `046_create_document_sequences.sql` — `trg_document_sequences_updated_at`
- `047_create_gyeon_products.sql` — `trg_gyeon_products_updated_at`
- `048_create_product_orders.sql` — `trg_product_orders_updated_at`

---

## 3. Migration Validation

### 3.1 Production Migration Checklist (43 migrations)

All 43 SQL files confirmed present on disk. None duplicated. No numbers skipped within the active range.

| Step | File | Objects Created / Modified | Dependencies |
|---|---|---|---|
| **0** | `000_shared_functions.sql` | FUNCTION `update_updated_at_column()` | None — must be step 0 |
| **1** | `001_create_core_tables.sql` | TABLES: customers, vehicles, estimates, gyeon_service_estimates | None |
| **2** | `002_enable_rls.sql` | RLS enable on 001 tables | 001 |
| **3** | `003_create_dealers_and_members.sql` | TABLES: dealers, dealer_members | None |
| **4** | `004_enable_saas_rls.sql` | RLS policies (dealer_members-based) | 001, 003 |
| **5** | `035_update_customers_schema.sql` | ALTER customers: customer_code, last_name, first_name, kana, address fields | 001 |
| **6** | `036_update_vehicles_schema.sql` | ALTER vehicles: vehicle_code, maker, color, plate_number, body_size, mileage, inspection_expiry_date | 001 |
| **7** | `037_rebuild_estimate_core.sql` | TABLE: estimate_items; ALTER estimates: estimate_number, discount_amount, tax_rate, tax_amount, notes | 001, 003 |
| **8** | `038_create_work_orders.sql` | TABLE: work_orders | 001, 003, 037 |
| **9** | `039_create_work_order_files.sql` | TABLE: work_order_files | 038 |
| **10** | `040_create_completion_reports.sql` | TABLE: completion_reports | 038 |
| **11** | `041_create_invoices.sql` | TABLES: invoices, invoice_items | 038, 040 |
| **12** | `042_create_payments.sql` | TABLE: payments | 041 |
| **13** | `043_create_line_customers.sql` | TABLES: dealer_settings, line_customers; ALTER customers | 001, 003 |
| **14** | `044_create_line_message_logs.sql` | TABLES: line_message_logs, line_notification_queue | 001, 003, 043 |
| **15** | `045_create_maintenance_reminders.sql` | TABLE: maintenance_reminders | 001, 003, 038 |
| **16** | `046_create_document_sequences.sql` | TABLE: document_sequences; FUNCTION `get_next_document_number()`; TRIGGER | **000**, 003 |
| **17** | `047_create_gyeon_products.sql` | TABLE: gyeon_products; ALTER estimate_items, invoice_items; TRIGGER | **000**, 037, 041 |
| **18** | `048_create_product_orders.sql` | TABLES: product_orders, product_order_items; ALTER document_sequences; TRIGGER | **000**, 003, 046, 047 |
| **19** | `049_add_plan_to_dealers.sql` | ALTER dealers: plan, subscription_status, started_at, expired_at | 003 |
| **20** | `050_create_staff_roles.sql` | TABLE: dealer_staff; ALTER dealers: owner_user_id | 003 |
| **21** | `051_create_admin_tables.sql` | TABLES: admin_users, admin_audit_logs | auth.users |
| **22** | `052_create_reservations.sql` | TABLE: reservations; ALTER document_sequences, completion_reports | 003, 038, 046, 050 |
| **23** | `053_create_document_files.sql` | TABLE: document_files | 003 |
| **24** | `054_notification_activity_timeline.sql` | TABLES: activity_logs, notifications | 001, 003 |
| **25** | `055_audit_logs.sql` | TABLE: audit_logs | 003 |
| **26** | `058_subscription_license_management.sql` | TABLES: subscription_plans, dealer_subscriptions; ALTER audit_logs | 003, 055 |
| **27** | `059_dealer_onboarding.sql` | ALTER dealer_settings: onboarding columns, pdf/stamp settings; ALTER audit_logs | 043, 058 |
| — | ⚠️ SKIP 062 for production | STAGING ONLY | — |
| — | ⚠️ SKIP 063 for production | STAGING ONLY | — |
| **28** | `064_billing_management.sql` | TABLES: dealer_billing, billing_invoices; FUNCTION + TRIGGER | 003 |
| **29** | `066_company_settings.sql` | ALTER dealer_settings: company_name, postal_code, contact_name, qualified_invoice_number | 043, 059 |
| **30** | `067_vehicle_registration_ocr.sql` | TABLE: vehicle_registration_files; FUNCTION + TRIGGER | 001, 003 |
| **31** | `068_ocr_sessions.sql` | TABLE: vehicle_registration_ocr_sessions; ALTER vehicle_registration_files; FUNCTION + TRIGGER | 067 |
| **32** | `069_inventory_counting.sql` | TABLE: dealer_stock_levels; ALTER gyeon_products: units_per_case; FUNCTION + TRIGGER | 003, 047 |
| **33** | `070_dealer_settings_canonical.sql` | ALTER dealer_settings: service_price_settings, ppf_price_tables, coating_price_tables, line_public_settings, etc. | 043, 059, 066 |
| **34** | `071_dealer_approval_flow.sql` | ALTER dealers: approval_status, approved_at, rejected_at, approved_by; INDEX | 003, 051 |
| **35** | `072_inventory_receiving_movements.sql` | TABLES: inventory_receipts, stock_movements | 003, 047 |
| **36** | `073_detailer_core_missing_fields.sql` | ALTER vehicles: displacement, fuel_type, first_registration_date, inspection_due_date; ALTER customers: occupation, birthday | 001 |
| **37** | `074_dealer_trial_fields.sql` | ALTER dealers: trial_plan_type, service_start_date, trial_start_date, trial_end_date, trial_status, detailer_rank | 003, 071 |
| **38** | `075_admin_roles_expansion.sql` | ALTER admin_users: expand role CHECK to include gyeon_admin, logistics_admin | 051 |
| **39** | `076_dealer_lifecycle.sql` | ALTER dealers: expand approval_status CHECK to include suspended; ADD suspended_at | 003, 071 |
| **40** | `077_logistics_foundation.sql` | TABLES: logistics_shipments, logistics_backorders; ALTER inventory_receipts: damaged_count | 047, 048, 051, 072 |
| **41** | `078_stocktaking.sql` | TABLES: inventory_stocktaking_sessions, inventory_stocktaking_items; INDEX gyeon_products(jan_code) | 047, 051 |
| **42** | `079_warehouse_daily_ops.sql` | TABLES: warehouse_adjustments, po_fulfillment_lines; ALTER inventory_receipts: supplier, po_number, received_date; ALTER stock_movements: adjustment_reason; ALTER product_orders: expand status CHECK | 003, 047, 048, 051, 072 |

### 3.2 Intentional Gap Numbers

The following migration numbers have no corresponding SQL file. This is correct and expected:

| Missing Numbers | Reason |
|---|---|
| 005–034 | Legacy phases — code-only, no schema changes |
| 056–057 | Code-only phases (documented in MANUAL_MIGRATION_TRACKING.md) |
| 060–061 | No schema changes at these phases |
| 065 | No schema changes at this phase |

---

## 4. Detailed Execution Guide

### Pre-Flight Checklist

Before applying any migration:

```
□ Create a full database backup (Dashboard → Database → Backups)
□ Confirm environment: STAGING or PRODUCTION (never cross-apply)
□ Have the Supabase SQL Editor open and ready
□ Read each migration file completely before pasting
□ Apply ONE migration at a time — never batch
□ Record the result immediately (Success / Error) after each step
□ STOP immediately if any migration returns an error
```

### Application Procedure

1. Open Supabase Dashboard → project → SQL Editor → New Query
2. Paste the full migration file content
3. Click **Run**
4. Verify output shows `Success` with no errors
5. Run the post-apply verification query from this guide
6. Mark the step as complete before proceeding

---

### Step 0 — 000_shared_functions.sql

**Creates:** FUNCTION `update_updated_at_column()`  
**Dependencies:** None  
**Why first:** This function is required by trigger definitions in migrations 046, 047, and 048. If not applied first, those migrations will fail.  
**Safe to re-run:** Yes (CREATE OR REPLACE)

```sql
-- Verification query:
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'update_updated_at_column';
-- Expected: 1 row
```

---

### Step 1 — 001_create_core_tables.sql

**Creates:** customers, vehicles, estimates, gyeon_service_estimates  
**Expected result:** 4 new tables

```sql
-- Verification:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('customers','vehicles','estimates','gyeon_service_estimates');
-- Expected: 4 rows
```

---

### Step 2 — 002_enable_rls.sql

**Creates:** RLS enabled on 001 tables  
**Expected result:** rowsecurity = true on 4 tables

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('customers','vehicles','estimates','gyeon_service_estimates');
-- Expected: all 4 rows have rowsecurity = true
```

---

### Step 3 — 003_create_dealers_and_members.sql

**Creates:** dealers, dealer_members  
**Expected result:** 2 new tables

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('dealers','dealer_members');
-- Expected: 2 rows
```

---

### Step 4 — 004_enable_saas_rls.sql

**Creates:** SaaS RLS policies (dealer_members-based multi-tenant isolation)  
**Expected result:** Multiple policies created

```sql
SELECT policyname, tablename FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- Verify policies exist on customers, vehicles, estimates, gyeon_service_estimates
```

---

### Steps 5–15 — Schema Extensions and Core Feature Tables

Apply in order: 035, 036, 037, 038, 039, 040, 041, 042, 043, 044, 045

```sql
-- Post-apply verification (after all 11 applied):
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'estimate_items','work_orders','work_order_files',
    'completion_reports','invoices','invoice_items','payments',
    'dealer_settings','line_customers','line_message_logs',
    'line_notification_queue','maintenance_reminders'
  );
-- Expected: 12 rows
```

---

### Step 16 — 046_create_document_sequences.sql

**Creates:** document_sequences, `get_next_document_number()` RPC, trigger  
**Critical note:** Requires `update_updated_at_column()` from step 0

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'document_sequences';
-- Expected: 1 row

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_next_document_number';
-- Expected: 1 row
```

---

### Step 17 — 047_create_gyeon_products.sql

**Creates:** gyeon_products, trigger; adds product_id FK to estimate_items and invoice_items  
**Critical:** This is the anchor for migrations 069, 072, 077, 078, 079

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'gyeon_products';
-- Expected: 1 row

SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'estimate_items' AND column_name = 'product_id';
-- Expected: 1 row
```

---

### Step 18 — 048_create_product_orders.sql

**Creates:** product_orders, product_order_items; extends document_sequences CHECK

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('product_orders','product_order_items');
-- Expected: 2 rows
```

---

### Steps 19–27 — Feature Tables (049 through 059)

Apply in order: 049, 050, 051, 052, 053, 054, 055, 058, 059

**Critical step in this range: 051 (admin_users + admin_audit_logs)** — this is the anchor for the entire Admin Console (RC-12 through RC-17). If this migration is missing, all admin features will fail.

```sql
-- After 051:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('admin_users','admin_audit_logs');
-- Expected: 2 rows

-- After 058:
SELECT code, name, monthly_price FROM subscription_plans ORDER BY sort_order;
-- Expected: rows for basic, pro, pro_plus
```

---

### SKIP 062 and 063 (Staging Only)

⚠️ Do NOT apply migrations 062 or 063 to production. These create staging-specific tables (`staging_verification_runs`, `uat_dealers`, etc.) that should not exist in production.

---

### Step 28 — 064_billing_management.sql

**Creates:** dealer_billing, billing_invoices

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('dealer_billing','billing_invoices');
-- Expected: 2 rows
```

---

### Steps 29–31 — Settings and OCR Tables (066, 067, 068)

Apply in order: 066, 067, 068

```sql
-- After 068:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vehicle_registration_files','vehicle_registration_ocr_sessions');
-- Expected: 2 rows
```

---

### Step 32 — 069_inventory_counting.sql

**Creates:** dealer_stock_levels; adds units_per_case to gyeon_products  
**Critical:** Required before 077, 078, 079

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'dealer_stock_levels';
-- Expected: 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'gyeon_products' AND column_name = 'units_per_case';
-- Expected: 1 row
```

---

### Steps 33–34 — Dealer Settings and Approval (070, 071)

```sql
-- After 071:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers' AND column_name = 'approval_status';
-- Expected: 1 row
```

---

### Step 35 — 072_inventory_receiving_movements.sql

**Creates:** inventory_receipts, stock_movements  
**Critical:** Required before 077 and 079

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('inventory_receipts','stock_movements');
-- Expected: 2 rows
```

---

### Steps 36–39 — Field Additions (073, 074, 075, 076)

```sql
-- After 075:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'admin_users' AND column_name = 'role';
-- Expected: 1 row

-- Verify role constraint includes all 3 roles:
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'admin_users' AND constraint_type = 'CHECK';
-- Then verify logistics_admin is in the CHECK clause
```

---

### Step 40 — 077_logistics_foundation.sql

**Creates:** logistics_shipments, logistics_backorders; adds damaged_count to inventory_receipts

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('logistics_shipments','logistics_backorders');
-- Expected: 2 rows

SELECT column_name FROM information_schema.columns
WHERE table_name = 'inventory_receipts' AND column_name = 'damaged_count';
-- Expected: 1 row
```

---

### Step 41 — 078_stocktaking.sql

**Creates:** inventory_stocktaking_sessions, inventory_stocktaking_items; index on gyeon_products.jan_code

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('inventory_stocktaking_sessions','inventory_stocktaking_items');
-- Expected: 2 rows
```

---

### Step 42 — 079_warehouse_daily_ops.sql

**Creates:** warehouse_adjustments, po_fulfillment_lines; adds supplier/po_number/received_date to inventory_receipts; adds adjustment_reason to stock_movements; expands product_orders.status CHECK

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('warehouse_adjustments','po_fulfillment_lines');
-- Expected: 2 rows

SELECT column_name FROM information_schema.columns
WHERE table_name = 'inventory_receipts'
  AND column_name IN ('supplier','po_number','received_date');
-- Expected: 3 rows

-- Verify product_orders status CHECK includes 'fulfilling' and 'fulfilled':
SELECT check_clause FROM information_schema.check_constraints
WHERE constraint_name = 'product_orders_status_check';
```

---

## 5. Storage Bucket Requirements

Three Supabase Storage buckets must be created manually. None are auto-created by migrations.

### 5.1 Bucket: `documents`

| Attribute | Value |
|---|---|
| Bucket name | `documents` |
| Visibility | **PRIVATE** (required) |
| Purpose | PDF storage: estimates, invoices, completion reports, product orders |
| Code reference | `src/lib/pdf/generate-pdf-and-upload.ts`, `src/lib/documents/get-signed-url.ts` |
| Env var | `STORAGE_BUCKET` (defaults to `documents` if not set) |
| Documentation | `docs/DOCUMENT_STORAGE_SETUP.md` |

```
Creation steps:
Dashboard → Storage → New Bucket
Name: documents
Public: OFF
File size limit: 50MB (recommended)
Allowed MIME types: application/pdf
```

### 5.2 Bucket: `work-order-files`

| Attribute | Value |
|---|---|
| Bucket name | `work-order-files` |
| Visibility | **PRIVATE** (required) |
| Purpose | Work order photos and videos per phase (before/after/damage) |
| Code reference | `src/lib/work-order-files/upload-work-order-file.ts` |
| Path format | `{dealer_id}/{work_order_id}/{phase}/{uuid}_{filename}` |
| Documentation | `docs/STORAGE_SETUP_WORK_ORDER_FILES.md` |

```
Creation steps:
Dashboard → Storage → New Bucket
Name: work-order-files
Public: OFF
File size limit: 100MB (recommended)
Allowed MIME types: image/*, video/*
```

### 5.3 Bucket: `vehicle-registration-documents`

| Attribute | Value |
|---|---|
| Bucket name | `vehicle-registration-documents` |
| Visibility | **PRIVATE** (required) |
| Purpose | Vehicle registration certificate photos for OCR processing |
| Code reference | `src/lib/vehicle-registration/storage.ts` |
| Documentation | `docs/VEHICLE_REGISTRATION_STORAGE_SETUP.md` |

```
Creation steps:
Dashboard → Storage → New Bucket
Name: vehicle-registration-documents
Public: OFF
File size limit: 10MB
Allowed MIME types: image/jpeg, image/png, image/webp
```

### 5.4 Storage Validation Checklist

```
□ Bucket 'documents' exists and is PRIVATE
□ Bucket 'work-order-files' exists and is PRIVATE
□ Bucket 'vehicle-registration-documents' exists and is PRIVATE
□ No bucket is set to Public
□ STORAGE_BUCKET env var is set to 'documents' (or confirm default)
```

---

## 6. Schema Validation Summary

### 6.1 Tables

| Category | Count | Status |
|---|---|---|
| Production tables | 45 | ✅ All defined in migrations |
| Staging-only tables | 7 | ⚠️ Skip in production |
| Tables missing migrations | 2 | ℹ️ dealer_ai_settings, dealer_ai_usage_log (graceful fallback) |

### 6.2 Functions

| Function | Migration | Purpose |
|---|---|---|
| `update_updated_at_column()` | **000** (new) | Generic updated_at trigger handler |
| `get_next_document_number()` | 046 | Atomic document sequence increment |
| `update_vehicle_registration_files_updated_at()` | 067 | OCR file updated_at trigger |
| `update_ocr_sessions_updated_at()` | 068 | OCR session updated_at trigger |
| `update_dealer_stock_levels_updated_at()` | 069 | Stock level updated_at trigger |
| `update_billing_updated_at()` | 064 | Billing updated_at trigger |

### 6.3 Triggers

| Trigger | Table | Migration |
|---|---|---|
| `trg_document_sequences_updated_at` | document_sequences | 046 |
| `trg_gyeon_products_updated_at` | gyeon_products | 047 |
| `trg_product_orders_updated_at` | product_orders | 048 |
| `trg_dealer_billing_updated_at` | dealer_billing | 064 |
| `set_vehicle_registration_files_updated_at` | vehicle_registration_files | 067 |
| `set_ocr_sessions_updated_at` | vehicle_registration_ocr_sessions | 068 |
| `set_dealer_stock_levels_updated_at` | dealer_stock_levels | 069 |

### 6.4 RLS Policies

115+ policies across all tables.

| Policy Type | Coverage |
|---|---|
| Dealer member access (multi-tenant) | All dealer-scoped tables |
| Admin access (service role bypass) | All admin-scoped tables (no public policy) |
| Self-access policies | audit_logs (INSERT+SELECT, no DELETE) |
| Staging-only | staging_verification_*, uat_* tables |

**Tables with no public RLS policy (service role only):**
- logistics_shipments, logistics_backorders
- inventory_stocktaking_sessions, inventory_stocktaking_items
- warehouse_adjustments, po_fulfillment_lines
- admin_users, admin_audit_logs

### 6.5 Indexes

100+ indexes covering all primary lookup paths:
- All foreign key columns are indexed
- All `status` columns on high-traffic tables are indexed
- Temporal queries: `created_at`, `received_at`, `shipped_at` indexed
- Product search: `gyeon_products.sku`, `gyeon_products.jan_code` indexed
- Dealer isolation: `dealer_id` indexed on all multi-tenant tables

### 6.6 Views, Enums, Sequences

| Object Type | Count | Notes |
|---|---|---|
| Views | 0 | None defined — all joins done in application layer |
| Custom types/enums | 0 | Text columns with CHECK constraints used instead |
| Custom sequences | 0 | `gen_random_uuid()` + `document_sequences` table used |

### 6.7 Foreign Key Integrity

All foreign key targets verified to exist in the dependency graph. No circular dependencies. No forward references.

| FK Source | FK Target | Migration |
|---|---|---|
| vehicles.customer_id | customers.id | 001 |
| estimates.{customer,vehicle}_id | customers/vehicles.id | 001 |
| dealer_members.dealer_id | dealers.id | 003 |
| dealer_members.user_id | auth.users.id | 003 |
| product_order_items.order_id | product_orders.id | 048 |
| product_order_items.product_id | gyeon_products.id | 048 |
| dealer_stock_levels.{dealer,product}_id | dealers/gyeon_products.id | 069 |
| inventory_receipts.{dealer,product}_id | dealers/gyeon_products.id | 072 |
| stock_movements.{dealer,product}_id | dealers/gyeon_products.id | 072 |
| logistics_shipments.{product_order,dealer,admin}_id | respective tables | 077 |
| inventory_stocktaking_sessions.started_by | admin_users.id | 078 |
| warehouse_adjustments.{dealer,product,performed_by} | respective tables | 079 |
| po_fulfillment_lines.product_order_id | product_orders.id | 079 |

---

## 7. Environment Variables

All of the following must be set in the target environment before deployment:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Critical | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Critical | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Critical | Service role key (admin operations) |
| `NEXT_PUBLIC_APP_URL` | ✅ Critical | Application base URL (e.g. https://app.example.com) |
| `STORAGE_BUCKET` | ✅ Required | Set to `documents` |
| `LINE_CHANNEL_ACCESS_TOKEN` | ⚠️ Feature | LINE Messaging API token |
| `LINE_CHANNEL_ID` | ⚠️ Feature | LINE Channel ID |
| `LINE_CHANNEL_SECRET` | ⚠️ Feature | LINE Channel Secret |
| `NEXT_PUBLIC_LIFF_ID` | ⚠️ Feature | LINE LIFF App ID |
| `OPENAI_API_KEY` | ⚠️ Feature | Required for vehicle registration OCR |
| `CRON_SECRET` | ⚠️ Feature | Secret for scheduled job authentication |
| `DEALER_AI_KEY_SECRET` | ℹ️ Deferred | AI settings encryption key (when dealer_ai_settings migration applied) |

---

## 8. Remaining Blockers Before Version 1.0 RC Testing

| # | Blocker | Severity | Action |
|---|---|---|---|
| 1 | `update_updated_at_column()` not in migrations | 🔴 Fixed | Migration 000 created |
| 2 | `ocr_sessions` table name bug | 🔴 Fixed | Fixed in RC-18 (`get-dealer-detail.ts:113`) |
| 3 | All 43 production migrations must be applied to target environment in correct order | 🔴 Required | Use Section 3.1 checklist |
| 4 | 3 Storage buckets must be created manually | 🔴 Required | Use Section 5 instructions |
| 5 | All required environment variables must be set | 🔴 Required | Use Section 7 list |
| 6 | `dealer_ai_settings` / `dealer_ai_usage_log` migrations not created | ℹ️ Deferred | Graceful fallback active — not a blocker for v1.0 |
| 7 | `docs/MIGRATION_APPLICATION_ORDER.md` stops at migration 059 | ⚠️ Low | This document supersedes it |
| 8 | `docs/MANUAL_MIGRATION_TRACKING.md` stops at migration 059 | ⚠️ Low | Use this document for current execution plan |

---

## 9. Go / No-Go Assessment for Version 1.0 RC

### ✅ GO — with conditions

The DealerOS database schema is fully defined, all critical code bugs are fixed, and the complete migration execution plan is documented. No outstanding blocking issues exist in the codebase.

**Conditions to achieve GO:**

| Condition | Status |
|---|---|
| Apply all 43 production migrations in order (Steps 0–42) | ⏳ Manual action required |
| Create 3 Storage buckets (documents, work-order-files, vehicle-registration-documents) | ⏳ Manual action required |
| Set all required environment variables | ⏳ Manual action required |
| Verify RLS: run Section 7.3 validation query from DB_FOUNDATION_AUDIT.md | ⏳ Manual action required |

**Once all conditions are met:** ✅ **GO for Version 1.0 RC testing**

### Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration 046/047/048 trigger failure if 000 not applied first | High | High | Apply 000 as step 0 |
| Staging-only migrations (062, 063) accidentally applied to production | Medium | Medium | Clearly marked SKIP in execution guide |
| Storage buckets missing at launch | Medium | High | Required pre-launch checklist in Section 5.4 |
| ENV variables missing in target | Medium | Critical | Section 7 checklist |
| AI settings tables queried before migration created | Low | Low | Graceful fallback catches 42P01 error |

---

## 10. Version Compatibility

| Component | Version |
|---|---|
| Next.js | 15 (App Router) |
| Supabase JS Client | v2 |
| PostgreSQL (Supabase) | 15+ |
| TypeScript | 5.x |
| TailwindCSS | v4 |
| Node.js | 20+ |

---

## 11. Related Documents

| Document | Purpose |
|---|---|
| `docs/DB_FOUNDATION_AUDIT.md` | RC-18 migration dependency graph and initial audit |
| `docs/MIGRATION_APPLICATION_ORDER.md` | Legacy order list (stops at 059 — superseded by this document) |
| `docs/MANUAL_MIGRATION_TRACKING.md` | Per-migration checklist (stops at 059 — superseded by this document) |
| `docs/BACKUP_DATABASE.md` | Database backup procedure |
| `docs/DOCUMENT_STORAGE_SETUP.md` | `documents` bucket setup |
| `docs/STORAGE_SETUP_WORK_ORDER_FILES.md` | `work-order-files` bucket setup |
| `docs/VEHICLE_REGISTRATION_STORAGE_SETUP.md` | `vehicle-registration-documents` bucket setup |
| `supabase/migrations/000_shared_functions.sql` | **NEW** — must be applied first |
