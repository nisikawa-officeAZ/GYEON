# Manual Application Package — Migrations 082 & 083 (Production)

**Scope:** Apply **only** migrations `082_gyeon_news_center.sql` and `083_gyeon_resource_center.sql` to the production Supabase project **`fbieiotihlmpfzybowbt`**.
**Operator action only — do NOT auto-apply. No code/data outside these two migrations is touched.**

Run everything in the **Supabase SQL Editor** of project `fbieiotihlmpfzybowbt` (executes as `service_role`/`postgres`, which is required for the storage policies and the RLS-protected inserts).

> ⚠️ **Known platform caveat:** this project has an open PostgREST schema-cache issue. After applying, the **catalog (`information_schema`/`pg_class`/`pg_policies`) is authoritative**; the REST API may lag or not reflect new tables until the cache is fixed. Post-checks below use the catalog for the source of truth and the REST probe as informational only.

Recommended order: **0 (pre-check) → 082 → 082 post-check → 083-A → 083-A post-check → 083-B → 083-B post-check → NOTIFY**.

---

## STEP 0 — Pre-check (read-only): do the tables already exist?
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('gyeon_news','gyeon_news_reads','gyeon_resources','gyeon_resource_downloads')
ORDER BY table_name;

-- Storage bucket pre-check
SELECT id, name, public FROM storage.buckets WHERE id = 'gyeon-resources';
```
- **0 rows** (and no bucket) → fresh apply, proceed.
- If some rows exist → migrations are `CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING`, so re-running is safe (idempotent), but note what already exists.

---

## STEP 1 — Apply migration 082 (News Center)
Paste the full contents of `supabase/migrations/082_gyeon_news_center.sql`. Summary of objects created: tables `gyeon_news`, `gyeon_news_reads`; indexes; `updated_at` trigger; RLS enabled; policies (admins manage; dealers read published-in-window; users read/insert own read-receipts).

```sql
-- BEGIN 082 (verbatim from supabase/migrations/082_gyeon_news_center.sql)
CREATE TABLE IF NOT EXISTS public.gyeon_news (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category         text        NOT NULL DEFAULT 'announcement',
  priority         text        NOT NULL DEFAULT 'normal',
  title            text        NOT NULL,
  body             text,
  image_url        text,
  pdf_url          text,
  youtube_url      text,
  external_url     text,
  status           text        NOT NULL DEFAULT 'draft',
  publish_start_at timestamptz,
  publish_end_at   timestamptz,
  created_by       uuid        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gyeon_news_category_check CHECK (category IN (
    'announcement','new_product','stock_arrival','backorder','event','training','technical','system')),
  CONSTRAINT gyeon_news_priority_check CHECK (priority IN ('normal','important','urgent')),
  CONSTRAINT gyeon_news_status_check   CHECK (status   IN ('draft','published','archived'))
);
CREATE INDEX IF NOT EXISTS idx_gyeon_news_status   ON public.gyeon_news (status);
CREATE INDEX IF NOT EXISTS idx_gyeon_news_category ON public.gyeon_news (category);
CREATE INDEX IF NOT EXISTS idx_gyeon_news_window   ON public.gyeon_news (publish_start_at, publish_end_at);
CREATE TRIGGER trg_gyeon_news_updated_at
  BEFORE UPDATE ON public.gyeon_news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE public.gyeon_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage gyeon_news"
  ON public.gyeon_news FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')));
CREATE POLICY "Dealers read published gyeon_news"
  ON public.gyeon_news FOR SELECT
  USING (
    status = 'published'
    AND (publish_start_at IS NULL OR publish_start_at <= now())
    AND (publish_end_at   IS NULL OR publish_end_at   >= now())
    AND EXISTS (SELECT 1 FROM public.dealer_members dm WHERE dm.user_id = auth.uid() AND dm.status = 'active')
  );

