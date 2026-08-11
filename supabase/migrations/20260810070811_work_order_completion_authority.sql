-- ============================================================================
-- GDA-1W-C3 — WORK-ORDER COMPLETION AUTHORITY (accepted contract implementation)
-- C3-R1 repaired per PR #8 comments 5237890508 / 5237921470.
--
-- Implements docs/master_specification/GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md:
--   §4  completion_reports hardening, completion_report_items,
--       work_order_completion_requests
--   §5  public.complete_work_order_v1, the two-layer allocator (C2R ruling:
--       private.allocate_next_document_number_v1 core + preserved public
--       wrapper), public.update_completion_report_draft_v1
--   §6  created / replayed / conflict / recovery outcomes
--   §7  raw-write boundary, command-specific RLS, completed-state guard
--   §9  read-only FIVE-CLASS preflight (C3-R1) — duplicates/mismatches STOP
--       the migration; zero-report completed orders and snapshot-less legacy
--       reports are identified count-only as NOTICEs. Nothing is repaired,
--       rewritten, renumbered, archived, or deleted, and no row content is
--       exposed.
--
-- C3-R1-APP-AUTH-REACHABILITY (narrowed by C3-R2): §5.3 requires application
-- authorization to resolve the SAME actor/tenant pair as the database check.
-- The pre-existing SELECT policies made a valid active dealer_staff-only
-- actor invisible to the application (the work_orders and own-dealer_staff
-- pre-reads both required a dealer_members row), so that actor could never
-- REACH the RPC. This migration adds exactly TWO narrowly-scoped SELECT
-- policies (section 9b): self-row visibility on dealer_staff, and active
-- editing-staff visibility on work_orders for the staff member's own dealer.
-- Completion-report and snapshot-item SELECT stay §7.2-exact (active
-- same-dealer membership/owner context only). No write surface and no
-- other-tenant visibility is added anywhere.
--
-- C3-R1-SECURITY-SCHEMA-QUALIFICATION — the exact qualification boundary:
-- every CALLABLE built-in and extension function inside the SECURITY DEFINER
-- operations, the private helpers, and the trigger/guard functions is
-- schema-qualified (pg_catalog.* / public.* / private.* / auth.*).
-- COALESCE, NULLIF, CASE, IS [NOT] DISTINCT FROM, IN, EXISTS, ANY, and the
-- cast syntax are SQL GRAMMAR PRODUCTIONS resolved by the parser — they are
-- not pg_proc entries, cannot be schema-qualified, and perform no
-- search_path lookup. Operators (||, ~, =, <, >=, ->, ->>, ?) resolve
-- against pg_catalog under the pinned empty search_path; the noisy
-- OPERATOR(pg_catalog.||) form is deliberately not used. Fingerprint output
-- is byte-identical: qualification changes name resolution only.
--
-- STATUS: SOURCE CANDIDATE. Not applied anywhere. Disposable-database
--         verification, staging preflight/apply, and production work are
--         separately authorized phases.
--
-- The TypeScript mirror of the canonical fingerprint text lives in
-- src/lib/work-orders/work-order-completion-contract-core.ts; the shared
-- vectors are pinned in its test file. The DATABASE-computed fingerprint is
-- authoritative (§5.4).
--
-- No message, invoice, payment, maintenance, Storage, or external-service
-- mutation occurs anywhere in this migration (§3.5).
-- ============================================================================

BEGIN;

-- ─── 0. PREFLIGHT (§9): five identification classes, count-only ──────────────
-- Classes 1-3 (duplicates and tenant mismatches) STOP the migration: a unique
-- constraint cannot be applied over them and §9 forbids guessing a canonical
-- row. Classes 4-5 are identified as NOTICE counts: a completed order with
-- zero reports and a legacy report with no snapshot are expected legacy
-- states this migration must tolerate (legacy rows stay unconfirmed and not
-- work-report ready). No customer, vehicle, or report content is placed in
-- any message.
DO $preflight$
DECLARE
  v_dup_reports        integer;  -- class 1: >1 report per (dealer, work order)
  v_dup_numbers        integer;  -- class 2: duplicate non-null numbers per dealer
  v_mismatches         integer;  -- class 3: report/work-order dealer mismatch
  v_completed_zero     integer;  -- class 4: completed orders with zero reports
  v_completed_multi    integer;  -- class 4b: completed orders with >1 reports (subset of class 1 scope)
  v_snapshotless       integer;  -- class 5: reports with no performed-work snapshot
BEGIN
  SELECT pg_catalog.count(*) INTO v_dup_reports FROM (
    SELECT cr.dealer_id, cr.work_order_id
      FROM public.completion_reports cr
     GROUP BY cr.dealer_id, cr.work_order_id
    HAVING pg_catalog.count(*) > 1
  ) d;

  SELECT pg_catalog.count(*) INTO v_dup_numbers FROM (
    SELECT cr.dealer_id, cr.report_number
      FROM public.completion_reports cr
     WHERE cr.report_number IS NOT NULL
     GROUP BY cr.dealer_id, cr.report_number
    HAVING pg_catalog.count(*) > 1
  ) d;

  SELECT pg_catalog.count(*) INTO v_mismatches
    FROM public.completion_reports cr
    JOIN public.work_orders wo ON wo.id = cr.work_order_id
   WHERE wo.dealer_id IS DISTINCT FROM cr.dealer_id;

  SELECT pg_catalog.count(*) INTO v_completed_zero
    FROM public.work_orders wo
   WHERE wo.status = 'completed'
     AND wo.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.completion_reports cr
                      WHERE cr.work_order_id = wo.id);

  SELECT pg_catalog.count(*) INTO v_completed_multi
    FROM (
      SELECT cr.work_order_id
        FROM public.completion_reports cr
        JOIN public.work_orders wo ON wo.id = cr.work_order_id
       WHERE wo.status = 'completed'
       GROUP BY cr.work_order_id
      HAVING pg_catalog.count(*) > 1
    ) d;

  IF pg_catalog.to_regclass('public.completion_report_items') IS NULL THEN
    -- The snapshot table is created later in this migration (section 2), so
    -- before it exists every report is snapshot-less by definition.
    SELECT pg_catalog.count(*) INTO v_snapshotless
      FROM public.completion_reports;
  ELSE
    SELECT pg_catalog.count(*) INTO v_snapshotless
      FROM public.completion_reports cr
     WHERE NOT EXISTS (SELECT 1 FROM public.completion_report_items i
                        WHERE i.completion_report_id = cr.id);
  END IF;

  -- Identification classes 4-5: NOTICE counts only. These are legacy states
  -- the migration tolerates (fail-closed at runtime), not application blockers.
  RAISE NOTICE 'GDA1W preflight: % completed work order(s) with zero reports (legacy; not work-report ready)', v_completed_zero;
  RAISE NOTICE 'GDA1W preflight: % completed work order(s) with multiple reports', v_completed_multi;
  RAISE NOTICE 'GDA1W preflight: % report(s) with no performed-work snapshot (legacy; stay unconfirmed)', v_snapshotless;

  IF v_dup_reports > 0 OR v_dup_numbers > 0 OR v_mismatches > 0 OR v_completed_multi > 0 THEN
    RAISE EXCEPTION
      'MIGRATION_PREFLIGHT_FAILED: % duplicate work-order report pair(s), % duplicate report number group(s), % dealer mismatch(es), % completed order(s) with multiple reports. A separate data-recovery decision is required; this migration repairs nothing automatically.',
      v_dup_reports, v_dup_numbers, v_mismatches, v_completed_multi;
  END IF;
