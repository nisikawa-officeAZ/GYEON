-- PHASE82: GYEON News Center
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- Admin-published announcements visible (read-only) to dealers.
--
-- Tables:
--   gyeon_news        — global announcements (no dealer_id; visible to all dealers)
--   gyeon_news_reads  — per-user read tracking (for unread badge)

-- ─── A. gyeon_news ────────────────────────────────────────────────────────────
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

-- Admins (super_admin / gyeon_admin) fully manage news (incl. drafts).
CREATE POLICY "Admins manage gyeon_news"
  ON public.gyeon_news
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid()
      AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id = auth.uid()
      AND a.status = 'active'
      AND a.role IN ('super_admin','gyeon_admin')
  ));

-- Dealers (any authenticated dealer member) may READ only published news that is
-- within its active publish window.
CREATE POLICY "Dealers read published gyeon_news"
  ON public.gyeon_news
  FOR SELECT
  USING (
    status = 'published'
    AND (publish_start_at IS NULL OR publish_start_at <= now())
    AND (publish_end_at   IS NULL OR publish_end_at   >= now())
    AND EXISTS (
      SELECT 1 FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid() AND dm.status = 'active'
    )
  );

-- ─── B. gyeon_news_reads ──────────────────────────────────────────────────────
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

-- A user may record and view only their OWN read receipts. dealer_id is verified
-- against the user's active membership so it can never be spoofed from the client.
CREATE POLICY "Users read own gyeon_news_reads"
  ON public.gyeon_news_reads
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own gyeon_news_reads"
  ON public.gyeon_news_reads
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.dealer_members dm
      WHERE dm.user_id = auth.uid()
        AND dm.dealer_id = gyeon_news_reads.dealer_id
        AND dm.status = 'active'
    )
  );
