-- =============================================================================
-- PHASE89: News Distribution (Internal News Campaign Foundation)
-- File: 089_news_distribution.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 088.
--
-- Purpose:
--   Foundation for an INTERNAL news distribution system (inspired by HTML email
--   campaign tools). Super Admin creates a news item once and distributes it to
--   dealers via in-app News Center, Email, and/or LINE.
--
--   This migration ONLY adds database structure. No external email/LINE provider
--   is wired here — sending is performed later by a queue worker. Nothing in this
--   migration sends anything.
--
-- Changes:
--   1. Extend gyeon_news with distribution fields (all nullable / defaulted —
--      existing rows remain valid and unchanged).
--   2. Create news_delivery_jobs       (one row per news x channel).
--   3. Create news_delivery_recipients (one row per dealer per job).
--   4. Enable RLS on the NEW tables only, with super_admin/gyeon_admin manage
--      policies (mirrors gyeon_news in migration 082). Existing RLS untouched.
--
-- NOT changed:
--   - Dealer auth, auth.users, customers/vehicles/estimates — untouched.
--   - line_notification_queue (dealer -> customer) — untouched / not reused.
-- =============================================================================

-- ─── 1. Extend gyeon_news ─────────────────────────────────────────────────────
ALTER TABLE public.gyeon_news
  ADD COLUMN IF NOT EXISTS summary           text,
  ADD COLUMN IF NOT EXISTS body_html         text,
  ADD COLUMN IF NOT EXISTS body_text         text,
  ADD COLUMN IF NOT EXISTS target_audience   text   NOT NULL DEFAULT 'all_dealers',
  ADD COLUMN IF NOT EXISTS target_dealer_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS channels          text   NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS scheduled_at      timestamptz;

-- Constrain the new enum-like columns (idempotent guards).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyeon_news_target_audience_check') THEN
    ALTER TABLE public.gyeon_news
      ADD CONSTRAINT gyeon_news_target_audience_check
      CHECK (target_audience IN (
        'all_dealers','certified_dealers','regular_dealers','active_dealers','selected_dealers'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyeon_news_channels_check') THEN
    ALTER TABLE public.gyeon_news
      ADD CONSTRAINT gyeon_news_channels_check
      CHECK (channels IN ('in_app','email','line','email_and_line'));
  END IF;
END;
$$;

-- ─── 2. news_delivery_jobs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_delivery_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id         uuid        NOT NULL REFERENCES public.gyeon_news(id) ON DELETE CASCADE,
  channel         text        NOT NULL,
  target_audience text        NOT NULL DEFAULT 'all_dealers',
  status          text        NOT NULL DEFAULT 'draft',
  is_test         boolean     NOT NULL DEFAULT false,
  total_count     integer     NOT NULL DEFAULT 0,
  pending_count   integer     NOT NULL DEFAULT 0,
  sent_count      integer     NOT NULL DEFAULT 0,
  failed_count    integer     NOT NULL DEFAULT 0,
  skipped_count   integer     NOT NULL DEFAULT 0,
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  created_by      uuid        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_delivery_jobs_channel_check CHECK (channel IN ('email','line')),
  CONSTRAINT news_delivery_jobs_status_check  CHECK (status  IN (
    'draft','scheduled','sending','sent','failed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_news_delivery_jobs_news    ON public.news_delivery_jobs (news_id);
CREATE INDEX IF NOT EXISTS idx_news_delivery_jobs_status  ON public.news_delivery_jobs (status);
CREATE INDEX IF NOT EXISTS idx_news_delivery_jobs_created ON public.news_delivery_jobs (created_at DESC);

DROP TRIGGER IF EXISTS trg_news_delivery_jobs_updated_at ON public.news_delivery_jobs;
CREATE TRIGGER trg_news_delivery_jobs_updated_at
  BEFORE UPDATE ON public.news_delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 3. news_delivery_recipients ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_delivery_recipients (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid        NOT NULL REFERENCES public.news_delivery_jobs(id) ON DELETE CASCADE,
  dealer_id     uuid,
  channel       text        NOT NULL,
  destination   text,
  status        text        NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_delivery_recipients_channel_check CHECK (channel IN ('email','line')),
  CONSTRAINT news_delivery_recipients_status_check  CHECK (status  IN (
    'pending','sending','sent','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_news_delivery_recipients_job    ON public.news_delivery_recipients (job_id);
CREATE INDEX IF NOT EXISTS idx_news_delivery_recipients_status ON public.news_delivery_recipients (status);
CREATE INDEX IF NOT EXISTS idx_news_delivery_recipients_dealer ON public.news_delivery_recipients (dealer_id);

DROP TRIGGER IF EXISTS trg_news_delivery_recipients_updated_at ON public.news_delivery_recipients;
CREATE TRIGGER trg_news_delivery_recipients_updated_at
  BEFORE UPDATE ON public.news_delivery_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 4. RLS (new tables only — admin-managed, mirrors 082) ────────────────────
ALTER TABLE public.news_delivery_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_delivery_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage news_delivery_jobs" ON public.news_delivery_jobs;
CREATE POLICY "Admins manage news_delivery_jobs"
  ON public.news_delivery_jobs
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')));

DROP POLICY IF EXISTS "Admins manage news_delivery_recipients" ON public.news_delivery_recipients;
CREATE POLICY "Admins manage news_delivery_recipients"
  ON public.news_delivery_recipients
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid() AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')));
