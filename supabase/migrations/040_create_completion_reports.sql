-- PHASE41: Completion Reports
-- Stores completion report metadata for work orders.
-- Actual PDF files (when generated) live in Supabase Storage.
-- This migration creates the metadata table ONLY.
-- Storage bucket creation and RLS policies must be applied manually.

-- ─── 1. Create completion_reports table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.completion_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid        NOT NULL,
  work_order_id   uuid        NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  report_number   text,
  title           text,
  status          text        NOT NULL DEFAULT 'draft',
  report_date     date,
  customer_message text,
  internal_memo   text,
  pdf_file_path   text,
  pdf_file_url    text,
  is_shared       boolean     NOT NULL DEFAULT false,
  shared_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT completion_reports_status_check
    CHECK (status IN ('draft','generated','shared','archived'))
);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.completion_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their completion reports"
  ON public.completion_reports
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_completion_reports_dealer_id
  ON public.completion_reports (dealer_id);

CREATE INDEX IF NOT EXISTS idx_completion_reports_work_order_id
  ON public.completion_reports (work_order_id);

CREATE INDEX IF NOT EXISTS idx_completion_reports_status
  ON public.completion_reports (status);

CREATE INDEX IF NOT EXISTS idx_completion_reports_report_date
  ON public.completion_reports (report_date);

-- ─── 4. Storage (MANUAL STEPS — DO NOT RUN AUTOMATICALLY) ────────────────────
--
-- Run the following in Supabase SQL Editor or Dashboard after applying this migration:
--
-- 4-a. Create the bucket:
--   Name:   completion-reports
--   Public: false
--
-- 4-b. Storage RLS policies:
--
--   CREATE POLICY "Dealer members can manage completion report PDFs"
--   ON storage.objects FOR ALL
--   USING (
--     bucket_id = 'completion-reports'
--     AND (storage.foldername(name))[1] IN (
--       SELECT dealer_id::text FROM public.dealer_members WHERE user_id = auth.uid()
--     )
--   );
--
-- Storage path convention:
--   {dealer_id}/{work_order_id}/{report_id}.pdf
