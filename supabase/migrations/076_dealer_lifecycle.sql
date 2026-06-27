-- =============================================================================
-- PHASE76: Dealer Lifecycle Management
-- File: 076_dealer_lifecycle.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 075.
--
-- Changes:
--   1. Expand dealers.approval_status CHECK to include 'suspended'
--      (RC-13 added suspendDealer server action but the constraint only
--       allowed 'pending', 'approved', 'rejected' — this migration fixes it)
--   2. Add suspended_at column to dealers
--   3. No data destruction — all existing rows remain valid
-- =============================================================================

-- Section 1: Drop old approval_status CHECK (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dealers'::regclass
      AND conname  = 'dealers_approval_status_check'
  ) THEN
    ALTER TABLE public.dealers DROP CONSTRAINT dealers_approval_status_check;
    RAISE NOTICE 'Dropped dealers_approval_status_check';
  END IF;
END;
$$;

-- Section 2: Add expanded constraint
ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

-- Section 3: Add suspended_at column
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- =============================================================================
-- Verification queries (run after applying):
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.dealers'::regclass AND contype = 'c'
--     AND conname = 'dealers_approval_status_check';
-- SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'dealers' AND column_name = 'suspended_at';
-- =============================================================================
