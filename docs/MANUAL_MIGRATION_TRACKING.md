# Manual Migration Tracking Checklist — DealerOS / GYEON Detailer Agent

> **RULES**
> - Apply ONE migration at a time
> - Apply in exact order listed below
> - Record result immediately after applying
> - STOP on first failure — do not proceed to next migration
> - NEVER apply to production using this checklist

> **Target environment**: STAGING (confirm before each session)

---

## Migration Application Log

| # | Filename | Purpose | Applied? | Applied At | Result | Verified? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `001_create_core_tables.sql` | Core tables: auth.users extension, base schema | □ | | | □ | |
| 2 | `002_enable_rls.sql` | Enable Row Level Security on all tables | □ | | | □ | |
| 3 | `003_create_dealers_and_members.sql` | dealers + dealer_members tables, RLS | □ | | | □ | |
| 4 | `004_enable_saas_rls.sql` | SaaS RLS policies for multi-tenant isolation | □ | | | □ | |
| 5 | `035_update_customers_schema.sql` | Customers table schema update | □ | | | □ | |
| 6 | `036_update_vehicles_schema.sql` | Vehicles table schema update | □ | | | □ | |
| 7 | `037_rebuild_estimate_core.sql` | Estimates + estimate_items tables | □ | | | □ | |
| 8 | `038_create_work_orders.sql` | Work orders table | □ | | | □ | |
| 9 | `039_create_work_order_files.sql` | Work order file attachments | □ | | | □ | |
| 10 | `040_create_completion_reports.sql` | Completion reports table | □ | | | □ | |
| 11 | `041_create_invoices.sql` | Invoices table | □ | | | □ | |
| 12 | `042_create_payments.sql` | Payments table | □ | | | □ | |
| 13 | `043_create_line_customers.sql` | LINE customers + dealer_settings tables | □ | | | □ | |
| 14 | `044_create_line_message_logs.sql` | LINE message logs table | □ | | | □ | |
| 15 | `045_create_maintenance_reminders.sql` | Maintenance reminders table | □ | | | □ | |
| 16 | `046_create_document_sequences.sql` | Document auto-numbering sequences | □ | | | □ | |
| 17 | `047_create_gyeon_products.sql` | GYEON product catalog table | □ | | | □ | |
| 18 | `048_create_product_orders.sql` | Product orders table | □ | | | □ | |
| 19 | `049_add_plan_to_dealers.sql` | Add plan/subscription_status/started_at/expired_at to dealers | □ | | | □ | |
| 20 | `050_create_staff_roles.sql` | dealer_staff table, staff roles, RLS | □ | | | □ | |
| 21 | `051_create_admin_tables.sql` | admin_users + admin_audit_logs tables | □ | | | □ | |
| 22 | `052_create_reservations.sql` | Reservations table + calendar_provider columns | □ | | | □ | |
| 23 | `053_create_document_files.sql` | document_files table for PDF storage | □ | | | □ | |
| 24 | `054_notification_activity_timeline.sql` | activity_logs + notifications tables | □ | | | □ | |
| 25 | `055_audit_logs.sql` | audit_logs immutable table + RLS | □ | | | □ | |
| 26 | `058_subscription_license_management.sql` | subscription_plans + dealer_subscriptions tables | □ | | | □ | |
| 27 | `059_dealer_onboarding.sql` | Onboarding + document settings columns on dealer_settings | □ | | | □ | |

---

## Numbering Gap Notice

> **Migrations 056 and 057 do not exist as SQL files.**
> Those phases contained code-only changes (no schema changes).
> The jump from 055 → 058 is intentional and correct.
> Do NOT attempt to create or apply 056 or 057 migration files.

> **File `001_create_core_tables_PASTE_ONLY.sql`** exists in the repo as a reference/backup.
> It is NOT listed above because it is superseded by `001_create_core_tables.sql`.
> Apply only `001_create_core_tables.sql` — never apply the PASTE_ONLY variant.

---

## Verification Queries Per Migration

### After #1 — 001_create_core_tables.sql

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- Verify base tables exist
```

### After #2 — 002_enable_rls.sql

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
-- Verify rowsecurity = true on core tables
```

### After #3 — 003_create_dealers_and_members.sql

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers' AND table_schema = 'public'
ORDER BY column_name;
```

### After #4 — 004_enable_saas_rls.sql

```sql
SELECT policyname, tablename FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- Verify RLS policies exist on tenant tables
```

### After #5–6 — customers, vehicles

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('customers', 'vehicles');
-- Expected: 2 rows
```

### After #7 — estimates

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('estimates', 'estimate_items');
-- Expected: 2 rows
```

### After #8–9 — work_orders, work_order_files

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('work_orders', 'work_order_files');
-- Expected: 2 rows
```

### After #10–12 — completion_reports, invoices, payments

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('completion_reports', 'invoices', 'payments');
-- Expected: 3 rows
```

### After #13–14 — LINE tables

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('line_customers', 'line_message_logs', 'dealer_settings');
-- Expected: 3 rows
```

### After #15–18 — maintenance, sequences, products, orders

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'maintenance_reminders', 'document_sequences',
    'gyeon_products', 'product_orders'
  );
-- Expected: 4 rows
```

### After #19 — plan columns on dealers

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealers' AND table_schema = 'public'
  AND column_name IN ('plan', 'subscription_status', 'started_at', 'expired_at');
-- Expected: 4 rows
```

### After #20 — staff roles

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'dealer_staff';
-- Expected: 1 row
```

### After #21 — admin tables

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_users', 'admin_audit_logs');
-- Expected: 2 rows
```

### After #22 — reservations

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'reservations';
-- Expected: 1 row
```

### After #23 — document_files

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'document_files';
-- Expected: 1 row
```

### After #24 — activity_logs, notifications

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('activity_logs', 'notifications');
-- Expected: 2 rows
```

### After #25 — audit_logs

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'audit_logs';
-- Expected: 1 row

-- Verify immutable (no DELETE policy)
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'audit_logs' AND schemaname = 'public';
```

### After #26 — subscription_plans, dealer_subscriptions

```sql
SELECT code, name, monthly_price FROM subscription_plans ORDER BY sort_order;
-- Expected 3 rows: basic (0), pro (12000), pro_plus (0)

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'dealer_subscriptions';
-- Expected: 1 row
```

### After #27 — onboarding columns

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealer_settings' AND table_schema = 'public'
  AND column_name IN (
    'onboarding_completed', 'onboarding_step', 'pdf_footer',
    'stamp_url', 'invoice_note', 'completion_note'
  )
ORDER BY column_name;
-- Expected: 6 rows

SELECT COUNT(*) FROM dealer_settings WHERE onboarding_completed = false;
-- Expected: 0 (UPDATE in migration set all to true)
```

---

## Session Log

Use this section to record each migration session:

| Date | Session By | Migrations Applied | Environment | Notes |
|---|---|---|---|---|
| | | | STAGING | |
| | | | STAGING | |

---

## See Also

- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` — how to apply each migration
- `docs/STAGING_SQL_VERIFICATION_PACK.md` — full SQL verification queries
- `docs/MIGRATION_APPLICATION_ORDER.md` — canonical ordered list
- `docs/BACKUP_DATABASE.md` — backup before each session