END;
$preflight$;

-- ─── 1. completion_reports hardening (§4.1) ──────────────────────────────────
-- Legacy rows receive NULL confirmation fields and are NOT work-report ready;
-- nothing here rewrites, renumbers, or archives existing data.

ALTER TABLE public.completion_reports
  ADD COLUMN IF NOT EXISTS performed_work_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS performed_work_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS performed_work_version      integer,
  ADD COLUMN IF NOT EXISTS performed_work_updated_at   timestamptz;

ALTER TABLE public.completion_reports
  ADD CONSTRAINT completion_reports_performed_work_version_check
    CHECK (performed_work_version IS NULL OR performed_work_version > 0);

-- One canonical report per (dealer, work order); one number per dealer.
CREATE UNIQUE INDEX completion_reports_dealer_work_order_uidx
  ON public.completion_reports (dealer_id, work_order_id);
CREATE UNIQUE INDEX completion_reports_dealer_report_number_uidx
  ON public.completion_reports (dealer_id, report_number)
  WHERE report_number IS NOT NULL;

-- Composite-FK targets: (id, dealer_id) must be addressable on both parents so
-- every child row carries a database-proven tenant binding (§4.1/§4.2/§4.3).
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_id_dealer_uidx UNIQUE (id, dealer_id);
ALTER TABLE public.completion_reports
  ADD CONSTRAINT completion_reports_id_dealer_uidx UNIQUE (id, dealer_id);

-- Replace the destructive CASCADE FK with a dealer-qualified RESTRICT FK. The
-- composite reference PROVES report.dealer_id = work_order.dealer_id in the
-- database, as §4.1 requires — source checks alone are insufficient.
ALTER TABLE public.completion_reports
  DROP CONSTRAINT IF EXISTS completion_reports_work_order_id_fkey;
ALTER TABLE public.completion_reports
  ADD CONSTRAINT completion_reports_work_order_dealer_fkey
    FOREIGN KEY (work_order_id, dealer_id)
    REFERENCES public.work_orders (id, dealer_id)
    ON DELETE RESTRICT;

-- ─── 2. completion_report_items (§4.2) ───────────────────────────────────────

CREATE TABLE public.completion_report_items (
  id                   uuid        PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  dealer_id            uuid        NOT NULL,
  completion_report_id uuid        NOT NULL,
  sort_order           integer     NOT NULL,
  category             text        NOT NULL,
  item_name            text        NOT NULL,
  description          text,
  created_at           timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at           timestamptz NOT NULL DEFAULT pg_catalog.now(),

  -- Tenant-coherent RESTRICT foreign key: an item can only reference a report
  -- in its own dealer.
  CONSTRAINT completion_report_items_report_dealer_fkey
    FOREIGN KEY (completion_report_id, dealer_id)
    REFERENCES public.completion_reports (id, dealer_id)
    ON DELETE RESTRICT,

  CONSTRAINT completion_report_items_sort_uidx
    UNIQUE (completion_report_id, sort_order),

  -- §3.2 row rules: trimmed text within the exact limits; array-derived order.
  CONSTRAINT completion_report_items_sort_order_check
    CHECK (sort_order >= 0),
  CONSTRAINT completion_report_items_category_check
    CHECK (category = pg_catalog.btrim(category)
           AND pg_catalog.char_length(category) BETWEEN 1 AND 100),
  CONSTRAINT completion_report_items_item_name_check
    CHECK (item_name = pg_catalog.btrim(item_name)
           AND pg_catalog.char_length(item_name) BETWEEN 1 AND 200),
  CONSTRAINT completion_report_items_description_check
    CHECK (description IS NULL
           OR (description = pg_catalog.btrim(description)
               AND pg_catalog.char_length(description) BETWEEN 1 AND 2000))
);

CREATE INDEX completion_report_items_dealer_idx
  ON public.completion_report_items (dealer_id);
CREATE INDEX completion_report_items_report_idx
  ON public.completion_report_items (completion_report_id);

CREATE TRIGGER trg_completion_report_items_updated_at
  BEFORE UPDATE ON public.completion_report_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. work_order_completion_requests (§4.3) ────────────────────────────────

CREATE TABLE public.work_order_completion_requests (
  id                   uuid        PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  dealer_id            uuid        NOT NULL,
  idempotency_key      text        NOT NULL,
  request_fingerprint  text        NOT NULL,
  work_order_id        uuid        NOT NULL,
  completion_report_id uuid        NOT NULL,
  actor_user_id        uuid        NOT NULL,
  outcome              text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT work_order_completion_requests_dealer_key_uidx
    UNIQUE (dealer_id, idempotency_key),

  CONSTRAINT work_order_completion_requests_work_order_dealer_fkey
    FOREIGN KEY (work_order_id, dealer_id)
    REFERENCES public.work_orders (id, dealer_id)
    ON DELETE RESTRICT,
  CONSTRAINT work_order_completion_requests_report_dealer_fkey
    FOREIGN KEY (completion_report_id, dealer_id)
    REFERENCES public.completion_reports (id, dealer_id)
    ON DELETE RESTRICT,

  CONSTRAINT work_order_completion_requests_key_check
    CHECK (idempotency_key = pg_catalog.btrim(idempotency_key)
           AND pg_catalog.char_length(idempotency_key) BETWEEN 16 AND 128),
  CONSTRAINT work_order_completion_requests_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT work_order_completion_requests_outcome_check
    CHECK (outcome IN ('created', 'replayed', 'recovered'))
);

CREATE INDEX work_order_completion_requests_work_order_idx
  ON public.work_order_completion_requests (work_order_id);
CREATE INDEX work_order_completion_requests_report_idx
  ON public.work_order_completion_requests (completion_report_id);

-- ─── 4. Authority-write guard triggers (defense in depth, §7.1) ──────────────
-- Grants below already deny every raw runtime write. These triggers guard the
-- tables even against a future mistaken grant: writes are permitted only while
-- the transaction-local completion-authority flag is set, and that flag is set
-- ONLY inside the two SECURITY DEFINER operations in this migration.

CREATE FUNCTION public.gda_completion_authority_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  -- COALESCE is a grammar construct (not a catalog function); see header.
  SELECT COALESCE(
           pg_catalog.current_setting('dealeros.completion_authority', true),
           '') <> '';
$$;

CREATE FUNCTION public.gda_completion_reports_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Report DELETE remains denied for everyone; archival is a separately
    -- authorized state change (§7.1).
    RAISE EXCEPTION 'COMPLETION_GUARD: completion reports may not be deleted';
  END IF;

  IF NOT public.gda_completion_authority_active() THEN
    RAISE EXCEPTION
      'COMPLETION_GUARD: completion reports are written only through the completion authority operations';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Tenant IDs and foreign bindings are immutable (§3.1/§7.2).
    IF NEW.id            IS DISTINCT FROM OLD.id
       OR NEW.dealer_id     IS DISTINCT FROM OLD.dealer_id
       OR NEW.work_order_id IS DISTINCT FROM OLD.work_order_id THEN
      RAISE EXCEPTION 'COMPLETION_GUARD: report binding is immutable';
    END IF;
    -- A report number is allocated once and never rebound.
    IF OLD.report_number IS NOT NULL
       AND NEW.report_number IS DISTINCT FROM OLD.report_number THEN
      RAISE EXCEPTION 'COMPLETION_GUARD: report number is immutable';
    END IF;
    -- Snapshot version is monotonic: NULL -> 1, or exactly +1, or unchanged.
    IF NEW.performed_work_version IS DISTINCT FROM OLD.performed_work_version
       AND NOT (
         (OLD.performed_work_version IS NULL AND NEW.performed_work_version = 1)
         OR NEW.performed_work_version = OLD.performed_work_version + 1
       ) THEN
      RAISE EXCEPTION 'COMPLETION_GUARD: snapshot version must increase monotonically';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_completion_reports_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.completion_reports
  FOR EACH ROW EXECUTE FUNCTION public.gda_completion_reports_guard();