CREATE TABLE IF NOT EXISTS public.gyeon_news_reads (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id   uuid        NOT NULL REFERENCES public.gyeon_news(id) ON DELETE CASCADE,
  dealer_id uuid        NOT NULL,
  user_id   uuid        NOT NULL,
  read_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (news_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gyeon_news_reads_user   ON public.gyeon_news_reads (user_id);
CREATE INDEX IF NOT EXISTS idx_gyeon_news_reads_dealer ON public.gyeon_news_reads (dealer_id);
ALTER TABLE public.gyeon_news_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own gyeon_news_reads"
  ON public.gyeon_news_reads FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users insert own gyeon_news_reads"
  ON public.gyeon_news_reads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dealer_members dm WHERE dm.user_id = auth.uid() AND dm.dealer_id = gyeon_news_reads.dealer_id AND dm.status = 'active')
  );
-- END 082
```

### STEP 1 post-check (catalog)
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('gyeon_news','gyeon_news_reads');   -- expect 2

SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('gyeon_news','gyeon_news_reads');                                -- expect true, true

SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename IN ('gyeon_news','gyeon_news_reads')
ORDER BY tablename, policyname;   -- expect: gyeon_news ×2 (ALL, SELECT), gyeon_news_reads ×2 (SELECT, INSERT)
```

---

## STEP 2 — Apply migration 083-A (Resource Center: tables/RLS/policies)
This is migration 083 **sections A + B only** (the public tables). Run separately from the storage section so a storage-policy permission error cannot roll these back.

```sql
-- BEGIN 083-A (sections A + B of 083_gyeon_resource_center.sql)
CREATE TABLE IF NOT EXISTS public.gyeon_resources (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text        NOT NULL DEFAULT 'catalog',
  title        text        NOT NULL,
  description  text,
  file_path    text,
  file_name    text,
  file_type    text,
  file_size    bigint,
  youtube_url  text,
  external_url text,
  product_id   uuid        REFERENCES public.gyeon_products(id) ON DELETE SET NULL,
  version      text,
  status       text        NOT NULL DEFAULT 'draft',
  created_by   uuid        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gyeon_resources_category_check CHECK (category IN (
    'product_photo','product_png','gyeon_logo','gyeon_japan_logo','catalog','sds','tds',
    'install_manual','pop','poster','sns','video')),
  CONSTRAINT gyeon_resources_status_check CHECK (status IN ('draft','published','archived'))
);
CREATE INDEX IF NOT EXISTS idx_gyeon_resources_status   ON public.gyeon_resources (status);
CREATE INDEX IF NOT EXISTS idx_gyeon_resources_category ON public.gyeon_resources (category);
CREATE INDEX IF NOT EXISTS idx_gyeon_resources_product  ON public.gyeon_resources (product_id);
CREATE TRIGGER trg_gyeon_resources_updated_at
  BEFORE UPDATE ON public.gyeon_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE public.gyeon_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage gyeon_resources"
  ON public.gyeon_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')));
CREATE POLICY "Dealers read published gyeon_resources"
  ON public.gyeon_resources FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (SELECT 1 FROM public.dealer_members dm WHERE dm.user_id = auth.uid() AND dm.status = 'active')
  );

CREATE TABLE IF NOT EXISTS public.gyeon_resource_downloads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   uuid        NOT NULL REFERENCES public.gyeon_resources(id) ON DELETE CASCADE,
  dealer_id     uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gyeon_resource_downloads_resource ON public.gyeon_resource_downloads (resource_id);
CREATE INDEX IF NOT EXISTS idx_gyeon_resource_downloads_dealer   ON public.gyeon_resource_downloads (dealer_id);
ALTER TABLE public.gyeon_resource_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own gyeon_resource_downloads"
  ON public.gyeon_resource_downloads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dealer_members dm WHERE dm.user_id = auth.uid() AND dm.dealer_id = gyeon_resource_downloads.dealer_id AND dm.status = 'active')
  );
CREATE POLICY "Users read own gyeon_resource_downloads"
  ON public.gyeon_resource_downloads FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin'))
  );
-- END 083-A
```

