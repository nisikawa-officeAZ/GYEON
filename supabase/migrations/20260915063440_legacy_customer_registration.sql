-- 20260915063440 — GDA legacy customer registration (Gate B1 candidate; NOT applied in this phase).
--
-- Owner-ratified contract: docs/master_specification/GDA_LEGACY_CUSTOMER_REGISTRATION_IMPLEMENTATION_CONTRACT_V1.md
--   • public.vehicle_service_history — dedicated legacy service-history table (registration + readback in V1)
--   • public.legacy_customer_registration_receipts — immutable, zero-history-safe idempotency anchor
--   • public.register_legacy_customer(jsonb) — one atomic idempotent SECURITY INVOKER registration function
-- Security posture (104 manifest style): revoke automatic grants first, grant back only the accepted
-- operations, enable RLS, bind every authenticated policy to ACTIVE dealer membership. Authentication
-- alone is never authorization. No authenticated UPDATE/DELETE authority exists on receipts.

-- ─── 1. Tenant-bound composite-FK anchors on existing parents (purely additive) ──────────────
-- (id, dealer_id) is trivially unique because id is the primary key; these indexes exist only so the
-- new tables can carry composite foreign keys that bind child dealer_id to the parent row's dealer_id.
CREATE UNIQUE INDEX IF NOT EXISTS customers_id_dealer_id_uidx ON public.customers (id, dealer_id);
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_id_dealer_id_uidx  ON public.vehicles  (id, dealer_id);

-- ─── 2. vehicle_service_history ──────────────────────────────────────────────────────────────
CREATE TABLE public.vehicle_service_history (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id             uuid        NOT NULL REFERENCES public.dealers (id),
  vehicle_id            uuid        NOT NULL,
  customer_id           uuid        NULL,
  category              text        NOT NULL,
  performed_on          date        NOT NULL,
  service_name          text        NOT NULL,
  notes                 text        NULL,
  source                text        NOT NULL DEFAULT 'legacy_manual',
  source_ocr_session_id uuid        NULL,
  created_by            uuid        NOT NULL REFERENCES auth.users (id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  archived_at           timestamptz NULL,

  CONSTRAINT vehicle_service_history_category_check CHECK (category IN
    ('coating', 'maintenance', 'car_wash', 'ppf', 'window_film', 'room_cleaning', 'other')),
  CONSTRAINT vehicle_service_history_performed_on_check CHECK (performed_on <= current_date),
  CONSTRAINT vehicle_service_history_service_name_check
    CHECK (char_length(btrim(service_name)) >= 1 AND char_length(service_name) <= 200),
  CONSTRAINT vehicle_service_history_notes_check CHECK (notes IS NULL OR char_length(notes) <= 2000),
  -- Tenant-bound integrity: the referenced vehicle/customer row must carry the SAME dealer_id.
  CONSTRAINT vehicle_service_history_vehicle_tenant_fkey
    FOREIGN KEY (vehicle_id, dealer_id) REFERENCES public.vehicles (id, dealer_id),
  CONSTRAINT vehicle_service_history_customer_tenant_fkey
    FOREIGN KEY (customer_id, dealer_id) REFERENCES public.customers (id, dealer_id)
);

CREATE INDEX vehicle_service_history_dealer_vehicle_performed_idx
  ON public.vehicle_service_history (dealer_id, vehicle_id, performed_on DESC);

-- updated_at audit column maintenance (existing shared trigger function; dormant in V1 because no
-- authenticated UPDATE authority is granted, but correct once auditable archive semantics arrive).
CREATE TRIGGER vehicle_service_history_set_updated_at
  BEFORE UPDATE ON public.vehicle_service_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. legacy_customer_registration_receipts — immutable idempotency anchor ─────────────────
CREATE TABLE public.legacy_customer_registration_receipts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id           uuid        NOT NULL REFERENCES public.dealers (id),
  idempotency_key     text        NOT NULL,
  payload_fingerprint text        NOT NULL,
  customer_id         uuid        NOT NULL,
  vehicle_id          uuid        NOT NULL,
  created_by          uuid        NOT NULL REFERENCES auth.users (id),
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT legacy_customer_registration_receipts_dealer_key_key UNIQUE (dealer_id, idempotency_key),
  CONSTRAINT legacy_customer_registration_receipts_idempotency_key_check
    CHECK (char_length(btrim(idempotency_key)) >= 1 AND char_length(idempotency_key) <= 200),
  -- Server-owned canonical SHA-256 fingerprint: exactly 64 lowercase hex characters.
  CONSTRAINT legacy_customer_registration_receipts_payload_fingerprint_check
    CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT legacy_customer_registration_receipts_customer_tenant_fkey
    FOREIGN KEY (customer_id, dealer_id) REFERENCES public.customers (id, dealer_id),
  CONSTRAINT legacy_customer_registration_receipts_vehicle_tenant_fkey
    FOREIGN KEY (vehicle_id, dealer_id) REFERENCES public.vehicles (id, dealer_id)
);

