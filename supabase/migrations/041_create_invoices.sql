-- PHASE42: Invoice Core
-- invoices + invoice_items tables.
-- All additive — no existing tables modified.

-- ─── A. invoices ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id             uuid        NOT NULL,
  customer_id           uuid        REFERENCES public.customers(id)           ON DELETE SET NULL,
  vehicle_id            uuid        REFERENCES public.vehicles(id)            ON DELETE SET NULL,
  estimate_id           uuid        REFERENCES public.estimates(id)           ON DELETE SET NULL,
  work_order_id         uuid        REFERENCES public.work_orders(id)         ON DELETE SET NULL,
  completion_report_id  uuid        REFERENCES public.completion_reports(id)  ON DELETE SET NULL,
  invoice_number        text,
  status                text        NOT NULL DEFAULT 'draft',
  title                 text,
  issue_date            date,
  due_date              date,
  subtotal              numeric     NOT NULL DEFAULT 0,
  discount_amount       numeric     NOT NULL DEFAULT 0,
  tax_rate              numeric     NOT NULL DEFAULT 10,
  tax_amount            numeric     NOT NULL DEFAULT 0,
  total                 numeric     NOT NULL DEFAULT 0,
  paid_amount           numeric     NOT NULL DEFAULT 0,
  balance_due           numeric     NOT NULL DEFAULT 0,
  notes                 text,
  internal_memo         text,
  pdf_file_path         text,
  pdf_file_url          text,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check
    CHECK (status IN ('draft','issued','paid','partially_paid','overdue','cancelled'))
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their invoices"
  ON public.invoices FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_invoices_dealer_id     ON public.invoices (dealer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id   ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vehicle_id    ON public.invoices (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id   ON public.invoices (estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order_id ON public.invoices (work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date    ON public.invoices (issue_date);

-- ─── B. invoice_items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  dealer_id      uuid        NOT NULL,
  category       text        NOT NULL DEFAULT 'other',
  item_name      text        NOT NULL DEFAULT '',
  description    text,
  quantity       numeric     NOT NULL DEFAULT 1,
  unit_price     numeric     NOT NULL DEFAULT 0,
  discount_rate  numeric     NOT NULL DEFAULT 0,
  line_total     numeric     NOT NULL DEFAULT 0,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_items_category_check
    CHECK (category IN ('coating','ppf','window','interior','glass','other'))
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Dealer members can manage their invoice items"
  ON public.invoice_items FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_invoice_items_dealer_id  ON public.invoice_items (dealer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items (invoice_id);
