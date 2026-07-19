-- ============================================================================
-- Estimate Wizard Ver2.2 — atomic save HARDENING (forward-only corrective).
--
-- STATUS: SOURCE CANDIDATE ONLY. **NOT APPLIED** in any environment by this
--         phase (R56B). Application + behavioural verification is R56C, on a
--         disposable local stack only.
--
-- Migrations 102 and 104 are NOT modified. This migration is additive and
-- forward-only: it CREATE OR REPLACEs the RPC, adds two columns, one partial
-- unique index, one pure predicate helper, two trigger functions, two triggers
-- and five policies.
--
-- WHAT REMAINS TRUE AFTER THIS MIGRATION
--   * Ordinary legacy DML remains available. EstimateEditor create/update of
--     NON-wizard estimates, and status-only updates of wizard estimates, keep
--     working unchanged (see the legacy-preservation note in section D).
--   * The real persistence gateway remains UNBOUND: no Server Action, page or
--     component imports it. Runtime save stays disabled.
--   * Production route mounting remains PROHIBITED.
--
-- STILL BLOCKING (not addressed here, by explicit scope decision)
--   * R56D -- numbering: getNextDocumentNumber resolves the dealer independently
--     of the save context and returns an UNPERSISTED fallback number on RPC
--     failure. Until corrected, a source-bound real gateway is not hardened.
--   * R56E -- the idempotency key is `string | null` end to end in TypeScript;
--     the database now requires it, so those types must be tightened to match.
--
-- SECURITY MODEL CHANGE (accepted in R56A-REV1)
--   The RPC moves from `authenticated` EXECUTE to **service_role only**. The
--   browser and the Next.js server share the same public URL + anon key, so
--   `authenticated` EXECUTE was never a server boundary: any signed-in user
--   could call the RPC directly with chosen prices, and the RPC never reprices.
--   Consequence: auth.uid() is NULL under service_role, so identity can no
--   longer be cross-checked against the JWT. The RPC therefore TRUSTS
--   p_actor_user_id -- which is safe only because only a service-role holder can
--   invoke it -- and, because service_role BYPASSES RLS, every read and write
--   below carries an EXPLICIT dealer predicate. There is no RLS backstop left.
-- ============================================================================

BEGIN;

-- --- A. Additive schema ----------------------------------------------------

-- Only a 64-char SHA-256 hex digest is stored. NEVER a second plaintext copy of
-- the payload: the payload contains customer/vehicle PII.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint text;

-- The wizard's deterministic per-line identity, carried by the payload and
-- silently dropped by migration 102.
ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS wizard_line_id text;

-- One wizard line identity per estimate. Partial so legacy rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS estimate_items_estimate_wizard_line_uidx
  ON public.estimate_items (estimate_id, wizard_line_id)
  WHERE wizard_line_id IS NOT NULL;

-- --- B. Wizard-origin predicate --------------------------------------------
-- ANY marker means wizard-origin. A partial or corrupt marker combination is
-- therefore treated as wizard-origin and PROTECTED -- it fails closed.
--
-- `source` is tested for NON-NULLNESS, not for equality with the expected
-- literal. `estimates.source` is reserved for wizard persistence: no legacy
-- writer sets it (verified across create-estimate / update-estimate /
-- update-estimate-status / invoices / work-orders). Comparing against the exact
-- literal would therefore treat a corrupt or unexpected non-null source -- say
-- 'estimate-wizard-v9' -- as an ORDINARY estimate and leave it fully mutable,
-- which is the opposite of failing closed.
CREATE OR REPLACE FUNCTION public.wiz_is_wizard_estimate(
  p_source text, p_idempotency_key text, p_schema_version text
) RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT p_source          IS NOT NULL
      OR p_idempotency_key IS NOT NULL
      OR p_schema_version  IS NOT NULL;
$fn$;

