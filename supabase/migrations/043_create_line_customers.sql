-- PHASE46: LINE Integration Foundation
-- Creates dealer_settings (LINE credentials) and line_customers.
-- Adds next_maintenance_date to customers.
-- All additive — no existing tables modified destructively.

-- ─── A. dealer_settings ────────────────────────────────────────────────────────
-- Stores per-dealer configuration including LINE Messaging API credentials.
-- Credentials are server-only and must never be exposed to the client.

CREATE TABLE IF NOT EXISTS public.dealer_settings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id           uuid        NOT NULL UNIQUE REFERENCES public.dealers(id) ON DELETE CASCADE,
  -- LINE Messaging API
  line_channel_id     text,
  line_channel_secret text,        -- Server-only: never expose to client
  line_access_token   text,        -- Server-only: never expose to client
  line_liff_id        text,
  webhook_url         text,
  line_enabled        boolean     NOT NULL DEFAULT false,
  -- Dealer display info
  business_name       text,
  business_phone      text,
  business_email      text,
  business_address    text,
  logo_url            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their settings"
  ON public.dealer_settings FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_dealer_settings_dealer_id ON public.dealer_settings (dealer_id);

-- ─── B. line_customers ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.line_customers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid        NOT NULL,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  line_user_id    text        NOT NULL,
  display_name    text,
  picture_url     text,
  status_message  text,
  is_friend       boolean     NOT NULL DEFAULT true,
  linked_at       timestamptz,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT line_customers_dealer_line_unique UNIQUE (dealer_id, line_user_id)
);

ALTER TABLE public.line_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their line customers"
  ON public.line_customers FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_line_customers_dealer_id   ON public.line_customers (dealer_id);
CREATE INDEX IF NOT EXISTS idx_line_customers_customer_id ON public.line_customers (customer_id);
CREATE INDEX IF NOT EXISTS idx_line_customers_line_user_id ON public.line_customers (line_user_id);

-- ─── C. customers: add next_maintenance_date ──────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS next_maintenance_date date;

CREATE INDEX IF NOT EXISTS idx_customers_next_maintenance_date
  ON public.customers (next_maintenance_date)
  WHERE next_maintenance_date IS NOT NULL;

-- Verification queries (run after applying):
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('dealer_settings','line_customers');
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'next_maintenance_date';