-- ─── 4. Table privileges: revoke automatic grants FIRST, then grant back the minimum ─────────
REVOKE ALL PRIVILEGES ON TABLE public.vehicle_service_history
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.legacy_customer_registration_receipts
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_service_history TO service_role;
-- Receipts are append-only in V1: even the trusted server role receives no UPDATE/DELETE grant.
GRANT SELECT, INSERT ON TABLE public.legacy_customer_registration_receipts TO service_role;

-- authenticated: registration (INSERT via the invoker function) + readback (SELECT). No UPDATE, no
-- DELETE on either table — post-save correction is a deferred, separately governed phase.
GRANT SELECT, INSERT ON TABLE public.vehicle_service_history TO authenticated;
GRANT SELECT, INSERT ON TABLE public.legacy_customer_registration_receipts TO authenticated;
-- anon: intentionally NO grant on either table.

-- ─── 5. RLS: every authenticated policy binds to ACTIVE dealer membership ────────────────────
ALTER TABLE public.vehicle_service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_customer_registration_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY vsh_member_select ON public.vehicle_service_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dealer_members dm
                 WHERE dm.user_id = auth.uid()
                   AND dm.dealer_id = vehicle_service_history.dealer_id
                   AND dm.status = 'active'));

-- INSERT additionally requires the SAME edit capability the registration function enforces: an
-- ACTIVE dealer_staff row's role wins, else the membership row's role; only owner/manager/staff
-- may write. A readonly member therefore cannot bypass the RPC via direct INSERT (SELECT remains).
CREATE POLICY vsh_member_insert ON public.vehicle_service_history
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dealer_members dm
                WHERE dm.user_id = auth.uid()
                  AND dm.dealer_id = vehicle_service_history.dealer_id
                  AND dm.status = 'active'
                  AND coalesce(
                        (SELECT ds.role::text FROM public.dealer_staff ds
                         WHERE ds.user_id = auth.uid()
                           AND ds.dealer_id = vehicle_service_history.dealer_id
                           AND ds.status = 'active'),
                        dm.role::text) IN ('owner', 'manager', 'staff')));

CREATE POLICY lcr_member_select ON public.legacy_customer_registration_receipts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dealer_members dm
                 WHERE dm.user_id = auth.uid()
                   AND dm.dealer_id = legacy_customer_registration_receipts.dealer_id
                   AND dm.status = 'active'));

CREATE POLICY lcr_member_insert ON public.legacy_customer_registration_receipts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dealer_members dm
                WHERE dm.user_id = auth.uid()
                  AND dm.dealer_id = legacy_customer_registration_receipts.dealer_id
                  AND dm.status = 'active'
                  AND coalesce(
                        (SELECT ds.role::text FROM public.dealer_staff ds
                         WHERE ds.user_id = auth.uid()
                           AND ds.dealer_id = legacy_customer_registration_receipts.dealer_id
                           AND ds.status = 'active'),
                        dm.role::text) IN ('owner', 'manager', 'staff')));
