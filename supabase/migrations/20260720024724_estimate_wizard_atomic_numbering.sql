-- ============================================================================
-- EW-UI-5A1-B7-0A — ATOMIC, REPLAY-AWARE ESTIMATE NUMBERING (forward-only).
--
-- STATUS: SOURCE CANDIDATE. Applied and verified in R64B on a DISPOSABLE LOCAL
--         stack only. Never against the linked, staging or production project.
--
-- ── THE DEFECT THIS REMOVES ─────────────────────────────────────────────────
-- Until now the caller allocated the estimate number in its OWN, separately
-- committed RPC (get_next_document_number) and passed the finished string in as
-- p_estimate_number. That allocation committed BEFORE this function had looked
-- at the idempotency key, so:
--   * an exact replay burned a number,
--   * a same-key/different-payload DUPLICATE_SUBMISSION burned a number,
--   * every rejected save burned a number,
--   * N unknown-result retries burned N numbers.
-- The number a caller finally saw was still correct; the damage was permanent,
-- unexplainable GAPS in document_sequences.
--
-- ── THE CORRECTION ──────────────────────────────────────────────────────────
-- Allocation moves INSIDE this function, after the advisory lock and after the
-- replay/conflict decision, and inside the same exception subtransaction as the
-- customer/vehicle/estimate writes. Replay, conflict and every failure path now
-- advance nothing. The four-argument signature is DROPPED so no second writable
-- path survives; p_estimate_number no longer exists and cannot be supplied.
--
-- Numbering FORMAT and the JST clock are mirrored from the committed
-- src/lib/numbering/numbering-types.ts (R63): segment assembly joined by "-",
-- no doubled sequence number, no truncation, Asia/Tokyo year/month.
--
-- get_next_document_number is UNCHANGED and still serves all ten legacy
-- one-argument TypeScript callers. Nothing here alters those paths.
-- ============================================================================

BEGIN;

-- --- A. Pure helper: canonical JST fiscal year ------------------------------
-- Mirrors computeFiscalYear(policy, date) exactly.
--   "never"   -> 0        "yearly" -> YYYY        "monthly" -> YYYYMM
-- The instant is an explicit parameter so boundary behaviour is testable
-- without depending on the wall clock. An unrecognised policy returns NULL and
-- the caller fails closed -- it never silently degrades to 0.
CREATE OR REPLACE FUNCTION public.wiz_document_fiscal_year(
  p_reset_policy text,
  p_at           timestamptz
) RETURNS integer
LANGUAGE sql
STABLE                      -- timestamptz -> local time depends on the tz database
STRICT                      -- NULL policy or NULL instant yields NULL, not 0
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fy$
  SELECT CASE p_reset_policy
           WHEN 'never'   THEN 0
           WHEN 'yearly'  THEN
             EXTRACT(YEAR FROM (p_at AT TIME ZONE 'Asia/Tokyo'))::integer
           WHEN 'monthly' THEN
             EXTRACT(YEAR  FROM (p_at AT TIME ZONE 'Asia/Tokyo'))::integer * 100
           + EXTRACT(MONTH FROM (p_at AT TIME ZONE 'Asia/Tokyo'))::integer
           ELSE NULL
         END;
$fy$;

