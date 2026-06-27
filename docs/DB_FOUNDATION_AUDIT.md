# DealerOS — Database Foundation Audit
## RC-18 Pre-Release Database Synchronization Report

**Audit Date:** 2026-06-27  
**Audited by:** RC-18 Sprint  
**Scope:** All migrations 001–079, full codebase table reference scan  
**Environment target:** Supabase Production (manual apply)

---

## 1. Executive Summary

| Item | Count |
|---|---|
| Migration files on disk | 44 |
| Intentional gap numbers (no file) | 20 |
| Tables created across all migrations | 52 total (45 production, 7 staging-only) |
| Critical code bugs found | 1 |
| Tables referenced in code without migrations | 2 (graceful fallback exists) |
| Outdated documentation files | 2 |

**Overall health:** `PENDING SYNC` — migrations 064–079 are not reflected in existing tracking docs. One critical table name mismatch found in admin code. All other tables are correctly defined and cross-referenced.

---

## 2. Migration File Inventory

### 2.1 Files on Disk (44 migrations)

| Seq | File | Status |
|---|---|---|
| 1 | `001_create_core_tables.sql` | ✅ Foundation |
| 2 | `002_enable_rls.sql` | ✅ Foundation |
| 3 | `003_create_dealers_and_members.sql` | ✅ Foundation |
| 4 | `004_enable_saas_rls.sql` | ✅ Foundation |
| 5 | `035_update_customers_schema.sql` | ✅ Schema update |
| 6 | `036_update_vehicles_schema.sql` | ✅ Schema update |
| 7 | `037_rebuild_estimate_core.sql` | ✅ Schema update |
| 8 | `038_create_work_orders.sql` | ✅ Feature |
| 9 | `039_create_work_order_files.sql` | ✅ Feature |
| 10 | `040_create_completion_reports.sql` | ✅ Feature |
| 11 | `041_create_invoices.sql` | ✅ Feature |
| 12 | `042_create_payments.sql` | ✅ Feature |
| 13 | `043_create_line_customers.sql` | ✅ Feature |
| 14 | `044_create_line_message_logs.sql` | ✅ Feature |
| 15 | `045_create_maintenance_reminders.sql` | ✅ Feature |
| 16 | `046_create_document_sequences.sql` | ✅ Feature |
| 17 | `047_create_gyeon_products.sql` | ✅ Critical — anchor for 069/072/077/078/079 |
| 18 | `048_create_product_orders.sql` | ✅ Critical — anchor for 077/079 |
| 19 | `049_add_plan_to_dealers.sql` | ✅ Schema update |
| 20 | `050_create_staff_roles.sql` | ✅ Feature |
| 21 | `051_create_admin_tables.sql` | ✅ Critical — anchor for 075/077/078/079 |
| 22 | `052_create_reservations.sql` | ✅ Feature |
| 23 | `053_create_document_files.sql` | ✅ Feature |
| 24 | `054_notification_activity_timeline.sql` | ✅ Feature |
| 25 | `055_audit_logs.sql` | ✅ Critical |
| 26 | `058_subscription_license_management.sql` | ✅ Feature |
| 27 | `059_dealer_onboarding.sql` | ✅ Schema update |
| 28 | `062_staging_verification.sql` | ⚠️ STAGING ONLY — do not apply to production |
| 29 | `063_uat_management.sql` | ⚠️ STAGING ONLY — do not apply to production |
| 30 | `064_billing_management.sql` | ✅ Feature |
| 31 | `066_company_settings.sql` | ✅ Schema update |
| 32 | `067_vehicle_registration_ocr.sql` | ✅ Feature |
| 33 | `068_ocr_sessions.sql` | ✅ Feature |
| 34 | `069_inventory_counting.sql` | ✅ Critical — dealer_stock_levels |
| 35 | `070_dealer_settings_canonical.sql` | ✅ Schema update |
| 36 | `071_dealer_approval_flow.sql` | ✅ Schema update |
| 37 | `072_inventory_receiving_movements.sql` | ✅ Critical — inventory_receipts, stock_movements |
| 38 | `073_detailer_core_missing_fields.sql` | ✅ Schema update |
| 39 | `074_dealer_trial_fields.sql` | ✅ Schema update |
| 40 | `075_admin_roles_expansion.sql` | ✅ Schema update |
| 41 | `076_dealer_lifecycle.sql` | ✅ Schema update |
| 42 | `077_logistics_foundation.sql` | ✅ Critical — logistics_shipments, logistics_backorders |
| 43 | `078_stocktaking.sql` | ✅ Critical — inventory_stocktaking_* |
| 44 | `079_warehouse_daily_ops.sql` | ✅ Critical — warehouse_adjustments, po_fulfillment_lines |

