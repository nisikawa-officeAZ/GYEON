-- =============================================================================
-- Estimate workflow status vocabulary (SENT removed from workflow)
-- File: 099_estimate_workflow_status.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 037.
--
-- Reason:
--   SENT is a TRANSMISSION event (LINE / email / PDF), not a workflow status.
--   The estimate workflow statuses are:
--     draft, proposal, approved, lost, accepted, in_progress, completed, invoiced
--   The current CHECK constraint (migration 037) only allows
--     DRAFT/SENT/APPROVED/REJECTED + lowercase + expired,
--   so the new workflow values cannot be written until this runs.
--
-- Existing data: rows with status='sent' are migrated to 'proposal' (提案中);
--   'rejected' → 'lost'. Legacy values remain allowed for safety. Idempotent.
-- =============================================================================

-- 1) Widen the CHECK to the canonical workflow values (+ keep legacy for old rows).
ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_status_check;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_status_check
  CHECK (status IN (
    -- canonical workflow statuses
    'draft','proposal','approved','lost','accepted','in_progress','completed','invoiced',
    -- legacy (kept so historical rows remain valid)
    'sent','rejected','expired',
    'DRAFT','SENT','APPROVED','REJECTED'
  ));

-- 2) Migrate legacy workflow values to canonical (SENT is transmission → 提案中).
UPDATE public.estimates SET status = 'proposal' WHERE lower(status) = 'sent';
UPDATE public.estimates SET status = 'lost'     WHERE lower(status) = 'rejected';
UPDATE public.estimates SET status = 'draft'    WHERE status = 'DRAFT';
UPDATE public.estimates SET status = 'approved' WHERE status = 'APPROVED';

-- NOTE: transmission history (LINE/email/PDF sent, sent_at) belongs in a SEPARATE
-- table (future migration), NOT in estimates.status.
