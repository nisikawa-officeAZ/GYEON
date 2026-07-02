-- Migration 093 — Estimate category taxonomy expansion (Plan A)
--
-- Adds maintenance / carwash / roomclean to the estimate_items.category CHECK so
-- these services can be stored as their own line-item categories (today they
-- collapse to 'other' / 'interior').
--
-- SAFE / ADDITIVE: this only WIDENS the allowed values — every existing row stays
-- valid. No data rewrite. No backfill: historical maintenance/carwash rows were
-- stored as 'other' and roomclean as 'interior' and cannot be distinguished, so
-- they are intentionally left unchanged.
--
-- Application code writes the new categories ONLY when ESTIMATE_TAXONOMY_READY is
-- enabled — flip that flag AFTER this migration is applied and REST exposes it, so
-- no write can violate the pre-migration constraint.

-- estimate_items
ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_category_check;
ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_category_check
  CHECK (category IN (
    'coating','ppf','window','interior','glass','other',
    'maintenance','carwash','roomclean'
  ));

-- invoice_items — SAME taxonomy: invoices copy estimate item categories verbatim
-- (create-invoice.ts), so the invoice constraint must be widened in lockstep or
-- invoicing an estimate with the new categories would violate this CHECK.
ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_category_check;
ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_category_check
  CHECK (category IN (
    'coating','ppf','window','interior','glass','other',
    'maintenance','carwash','roomclean'
  ));

-- ── ROLLBACK (manual — run only after re-mapping any new-category rows back) ───
-- ALTER TABLE public.estimate_items DROP CONSTRAINT IF EXISTS estimate_items_category_check;
-- ALTER TABLE public.estimate_items ADD CONSTRAINT estimate_items_category_check
--   CHECK (category IN ('coating','ppf','window','interior','glass','other'));
-- ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS invoice_items_category_check;
-- ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_category_check
--   CHECK (category IN ('coating','ppf','window','interior','glass','other'));
