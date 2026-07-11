-- Migration 102 — Estimate Wizard Ver2.2 atomic save (source only; NOT APPLIED in this phase).
--
-- Implements docs/estimate-persistence-migration-spec.md + docs/estimate-persistence-schema-
-- reconciliation.md and the PHASE 11G-B Architect decisions. Scope is STRICTLY additive:
--   • additive estimate_items columns (hybrid pricing identity) + tolerant CHECKs
--   • additive estimates columns (pricing snapshot + intents + idempotency)
--   • partial-unique idempotency index
--   • the atomic RPC save_estimate_from_wizard(...)
--   • EXECUTE grant + comments
-- NO customer/vehicle schema change. NO unrelated table change. NO RLS change. NO pricing arithmetic.
--
-- Numbering (Option B): the estimate number is allocated + formatted by the server via the existing
-- authoritative TypeScript numbering rules (getNextDocumentNumber → get_next_document_number integer RPC
-- → formatDocumentNumber) IMMEDIATELY before this RPC, and passed in as p_estimate_number. A rolled-back
-- transaction may leave a numbering gap — identical to existing production behavior.
--
-- Security: SECURITY INVOKER (default). Existing RLS (dealer_members) enforces tenant isolation on every
-- insert; the RPC additionally verifies cross-dealer ownership of existing customer/vehicle. No
-- SECURITY DEFINER, so no privilege elevation and no weakened RLS.

-- ─── 1. estimate_items — additive hybrid-pricing identity columns ─────────────────
ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS pricing_source              text,
  ADD COLUMN IF NOT EXISTS pricing_reference_id        text,
  ADD COLUMN IF NOT EXISTS manual_pricing_identity     text,
  ADD COLUMN IF NOT EXISTS pricing_policy              text,
  ADD COLUMN IF NOT EXISTS manual_price_policy         text,
  ADD COLUMN IF NOT EXISTS wizard_category             text,
  ADD COLUMN IF NOT EXISTS selected_option_reference_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operational_metadata        jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Hybrid identity constraints. NULL-tolerant + NOT VALID so pre-existing (non-wizard) rows are
-- grandfathered; only new/updated rows are enforced.
ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_pricing_source_check;
ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_pricing_source_check
  CHECK (pricing_source IS NULL OR pricing_source IN ('catalog','manual')) NOT VALID;

ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_hybrid_identity_check;
ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_hybrid_identity_check
  CHECK (
    pricing_source IS NULL
    OR (pricing_source = 'catalog' AND pricing_reference_id    IS NOT NULL AND manual_pricing_identity IS NULL)
    OR (pricing_source = 'manual'  AND manual_pricing_identity IS NOT NULL AND pricing_reference_id    IS NULL)
  ) NOT VALID;

-- ─── 2. estimates — additive pricing-snapshot + intent + idempotency columns ──────
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS pricing_completeness     text,
  ADD COLUMN IF NOT EXISTS pricing_warnings         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_errors           jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount_intent          jsonb,
  ADD COLUMN IF NOT EXISTS coupon_intent            jsonb,
  ADD COLUMN IF NOT EXISTS non_priceable_selections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key          text,
  ADD COLUMN IF NOT EXISTS source                   text,
  ADD COLUMN IF NOT EXISTS wizard_schema_version    text;

