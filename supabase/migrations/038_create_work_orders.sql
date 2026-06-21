-- PHASE39: Create Work Orders
-- Work Orders track the actual job execution that follows an approved Estimate.
-- All changes are additive (new table only). No existing tables modified.

-- ─── 1. Create work_orders table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.work_orders (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id           uuid        NOT NULL,
  estimate_id         uuid        REFERENCES public.estimates(id) ON DELETE SET NULL,
  customer_id         uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id          uuid        REFERENCES public.vehicles(id)  ON DELETE SET NULL,
  work_order_number   text,
  status              text        NOT NULL DEFAULT 'scheduled',
  title               text,
  scheduled_start_at  timestamptz,
  scheduled_end_at    timestamptz,
  actual_start_at     timestamptz,
  actual_end_at       timestamptz,
  assigned_staff      text,
  service_summary     text,
  notes               text,
  internal_memo       text,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_orders_status_check
    CHECK (status IN ('scheduled','in_progress','completed','cancelled','on_hold'))
);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their work orders"
  ON public.work_orders
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_work_orders_dealer_id
  ON public.work_orders (dealer_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_estimate_id
  ON public.work_orders (estimate_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id
  ON public.work_orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_id
  ON public.work_orders (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_work_orders_status
  ON public.work_orders (status);

CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_start_at
  ON public.work_orders (scheduled_start_at);
