-- Migration 081 — Dealer branding assets, bank information, customer app theme.
--
-- Adds:
--   1. Discrete bank-account columns (replaces the single free-text bank_account).
--   2. Branding colour palette + future customer-app theme.
--   3. Storage-path columns for the uploaded logo / stamp images
--      (logo_url / stamp_url are retained for the resolved public URL so that
--       existing consumers — PDF, completion reports, customer portal — keep working).
--   4. A public "dealer-branding" Storage bucket with dealer-scoped RLS.
--
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT guards).
-- migration_auto_apply is DISABLED for this project — apply manually after review.

-- ─── 1 + 2 + 3 : dealer_settings columns ──────────────────────────────────────
ALTER TABLE public.dealer_settings
  -- Bank information (discrete fields)
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS bank_branch_name    text,
  ADD COLUMN IF NOT EXISTS bank_branch_code    text,
  ADD COLUMN IF NOT EXISTS account_type        text,   -- '普通' | '当座' | etc.
  ADD COLUMN IF NOT EXISTS account_number      text,
  ADD COLUMN IF NOT EXISTS account_holder_kana text,
  -- Branding palette
  ADD COLUMN IF NOT EXISTS brand_primary_color   text,
  ADD COLUMN IF NOT EXISTS brand_secondary_color text,
  ADD COLUMN IF NOT EXISTS brand_accent_color    text,
  -- Future customer-app theme (e.g. 'system' | 'light' | 'dark')
  ADD COLUMN IF NOT EXISTS customer_app_theme  text,
  -- Internal Storage paths for the uploaded branding assets
  ADD COLUMN IF NOT EXISTS logo_path           text,
  ADD COLUMN IF NOT EXISTS stamp_path          text;

-- ─── 4 : Storage bucket for dealer branding assets ────────────────────────────
-- Public read (logos appear on PDFs / customer-facing surfaces); writes are
-- restricted by RLS to the dealer's own folder ({dealer_id}/...).
INSERT INTO storage.buckets (id, name, public)
VALUES ('dealer-branding', 'dealer-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for branding assets.
DROP POLICY IF EXISTS "dealer_branding_public_read" ON storage.objects;
CREATE POLICY "dealer_branding_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dealer-branding');

-- Write access (insert/update/delete) limited to members of the dealer that
-- owns the top-level folder. The first path segment MUST equal a dealer_id the
-- current user is an active member of — dealer_id is never trusted from the path
-- alone; it is matched against dealer_members for the authenticated user.
DROP POLICY IF EXISTS "dealer_branding_member_write" ON storage.objects;
CREATE POLICY "dealer_branding_member_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dealer-branding'
    AND (storage.foldername(name))[1] IN (
      SELECT dm.dealer_id::text
      FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid() AND dm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "dealer_branding_member_update" ON storage.objects;
CREATE POLICY "dealer_branding_member_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dealer-branding'
    AND (storage.foldername(name))[1] IN (
      SELECT dm.dealer_id::text
      FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid() AND dm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "dealer_branding_member_delete" ON storage.objects;
CREATE POLICY "dealer_branding_member_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dealer-branding'
    AND (storage.foldername(name))[1] IN (
      SELECT dm.dealer_id::text
      FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid() AND dm.status = 'active'
    )
  );
