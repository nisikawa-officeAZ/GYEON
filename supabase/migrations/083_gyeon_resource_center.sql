-- PHASE83: GYEON Resource Center
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- Official GYEON assets uploaded by admins; downloaded (read-only) by dealers.
--
-- Tables:
--   gyeon_resources           — downloadable assets (global; no dealer_id)
--   gyeon_resource_downloads  — download history (for future analytics)
--
-- Storage bucket: "gyeon-resources" (PRIVATE — served via signed URLs).
--   Manual creation is included below; if running outside the SQL editor,
--   create the bucket in the Supabase dashboard (Storage → New bucket,
--   name "gyeon-resources", Public = OFF).

-- ─── A. gyeon_resources ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gyeon_resources (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text        NOT NULL DEFAULT 'catalog',
  title        text        NOT NULL,
  description  text,
  file_path    text,       -- storage path inside the gyeon-resources bucket
  file_name    text,
  file_type    text,       -- mime type
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

-- Admins fully manage resources (incl. drafts).
CREATE POLICY "Admins manage gyeon_resources"
  ON public.gyeon_resources
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')
  ));

-- Dealers may READ only published resources.
CREATE POLICY "Dealers read published gyeon_resources"
  ON public.gyeon_resources
  FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid() AND dm.status = 'active'
    )
  );

-- ─── B. gyeon_resource_downloads ──────────────────────────────────────────────
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

-- A user may log and view only their own downloads; admins may view all (analytics).
CREATE POLICY "Users insert own gyeon_resource_downloads"
  ON public.gyeon_resource_downloads
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid()
        AND dm.dealer_id = gyeon_resource_downloads.dealer_id
        AND dm.status = 'active'
    )
  );

CREATE POLICY "Users read own gyeon_resource_downloads"
  ON public.gyeon_resource_downloads
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND a.status = 'active'
        AND a.role IN ('super_admin','gyeon_admin')
    )
  );

-- ─── C. Storage bucket (PRIVATE) + policies ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('gyeon-resources', 'gyeon-resources', false)
ON CONFLICT (id) DO NOTHING;

-- Any active dealer member or admin may READ (enables signed-URL downloads).
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

-- Only admins may write (upload / overwrite / delete) resource files.
DROP POLICY IF EXISTS "gyeon_resources_admin_write" ON storage.objects;
CREATE POLICY "gyeon_resources_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gyeon-resources'
    AND EXISTS (SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND a.status = 'active'
        AND a.role IN ('super_admin','gyeon_admin'))
  );

DROP POLICY IF EXISTS "gyeon_resources_admin_update" ON storage.objects;
CREATE POLICY "gyeon_resources_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'gyeon-resources'
    AND EXISTS (SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND a.status = 'active'
        AND a.role IN ('super_admin','gyeon_admin'))
  );

DROP POLICY IF EXISTS "gyeon_resources_admin_delete" ON storage.objects;
CREATE POLICY "gyeon_resources_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gyeon-resources'
    AND EXISTS (SELECT 1 FROM public.admin_users a
      WHERE a.user_id = auth.uid() AND a.status = 'active'
        AND a.role IN ('super_admin','gyeon_admin'))
  );
