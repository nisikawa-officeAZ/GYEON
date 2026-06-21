-- PHASE38: Rebuild Estimate Core
-- Extends estimates table and creates estimate_items.
-- All changes are additive (ADD COLUMN IF NOT EXISTS).
-- Legacy columns (estimate_no, tax) remain for backward compatibility.

-- ─── 1. Extend estimates table ────────────────────────────────────────────────

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS estimate_number    text,
  ADD COLUMN IF NOT EXISTS title              text,
  ADD COLUMN IF NOT EXISTS discount_amount    numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate           numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tax_amount         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_until        date,
  ADD COLUMN IF NOT EXISTS notes              text,
  ADD COLUMN IF NOT EXISTS internal_memo      text;

-- Data migration: copy estimate_no → estimate_number where estimate_number is null
UPDATE public.estimates
  SET estimate_number = estimate_no
  WHERE estimate_number IS NULL AND estimate_no IS NOT NULL;

-- Data migration: copy tax → tax_amount where tax_amount = 0 and tax > 0
UPDATE public.estimates
  SET tax_amount = tax
  WHERE tax_amount = 0 AND tax IS NOT NULL AND tax > 0;

-- ─── 2. Update status constraint to include lowercase values ──────────────────

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_status_check;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_status_check
  CHECK (status IN (
    'DRAFT','SENT','APPROVED','REJECTED',
    'draft','sent','approved','rejected','expired'
  ));

-- ─── 3. Create estimate_items table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.estimate_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid        NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  dealer_id    uuid        NOT NULL,
  category     text        NOT NULL DEFAULT 'other',
  item_name    text        NOT NULL DEFAULT '',
  description  text,
  quantity     numeric     NOT NULL DEFAULT 1,
  unit_price   numeric     NOT NULL DEFAULT 0,
  discount_rate numeric    NOT NULL DEFAULT 0,
  line_total   numeric     NOT NULL DEFAULT 0,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estimate_items_category_check
    CHECK (category IN ('coating','ppf','window','interior','glass','other'))
);

-- ─── 4. RLS for estimate_items (mirror estimates policy) ──────────────────────

ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

-- Dealer-scoped access: users can only see items for their own dealer.
CREATE POLICY IF NOT EXISTS "Dealer members can manage their estimate items"
  ON public.estimate_items
  FOR ALL
  USING (
    dealer_id IN (
      SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
    )
  );

-- ─── 5. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id
  ON public.estimate_items (estimate_id);

CREATE INDEX IF NOT EXISTS idx_estimate_items_dealer_id
  ON public.estimate_items (dealer_id);
