# Staging Migration Execution Guide — DealerOS / GYEON Detailer Agent

> **CRITICAL**: This guide is for STAGING only.
> Production migration execution requires a separate, explicit CTO sign-off.
> NEVER apply migrations to production using this guide.

---

## Before You Begin

### Confirm Target Is STAGING

1. Open Supabase Dashboard
2. Look at the project name in the top-left corner
3. Confirm it reads your **STAGING** project name — NOT the production project
4. If you see the production project name: **STOP. Close the browser tab. Start over.**

```
□ Supabase project name confirmed as STAGING
□ URL in browser bar does NOT match production project URL
□ Staging Supabase URL differs from NEXT_PUBLIC_SUPABASE_URL in .env.local (production)
```

---

## Step 0 — Take a Backup

Even on staging, take a backup before each migration session.

```
1. Supabase Dashboard → Database → Backups
2. Click "Download" to download the most recent backup
3. Note the backup timestamp
4. Store the backup file safely (local disk or shared drive)
```

```
□ Backup downloaded before migration session started
□ Backup timestamp noted: _______________
```

---

## Step 1 — Open SQL Editor

1. Supabase Dashboard → SQL Editor
2. Click **+ New Query**
3. Leave the tab open for the entire migration session

---

## Step 2 — Identify Next Migration

Refer to `docs/MANUAL_MIGRATION_TRACKING.md` to identify the next unapplied migration.

Rules:
- Apply **only one migration at a time**
- **Never skip** a migration number
- **Never apply out of order**
- If a migration is already applied, move to the next one

---

## Step 3 — Read the SQL File Before Applying

Before pasting into SQL Editor:

```
□ Read the ENTIRE SQL file
□ Note any DROP statements — escalate to CTO if found
□ Note any data UPDATE statements — these are irreversible
□ Confirm the migration number matches what you expect
□ Confirm this migration was not previously applied (check docs/MANUAL_MIGRATION_TRACKING.md)
```

---

## Step 4 — Apply the Migration

1. Copy the full content of the migration file from `supabase/migrations/`
2. Paste into Supabase SQL Editor → New Query
3. Click **Run**
4. Wait for the result

### On Success

The SQL Editor shows: **"Success. No rows returned."** or a row count.

```
□ Migration succeeded with no errors
□ Timestamp noted: _______________
□ Result noted: _______________
```

### On Failure

If the SQL Editor shows an error:

```
□ DO NOT re-run the migration immediately
□ Read the error message carefully
□ Check which statements succeeded (inspect table/column existence below)
□ Record the partial state in docs/MANUAL_MIGRATION_TRACKING.md
□ Escalate to CTO with:
    - Migration filename
    - Error message
    - Statements that succeeded before the failure
```

**Partial failure recovery:**
- Check table existence: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
- Check column existence: `SELECT column_name FROM information_schema.columns WHERE table_name='<table>' AND table_schema='public';`
- Write a targeted fix query for the remaining statements only
- OR restore from the pre-migration backup

---

## Step 5 — Post-Migration Verification

After each migration, run the corresponding verification query from `docs/STAGING_SQL_VERIFICATION_PACK.md`.

```
□ Verification query ran successfully
□ Expected tables/columns/data confirmed
□ Row counts match expected values
```

---

## Step 6 — Record in Tracking Checklist

Update `docs/MANUAL_MIGRATION_TRACKING.md`:

```
□ Applied? column updated to ✓
□ Applied At timestamp filled in
□ Result column filled in (e.g. "Success", "Partial — see notes")
□ Notes column filled in if anything unusual occurred
```

---

## Step 7 — Repeat for Next Migration

Wait at least 1 minute between migrations to allow Supabase internals to settle.

```
□ Wait 1 minute
□ Confirm previous migration stable
□ Proceed to next migration (back to Step 2)
```

---

## Stopping Conditions

**STOP immediately if any of the following occur:**

- Error during migration that you cannot diagnose
- Unexpected DROP or TRUNCATE in the SQL output
- Row counts after migration differ drastically from expected
- Supabase Dashboard shows errors or unhealthy state
- You are unsure about anything

When stopped: record state in tracking doc, escalate to CTO.

---

## DO NOT

```
✗ Do NOT apply migrations to production using this guide
✗ Do NOT apply multiple migrations in a single SQL Editor session
✗ Do NOT skip a failed migration
✗ Do NOT re-run a failed migration without investigating partial state
✗ Do NOT DROP legacy tables
✗ Do NOT modify migration files after they have been applied
✗ Do NOT apply migrations while the application is under load
```

---

## Migration File Location

```
supabase/migrations/
```

Apply in the exact order listed in `docs/MANUAL_MIGRATION_TRACKING.md`.

---

## See Also

- `docs/MANUAL_MIGRATION_TRACKING.md` — tracking checklist per migration
- `docs/STAGING_SQL_VERIFICATION_PACK.md` — verification queries
- `docs/MIGRATION_APPLICATION_ORDER.md` — canonical ordered file list
- `docs/BACKUP_DATABASE.md` — backup procedures
- `docs/DISASTER_RECOVERY.md` — recovery procedures
