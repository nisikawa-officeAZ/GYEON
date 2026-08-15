-- PHASE85: Point Card foundation
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually (production).
--
-- Per-dealer customer loyalty points. Independent of the branding columns.
-- Tables: point_cards (one per dealer+customer), point_transactions (ledger).

CREATE TABLE IF NOT EXISTS public.point_cards (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id      uuid        NOT NULL,
  customer_id    uuid        NOT NULL,
  points_balance integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_point_cards_dealer   ON public.point_cards (dealer_id);
CREATE INDEX IF NOT EXISTS idx_point_cards_customer ON public.point_cards (customer_id);

CREATE TRIGGER trg_point_cards_updated_at
  BEFORE UPDATE ON public.point_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.point_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer members manage their point_cards"
  ON public.point_cards
  FOR ALL
  USING (dealer_id IN (SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid() AND status = 'active'))
  WITH CHECK (dealer_id IN (SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     uuid        NOT NULL,
  customer_id   uuid        NOT NULL,
  point_card_id uuid        REFERENCES public.point_cards(id) ON DELETE CASCADE,
  type          text        NOT NULL DEFAULT 'earn',
  points        integer     NOT NULL DEFAULT 0,
  reason        text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT point_transactions_type_check CHECK (type IN ('earn','redeem','adjust'))
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_dealer   ON public.point_transactions (dealer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer ON public.point_transactions (customer_id);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer members manage their point_transactions"
  ON public.point_transactions
  FOR ALL
  USING (dealer_id IN (SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid() AND status = 'active'))
  WITH CHECK (dealer_id IN (SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid() AND status = 'active'));
