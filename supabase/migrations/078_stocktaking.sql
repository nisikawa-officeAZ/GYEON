-- =============================================================================
-- PHASE78: Warehouse Stocktaking Foundation
-- File: 078_stocktaking.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 077 (logistics_foundation).
--
-- Changes:
--   1. Fast barcode lookup index on gyeon_products.jan_code
--   2. inventory_stocktaking_sessions  — one row per stocktaking event
--   3. inventory_stocktaking_items     — one row per product per session
--
-- Security: No dealer access. Admin service role only.
-- =============================================================================

-- ── 1. Barcode lookup index ───────────────────────────────────────────────────
-- Enables fast exact match on jan_code (barcode scanner input).

CREATE INDEX IF NOT EXISTS gyeon_products_jan_code_idx
  ON public.gyeon_products (jan_code)
  WHERE jan_code IS NOT NULL;

-- ── 2. inventory_stocktaking_sessions ────────────────────────────────────────
-- One row per warehouse stocktaking session.
-- Sessions are admin-scoped (no dealer_id — this is the GYEON warehouse).

CREATE TABLE IF NOT EXISTS inventory_stocktaking_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'cancelled')),
  started_by      uuid        REFERENCES admin_users(id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_by    uuid        REFERENCES admin_users(id) ON DELETE SET NULL,
  completed_at    timestamptz,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stocktaking_sessions_status_idx
  ON inventory_stocktaking_sessions(status);
CREATE INDEX IF NOT EXISTS stocktaking_sessions_started_at_idx
  ON inventory_stocktaking_sessions(started_at DESC);

ALTER TABLE inventory_stocktaking_sessions ENABLE ROW LEVEL SECURITY;
-- No public RLS policy — access via service role only.

-- ── 3. inventory_stocktaking_items ───────────────────────────────────────────
-- One row per (session, product). Created for all active products when
-- a session is started. Updated as staff scan and count each product.

CREATE TABLE IF NOT EXISTS inventory_stocktaking_items (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              uuid        NOT NULL
                          REFERENCES inventory_stocktaking_sessions(id) ON DELETE CASCADE,
  product_id              uuid        NOT NULL
                          REFERENCES gyeon_products(id) ON DELETE RESTRICT,

  -- Barcode snapshot at session start (jan_code from gyeon_products)
  barcode                 text,

  -- units_per_case snapshot at session start
  units_per_case_snapshot integer     NOT NULL DEFAULT 1
                          CHECK (units_per_case_snapshot >= 1),

  -- Expected quantity (not used yet — reserved for future warehouse stock link)
  expected_quantity       integer,

  -- Count inputs from warehouse staff
  case_count              integer     NOT NULL DEFAULT 0 CHECK (case_count >= 0),
  loose_count             integer     NOT NULL DEFAULT 0 CHECK (loose_count >= 0),

  -- Calculated on save: case_count × units_per_case_snapshot + loose_count
  counted_quantity        integer     NOT NULL DEFAULT 0 CHECK (counted_quantity >= 0),

  -- Difference: counted_quantity - expected_quantity (null if expected not set)
  difference_quantity     integer,

  -- Audit
  counted_by              uuid        REFERENCES admin_users(id) ON DELETE SET NULL,
  counted_at              timestamptz,

  status                  text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'counted', 'skipped')),

  created_at              timestamptz NOT NULL DEFAULT now(),

  -- One item row per product per session
  UNIQUE (session_id, product_id)
);

CREATE INDEX IF NOT EXISTS stocktaking_items_session_idx
  ON inventory_stocktaking_items(session_id);
CREATE INDEX IF NOT EXISTS stocktaking_items_session_status_idx
  ON inventory_stocktaking_items(session_id, status);
CREATE INDEX IF NOT EXISTS stocktaking_items_product_idx
  ON inventory_stocktaking_items(product_id);

ALTER TABLE inventory_stocktaking_items ENABLE ROW LEVEL SECURITY;
-- No public RLS policy — access via service role only.

-- =============================================================================
-- Verification:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('inventory_stocktaking_sessions','inventory_stocktaking_items');
-- SELECT indexname FROM pg_indexes
--   WHERE tablename = 'gyeon_products' AND indexname = 'gyeon_products_jan_code_idx';
-- =============================================================================