-- --- B. Pure helper: canonical document-number formatter --------------------
-- Mirrors formatDocumentNumber(prefix, number, padding, fiscalYear) exactly.
-- The output is assembled from NON-EMPTY segments joined by "-", so a blank
-- prefix contributes no segment and leading/trailing/doubled hyphens are
-- structurally impossible.
--
-- lpad() is NOT used unguarded: PostgreSQL's lpad TRUNCATES a string longer
-- than the requested width, so lpad('123456', 5, '0') would silently yield
-- '12345'. Padding is applied only when the number is SHORTER than padding.
--
-- The stored prefix is emitted byte-for-byte: no trim, no default, no
-- normalization.
CREATE OR REPLACE FUNCTION public.wiz_format_document_number(
  p_prefix      text,
  p_number      integer,
  p_padding     integer,
  p_fiscal_year integer
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $fmt$
DECLARE
  v_num text;
  v_fy  text;
BEGIN
  IF p_padding < 1 OR p_number < 0 OR p_fiscal_year < 0 THEN
    RETURN NULL;                      -- caller fails closed
  END IF;

  v_num := p_number::text;
  IF length(v_num) < p_padding THEN   -- pad ONLY when shorter; never truncate
    v_num := lpad(v_num, p_padding, '0');
  END IF;

  v_fy := p_fiscal_year::text;
  RETURN
    CASE WHEN p_prefix <> '' THEN p_prefix || '-' ELSE '' END ||
    CASE
      WHEN p_fiscal_year >= 100000 THEN  -- monthly YYYYMM -> two segments
        substr(v_fy, 1, 4) || '-' || lpad(substr(v_fy, 5), 2, '0') || '-'
      WHEN p_fiscal_year > 0 THEN        -- yearly YYYY
        v_fy || '-'
      ELSE ''                           -- "never" (0) contributes no date segment
    END ||
    v_num;
END;
$fmt$;

-- --- C. The atomic save RPC, now three-argument -----------------------------
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
    -- --- C.10a Estimate number: allocated ONLY for a genuinely new save ------
    -- ORDERING IS THE WHOLE POINT OF THIS MIGRATION. Allocation sits AFTER the
    -- C.9 advisory lock and AFTER the replay/conflict decision, so an exact
    -- replay and a DUPLICATE_SUBMISSION both return having advanced NOTHING.
    -- Previously the caller allocated in a SEPARATE, already-committed RPC
    -- before this function ran, so every replay, every conflict and every
    -- rejected save permanently burned a document number.
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
    'ok', true, 'estimate_id', v_estimate_id, 'estimate_number', v_estimate_number,
    'customer_id', v_customer_id, 'vehicle_id', v_vehicle_id, 'idempotent_replay', false);
END;
$fn$;

-- --- D. Remove the OLD four-argument path entirely ---------------------------
-- DROPPED, not merely revoked: a revoked function still exists and could be
-- re-granted, leaving two writable paths into wizard persistence. Its only
-- caller was the (still unbound) gateway.
DROP FUNCTION IF EXISTS public.save_estimate_from_wizard(uuid, uuid, text, jsonb);

-- --- E. Privileges ----------------------------------------------------------
-- Migration 104 records that the platform can restore PUBLIC EXECUTE on newly
-- created functions, so every function here revokes explicitly first.

REVOKE EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_document_fiscal_year(text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wiz_format_document_number(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- The RPC stays SERVER-ONLY: authenticated EXECUTE is deliberately NOT restored.
GRANT EXECUTE ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, jsonb)
  TO service_role;

-- The two helpers are reached ONLY from the RPC above, which runs as
-- service_role. They read no table, write nothing, and are granted to no one
-- else -- anon and authenticated cannot execute them at all.
GRANT EXECUTE ON FUNCTION public.wiz_document_fiscal_year(text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.wiz_format_document_number(text, integer, integer, integer)
  TO service_role;

COMMENT ON FUNCTION public.save_estimate_from_wizard(uuid, uuid, jsonb) IS
  'Estimate Wizard Ver2.2 atomic save (hardened, replay-aware numbering). SERVICE-ROLE ONLY. '
  'Validates the actor, requires exactly one active membership matching p_dealer_id, resolves the '
  'effective role, requires a well-formed idempotency key, fingerprints the canonical material '
  'payload, and ALLOCATES the estimate number only after replay/conflict resolution so a replay, a '
  'DUPLICATE_SUBMISSION or any failure advances document_sequences by zero. NOT wired to runtime.';
COMMENT ON FUNCTION public.wiz_document_fiscal_year(text, timestamptz) IS
  'Canonical Asia/Tokyo fiscal-year value for a document reset policy. Pure; NULL on unknown policy.';
COMMENT ON FUNCTION public.wiz_format_document_number(text, integer, integer, integer) IS
  'Canonical document-number formatter. Mirrors src/lib/numbering/numbering-types.ts: segments '
  'joined by "-", blank prefix omitted, never truncates a number longer than the padding.';

COMMIT;

-- --- ROLLBACK (manual; NOT executed here) -----------------------------------
-- WARNING: reverting REINSTATES the number-burn defect. The four-argument
-- function would have to be re-created from
-- 20260719122621_estimate_wizard_atomic_save_hardening.sql, and every caller
-- would again have to pre-allocate a number in a separate committed RPC.
--
-- DROP FUNCTION IF EXISTS public.save_estimate_from_wizard(uuid, uuid, jsonb);
-- DROP FUNCTION IF EXISTS public.wiz_format_document_number(text, integer, integer, integer);
-- DROP FUNCTION IF EXISTS public.wiz_document_fiscal_year(text, timestamptz);
-- (then re-create the 4-arg function and its grants from the R56C migration)
