-- =============================================================================
-- Customers: accounts-receivable (売掛) allowed flag
-- File: 101_customer_accounts_receivable_allowed.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 100.
--
-- Reason:
--   The business-customer billing design allows marking whether a customer may be
--   billed on account (売掛). migrations 073 (trade_discount_pct/credit_terms) and
--   100 (closing_day/payment_day) exist; this adds the remaining flag.
--
-- Existing data: UNCHANGED. Additive, defaults to false (no AR). Idempotent.
-- After applying, createCustomer persists accounts_receivable_allowed for business
-- customers (already wired).
-- =============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS accounts_receivable_allowed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.accounts_receivable_allowed IS
  '売掛（掛け売り）許可フラグ。business customers only; default false.';