### STEP 2 post-check (catalog)
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('gyeon_resources','gyeon_resource_downloads');  -- expect 2

SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('gyeon_resources','gyeon_resource_downloads');                                -- expect true, true

SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename IN ('gyeon_resources','gyeon_resource_downloads')
ORDER BY tablename, policyname;  -- expect: gyeon_resources ×2, gyeon_resource_downloads ×2
```

---

## STEP 3 — Apply migration 083-B (Storage bucket + policies)
Run **separately**. If any `CREATE POLICY ... ON storage.objects` statement errors (e.g. *"must be owner of table objects"*), it only affects this step — the tables from 083-A are already committed. In that case, use the **Dashboard fallback** below.

```sql
-- BEGIN 083-B (section C of 083_gyeon_resource_center.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gyeon-resources', 'gyeon-resources', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "gyeon_resources_read" ON storage.objects;
CREATE POLICY "gyeon_resources_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'gyeon-resources'
    AND (
      EXISTS (SELECT 1 FROM public.dealer_members dm WHERE dm.user_id = auth.uid() AND dm.status = 'active')
      OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active')
    )
  );

DROP POLICY IF EXISTS "gyeon_resources_admin_write" ON storage.objects;
CREATE POLICY "gyeon_resources_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gyeon-resources'
    AND EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')));

DROP POLICY IF EXISTS "gyeon_resources_admin_update" ON storage.objects;
CREATE POLICY "gyeon_resources_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'gyeon-resources'
    AND EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')));

DROP POLICY IF EXISTS "gyeon_resources_admin_delete" ON storage.objects;
CREATE POLICY "gyeon_resources_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gyeon-resources'
    AND EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.status = 'active' AND a.role IN ('super_admin','gyeon_admin')));
-- END 083-B
```

**Dashboard fallback (only if 083-B errored):**
- Storage → **New bucket** → name `gyeon-resources`, **Public = OFF**.
- Storage → Policies → add the four policies above on `storage.objects` for bucket `gyeon-resources` (read = dealer member or admin; insert/update/delete = admin only).

### STEP 3 post-check
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'gyeon-resources';   -- expect 1 row, public = false

SELECT policyname, cmd FROM pg_policies
WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'gyeon_resources_%'
ORDER BY policyname;   -- expect 4 (read, admin_write, admin_update, admin_delete)
```

---

## STEP 4 — Reload PostgREST + visibility check
```sql
NOTIFY pgrst, 'reload schema';
```
Then (informational — REST may lag due to the known cache fault):
- `GET https://fbieiotihlmpfzybowbt.supabase.co/rest/v1/gyeon_news?select=id&limit=1`
- `GET https://fbieiotihlmpfzybowbt.supabase.co/rest/v1/gyeon_resources?select=id&limit=1`

Expected eventually: HTTP `200` (empty array under anon). If still `404 / PGRST205` while the catalog post-checks all passed, that is the **existing PostgREST cache issue** (Supabase support ticket), **not** a migration failure — the tables are correct.

---

## Rollback (only if required; destroys the new tables/data)
```sql
-- DROP TABLE IF EXISTS public.gyeon_news_reads CASCADE;
-- DROP TABLE IF EXISTS public.gyeon_news CASCADE;
-- DROP TABLE IF EXISTS public.gyeon_resource_downloads CASCADE;
-- DROP TABLE IF EXISTS public.gyeon_resources CASCADE;
-- Storage: delete the 4 'gyeon_resources_%' policies on storage.objects and the 'gyeon-resources' bucket via Dashboard.
```

## Notes
- **Only** migrations 082 and 083 are in scope. Do not apply other pending migrations.
- After tables are visible via REST, the dealer `/news` and `/downloads` pages and the admin `/admin/news` and `/admin/resources` pages will populate; admin create/publish will succeed.
- `BRANDING_SCHEMA_READY` is unrelated to these tables and remains `false`.
