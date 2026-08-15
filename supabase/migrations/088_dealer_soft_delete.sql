-- =============================================================================
-- PHASE88: Dealer Soft Delete
-- File: 088_dealer_soft_delete.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 087.
--
-- Purpose:
--   Allow Super Admin to "delete" a dealer from the admin approval/list screen
--   WITHOUT destroying any data. This follows the existing soft-delete pattern
--   (deleted_at timestamptz null) already used by core tables (001/038/041).
--
-- Changes:
--   1. Add dealers.deleted_at column (nullable timestamptz)
--   2. Add a partial index on active (non-deleted) dealers for list queries
--   3. No data destruction — every existing row keeps deleted_at = NULL and
--      therefore remains fully visible and unchanged.
--
-- Reversal:
--   A soft-deleted dealer can be restored at any time with:
--     UPDATE public.dealers SET deleted_at = NULL WHERE id = '<dealer_id>';
--
-- Not changed by this migration:
--   - auth.users                (untouched)
--   - customers / vehicles / estimates / gyeon_service_estimates (untouched)
--   - dealer_members            (untouched)
--   - RLS policies              (admin uses the service-role client)
-- =============================================================================

-- Section 1: Add deleted_at column (idempotent)
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Section 2: Partial index for fast "active dealers" listing (idempotent)
CREATE INDEX IF NOT EXISTS dealers_not_deleted_idx
  ON public.dealers (created_at DESC)
  WHERE deleted_at IS NULL;
