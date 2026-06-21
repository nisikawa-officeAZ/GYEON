-- PHASE50A: GYEON Product Catalog Sync
-- gyeon_products: global shared master (no dealer_id).
-- estimate_items / invoice_items get product link columns.

-- ─── A. gyeon_products ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gyeon_products (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 text        UNIQUE NOT NULL,
  jan_code            text,
  product_name        text        NOT NULL,
  brand               text        NOT NULL DEFAULT 'GYEON',
  category            text,
  size_label          text,
  retail_price        numeric,
  image_url           text,
  description         text,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gyeon_products_sku         ON public.gyeon_products (sku);
CREATE INDEX IF NOT EXISTS idx_gyeon_products_category    ON public.gyeon_products (category);
CREATE INDEX IF NOT EXISTS idx_gyeon_products_is_active   ON public.gyeon_products (is_active);

CREATE TRIGGER trg_gyeon_products_updated_at
  BEFORE UPDATE ON public.gyeon_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: authenticated dealer members can SELECT only.
-- INSERT/UPDATE/DELETE must go through service role (admin CSV import).
ALTER TABLE public.gyeon_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read gyeon_products"
  ON public.gyeon_products
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── B. Add product columns to estimate_items ────────────────────────────────
-- item_type: 'manual' (freeform) or 'product' (linked to gyeon_products)
-- All additive — no existing columns touched.

ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS item_type              text    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS product_id             uuid    REFERENCES public.gyeon_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sku                    text,
  ADD COLUMN IF NOT EXISTS product_name_snapshot  text,
  ADD COLUMN IF NOT EXISTS retail_price_snapshot  numeric;

ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_item_type_check;
ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_item_type_check
    CHECK (item_type IN ('manual', 'product'));

-- ─── C. Add product columns to invoice_items ─────────────────────────────────

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS item_type              text    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS product_id             uuid    REFERENCES public.gyeon_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sku                    text,
  ADD COLUMN IF NOT EXISTS product_name_snapshot  text,
  ADD COLUMN IF NOT EXISTS retail_price_snapshot  numeric;

ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_item_type_check;
ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_item_type_check
    CHECK (item_type IN ('manual', 'product'));
