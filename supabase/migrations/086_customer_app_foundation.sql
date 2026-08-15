-- PHASE86: Customer App foundation
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually (production).
--
-- Per-dealer configuration for the (future) customer-facing app. Independent of
-- the branding columns — uses its own table so it is not blocked by the
-- dealer_settings REST schema issue.

CREATE TABLE IF NOT EXISTS public.customer_app_settings (
  dealer_id       uuid        PRIMARY KEY,
  enabled         boolean     NOT NULL DEFAULT false,
  app_name        text,
  welcome_message text,
  theme           text        NOT NULL DEFAULT 'system',
  points_enabled  boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_app_settings_theme_check CHECK (theme IN ('system','light','dark'))
);

CREATE TRIGGER trg_customer_app_settings_updated_at
  BEFORE UPDATE ON public.customer_app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.customer_app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer members manage their customer_app_settings"
  ON public.customer_app_settings
  FOR ALL
  USING (dealer_id IN (SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid() AND status = 'active'))
  WITH CHECK (dealer_id IN (SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid() AND status = 'active'));