CREATE FUNCTION public.gda_completion_report_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Snapshot rows exist only as the output of the authority operations; even a
  -- flagged DELETE is legitimate only as part of an atomic replacement.
  IF NOT public.gda_completion_authority_active() THEN
    RAISE EXCEPTION
      'COMPLETION_GUARD: snapshot items are written only through the completion authority operations';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_completion_report_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.completion_report_items
  FOR EACH ROW EXECUTE FUNCTION public.gda_completion_report_items_guard();

CREATE FUNCTION public.gda_completion_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Append-only ledger (§4.3): no UPDATE or DELETE, flagged or not.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'COMPLETION_GUARD: completion requests are append-only';
  END IF;
  IF NOT public.gda_completion_authority_active() THEN
    RAISE EXCEPTION
      'COMPLETION_GUARD: completion requests are written only through the completion authority operations';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_completion_requests_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.work_order_completion_requests
  FOR EACH ROW EXECUTE FUNCTION public.gda_completion_requests_guard();

-- Transition-scoped work-order guard (§7.1): raw changes entering or leaving
-- `completed`, and ANY raw change of actual_end_at, are rejected. Ordinary
-- non-completion edits (scheduled <-> in_progress <-> on_hold <-> cancelled,
-- titles, notes, soft delete, ...) are untouched. On a flagged transition INTO
-- `completed`, the database independently requires one canonical confirmed
-- report with 1-100 snapshot items.
CREATE FUNCTION public.gda_work_orders_completion_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_report_id  uuid;
  v_item_count integer;
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status
      AND (NEW.status = 'completed' OR OLD.status = 'completed'))
     OR NEW.actual_end_at IS DISTINCT FROM OLD.actual_end_at THEN
    IF NOT public.gda_completion_authority_active() THEN
      RAISE EXCEPTION
        'COMPLETION_GUARD: completion state and actual_end_at change only through the completion authority operations';
    END IF;
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT cr.id INTO v_report_id
      FROM public.completion_reports cr
     WHERE cr.dealer_id = NEW.dealer_id
       AND cr.work_order_id = NEW.id
       AND cr.performed_work_confirmed_at IS NOT NULL
       AND cr.performed_work_version IS NOT NULL
       AND cr.performed_work_version > 0;
    IF v_report_id IS NULL THEN
      RAISE EXCEPTION
        'COMPLETION_STATE_INCONSISTENT: completed requires one canonical confirmed report';
    END IF;
    SELECT pg_catalog.count(*) INTO v_item_count
      FROM public.completion_report_items i
     WHERE i.completion_report_id = v_report_id;
    IF v_item_count < 1 OR v_item_count > 100 THEN
      RAISE EXCEPTION
        'COMPLETION_STATE_INCONSISTENT: completed requires 1-100 confirmed snapshot items';
    END IF;
    IF NEW.actual_end_at IS NULL THEN
      RAISE EXCEPTION
        'COMPLETION_STATE_INCONSISTENT: completed requires a non-null actual_end_at';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_orders_completion_guard
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.gda_work_orders_completion_guard();

-- ─── 5. Two-layer allocator (§5.6, C2R ruling) ───────────────────────────────

CREATE SCHEMA IF NOT EXISTS private;
-- No runtime role may enter the schema at all; the Data API never exposes it.
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

-- The single atomic arbiter of the sequence row. SECURITY INVOKER: it runs
-- with the privileges of whichever SECURITY DEFINER wrapper reached it, and no
-- client role can reach it directly (schema USAGE and EXECUTE both denied).
-- Contains ONLY the existing INSERT ... ON CONFLICT atomic increment.
CREATE FUNCTION private.allocate_next_document_number_v1(
  p_dealer_id     uuid,
  p_sequence_type text,
  p_fiscal_year   integer,
  p_prefix        text,
  p_padding       integer,
  p_reset_policy  text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.document_sequences AS ds
    (dealer_id, sequence_type, fiscal_year, prefix, padding, reset_policy, current_number)
  VALUES
    (p_dealer_id, p_sequence_type, p_fiscal_year, p_prefix, p_padding, p_reset_policy, 1)
  ON CONFLICT (dealer_id, sequence_type, fiscal_year) DO UPDATE
    SET current_number = ds.current_number + 1,
        updated_at     = pg_catalog.now()
  RETURNING ds.current_number INTO v_next;

  RETURN v_next;
END;
$$;

-- The existing public allocator keeps its EXACT signature, defaults,
-- active-member-or-owner authorization, direct-caller behavior, and return
-- semantics — only the increment now delegates to the internal core.
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_dealer_id     uuid,
  p_sequence_type text,
  p_fiscal_year   integer,
  p_prefix        text DEFAULT '',
  p_padding       integer DEFAULT 5,
  p_reset_policy  text DEFAULT 'never'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Authorization preserved verbatim from migration 104: deny before any
  -- write, deterministic FORBIDDEN on failure.
  IF NOT EXISTS (
        SELECT 1 FROM public.dealer_members dm
         WHERE dm.dealer_id = p_dealer_id
           AND dm.user_id = auth.uid()
           AND dm.status = 'active'
      )
     AND NOT EXISTS (
        SELECT 1 FROM public.dealers d
         WHERE d.id = p_dealer_id
           AND d.owner_user_id = auth.uid()
      )
  THEN
    RAISE EXCEPTION 'FORBIDDEN: caller is not an active member or owner of the dealer';
  END IF;

  RETURN private.allocate_next_document_number_v1(
    p_dealer_id, p_sequence_type, p_fiscal_year, p_prefix, p_padding, p_reset_policy);
END;
$$;

-- ─── 6. Private validation + fingerprint helpers (§3.2, §5.4) ────────────────

-- Validate and normalize the performed-work snapshot: array of 1-100 objects
-- with EXACTLY the keys category / itemName / description; text trimmed to the
-- §3.2 limits; blank description -> null; sortOrder derived from array order.
-- Monetary or unknown keys are REJECTED, never ignored. Returns the normalized
-- jsonb array [{category, itemName, description, sortOrder}, ...] that is the
-- ONLY input to the fingerprint and to the item inserts.
CREATE FUNCTION private.normalize_performed_items_v1(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_elem     jsonb;
  v_ord      integer := 0;
  v_key      text;
  v_category text;
  v_name     text;
  v_desc     text;
  v_out      jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: performedItems must be an array';
  END IF;
  IF pg_catalog.jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: performedItems must contain at least 1 item';
  END IF;
  IF pg_catalog.jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: performedItems must contain at most 100 items';
  END IF;

  FOR v_elem IN SELECT e FROM pg_catalog.jsonb_array_elements(p_items) t(e) LOOP
    IF pg_catalog.jsonb_typeof(v_elem) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % must be an object', v_ord;
    END IF;

    -- Exact key set: any extra key (quantity, unitPrice, tax, ...) rejects.
    FOR v_key IN SELECT k FROM pg_catalog.jsonb_object_keys(v_elem) t(k) LOOP
      IF v_key NOT IN ('category', 'itemName', 'description') THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: performed item % has a forbidden key', v_ord;
      END IF;
    END LOOP;
    IF NOT (v_elem ? 'category' AND v_elem ? 'itemName' AND v_elem ? 'description') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % is missing a required key', v_ord;
    END IF;

    IF pg_catalog.jsonb_typeof(v_elem -> 'category') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % category must be a string', v_ord;
    END IF;
    v_category := pg_catalog.btrim(v_elem ->> 'category');
    IF pg_catalog.char_length(v_category) < 1 OR pg_catalog.char_length(v_category) > 100 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % category must be 1-100 characters', v_ord;
    END IF;

    IF pg_catalog.jsonb_typeof(v_elem -> 'itemName') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % itemName must be a string', v_ord;
    END IF;
    v_name := pg_catalog.btrim(v_elem ->> 'itemName');
    IF pg_catalog.char_length(v_name) < 1 OR pg_catalog.char_length(v_name) > 200 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % itemName must be 1-200 characters', v_ord;
    END IF;

    IF pg_catalog.jsonb_typeof(v_elem -> 'description') = 'null' THEN
      v_desc := NULL;
    ELSIF pg_catalog.jsonb_typeof(v_elem -> 'description') = 'string' THEN
      v_desc := pg_catalog.btrim(v_elem ->> 'description');
      IF pg_catalog.char_length(v_desc) > 2000 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: performed item % description exceeds 2000 characters', v_ord;
      END IF;
      IF v_desc = '' THEN
        v_desc := NULL;   -- trimmed-empty normalizes to null, mirroring the TS core
      END IF;
    ELSE
      RAISE EXCEPTION 'VALIDATION_ERROR: performed item % description must be a string or null', v_ord;
    END IF;

    v_out := v_out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'category',    v_category,
      'itemName',    v_name,
      'description', v_desc,
      'sortOrder',   v_ord));
    v_ord := v_ord + 1;
  END LOOP;

  RETURN v_out;
