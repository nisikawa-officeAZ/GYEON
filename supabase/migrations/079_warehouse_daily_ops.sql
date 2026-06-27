-- =============================================================================
-- PHASE79: Warehouse Daily Operations
-- File: 079_warehouse_daily_ops.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 078 (stocktaking).
--
-- Changes:
--   1. inventory_receipts  — add supplier, po_number, received_date
--   2. stock_movements     — add adjustment_reason column
--   3. warehouse_adjustments — new table for admin stock adjustments with reason
--   4. product_orders      — expand status CHECK to include fulfilling, fulfilled
--   5. po_fulfillment_lines — item-level PO receiving tracking
-- =============================================================================

-- ── 1. inventory_receipts: supplier / PO / received_date ─────────────────────

ALTER TABLE inventory_receipts
  ADD COLUMN IF NOT EXISTS supplier      text,
  ADD COLUMN IF NOT EXISTS po_number     text,
  ADD COLUMN IF NOT EXISTS received_date date;

-- ── 2. stock_movements: adjustment_reason ─────────────────────────────────────

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS adjustment_reason text;

-- ── 3. warehouse_adjustments ─────────────────────────────────────────────────
-- Admin-level stock adjustments with mandatory reason.
-- Updates dealer_stock_levels atomically via server action.

CREATE TABLE IF NOT EXISTS warehouse_adjustments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id               uuid        NOT NULL,
  product_id              uuid        NOT NULL
                          REFERENCES gyeon_products(id) ON DELETE RESTRICT,

  adjustment_type         text        NOT NULL
                          CHECK (adjustment_type IN (
                            'damage',
                            'loss',
                            'internal_use',
                            'sample',
                            'correction'
                          )),

  reason                  text        NOT NULL,

  -- Signed quantity delta: negative = stock out, positive = stock in
  quantity_delta          integer     NOT NULL,
  case_count              integer     NOT NULL DEFAULT 0,
  loose_count             integer     NOT NULL DEFAULT 0,
  units_per_case_snapshot integer     NOT NULL DEFAULT 1
                          CHECK (units_per_case_snapshot >= 1),

  -- Snapshot: stock level after this adjustment was applied
  balance_after           integer     NOT NULL,

  note                    text,
  performed_by            uuid        REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS warehouse_adjustments_dealer_id_idx
  ON warehouse_adjustments(dealer_id);
CREATE INDEX IF NOT EXISTS warehouse_adjustments_product_id_idx
  ON warehouse_adjustments(product_id);
CREATE INDEX IF NOT EXISTS warehouse_adjustments_created_at_idx
  ON warehouse_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS warehouse_adjustments_type_idx
  ON warehouse_adjustments(adjustment_type);

ALTER TABLE warehouse_adjustments ENABLE ROW LEVEL SECURITY;
-- Admin-only via service role. No public RLS policy.

-- ── 4. product_orders: expand status CHECK ───────────────────────────────────
-- Add 'fulfilling' (in progress) and 'fulfilled' (fully shipped) statuses.

ALTER TABLE public.product_orders
  DROP CONSTRAINT IF EXISTS product_orders_status_check;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_status_check
    CHECK (status IN ('draft', 'submitted', 'approved', 'fulfilling', 'fulfilled', 'cancelled'));

-- ── 5. po_fulfillment_lines ───────────────────────────────────────────────────
-- Tracks item-level receiving for each product order.
-- One row per product_order_item created when fulfillment begins.

CREATE TABLE IF NOT EXISTS po_fulfillment_lines (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_order_id      uuid        NOT NULL
                        REFERENCES product_orders(id) ON DELETE CASCADE,
  product_order_item_id uuid,       -- link to original order item (nullable: item may be deleted)
  product_id            uuid        REFERENCES gyeon_products(id) ON DELETE SET NULL,

  sku_snapshot          text        NOT NULL,
  product_name_snapshot text        NOT NULL,
  ordered_qty           integer     NOT NULL CHECK (ordered_qty > 0),
  fulfilled_qty         integer     NOT NULL DEFAULT 0 CHECK (fulfilled_qty >= 0),
  backordered_qty       integer     NOT NULL DEFAULT 0 CHECK (backordered_qty >= 0),

  status                text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'partial', 'fulfilled', 'backordered')),

  fulfilled_by          uuid        REFERENCES admin_users(id) ON DELETE SET NULL,
  fulfilled_at          timestamptz,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS po_fulfillment_lines_order_idx
  ON po_fulfillment_lines(product_order_id);
CREATE INDEX IF NOT EXISTS po_fulfillment_lines_status_idx
  ON po_fulfillment_lines(status);

ALTER TABLE po_fulfillment_lines ENABLE ROW LEVEL SECURITY;
-- Admin-only via service role. No public RLS policy.

-- =============================================================================
-- Verification:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'inventory_receipts'
--     AND column_name IN ('supplier','po_number','received_date');
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('warehouse_adjustments','po_fulfillment_lines');
-- =============================================================================
