# RLS Verification Checklist — DealerOS / GYEON Detailer Agent

## Purpose

Verify Row Level Security is correctly configured on all Supabase tables before production deployment.
Run these queries in Supabase SQL Editor after all migrations are applied.

---

## 1. Verify RLS is Enabled

Run this query to confirm RLS is active on all required tables:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: `rowsecurity = true` for ALL tables below.

```
□ customers — RLS enabled
□ vehicles — RLS enabled
□ estimates — RLS enabled
□ estimate_items — RLS enabled
□ work_orders — RLS enabled
□ work_order_files — RLS enabled
□ completion_reports — RLS enabled
□ invoices — RLS enabled
□ payments — RLS enabled
□ reservations — RLS enabled
□ maintenance_reminders — RLS enabled
□ line_customers — RLS enabled
□ dealer_settings — RLS enabled
□ line_message_logs — RLS enabled
□ document_sequences — RLS enabled
□ document_files — RLS enabled
□ gyeon_products — RLS enabled
□ product_orders — RLS enabled
□ dealer_staff — RLS enabled
□ dealer_members — RLS enabled
□ dealers — RLS enabled
□ audit_logs — RLS enabled
□ activity_logs — RLS enabled
□ notifications — RLS enabled
□ admin_users — RLS enabled
□ admin_audit_logs — RLS enabled
□ subscription_plans — RLS enabled
□ dealer_subscriptions — RLS enabled
```

---

## 2. Verify Policies Exist

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Review output for:

```
□ Each dealer-scoped table has policies filtering by dealer_id
□ audit_logs — INSERT + SELECT policies only (no UPDATE, no DELETE)
□ activity_logs — INSERT + SELECT policies only
□ notifications — INSERT + SELECT policies only
□ admin_audit_logs — no client-side policies (service_role only)
□ subscription_plans — SELECT for authenticated users, no INSERT/UPDATE/DELETE from client
□ dealer_subscriptions — SELECT own rows only, no client INSERT/UPDATE/DELETE
□ admin_users — no SELECT from non-admin users
```

---

## 3. Dealer Isolation Test

Create two test dealers (Dealer A and Dealer B) and verify cross-dealer access is denied.

```sql
-- As Dealer A's user, attempt to select Dealer B's customers
-- Expected: 0 rows returned (RLS blocks it)
SELECT count(*) FROM customers WHERE dealer_id = '<dealer_b_id>';
-- Must return 0 even if rows exist for dealer B
```

```
□ Dealer A's authenticated user cannot read Dealer B's customers
□ Dealer A's authenticated user cannot read Dealer B's work_orders
□ Dealer A's authenticated user cannot read Dealer B's estimates
□ Dealer A's authenticated user cannot read Dealer B's invoices
□ Dealer A's authenticated user cannot read Dealer B's dealer_settings
□ Dealer A's authenticated user cannot read Dealer B's dealer_staff
```

---

## 4. Immutable Tables

Verify audit and activity logs cannot be modified or deleted:

```sql
-- Test: attempt UPDATE on audit_logs — must fail
UPDATE audit_logs SET action = 'test' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
-- Expected: ERROR: new row violates row-level security policy

-- Test: attempt DELETE on audit_logs — must fail
DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1);
-- Expected: ERROR: new row violates row-level security policy
```

```
□ UPDATE on audit_logs is denied for all users
□ DELETE on audit_logs is denied for all users
□ UPDATE on activity_logs is denied for all users
□ DELETE on activity_logs is denied for all users
```

---

## 5. Admin Table Access

```sql
-- Admin users table should not be accessible without service_role
SELECT count(*) FROM admin_users;
-- Expected: 0 rows returned (RLS restricts access) OR permission denied error
```

```
□ admin_users not readable by regular authenticated users
□ admin_audit_logs not readable/writable by regular authenticated users
□ dealer_subscriptions INSERT/UPDATE not possible from anon key client
```

---

## 6. Public Access Check

No table should be fully publicly accessible without authentication:

```sql
-- Run as unauthenticated (using anon key with no JWT)
SELECT count(*) FROM customers;
-- Expected: 0 rows OR permission denied
```

```
□ No table returns rows to unauthenticated requests
□ No accidental "public" SELECT policy exists on any table
□ subscription_plans requires authentication (not fully public)
```

---

## 7. dealer_members Status Check

Access should require `dealer_members.status = 'active'`:

```sql
-- Verify the RLS policy on a table checks active membership
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'customers'
  AND schemaname = 'public';
-- Look for 'active' in qual
```

```
□ RLS policies require dealer_members.status = 'active'
□ Suspended/pending members cannot access dealer data
```

---

## See Also

- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `supabase/migrations/002_enable_rls.sql`
- `supabase/migrations/004_enable_saas_rls.sql`
- `supabase/migrations/055_audit_logs.sql`
- `supabase/migrations/058_subscription_license_management.sql`
