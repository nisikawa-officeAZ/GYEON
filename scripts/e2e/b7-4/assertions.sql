-- B7-4 executable acceptance assertions. Fail-closed: every proof is a call to
-- b7_assert(), and any false condition RAISEs, which ON_ERROR_STOP turns into a
-- nonzero psql exit. Runtime inputs come from files via psql -v (see verify.md):
--
--   psql "$(cat "$RUNDIR/.db-url")" -v ON_ERROR_STOP=1 \
--     -v vuser="$(cat "$RUNDIR/.vuser")" \
--     -v ui_key="$(cat "$EVID/ui-key.txt")" \
--     -v ui_estimate="$(cat "$EVID/ui-estimate.txt")" \
--     -v seq_before_ui="$(cat "$EVID/seq-before-ui.txt")" \
--     -f scripts/e2e/b7-4/assertions.sql
--
-- The direct RPC calls run as the production service-role principal via
-- SET LOCAL ROLE service_role. Helpers + result tables live in a dedicated
-- b7_pgtap schema (modeled on supabase/tests/estimate_wizard_atomic_save.test.sql)
-- so service_role can reach them; NO new production-table grant is added and no
-- helper is SECURITY DEFINER.

\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS b7_pgtap CASCADE;
CREATE SCHEMA b7_pgtap;
GRANT USAGE ON SCHEMA b7_pgtap TO service_role;

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION b7_pgtap.b7_assert(p_condition boolean, p_code text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'B7_ASSERT:%', p_code;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION b7_pgtap.b7_seq()
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT coalesce((
    SELECT current_number FROM public.document_sequences
    WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'::uuid
      AND sequence_type = 'estimate'
      AND fiscal_year = 0
  ), 0)::bigint;
$$;

CREATE OR REPLACE FUNCTION b7_pgtap.b7_payload(p_key text)
RETURNS jsonb LANGUAGE sql STABLE AS $payload$
  SELECT jsonb_build_object(
    'idempotencyKey', p_key,
    'customer', jsonb_build_object(
      'mode','existing','customerId','b7400000-0000-4000-8000-0000000000c1'),
    'vehicle', jsonb_build_object(
      'mode','existing','vehicleId','b7400000-0000-4000-8000-0000000000f1','bodySizeKey','M'),
    'services', jsonb_build_array(jsonb_build_object(
      'lineId','manual:maintenance:maint-a','category','maintenance',
      'wizardCategory','maintenance','pricingSource','manual',
      'pricingReferenceId', null,'manualPricingIdentity','maint-a',
      'pricingPolicy','manual_only','manualPricePolicy','required',
      'label','メンテA','description', null,
      'quantity', 1,'unitPrice', 5000,'lineTotal', 5000,
      'optionReferenceIds', '[]'::jsonb,'lineMetadata', '{}'::jsonb)),
    'nonPriceableSelections', '[]'::jsonb,
    'discountIntent', jsonb_build_object('mode','none','fixedAmount',null,'percentage',null,'percentageSupported',false),
    'discountAppliedAmount', null,
    'couponIntent', jsonb_build_object('selectedCouponIds','[]'::jsonb,'status','none'),
    'couponAppliedAmount', null,
    'pricingSnapshot', jsonb_build_object(
      'currency','JPY','completeness','complete',
      'subtotal',5000,'discountTotal',0,'couponTotal',0,'taxableSubtotal',5000,
      'taxRatePercent',10,'taxTotal',500,'grandTotal',5500,
      'warnings','[]'::jsonb,'errors','[]'::jsonb),
    'notes', jsonb_build_object('customerNotes','','internalMemo',''),
    'metadata', jsonb_build_object(
      'source','estimate-wizard-v2.2','schemaVersion','2.2','createdFromWizard',true,
      'draftLastUpdatedAt','2026-01-01T00:00:00.000Z','previewConfirmed',true));
$payload$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA b7_pgtap TO service_role;

-- ── Runtime inputs (validated; read from a table inside PL/pgSQL, never :vars in $$) ──
CREATE TABLE b7_pgtap.b7_assert_context (
  vuser uuid NOT NULL, ui_key text NOT NULL, ui_estimate uuid NOT NULL, seq_before_ui bigint NOT NULL);
INSERT INTO b7_pgtap.b7_assert_context
  VALUES (:'vuser'::uuid, :'ui_key', :'ui_estimate'::uuid, :'seq_before_ui'::bigint);
GRANT SELECT ON b7_pgtap.b7_assert_context TO service_role;
SELECT b7_pgtap.b7_assert(:'ui_key' ~ '^[A-Za-z0-9_-]{16,64}$', 'ui-key-format');
SELECT b7_pgtap.b7_assert((SELECT ui_estimate IS NOT NULL FROM b7_pgtap.b7_assert_context), 'ui-estimate-present');

-- ── UI-save assertions (A_UI_KEY = the dynamically minted key) ───────────────
SELECT b7_pgtap.b7_assert(b7_pgtap.b7_seq() = (:'seq_before_ui'::bigint + 1), 'seq-ui-delta');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimates
  WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1' AND idempotency_key = :'ui_key') = 1, 'ui-one-estimate');
SELECT b7_pgtap.b7_assert((SELECT dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
    AND customer_id = 'b7400000-0000-4000-8000-0000000000c1'
    AND vehicle_id  = 'b7400000-0000-4000-8000-0000000000f1'
    FROM public.estimates WHERE idempotency_key = :'ui_key'), 'ui-ownership');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimate_items i
    JOIN public.estimates e ON e.id = i.estimate_id WHERE e.idempotency_key = :'ui_key') = 1, 'ui-one-item');

