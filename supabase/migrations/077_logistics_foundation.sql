-- =============================================================================
-- PHASE77: Logistics Admin Console Foundation
-- File: 077_logistics_foundation.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 076.
--
-- Changes:
--   1. Add damaged_count column to inventory_receipts
--   2. Create logistics_shipments — shipment queue for product orders
--   3. Create logistics_backorders — backorder tracking per order item
--
-- No dealer functionality is duplicated.
-- All new tables use service-role access from the admin console.
-- Dealer RLS policies are not changed.
-- =============================================================================

-- ── 1. inventory_receipts: add damaged_count ─────────────────────────────────
ALTER TABLE inventory_receipts
  ADD COLUMN IF NOT EXISTS damaged_count integer NOT NULL DEFAULT 0
    CHECK (damaged_count >= 0);

-- ── 2. logistics_shipments ───────────────────────────────────────────────────
-- Tracks fulfillment pipeline for dealer product orders.
-- One row per shipment (a product order may generate one or more shipments).

CREATE TABLE IF NOT EXISTS logistics_shipments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_order_id    uuid        REFERENCES product_orders(id) ON DELETE CASCADE,
  dealer_id           uuid        NOT NULL,

  status              text        NOT NULL DEFAULT 'ready'
                      CHECK (status IN ('ready', 'picking', 'packed', 'shipped', 'completed')),

  tracking_number     text,
  carrier             text,
  notes               text,

  assigned_admin_id   uuid        REFERENCES admin_users(id) ON DELETE SET NULL,

  picked_at           timestamptz,
  packed_at           timestamptz,
  shipped_at          timestamptz,
  completed_at        timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logistics_shipments_dealer_id_idx    ON logistics_shipments(dealer_id);
CREATE INDEX IF NOT EXISTS logistics_shipments_status_idx       ON logistics_shipments(status);
CREATE INDEX IF NOT EXISTS logistics_shipments_order_id_idx     ON logistics_shipments(product_order_id);
CREATE INDEX IF NOT EXISTS logistics_shipments_shipped_at_idx   ON logistics_shipments(shipped_at DESC);

-- Admin-only access via service role — no public RLS policy.
ALTER TABLE logistics_shipments ENABLE ROW LEVEL SECURITY;

-- ── 3. logistics_backorders ──────────────────────────────────────────────────
-- Tracks product order items waiting for stock replenishment.

CREATE TABLE IF NOT EXISTS logistics_backorders (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_order_id        uuid        REFERENCES product_orders(id) ON DELETE CASCADE,
  dealer_id               uuid        NOT NULL,
  product_id              uuid        REFERENCES gyeon_products(id) ON DELETE RESTRICT,

  ordered_qty             integer     NOT NULL DEFAULT 0 CHECK (ordered_qty >= 0),
  waiting_qty             integer     NOT NULL DEFAULT 0 CHECK (waiting_qty >= 0),
  expected_arrival_date   date,
  target_delivery_date    date,

  status                  text        NOT NULL DEFAULT 'waiting'
                          CHECK (status IN ('waiting', 'partial', 'fulfilled', 'cancelled')),

  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logistics_backorders_dealer_id_idx   ON logistics_backorders(dealer_id);
CREATE INDEX IF NOT EXISTS logistics_backorders_product_id_idx  ON logistics_backorders(product_id);
CREATE INDEX IF NOT EXISTS logistics_backorders_status_idx      ON logistics_backorders(status);

ALTER TABLE logistics_backorders ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Verification:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('logistics_shipments', 'logistics_backorders');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'inventory_receipts' AND column_name = 'damaged_count';
-- =============================================================================
