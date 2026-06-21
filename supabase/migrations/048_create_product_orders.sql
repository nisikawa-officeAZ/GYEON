-- PHASE50B: Product Ordering Foundation
-- product_orders + product_order_items tables.
-- Also extends document_sequences CHECK to include 'product_order'.

-- ─── A. product_orders ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_orders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  order_number  text,
  status        text        NOT NULL DEFAULT 'draft',
  order_date    date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_orders_status_check
    CHECK (status IN ('draft','submitted','approved','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_product_orders_dealer_id ON public.product_orders (dealer_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_status    ON public.product_orders (status);

CREATE TRIGGER trg_product_orders_updated_at
  BEFORE UPDATE ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer members can manage their product_orders"
  ON public.product_orders
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- ─── B. product_order_items ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_order_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid        NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  product_id            uuid        REFERENCES public.gyeon_products(id) ON DELETE SET NULL,
  sku                   text        NOT NULL,
  product_name_snapshot text        NOT NULL,
  retail_price_snapshot numeric,
  quantity              integer     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal              numeric     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_order_items_order_id ON public.product_order_items (order_id);

ALTER TABLE public.product_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer members can manage their product_order_items"
  ON public.product_order_items
  FOR ALL
  USING (
    order_id IN (
      SELECT id FROM public.product_orders
      WHERE dealer_id IN (
        SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
      )
    )
  );

-- ─── C. Extend document_sequences sequence_type CHECK ─────────────────────────
-- Drop and recreate the CHECK constraint to add 'product_order'.
-- This is non-destructive — existing rows are unaffected.

ALTER TABLE public.document_sequences
  DROP CONSTRAINT IF EXISTS document_sequences_sequence_type_check;

ALTER TABLE public.document_sequences
  ADD CONSTRAINT document_sequences_sequence_type_check
    CHECK (sequence_type IN (
      'estimate', 'work_order', 'completion_report',
      'invoice', 'payment', 'maintenance_reminder',
      'product_order'
    ));

-- ─── D. Extend get_next_document_number() to accept 'product_order' ──────────
-- The existing RPC already accepts any text value, so no change needed there.
-- The CHECK constraint above is the only gate.