### 2.2 Intentional Number Gaps (no SQL file exists)

| Numbers | Reason |
|---|---|
| 005–034 | Legacy phases — no schema changes, code-only work |
| 056–057 | Code-only phases (documented in `MANUAL_MIGRATION_TRACKING.md`) |
| 060–061 | No SQL changes at these phase numbers |
| 065 | No SQL changes at this phase number |

**Action required:** None. Gaps are intentional. Do not create placeholder migration files.

---

## 3. Dependency Graph

```
001 ─┬──────────────────────────────────────────── customers, vehicles, estimates, gyeon_service_estimates
     │
     ├─ 002 ──────────────────────────────────────── RLS enable on 001 tables
     │
     ├─ 003 ──────────────────────────────────────── dealers, dealer_members
     │    └─ 004 ────────────────────────────────── SaaS RLS policies
     │
     ├─ 035 ──────────────────────────────────────── ALTER customers
     ├─ 036 ──────────────────────────────────────── ALTER vehicles
     │
     └─ 037 ──────────────────────────────────────── estimate_items, ALTER estimates
          └─ 038 ───────────────────────────────── work_orders
               ├─ 039 ─────────────────────────── work_order_files
               └─ 040 ─────────────────────────── completion_reports
                    └─ 041 ─────────────────────── invoices, invoice_items
                         └─ 042 ─────────────────── payments

003 → 043 ──────────────────────────────────────── dealer_settings, line_customers
          └─ 044 ───────────────────────────────── line_message_logs, line_notification_queue
          └─ 045 ───────────────────────────────── maintenance_reminders

(standalone) 046 ────────────────────────────────── document_sequences

003 → 047 ──────────────────────────────────────── gyeon_products  ← CRITICAL ANCHOR
     │    └─ 048 ──────────────────────────────── product_orders, product_order_items
     │         ├─ 077 ───────────────────────────── logistics_shipments, logistics_backorders
     │         └─ 079 ───────────────────────────── ALTER product_orders, po_fulfillment_lines
     │
     ├─ 069 ──────────────────────────────────────── dealer_stock_levels, ALTER gyeon_products
     │
     ├─ 072 ──────────────────────────────────────── inventory_receipts, stock_movements
     │    └─ 077 ─────────────────────────────────── ALTER inventory_receipts (damaged_count)
     │    └─ 079 ─────────────────────────────────── ALTER inventory_receipts (supplier,po_number,received_date)
     │                                                ALTER stock_movements (adjustment_reason)
     ├─ 078 ──────────────────────────────────────── inventory_stocktaking_sessions, inventory_stocktaking_items
     └─ 079 ──────────────────────────────────────── warehouse_adjustments

051 ──────────────────────────────────────────────── admin_users, admin_audit_logs  ← CRITICAL ANCHOR
     ├─ 075 ───────────────────────────────────────── ALTER admin_users (role column)
     ├─ 077 ───────────────────────────────────────── logistics_shipments.assigned_admin_id
     ├─ 078 ───────────────────────────────────────── inventory_stocktaking_sessions.started_by/completed_by
     └─ 079 ───────────────────────────────────────── warehouse_adjustments.performed_by, po_fulfillment_lines.fulfilled_by

055 → 058 ──────────────────────────────────────── subscription_plans, dealer_subscriptions
     └─ 059 ─────────────────────────────────────── ALTER dealer_settings
     └─ 062 ─────────────────────────────────────── STAGING ONLY
     └─ 063 ─────────────────────────────────────── STAGING ONLY

003 → 064 ──────────────────────────────────────── dealer_billing, billing_invoices
003 → 066 ──────────────────────────────────────── ALTER dealer_settings
003 → 067 ──────────────────────────────────────── vehicle_registration_files
     └─ 068 ─────────────────────────────────────── vehicle_registration_ocr_sessions
```

