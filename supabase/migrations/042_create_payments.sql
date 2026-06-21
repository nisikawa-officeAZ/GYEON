-- PHASE43: Payment Core
-- payments table for invoice payment management.
-- All additive — no existing tables modified.

-- ─── payments ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id        uuid        NOT NULL,
  invoice_id       uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  payment_number   text,
  payment_date     date,
  payment_method   text        NOT NULL DEFAULT 'cash',
  amount           numeric     NOT NULL DEFAULT 0,
  fee_amount       numeric     NOT NULL DEFAULT 0,
  net_amount       numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'completed',
  reference_no     text,
  notes            text,
  internal_memo    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_payment_method_check
    CHECK (payment_method IN ('cash','bank_transfer','credit_card','paypay','other')),
  CONSTRAINT payments_status_check
    CHECK (status IN ('completed','pending','cancelled','refunded'))
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their payments"
  ON public.payments FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_payments_dealer_id   ON public.payments (dealer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id  ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON public.payments (status);
