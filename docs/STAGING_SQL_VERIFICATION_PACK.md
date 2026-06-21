# Staging SQL Verification Pack — DealerOS / GYEON Detailer Agent

Run these queries in Supabase SQL Editor (staging project) to verify migrations were applied correctly.
Each section corresponds to specific migrations. Run each section after the relevant migration(s) are applied.

---

## 1. All Tables Exist

Run after all 27 migrations are applied:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables (must all appear):

```
□ activity_logs
□ admin_audit_logs
□ admin_users
□ audit_logs
□ completion_reports
□ customers
□ dealer_members
□ dealer_settings
□ dealer_staff
□ dealer_subscriptions
□ dealers
□ document_files
□ document_sequences
□ estimate_items
□ estimates
□ gyeon_products
□ invoices
□ line_customers
□ line_message_logs
□ maintenance_reminders
□ notifications
□ payments
□ product_orders
□ reservations
□ subscription_plans
□ vehicles
□ work_order_files
□ work_orders
```

---

## 2. RLS Enabled on All Tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: `rowsecurity = true` for every row in the result.

```
□ All tables show rowsecurity = true
□ No table shows rowsecurity = false
```

---

## 3. Core Schema Verification

### After migration 001 (001_create_core_tables.sql)

```sql
-- Verify auth schema extension
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('dealers', 'dealer_members');
-- Expected: 2
```

### After migration 003 (003_create_dealers_and_members.sql)

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers' AND table_schema = 'public'
ORDER BY column_name;
-- Expected columns include: id, name, created_at, plan, etc.
```

---

## 4. Customers and Vehicles

### After migrations 035, 036

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'customers' AND table_schema = 'public'
ORDER BY column_name;
-- Expected: id, dealer_id, name, email, phone, created_at, etc.

SELECT column_name FROM information_schema.columns
WHERE table_name = 'vehicles' AND table_schema = 'public'
ORDER BY column_name;
-- Expected: id, dealer_id, customer_id, plate_number, make, model, year, etc.
```

---

## 5. Estimates

### After migration 037 (037_rebuild_estimate_core.sql)

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('estimates', 'estimate_items') AND table_schema = 'public'
ORDER BY table_name, column_name;

-- Verify foreign key
SELECT COUNT(*) FROM information_schema.table_constraints
WHERE table_name = 'estimate_items'
  AND constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public';
-- Expected: >= 1
```

---

## 6. Work Orders and File Attachments

### After migrations 038, 039

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('work_orders', 'work_order_files');
-- Expected: 2 rows

SELECT column_name FROM information_schema.columns
WHERE table_name = 'work_orders' AND table_schema = 'public'
ORDER BY column_name;
```

---

## 7. Completion Reports, Invoices, Payments

### After migrations 040, 041, 042

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('completion_reports', 'invoices', 'payments');
-- Expected: 3 rows
```

---

## 8. LINE Tables

### After migrations 043, 044

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('line_customers', 'line_message_logs', 'dealer_settings');
-- Expected: 3 rows

SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealer_settings' AND table_schema = 'public'
ORDER BY column_name;
-- Expected: dealer_id, business_name, business_phone, business_email, business_address,
--           logo_url, line_enabled, line_liff_id, webhook_url, tax_rate, etc.
```

---

## 9. Maintenance Reminders, Document Sequences, GYEON Products

### After migrations 045, 046, 047

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('maintenance_reminders', 'document_sequences', 'gyeon_products');
-- Expected: 3 rows
```

---

## 10. Product Orders

### After migration 048

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'product_orders';
-- Expected: 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'product_orders' AND table_schema = 'public'
ORDER BY column_name;
```

---

## 11. Plan Columns on Dealers

### After migration 049 (049_add_plan_to_dealers.sql)

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers' AND table_schema = 'public'
  AND column_name IN ('plan', 'subscription_status', 'started_at', 'expired_at');
-- Expected: 4 rows
```

---

## 12. Staff Roles

### After migration 050 (050_create_staff_roles.sql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'dealer_staff';
-- Expected: 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealer_staff' AND table_schema = 'public'
ORDER BY column_name;
```

---

## 13. Admin Tables

### After migration 051 (051_create_admin_tables.sql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_users', 'admin_audit_logs');
-- Expected: 2 rows
```

---

## 14. Reservations

### After migration 052 (052_create_reservations.sql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'reservations';
-- Expected: 1 row

-- Also verify calendar_provider columns on dealers
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers' AND table_schema = 'public'
  AND column_name LIKE '%calendar%';
```

