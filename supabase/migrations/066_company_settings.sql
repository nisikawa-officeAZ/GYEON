-- PHASE66: Company / Store Settings
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
-- Apply AFTER migration 064 (billing_management).

ALTER TABLE dealer_settings
  ADD COLUMN IF NOT EXISTS company_name              text,
  ADD COLUMN IF NOT EXISTS postal_code               text,
  ADD COLUMN IF NOT EXISTS contact_name              text,
  ADD COLUMN IF NOT EXISTS qualified_invoice_number  text;
