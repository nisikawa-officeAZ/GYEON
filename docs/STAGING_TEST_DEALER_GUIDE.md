# Staging Test Dealer Creation Guide — DealerOS / GYEON Detailer Agent

## Purpose

Create two isolated test dealers on staging to verify multi-tenant isolation, RLS, and feature gates.

> All steps below use the **STAGING** Supabase project.
> Never create test dealers in production.

---

## Prerequisites

- All 27 migrations applied (see `docs/MANUAL_MIGRATION_TRACKING.md`)
- At least one super admin user exists in `admin_users` table
- Staging environment running at staging URL

---

## Part A — Create Test Dealers

### Dealer A — GYEON Test Osaka

| Field | Value |
|---|---|
| Business Name | GYEON Test Osaka |
| Email | osaka@gyeon-test.local |
| Phone | 06-0000-0001 |
| Address | 大阪府大阪市北区テスト町1-1 |
| Plan | pro |

### Dealer B — GYEON Test Tokyo

| Field | Value |
|---|---|
| Business Name | GYEON Test Tokyo |
| Email | tokyo@gyeon-test.local |
| Phone | 03-0000-0001 |
| Address | 東京都渋谷区テスト町1-1 |
| Plan | basic |

---

## Part B — Create Test Users

### User 1 — Owner A (belongs to Dealer A)

| Field | Value |
|---|---|
| Email | owner-a@gyeon-test.local |
| Role | owner |
| Dealer | GYEON Test Osaka |

Steps:
1. Supabase Dashboard → Authentication → Users → Invite user
2. Enter `owner-a@gyeon-test.local`
3. After user is created, insert dealer_members row:

```sql
-- Replace <user_id_a> with the actual auth.users.id for Owner A
-- Replace <dealer_a_id> with the dealers.id for GYEON Test Osaka
INSERT INTO dealer_members (user_id, dealer_id, role, status)
VALUES ('<user_id_a>', '<dealer_a_id>', 'owner', 'active');
```

### User 2 — Staff A (belongs to Dealer A)

| Field | Value |
|---|---|
| Email | staff-a@gyeon-test.local |
| Role | staff |
| Dealer | GYEON Test Osaka |

```sql
INSERT INTO dealer_members (user_id, dealer_id, role, status)
VALUES ('<user_id_staff_a>', '<dealer_a_id>', 'staff', 'active');
```

### User 3 — Owner B (belongs to Dealer B)

| Field | Value |
|---|---|
| Email | owner-b@gyeon-test.local |
| Role | owner |
| Dealer | GYEON Test Tokyo |

```sql
INSERT INTO dealer_members (user_id, dealer_id, role, status)
VALUES ('<user_id_b>', '<dealer_b_id>', 'owner', 'active');
```

---

## Part C — Create Test Data

### Dealer A — Test Data

Login as Owner A and create:

```
□ 1 customer: テスト顧客A (customer-a@test.local, 06-1111-1111)
□ 1 vehicle for the customer: トヨタ プリウス 2023年 / plate: 大阪 300 テ 0001
□ 1 estimate: 洗車フルコース + GYEON モーション 50ml
□ 1 work order linked to the estimate
□ 1 completion report linked to the work order
□ 1 invoice linked to the work order
```

### Dealer B — Test Data

Login as Owner B and create:

```
□ 1 customer: テスト顧客B (customer-b@test.local, 03-2222-2222)
□ 1 vehicle for the customer: ホンダ N-BOX 2022年 / plate: 品川 500 ア 0001
□ 1 estimate: ボディーコーティング施工
```

---

## Part D — Multi-Tenant Isolation Verification

### Test 1: Dealer A cannot see Dealer B's customers

1. Login as Owner A (`owner-a@gyeon-test.local`)
2. Go to /customers
3. Verify: テスト顧客B does **NOT** appear in the list

```
□ Owner A: テスト顧客B not visible in /customers
```

### Test 2: Dealer A cannot see Dealer B's estimates

1. Login as Owner A
2. Go to /estimates
3. Verify: Dealer B's estimate does **NOT** appear

```
□ Owner A: Dealer B's estimate not visible in /estimates
```

### Test 3: Dealer B cannot see Dealer A's invoices

1. Login as Owner B (`owner-b@gyeon-test.local`)
2. Go to /invoices
3. Verify: Dealer A's invoice does **NOT** appear

```
□ Owner B: Dealer A's invoice not visible in /invoices
```

### Test 4: Staff A cannot access Admin

1. Login as Staff A (`staff-a@gyeon-test.local`)
2. Navigate to `/admin`
3. Verify: redirected to `/login` (not admin console)

```
□ Staff A: /admin access denied (redirect to /login)
```

### Test 5: Owner can manage own dealer only

1. Login as Owner A
2. Go to /settings
3. Verify: Only GYEON Test Osaka settings visible
4. Verify: No option to switch to or view GYEON Test Tokyo

```
□ Owner A: Only Osaka dealer settings visible
□ Owner A: No access to Tokyo dealer data
```

### Test 6: Super Admin can view all dealers

1. Login as Super Admin in admin console
2. Go to /admin/dealers
3. Verify: Both "GYEON Test Osaka" and "GYEON Test Tokyo" appear in the list

```
□ Super Admin: both test dealers visible in /admin/dealers
```

---

## Part E — Subscription Feature Gate Verification

Dealer B is on the `basic` plan. Verify Pro features are gated:

1. Login as Owner B
2. Navigate to `/work-orders`
3. Expected: FeatureLocked screen ("Pro プランが必要です")
4. Navigate to `/invoices`
5. Expected: FeatureLocked screen

```
□ Owner B (basic plan): /work-orders shows FeatureLocked
□ Owner B (basic plan): /invoices shows FeatureLocked
□ Owner B (basic plan): /reservations shows FeatureLocked
□ Owner B (basic plan): /maintenance shows FeatureLocked
□ Owner B (basic plan): /line shows FeatureLocked
```

Dealer A is on the `pro` plan. Verify Pro Plus features are still gated:

1. Login as Owner A
2. Navigate to `/line`
3. Expected: FeatureLocked screen ("Pro Plusプランが必要です")

```
□ Owner A (pro plan): /line shows FeatureLocked for Pro Plus
```

---

## Part F — RLS Direct SQL Test

Run in Supabase SQL Editor using Owner A's JWT (or switch to Supabase RLS test mode):

```sql
-- Set auth context to Owner A
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<user_id_a>", "role": "authenticated"}';

-- Attempt to read Dealer B's customers
SELECT * FROM customers WHERE dealer_id = '<dealer_b_id>';
-- Expected: 0 rows
```

```
□ Direct SQL with Owner A JWT returns 0 rows for Dealer B's customers
```

---

## Teardown (After Verification)

Test dealers can be left on staging for continued testing, OR removed:

```sql
-- To remove test data (staging only):
-- WARNING: This deletes all data for the test dealer. Staging only.
-- DELETE FROM dealer_members WHERE dealer_id IN ('<dealer_a_id>', '<dealer_b_id>');
-- DELETE FROM dealers WHERE id IN ('<dealer_a_id>', '<dealer_b_id>');
-- Delete auth users from Supabase Dashboard → Authentication → Users
```

---

## See Also

- `docs/STAGING_SMOKE_TEST_CHECKLIST.md`
- `docs/RLS_VERIFICATION_CHECKLIST.md`
- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md`