END;
$$;

-- Build the ONE canonical JSON text and hash it. The text is byte-identical to
-- the TypeScript core's JSON.stringify output: fixed key order, no whitespace,
-- explicit null description, millisecond UTC instant with a literal Z.
-- `pg_catalog.to_json(text)::text` matches JSON.stringify's string escaping
-- (", \, and control characters); jsonb and json_build_object are deliberately
-- NOT used — jsonb re-orders keys and json_build_object inserts spaces.
CREATE FUNCTION private.build_completion_fingerprint_canonical_v1(
  p_work_order_id    uuid,
  p_actual_end_at    timestamptz,
  p_normalized_items jsonb
)
RETURNS text
LANGUAGE sql
STABLE               -- timestamptz -> UTC text depends on the tz database
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT '{"contractVersion":1,"workOrderId":'
      || pg_catalog.to_json(p_work_order_id::text)::text
      || ',"actualEndAt":'
      || pg_catalog.to_json(pg_catalog.to_char(
           pg_catalog.date_trunc('milliseconds', p_actual_end_at) AT TIME ZONE 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text
      || ',"performedItems":['
      || COALESCE((
           SELECT pg_catalog.string_agg(
                    '{"category":'    || pg_catalog.to_json(e ->> 'category')::text
                 || ',"itemName":'    || pg_catalog.to_json(e ->> 'itemName')::text
                 || ',"description":' || CASE WHEN pg_catalog.jsonb_typeof(e -> 'description') = 'null'
                                              THEN 'null'
                                              ELSE pg_catalog.to_json(e ->> 'description')::text END
                 || ',"sortOrder":'   || (e ->> 'sortOrder')
                 || '}',
                    ',' ORDER BY ord)
             FROM pg_catalog.jsonb_array_elements(p_normalized_items) WITH ORDINALITY t(e, ord)), '')
      || ']}';
$$;

CREATE FUNCTION private.completion_fingerprint_v1(
  p_work_order_id    uuid,
  p_actual_end_at    timestamptz,
  p_normalized_items jsonb
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    private.build_completion_fingerprint_canonical_v1(
      p_work_order_id, p_actual_end_at, p_normalized_items), 'UTF8')), 'hex');
$$;

-- §5.3 actor authorization, shared by both public operations. Fail-closed:
--   * any dealer_staff row for the exact pair is AUTHORITATIVE — a disabled,
--     invited, unknown-role, readonly, or duplicate state denies and NEVER
--     falls back;
--   * only when NO staff row exists may one active dealer_members editing role
--     authorize;
--   * dealers.owner_user_id authorizes as 'owner' only when no staff row
--     exists (a readonly membership does not block the owner bootstrap);
--   * no relation to the dealer at all raises the same coarse NOT_FOUND the
--     missing/deleted/cross-dealer work-order paths use.
CREATE FUNCTION private.resolve_completion_actor_role_v1(
  p_dealer_id uuid,
  p_actor     uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_staff_count  integer;
  v_staff_status text;
  v_staff_role   text;
  v_member_count integer;
  v_member_role  text;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: authentication is required';
  END IF;

  SELECT pg_catalog.count(*) INTO v_staff_count
    FROM public.dealer_staff s
   WHERE s.dealer_id = p_dealer_id AND s.user_id = p_actor;

  IF v_staff_count > 1 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: staff state is ambiguous';
  END IF;

  IF v_staff_count = 1 THEN
    SELECT s.status, s.role INTO v_staff_status, v_staff_role
      FROM public.dealer_staff s
     WHERE s.dealer_id = p_dealer_id AND s.user_id = p_actor;
    IF v_staff_status IS DISTINCT FROM 'active'
       OR v_staff_role NOT IN ('owner', 'manager', 'staff') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: staff state does not permit completion';
    END IF;
    RETURN v_staff_role;
  END IF;

  -- No staff row: an active same-dealer membership may authorize.
  SELECT pg_catalog.count(*) INTO v_member_count
    FROM public.dealer_members m
   WHERE m.dealer_id = p_dealer_id AND m.user_id = p_actor AND m.status = 'active';
  IF v_member_count > 1 THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: membership state is ambiguous';
  END IF;
  IF v_member_count = 1 THEN
    SELECT m.role INTO v_member_role
      FROM public.dealer_members m
     WHERE m.dealer_id = p_dealer_id AND m.user_id = p_actor AND m.status = 'active';
    IF v_member_role IN ('owner', 'manager', 'staff') THEN
      RETURN v_member_role;
    END IF;
    -- A readonly/unknown active membership does not authorize, but it also does
    -- not block the owner bootstrap — only a dealer_staff row blocks.
  END IF;

  IF EXISTS (SELECT 1 FROM public.dealers d
              WHERE d.id = p_dealer_id AND d.owner_user_id = p_actor) THEN
    RETURN 'owner';
  END IF;

  IF v_member_count = 1 THEN
    -- The actor has a real relation to this dealer, just not an editing one.
    RAISE EXCEPTION 'PERMISSION_DENIED: role does not permit completion';
  END IF;

  -- No relation at all: coarse, existence-hiding outcome (§5.3 item 2).
  RAISE EXCEPTION 'NOT_FOUND: work order not found';
END;
$$;

-- ─── 7. public.complete_work_order_v1 (§5) ───────────────────────────────────
-- SECURITY DEFINER only because raw DML on the authority tables is denied and
-- the function must update them atomically. Identity from auth.uid() only; no
-- dynamic SQL; every callable reference schema-qualified; empty search_path.

CREATE FUNCTION public.complete_work_order_v1(
  p_work_order_id   uuid,
  p_idempotency_key text,
  p_actual_end_at   timestamptz,
  p_performed_items jsonb
)
RETURNS TABLE (
  work_order_id          uuid,
  completion_report_id   uuid,
  report_number          text,
  performed_work_version integer,
  request_fingerprint    text,
  outcome                text,
  created                boolean,
  replayed               boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor       uuid;
  v_key         text;
  v_wo          record;
  v_role        text;
  v_norm        jsonb;
  v_fp          text;
  v_report      record;
  v_request     record;
  v_alias       record;
  v_report_id   uuid;
  v_number      text;
  v_version     integer;
  v_seq_prefix  text;
  v_seq_padding integer;
  v_seq_policy  text;
  v_fiscal_year integer;
  v_next_number integer;
  v_elem        jsonb;
  v_constraint  text;
BEGIN
  -- ── 1. Identity and idempotency key normalization (§5.4).
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: authentication is required';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: idempotency key is required';
  END IF;
  v_key := pg_catalog.btrim(p_idempotency_key);
  IF pg_catalog.char_length(v_key) < 16 OR pg_catalog.char_length(v_key) > 128 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: idempotency key must be 16-128 characters';
  END IF;

  IF p_work_order_id IS NULL OR p_actual_end_at IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: work order id and actual end are required';
  END IF;

  -- ── 2. Lock the work order FIRST (§5.5 lock order, position 1). This lock
  --       serializes every completion attempt for the same work order.
  SELECT wo.id, wo.dealer_id, wo.status, wo.customer_id, wo.vehicle_id,
         wo.actual_start_at, wo.deleted_at
    INTO v_wo
    FROM public.work_orders wo
   WHERE wo.id = p_work_order_id
     FOR UPDATE;
  IF NOT FOUND OR v_wo.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: work order not found';
  END IF;

  -- ── 3. §5.3 authorization for the dealer that owns the work order. A caller
  --       with no relation to that dealer receives the same coarse NOT_FOUND.
  v_role := private.resolve_completion_actor_role_v1(v_wo.dealer_id, v_actor);

  -- ── 4. Validate the completion intent (§3.4).
  IF v_wo.customer_id IS NULL OR v_wo.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: completion requires a customer and a vehicle';
  END IF;
  IF p_actual_end_at > pg_catalog.now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: actual end must not be more than 5 minutes in the future';
  END IF;
  IF v_wo.actual_start_at IS NOT NULL AND p_actual_end_at < v_wo.actual_start_at THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: actual end must not be earlier than actual start';
  END IF;

  -- ── 5. Normalize and fingerprint the intent (§5.4). Database-computed and
  --       authoritative; matches the TypeScript shared vectors byte-for-byte.
  v_norm := private.normalize_performed_items_v1(p_performed_items);
  v_fp   := private.completion_fingerprint_v1(p_work_order_id, p_actual_end_at, v_norm);

  -- ── 6. Lock the canonical report, if any (§5.5 lock order, position 2).
  SELECT cr.id, cr.status, cr.report_number, cr.performed_work_version,
         cr.performed_work_confirmed_at
    INTO v_report
    FROM public.completion_reports cr
   WHERE cr.dealer_id = v_wo.dealer_id
     AND cr.work_order_id = p_work_order_id
     FOR UPDATE;

  -- ── 7. Resolve an existing same-key request (§5.5 position 3, §6).
  SELECT r.work_order_id, r.completion_report_id, r.request_fingerprint
    INTO v_request
    FROM public.work_order_completion_requests r
   WHERE r.dealer_id = v_wo.dealer_id
     AND r.idempotency_key = v_key;
  IF FOUND THEN
    IF v_request.work_order_id IS DISTINCT FROM p_work_order_id
       OR v_request.request_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: idempotency key was used for a different request';
    END IF;
    -- Exact replay: zero writes; the stable canonical result.
    RETURN QUERY
      SELECT p_work_order_id, cr.id, cr.report_number, cr.performed_work_version,
             v_fp, 'replayed'::text, false, true
        FROM public.completion_reports cr
       WHERE cr.id = v_request.completion_report_id;
    RETURN;
  END IF;

  -- ── 8. Resolve existing completed/canonical state (§6).
  IF v_wo.status = 'completed' THEN
    IF v_report.id IS NULL THEN
      RAISE EXCEPTION 'COMPLETION_STATE_INCONSISTENT: completed work order has no canonical report';
    END IF;
    IF EXISTS (SELECT 1 FROM public.work_order_completion_requests r
                WHERE r.dealer_id = v_wo.dealer_id
                  AND r.work_order_id = p_work_order_id
                  AND r.request_fingerprint = v_fp) THEN
      -- Different key, identical authoritative intent: record an immutable
      -- alias request pointing at the same report (§6 row 4).
      PERFORM pg_catalog.set_config('dealeros.completion_authority', 'complete_work_order_v1', true);
      INSERT INTO public.work_order_completion_requests
        (dealer_id, idempotency_key, request_fingerprint, work_order_id,
         completion_report_id, actor_user_id, outcome)
      VALUES
        (v_wo.dealer_id, v_key, v_fp, p_work_order_id, v_report.id, v_actor, 'replayed');
      RETURN QUERY
        SELECT p_work_order_id, v_report.id, v_report.report_number,
               v_report.performed_work_version, v_fp, 'replayed'::text, false, true;
      RETURN;
    END IF;
    IF v_report.performed_work_confirmed_at IS NULL THEN
      -- Completed legacy order with one unconfirmed report: NO silent
      -- conversion. The reviewed recovery branch (`outcome = recovered`)
      -- requires its own explicit confirmation flow and is not reachable
      -- through this four-argument signature (§6 row 9).
      RAISE EXCEPTION 'RECOVERY_REQUIRED: legacy completion requires explicit recovery confirmation';
    END IF;
    RAISE EXCEPTION 'ALREADY_COMPLETED_CONFLICT: work order is already completed with different content';
  END IF;

  IF v_wo.status NOT IN ('scheduled', 'in_progress', 'on_hold') THEN
    -- cancelled (or unknown legacy text): forbidden first transition (§3.4).
    RAISE EXCEPTION 'INVALID_STATE: work order status does not permit completion';
  END IF;

  -- A not-completed work order that already carries a shared/archived or
  -- confirmed report is inconsistent state, never silently rewritten.
  IF v_report.id IS NOT NULL
     AND (v_report.status NOT IN ('draft', 'generated')
          OR v_report.performed_work_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'COMPLETION_STATE_INCONSISTENT: existing report state requires a data-recovery decision';
  END IF;

  -- ── 9. Atomic create/repair block. The unique-violation handler exists ONLY
  --       for a concurrent DIFFERENT-work-order race on the same (dealer, key)
  --       arbiter: the work-order lock already serializes same-work-order
  --       callers. The subtransaction rolls every write (and the sequence
  --       advance) back before replay/conflict resolution.
  BEGIN
    PERFORM pg_catalog.set_config('dealeros.completion_authority', 'complete_work_order_v1', true);

    -- Report number (§5.6): allocate through the internal core only when the
    -- canonical report does not already hold a number. Deterministic stored
    -- configuration; contract defaults REP / 5 / never; no guessed fallback.
    IF v_report.id IS NOT NULL AND v_report.report_number IS NOT NULL THEN
      v_number := v_report.report_number;
    ELSE
      SELECT s.prefix, s.padding, s.reset_policy
        INTO v_seq_prefix, v_seq_padding, v_seq_policy
        FROM public.document_sequences s
       WHERE s.dealer_id = v_wo.dealer_id
         AND s.sequence_type = 'completion_report'
       ORDER BY s.updated_at DESC, s.created_at DESC, s.fiscal_year DESC, s.id DESC
       LIMIT 1;
      IF NOT FOUND THEN
        v_seq_prefix  := 'REP';
        v_seq_padding := 5;
        v_seq_policy  := 'never';
      END IF;

      v_fiscal_year := public.wiz_document_fiscal_year(v_seq_policy, pg_catalog.now());
      IF v_fiscal_year IS NULL THEN
        RAISE EXCEPTION 'REPORT_NUMBER_FAILED: numbering configuration is unusable';
      END IF;

      BEGIN
        -- §5.5 lock position 4: the sequence row, through the internal core —
        -- invoked only after §5.3 authorization, never via the public wrapper.
        v_next_number := private.allocate_next_document_number_v1(
          v_wo.dealer_id, 'completion_report', v_fiscal_year,
          v_seq_prefix, v_seq_padding, v_seq_policy);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'REPORT_NUMBER_FAILED: report number could not be allocated';
      END;

      v_number := public.wiz_format_document_number(
        v_seq_prefix, v_next_number, v_seq_padding, v_fiscal_year);
      IF v_number IS NULL OR pg_catalog.btrim(v_number) = '' THEN
        RAISE EXCEPTION 'REPORT_NUMBER_FAILED: report number could not be formatted';
      END IF;
    END IF;

    v_version := 1;

    IF v_report.id IS NULL THEN
      -- New canonical report: status draft; report date derived in the
      -- database from actual_end_at on the Asia/Tokyo calendar (§3.4).
      INSERT INTO public.completion_reports
        (dealer_id, work_order_id, report_number, status, report_date,
         performed_work_confirmed_at, performed_work_confirmed_by,
         performed_work_version, performed_work_updated_at)
      VALUES
        (v_wo.dealer_id, p_work_order_id, v_number, 'draft',
         (p_actual_end_at AT TIME ZONE 'Asia/Tokyo')::date,
         pg_catalog.now(), v_actor, v_version, pg_catalog.now())
      RETURNING public.completion_reports.id INTO v_report_id;
    ELSE
      -- Repair path: exactly one unconfirmed draft/generated legacy report on a
      -- not-yet-completed order becomes the canonical confirmed report. Its
      -- binding and any existing number are preserved; nothing is merged.
      v_report_id := v_report.id;
      UPDATE public.completion_reports cr
         SET report_number               = v_number,
             status                      = 'draft',
             report_date                 = (p_actual_end_at AT TIME ZONE 'Asia/Tokyo')::date,
             performed_work_confirmed_at = pg_catalog.now(),
             performed_work_confirmed_by = v_actor,
             performed_work_version      = v_version,
             performed_work_updated_at   = pg_catalog.now(),
             updated_at                  = pg_catalog.now()
       WHERE cr.id = v_report.id;
      DELETE FROM public.completion_report_items i
       WHERE i.completion_report_id = v_report.id;
    END IF;

    -- Confirmed snapshot rows, in array-derived order (§4.2).
    FOR v_elem IN SELECT e FROM pg_catalog.jsonb_array_elements(v_norm) t(e) LOOP
      INSERT INTO public.completion_report_items
        (dealer_id, completion_report_id, sort_order, category, item_name, description)
      VALUES
        (v_wo.dealer_id, v_report_id, (v_elem ->> 'sortOrder')::integer,
         v_elem ->> 'category', v_elem ->> 'itemName',
         CASE WHEN pg_catalog.jsonb_typeof(v_elem -> 'description') = 'null' THEN NULL
              ELSE v_elem ->> 'description' END);
    END LOOP;

    -- Immutable request ledger row (§4.3).
    INSERT INTO public.work_order_completion_requests
      (dealer_id, idempotency_key, request_fingerprint, work_order_id,
       completion_report_id, actor_user_id, outcome)
    VALUES
      (v_wo.dealer_id, v_key, v_fp, p_work_order_id, v_report_id, v_actor, 'created');

    -- Completion transition (§5.5 step 9); the work-order guard trigger
    -- independently re-proves the confirmed report and item count.
    UPDATE public.work_orders wo
       SET status        = 'completed',
           actual_end_at = p_actual_end_at,
           updated_at    = pg_catalog.now()
     WHERE wo.id = p_work_order_id;

  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IS DISTINCT FROM 'work_order_completion_requests_dealer_key_uidx' THEN
      -- Any other unique violation is an unrelated defect, not a replay.
      RAISE EXCEPTION 'COMPLETION_FAILED: work order completion could not be recorded';
    END IF;
    SELECT r.work_order_id, r.completion_report_id, r.request_fingerprint
      INTO v_alias
      FROM public.work_order_completion_requests r
     WHERE r.dealer_id = v_wo.dealer_id
       AND r.idempotency_key = v_key;
    IF NOT FOUND
       OR v_alias.work_order_id IS DISTINCT FROM p_work_order_id
       OR v_alias.request_fingerprint IS DISTINCT FROM v_fp THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: idempotency key was used for a different request';
    END IF;
    RETURN QUERY
      SELECT p_work_order_id, cr.id, cr.report_number, cr.performed_work_version,
             v_fp, 'replayed'::text, false, true
        FROM public.completion_reports cr
       WHERE cr.id = v_alias.completion_report_id;
    RETURN;
  END;

  -- ── 10. The stable result (§5.1).
  RETURN QUERY
    SELECT p_work_order_id, v_report_id, v_number, v_version, v_fp,
           'created'::text, true, false;
END;
$$;

-- ─── 8. public.update_completion_report_draft_v1 (§5.7) ──────────────────────

CREATE FUNCTION public.update_completion_report_draft_v1(
  p_completion_report_id            uuid,
  p_expected_performed_work_version integer,
  p_title                           text,
  p_customer_message                text,
  p_internal_memo                   text,
  p_performed_items                 jsonb
)
RETURNS TABLE (
  completion_report_id   uuid,
  performed_work_version integer,
  outcome                text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor     uuid;
  v_binding   record;
  v_report    record;
  v_role      text;
  v_norm      jsonb;
  v_elem      jsonb;
  v_new_ver   integer;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: authentication is required';
  END IF;
  IF p_completion_report_id IS NULL OR p_expected_performed_work_version IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: report id and expected version are required';
  END IF;

  -- Read the binding WITHOUT locking, then lock work order -> report in the
  -- same order complete_work_order_v1 uses, then revalidate the binding.
  SELECT cr.dealer_id, cr.work_order_id
    INTO v_binding
    FROM public.completion_reports cr
   WHERE cr.id = p_completion_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  PERFORM 1 FROM public.work_orders wo
    WHERE wo.id = v_binding.work_order_id
      FOR UPDATE;

  SELECT cr.id, cr.dealer_id, cr.work_order_id, cr.status,
         cr.performed_work_version, cr.performed_work_confirmed_at
    INTO v_report
    FROM public.completion_reports cr
   WHERE cr.id = p_completion_report_id
     FOR UPDATE;
  IF NOT FOUND
     OR v_report.dealer_id     IS DISTINCT FROM v_binding.dealer_id
     OR v_report.work_order_id IS DISTINCT FROM v_binding.work_order_id THEN
    RAISE EXCEPTION 'NOT_FOUND: completion report not found';
  END IF;

  v_role := private.resolve_completion_actor_role_v1(v_report.dealer_id, v_actor);

  -- Only a draft may be corrected; shared/archived snapshots are immutable.
  IF v_report.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'INVALID_STATE: only a draft report may be corrected';
  END IF;
  IF v_report.performed_work_confirmed_at IS NULL
     OR v_report.performed_work_version IS NULL THEN
    RAISE EXCEPTION 'INVALID_STATE: only a confirmed snapshot may be corrected';
  END IF;

  -- Optimistic concurrency: the loser returns STALE_VERSION with zero writes.
  IF v_report.performed_work_version IS DISTINCT FROM p_expected_performed_work_version THEN
    RETURN QUERY
      SELECT v_report.id, v_report.performed_work_version, 'STALE_VERSION'::text;
    RETURN;
  END IF;

  v_norm    := private.normalize_performed_items_v1(p_performed_items);
  v_new_ver := v_report.performed_work_version + 1;

  PERFORM pg_catalog.set_config('dealeros.completion_authority', 'update_completion_report_draft_v1', true);

  -- Updates ONLY title, customer message, internal memo, and the snapshot.
  -- Dealer, work order, number, date, status, sharing, PDF, maintenance, and
  -- financial fields are untouched (and guarded by trigger + grants).
  -- NULLIF/COALESCE are grammar constructs (see header); btrim is qualified.
  UPDATE public.completion_reports cr
     SET title                       = nullif(pg_catalog.btrim(COALESCE(p_title, '')), ''),
         customer_message            = nullif(pg_catalog.btrim(COALESCE(p_customer_message, '')), ''),
         internal_memo               = nullif(pg_catalog.btrim(COALESCE(p_internal_memo, '')), ''),
         performed_work_version      = v_new_ver,
         performed_work_confirmed_by = v_actor,
         performed_work_updated_at   = pg_catalog.now(),
         updated_at                  = pg_catalog.now()
   WHERE cr.id = v_report.id;

  -- Atomic replacement of all snapshot rows (§3.3).
  DELETE FROM public.completion_report_items i
   WHERE i.completion_report_id = v_report.id;
  FOR v_elem IN SELECT e FROM pg_catalog.jsonb_array_elements(v_norm) t(e) LOOP
    INSERT INTO public.completion_report_items
      (dealer_id, completion_report_id, sort_order, category, item_name, description)
    VALUES
      (v_report.dealer_id, v_report.id, (v_elem ->> 'sortOrder')::integer,
       v_elem ->> 'category', v_elem ->> 'itemName',
       CASE WHEN pg_catalog.jsonb_typeof(v_elem -> 'description') = 'null' THEN NULL
            ELSE v_elem ->> 'description' END);
  END LOOP;

  RETURN QUERY SELECT v_report.id, v_new_ver, 'updated'::text;
END;
$$;

-- ─── 9. RLS: command-specific policies (§7.2) ────────────────────────────────

-- Replace the legacy FOR ALL policy with SELECT-only, active-membership-scoped
-- access. No INSERT/UPDATE/DELETE policy exists: with the raw grants revoked
-- below, the only write path is the two SECURITY DEFINER operations.
DROP POLICY IF EXISTS "Dealer members can manage their completion reports"
  ON public.completion_reports;
CREATE POLICY completion_reports_active_member_select
  ON public.completion_reports
  FOR SELECT TO authenticated
  USING (
    dealer_id IN (SELECT dm.dealer_id FROM public.dealer_members dm
                   WHERE dm.user_id = auth.uid() AND dm.status = 'active')
    OR dealer_id IN (SELECT d.id FROM public.dealers d
                      WHERE d.owner_user_id = auth.uid())
  );

ALTER TABLE public.completion_report_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY completion_report_items_active_member_select
  ON public.completion_report_items
  FOR SELECT TO authenticated
  USING (
    dealer_id IN (SELECT dm.dealer_id FROM public.dealer_members dm
                   WHERE dm.user_id = auth.uid() AND dm.status = 'active')
    OR dealer_id IN (SELECT d.id FROM public.dealers d
                      WHERE d.owner_user_id = auth.uid())
  );

-- The request ledger has NO application SELECT and no write policies at all.
ALTER TABLE public.work_order_completion_requests ENABLE ROW LEVEL SECURITY;

-- ─── 9b. §5.3 actor reachability (C3-R1, narrowed by C3-R2) ──────────────────
-- Application authorization must resolve the SAME actor/tenant pair as the
-- database check (§5.3). The command path to complete_work_order_v1 pre-reads
-- exactly two things through caller RLS: the target work_orders row (to fix
-- the owning dealer) and the actor's OWN dealer_staff row (the primary
-- authorization source); the RPC then returns its canonical result directly.
-- A valid ACTIVE dealer_staff-only actor previously could perform neither
-- read, so the application could never reach the RPC for the very actor class
-- the contract authorizes. The TWO policies below are that exact read
-- surface and nothing more:
--   * self-row visibility on dealer_staff (own rows only — no other person's
--     staff state becomes visible);
--   * active editing-staff (owner/manager/staff, status='active') SELECT on
--     work_orders for the staff member's OWN dealer only.
-- Completion-report and snapshot-item SELECT remain governed EXACTLY by §7.2
-- (active same-dealer membership/owner context — the section 9 policies
-- above); no staff-based report/item visibility is added (C3-R2 ruling). No
-- write policy, no cross-tenant visibility, and no non-completion table is
-- touched; blocked (disabled/invited/readonly) staff gain nothing.

CREATE POLICY dealer_staff_self_select
  ON public.dealer_staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY work_orders_active_staff_select
  ON public.work_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.dealer_staff s
             WHERE s.dealer_id = work_orders.dealer_id
               AND s.user_id = auth.uid()
               AND s.status = 'active'
               AND s.role IN ('owner', 'manager', 'staff'))
  );

-- The dealer_staff SELECT grant may already exist from migration 104's
-- normalization; granting again is idempotent and RLS still constrains rows.
GRANT SELECT ON TABLE public.dealer_staff TO authenticated;

-- ─── 10. Grants: raw-write boundary (§7.1) ───────────────────────────────────

-- completion_reports: tenant-scoped SELECT only for authenticated runtime.
REVOKE ALL PRIVILEGES ON TABLE public.completion_reports
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.completion_reports TO authenticated;

-- completion_report_items: tenant-scoped SELECT only; no raw writes.
REVOKE ALL PRIVILEGES ON TABLE public.completion_report_items
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.completion_report_items TO authenticated;

-- work_order_completion_requests: no application access of any kind.
REVOKE ALL PRIVILEGES ON TABLE public.work_order_completion_requests
  FROM PUBLIC, anon, authenticated, service_role;

-- work_orders: table-wide UPDATE is replaced with reviewed column grants. No
-- runtime role holds raw UPDATE on actual_end_at; status stays grantable for
-- non-completion transitions, with the guard trigger rejecting raw changes
-- entering or leaving `completed`.
REVOKE UPDATE ON TABLE public.work_orders FROM PUBLIC, anon, authenticated, service_role;
GRANT UPDATE (estimate_id, customer_id, vehicle_id, work_order_number, status,
              title, scheduled_start_at, scheduled_end_at, actual_start_at,
              assigned_staff, service_summary, notes, internal_memo,
              deleted_at, updated_at)
  ON public.work_orders TO authenticated;
GRANT UPDATE (estimate_id, customer_id, vehicle_id, work_order_number, status,
              title, scheduled_start_at, scheduled_end_at, actual_start_at,
              assigned_staff, service_summary, notes, internal_memo,
              deleted_at, updated_at)
  ON public.work_orders TO service_role;

-- ─── 11. Function privileges: revoke, then exact regrant (§5.2, §5.6) ────────
-- Migration 104 proved the platform can restore PUBLIC EXECUTE on new
-- functions, so every function revokes explicitly in the same transaction —
-- no window in which PUBLIC holds EXECUTE.

-- Internal core: NO runtime role may execute it; only the two SECURITY DEFINER
-- wrappers (owner context) reach it.
REVOKE EXECUTE ON FUNCTION private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Private helpers: owner-context only (fingerprint helpers are additionally
-- the PostgreSQL side of the shared TS↔PG test vectors, run as the test owner).
REVOKE EXECUTE ON FUNCTION private.normalize_performed_items_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.build_completion_fingerprint_canonical_v1(uuid, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.completion_fingerprint_v1(uuid, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.resolve_completion_actor_role_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Trigger-only functions receive no runtime EXECUTE grant.
REVOKE EXECUTE ON FUNCTION public.gda_completion_authority_active()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.gda_completion_reports_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.gda_completion_report_items_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.gda_completion_requests_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.gda_work_orders_completion_guard()
  FROM PUBLIC, anon, authenticated, service_role;

-- Public operations: revoke, then regrant ONLY to authenticated (§5.2).
REVOKE EXECUTE ON FUNCTION public.complete_work_order_v1(uuid, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_work_order_v1(uuid, text, timestamptz, jsonb)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_completion_report_draft_v1(uuid, integer, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_completion_report_draft_v1(uuid, integer, text, text, text, jsonb)
  TO authenticated;

-- Public allocator wrapper: exact pre-existing grant shape preserved
-- (authenticated-only, per migration 104).
REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text, integer, text, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text, integer, text, integer, text)
  TO authenticated;

-- ─── 12. Comments ────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.complete_work_order_v1(uuid, text, timestamptz, jsonb) IS
  'GDA-1W atomic work-order completion (accepted contract §5). One deliberate '
  'completion action: validates the §5.3 actor, normalizes and fingerprints the '
  'monetary-free performed-work snapshot, creates/repairs exactly one canonical '
  'completion report, allocates the report number through the internal sequence '
  'core, records the immutable idempotency request, and sets the work order '
  'completed — all in one transaction with deterministic lock order. Replays are '
  'zero-write and stable. No message, invoice, payment, maintenance, Storage, or '
  'external side effect.';
COMMENT ON FUNCTION public.update_completion_report_draft_v1(uuid, integer, text, text, text, jsonb) IS
  'GDA-1W draft correction (accepted contract §5.7). Version-checked, atomic '
  'replacement of the non-monetary snapshot plus title/customer message/internal '
  'memo on a draft report only. Returns STALE_VERSION with zero writes when '
  'another correction won first.';
COMMENT ON FUNCTION private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text) IS
  'GDA-1W two-layer allocator core (C2R ruling, §5.6): the single atomic arbiter '
  'of the document_sequences row. SECURITY INVOKER; reachable only through the '
  'SECURITY DEFINER wrappers; no runtime role holds schema USAGE or EXECUTE.';
COMMENT ON FUNCTION public.get_next_document_number(uuid, text, integer, text, integer, text) IS
  'Per-dealer atomic document numbering. Signature, active-member-or-owner '
  'authorization, return semantics, and authenticated-only EXECUTE preserved '
  'exactly; the increment is delegated to private.allocate_next_document_number_v1.';
COMMENT ON TABLE public.completion_report_items IS
  'Authoritative monetary-free performed-work snapshot rows (GDA-1W §4.2). '
  'Written only by the completion authority operations; runtime reads only.';
COMMENT ON TABLE public.work_order_completion_requests IS
  'Immutable completion request ledger (GDA-1W §4.3): idempotency arbiter and '
  'audit evidence. Append-only; no application read or write grants.';

COMMIT;

-- ─── ROLLBACK (manual; NOT executed here) ────────────────────────────────────
-- Reverting removes the completion authority and reinstates the raw-write
-- surface. In order:
--   DROP FUNCTION public.update_completion_report_draft_v1(uuid, integer, text, text, text, jsonb);
--   DROP FUNCTION public.complete_work_order_v1(uuid, text, timestamptz, jsonb);
--   restore public.get_next_document_number from migration 104 (self-contained upsert);
--   DROP FUNCTION private.resolve_completion_actor_role_v1(uuid, uuid);
--   DROP FUNCTION private.completion_fingerprint_v1(uuid, timestamptz, jsonb);
--   DROP FUNCTION private.build_completion_fingerprint_canonical_v1(uuid, timestamptz, jsonb);
--   DROP FUNCTION private.normalize_performed_items_v1(jsonb);
--   DROP FUNCTION private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text);
--   DROP SCHEMA private;  -- only if empty
--   DROP POLICY work_orders_active_staff_select ON public.work_orders;
--   DROP POLICY dealer_staff_self_select ON public.dealer_staff;
--   DROP TRIGGER trg_work_orders_completion_guard ON public.work_orders;
--   DROP TRIGGER trg_completion_requests_guard ON public.work_order_completion_requests;
--   DROP TRIGGER trg_completion_report_items_guard ON public.completion_report_items;
--   DROP TRIGGER trg_completion_reports_guard ON public.completion_reports;
--   DROP FUNCTION public.gda_work_orders_completion_guard();
--   DROP FUNCTION public.gda_completion_requests_guard();
--   DROP FUNCTION public.gda_completion_report_items_guard();
--   DROP FUNCTION public.gda_completion_reports_guard();
--   DROP FUNCTION public.gda_completion_authority_active();
--   DROP TABLE public.work_order_completion_requests;
--   DROP TABLE public.completion_report_items;
--   ALTER TABLE public.completion_reports
--     DROP CONSTRAINT completion_reports_work_order_dealer_fkey,
--     DROP CONSTRAINT completion_reports_id_dealer_uidx,
--     DROP CONSTRAINT completion_reports_performed_work_version_check,
--     DROP COLUMN performed_work_updated_at,
--     DROP COLUMN performed_work_version,
--     DROP COLUMN performed_work_confirmed_by,
--     DROP COLUMN performed_work_confirmed_at;
--   DROP INDEX completion_reports_dealer_report_number_uidx;
--   DROP INDEX completion_reports_dealer_work_order_uidx;
--   ALTER TABLE public.work_orders DROP CONSTRAINT work_orders_id_dealer_uidx;
--   re-create the 040 CASCADE FK, the 040 FOR ALL policy, and the 104
--   table-wide grants only if the pre-migration behavior must be restored.
