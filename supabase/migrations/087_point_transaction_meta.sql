-- PHASE87: Point transaction metadata (history view support)
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually (production).
--
-- Additive columns on point_transactions for the dealer history view:
--   - expires_at:     optional expiry for earned points (powers "expiring soon")
--   - reference_type / reference_id: optional link to a source document
--     (e.g. 'estimate' / 'invoice' / 'work_order')
-- Independent of the branding columns. No existing data is modified.

ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id   uuid;

CREATE INDEX IF NOT EXISTS idx_point_transactions_expires ON public.point_transactions (expires_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON public.point_transactions (created_at);
