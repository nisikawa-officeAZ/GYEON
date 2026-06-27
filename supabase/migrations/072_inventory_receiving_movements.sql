-- 072: Inventory Receiving & Stock Movements
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- File: supabase/migrations/072_inventory_receiving_movements.sql
--
-- Purpose:
--   1. inventory_receipts  — records each incoming stock delivery.
--   2. stock_movements     — immutable audit log of every stock change.
--
--   The dealer_stock_levels table (069) is updated atomically on each
--   receive or count-adjustment. stock_movements preserves the full history.
--
--   Movement sign convention:
--     quantity_delta > 0  →  stock added   (receive, adjustment_in, return)
--     quantity_delta < 0  →  stock removed (adjustment_out, sale, damage, transfer)
--
-- Depends on: 069_inventory_counting.sql (dealer_stock_levels, gyeon_products.units_per_case)

-- ─── 1. inventory_receipts ────────────────────────────────────────────────────
--
-- One row per receiving event (a delivery or purchase order receipt).
-- Linked to stock_movements via source_type='receipt', source_id=inventory_receipts.id.

CREATE TABLE IF NOT EXISTS inventory_receipts (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id               uuid         NOT NULL,
  product_id              uuid         NOT NULL
                          REFERENCES gyeon_products(id) ON DELETE RESTRICT,

  -- Case + loose breakdown
  case_count              integer      NOT NULL DEFAULT 0
                          CHECK (case_count >= 0),
  loose_count             integer      NOT NULL DEFAULT 0
                          CHECK (loose_count >= 0),

  -- Snapshot of units_per_case at receive time
  units_per_case_snapshot integer      NOT NULL DEFAULT 1
                          CHECK (units_per_case_snapshot >= 1),

  -- Calculated: case_count × units_per_case_snapshot + loose_count
  total_quantity          integer      NOT NULL
                          CHECK (total_quantity >= 0),

  -- Audit
  received_at             timestamptz  NOT NULL DEFAULT now(),
  received_by             uuid,        -- auth.uid()
  note                    text,

  created_at              timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_receipts_dealer_id_idx
  ON inventory_receipts(dealer_id);

CREATE INDEX IF NOT EXISTS inventory_receipts_dealer_product_idx
  ON inventory_receipts(dealer_id, product_id);

CREATE INDEX IF NOT EXISTS inventory_receipts_received_at_idx
  ON inventory_receipts(received_at DESC);

ALTER TABLE inventory_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_receipts_select"
  ON inventory_receipts FOR SELECT
  USING (dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "inventory_receipts_insert"
  ON inventory_receipts FOR INSERT
  WITH CHECK (dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- No UPDATE/DELETE — receipts are immutable records.
-- To correct an error, create an adjustment movement.

-- ─── 2. stock_movements ───────────────────────────────────────────────────────
--
-- Immutable log of every stock quantity change.
-- Never deleted — corrections are additional rows with opposite sign.

CREATE TABLE IF NOT EXISTS stock_movements (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id               uuid         NOT NULL,
  product_id              uuid         NOT NULL
                          REFERENCES gyeon_products(id) ON DELETE RESTRICT,

  -- What happened
  movement_type           text         NOT NULL
                          CHECK (movement_type IN (
                            'receive',
                            'adjustment_in',
                            'adjustment_out',
                            'sale',
                            'return',
                            'damage',
                            'transfer'
                          )),

  -- Signed quantity: + = in, - = out
  quantity_delta          integer      NOT NULL,

  -- Case + loose breakdown at time of movement
  case_count              integer      NOT NULL DEFAULT 0,
  loose_count             integer      NOT NULL DEFAULT 0,
  units_per_case_snapshot integer      NOT NULL DEFAULT 1
                          CHECK (units_per_case_snapshot >= 1),

  -- Balance snapshot: stock level after this movement was applied
  balance_after           integer      NOT NULL,

  -- Source traceability
  source_type             text,        -- 'receipt' | 'count' | 'manual'
  source_id               uuid,        -- FK to source row (e.g. inventory_receipts.id)

  note                    text,
  created_by              uuid,        -- auth.uid()
  created_at              timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_dealer_id_idx
  ON stock_movements(dealer_id);

CREATE INDEX IF NOT EXISTS stock_movements_dealer_product_idx
  ON stock_movements(dealer_id, product_id);

CREATE INDEX IF NOT EXISTS stock_movements_dealer_created_at_idx
  ON stock_movements(dealer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stock_movements_product_created_at_idx
  ON stock_movements(product_id, created_at DESC);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_select"
  ON stock_movements FOR SELECT
  USING (dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "stock_movements_insert"
  ON stock_movements FOR INSERT
  WITH CHECK (dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- No UPDATE/DELETE — movements are immutable.
