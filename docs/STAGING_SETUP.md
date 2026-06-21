# Staging Environment Setup — DealerOS / GYEON Detailer Agent

## Overview

A staging environment mirrors production and is used to:
- Verify migrations before applying to production
- Test new features with real-ish data
- Validate disaster recovery procedures

---

## 1. Architecture

```
Production:  Vercel (prod branch)   → Supabase Project A
Staging:     Vercel (staging branch) → Supabase Project B
Local:       localhost:3000           → Supabase Project B (same as staging)
```

Staging and local share the same Supabase project to reduce cost.

---

## 2. Create Staging Supabase Project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Name: `dealeros-staging`
3. Region: Same as production (ap-northeast-1 for Japan)
4. Note the credentials:
   - Project URL
   - anon key
   - service_role key

---

## 3. Apply Migrations to Staging

```bash
# Link CLI to staging project
supabase link --project-ref $STAGING_PROJECT_REF

# Apply all migrations
supabase db push

# Verify
supabase db diff   # should show no diff after push
```

---

## 4. Seed Staging Data

```bash
# Create a test dealer account via Supabase Auth
# (use Supabase Dashboard → Authentication → Users → Add User)

# Then seed via SQL
psql "$STAGING_DB_URL" << 'EOF'
-- Test dealer
INSERT INTO dealers (id, name, plan, owner_user_id)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'テストディーラー株式会社',
  'pro',
  '[AUTH_USER_ID]'
);

-- Test customer
INSERT INTO customers (dealer_id, name, email, phone)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'テスト 太郎',
  'test@example.com',
  '090-0000-0000'
);
EOF
```

---

## 5. Create Staging Bucket

```sql
-- Run in Supabase SQL Editor (staging project)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
```

---

## 6. Vercel Staging Deployment

### Option A — Preview Deployments (Recommended)

Vercel automatically creates preview deployments for every branch/PR.
Add staging env vars in Vercel → Settings → Environment Variables →
select **Preview** environment.

### Option B — Dedicated Staging URL

1. Create a `staging` branch: `git checkout -b staging`
2. In Vercel → Project → Settings → **Git** → add staging branch
3. Vercel assigns a stable staging URL

---

## 7. Staging Environment Variables

Create `.env.staging` locally (gitignored):

```bash
# Supabase — STAGING project
NEXT_PUBLIC_SUPABASE_URL=https://[STAGING_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[STAGING_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[STAGING_SERVICE_ROLE_KEY]

# LINE — use test channel or same as prod
LINE_CHANNEL_ID=[TEST_CHANNEL_ID]
LINE_CHANNEL_SECRET=[TEST_CHANNEL_SECRET]
LINE_CHANNEL_ACCESS_TOKEN=[TEST_ACCESS_TOKEN]
NEXT_PUBLIC_LIFF_ID=[TEST_LIFF_ID]

# App
NEXT_PUBLIC_APP_URL=https://[STAGING_VERCEL_URL]
STORAGE_BUCKET=documents
CRON_SECRET=[STAGING_CRON_SECRET]
```

Add these to Vercel → Environment Variables with **Preview** scope.

---

## 8. Testing Migrations on Staging

Before applying any migration to production:

```bash
# 1. Apply to staging first
supabase link --project-ref $STAGING_PROJECT_REF
supabase db push

# 2. Run the app against staging
cp .env.staging .env.local
npm run dev

# 3. Manually test affected features

# 4. If OK, apply to production
supabase link --project-ref $PROD_PROJECT_REF
supabase db push
```

---

## 9. Restore Production Backup to Staging

This validates backup integrity and DR procedures:

```bash
# Download latest production backup (see docs/BACKUP_DATABASE.md)

# Restore to staging
pg_restore \
  --dbname="$STAGING_DB_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  backup_dealeros_YYYYMMDD.dump

# Verify in staging app
```

Do this monthly or after any major data migration.

---

## 10. Staging Admin Access

The staging `/admin` route works the same as production.
Create a staging admin user:

```sql
-- After creating auth user in staging Supabase Dashboard
INSERT INTO admin_users (user_id, email, name, role)
SELECT id, email, 'Staging Admin', 'super_admin'
FROM auth.users
WHERE email = 'staging-admin@example.com';
```

---

## See Also

- `docs/DISASTER_RECOVERY.md` — how to use staging for DR validation
- `docs/BACKUP_DATABASE.md` — restoring backups to staging
- `docs/ENVIRONMENT_BACKUP.md` — all environment variables reference