---

## 4. Complete Table Registry

### 4.1 Production Tables (45 tables)

| Table | Created By | Foreign Key Dependencies |
|---|---|---|
| `customers` | 001 | — |
| `vehicles` | 001 | customers |
| `estimates` | 001 | customers, vehicles |
| `gyeon_service_estimates` | 001 | estimates |
| `dealers` | 003 | — |
| `dealer_members` | 003 | dealers |
| `estimate_items` | 037 | estimates, dealers |
| `work_orders` | 038 | dealers, estimates, customers, vehicles |
| `work_order_files` | 039 | dealers, work_orders |
| `completion_reports` | 040 | dealers, work_orders |
| `invoices` | 041 | dealers, customers, vehicles, estimates, work_orders |
| `invoice_items` | 041 | dealers, invoices |
| `payments` | 042 | dealers, invoices, customers |
| `dealer_settings` | 043 | dealers |
| `line_customers` | 043 | dealers, customers |
| `line_message_logs` | 044 | dealers, customers |
| `line_notification_queue` | 044 | dealers, customers |
| `maintenance_reminders` | 045 | dealers, customers, vehicles, work_orders |
| `document_sequences` | 046 | — |
| `gyeon_products` | 047 | — |
| `product_orders` | 048 | dealers |
| `product_order_items` | 048 | product_orders, gyeon_products |
| `dealer_staff` | 050 | dealers |
| `admin_users` | 051 | — (references auth.users) |
| `admin_audit_logs` | 051 | — (references auth.users) |
| `reservations` | 052 | dealers, customers, vehicles, work_orders |
| `document_files` | 053 | dealers |
| `activity_logs` | 054 | dealers, customers |
| `notifications` | 054 | dealers |
| `audit_logs` | 055 | dealers |
| `subscription_plans` | 058 | — |
| `dealer_subscriptions` | 058 | dealers, subscription_plans |
| `dealer_billing` | 064 | dealers |
| `billing_invoices` | 064 | dealers |
| `vehicle_registration_files` | 067 | dealers, customers, vehicles, estimates |
| `vehicle_registration_ocr_sessions` | 068 | dealers |
| `dealer_stock_levels` | 069 | dealers, gyeon_products |
| `inventory_receipts` | 072 | dealers, gyeon_products |
| `stock_movements` | 072 | dealers, gyeon_products |
| `logistics_shipments` | 077 | product_orders, dealers, admin_users |
| `logistics_backorders` | 077 | product_orders, dealers, gyeon_products |
| `inventory_stocktaking_sessions` | 078 | admin_users |
| `inventory_stocktaking_items` | 078 | inventory_stocktaking_sessions, gyeon_products, admin_users |
| `warehouse_adjustments` | 079 | dealers, gyeon_products, admin_users |
| `po_fulfillment_lines` | 079 | product_orders, gyeon_products, admin_users |

### 4.2 Staging-Only Tables (7 tables — DO NOT apply to production)

