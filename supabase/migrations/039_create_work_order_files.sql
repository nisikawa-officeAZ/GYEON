-- PHASE40: Work Order Files
-- Stores file metadata for photos and documents attached to work orders.
-- Actual files live in Supabase Storage bucket "work-order-files".
-- This migration creates the metadata table ONLY.
-- Storage bucket creation and RLS policies must be applied manually via Supabase dashboard or SQL editor.

-- ─── 1. Create work_order_files table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.work_order_files (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id      uuid        NOT NULL,
  work_order_id  uuid        NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  file_type      text        NOT NULL DEFAULT 'photo',
  phase          text        NOT NULL DEFAULT 'before',
  title          text,
  description    text,
  file_name      text,
  file_path      text        NOT NULL,
  file_url       text,
  mime_type      text,
  file_size      integer,
  sort_order     integer     NOT NULL DEFAULT 0,
  is_public      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_order_files_file_type_check
    CHECK (file_type IN ('photo','document','video','other')),
  CONSTRAINT work_order_files_phase_check
    CHECK (phase IN ('before','during','after','damage','delivery','other'))
);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.work_order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their work order files"
  ON public.work_order_files
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_work_order_files_dealer_id
  ON public.work_order_files (dealer_id);

CREATE INDEX IF NOT EXISTS idx_work_order_files_work_order_id
  ON public.work_order_files (work_order_id);

CREATE INDEX IF NOT EXISTS idx_work_order_files_phase
  ON public.work_order_files (phase);

CREATE INDEX IF NOT EXISTS idx_work_order_files_file_type
  ON public.work_order_files (file_type);

-- ─── 4. Storage bucket (MANUAL STEPS — DO NOT RUN AUTOMATICALLY) ──────────────
--
-- Run the following in Supabase SQL Editor or Dashboard AFTER applying this migration:
--
-- 4-a. Create the bucket (Dashboard > Storage > New bucket):
--   Name:   work-order-files
--   Public: false
--
-- 4-b. Or via SQL (requires pg_storage extension enabled):
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('work-order-files', 'work-order-files', false)
--   ON CONFLICT DO NOTHING;
--
-- 4-c. Storage RLS policies:
--
--   -- Dealers can upload their own files
--   CREATE POLICY "Dealer members can upload work order files"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'work-order-files'
--     AND (storage.foldername(name))[1] IN (
--       SELECT dealer_id::text FROM public.dealer_members WHERE user_id = auth.uid()
--     )
--   );
--
--   -- Dealers can read their own files
--   CREATE POLICY "Dealer members can read their work order files"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'work-order-files'
--     AND (storage.foldername(name))[1] IN (
--       SELECT dealer_id::text FROM public.dealer_members WHERE user_id = auth.uid()
--     )
--   );
--
--   -- Dealers can delete their own files
--   CREATE POLICY "Dealer members can delete their work order files"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'work-order-files'
--     AND (storage.foldername(name))[1] IN (
--       SELECT dealer_id::text FROM public.dealer_members WHERE user_id = auth.uid()
--     )
--   );
--
-- Storage path convention:
--   {dealer_id}/{work_order_id}/{phase}/{uuid}_{file_name}
--
-- Example:
--   dealer-uuid-xxx/work-order-uuid-xxx/before/a1b2c3d4_front_bumper.jpg
