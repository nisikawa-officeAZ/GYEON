-- 20260727033223 — B2-B.3: persist the wizard customer into the CANONICAL columns.
--
-- FORWARD-ONLY. No existing migration is edited. This replaces
-- `public.save_estimate_from_wizard` with a definition that is IDENTICAL to the one established by
-- `20260726090000_extend_estimate_wizard_snapshot_metadata.sql` except for two strictly additive
-- changes, both confined to the mode=new customer path:
--
--   1. C.5   validates the OPTIONAL `customer.kana` and `customer.creditTerms` (string | null).
--   2. C.10  writes the canonical name/kana/address columns and `credit_terms` alongside the
--            legacy `name`/`address` that were already being written.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────
-- Migration 035 introduced the canonical column set (`last_name`, `first_name`, `last_name_kana`,
-- `first_name_kana`, `address1`, `address2`), back-filled it ONCE from the legacy columns, and
-- deliberately retained the legacy ones. Nothing keeps the two sets in sync — there is no trigger.
-- This function has been writing ONLY `name` and `address`, while every reader uses the canonical
-- set: the tenant customer search (`last_name, first_name, last_name_kana, first_name_kana,
-- address1, address2, phone`), the wizard reference preload (`last_name, first_name, phone`), and
-- the shared label composer. A customer created through the wizard was therefore reachable by
-- phone alone, and reached the label composer with a NULL `last_name`.
--
-- `kana` and `creditTerms` were a second instance of the same fault: both are captured in Screen 1
-- and carried in the save DTO, and both were silently discarded. `credit_terms` already exists on
-- `public.customers`, so nothing structural was ever missing.
--
-- ── MAPPING (follows the existing `src/lib/customers/create-customer.ts` precedent) ─────────────
-- That module already dual-writes `name = fullName` and `last_name = lastName ?? fullName`. This
-- function adopts the same convention rather than inventing a second one:
--
--   name            := btrim(name)              -- unchanged, NOT NULL column
--   last_name       := btrim(name)              -- the whole entered name; Screen 1 has ONE name field
--   first_name      := NULL                     -- never guessed by splitting on whitespace
--   last_name_kana  := nullif(btrim(kana), '')
--   first_name_kana := NULL                     -- same reason as first_name
--   address         := nullif(address, '')      -- unchanged
--   address1        := nullif(address, '')      -- same normalized value, canonical column
--   address2        := NULL                     -- Screen 1 has ONE address field
--   credit_terms    := nullif(creditTerms, '')
--
-- Splitting a single entered name into family/given parts is NOT attempted. A guess would be wrong
-- for company names and for any name whose spacing does not follow the assumed convention, and a
-- wrong split is worse than an unsplit name: it corrupts both the label and the search key.
--
-- ── NO TABLE DDL, NO RLS, NO TRIGGER, NO BACKFILL ───────────────────────────────
-- Every column written here already exists. Existing rows are NOT repaired: a backfill is a
-- separate decision with its own evidence requirements, and mixing it into a function replacement
-- would make this migration unreviewable and its rollback unclear.
--
-- ── NO POLICY CHANGE ────────────────────────────────────────────────────────────
-- No duplicate warning or block is introduced. Authorization, tenant scoping, the existing-customer
-- path, idempotency, vehicle creation, estimate creation, transaction atomicity and the error
-- contract are all preserved character-for-character.
--
-- ── NO PRICING ARITHMETIC ───────────────────────────────────────────────────────
-- This function still performs NO subtotal/discount/coupon/tax/total arithmetic and still never
-- recomputes a stored figure.
--
-- ── FINGERPRINT NOTE ────────────────────────────────────────────────────────────
-- The canonical projection at C.8 is UNCHANGED. `customer.kana` and `customer.creditTerms` were
-- already inside the projected `customer` object, so the fingerprint of a given payload is exactly
-- what it was before this migration. Idempotent replay of a save made under the previous definition
-- therefore still matches, and no in-flight idempotency key is invalidated.