-- Persisted identity of the UI-saved line. `ui-one-item` proves cardinality only;
-- this proves the row is production-shaped. The persisted manual identity is the
-- bare catalog code `maint-a` (estimate-save-mapper-from-config), while the
-- composite `manual:maintenance:maint-a` is the wizard_line_id. The internal
-- `maintenance:maint-a` correlation key is never persisted.
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimate_items i
    JOIN public.estimates e ON e.id = i.estimate_id
   WHERE e.idempotency_key = :'ui_key'
     AND i.dealer_id                     = 'b7400000-0000-4000-8000-0000000000d1'
     AND i.category                      = 'maintenance'
     AND i.item_name                     = 'メンテA'
     AND i.description                   IS NULL
     AND i.quantity                      = 1
     AND i.unit_price                    = 5000
     AND i.line_total                    = 5000
     AND i.discount_rate                 = 0
     AND i.item_type                     = 'manual'
     AND i.pricing_source                = 'manual'
     AND i.pricing_reference_id          IS NULL
     AND i.manual_pricing_identity       = 'maint-a'
     AND i.pricing_policy                = 'manual_only'
     AND i.manual_price_policy           = 'required'
     AND i.wizard_category               = 'maintenance'
     AND i.wizard_line_id                = 'manual:maintenance:maint-a'
     AND i.selected_option_reference_ids = '[]'::jsonb
     AND i.pricing_metadata              = '{}'::jsonb) = 1, 'ui-item-identity');

-- Identity chain: current ws -> ready key -> completed estimateId -> redirect
-- pathname -> persisted actor-dealer estimate row. Exactly one row must satisfy
-- id = ui_estimate AND idempotency_key = ui_key AND the actor tenant triple.
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimates
    WHERE id = (SELECT ui_estimate FROM b7_pgtap.b7_assert_context)
      AND idempotency_key = :'ui_key'
      AND dealer_id   = 'b7400000-0000-4000-8000-0000000000d1'
      AND customer_id = 'b7400000-0000-4000-8000-0000000000c1'
      AND vehicle_id  = 'b7400000-0000-4000-8000-0000000000f1') = 1, 'ui-estimate-identity-chain');

-- ── Foreign-sentinel isolation ──────────────────────────────────────────────
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.customers
  WHERE id = 'b7400000-0000-4000-8000-0000000000c2') = 1, 'sentinel-customer-exists');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.vehicles
  WHERE id = 'b7400000-0000-4000-8000-0000000000f2') = 1, 'sentinel-vehicle-exists');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimates
  WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d2') = 0, 'sentinel-no-estimate');

-- ── Baseline before the direct B_RPC calls ──────────────────────────────────
CREATE TABLE b7_pgtap.b7_baseline AS
  SELECT (SELECT count(*) FROM public.customers) AS cust,
         (SELECT count(*) FROM public.vehicles)  AS veh,
         b7_pgtap.b7_seq()                        AS seq_before_brpc;

