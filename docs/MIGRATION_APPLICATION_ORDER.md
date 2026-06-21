# Migration Application Order — DealerOS / GYEON Detailer Agent

## Rules

1. **NEVER apply migrations automatically.** All migrations must be pasted manually into Supabase SQL Editor.
2. **Apply in numerical order only.** Never skip a number or apply out of order.
3. **Take a database backup BEFORE applying any migration** (Dashboard → Database → Backups → Download).
4. **Verify row counts AFTER each migration** (see Post-Apply Verification below).
5. **NEVER DROP legacy tables** without explicit CTO approval.
6. If a migration fails mid-way, do not retry without investigating the partial state first.

---

## Migration Files (in application order)

| # | File | Description | Applied? |
|---|---|---|---|
| 1 | `001_create_core_tables.sql` | Core tables: auth.users extension, base schema | □ |
| 2 | `002_enable_rls.sql` | Enable Row Level Security on all tables | □ |
| 3 | `003_create_dealers_and_members.sql` | dealers + dealer_members tables, RLS | □ |
| 4 | `004_enable_saas_rls.sql` | SaaS RLS policies for multi-tenant isolation | □ |
| 5 | `035_update_customers_schema.sql` | Customers table schema update | □ |
| 6 | `036_update_vehicles_schema.sql` | Vehicles table schema update | □ |
| 7 | `037_rebuild_estimate_core.sql` | Estimates + estimate_items tables | □ |
| 8 | `038_create_work_orders.sql` | Work orders table | □ |
| 9 | `039_create_work_order_files.sql` | Work order file attachments | □ |
| 10 | `040_create_completion_reports.sql` | Completion reports table | □ |
| 11 | `041_create_invoices.sql` | Invoices table | □ |
| 12 | `042_create_payments.sql` | Payments table | □ |
| 13 | `043_create_line_customers.sql` | LINE customers + dealer_settings tables | □ |
| 14 | `044_create_line_message_logs.sql` | LINE message logs table | □ |
| 15 | `045_create_maintenance_reminders.sql` | Maintenance reminders table | □ |
| 16 | `046_create_document_sequences.sql` | Document auto-numbering sequences | □ |
| 17 | `047_create_gyeon_products.sql` | GYEON product catalog table | □ |
| 18 | `048_create_product_orders.sql` | Product orders table | □ |
| 19 | `049_add_plan_to_dealers.sql` | Add plan/subscription_status/started_at/expired_at to dealers | □ |
| 20 | `050_create_staff_roles.sql` | dealer_staff table, staff roles, RLS | □ |
| 21 | `051_create_admin_tables.sql` | admin_users + admin_audit_logs tables | □ |
| 22 | `052_create_reservations.sql` | Reservations table + calendar_provider columns | □ |
| 23 | `053_create_document_files.sql` | document_files table for PDF storage | □ |
| 24 | `054_notification_activity_timeline.sql` | activity_logs + notifications tables | □ |
| 25 | `055_audit_logs.sql` | audit_logs immutable table + RLS | □ |
| 26 | `058_subscription_license_management.sql` | subscription_plans + dealer_subscriptions tables | □ |
| 27 | `059_dealer_onboarding.sql` | Onboarding + document settings columns on dealer_settings | □ |

> **Note on numbering gaps**: Migrations 056 and 057 do not exist as separate SQL files (those phases
> implemented code-only changes). The file numbers in this list are the actual filenames on disk.
> Apply files exactly as listed above — do not guess or fill in missing numbers.

---

## Pre-Apply Checklist (each migration)

```
□ Dashboard → Database → Backups → Confirm today's backup exists
□ Download a manual pg_dump backup (see docs/BACKUP_DATABASE.md)
□ Know which migration you are about to apply
□ Confirm the migration above it is already applied
□ Read the entire SQL file before applying
□ Check for DROP statements — escalate to CTO if found
□ Staging environment has been tested with this migration
```

---

## How to Apply

1. Open Supabase Dashboard → your project → **SQL Editor**
2. Click **New Query**
3. Paste the full contents of the migration file
4. Click **Run**
5. Review the output — confirm "Success" with no errors
6. Run post-apply verification queries (see below)

---

## Post-Apply Verification

Run these queries in SQL Editor after each migration block:

```sql
-- Verify key table counts (expected > 0 after a few dealers are set up)
SELECT
  (SELECT count(*) FROM dealers)               AS dealers,
  (SELECT count(*) FROM dealer_members)        AS members,
  (SELECT count(*) FROM customers)             AS customers,
  (SELECT count(*) FROM audit_logs)            AS audit_logs;

-- After migration 026 (058): verify subscription_plans seeded
SELECT code, name, monthly_price FROM subscription_plans ORDER BY sort_order;
-- Expected: basic (0), pro (12000), pro_plus (0)

-- After migration 027 (059): verify onboarding columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dealer_settings'
  AND column_name IN ('onboarding_completed', 'onboarding_step', 'pdf_footer');
-- Expected: 3 rows
```

---

## Rollback Notes

Supabase does not support transactional DDL rollback across statements. If a migration
fails partway through:

1. **Do NOT re-run the full migration** — it may have partially applied.
2. Identify which statements succeeded (check table/column existence).
3. Write a targeted fix query to complete the partial migration.
4. Or restore from the pre-apply backup and start over.

For data migrations (UPDATE statements), restore from backup is the safest path.

---

## Migration 058 — Special Notes

- Creates `subscription_plans` and `dealer_subscriptions` tables
- Seeds 3 plan records: basic, pro, pro_plus
- Extends `audit_logs.action` CHECK constraint
- **If `audit_logs` table was created with different action values** in migration 055,
  the DROP CONSTRAINT + ADD CONSTRAINT is idempotent and safe to re-run.

---

## Migration 059 — Special Notes

- Adds columns to `dealer_settings` (ALTER TABLE ADD COLUMN IF NOT EXISTS — safe to re-run)
- **Critical**: Runs `UPDATE dealer_settings SET onboarding_completed = true` for all existing rows.
  This is intentional — existing dealers must not be forced through onboarding.
- If migration is applied to an empty database (no dealers yet), the UPDATE affects 0 rows — this is fine.

---

## See Also

- `docs/BACKUP_DATABASE.md` — backup procedures before applying
- `docs/DISASTER_RECOVERY.md` — what to do if something goes wrong
- `docs/STAGING_SETUP.md` — test migrations on staging first
