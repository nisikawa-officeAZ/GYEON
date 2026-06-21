# Database Backup — DealerOS / GYEON Detailer Agent

## Overview

Supabase automatically creates daily backups for Pro plan projects. This document
describes how to verify, download, and restore those backups.

---

## 1. Supabase Managed Backups (Pro Plan)

| Item | Detail |
|---|---|
| Frequency | Daily (00:00 UTC) |
| Retention | 7 days (Pro), 30 days (Pro+) |
| Location | Supabase Dashboard → Project → Database → Backups |

### 1-1. Verify Latest Backup

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the project
3. Go to **Database → Backups**
4. Confirm a backup entry exists for today's date

### 1-2. Download a Backup

```bash
# Via Supabase CLI
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f backup_$(date +%Y%m%d).sql
```

Or download directly from the Dashboard → Backups → **Download**.

---

## 2. Manual Backup (pg_dump)

Run from any machine with `psql` / `pg_dump` installed.

```bash
export DB_URL="postgresql://postgres:[SERVICE_ROLE_PASSWORD]@[HOST]:5432/postgres"

# Full schema + data
pg_dump "$DB_URL" \
  --format=custom \
  --no-acl \
  --no-owner \
  -f "backup_dealeros_$(date +%Y%m%d_%H%M%S).dump"

# Schema only
pg_dump "$DB_URL" \
  --schema-only \
  -f "schema_dealeros_$(date +%Y%m%d).sql"
```

Connection details are in the Supabase Dashboard → Project Settings → Database.

---

## 3. Verify Backup Integrity

```bash
# List tables in dump
pg_restore --list backup_dealeros_YYYYMMDD.dump | grep "TABLE DATA"

# Quick row count check after restore to staging
psql "$STAGING_DB_URL" -c "
  SELECT
    (SELECT count(*) FROM dealers)      AS dealers,
    (SELECT count(*) FROM customers)    AS customers,
    (SELECT count(*) FROM work_orders)  AS work_orders,
    (SELECT count(*) FROM audit_logs)   AS audit_logs;
"
```

---

## 4. Restore Procedure

> **Warning**: Restore overwrites existing data. Always restore to a staging
> environment first to verify integrity before touching production.

```bash
# 1. Restore to staging
pg_restore \
  --dbname="$STAGING_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  backup_dealeros_YYYYMMDD.dump

# 2. Verify (see section 3 above)

# 3. If staging looks good, restore to production
pg_restore \
  --dbname="$PROD_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  backup_dealeros_YYYYMMDD.dump
```

---

## 5. Critical Tables

| Table | Notes |
|---|---|
| `dealers` | Tenant root — restore this first |
| `dealer_staff` | Roles & permissions |
| `customers` / `vehicles` | Core business data |
| `work_orders` / `estimates` | Revenue records |
| `audit_logs` | Immutable compliance log — do NOT truncate |
| `activity_logs` | Immutable activity timeline |
| `document_sequences` | Auto-numbering counters |

---

## 6. Automated Backup Check (Cron)

Add a weekly check to verify Supabase backups are running:

```bash
# Runs every Monday 09:00 JST
0 0 * * 1 curl -s "https://api.supabase.com/v1/projects/$PROJECT_REF/database/backups" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq '.[] | .inserted_at' | head -1
```

---

## See Also

- `docs/DISASTER_RECOVERY.md` — full recovery runbook
- `docs/STAGING_SETUP.md` — how to spin up a staging environment
- `docs/RECOVERY_CHECKLIST.md` — step-by-step recovery checklist