-- --- C. Atomic save RPC (hardened) -----------------------------------------
--
-- ORDER OF OPERATIONS IS A SECURITY PROPERTY.
--   1. authorize the actor
--   2. validate payload shape and every required container
--   3. validate the idempotency key
--   4. validate the pricing numeric domains
--   5. validate the customer input (strict, before any cast)
--   6. validate the vehicle input (strict, before any cast)
--   7. validate EVERY service line in full (the single validation authority)
--   8. only then build the canonical fingerprint -- every cast/round it performs
--      operates on values already proven safe
--   9. advisory lock, replay detection
--  10. persist (customer + vehicle + estimate in ONE exception subtransaction)
--
-- Steps 5-7 exist ahead of step 8 because the fingerprint projection casts and
-- rounds numeric values: performing it first would raw-cast unvalidated input
-- and leak 22P02 before any check ran. The persistence loop consumes values the
-- step-7 pass already proved; it does not re-derive a second, weaker definition.
CREATE OR REPLACE FUNCTION public.save_estimate_from_wizard(
  p_dealer_id       uuid,
  p_actor_user_id   uuid,
  p_estimate_number text,
  p_payload         jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_customer    jsonb := p_payload -> 'customer';
  v_vehicle     jsonb := p_payload -> 'vehicle';
  v_pricing     jsonb := p_payload -> 'pricingSnapshot';
  v_services    jsonb := p_payload -> 'services';
  v_notes       jsonb := p_payload -> 'notes';
  v_metadata    jsonb := p_payload -> 'metadata';
  v_idem        text;
  v_cnt         integer;
  v_mem_dealer  uuid;
  v_mem_role    text;
  v_staff_role  text;
  v_role        text;
  v_fp          text;
  v_canonical   jsonb;
  v_existing    record;
  v_customer_id uuid;
  v_vehicle_id  uuid;
  v_estimate_id uuid;
  v_line        jsonb;
  v_sort        integer := 0;
  v_seen_lines  text[]  := ARRAY[]::text[];
  v_line_id     text;
  v_category    text;
  v_label       text;
  v_src         text;
  v_ref         text;
  v_man         text;
  v_opts        jsonb;
  v_meta        jsonb;
  v_k           text;
  v_j           jsonb;
  v_n           numeric;
  v_qty         numeric;
  v_unit        numeric;
  v_ltotal      numeric;
  v_subtotal    numeric;
  v_disc_total  numeric;
  v_coupon_tot  numeric;
  v_key         text;
  v_txt         text;
  v_y           integer;
  v_m           integer;
  v_d           integer;
  v_dim         integer;
  v_constraint  text;
  c_money  CONSTANT text[] := ARRAY['subtotal','discountTotal','couponTotal',
                                    'taxableSubtotal','taxTotal','grandTotal'];
  c_cats   CONSTANT text[] := ARRAY['coating','ppf','window','interior','glass',
                                    'other','maintenance','carwash','roomclean'];
  c_uuid   CONSTANT text   :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  c_max    CONSTANT numeric := 1000000000000;   -- 1e12
BEGIN
  -- --- C.1 Actor authorization ---------------------------------------------
  -- auth.uid() is NULL under service_role, so p_actor_user_id is trusted; the
  -- caller is a service-role holder by construction of the EXECUTE grant.
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: actor user id is required';
  END IF;
  IF p_dealer_id IS NULL THEN
    RAISE EXCEPTION 'DEALER_CONTEXT_REQUIRED: dealer context missing';
  END IF;
  IF p_estimate_number IS NULL OR btrim(p_estimate_number) = '' THEN
    RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate number missing';
  END IF;

  -- Reproduces the B3 actor contract EXACTLY: the ambiguity rule is GLOBAL
  -- (across all dealers), not scoped to p_dealer_id. More than one active
  -- membership means the tenant is ambiguous and is never picked arbitrarily.
  SELECT count(*) INTO v_cnt
    FROM public.dealer_members
   WHERE user_id = p_actor_user_id AND status = 'active';
  IF v_cnt = 0 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: no active membership';
  END IF;
  IF v_cnt > 1 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: ambiguous tenant context';
  END IF;

  SELECT dealer_id, role INTO v_mem_dealer, v_mem_role
    FROM public.dealer_members
   WHERE user_id = p_actor_user_id AND status = 'active';
  IF v_mem_dealer IS DISTINCT FROM p_dealer_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: dealer does not match the active membership';
  END IF;

  -- dealer_staff is PRIMARY for this exact (actor, dealer); absence falls back
  -- to the SAME membership row's role. Role and dealer can never diverge.
  SELECT role INTO v_staff_role
    FROM public.dealer_staff
   WHERE user_id = p_actor_user_id AND dealer_id = p_dealer_id AND status = 'active';
  v_role := coalesce(v_staff_role, v_mem_role);
  IF v_role IS NULL OR v_role NOT IN ('owner','manager','staff') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: role may not save estimates';
  END IF;

  -- --- C.2 Payload shape and REQUIRED containers ---------------------------
  -- THREE-VALUED LOGIC IS THE ENEMY HERE. `x -> 'k'` is SQL NULL for an ABSENT
  -- key, jsonb_typeof(NULL) is NULL, and `NULL <> 'object'` is NULL -- which an
  -- IF treats as FALSE, silently SKIPPING the guard and failing OPEN. Every
  -- required-field guard below therefore uses `IS DISTINCT FROM`, which yields a
  -- proper boolean for a NULL left operand and so rejects an absent key.
  --
  -- The payload itself must be a real object: a SQL-NULL or a JSON scalar would
  -- make every `->` below return NULL and cascade the same fail-open.
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: payload must be an object';
  END IF;

  -- Required containers are required, never coalesced to an invented default.
  IF jsonb_typeof(v_customer) IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_vehicle)  IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_pricing)  IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_notes)    IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: incomplete payload';
  END IF;

  -- SEQUENTIAL, never combined with OR: SQL does not guarantee left-to-right
  -- evaluation, so `typeof <> 'array' OR jsonb_array_length(...) = 0` could
  -- evaluate jsonb_array_length on a non-array and leak a raw 22023.
  IF jsonb_typeof(v_services) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: no service lines';
  END IF;
  IF jsonb_array_length(v_services) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: no service lines';
  END IF;

  IF jsonb_typeof(p_payload -> 'nonPriceableSelections') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: nonPriceableSelections is required';
  END IF;
  IF jsonb_typeof(v_pricing -> 'warnings') IS DISTINCT FROM 'array'
     OR jsonb_typeof(v_pricing -> 'errors') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing warnings/errors are required';
  END IF;
  IF jsonb_typeof(p_payload -> 'discountIntent') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: discountIntent is required';
  END IF;
  IF jsonb_typeof(p_payload -> 'couponIntent') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: couponIntent is required';
  END IF;
  IF jsonb_typeof(v_notes -> 'customerNotes') IS DISTINCT FROM 'string'
     OR jsonb_typeof(v_notes -> 'internalMemo') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: notes fields are required strings';
  END IF;
  IF (v_pricing ->> 'completeness') IS DISTINCT FROM 'complete' THEN
    RAISE EXCEPTION 'PRICING_INCOMPLETE: pricing completeness is not complete';
  END IF;

  -- Currency is a CONTRACT, not a preference: the whole pricing pipeline is
  -- whole-yen. An absent key makes ->> return NULL, which IS DISTINCT FROM
  -- rejects, so absence and a wrong currency fail identically.
  IF (v_pricing ->> 'currency') IS DISTINCT FROM 'JPY' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing currency must be JPY';
  END IF;

  -- --- C.2b Metadata: exact, and validated BEFORE fingerprint/persistence ---
  -- C.8 projects these four into the canonical fingerprint and C.10 persists
  -- source + schemaVersion, so an unvalidated metadata block would be hashed and
  -- stored before anything checked it.
  IF jsonb_typeof(v_metadata -> 'source') IS DISTINCT FROM 'string'
     OR (v_metadata ->> 'source') IS DISTINCT FROM 'estimate-wizard-v2.2' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.source is required and must be estimate-wizard-v2.2';
  END IF;
  IF jsonb_typeof(v_metadata -> 'schemaVersion') IS DISTINCT FROM 'string'
     OR (v_metadata ->> 'schemaVersion') IS DISTINCT FROM '2.2' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.schemaVersion is required and must be 2.2';
  END IF;
  -- Compared as jsonb: this accepts ONLY JSON true, never the string "true".
  IF (v_metadata -> 'createdFromWizard') IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.createdFromWizard must be true';
  END IF;
  IF jsonb_typeof(v_metadata -> 'previewConfirmed') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: metadata.previewConfirmed must be a boolean';
  END IF;

  -- --- C.3 Idempotency key: REQUIRED, exact format, no blank fallback ------
  v_idem := p_payload ->> 'idempotencyKey';
  IF v_idem IS NULL OR v_idem !~ '^[A-Za-z0-9_-]{16,64}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: idempotency key missing or malformed';
  END IF;

  -- --- C.4 Pricing numeric domains: NO invented defaults, NO coercion ------
  -- jsonb_typeof(...) = 'number' rejects numeric STRINGS ("1000") outright.
  -- NaN and +/-Infinity are valid `numeric` values in PostgreSQL, so both are
  -- rejected EXPLICITLY rather than relying on the range bounds.
  FOREACH v_k IN ARRAY c_money LOOP
    v_j := v_pricing -> v_k;
    IF jsonb_typeof(v_j) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: pricing.% is missing or not a number', v_k;
    END IF;
    v_n := (v_j #>> '{}')::numeric;
    IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: pricing.% is not finite', v_k;
    END IF;
    IF v_n < 0 OR v_n > c_max OR scale(v_n) > 2 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: pricing.% is outside the accepted domain', v_k;
    END IF;
  END LOOP;

  v_j := v_pricing -> 'taxRatePercent';
  IF jsonb_typeof(v_j) IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.taxRatePercent is missing or not a number';
  END IF;
  v_n := (v_j #>> '{}')::numeric;
  IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric
     OR v_n < 0 OR v_n > 100 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.taxRatePercent is outside the accepted domain';
  END IF;
  -- FINGERPRINT PARITY: the canonical projection rounds this to scale 2, but the
  -- stored column is unbounded numeric. Without this check, 10.123 would persist
  -- as 10.123 while fingerprinting as 10.12, so 10.123 and 10.124 would collide
  -- into the same fingerprint and one would be accepted as a replay of the other.
  IF scale(v_n) > 2 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.taxRatePercent scale exceeds 2';
  END IF;

  -- --- C.4b Reduction boundary --------------------------------------------
  -- Every c_money member is now proven to be a finite, non-negative, in-range
  -- JSON number, so these three reads are cast-safe. A reduction larger than the
  -- subtotal is an incoherent snapshot: totals are stored VERBATIM and never
  -- recomputed here, so nothing downstream would catch it. Reject, never repair.
  v_subtotal   := ((v_pricing -> 'subtotal')      #>> '{}')::numeric;
  v_disc_total := ((v_pricing -> 'discountTotal') #>> '{}')::numeric;
  v_coupon_tot := ((v_pricing -> 'couponTotal')   #>> '{}')::numeric;
  IF v_disc_total > v_subtotal THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.discountTotal exceeds subtotal';
  END IF;
  IF v_coupon_tot > v_subtotal THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: pricing.couponTotal exceeds subtotal';
  END IF;

  -- --- C.5 Customer input validation (BEFORE any cast) ---------------------
  IF (v_customer ->> 'mode') = 'existing' THEN
    -- Strict grouped UUID shape. A loose character-class regex would admit
    -- values like 36 hyphens and leak 22P02 at the cast.
    IF jsonb_typeof(v_customer -> 'customerId') IS DISTINCT FROM 'string'
       OR (v_customer ->> 'customerId') !~ c_uuid THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer id is malformed';
    END IF;
  ELSIF (v_customer ->> 'mode') = 'new' THEN
    IF jsonb_typeof(v_customer -> 'name') IS DISTINCT FROM 'string'
       OR btrim(v_customer ->> 'name') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer name required';
    END IF;
    -- Booleans are REQUIRED by the DTO; absence is not silently false. These two
    -- are cast with ::boolean in C.10, so an absent key previously slipped past
    -- the guard and surfaced as a raw NOT-NULL violation instead of a stable code.
    IF jsonb_typeof(v_customer -> 'isBusiness') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.isBusiness must be a boolean';
    END IF;
    IF jsonb_typeof(v_customer -> 'accountsReceivableAllowed') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.accountsReceivableAllowed must be a boolean';
    END IF;
    -- PRESENCE FIRST. `jsonb_typeof(x -> 'k') NOT IN (...)` does NOT reject an
    -- absent key: `x -> 'k'` is SQL NULL, jsonb_typeof(NULL) is NULL, and
    -- `NULL NOT IN (...)` is NULL, which an IF treats as false. The `?` operator
    -- is the only reliable presence test, and absence must NOT become explicit null.
    IF NOT (v_customer ? 'tradeRatePercent') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent is required';
    END IF;
    IF jsonb_typeof(v_customer -> 'tradeRatePercent') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent must be a number or null';
    END IF;
    IF jsonb_typeof(v_customer -> 'tradeRatePercent') = 'number' THEN
      v_n := ((v_customer -> 'tradeRatePercent') #>> '{}')::numeric;
      IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric
         OR v_n < 0 OR v_n > 100 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent is outside the accepted domain';
      END IF;
      -- customers.trade_discount_pct is numeric(5,2): a scale-3 value would be
      -- SILENTLY ROUNDED by the column type. Reject instead of rounding.
      IF scale(v_n) > 2 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.tradeRatePercent scale exceeds 2';
      END IF;
    END IF;
    -- closingDay / paymentDay: REQUIRED keys, each string | null, and a decimal
    -- day 1..31 before ::integer.
    FOREACH v_key IN ARRAY ARRAY['closingDay','paymentDay'] LOOP
      IF NOT (v_customer ? v_key) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.% is required', v_key;
      END IF;
      IF jsonb_typeof(v_customer -> v_key) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a string or null', v_key;
      END IF;
      v_txt := v_customer ->> v_key;
      IF v_txt IS NOT NULL AND v_txt <> '' THEN
        -- The shape check is a SEPARATE statement, not an OR branch: SQL does not
        -- guarantee left-to-right short-circuit evaluation, so combining them would
        -- still allow ::integer to fire on non-numeric text and leak 22P02.
        IF v_txt !~ '^[0-9]{1,2}$' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a day between 1 and 31', v_key;
        END IF;
        IF v_txt::integer < 1 OR v_txt::integer > 31 THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a day between 1 and 31', v_key;
        END IF;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'VALIDATION_ERROR: customer mode is invalid';
  END IF;

  -- --- C.6 Vehicle input validation (BEFORE any cast) ----------------------
  IF (v_vehicle ->> 'mode') = 'existing' THEN
    IF jsonb_typeof(v_vehicle -> 'vehicleId') IS DISTINCT FROM 'string'
       OR (v_vehicle ->> 'vehicleId') !~ c_uuid THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vehicle id is malformed';
    END IF;
  ELSIF (v_vehicle ->> 'mode') = 'new' THEN
    -- Mirrors the authoritative DTO validator: maker OR model must be present.
    IF coalesce(btrim(v_vehicle ->> 'maker'), '') = ''
       AND coalesce(btrim(v_vehicle ->> 'model'), '') = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vehicle maker or model required';
    END IF;
    -- Real CALENDAR validation, not merely YYYY-MM-DD shape: 2026-02-31 has the
    -- right shape and would raise 22008 at ::date.
    FOREACH v_key IN ARRAY ARRAY['registrationDate','inspectionExpiry'] LOOP
      -- Presence first, for the same three-valued-logic reason as above.
      IF NOT (v_vehicle ? v_key) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is required', v_key;
      END IF;
      IF jsonb_typeof(v_vehicle -> v_key) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% must be a string or null', v_key;
      END IF;
      v_txt := v_vehicle ->> v_key;
      IF v_txt IS NOT NULL AND v_txt <> '' THEN
        IF v_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is malformed', v_key;
        END IF;
        v_y := substr(v_txt, 1, 4)::integer;
        v_m := substr(v_txt, 6, 2)::integer;
        v_d := substr(v_txt, 9, 2)::integer;
        IF v_y < 1900 OR v_y > 2999 OR v_m < 1 OR v_m > 12 OR v_d < 1 THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is not a valid date', v_key;
        END IF;
        -- Days in month, computed without ever constructing an invalid date.
        v_dim := EXTRACT(DAY FROM (make_date(v_y, v_m, 1) + INTERVAL '1 month - 1 day'))::integer;
        IF v_d > v_dim THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: vehicle.% is not a valid date', v_key;
        END IF;
      END IF;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'VALIDATION_ERROR: vehicle mode is invalid';
  END IF;

  -- --- C.7 Service-line validation: THE single validation authority --------
  -- Runs over EVERY line before the fingerprint is built and before any write.
  -- The persistence loop (C.11) consumes what this pass proved.
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_services) LOOP
    IF jsonb_typeof(v_line) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service line is not an object';
    END IF;

    -- Required string fields must have JSON string type AND be nonblank.
    -- wizardCategory / pricingPolicy / manualPricePolicy are persisted in C.11
    -- through nullif(..., ''), so an absent or blank value would have written a
    -- silent NULL into a wizard identity column instead of being rejected.
    FOREACH v_key IN ARRAY ARRAY['lineId','category','label',
                                 'wizardCategory','pricingPolicy','manualPricePolicy'] LOOP
      IF jsonb_typeof(v_line -> v_key) IS DISTINCT FROM 'string'
         OR btrim(v_line ->> v_key) = '' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is required', v_key;
      END IF;
    END LOOP;
    v_line_id  := btrim(v_line ->> 'lineId');
    v_category := btrim(v_line ->> 'category');

    IF NOT (v_category = ANY (c_cats)) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service category is not permitted';
    END IF;
    IF v_line_id = ANY (v_seen_lines) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: duplicate service lineId';
    END IF;
    v_seen_lines := v_seen_lines || v_line_id;

    -- Hybrid identity: EXACTLY one non-empty identity, matching pricingSource.
    v_src := v_line ->> 'pricingSource';
    v_ref := nullif(btrim(coalesce(v_line ->> 'pricingReferenceId', '')), '');
    v_man := nullif(btrim(coalesce(v_line ->> 'manualPricingIdentity', '')), '');
    IF v_src = 'catalog' THEN
      IF v_ref IS NULL OR v_man IS NOT NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: catalog line requires exactly a catalog identity';
      END IF;
    ELSIF v_src = 'manual' THEN
      IF v_man IS NULL OR v_ref IS NOT NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: manual line requires exactly a manual identity';
      END IF;
    ELSE
      RAISE EXCEPTION 'VALIDATION_ERROR: pricingSource must be catalog or manual';
    END IF;

    -- Amounts: JSON number type, finite, in range and scale. No invented defaults.
    FOREACH v_key IN ARRAY ARRAY['quantity','unitPrice','lineTotal'] LOOP
      v_j := v_line -> v_key;
      IF jsonb_typeof(v_j) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is missing or not a number', v_key;
      END IF;
      v_n := (v_j #>> '{}')::numeric;
      IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is not finite', v_key;
      END IF;
      IF v_n > c_max OR scale(v_n) > 2 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: service % is outside the accepted domain', v_key;
      END IF;
    END LOOP;
    IF ((v_line -> 'quantity') #>> '{}')::numeric <= 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service quantity must be greater than zero';
    END IF;
    IF ((v_line -> 'quantity') #>> '{}')::numeric > 100000 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service quantity is outside the accepted domain';
    END IF;
    IF ((v_line -> 'unitPrice')  #>> '{}')::numeric < 0
       OR ((v_line -> 'lineTotal') #>> '{}')::numeric < 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: service amounts must not be negative';
    END IF;

    -- optionReferenceIds: REQUIRED array of strings. The column is NOT NULL, so
    -- an absent key used to reach the INSERT and leak a raw 23502.
    IF jsonb_typeof(v_line -> 'optionReferenceIds') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: optionReferenceIds is required and must be an array';
    END IF;
    -- Elements are already MATERIALIZED by jsonb_array_elements, so jsonb_typeof
    -- can never be NULL here; IS DISTINCT FROM is used purely for consistency and
    -- accepts exactly the same values as the previous `<>`.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_line -> 'optionReferenceIds') e
                WHERE jsonb_typeof(e) IS DISTINCT FROM 'string') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: optionReferenceIds must contain only strings';
    END IF;

    -- lineMetadata: REQUIRED flat object (no nested object/array values).
    IF jsonb_typeof(v_line -> 'lineMetadata') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: lineMetadata is required and must be an object';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(v_line -> 'lineMetadata') m
                WHERE jsonb_typeof(m.value) IN ('object','array')) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: lineMetadata must be flat';
    END IF;
  END LOOP;

  -- --- C.8 Canonical material projection + fingerprint ---------------------
  -- SAFE BY CONSTRUCTION: every value cast or rounded below was proven a finite,
  -- in-range JSON number by C.4 and C.7. metadata.draftLastUpdatedAt is EXCLUDED
  -- -- it is an in-memory timestamp that is never persisted, and including it
  -- would turn a legitimate retry into a false DUPLICATE_SUBMISSION. Numeric
  -- scale is normalized because jsonb preserves 1 and 1.0 as distinct texts.
  SELECT jsonb_build_object(
    'customer', v_customer,
    'vehicle',  v_vehicle,
    'services', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'lineId',                s ->> 'lineId',
                 'category',              s ->> 'category',
                 'wizardCategory',        s ->> 'wizardCategory',
                 'pricingSource',         s ->> 'pricingSource',
                 'pricingReferenceId',    s ->> 'pricingReferenceId',
                 'manualPricingIdentity', s ->> 'manualPricingIdentity',
                 'pricingPolicy',         s ->> 'pricingPolicy',
                 'manualPricePolicy',     s ->> 'manualPricePolicy',
                 'label',                 s ->> 'label',
                 'description',           s ->> 'description',
                 'quantity',              round(((s -> 'quantity')  #>> '{}')::numeric, 2),
                 'unitPrice',             round(((s -> 'unitPrice') #>> '{}')::numeric, 2),
                 'lineTotal',             round(((s -> 'lineTotal') #>> '{}')::numeric, 2),
                 'optionReferenceIds',    s -> 'optionReferenceIds',
                 'lineMetadata',          s -> 'lineMetadata')
                 ORDER BY ord)
        FROM jsonb_array_elements(v_services) WITH ORDINALITY AS t(s, ord)), '[]'::jsonb),
    'nonPriceableSelections', p_payload -> 'nonPriceableSelections',
    'notes',    v_notes,
    'pricing',  jsonb_build_object(
                  'currency',        v_pricing ->> 'currency',
                  'completeness',    v_pricing ->> 'completeness',
                  'subtotal',        round(((v_pricing -> 'subtotal')        #>> '{}')::numeric, 2),
                  'discountTotal',   round(((v_pricing -> 'discountTotal')   #>> '{}')::numeric, 2),
                  'couponTotal',     round(((v_pricing -> 'couponTotal')     #>> '{}')::numeric, 2),
                  'taxableSubtotal', round(((v_pricing -> 'taxableSubtotal') #>> '{}')::numeric, 2),
                  'taxRatePercent',  round(((v_pricing -> 'taxRatePercent')  #>> '{}')::numeric, 2),
                  'taxTotal',        round(((v_pricing -> 'taxTotal')        #>> '{}')::numeric, 2),
                  'grandTotal',      round(((v_pricing -> 'grandTotal')      #>> '{}')::numeric, 2)),
    'discountIntent',        p_payload -> 'discountIntent',
    'discountAppliedAmount', coalesce(p_payload -> 'discountAppliedAmount', 'null'::jsonb),
    'couponIntent',          p_payload -> 'couponIntent',
    'couponAppliedAmount',   coalesce(p_payload -> 'couponAppliedAmount', 'null'::jsonb),
    'metadata', jsonb_build_object(
                  'source',            v_metadata ->> 'source',
                  'schemaVersion',     v_metadata ->> 'schemaVersion',
                  'createdFromWizard', v_metadata -> 'createdFromWizard',
                  'previewConfirmed',  v_metadata -> 'previewConfirmed')
  ) INTO v_canonical;

  -- sha256(bytea) is core since PG11 -- no pgcrypto dependency.
  v_fp := encode(sha256(convert_to(v_canonical::text, 'UTF8')), 'hex');

  -- --- C.9 Serialize same (dealer,key) work, then replay-detect ------------
  -- The advisory lock removes the check-then-act race that would otherwise let
  -- two concurrent same-key requests both miss the lookup and collide on the
  -- partial unique index, leaking a raw 23505.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dealer_id::text || ':' || v_idem, 0));

  SELECT id, estimate_number, customer_id, vehicle_id, idempotency_fingerprint
    INTO v_existing
    FROM public.estimates
   WHERE dealer_id = p_dealer_id AND idempotency_key = v_idem;
  IF FOUND THEN
    IF v_existing.idempotency_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'DUPLICATE_SUBMISSION: idempotency key reused with a different payload';
    END IF;
    -- Exact replay: ZERO writes.
    RETURN jsonb_build_object(
      'ok', true, 'estimate_id', v_existing.id, 'estimate_number', v_existing.estimate_number,
      'customer_id', v_existing.customer_id, 'vehicle_id', v_existing.vehicle_id,
      'idempotent_replay', true);
  END IF;

  -- --- C.10 ATOMIC create block: customer + vehicle + estimate ----------
  -- All three writes share ONE exception subtransaction. If the idempotency
  -- unique index fires, this whole block rolls back, so a concurrent-race
  -- replay can never leave an orphan customer or vehicle behind. Splitting
  -- them would make the 'zero writes' replay guarantee false.
  --
  -- Explicit dealer predicates throughout: service_role bypasses RLS, so there
  -- is no backstop. Every value cast here was validated in C.5 / C.6.
  BEGIN
    IF (v_customer ->> 'mode') = 'existing' THEN
      SELECT id INTO v_customer_id FROM public.customers
       WHERE id = (v_customer ->> 'customerId')::uuid
         AND dealer_id = p_dealer_id AND deleted_at IS NULL;
      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: customer does not belong to the dealer';
      END IF;
    ELSE
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
        (v_customer ->> 'isBusiness')::boolean,
        -- customers.trade_discount_pct is numeric(5,2) NOT NULL, but the DTO
        -- permits an explicit null. Ratified mapping: explicit JSON null means
        -- "no trade discount" and persists as the canonical 0. An ABSENT key was
        -- already rejected in C.5, so this CASE can never silently convert a
        -- missing key -- which is exactly why a broad COALESCE is not used here.
        -- The FINGERPRINT keeps the ORIGINAL payload value, so explicit null and
        -- explicit numeric 0 stay materially distinct intents.
        CASE jsonb_typeof(v_customer -> 'tradeRatePercent')
          WHEN 'null'   THEN 0::numeric
          WHEN 'number' THEN ((v_customer -> 'tradeRatePercent') #>> '{}')::numeric
        END,
        (v_customer ->> 'accountsReceivableAllowed')::boolean,
        nullif(v_customer ->> 'closingDay', '')::integer,
        nullif(v_customer ->> 'paymentDay', '')::integer
      ) RETURNING id INTO v_customer_id;
    END IF;

    IF (v_vehicle ->> 'mode') = 'existing' THEN
      SELECT id INTO v_vehicle_id FROM public.vehicles
       WHERE id = (v_vehicle ->> 'vehicleId')::uuid
         AND dealer_id   = p_dealer_id
         AND customer_id = v_customer_id      -- the gap migration 102 left open
         AND deleted_at IS NULL;
      IF v_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'VEHICLE_NOT_FOUND: vehicle does not belong to the dealer and customer';
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


    -- Estimate: totals stored VERBATIM; never recomputed here.
      INSERT INTO public.estimates (
        dealer_id, customer_id, vehicle_id, estimate_no, estimate_number, status,
        subtotal, tax, tax_rate, tax_amount, discount_amount, total, notes, internal_memo,
        pricing_completeness, pricing_warnings, pricing_errors, discount_intent, coupon_intent,
        non_priceable_selections, idempotency_key, idempotency_fingerprint, source,
        wizard_schema_version
      ) VALUES (
        p_dealer_id, v_customer_id, v_vehicle_id, p_estimate_number, p_estimate_number, 'draft',
        ((v_pricing -> 'subtotal')       #>> '{}')::numeric,
        ((v_pricing -> 'taxTotal')       #>> '{}')::numeric,
        ((v_pricing -> 'taxRatePercent') #>> '{}')::numeric,
        ((v_pricing -> 'taxTotal')       #>> '{}')::numeric,
        ((v_pricing -> 'discountTotal')  #>> '{}')::numeric,
        ((v_pricing -> 'grandTotal')     #>> '{}')::numeric,
        v_notes ->> 'customerNotes',
        v_notes ->> 'internalMemo',
        v_pricing ->> 'completeness',
        v_pricing -> 'warnings',
        v_pricing -> 'errors',
        p_payload -> 'discountIntent',
        p_payload -> 'couponIntent',
        p_payload -> 'nonPriceableSelections',
        v_idem, v_fp,
        v_metadata ->> 'source',
        v_metadata ->> 'schemaVersion'
      ) RETURNING id INTO v_estimate_id;
  EXCEPTION WHEN unique_violation THEN
      -- CONSTRAINT-SPECIFIC. Only the idempotency index may be interpreted as a
      -- concurrent same-key race. Any other unique violation is an unrelated
      -- defect and must not be reported as a replay. SQLERRM / detail / hint /
      -- SQLSTATE are never surfaced.
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'estimates_dealer_idempotency_key_uidx' THEN
        RAISE EXCEPTION 'ESTIMATE_CREATE_FAILED: estimate could not be created';
      END IF;
      SELECT id, estimate_number, customer_id, vehicle_id, idempotency_fingerprint
        INTO v_existing
        FROM public.estimates
       WHERE dealer_id = p_dealer_id AND idempotency_key = v_idem;
      IF NOT FOUND OR v_existing.idempotency_fingerprint IS DISTINCT FROM v_fp THEN
        RAISE EXCEPTION 'DUPLICATE_SUBMISSION: idempotency key reused with a different payload';
      END IF;
      RETURN jsonb_build_object(
        'ok', true, 'estimate_id', v_existing.id, 'estimate_number', v_existing.estimate_number,
        'customer_id', v_existing.customer_id, 'vehicle_id', v_existing.vehicle_id,
        'idempotent_replay', true);
  END;

  -- --- C.11 Service lines: consume the C.7-proven values -------------------
  BEGIN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_services) LOOP
      v_line_id  := btrim(v_line ->> 'lineId');
      v_category := btrim(v_line ->> 'category');
      v_label    := btrim(v_line ->> 'label');
      v_src      := v_line ->> 'pricingSource';
      v_ref      := nullif(btrim(coalesce(v_line ->> 'pricingReferenceId', '')), '');
      v_man      := nullif(btrim(coalesce(v_line ->> 'manualPricingIdentity', '')), '');
      v_opts     := v_line -> 'optionReferenceIds';
      v_meta     := v_line -> 'lineMetadata';
      v_qty      := ((v_line -> 'quantity')  #>> '{}')::numeric;
      v_unit     := ((v_line -> 'unitPrice') #>> '{}')::numeric;
      v_ltotal   := ((v_line -> 'lineTotal') #>> '{}')::numeric;

      INSERT INTO public.estimate_items (
        estimate_id, dealer_id, category, item_name, description, quantity, unit_price,
        discount_rate, line_total, sort_order, item_type,
        pricing_source, pricing_reference_id, manual_pricing_identity, pricing_policy,
        manual_price_policy, wizard_category, wizard_line_id,
        selected_option_reference_ids, pricing_metadata
      ) VALUES (
        v_estimate_id, p_dealer_id, v_category, v_label,
        nullif(v_line ->> 'description', ''),
        v_qty, v_unit, 0, v_ltotal, v_sort, 'manual',
        v_src, v_ref, v_man,
        nullif(v_line ->> 'pricingPolicy', ''),
        nullif(v_line ->> 'manualPricePolicy', ''),
        nullif(v_line ->> 'wizardCategory', ''),
        v_line_id,
        v_opts, v_meta
      );
      v_sort := v_sort + 1;
    END LOOP;
  EXCEPTION WHEN unique_violation THEN
    -- C.7 already rejects in-payload duplicate lineIds, so reaching the partial
    -- unique index here is an unrelated defect. Controlled, stable, no leakage.
    RAISE EXCEPTION 'ESTIMATE_ITEM_CREATE_FAILED: estimate items could not be created';
  END;

  RETURN jsonb_build_object(
    'ok', true, 'estimate_id', v_estimate_id, 'estimate_number', p_estimate_number,
    'customer_id', v_customer_id, 'vehicle_id', v_vehicle_id, 'idempotent_replay', false);
END;
$fn$;

-- --- D. Direct-DML integrity -----------------------------------------------
-- `authenticated` retains direct DML on these tables (migration 104), which is
-- required by legacy flows. These guards do not remove that; they prevent
-- authenticated direct DML from FORGING or MUTATING wizard-origin persistence.
--
-- LEGACY PRESERVATION (proved from source in R56A):
--   * createEstimate sets no marker           -> INSERT policy passes.
--   * updateEstimate on a non-wizard row      -> neither guard fires.
--   * updateEstimateStatus on a wizard row    -> changes only status+updated_at.
--   * updateEstimate on a wizard row          -> REJECTED (by design).
--   * invoice / work-order / PDF / dashboard  -> read-only on these tables.

CREATE OR REPLACE FUNCTION public.wiz_guard_estimate_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE v_old boolean; v_new boolean;
BEGIN
  IF current_user = 'service_role' THEN RETURN NEW; END IF;   -- sole exemption
  v_old := public.wiz_is_wizard_estimate(OLD.source, OLD.idempotency_key, OLD.wizard_schema_version);
  v_new := public.wiz_is_wizard_estimate(NEW.source, NEW.idempotency_key, NEW.wizard_schema_version);
  IF NOT v_old AND v_new THEN
    RAISE EXCEPTION 'WIZARD_ORIGIN_FORBIDDEN: cannot convert an estimate to wizard-origin';
  END IF;
  -- Whole-row diff: the allowlist is {status, updated_at}; every other column,
  -- present AND future, is protected automatically.
  IF v_old AND (to_jsonb(NEW) - 'status' - 'updated_at')
             IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION 'WIZARD_ESTIMATE_IMMUTABLE: only status and updated_at may change';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.wiz_guard_estimate_item_dml()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
  v_ids     uuid[];
  v_dealers uuid[];
  v_pdealer uuid;
  v_pwizard boolean;
  v_marker  text;
  i         integer;
  c_markers CONSTANT text[] := ARRAY[
    'pricing_source','pricing_reference_id','manual_pricing_identity',
    'pricing_policy','manual_price_policy','wizard_category','wizard_line_id'];
BEGIN
  IF current_user = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Explicit TG_OP branching. No COALESCE across NEW/OLD: in a DELETE trigger
  -- NEW is unassigned and referencing it raises.
  IF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.estimate_id];  v_dealers := ARRAY[NEW.dealer_id];
  ELSIF TG_OP = 'UPDATE' THEN
    v_ids     := ARRAY[OLD.estimate_id, NEW.estimate_id];   -- moves either way
    v_dealers := ARRAY[OLD.dealer_id,   NEW.dealer_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.estimate_id];  v_dealers := ARRAY[OLD.dealer_id];
  ELSE
    RAISE EXCEPTION 'WIZARD_ITEM_GUARD_UNSUPPORTED_OP: %', TG_OP;
  END IF;

  FOR i IN 1 .. array_length(v_ids, 1) LOOP
    IF v_ids[i] IS NULL OR v_dealers[i] IS NULL THEN
      RAISE EXCEPTION 'WIZARD_ITEM_PARENT_UNRESOLVED: null parent or dealer reference';
    END IF;

    SELECT e.dealer_id,
           public.wiz_is_wizard_estimate(e.source, e.idempotency_key, e.wizard_schema_version)
      INTO v_pdealer, v_pwizard
      FROM public.estimates e
     WHERE e.id = v_ids[i];

    -- Missing OR not visible through RLS => DENY. Never coerced to false.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WIZARD_ITEM_PARENT_UNRESOLVED: parent estimate missing or not visible';
    END IF;
    IF v_pdealer IS DISTINCT FROM v_dealers[i] THEN
      RAISE EXCEPTION 'WIZARD_ITEM_DEALER_MISMATCH: item dealer does not match parent dealer';
    END IF;
    IF v_pwizard IS DISTINCT FROM false THEN     -- true OR NULL both deny
      RAISE EXCEPTION 'WIZARD_ITEM_IMMUTABLE: items of a wizard estimate are server-managed';
    END IF;
  END LOOP;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    FOREACH v_marker IN ARRAY c_markers LOOP
      IF (to_jsonb(NEW) ->> v_marker) IS NOT NULL THEN
        RAISE EXCEPTION 'WIZARD_ITEM_FORBIDDEN: wizard identity column % is server-managed', v_marker;
      END IF;
    END LOOP;
    IF NEW.selected_option_reference_ids IS DISTINCT FROM '[]'::jsonb
       OR NEW.pricing_metadata     IS DISTINCT FROM '{}'::jsonb
       OR NEW.operational_metadata IS DISTINCT FROM '{}'::jsonb THEN
      RAISE EXCEPTION 'WIZARD_ITEM_FORBIDDEN: wizard snapshot columns are server-managed';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_marker IN ARRAY c_markers LOOP
      IF (to_jsonb(OLD) ->> v_marker) IS NOT NULL THEN   -- clearing / changing
        RAISE EXCEPTION 'WIZARD_ITEM_IMMUTABLE: wizard identity column % may not be modified', v_marker;
      END IF;
    END LOOP;
    IF OLD.selected_option_reference_ids IS DISTINCT FROM '[]'::jsonb
       OR OLD.pricing_metadata     IS DISTINCT FROM '{}'::jsonb
       OR OLD.operational_metadata IS DISTINCT FROM '{}'::jsonb THEN
      RAISE EXCEPTION 'WIZARD_ITEM_IMMUTABLE: wizard snapshot columns may not be modified';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS wiz_guard_estimate_update_trg ON public.estimates;
CREATE TRIGGER wiz_guard_estimate_update_trg
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_estimate_update();

DROP TRIGGER IF EXISTS wiz_guard_estimate_item_dml_trg ON public.estimate_items;
CREATE TRIGGER wiz_guard_estimate_item_dml_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_items
  FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_estimate_item_dml();

-- --- E. Restrictive policies (ANDed with the existing permissive ones) ------

DROP POLICY IF EXISTS estimates_wizard_insert_block ON public.estimates;
CREATE POLICY estimates_wizard_insert_block ON public.estimates
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.wiz_is_wizard_estimate(source, idempotency_key, wizard_schema_version));

-- Supplies the status = 'active' filter that migration 037's permissive
-- estimate_items policy omits, without editing 037.
DROP POLICY IF EXISTS estimate_items_active_member_only ON public.estimate_items;
CREATE POLICY estimate_items_active_member_only ON public.estimate_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (dealer_id IN (SELECT dm.dealer_id FROM public.dealer_members dm
                        WHERE dm.user_id = auth.uid() AND dm.status = 'active'))
  WITH CHECK (dealer_id IN (SELECT dm.dealer_id FROM public.dealer_members dm
                             WHERE dm.user_id = auth.uid() AND dm.status = 'active'));

-- EXISTS is false, never NULL, when the parent is absent or RLS-invisible, so
-- an unresolvable parent denies.
DROP POLICY IF EXISTS estimate_items_wizard_insert_block ON public.estimate_items;
CREATE POLICY estimate_items_wizard_insert_block ON public.estimate_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.estimates e
     WHERE e.id        = estimate_items.estimate_id
       AND e.dealer_id = estimate_items.dealer_id
       AND NOT public.wiz_is_wizard_estimate(e.source, e.idempotency_key, e.wizard_schema_version)));

DROP POLICY IF EXISTS estimate_items_wizard_update_block ON public.estimate_items;
CREATE POLICY estimate_items_wizard_update_block ON public.estimate_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.estimates e
     WHERE e.id = estimate_items.estimate_id AND e.dealer_id = estimate_items.dealer_id
       AND NOT public.wiz_is_wizard_estimate(e.source, e.idempotency_key, e.wizard_schema_version)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.estimates e
     WHERE e.id = estimate_items.estimate_id AND e.dealer_id = estimate_items.dealer_id
       AND NOT public.wiz_is_wizard_estimate(e.source, e.idempotency_key, e.wizard_schema_version)));

DROP POLICY IF EXISTS estimate_items_wizard_delete_block ON public.estimate_items;
CREATE POLICY estimate_items_wizard_delete_block ON public.estimate_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.estimates e
     WHERE e.id = estimate_items.estimate_id AND e.dealer_id = estimate_items.dealer_id
       AND NOT public.wiz_is_wizard_estimate(e.source, e.idempotency_key, e.wizard_schema_version)));

-- --- F. Function privileges -------------------------------------------------
-- Migration 104 records that the platform can restore PUBLIC EXECUTE on newly
-- created functions, so every CREATE/REPLACE here revokes explicitly first.

REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_is_wizard_estimate(text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_estimate_update()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_guard_estimate_item_dml()
  FROM PUBLIC, anon, authenticated, service_role;

-- The RPC is SERVER-ONLY: authenticated EXECUTE is deliberately NOT restored.
GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb)
  TO service_role;

-- The pure predicate is the ONLY helper granted to authenticated: RLS policy
-- expressions execute as the querying role. No EXECUTE grant is made on either
-- trigger function -- PostgreSQL does not check EXECUTE for trigger invocation.
GRANT EXECUTE ON FUNCTION public.wiz_is_wizard_estimate(text, text, text) TO authenticated;

COMMENT ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, text, jsonb) IS
  'Estimate Wizard Ver2.2 atomic save (hardened). SERVICE-ROLE ONLY. Validates the actor, '
  'requires exactly one active membership matching p_dealer_id, resolves the effective role, '
  'requires a well-formed idempotency key, fingerprints the canonical material payload, and '
  'stores the validated pricing snapshot without recalculation. NOT wired to runtime.';
COMMENT ON COLUMN public.estimates.idempotency_fingerprint IS
  'SHA-256 hex of the canonical material payload. No plaintext payload is stored.';
COMMENT ON COLUMN public.estimate_items.wizard_line_id IS
  'Deterministic wizard line identity; unique per estimate.';

COMMIT;

-- --- ROLLBACK (manual; NOT executed here) -----------------------------------
-- Reverse order: triggers -> policies -> functions -> index -> columns.
-- WARNING: dropping the guards re-exposes any already-persisted wizard estimates
-- to full direct DML. If wizard rows exist, this is a data-integrity regression,
-- not a neutral revert. Do not partially roll back (dropping only the item guard
-- while keeping the estimate guard leaves updateEstimate able to delete wizard
-- items while failing on the parent).
--
-- DROP TRIGGER IF EXISTS wiz_guard_estimate_item_dml_trg ON public.estimate_items;
-- DROP TRIGGER IF EXISTS wiz_guard_estimate_update_trg   ON public.estimates;
-- DROP POLICY  IF EXISTS estimate_items_wizard_delete_block ON public.estimate_items;
-- DROP POLICY  IF EXISTS estimate_items_wizard_update_block ON public.estimate_items;
-- DROP POLICY  IF EXISTS estimate_items_wizard_insert_block ON public.estimate_items;
-- DROP POLICY  IF EXISTS estimate_items_active_member_only  ON public.estimate_items;
-- DROP POLICY  IF EXISTS estimates_wizard_insert_block      ON public.estimates;
-- DROP FUNCTION IF EXISTS public.wiz_guard_estimate_item_dml();
-- DROP FUNCTION IF EXISTS public.wiz_guard_estimate_update();
-- DROP FUNCTION IF EXISTS public.wiz_is_wizard_estimate(text, text, text);
-- DROP INDEX    IF EXISTS public.estimate_items_estimate_wizard_line_uidx;
-- ALTER TABLE public.estimate_items DROP COLUMN IF EXISTS wizard_line_id;
-- ALTER TABLE public.estimates      DROP COLUMN IF EXISTS idempotency_fingerprint;