| Table | Created By | Notes |
|---|---|---|
| `staging_verification_runs` | 062 | Staging QA tracking |
| `staging_verification_items` | 062 | Staging QA tracking |
| `staging_issues` | 062 | Staging QA tracking |
| `uat_dealers` | 063 | UAT participant tracking |
| `uat_sessions` | 063 | UAT session tracking |
| `uat_feedback` | 063 | UAT feedback |
| `uat_issues` | 063 | UAT issue tracking |

---

## 5. Issues Found

### 5.1 CRITICAL — Table Name Mismatch in Code

| Severity | File | Line | Issue |
|---|---|---|---|
| 🔴 CRITICAL | `src/lib/admin/get-dealer-detail.ts` | 113 | Queries `ocr_sessions` — **table does not exist**. Migration 068 creates `vehicle_registration_ocr_sessions`. This query will fail at runtime with a Postgres `42P01 (undefined_table)` error. |

**Fix required:** Change `supabase.from("ocr_sessions")` → `supabase.from("vehicle_registration_ocr_sessions")` at line 113.

---

### 5.2 MEDIUM — Tables Referenced Without Migrations (graceful fallback exists)

| Table | Referenced In | Migration Status | Fallback |
|---|---|---|---|
| `dealer_ai_settings` | `src/lib/ai-settings/repository/settings-repository.ts` | ❌ No migration file | ✅ Code catches `42P01` and falls back to dealer_settings |
| `dealer_ai_usage_log` | `src/lib/ai-settings/repository/usage-repository.ts` | ❌ No migration file | ✅ Code catches `42P01` and returns zero usage |

These are intentional pending features. The AI settings module operates in degraded mode until these migrations are created and applied. **No immediate blocker for Version 1.0 RC**, but must be created before AI usage tracking is live.

---

### 5.3 LOW — Outdated Documentation

| File | Last Migration Documented | Current Latest |
|---|---|---|
| `docs/MIGRATION_APPLICATION_ORDER.md` | 059 | 079 |
| `docs/MANUAL_MIGRATION_TRACKING.md` | 059 | 079 |

These files do not track migrations 064–079. The execution checklist in this document supersedes them for the current release.

---

### 5.4 LOW — Storage Bucket Dependency (not a DB table)

The code at `src/lib/pdf/generate-pdf-and-upload.ts` and `src/lib/documents/get-signed-url.ts` references a Supabase **Storage bucket** named `documents`. This is not a database table — it is a storage bucket that must be created manually in the Supabase Dashboard.

**Action:** Confirm the `documents` storage bucket exists in the target environment. See `docs/DOCUMENT_STORAGE_SETUP.md`.

---

## 6. Manual Execution Checklist (Fresh Install — Production)

Apply migrations in this exact order. Do NOT skip any number. Backup the database before each session.