-- Deliberately NO UPDATE and NO DELETE policy on either table (fail closed under RLS).

-- ─── 6. Atomic idempotent registration function (SECURITY INVOKER) ───────────────────────────
-- Runs inside the caller's transaction: any RAISE rolls back EVERY customer/vehicle/history/receipt
-- write. Dealer and actor are derived server-side from auth.uid() + active dealer membership; the
-- payload can never name its tenant, role, or audit actor. The canonical payload fingerprint is
-- calculated here, server-side, from the validated canonical payload only. All failure paths raise
-- stable sanitized codes; no raw SQL error text and no PII is returned or logged.
CREATE OR REPLACE FUNCTION public.register_legacy_customer(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor            uuid;
  v_membership_count integer;
  v_dealer_id        uuid;
  v_membership_role  text;
  v_staff_role       text;
  v_effective_role   text;
  v_key              text;
  v_customer         jsonb;
  v_vehicle          jsonb;
  v_history          jsonb;
  v_customer_mode    text;
  v_vehicle_mode     text;
  v_customer_canon   jsonb;
  v_vehicle_canon    jsonb;
  v_history_canon    jsonb := '[]'::jsonb;
  v_canonical        jsonb;
  v_fingerprint      text;
  v_existing         record;
  v_customer_id      uuid;
  v_vehicle_id       uuid;
  v_vehicle_owner    uuid;
  v_name             text;
  v_last_name        text;
  v_first_name       text;
  v_last_name_kana   text;
  v_first_name_kana  text;
  v_row              jsonb;
  v_performed_raw    text;
  v_receipt_id       uuid;
BEGIN
  -- 1. Server-derived actor. Authentication alone is NOT authorization.
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: authentication required';
  END IF;

  -- 2. Server-derived dealer: exactly ONE active membership. Zero fails closed; an ambiguous
  --    tenant fails closed rather than letting the planner pick one.
  SELECT count(*) INTO v_membership_count
    FROM public.dealer_members
    WHERE user_id = v_actor AND status = 'active';
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ACTIVE_MEMBERSHIP: caller has no active dealer membership';
  ELSIF v_membership_count > 1 THEN
    RAISE EXCEPTION 'DEALER_CONTEXT_AMBIGUOUS: caller has more than one active dealer membership';
  END IF;
  SELECT dealer_id, role::text INTO v_dealer_id, v_membership_role
    FROM public.dealer_members
    WHERE user_id = v_actor AND status = 'active';

  -- 2b. Contract-required edit capability. An ACTIVE dealer_staff row for this SAME actor and
  --     dealer overrides the membership role; when no active staff row exists, the SAME membership
  --     row's role applies (mirrors src/lib/auth/estimate-save-actor-context.ts). Unknown or
  --     non-editing roles fail closed; readonly is denied with a stable sanitized code. The
  --     payload never supplies the dealer or the role.
  SELECT role::text INTO v_staff_role
    FROM public.dealer_staff
    WHERE user_id = v_actor AND dealer_id = v_dealer_id AND status = 'active';
  v_effective_role := coalesce(v_staff_role, v_membership_role);
  IF v_effective_role IS NULL OR v_effective_role NOT IN ('owner', 'manager', 'staff') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: caller may not edit business data';
  END IF;

  -- 3. Payload shape + bounded non-blank idempotency key.
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: payload object required';
  END IF;
  v_key := btrim(coalesce(p_payload ->> 'idempotencyKey', ''));
  IF v_key = '' OR char_length(v_key) > 200 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_INVALID: idempotency key must be 1-200 non-blank characters';
  END IF;

  v_customer := p_payload -> 'customer';
  v_vehicle  := p_payload -> 'vehicle';
  v_history  := coalesce(p_payload -> 'history', '[]'::jsonb);
  IF v_customer IS NULL OR jsonb_typeof(v_customer) <> 'object'
     OR v_vehicle IS NULL OR jsonb_typeof(v_vehicle) <> 'object'
     OR jsonb_typeof(v_history) <> 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: customer, vehicle and history shapes are invalid';
  END IF;

  v_customer_mode := v_customer ->> 'mode';
  v_vehicle_mode  := v_vehicle ->> 'mode';
  IF v_customer_mode NOT IN ('new', 'existing') OR v_vehicle_mode NOT IN ('new', 'existing') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: customer and vehicle mode must be new or existing';
  END IF;
  IF v_customer_mode = 'new' AND v_vehicle_mode = 'existing' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: unsupported customer and vehicle combination';
  END IF;

  -- 4. Canonicalize the VALIDATED payload (single source for fingerprint AND inserts).
  IF v_customer_mode = 'existing' THEN
    IF nullif(v_customer ->> 'customerId', '') IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: existing customer id required';
    END IF;
    v_customer_canon := jsonb_build_object('mode', 'existing', 'customerId', v_customer ->> 'customerId');
  ELSE
    v_last_name  := nullif(btrim(coalesce(v_customer ->> 'lastName', '')), '');
    v_first_name := nullif(btrim(coalesce(v_customer ->> 'firstName', '')), '');
    v_name := coalesce(
      nullif(btrim(coalesce(v_customer ->> 'name', '')), ''),
      nullif(btrim(concat_ws(' ', v_last_name, v_first_name)), ''));
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer name required';
    END IF;
    v_last_name_kana  := nullif(btrim(coalesce(v_customer ->> 'lastNameKana', '')), '');
    v_first_name_kana := nullif(btrim(coalesce(v_customer ->> 'firstNameKana', '')), '');
    -- Furigana is a required non-empty search aid; non-katakana text is NOT rejected and no
    -- surname/given-name split is invented.
    IF v_last_name_kana IS NULL AND v_first_name_kana IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: customer furigana required';
    END IF;
    v_customer_canon := jsonb_build_object(
      'mode',          'new',
      'name',          v_name,
      'lastName',      v_last_name,
      'firstName',     v_first_name,
      'lastNameKana',  v_last_name_kana,
      'firstNameKana', v_first_name_kana,
      'phone',         nullif(btrim(coalesce(v_customer ->> 'phone', '')), ''),
      'email',         nullif(btrim(coalesce(v_customer ->> 'email', '')), ''),
      'postalCode',    nullif(btrim(coalesce(v_customer ->> 'postalCode', '')), ''),
      'prefecture',    nullif(btrim(coalesce(v_customer ->> 'prefecture', '')), ''),
      'city',          nullif(btrim(coalesce(v_customer ->> 'city', '')), ''),
      'address1',      nullif(btrim(coalesce(v_customer ->> 'address1', '')), ''),
      'address2',      nullif(btrim(coalesce(v_customer ->> 'address2', '')), ''),
      'notes',         nullif(btrim(coalesce(v_customer ->> 'notes', '')), ''),
      'isBusiness',    coalesce((v_customer ->> 'isBusiness')::boolean, false));
  END IF;

  IF v_vehicle_mode = 'existing' THEN
    IF nullif(v_vehicle ->> 'vehicleId', '') IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: existing vehicle id required';
    END IF;
    v_vehicle_canon := jsonb_build_object('mode', 'existing', 'vehicleId', v_vehicle ->> 'vehicleId');
  ELSE
    v_vehicle_canon := jsonb_build_object(
      'mode',                       'new',
      'maker',                      nullif(btrim(coalesce(v_vehicle ->> 'maker', '')), ''),
      'model',                      nullif(btrim(coalesce(v_vehicle ->> 'model', '')), ''),
      'grade',                      nullif(btrim(coalesce(v_vehicle ->> 'grade', '')), ''),
      'year',                       nullif(btrim(coalesce(v_vehicle ->> 'year', '')), ''),
      'color',                      nullif(btrim(coalesce(v_vehicle ->> 'color', '')), ''),
      'plateNumber',                nullif(btrim(coalesce(v_vehicle ->> 'plateNumber', '')), ''),
      'vin',                        nullif(btrim(coalesce(v_vehicle ->> 'vin', '')), ''),
      'bodySize',                   nullif(btrim(coalesce(v_vehicle ->> 'bodySize', '')), ''),
      'vehicleCode',                nullif(btrim(coalesce(v_vehicle ->> 'vehicleCode', '')), ''),
      'firstRegistrationYearMonth', nullif(btrim(coalesce(v_vehicle ->> 'firstRegistrationYearMonth', '')), ''),
      'registrationDate',           nullif(btrim(coalesce(v_vehicle ->> 'registrationDate', '')), ''),
      'inspectionExpiryDate',       nullif(btrim(coalesce(v_vehicle ->> 'inspectionExpiryDate', '')), ''),
      'displacement',               nullif(btrim(coalesce(v_vehicle ->> 'displacement', '')), ''),
      'fuelType',                   nullif(btrim(coalesce(v_vehicle ->> 'fuelType', '')), ''),
      'notes',                      nullif(btrim(coalesce(v_vehicle ->> 'notes', '')), ''));
  END IF;

  -- History: ZERO or more rows; validate every row before any write.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_history)
  LOOP
    IF jsonb_typeof(v_row) <> 'object' THEN
      RAISE EXCEPTION 'HISTORY_INVALID: history entry must be an object';
    END IF;
    IF coalesce(v_row ->> 'category', '') NOT IN
       ('coating', 'maintenance', 'car_wash', 'ppf', 'window_film', 'room_cleaning', 'other') THEN
      RAISE EXCEPTION 'HISTORY_INVALID: unsupported history category';
    END IF;
    v_performed_raw := coalesce(v_row ->> 'performedOn', '');
    IF v_performed_raw !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'HISTORY_INVALID: performed_on must be a YYYY-MM-DD date';
    END IF;
    IF v_performed_raw::date > current_date THEN
      RAISE EXCEPTION 'HISTORY_INVALID: performed_on cannot be in the future';
    END IF;
    IF char_length(btrim(coalesce(v_row ->> 'serviceName', ''))) < 1
       OR char_length(coalesce(v_row ->> 'serviceName', '')) > 200 THEN
      RAISE EXCEPTION 'HISTORY_INVALID: service_name must be 1-200 characters';
    END IF;
    IF char_length(coalesce(v_row ->> 'notes', '')) > 2000 THEN
      RAISE EXCEPTION 'HISTORY_INVALID: notes must be at most 2000 characters';
    END IF;
    v_history_canon := v_history_canon || jsonb_build_array(jsonb_build_object(
      'category',           v_row ->> 'category',
      'performedOn',        v_performed_raw,
      'serviceName',        btrim(v_row ->> 'serviceName'),
      'notes',              nullif(btrim(coalesce(v_row ->> 'notes', '')), ''),
      'sourceOcrSessionId', nullif(v_row ->> 'sourceOcrSessionId', '')));
  END LOOP;

  -- Server-owned canonical SHA-256 fingerprint (jsonb::text is key-order deterministic).
  v_canonical := jsonb_build_object(
    'customer', v_customer_canon, 'vehicle', v_vehicle_canon, 'history', v_history_canon);
  v_fingerprint := encode(sha256(convert_to(v_canonical::text, 'UTF8')), 'hex');

  -- 5. Reserve the (dealer_id, idempotency_key) identity: serialize same-key callers, then decide.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('legacy_customer_registration:' || v_dealer_id::text || ':' || v_key, 0));

  SELECT payload_fingerprint, customer_id, vehicle_id INTO v_existing
    FROM public.legacy_customer_registration_receipts
    WHERE dealer_id = v_dealer_id AND idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.payload_fingerprint = v_fingerprint THEN
      -- Same key + same canonical payload: return the ORIGINAL ids; write NOTHING.
      RETURN jsonb_build_object(
        'ok', true, 'customerId', v_existing.customer_id, 'vehicleId', v_existing.vehicle_id,
        'idempotentReplay', true);
    END IF;
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: idempotency key reused with a different payload';
  END IF;

  -- 6. Select or create the customer (tenant-verified; soft-deleted rows are not selectable).
  IF v_customer_mode = 'existing' THEN
    SELECT id INTO v_customer_id
      FROM public.customers
      WHERE id = (v_customer_canon ->> 'customerId')::uuid
        AND dealer_id = v_dealer_id AND deleted_at IS NULL;
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: customer does not belong to the dealer';
    END IF;
  ELSE
    INSERT INTO public.customers (
      dealer_id, name, last_name, first_name, last_name_kana, first_name_kana,
      phone, email, postal_code, prefecture, city, address1, address2, notes, is_business
    ) VALUES (
      v_dealer_id,
      v_customer_canon ->> 'name',
      coalesce(v_customer_canon ->> 'lastName', v_customer_canon ->> 'name'),
      v_customer_canon ->> 'firstName',
      v_customer_canon ->> 'lastNameKana',
      v_customer_canon ->> 'firstNameKana',
      v_customer_canon ->> 'phone',
      v_customer_canon ->> 'email',
      v_customer_canon ->> 'postalCode',
      v_customer_canon ->> 'prefecture',
      v_customer_canon ->> 'city',
      v_customer_canon ->> 'address1',
      v_customer_canon ->> 'address2',
      v_customer_canon ->> 'notes',
      coalesce((v_customer_canon ->> 'isBusiness')::boolean, false)
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- 7. Select or create the vehicle (tenant-verified AND bound to the resolved customer).
  IF v_vehicle_mode = 'existing' THEN
    SELECT id, customer_id INTO v_vehicle_id, v_vehicle_owner
      FROM public.vehicles
      WHERE id = (v_vehicle_canon ->> 'vehicleId')::uuid
        AND dealer_id = v_dealer_id AND deleted_at IS NULL;
    IF v_vehicle_id IS NULL THEN
      RAISE EXCEPTION 'VEHICLE_NOT_FOUND: vehicle does not belong to the dealer';
    END IF;
    IF v_vehicle_owner IS DISTINCT FROM v_customer_id THEN
      RAISE EXCEPTION 'VEHICLE_CUSTOMER_MISMATCH: vehicle does not belong to the resolved customer';
    END IF;
  ELSE
    INSERT INTO public.vehicles (
      dealer_id, customer_id, maker, model, grade, year, color, plate_number, vin,
      body_size, vehicle_code, first_registration_year_month, registration_date,
      inspection_expiry_date, displacement, fuel_type, notes
    ) VALUES (
      v_dealer_id, v_customer_id,
      v_vehicle_canon ->> 'maker',
      v_vehicle_canon ->> 'model',
      v_vehicle_canon ->> 'grade',
      v_vehicle_canon ->> 'year',
      v_vehicle_canon ->> 'color',
      v_vehicle_canon ->> 'plateNumber',
      v_vehicle_canon ->> 'vin',
      v_vehicle_canon ->> 'bodySize',
      v_vehicle_canon ->> 'vehicleCode',
      v_vehicle_canon ->> 'firstRegistrationYearMonth',
      (v_vehicle_canon ->> 'registrationDate')::date,
      (v_vehicle_canon ->> 'inspectionExpiryDate')::date,
      v_vehicle_canon ->> 'displacement',
      v_vehicle_canon ->> 'fuelType',
      v_vehicle_canon ->> 'notes'
    ) RETURNING id INTO v_vehicle_id;
  END IF;

  -- 8. Insert ZERO or more history rows from the canonical payload.
  FOR v_row IN SELECT * FROM jsonb_array_elements(v_history_canon)
  LOOP
    INSERT INTO public.vehicle_service_history (
      dealer_id, vehicle_id, customer_id, category, performed_on, service_name, notes,
      source, source_ocr_session_id, created_by
    ) VALUES (
      v_dealer_id, v_vehicle_id, v_customer_id,
      v_row ->> 'category',
      (v_row ->> 'performedOn')::date,
      v_row ->> 'serviceName',
      v_row ->> 'notes',
      'legacy_manual',
      (v_row ->> 'sourceOcrSessionId')::uuid,
      v_actor
    );
  END LOOP;

  -- 9. Insert the immutable receipt with the resolved ids and server-derived actor.
  INSERT INTO public.legacy_customer_registration_receipts (
    dealer_id, idempotency_key, payload_fingerprint, customer_id, vehicle_id, created_by
  ) VALUES (
    v_dealer_id, v_key, v_fingerprint, v_customer_id, v_vehicle_id, v_actor
  ) RETURNING id INTO v_receipt_id;

  -- 10. Commit happens only if every operation above succeeded (single transaction).
  RETURN jsonb_build_object(
    'ok', true, 'customerId', v_customer_id, 'vehicleId', v_vehicle_id,
    'receiptId', v_receipt_id, 'idempotentReplay', false);

EXCEPTION
  WHEN raise_exception THEN
    RAISE;  -- our own stable sanitized codes pass through unchanged
  WHEN OTHERS THEN
    -- Backstop: never surface raw SQL error text (and never PII) to the caller.
    RAISE EXCEPTION 'REGISTRATION_FAILED: legacy customer registration could not be completed';
END;
$$;

-- ─── 7. Function privileges: revoke PUBLIC execute, grant ONLY the intended caller ───────────
-- 104-verified platform caveat: PUBLIC EXECUTE can be restored on newly created functions, so the
-- explicit revoke-then-exact-regrant is mandatory here.
REVOKE EXECUTE ON FUNCTION public.register_legacy_customer(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_legacy_customer(jsonb) TO authenticated;

-- ─── 8. Comments ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.vehicle_service_history IS
  'Legacy (pre-Detailer-Agent) service history. Registration + readback in V1; correction is a '
  'deferred auditable-archive phase. Tenant-bound composite FKs; RLS bound to active dealer membership.';
COMMENT ON TABLE public.legacy_customer_registration_receipts IS
  'Immutable zero-history-safe idempotency anchor for legacy customer registration. Append-only in '
  'V1: no authenticated UPDATE/DELETE grant or policy. Unique per (dealer_id, idempotency_key).';
COMMENT ON FUNCTION public.register_legacy_customer(jsonb) IS
  'Atomic idempotent legacy customer+vehicle+history registration. SECURITY INVOKER (explicit '
  'grants + tenant-bound RLS). Dealer and actor derived server-side from auth.uid() and exactly one '
  'active dealer membership. Server-owned canonical SHA-256 payload fingerprint; same-key/same-'
  'fingerprint replay returns the original ids without writes; same-key/different-fingerprint fails '
  'closed with IDEMPOTENCY_CONFLICT. Stable sanitized error codes only.';

-- ─── ROLLBACK (manual; never automatic) ──────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.register_legacy_customer(jsonb);
-- DROP TABLE IF EXISTS public.legacy_customer_registration_receipts;
-- DROP TABLE IF EXISTS public.vehicle_service_history;
-- DROP INDEX IF EXISTS public.vehicles_id_dealer_id_uidx;
-- DROP INDEX IF EXISTS public.customers_id_dealer_id_uidx;