-- Idempotency: one estimate per (dealer, key). Partial so non-wizard estimates (null key) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS estimates_dealer_idempotency_key_uidx
  ON public.estimates (dealer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── 3. Atomic save RPC ───────────────────────────────────────────────────────────
-- Runs inside the caller's (PostgREST) transaction: any RAISE rolls back ALL writes. Dealer id is
-- supplied by the authenticated server layer (never the payload). Stores the validated pricing snapshot
-- verbatim — NO subtotal/tax/discount/coupon/total arithmetic, NO repricing.
CREATE OR REPLACE FUNCTION public.save_estimate_from_wizard(
  p_dealer_id      uuid,
  p_actor_user_id  uuid,
  p_estimate_number text,
  p_payload        jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer     jsonb := p_payload -> 'customer';
  v_vehicle      jsonb := p_payload -> 'vehicle';
  v_pricing      jsonb := p_payload -> 'pricingSnapshot';
  v_services     jsonb := coalesce(p_payload -> 'services', '[]'::jsonb);
  v_idem         text  := nullif(p_payload ->> 'idempotencyKey', '');
  v_customer_id  uuid;
  v_vehicle_id   uuid;
  v_estimate_id  uuid;
  v_existing     record;
  v_grand        numeric;
  v_line         jsonb;
  v_sort         integer := 0;
BEGIN
  -- Validate dealer context (server-supplied only)
  IF p_dealer_id IS NULL THEN
    RAISE EXCEPTION 'DEALER_CONTEXT_REQUIRED: dealer context missing';
  END IF;
  IF p_estimate_number IS NULL OR btrim(p_estimate_number) = '' THEN
    RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate number missing';
  END IF;

  -- Validate payload shape + pricing completeness (never recalculated)
  IF v_customer IS NULL OR v_vehicle IS NULL OR v_pricing IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: incomplete payload';
  END IF;
  IF (v_pricing ->> 'completeness') IS DISTINCT FROM 'complete' THEN
    RAISE EXCEPTION 'PRICING_INCOMPLETE: pricing completeness is not complete';
  END IF;
  IF jsonb_array_length(v_services) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: no service lines';
  END IF;
  v_grand := nullif(v_pricing ->> 'grandTotal', '')::numeric;
  IF v_grand IS NULL THEN
    RAISE EXCEPTION 'PRICING_INCOMPLETE: grand total missing';
  END IF;

  -- Idempotency: same key → return existing (retry); same key + different total → conflict
  IF v_idem IS NOT NULL THEN
    SELECT id, estimate_number, customer_id, vehicle_id, total
      INTO v_existing
      FROM public.estimates
      WHERE dealer_id = p_dealer_id AND idempotency_key = v_idem
      LIMIT 1;
    IF FOUND THEN
      IF v_existing.total IS DISTINCT FROM v_grand THEN
        RAISE EXCEPTION 'DUPLICATE_SUBMISSION: idempotency key reused with a conflicting payload';
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'estimate_id', v_existing.id, 'estimate_number', v_existing.estimate_number,
        'customer_id', v_existing.customer_id, 'vehicle_id', v_existing.vehicle_id, 'idempotent_replay', true);
    END IF;
  END IF;

  -- Resolve or create customer (cross-dealer verified)
  IF (v_customer ->> 'mode') = 'existing' THEN
    SELECT id INTO v_customer_id
      FROM public.customers
      WHERE id = (v_customer ->> 'customerId')::uuid AND dealer_id = p_dealer_id AND deleted_at IS NULL;
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: customer does not belong to the dealer';
    END IF;
  ELSE
    IF coalesce(nullif(v_customer ->> 'name', ''), '') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer name required';
    END IF;
    INSERT INTO public.customers (
      dealer_id, name, phone, email, postal_code, address, line_user_id,
      is_business, trade_discount_pct, accounts_receivable_allowed, closing_day, payment_day
    ) VALUES (
      p_dealer_id,
      btrim(v_customer ->> 'name'),
      nullif(v_customer ->> 'phone', ''),
      nullif(v_customer ->> 'email', ''),
      nullif(v_customer ->> 'postalCode', ''),
      nullif(v_customer ->> 'address', ''),
      nullif(v_customer ->> 'lineId', ''),
      coalesce((v_customer ->> 'isBusiness')::boolean, false),
      coalesce(nullif(v_customer ->> 'tradeRatePercent', '')::numeric, 0),
      coalesce((v_customer ->> 'accountsReceivableAllowed')::boolean, false),
      nullif(v_customer ->> 'closingDay', '')::integer,
      nullif(v_customer ->> 'paymentDay', '')::integer
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- Resolve or create vehicle (cross-dealer verified; associated with resolved customer)
  IF (v_vehicle ->> 'mode') = 'existing' THEN
    SELECT id INTO v_vehicle_id
      FROM public.vehicles
      WHERE id = (v_vehicle ->> 'vehicleId')::uuid AND dealer_id = p_dealer_id AND deleted_at IS NULL;
    IF v_vehicle_id IS NULL THEN
      RAISE EXCEPTION 'VEHICLE_NOT_FOUND: vehicle does not belong to the dealer';
    END IF;
  ELSE
    INSERT INTO public.vehicles (
      dealer_id, customer_id, maker, model, grade, vehicle_code, vin,
      first_registration_year_month, registration_date, inspection_expiry_date,
      displacement, color, plate_number, body_size
    ) VALUES (
      p_dealer_id, v_customer_id,
      nullif(v_vehicle ->> 'maker', ''),
      nullif(v_vehicle ->> 'model', ''),
      nullif(v_vehicle ->> 'grade', ''),
      nullif(v_vehicle ->> 'vehicleCode', ''),
      nullif(v_vehicle ->> 'vin', ''),
      nullif(v_vehicle ->> 'firstRegistration', ''),
      nullif(v_vehicle ->> 'registrationDate', '')::date,
      nullif(v_vehicle ->> 'inspectionExpiry', '')::date,
      nullif(v_vehicle ->> 'displacement', ''),
      nullif(v_vehicle ->> 'color', ''),
      nullif(v_vehicle ->> 'plateNumber', ''),
      nullif(v_vehicle ->> 'bodySizeKey', '')
    ) RETURNING id INTO v_vehicle_id;
  END IF;

  -- Insert the estimate (status = draft; totals copied from the validated snapshot; notes separated)
  INSERT INTO public.estimates (
    dealer_id, customer_id, vehicle_id, estimate_no, estimate_number, status,
    subtotal, tax, tax_rate, tax_amount, discount_amount, total, notes, internal_memo,
    pricing_completeness, pricing_warnings, pricing_errors, discount_intent, coupon_intent,
    non_priceable_selections, idempotency_key, source, wizard_schema_version
  ) VALUES (
    p_dealer_id, v_customer_id, v_vehicle_id, p_estimate_number, p_estimate_number, 'draft',
    coalesce((v_pricing ->> 'subtotal')::numeric, 0),
    coalesce((v_pricing ->> 'taxTotal')::numeric, 0),
    coalesce((v_pricing ->> 'taxRatePercent')::numeric, 10),
    coalesce((v_pricing ->> 'taxTotal')::numeric, 0),
    coalesce((v_pricing ->> 'discountTotal')::numeric, 0),
    v_grand,
    (p_payload -> 'notes' ->> 'customerNotes'),   -- customer-facing notes
    (p_payload -> 'notes' ->> 'internalMemo'),     -- internal-only; NEVER the customer-facing column
    v_pricing ->> 'completeness',
    coalesce(v_pricing -> 'warnings', '[]'::jsonb),
    coalesce(v_pricing -> 'errors', '[]'::jsonb),
    p_payload -> 'discountIntent',
    p_payload -> 'couponIntent',
    coalesce(p_payload -> 'nonPriceableSelections', '[]'::jsonb),
    v_idem,
    (p_payload -> 'metadata' ->> 'source'),
    (p_payload -> 'metadata' ->> 'schemaVersion')
  ) RETURNING id INTO v_estimate_id;

  -- Insert every priceable service line (hybrid identity preserved exactly; no arithmetic)
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_services)
  LOOP
    INSERT INTO public.estimate_items (
      estimate_id, dealer_id, category, item_name, description, quantity, unit_price, discount_rate,
      line_total, sort_order, item_type,
      pricing_source, pricing_reference_id, manual_pricing_identity, pricing_policy, manual_price_policy,
      wizard_category, selected_option_reference_ids, pricing_metadata
    ) VALUES (
      v_estimate_id, p_dealer_id,
      coalesce(nullif(v_line ->> 'category', ''), 'other'),
      coalesce(v_line ->> 'label', ''),
      nullif(v_line ->> 'description', ''),
      coalesce((v_line ->> 'quantity')::numeric, 1),
      coalesce((v_line ->> 'unitPrice')::numeric, 0),
      0,
      coalesce((v_line ->> 'lineTotal')::numeric, 0),
      v_sort, 'manual',
      nullif(v_line ->> 'pricingSource', ''),
      nullif(v_line ->> 'pricingReferenceId', ''),
      nullif(v_line ->> 'manualPricingIdentity', ''),
      nullif(v_line ->> 'pricingPolicy', ''),
      nullif(v_line ->> 'manualPricePolicy', ''),
      nullif(v_line ->> 'wizardCategory', ''),
      coalesce(v_line -> 'optionReferenceIds', '[]'::jsonb),
      coalesce(v_line -> 'lineMetadata', '{}'::jsonb)
    );
    v_sort := v_sort + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'estimate_id', v_estimate_id, 'estimate_number', p_estimate_number,
    'customer_id', v_customer_id, 'vehicle_id', v_vehicle_id, 'idempotent_replay', false);