-- ── B_RPC result / mismatch tables (seq_after nullable; captured separately) ──
CREATE TABLE b7_pgtap.t_b7_brpc (
  call_no integer PRIMARY KEY, result jsonb NOT NULL, seq_after bigint);
GRANT INSERT, UPDATE, SELECT ON b7_pgtap.t_b7_brpc TO service_role;

CREATE TABLE b7_pgtap.b7_mismatch ( pass boolean NOT NULL, seq_after bigint );
GRANT INSERT, UPDATE, SELECT ON b7_pgtap.b7_mismatch TO service_role;

-- B_RPC call 1: store result (stmt 1), then capture sequence (stmt 2).
BEGIN;
  SET LOCAL ROLE service_role;
  SET LOCAL search_path = b7_pgtap, public, auth, extensions;
  INSERT INTO b7_pgtap.t_b7_brpc(call_no, result)
    VALUES (1, public.save_estimate_from_wizard(
      'b7400000-0000-4000-8000-0000000000d1'::uuid,
      (SELECT vuser FROM b7_pgtap.b7_assert_context),
      b7_pgtap.b7_payload('b74rpckey0000001')));
  UPDATE b7_pgtap.t_b7_brpc SET seq_after = b7_pgtap.b7_seq() WHERE call_no = 1;
COMMIT;

-- B_RPC call 2: identical key + payload -> replay.
BEGIN;
  SET LOCAL ROLE service_role;
  SET LOCAL search_path = b7_pgtap, public, auth, extensions;
  INSERT INTO b7_pgtap.t_b7_brpc(call_no, result)
    VALUES (2, public.save_estimate_from_wizard(
      'b7400000-0000-4000-8000-0000000000d1'::uuid,
      (SELECT vuser FROM b7_pgtap.b7_assert_context),
      b7_pgtap.b7_payload('b74rpckey0000001')));
  UPDATE b7_pgtap.t_b7_brpc SET seq_after = b7_pgtap.b7_seq() WHERE call_no = 2;
COMMIT;

-- Mismatch: SAME key, one fingerprint-bearing change (notes is in the canonical
-- fingerprint). Role set ONCE at the transaction level; the handler catches only
-- DUPLICATE_SUBMISSION and re-raises everything else.
BEGIN;
  SET LOCAL ROLE service_role;
  SET LOCAL search_path = b7_pgtap, public, auth, extensions;
  DO $b7_mismatch$
  DECLARE v_user uuid;
  BEGIN
    SELECT vuser INTO STRICT v_user FROM b7_pgtap.b7_assert_context;
    BEGIN
      PERFORM public.save_estimate_from_wizard(
        'b7400000-0000-4000-8000-0000000000d1'::uuid, v_user,
        jsonb_set(b7_pgtap.b7_payload('b74rpckey0000001'), '{notes,internalMemo}', '"B7-4 mismatch"'::jsonb));
      INSERT INTO b7_pgtap.b7_mismatch(pass) VALUES (false);   -- unreachable: no exception raised
    EXCEPTION WHEN others THEN
      IF SQLERRM LIKE 'DUPLICATE_SUBMISSION%' THEN
        INSERT INTO b7_pgtap.b7_mismatch(pass) VALUES (true);
      ELSE RAISE; END IF;
    END;
  END
  $b7_mismatch$;
  UPDATE b7_pgtap.b7_mismatch SET seq_after = b7_pgtap.b7_seq();
COMMIT;

-- ── Executable assertions (every proof via b7_assert) ───────────────────────
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM b7_pgtap.t_b7_brpc
  WHERE call_no = 1 AND result IS NOT NULL AND seq_after IS NOT NULL) = 1, 'brpc1-complete');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM b7_pgtap.t_b7_brpc
  WHERE call_no = 2 AND result IS NOT NULL AND seq_after IS NOT NULL) = 1, 'brpc2-complete');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM b7_pgtap.b7_mismatch
  WHERE seq_after IS NOT NULL) = 1, 'mismatch-complete');

SELECT b7_pgtap.b7_assert((SELECT (result->>'idempotent_replay') = 'false'
  FROM b7_pgtap.t_b7_brpc WHERE call_no = 1), 'brpc1-fresh');
SELECT b7_pgtap.b7_assert((SELECT (result->>'idempotent_replay') = 'true'
  FROM b7_pgtap.t_b7_brpc WHERE call_no = 2), 'brpc2-replay');
