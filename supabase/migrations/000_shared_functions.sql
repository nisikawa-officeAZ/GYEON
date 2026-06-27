-- =============================================================================
-- MIGRATION 000 — Shared Database Functions
-- File: 000_shared_functions.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply FIRST — before any other migration (001 through 079).
--
-- Purpose:
--   Defines shared PL/pgSQL utility functions that are used by triggers
--   in later migrations. These functions must exist before migrations
--   046, 047, and 048 are applied.
--
-- Functions defined here:
--   update_updated_at_column() — used by triggers in 046, 047, 048
--
-- Safe to apply multiple times (CREATE OR REPLACE).
-- =============================================================================

-- ── update_updated_at_column ─────────────────────────────────────────────────
-- Generic trigger function: sets NEW.updated_at = NOW() on every UPDATE.
-- Used by:
--   - trg_document_sequences_updated_at  (migration 046)
--   - trg_gyeon_products_updated_at      (migration 047)
--   - trg_product_orders_updated_at      (migration 048)

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- Verification:
-- SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name = 'update_updated_at_column';
-- Expected: 1 row
-- =============================================================================