```
PRODUCTION MIGRATION EXECUTION ORDER
=====================================

BLOCK 1 — Foundation (must apply together)
□  1. 001_create_core_tables.sql
□  2. 002_enable_rls.sql
□  3. 003_create_dealers_and_members.sql
□  4. 004_enable_saas_rls.sql

BLOCK 2 — Schema extensions on core tables
□  5. 035_update_customers_schema.sql
□  6. 036_update_vehicles_schema.sql
□  7. 037_rebuild_estimate_core.sql

BLOCK 3 — Operations workflow tables
□  8. 038_create_work_orders.sql
□  9. 039_create_work_order_files.sql
□ 10. 040_create_completion_reports.sql
□ 11. 041_create_invoices.sql
□ 12. 042_create_payments.sql

BLOCK 4 — Communication and settings
□ 13. 043_create_line_customers.sql
□ 14. 044_create_line_message_logs.sql
□ 15. 045_create_maintenance_reminders.sql
□ 16. 046_create_document_sequences.sql

BLOCK 5 — Product catalog (CRITICAL — many later migrations depend on this)
□ 17. 047_create_gyeon_products.sql
□ 18. 048_create_product_orders.sql

BLOCK 6 — Dealer and staff features
□ 19. 049_add_plan_to_dealers.sql
□ 20. 050_create_staff_roles.sql

BLOCK 7 — Admin system (CRITICAL — RC-12 through RC-17 depend on this)
□ 21. 051_create_admin_tables.sql

BLOCK 8 — Additional features
□ 22. 052_create_reservations.sql
□ 23. 053_create_document_files.sql
□ 24. 054_notification_activity_timeline.sql
□ 25. 055_audit_logs.sql

BLOCK 9 — Subscription management
□ 26. 058_subscription_license_management.sql
□ 27. 059_dealer_onboarding.sql

    ⚠️  SKIP 062 and 063 for production. Those are STAGING ONLY.

BLOCK 10 — Billing and OCR
□ 28. 064_billing_management.sql
□ 29. 066_company_settings.sql
□ 30. 067_vehicle_registration_ocr.sql
□ 31. 068_ocr_sessions.sql

BLOCK 11 — Inventory foundation (CRITICAL — RC-15 through RC-17 depend on this)
□ 32. 069_inventory_counting.sql
□ 33. 070_dealer_settings_canonical.sql
□ 34. 071_dealer_approval_flow.sql
□ 35. 072_inventory_receiving_movements.sql

BLOCK 12 — Schema completions
□ 36. 073_detailer_core_missing_fields.sql
□ 37. 074_dealer_trial_fields.sql

BLOCK 13 — Admin roles expansion (CRITICAL — must precede 077/078/079)
□ 38. 075_admin_roles_expansion.sql
□ 39. 076_dealer_lifecycle.sql

BLOCK 14 — Logistics admin (RC-15/16/17)
□ 40. 077_logistics_foundation.sql
□ 41. 078_stocktaking.sql
□ 42. 079_warehouse_daily_ops.sql

TOTAL: 42 production migrations
```

### 6.1 Staging-Only Addition (after step 21 in staging environment)

```
STAGING SUPPLEMENT (apply only to staging, between steps 27 and 28)
□  S1. 062_staging_verification.sql
□  S2. 063_uat_management.sql
```

---

## 7. Schema Verification Queries

Run these in Supabase SQL Editor after applying all migrations to verify completeness.

### 7.1 Verify all 45 production tables exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: at minimum the following 45 tables
-- (plus staging tables if on staging)
```

### 7.2 Verify critical columns added by recent migrations

```sql
-- Migration 077: damaged_count on inventory_receipts
SELECT column_name FROM information_schema.columns
WHERE table_name = 'inventory_receipts'
  AND column_name IN ('damaged_count', 'supplier', 'po_number', 'received_date');
-- Expected: 4 rows (damaged_count from 077, others from 079)

-- Migration 079: adjustment_reason on stock_movements
SELECT column_name FROM information_schema.columns
WHERE table_name = 'stock_movements'
  AND column_name = 'adjustment_reason';
-- Expected: 1 row

-- Migration 075: role column on admin_users
SELECT column_name FROM information_schema.columns
WHERE table_name = 'admin_users'
  AND column_name = 'role';
-- Expected: 1 row

-- Migration 071: approval_status on dealers
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers'
  AND column_name = 'approval_status';
-- Expected: 1 row

-- Migration 079: fulfilling/fulfilled statuses on product_orders
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'product_orders_status_check';
-- Expected: check_clause includes 'fulfilling' and 'fulfilled'
```

### 7.3 Verify RLS is enabled on all tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;
-- Expected: 0 rows (all tables have RLS enabled)
```

### 7.4 Verify no broken foreign keys

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
-- Review all FK targets exist
```

### 7.5 Verify critical tables have RLS policies

```sql
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Verify logistics_shipments, logistics_backorders, inventory_stocktaking_*,
-- warehouse_adjustments, po_fulfillment_lines are listed (admin-only via service role)
```

### 7.6 Verify warehouse_adjustments and po_fulfillment_lines exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('warehouse_adjustments', 'po_fulfillment_lines',
                     'inventory_stocktaking_sessions', 'inventory_stocktaking_items',
                     'logistics_shipments', 'logistics_backorders');
-- Expected: 6 rows
```

