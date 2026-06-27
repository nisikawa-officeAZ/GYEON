# RC-03: OCR Sessions Migration — Manual Apply Guide

> **DO NOT run this automatically. Paste the SQL into Supabase SQL Editor manually.**

---

## File to Apply

```
supabase/migrations/068_ocr_sessions.sql
```

---

## Migration Review Findings (RC-03)

| Item | Status | Notes |
|---|---|---|
| Table name | ✅ Correct | `vehicle_registration_ocr_sessions` |
| `dealer_id NOT NULL` | ✅ Present | Required on all rows |
| RLS enabled | ✅ Yes | `ENABLE ROW LEVEL SECURITY` |
| RLS policies | ✅ Dealer-scoped | SELECT / INSERT / UPDATE via `dealer_members` join |
| Public access | ✅ None | No policy for anonymous or public roles |
| DELETE policy | ✅ Intentionally absent | Use `status = 'abandoned'` instead of delete |
| Indexes | ✅ Appropriate | dealer_id, dealer+status, customer_id, vehicle_id, created_at DESC, files.session_id |
| `customer_id` FK | ✅ Safe | `ON DELETE SET NULL` — no cascade delete |
| `vehicle_id` FK | ✅ Safe | `ON DELETE SET NULL` — no cascade delete |
| `primary_file_id` FK | ✅ Safe | `ON DELETE SET NULL` |
| `status` CHECK constraint | ✅ Correct | `draft / processing / reviewing / completed / abandoned` |
| `reviewed_result` type | ✅ JSONB with default `'{}'` | Stores user-corrected OCR data |
| `updated_at` trigger | ✅ Present | Auto-updates on every UPDATE |
| ALTER TABLE (file link) | ✅ `IF NOT EXISTS` | Safe to re-run; existing rows get `session_id = NULL` |

**Conclusion: No hardening migration required. Apply 068 as-is.**

---

## Steps to Apply

### 1. Open Supabase SQL Editor

Go to: **Supabase Dashboard → SQL Editor → New query**

### 2. Copy and paste the full content of:

```
supabase/migrations/068_ocr_sessions.sql
```

### 3. Click **Run**

Expected output in the SQL Editor:

```
Success. No rows returned.
```

No error messages should appear.

---

## Verification Queries

After applying, run these in the SQL Editor to confirm success.

### Confirm table exists

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'vehicle_registration_ocr_sessions';
```

Expected: 1 row returned with `table_type = 'BASE TABLE'`

### Confirm session_id column added to files table

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicle_registration_files'
  AND column_name = 'session_id';
```

Expected: 1 row returned

### Confirm RLS is enabled

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'vehicle_registration_ocr_sessions';
```

Expected: `relrowsecurity = true`

### Confirm all 3 RLS policies exist

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'vehicle_registration_ocr_sessions'
ORDER BY policyname;
```

Expected: 3 rows — `ocr_sessions_insert`, `ocr_sessions_select`, `ocr_sessions_update`

### Confirm indexes exist

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('vehicle_registration_ocr_sessions', 'vehicle_registration_files')
  AND indexname LIKE '%ocr_session%'
ORDER BY indexname;
```

Expected: 6 rows — all indexes from the migration

---

## Functional Verification Checklist

After the migration is applied, test the following using the app:

- [ ] **Create OCR session** — Scan/upload a vehicle registration image in the onboarding wizard; verify the OCR session badge shows "OCRセッション保存済み ✓" (green)
- [ ] **Confirm session record exists** — Run in SQL Editor:
  ```sql
  SELECT id, dealer_id, status, primary_file_id, created_at
  FROM vehicle_registration_ocr_sessions
  ORDER BY created_at DESC
  LIMIT 5;
  ```
- [ ] **Confirm dealer_id is correct** — The `dealer_id` in the returned rows must match the authenticated dealer's ID (never null, never a different dealer's ID)
- [ ] **Confirm file link** — Run:
  ```sql
  SELECT id, session_id, ocr_status
  FROM vehicle_registration_files
  WHERE session_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 5;
  ```
- [ ] **Confirm AI parsed result persists** — After OCR analysis, the `primary_file_id` row in `vehicle_registration_files` should have `ocr_status = 'reviewing'` and `ocr_result` populated
- [ ] **Complete review** — Finish the wizard (create customer + vehicle); the session `status` should update to `'completed'` and `customer_id` / `vehicle_id` should be set:
  ```sql
  SELECT id, status, customer_id, vehicle_id, completed_at
  FROM vehicle_registration_ocr_sessions
  WHERE status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 3;
  ```
- [ ] **No cross-dealer access** — Confirm that logging in as a different dealer cannot see the first dealer's sessions (RLS enforcement)

---

## Behavior Before Migration is Applied

The app handles the missing table gracefully:

| Action | Behavior without migration |
|---|---|
| Upload + OCR analysis | ✅ Works normally (uses `vehicle_registration_files` only) |
| Session creation (internal) | Returns descriptive error, silently ignored |
| OCR review badge | Shows "OCRセッション未保存（マイグレーション 068 未適用）" in grey |
| Customer/vehicle creation | ✅ Not affected |
| `getRecentOcrSessions()` | Returns empty array |

No crashes. No data corruption.

---

## Rollback Caution

If rollback is needed:

```sql
-- Step 1: Remove session_id column from files table
ALTER TABLE vehicle_registration_files
  DROP COLUMN IF EXISTS session_id;

-- Step 2: Drop policies
DROP POLICY IF EXISTS "ocr_sessions_select" ON vehicle_registration_ocr_sessions;
DROP POLICY IF EXISTS "ocr_sessions_insert" ON vehicle_registration_ocr_sessions;
DROP POLICY IF EXISTS "ocr_sessions_update" ON vehicle_registration_ocr_sessions;

-- Step 3: Drop trigger + function
DROP TRIGGER  IF EXISTS set_ocr_sessions_updated_at    ON vehicle_registration_ocr_sessions;
DROP FUNCTION IF EXISTS update_ocr_sessions_updated_at();

-- Step 4: Drop indexes
DROP INDEX IF EXISTS ocr_sessions_dealer_id_idx;
DROP INDEX IF EXISTS ocr_sessions_dealer_status_idx;
DROP INDEX IF EXISTS ocr_sessions_customer_id_idx;
DROP INDEX IF EXISTS ocr_sessions_vehicle_id_idx;
DROP INDEX IF EXISTS ocr_sessions_created_at_idx;
DROP INDEX IF EXISTS vehicle_registration_files_session_id_idx;

-- Step 5: Drop table
DROP TABLE IF EXISTS vehicle_registration_ocr_sessions;
```

> **Warning:** Step 5 permanently deletes all OCR session records. Only run this if you are certain session data can be discarded.
