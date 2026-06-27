-- 069: Inventory Counting — case + loose count model
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- File: supabase/migrations/069_inventory_counting.sql
--
-- Purpose:
--   1. Add units_per_case to gyeon_products (global product attribute).
--   2. Create dealer_stock_levels to track each dealer's current inventory.
--
--   Counting formula:
--     total_quantity = case_count × units_per_case_used + loose_count
--
--   units_per_case_used is a snapshot of the product default at count time,
--   so that changing the product default later doesn't alter historical totals.
--
-- Depends on: 047_create_gyeon_products.sql

-- ─── 1. gyeon_products: add units_per_case ───────────────────────────────────

ALTER TABLE gyeon_products
  ADD COLUMN IF NOT EXISTS units_per_case integer
    CHECK (units_per_case IS NULL OR units_per_case >= 1);

COMMENT ON COLUMN gyeon_products.units_per_case IS
  'Default number of individual units per carton/case. NULL = not applicable or unknown.';

-- ─── 2. dealer_stock_levels ───────────────────────────────────────────────────
--
-- One row per (dealer_id, product_id) = current stock snapshot.
-- Updated (upserted) each time a count is performed.
-- Audit fields: last_counted_at, last_counted_by.

CREATE TABLE IF NOT EXISTS dealer_stock_levels (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id           uuid         NOT NULL,
  product_id          uuid         NOT NULL
                      REFERENCES gyeon_products(id) ON DELETE CASCADE,

  -- Case + loose count inputs
  case_count          integer      NOT NULL DEFAULT 0
                      CHECK (case_count >= 0),
  loose_count         integer      NOT NULL DEFAULT 0
                      CHECK (loose_count >= 0),

  -- Snapshot of units_per_case at count time (preserves historical totals)
  units_per_case_used integer      NOT NULL DEFAULT 1
                      CHECK (units_per_case_used >= 1),

  -- Calculated and stored explicitly:  case_count × units_per_case_used + loose_count
  total_quantity      integer      NOT NULL DEFAULT 0
                      CHECK (total_quantity >= 0),

  -- Audit
  last_counted_at     timestamptz  NOT NULL DEFAULT now(),
  last_counted_by     uuid,        -- auth.uid() at count time
  notes               text,

  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),

  -- Only one stock level row per product per dealer
  UNIQUE (dealer_id, product_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS dealer_stock_levels_dealer_id_idx
  ON dealer_stock_levels(dealer_id);

CREATE INDEX IF NOT EXISTS dealer_stock_levels_product_id_idx
  ON dealer_stock_levels(product_id);

CREATE INDEX IF NOT EXISTS dealer_stock_levels_dealer_product_idx
  ON dealer_stock_levels(dealer_id, product_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

-- Reuse the generic trigger function if it exists (created in earlier migrations).
-- If not present, create it now.
CREATE OR REPLACE FUNCTION update_dealer_stock_levels_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dealer_stock_levels_updated_at
  ON dealer_stock_levels;

CREATE TRIGGER set_dealer_stock_levels_updated_at
  BEFORE UPDATE ON dealer_stock_levels
  FOR EACH ROW EXECUTE FUNCTION update_dealer_stock_levels_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE dealer_stock_levels ENABLE ROW LEVEL SECURITY;

-- SELECT: dealer sees only own stock levels
CREATE POLICY "dealer_stock_levels_select"
  ON dealer_stock_levels FOR SELECT
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: dealer can only create records for own dealer_id
CREATE POLICY "dealer_stock_levels_insert"
  ON dealer_stock_levels FOR INSERT
  WITH CHECK (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- UPDATE: dealer can only update own records
CREATE POLICY "dealer_stock_levels_update"
  ON dealer_stock_levels FOR UPDATE
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- DELETE: dealer can delete own records (e.g. clear a product they no longer stock)
CREATE POLICY "dealer_stock_levels_delete"
  ON dealer_stock_levels FOR DELETE
  USING (
    dealer_id IN (
      SELECT dealer_id FROM dealer_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