---

## 8. Code Issues — Action Required Before RC Testing

### Fix 1 (REQUIRED — `ocr_sessions` bug)

**File:** `src/lib/admin/get-dealer-detail.ts`, line 113

**Current:**
```typescript
supabase.from("ocr_sessions").select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
```

**Fix:**
```typescript
supabase.from("vehicle_registration_ocr_sessions").select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
```

**Impact:** Without this fix, the Dealer Detail page in Admin will throw a runtime database error whenever dealer stats are loaded.

---

### Fix 2 (DEFERRED — AI settings tables)

`dealer_ai_settings` and `dealer_ai_usage_log` are not yet created. The code has graceful fallback logic. These can remain deferred until the AI settings feature is formally released.

When ready, create:
- `supabase/migrations/080_dealer_ai_settings.sql` (dealer_ai_settings table)
- `supabase/migrations/081_dealer_ai_usage_log.sql` (dealer_ai_usage_log table)

---

## 9. Database Health Summary

| Category | Status | Notes |
|---|---|---|
| Migration chain completeness | ✅ Complete | All 44 SQL files present and correctly ordered |
| Intentional gaps | ✅ Documented | 005–034, 056–057, 060–061, 065 all intentional |
| Table coverage | ✅ 45/45 production tables have migrations | |
| RLS coverage | ✅ All tables have RLS enabled | Admin tables rely on service role bypass |
| Foreign key integrity | ✅ All FK targets exist | Verified via dependency graph |
| Critical code bug | 🔴 1 FOUND | `ocr_sessions` should be `vehicle_registration_ocr_sessions` |
| Pending feature tables | ⚠️ 2 deferred | `dealer_ai_settings`, `dealer_ai_usage_log` — graceful fallback active |
| Storage bucket | ⚠️ Must verify | `documents` bucket must exist in target environment |
| Documentation currency | ⚠️ Outdated | `MIGRATION_APPLICATION_ORDER.md` and `MANUAL_MIGRATION_TRACKING.md` stop at migration 059 |

---

## 10. Blockers Before Version 1.0 RC Testing

| # | Blocker | Severity | Resolution |
|---|---|---|---|
| 1 | `ocr_sessions` table name bug in `get-dealer-detail.ts:113` | 🔴 CRITICAL | Fix table name to `vehicle_registration_ocr_sessions` |
| 2 | Migrations 064–079 not tracked in `MIGRATION_APPLICATION_ORDER.md` | ⚠️ MEDIUM | Update documentation |
| 3 | All 42 production migrations must be applied to target environment | 🔴 REQUIRED | Use checklist in Section 6 |
| 4 | Storage bucket `documents` must exist | ⚠️ MEDIUM | Create via Supabase Dashboard (see `DOCUMENT_STORAGE_SETUP.md`) |
| 5 | `dealer_ai_settings` / `dealer_ai_usage_log` migrations not created | ℹ️ LOW | Deferred — fallback code active |

---

## 11. File Reference

| File | Purpose |
|---|---|
| `docs/MIGRATION_APPLICATION_ORDER.md` | Canonical application order (outdated — stops at 059) |
| `docs/MANUAL_MIGRATION_TRACKING.md` | Per-migration checklist (outdated — stops at 059) |
| `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` | How to apply migrations to staging |
| `docs/BACKUP_DATABASE.md` | Backup procedure before applying migrations |
| `docs/RLS_ARCHITECTURE.md` | RLS design rationale |
| `docs/DOCUMENT_STORAGE_SETUP.md` | Storage bucket setup instructions |
| `supabase/migrations/` | All SQL migration files |