---

## 15. Document Files

### After migration 053 (053_create_document_files.sql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'document_files';
-- Expected: 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'document_files' AND table_schema = 'public'
ORDER BY column_name;
-- Expected: id, dealer_id, document_type, document_id, file_path, is_active, created_at, etc.
```

---

## 16. Activity Logs and Notifications

### After migration 054 (054_notification_activity_timeline.sql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('activity_logs', 'notifications');
-- Expected: 2 rows
```

---

## 17. Audit Logs (Immutable)

### After migration 055 (055_audit_logs.sql)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'audit_logs';
-- Expected: 1 row

-- Verify immutability: no DELETE policy
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'audit_logs' AND schemaname = 'public';
-- Expected: policies for INSERT and SELECT only — no UPDATE, no DELETE

-- Verify CHECK constraint on action
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%audit_logs%'
  AND constraint_schema = 'public';
```

---

## 18. Subscription Plans (migration 058)

### After migration 058 (058_subscription_license_management.sql)

```sql
-- Tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('subscription_plans', 'dealer_subscriptions');
-- Expected: 2 rows

-- Plans seeded
SELECT code, name, monthly_price FROM subscription_plans ORDER BY sort_order;
-- Expected 3 rows:
--   basic    | ベーシック  | 0
--   pro      | プロ        | 12000
--   pro_plus | プロプラス  | 0 (or configured price)

-- Verify RLS on dealer_subscriptions
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'dealer_subscriptions' AND schemaname = 'public';
-- Expected: SELECT policy exists, no client-side INSERT/UPDATE/DELETE
```

```
□ subscription_plans table exists
□ dealer_subscriptions table exists
□ 3 plan records seeded: basic, pro, pro_plus
□ RLS policies verified
```

---

## 19. Onboarding Columns (migration 059)

### After migration 059 (059_dealer_onboarding.sql)

```sql
-- Verify new columns on dealer_settings
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealer_settings' AND table_schema = 'public'
  AND column_name IN (
    'onboarding_completed', 'onboarding_completed_at', 'onboarding_step',
    'stamp_url', 'pdf_footer', 'invoice_note', 'completion_note',
    'tax_rate', 'business_website', 'terms_and_conditions'
  )
ORDER BY column_name;
-- Expected: 10 rows

-- Verify existing dealers were marked complete
SELECT COUNT(*) FROM dealer_settings WHERE onboarding_completed = false;
-- Expected: 0 (migration UPDATE set all existing rows to true)
```

```
□ 10 new columns present on dealer_settings
□ 0 dealers stuck with onboarding_completed=false (migration 059 UPDATE applied correctly)
```

---

## 20. Indexes

```sql
-- Check dealer_id indexes exist on key tables
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%dealer_id%'
ORDER BY tablename;

-- Check created_at indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%created_at%'
ORDER BY tablename;
```

---

## 21. Storage Bucket

Run in SQL Editor (or check via Supabase Dashboard → Storage):

```sql
-- Check via storage schema
SELECT name, public FROM storage.buckets;
-- Expected: "documents" bucket with public = false
```

```
□ "documents" bucket exists
□ public = false (private bucket)
```

---

## 22. Full Row Count Summary

Run this after all migrations are applied to get a quick health overview:

```sql
SELECT
  (SELECT count(*) FROM dealers)               AS dealers,
  (SELECT count(*) FROM dealer_members)        AS dealer_members,
  (SELECT count(*) FROM customers)             AS customers,
  (SELECT count(*) FROM vehicles)              AS vehicles,
  (SELECT count(*) FROM estimates)             AS estimates,
  (SELECT count(*) FROM work_orders)           AS work_orders,
  (SELECT count(*) FROM invoices)              AS invoices,
  (SELECT count(*) FROM audit_logs)            AS audit_logs,
  (SELECT count(*) FROM subscription_plans)    AS subscription_plans,
  (SELECT count(*) FROM dealer_subscriptions)  AS dealer_subscriptions;
```

Expected after test dealer setup:
- `dealers` ≥ 2 (Test Osaka, Test Tokyo)
- `subscription_plans` = 3
- Other counts ≥ 0

---

## See Also

- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md`
- `docs/MANUAL_MIGRATION_TRACKING.md`
- `docs/MIGRATION_APPLICATION_ORDER.md`
- `docs/RLS_VERIFICATION_CHECKLIST.md`