SELECT b7_pgtap.b7_assert(
  (SELECT result->>'estimate_id' FROM b7_pgtap.t_b7_brpc WHERE call_no = 1)
  = (SELECT result->>'estimate_id' FROM b7_pgtap.t_b7_brpc WHERE call_no = 2), 'brpc-same-id');
SELECT b7_pgtap.b7_assert(
  (SELECT result->>'estimate_number' FROM b7_pgtap.t_b7_brpc WHERE call_no = 1)
  = (SELECT result->>'estimate_number' FROM b7_pgtap.t_b7_brpc WHERE call_no = 2), 'brpc-same-number');

SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimates
  WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1' AND idempotency_key = 'b74rpckey0000001') = 1, 'brpc-one-estimate');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimate_items i
    JOIN public.estimates e ON e.id = i.estimate_id
    WHERE e.idempotency_key = 'b74rpckey0000001') = 1, 'brpc-one-item');

-- The direct-RPC line must be production-shaped: the identical eighteen-column
-- predicate as ui-item-identity. No committed source establishes a separate
-- identity contract for the direct RPC path.
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.estimate_items i
    JOIN public.estimates e ON e.id = i.estimate_id
   WHERE e.idempotency_key                = 'b74rpckey0000001'
     AND i.dealer_id                      = 'b7400000-0000-4000-8000-0000000000d1'
     AND i.category                       = 'maintenance'
     AND i.item_name                      = 'メンテA'
     AND i.description                    IS NULL
     AND i.quantity                       = 1
     AND i.unit_price                     = 5000
     AND i.line_total                     = 5000
     AND i.discount_rate                  = 0
     AND i.item_type                      = 'manual'
     AND i.pricing_source                 = 'manual'
     AND i.pricing_reference_id           IS NULL
     AND i.manual_pricing_identity        = 'maint-a'
     AND i.pricing_policy                 = 'manual_only'
     AND i.manual_price_policy            = 'required'
     AND i.wizard_category                = 'maintenance'
     AND i.wizard_line_id                 = 'manual:maintenance:maint-a'
     AND i.selected_option_reference_ids  = '[]'::jsonb
     AND i.pricing_metadata               = '{}'::jsonb) = 1, 'brpc-item-identity');
SELECT b7_pgtap.b7_assert((SELECT dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
    AND customer_id = 'b7400000-0000-4000-8000-0000000000c1'
    AND vehicle_id  = 'b7400000-0000-4000-8000-0000000000f1'
    FROM public.estimates WHERE idempotency_key = 'b74rpckey0000001'), 'brpc-ownership');
SELECT b7_pgtap.b7_assert((SELECT count(DISTINCT idempotency_fingerprint) FROM public.estimates
  WHERE idempotency_key = 'b74rpckey0000001') = 1, 'brpc-one-fingerprint');

-- Sequence deltas: +1 for the first B_RPC; zero for replay and mismatch.
SELECT b7_pgtap.b7_assert((SELECT seq_after FROM b7_pgtap.t_b7_brpc WHERE call_no = 1)
  = (SELECT seq_before_brpc FROM b7_pgtap.b7_baseline) + 1, 'seq-brpc1-delta');
SELECT b7_pgtap.b7_assert((SELECT seq_after FROM b7_pgtap.t_b7_brpc WHERE call_no = 2)
  = (SELECT seq_after FROM b7_pgtap.t_b7_brpc WHERE call_no = 1), 'seq-replay-nodelta');
SELECT b7_pgtap.b7_assert((SELECT seq_after FROM b7_pgtap.b7_mismatch)
  = (SELECT seq_after FROM b7_pgtap.t_b7_brpc WHERE call_no = 1), 'seq-mismatch-nodelta');

-- Mismatch was the expected DUPLICATE_SUBMISSION rejection.
SELECT b7_pgtap.b7_assert((SELECT pass FROM b7_pgtap.b7_mismatch), 'mismatch-duplicate-submission');

-- Replay + mismatch created no extra customer/vehicle rows.
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.customers)
  = (SELECT cust FROM b7_pgtap.b7_baseline), 'no-extra-customers');
SELECT b7_pgtap.b7_assert((SELECT count(*) FROM public.vehicles)
  = (SELECT veh FROM b7_pgtap.b7_baseline), 'no-extra-vehicles');

-- Fail-closed cleanup of the test schema (only reached if every assertion passed).
DROP SCHEMA b7_pgtap CASCADE;
