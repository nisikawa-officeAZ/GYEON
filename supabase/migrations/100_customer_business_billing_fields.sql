-- =============================================================================
-- Customers: business billing fields (legacy GenSpark business customer design)
-- File: 100_customer_business_billing_fields.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
--
-- Reason:
--   The legacy GenSpark business-customer design includes structured billing
--   fields. `is_business` and `trade_discount_pct` already exist (migration 073);
--   these four do NOT yet exist:
--     closing_day     締め日   (1–31; 31 = 末日)
--     payment_day     支払日   (1–31; 31 = 末日)
--     billing_name    請求先名
--     billing_contact 請求先担当者
--
-- Existing data: UNCHANGED. Additive, nullable, idempotent.
-- After applying, wire the save in create-customer.ts / update-customer.ts and
-- add these to the customers select where the billing info is displayed.
-- =============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS closing_day     integer,
  ADD COLUMN IF NOT EXISTS payment_day     integer,
  ADD COLUMN IF NOT EXISTS billing_name    text,
  ADD COLUMN IF NOT EXISTS billing_contact text;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_closing_day_check,
  ADD  CONSTRAINT customers_closing_day_check CHECK (closing_day IS NULL OR (closing_day BETWEEN 1 AND 31));

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_payment_day_check,
  ADD  CONSTRAINT customers_payment_day_check CHECK (payment_day IS NULL OR (payment_day BETWEEN 1 AND 31));

COMMENT ON COLUMN public.customers.closing_day     IS '締め日 (1–31; 31 = 末日)';
COMMENT ON COLUMN public.customers.payment_day     IS '支払日 (1–31; 31 = 末日)';
COMMENT ON COLUMN public.customers.billing_name     IS '請求先名';
COMMENT ON COLUMN public.customers.billing_contact IS '請求先担当者';
