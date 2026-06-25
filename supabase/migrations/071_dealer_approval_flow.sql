-- =============================================================================
-- PHASE71: Dealer Application / Admin Approval Flow
-- File: 071_dealer_approval_flow.sql
-- =============================================================================
-- DO NOT AUTO-APPLY.
-- Paste into Supabase SQL Editor manually after CTO review.
-- Apply AFTER migration 070 (dealer_settings_canonical).
--
-- Strategy: Additive only.
--   - No DROP statements (except idempotent constraint drops).
--   - No destructive changes.
--   - No RLS weakening.
--   - All ADD COLUMN IF NOT EXISTS (idempotent).
--   - Backfill: existing active dealers → approval_status = 'approved'.
--   - Existing archived dealers → approval_status = 'rejected'.
--   - Anything else → approval_status = 'pending'.
--
-- References:
--   docs/master_specification/SPRINT10_APPROVAL_FLOW_SPEC.md
--   GYEON Detailer Agent — Dealer Rank Specification (DEALER_RANK_SPEC.md)
-- =============================================================================


-- =============================================================================
-- Section 1: Approval state columns on dealers
-- =============================================================================

ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS approval_status          text,
  ADD COLUMN IF NOT EXISTS approved_by              uuid REFERENCES public.admin_users(id),
  ADD COLUMN IF NOT EXISTS approved_at              timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by              uuid REFERENCES public.admin_users(id),
  ADD COLUMN IF NOT EXISTS rejected_at              timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason         text,
  ADD COLUMN IF NOT EXISTS application_submitted_at timestamptz;


-- =============================================================================
-- Section 2: CHECK constraint for approval_status (idempotent)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname = 'public'
      AND  t.relname = 'dealers'
      AND  c.conname = 'dealers_approval_status_check'
  ) THEN
    ALTER TABLE public.dealers
      ADD CONSTRAINT dealers_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$$;


-- =============================================================================
-- Section 3: Backfill — set approval_status for all existing dealers
-- =============================================================================
-- Run in this order so the final UPDATE does not overwrite the above.

-- Active dealers → pre-approved (they are already using the system)
UPDATE public.dealers
SET
  approval_status = 'approved',
  approved_at     = COALESCE(started_at, created_at)
WHERE approval_status IS NULL
  AND status = 'active';

-- Archived dealers → treat as rejected (they were deactivated)
UPDATE public.dealers
SET
  approval_status = 'rejected',
  rejected_at     = updated_at
WHERE approval_status IS NULL
  AND status = 'archived';

-- Suspended or any remaining → pending (will require admin review)
UPDATE public.dealers
SET approval_status = 'pending'
WHERE approval_status IS NULL;


-- =============================================================================
-- Section 4: Set NOT NULL and DEFAULT after backfill
-- =============================================================================
-- Must run AFTER backfill to avoid NOT NULL violation on existing rows.

ALTER TABLE public.dealers
  ALTER COLUMN approval_status SET NOT NULL,
  ALTER COLUMN approval_status SET DEFAULT 'pending';


-- =============================================================================
-- Section 5: Performance index
-- =============================================================================

CREATE INDEX IF NOT EXISTS dealers_approval_status_idx
  ON public.dealers (approval_status);


-- =============================================================================
-- Section 6: RLS — No changes
-- =============================================================================
-- The dealers table RLS is controlled by admin_users / service_role.
-- approval_status must only be written by Admin server actions via service_role.
-- Dealer users have no write path to this column (enforced by server actions).
--
-- Existing RLS policy on dealers (from migration 004):
--   Policy allows dealer_members to read their own dealer row.
--   No dealer-facing UPDATE policy on dealers exists.
--   Admin uses service_role client — bypasses RLS for writes.


-- =============================================================================
-- Post-apply verification
-- =============================================================================
-- Run these queries after applying to confirm correctness.
-- Do NOT include these in the migration body.

-- 1. Check all dealers have a non-null approval_status:
-- SELECT COUNT(*) FROM public.dealers WHERE approval_status IS NULL;
-- Expected: 0

-- 2. Distribution check:
-- SELECT approval_status, COUNT(*) FROM public.dealers GROUP BY approval_status;

-- 3. Column existence:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'dealers'
-- ORDER BY ordinal_position;