END;
$$;

-- ─── 4. Permissions + comments ────────────────────────────────────────────────────
-- Revoke the default PUBLIC execute grant (Postgres grants EXECUTE to PUBLIC by default), then grant
-- ONLY to authenticated. No anon execution. (service_role retains access as the trusted server role.)
REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb) IS
  'Estimate Wizard Ver2.2 atomic save. SECURITY INVOKER (RLS-enforced). dealer_id is server-supplied; '
  'never trusts client dealer ownership. Stores the validated pricing snapshot without recalculation. '
  'Any failure rolls back the whole transaction (customer + vehicle + estimate + items). NOT wired to '
  'runtime in this phase.';
COMMENT ON COLUMN public.estimate_items.pricing_source IS 'catalog | manual (hybrid pricing identity).';
COMMENT ON COLUMN public.estimates.idempotency_key IS 'Wizard save token; unique per (dealer_id, idempotency_key).';

-- ─── ROLLBACK (manual; not executed here) ─────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.save_estimate_from_wizard(uuid, uuid, text, jsonb);
-- DROP INDEX IF EXISTS public.estimates_dealer_idempotency_key_uidx;
-- ALTER TABLE public.estimates DROP COLUMN IF EXISTS pricing_completeness, DROP COLUMN IF EXISTS pricing_warnings,
--   DROP COLUMN IF EXISTS pricing_errors, DROP COLUMN IF EXISTS discount_intent, DROP COLUMN IF EXISTS coupon_intent,
--   DROP COLUMN IF EXISTS non_priceable_selections, DROP COLUMN IF EXISTS idempotency_key, DROP COLUMN IF EXISTS source,
--   DROP COLUMN IF EXISTS wizard_schema_version;
-- ALTER TABLE public.estimate_items DROP CONSTRAINT IF EXISTS estimate_items_hybrid_identity_check,
--   DROP CONSTRAINT IF EXISTS estimate_items_pricing_source_check,
--   DROP COLUMN IF EXISTS pricing_source, DROP COLUMN IF EXISTS pricing_reference_id,
--   DROP COLUMN IF EXISTS manual_pricing_identity, DROP COLUMN IF EXISTS pricing_policy,
--   DROP COLUMN IF EXISTS manual_price_policy, DROP COLUMN IF EXISTS wizard_category,
--   DROP COLUMN IF EXISTS selected_option_reference_ids, DROP COLUMN IF EXISTS pricing_metadata,
--   DROP COLUMN IF EXISTS operational_metadata;
