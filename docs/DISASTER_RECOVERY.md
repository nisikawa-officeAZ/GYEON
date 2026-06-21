# Disaster Recovery Runbook — DealerOS / GYEON Detailer Agent

## Overview

This runbook covers recovery procedures for complete or partial service
outages. Follow the steps in order. Each section is independently executable.

**RTO target**: < 4 hours for full restoration  
**RPO target**: < 24 hours (daily backup cadence)

---

## 1. Severity Assessment

| Severity | Symptoms | Action |
|---|---|---|
| **P1 — Total outage** | App unreachable, DB down | Full recovery (section 4) |
| **P2 — Data loss** | Tables missing or corrupt | DB restore (section 5) |
| **P3 — Storage loss** | PDFs missing | Storage restore (section 6) |
| **P4 — Auth broken** | Cannot log in | Auth recovery (section 7) |
| **P5 — Degraded** | Health check warnings | Component fix (section 8) |

---

## 2. First Response Checklist

```
□ Check SystemHealthCard at /admin — note which components are red
□ Check Supabase Dashboard → Project → Reports for DB errors
□ Check Vercel Dashboard → Deployments for build/runtime errors
□ Check Vercel → Functions → Logs for server action errors
□ Identify approximate time of incident (for backup selection)
```

---

## 3. Communication

- Notify affected dealers via email / LINE broadcast if downtime > 30 min
- Keep internal incident log (time, action taken, result)
- Post-incident: update `docs/RECOVERY_CHECKLIST.md` with lessons learned

---

## 4. Full Service Recovery

### Step 1 — Provision New Supabase Project (if needed)

1. Create new project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Note new Project URL and API keys
3. Update Vercel environment variables (see `docs/ENVIRONMENT_BACKUP.md`)

### Step 2 — Apply Database Schema

```bash
# Apply all migrations in order
supabase link --project-ref $NEW_PROJECT_REF
supabase db push
```

Or manually apply SQL files from `supabase/migrations/` in numerical order.

### Step 3 — Restore Data

See section 5 below.

### Step 4 — Restore Storage

See section 6 below.

### Step 5 — Redeploy Application

```bash
vercel --prod
```

### Step 6 — Verify

- Open `/admin` → SystemHealthCard → confirm all green
- Log in as a test dealer → verify customers, work orders, PDFs accessible
- Generate a test PDF → confirm Storage upload works

---

## 5. Database Restore

```bash
# Download latest backup from Supabase Dashboard
# OR use manual dump (see docs/BACKUP_DATABASE.md)

# Restore to new project
pg_restore \
  --dbname="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  backup_dealeros_YYYYMMDD.dump

# Verify critical tables
psql "$DB_URL" -c "
  SELECT
    (SELECT count(*) FROM dealers)      AS dealers,
    (SELECT count(*) FROM customers)    AS customers,
    (SELECT count(*) FROM audit_logs)   AS audit_logs;
"
```

**Do NOT restore `audit_logs` or `activity_logs` with `--clean`** if you want
to preserve compliance history. Use selective table restore instead:

```bash
pg_restore \
  --dbname="$DB_URL" \
  --table=dealers \
  --table=customers \
  --table=vehicles \
  --table=work_orders \
  backup_dealeros_YYYYMMDD.dump
```

---

## 6. Storage Restore

```bash
# See docs/BACKUP_STORAGE.md for full download procedure

# Re-upload to new bucket
supabase storage cp \
  --recursive \
  ./storage_backup_YYYYMMDD/ \
  ss://documents/

# Verify signed URL generation
curl -X POST "$SUPABASE_URL/storage/v1/object/sign/documents/[TEST_PATH].pdf" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{"expiresIn":60}'
```

---

## 7. Auth Recovery

### Cannot log in (all users)

1. Check Supabase Dashboard → Authentication → Users — are users present?
2. If Supabase Auth is down, check [Supabase Status](https://status.supabase.com)
3. If users are missing, restore `auth.users` from backup (contact Supabase support)

### Single user locked out

```sql
-- In Supabase SQL Editor (service_role)
UPDATE auth.users
SET encrypted_password = crypt('TempPassword123!', gen_salt('bf'))
WHERE email = 'user@example.com';
```

Or use Admin → Users → **パスワードリセット** to send recovery email.

### Admin user locked out

```sql
-- Verify admin_users entry exists
SELECT * FROM admin_users WHERE email = 'admin@example.com';

-- Re-create if missing (after restoring auth.users)
INSERT INTO admin_users (user_id, email, name, role)
SELECT id, email, email, 'super_admin'
FROM auth.users
WHERE email = 'admin@example.com';
```

---

## 8. Component-Level Fixes

### Supabase DB — warning (42P01 table not found)

Migration not applied. Run:

```bash
supabase db push
```

### Storage — 'documents' bucket missing

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
```

### LINE — 設定不完全

Add missing env vars to Vercel → Environment Variables, then redeploy.

### Environment variables — missing

Check `docs/ENVIRONMENT_BACKUP.md` for where to retrieve each key.
Add to Vercel → Environment Variables → redeploy.

---

## 9. Post-Recovery Verification

```
□ /admin SystemHealthCard — all green
□ /login → dealer login works
□ /customers → customer list loads
□ /work-orders → work order list loads
□ PDF generation → new PDF uploads to Storage
□ /admin/audit → audit log shows recent entries
□ Notification bell → shows recent notifications
```

---

## See Also

- `docs/BACKUP_DATABASE.md`
- `docs/BACKUP_STORAGE.md`
- `docs/ENVIRONMENT_BACKUP.md`
- `docs/STAGING_SETUP.md`
- `docs/RECOVERY_CHECKLIST.md`