CREATE OR REPLACE FUNCTION public.save_estimate_from_wizard(
  p_dealer_id       uuid,
  p_actor_user_id   uuid,
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
  v_estimate_number text;
  v_seq_prefix  text;
  v_seq_padding integer;
  v_seq_policy  text;
  v_fiscal_year integer;
  v_next_number integer;
  v_config_rev  bigint;   -- B1.1-B2: optional configuration attribution
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
  -- C.8 projects these into the canonical fingerprint and C.10 persists
  -- source + schemaVersion + configurationRevision, so an unvalidated metadata
  -- block would be hashed and stored before anything checked it.
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

  -- B1.1-B2: OPTIONAL configuration attribution. Absent OR explicit JSON null
  -- both mean "unattributed" and persist as NULL. When present as a number it
  -- must be a non-negative INTEGER: the column is bigint, so a fractional value
  -- would be silently rounded by the cast, and a negative one would only be
  -- caught later by estimates_configuration_revision_nonneg. Reject, never repair.
  v_config_rev := NULL;
  IF v_metadata ? 'configurationRevision' THEN
    IF jsonb_typeof(v_metadata -> 'configurationRevision') NOT IN ('number','null') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: metadata.configurationRevision must be a number or null';
    END IF;
    IF jsonb_typeof(v_metadata -> 'configurationRevision') = 'number' THEN
      v_n := ((v_metadata -> 'configurationRevision') #>> '{}')::numeric;
      IF v_n = 'NaN'::numeric OR v_n = 'Infinity'::numeric OR v_n = '-Infinity'::numeric THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: metadata.configurationRevision is not finite';
      END IF;
      IF v_n <> trunc(v_n) OR v_n < 0 OR v_n > 9223372036854775807 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: metadata.configurationRevision is outside the accepted domain';
      END IF;
      v_config_rev := v_n::bigint;
    END IF;
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
    -- B2-B.3: kana / creditTerms — OPTIONAL keys, each string | null when present.
    --
    -- Validated but NOT required, deliberately. Requiring them would reject every payload produced
    -- by a client that has not yet been redeployed, turning a persistence fix into a save outage.
    -- An ABSENT key is treated exactly like an explicit null: nothing to persist. A key present with
    -- a non-string, non-null type is still a malformed payload and is refused, consistent with every
    -- other field validated here.
    FOREACH v_key IN ARRAY ARRAY['kana','creditTerms'] LOOP
      IF v_customer ? v_key
         AND jsonb_typeof(v_customer -> v_key) NOT IN ('string','null') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: customer.% must be a string or null', v_key;
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
  --
  -- B1.1-B2: configurationRevision JOINS the projection. Two saves that differ
  -- only in the configuration that produced them are materially different and
  -- must not replay as one another; a genuine retry carries the same revision
  -- and still fingerprints identically. `coalesce(..., 'null')` keeps an absent
  -- key and an explicit null hashing identically, since both mean unattributed.
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
                  'source',                v_metadata ->> 'source',
                  'schemaVersion',         v_metadata ->> 'schemaVersion',
                  'createdFromWizard',     v_metadata -> 'createdFromWizard',
                  'previewConfirmed',      v_metadata -> 'previewConfirmed',
                  'configurationRevision', coalesce(v_metadata -> 'configurationRevision', 'null'::jsonb))
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
    -- --- C.10a Estimate number: allocated ONLY for a genuinely new save ------
    -- ORDERING IS THE WHOLE POINT OF THE NUMBERING MIGRATION. Allocation sits
    -- AFTER the C.9 advisory lock and AFTER the replay/conflict decision, so an
    -- exact replay and a DUPLICATE_SUBMISSION both return having advanced
    -- NOTHING.
    --
    -- It also sits INSIDE this block, which is the same exception
    -- subtransaction as the customer/vehicle/estimate writes. That placement is
    -- load-bearing: when the idempotency unique index fires below and the
    -- handler returns a replay, PostgreSQL rolls this block back in full, so the
    -- allocation this attempt performed is undone with it. A later item failure
    -- (C.11) raises out of the function and aborts the whole transaction, which
    -- rolls the sequence back as well.
    --
    -- get_next_document_number is deliberately NOT called: migration 104 revoked
    -- its EXECUTE from service_role and its authorization reads auth.uid(),
    -- which is NULL under service_role. The upsert is therefore inlined here,
    -- guarded by the actor/dealer/role checks C.1 already performed.

    -- Deterministic single configuration row: most recently updated wins.
    SELECT s.prefix, s.padding, s.reset_policy
      INTO v_seq_prefix, v_seq_padding, v_seq_policy
      FROM public.document_sequences s
     WHERE s.dealer_id = p_dealer_id
       AND s.sequence_type = 'estimate'
     ORDER BY s.updated_at DESC, s.created_at DESC, s.fiscal_year DESC, s.id DESC
     LIMIT 1;

    -- No row yet: the wizard's canonical defaults, which mirror the TypeScript
    -- defaultPrefix("estimate") / padding 5 / "never". The TABLE default for
    -- prefix is '' and is deliberately NOT used -- it would produce a blank
    -- prefix the TypeScript allocator would never have chosen.
    IF NOT FOUND THEN
      v_seq_prefix  := 'EST';
      v_seq_padding := 5;
      v_seq_policy  := 'never';
    END IF;

    -- CURRENT_TIMESTAMP is the transaction timestamp, so every read of the
    -- clock inside this save agrees, and the JST conversion is explicit.
    v_fiscal_year := public.wiz_document_fiscal_year(v_seq_policy, CURRENT_TIMESTAMP);
    IF v_fiscal_year IS NULL THEN
      RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate numbering configuration is unusable';
    END IF;

    -- Nested ONLY to map an allocation fault to the stable code. It remains
    -- inside the outer block, so it cannot escape the rollback boundary above.
    BEGIN
      INSERT INTO public.document_sequences
        (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy, current_number)
      VALUES
        (p_dealer_id, 'estimate', v_fiscal_year, v_seq_prefix, v_seq_padding, v_seq_policy, 1)
      ON CONFLICT (dealer_id, sequence_type, fiscal_year) DO UPDATE
        SET current_number = document_sequences.current_number + 1,
            updated_at     = now()
      RETURNING current_number, prefix, padding, reset_policy, fiscal_year
        INTO v_next_number, v_seq_prefix, v_seq_padding, v_seq_policy, v_fiscal_year;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate number could not be allocated';
    END;

    -- Formatted from the values the TARGET ROW actually holds after the upsert,
    -- never from the values this call proposed: an existing row's stored prefix
    -- and padding are authoritative.
    v_estimate_number := public.wiz_format_document_number(
      v_seq_prefix, v_next_number, v_seq_padding, v_fiscal_year);
    IF v_estimate_number IS NULL OR btrim(v_estimate_number) = '' THEN
      RAISE EXCEPTION 'ESTIMATE_NUMBER_FAILED: estimate number could not be formatted';
    END IF;

    IF (v_customer ->> 'mode') = 'existing' THEN
      SELECT id INTO v_customer_id FROM public.customers
       WHERE id = (v_customer ->> 'customerId')::uuid
         AND dealer_id = p_dealer_id AND deleted_at IS NULL;
      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: customer does not belong to the dealer';
      END IF;
    ELSE
      -- B2-B.3: the LEGACY columns (`name`, `address`) keep exactly the values they had, and the
      -- CANONICAL columns are written from the SAME normalized expressions. Both sets are populated
      -- because migration 035 retained the legacy columns without a sync trigger, so writing only
      -- one set leaves the other permanently stale for this row. `first_name`, `first_name_kana` and
      -- `address2` are explicit NULLs: Screen 1 has a single name field and a single address field,
      -- and splitting one entered string into parts would be a guess — wrong for company names and
      -- for any spacing that does not match the assumed convention, and a wrong split corrupts both
      -- the displayed label and the search key.
      INSERT INTO public.customers (
        dealer_id, name, phone, email, postal_code, address, line_user_id,
        is_business, trade_discount_pct, accounts_receivable_allowed, closing_day, payment_day,
        last_name, first_name, last_name_kana, first_name_kana, address1, address2, credit_terms
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
        nullif(v_customer ->> 'paymentDay', '')::integer,
        -- last_name: the WHOLE trimmed entered name, matching what `name` receives and following the
        -- existing create-customer.ts convention (`last_name = lastName ?? fullName`). This is the
        -- column the tenant customer search and the reference preload actually read.
        btrim(v_customer ->> 'name'),
        NULL,                                              -- first_name: never guessed
        nullif(btrim(v_customer ->> 'kana'), ''),          -- last_name_kana
        NULL,                                              -- first_name_kana: never guessed
        nullif(v_customer ->> 'address', ''),              -- address1: same value as legacy `address`
        NULL,                                              -- address2: Screen 1 has one address field
        nullif(btrim(v_customer ->> 'creditTerms'), '')    -- credit_terms: column already existed
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
    -- B1.1-B2 adds ONE column: configuration_revision, copied verbatim from the
    -- validated metadata. It participates in no arithmetic.
      INSERT INTO public.estimates (
        dealer_id, customer_id, vehicle_id, estimate_no, estimate_number, status,
        subtotal, tax, tax_rate, tax_amount, discount_amount, total, notes, internal_memo,
        pricing_completeness, pricing_warnings, pricing_errors, discount_intent, coupon_intent,
        non_priceable_selections, idempotency_key, idempotency_fingerprint, source,
        wizard_schema_version, configuration_revision
      ) VALUES (
        p_dealer_id, v_customer_id, v_vehicle_id, v_estimate_number, v_estimate_number, 'draft',
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
        v_metadata ->> 'schemaVersion',
        v_config_rev
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
    'ok', true, 'estimate_id', v_estimate_id, 'estimate_number', v_estimate_number,
    'customer_id', v_customer_id, 'vehicle_id', v_vehicle_id, 'idempotent_replay', false);
END;
$fn$;

-- Grants are NOT re-issued here: CREATE OR REPLACE preserves the existing ACL, and migration 104
-- remains the single authority for who may EXECUTE this function.

-- =============================================================================
-- Rollback note (manual, never automatic)
-- =============================================================================
--   Re-apply the `save_estimate_from_wizard` definition from
--   20260726090000_extend_estimate_wizard_snapshot_metadata.sql verbatim. No column is dropped and
--   no data is removed: the restored function simply stops writing the canonical columns, and any
--   value already written remains valid and continues to be read correctly.
