-- ============================================================================
-- 106_dealer_wizard_catalog.sql — Dealer-owned Wizard catalog foundation (M106-B1)
--
-- NON-ACTIVATING, FAIL-CLOSED. Reuses the 103 catalog schema. Adds:
--   • wizard_catalog_items.duration_minutes (typed, nullable, menu-kinds only);
--   • dealer_wizard_catalog_lifecycle (configuration lifecycle / review storage);
--   • a safe backfill of ONLY maintenance_menu + wash_menu dealer rows from the
--     canonical dealer_settings JSON.
--
-- It does NOT: backfill Room Cleaning / coupons / film types / other-work presets /
-- store options; modify dealer_settings; grant any authenticated write or new
-- EXECUTE; grant authenticated SELECT on the lifecycle table; create a resolver,
-- route, UI, save path, or mount; or activate the catalog runtime. Every dealer is
-- left MIGRATED_UNREVIEWED. Legacy dealer_settings JSON is preserved unchanged.
--
-- The whole migration is one transaction: any validation failure rolls back ALL
-- schema and data changes together. No partial dealer migration is possible.
--
-- Architect ratifications (M106-B1): maintenance ids are the EXPLICIT whitelist
-- A→maint-a … E→maint-e (original preserved in presentation.legacyId); any other
-- maintenance id, malformed record, duplicate, or identity/payload collision aborts.
-- ============================================================================

BEGIN;

-- ── Section A: duration column on the existing 103 catalog table ─────────────
ALTER TABLE public.wizard_catalog_items
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE public.wizard_catalog_items
  ADD CONSTRAINT wci_duration_positive
  CHECK (duration_minutes IS NULL OR duration_minutes > 0);

-- Non-NULL duration is meaningful only for the three menu kinds (103 literals).
ALTER TABLE public.wizard_catalog_items
  ADD CONSTRAINT wci_duration_kind
  CHECK (
    duration_minutes IS NULL
    OR kind IN ('maintenance_menu', 'wash_menu', 'room_cleaning_menu')
  );

-- ── Section B: configuration lifecycle / review storage ──────────────────────
CREATE TABLE IF NOT EXISTS public.dealer_wizard_catalog_lifecycle (
  dealer_id                       uuid        PRIMARY KEY REFERENCES public.dealers(id) ON DELETE RESTRICT,
  state                           text        NOT NULL DEFAULT 'MIGRATED_UNREVIEWED',
  current_configuration_revision  bigint      NOT NULL DEFAULT 0,
  reviewed_configuration_revision bigint,
  reviewed_at                     timestamptz,
  reviewed_by                     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT dwcl_state_check CHECK (state IN ('LEGACY','MIGRATED_UNREVIEWED','CATALOG_REVIEWED','CATALOG_ACTIVE')),
  CONSTRAINT dwcl_current_rev_nonneg CHECK (current_configuration_revision >= 0),
  -- reviewed revision is null or within [0, current]
  CONSTRAINT dwcl_reviewed_rev_range CHECK (
    reviewed_configuration_revision IS NULL
    OR (reviewed_configuration_revision >= 0
        AND reviewed_configuration_revision <= current_configuration_revision)
  ),
  -- pre-review states carry no review fields
  CONSTRAINT dwcl_unreviewed_null CHECK (
    state NOT IN ('LEGACY','MIGRATED_UNREVIEWED')
    OR (reviewed_configuration_revision IS NULL AND reviewed_at IS NULL AND reviewed_by IS NULL)
  ),
  -- reviewed/active require revision EQUALITY + a timestamp; reviewed_by may be NULL
  -- (auth-user deletion) without invalidating equality.
  CONSTRAINT dwcl_reviewed_coherent CHECK (
    state NOT IN ('CATALOG_REVIEWED','CATALOG_ACTIVE')
    OR (reviewed_configuration_revision IS NOT NULL
        AND reviewed_configuration_revision = current_configuration_revision
        AND reviewed_at IS NOT NULL)
  )
);

-- Reuse the established shared updated_at trigger (000_shared_functions.sql).
DROP TRIGGER IF EXISTS trg_dwcl_updated_at ON public.dealer_wizard_catalog_lifecycle;
CREATE TRIGGER trg_dwcl_updated_at
  BEFORE UPDATE ON public.dealer_wizard_catalog_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Section C: lifecycle RLS + least-privilege (no runtime consumer yet) ──────
ALTER TABLE public.dealer_wizard_catalog_lifecycle ENABLE ROW LEVEL SECURITY;

-- Dealer-scoped SELECT policy exists (consistent with 103), but NO grant is issued:
-- the future resolver phase adds the minimum authenticated SELECT grant with tests.
DROP POLICY IF EXISTS dwcl_select ON public.dealer_wizard_catalog_lifecycle;
CREATE POLICY dwcl_select ON public.dealer_wizard_catalog_lifecycle
  FOR SELECT TO authenticated USING (public.wiz_is_active_member(dealer_id));

REVOKE ALL PRIVILEGES ON TABLE public.dealer_wizard_catalog_lifecycle FROM PUBLIC, anon, authenticated;
-- service_role: exact DML per the 104 model (no TRUNCATE/REFERENCES/TRIGGER/MAINTAIN).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_wizard_catalog_lifecycle TO service_role;

-- ── Section D: validate-all-first backfill + lifecycle init (fail-closed) ─────
DO $$
DECLARE
  v_bad_dealer_mode  integer;
  v_bad_maint_id     integer;
  v_bad_wash_code    integer;
  v_bad_name         integer;
  v_bad_price        integer;
  v_dup_legacy       integer;
  v_dup_code         integer;
  v_conflict_item    integer;
  v_conflict_child   integer;
  v_conflict_life    integer;
BEGIN
  -- ---- 1. Collect candidates (gyeon dealers only), computing the stable code ----
  CREATE TEMP TABLE tmp_wc_cand ON COMMIT DROP AS
  SELECT
    ds.dealer_id                                        AS dealer_id,
    'maintenance_menu'::text                            AS kind,
    'maintenance'::text                                 AS category_id,
    (elem->>'id')                                       AS legacy_id,
    CASE (elem->>'id')
      WHEN 'A' THEN 'maint-a' WHEN 'B' THEN 'maint-b' WHEN 'C' THEN 'maint-c'
      WHEN 'D' THEN 'maint-d' WHEN 'E' THEN 'maint-e' ELSE NULL END AS code,
    (elem->>'name')                                     AS name_ja,
    (elem->>'price')                                    AS price_text,
    (ord - 1)::int                                      AS display_order,
    jsonb_build_object('legacyId', (elem->>'id'))       AS presentation
  FROM public.dealer_settings ds
  JOIN public.dealers d ON d.id = ds.dealer_id AND d.product_mode = 'gyeon'
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(ds.service_price_settings->'maintenance'->'menus', '[]'::jsonb)
  ) WITH ORDINALITY AS t(elem, ord)
  UNION ALL
  SELECT
    ds.dealer_id, 'wash_menu'::text, 'carwash'::text,
    (elem->>'id') AS legacy_id, (elem->>'id') AS code,
    (elem->>'name'), (elem->>'price'), (ord - 1)::int,
    '{}'::jsonb
  FROM public.dealer_settings ds
  JOIN public.dealers d ON d.id = ds.dealer_id AND d.product_mode = 'gyeon'
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(ds.service_price_settings->'carwash'->'menus', '[]'::jsonb)
  ) WITH ORDINALITY AS t(elem, ord);

  -- ---- 2. Validate EVERY candidate (abort the whole transaction on any failure) ----

  -- 2a. A non-gyeon dealer carrying menus cannot be safely backfilled to the gyeon catalog.
  SELECT count(*) INTO v_bad_dealer_mode
  FROM public.dealer_settings ds
  JOIN public.dealers d ON d.id = ds.dealer_id
  WHERE d.product_mode <> 'gyeon'
    AND (jsonb_array_length(COALESCE(ds.service_price_settings->'maintenance'->'menus','[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(ds.service_price_settings->'carwash'->'menus','[]'::jsonb)) > 0);
  IF v_bad_dealer_mode > 0 THEN
    RAISE EXCEPTION '106 backfill: % non-gyeon dealer(s) carry maintenance/wash menus; cannot backfill to gyeon catalog', v_bad_dealer_mode;
  END IF;

  -- 2b. Maintenance ids must be exactly A–E (whitelist ⇒ code is non-NULL).
  SELECT count(*) INTO v_bad_maint_id FROM tmp_wc_cand WHERE kind = 'maintenance_menu' AND code IS NULL;
  IF v_bad_maint_id > 0 THEN
    RAISE EXCEPTION '106 backfill: % maintenance menu id(s) outside the ratified A–E whitelist', v_bad_maint_id;
  END IF;

  -- 2c. Wash codes must already satisfy the 103 code CHECK (no normalization).
  SELECT count(*) INTO v_bad_wash_code FROM tmp_wc_cand
   WHERE kind = 'wash_menu' AND (code IS NULL OR code !~ '^[a-z0-9][a-z0-9_-]{0,63}$');
  IF v_bad_wash_code > 0 THEN
    RAISE EXCEPTION '106 backfill: % wash menu code(s) violate the catalog code format', v_bad_wash_code;
  END IF;

  -- 2d. Names must be non-empty after trim.
  SELECT count(*) INTO v_bad_name FROM tmp_wc_cand WHERE name_ja IS NULL OR btrim(name_ja) = '';
  IF v_bad_name > 0 THEN
    RAISE EXCEPTION '106 backfill: % menu(s) have an empty name', v_bad_name;
  END IF;

  -- 2e. Prices must be tax-exclusive NON-NEGATIVE INTEGERS (string form matches ^[0-9]+$).
  SELECT count(*) INTO v_bad_price FROM tmp_wc_cand WHERE price_text IS NULL OR price_text !~ '^[0-9]+$';
  IF v_bad_price > 0 THEN
    RAISE EXCEPTION '106 backfill: % menu(s) have a non-integer or negative price', v_bad_price;
  END IF;

  -- 2f. No duplicate legacy id per dealer+kind.
  SELECT count(*) INTO v_dup_legacy FROM (
    SELECT 1 FROM tmp_wc_cand GROUP BY dealer_id, kind, legacy_id HAVING count(*) > 1
  ) q;
  IF v_dup_legacy > 0 THEN
    RAISE EXCEPTION '106 backfill: duplicate legacy menu id within a dealer (% group(s))', v_dup_legacy;
  END IF;

  -- 2g. No two source rows mapping to the same code per dealer+kind.
  SELECT count(*) INTO v_dup_code FROM (
    SELECT 1 FROM tmp_wc_cand GROUP BY dealer_id, kind, code HAVING count(*) > 1
  ) q;
  IF v_dup_code > 0 THEN
    RAISE EXCEPTION '106 backfill: two source rows target the same catalog code within a dealer (% group(s))', v_dup_code;
  END IF;

  -- ---- 3. Conflict resolution against existing rows (identity: market,mode,kind,code,dealer) ----
  -- Any existing row that is NOT an exact verified replay match aborts. (Global rows are never
  -- touched; their dealer_id is NULL so they cannot share a dealer row's identity.)
  SELECT count(*) INTO v_conflict_item
  FROM tmp_wc_cand c
  JOIN public.wizard_catalog_items i
    ON i.market = 'jp' AND i.product_mode = 'gyeon' AND i.kind = c.kind
   AND i.code = c.code AND i.dealer_id = c.dealer_id
  WHERE NOT (
        i.owner_scope = 'dealer'
    AND i.label_owner = 'wizard_catalog' AND i.price_owner = 'wizard_catalog'
    AND i.pricing_ref IS NULL
    AND i.label_ja = c.name_ja
    AND i.default_unit_price = c.price_text::int
    AND i.editable_unit_price = false
    AND i.priceable = true
    AND i.duration_minutes IS NULL
    AND i.is_active = true
    AND i.deleted_at IS NULL
    AND i.presentation = c.presentation
  );
  IF v_conflict_item > 0 THEN
    RAISE EXCEPTION '106 backfill: % existing dealer catalog row(s) conflict with legacy data', v_conflict_item;
  END IF;

  -- ---- 4. Insert catalog rows that do not already exist (identical ⇒ verified no-op) ----
  INSERT INTO public.wizard_catalog_items (
    market, product_mode, kind, owner_scope, dealer_id, code,
    label_owner, price_owner, pricing_ref, label_ja, label_en, description,
    display_order, is_active, default_unit_price, editable_unit_price, priceable,
    duration_minutes, deleted_at, presentation
  )
  SELECT
    'jp', 'gyeon', c.kind, 'dealer', c.dealer_id, c.code,
    'wizard_catalog', 'wizard_catalog', NULL, c.name_ja, NULL, NULL,
    c.display_order, true, c.price_text::int, false, true,
    NULL, NULL, c.presentation
  FROM tmp_wc_cand c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.market='jp' AND i.product_mode='gyeon' AND i.kind=c.kind
       AND i.code=c.code AND i.dealer_id=c.dealer_id
  );

  -- ---- 5. Child ranks (all four permitted ranks) — insert missing; extraneous aborts ----
  INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
  SELECT i.id, r.rank
  FROM tmp_wc_cand c
  JOIN public.wizard_catalog_items i
    ON i.market='jp' AND i.product_mode='gyeon' AND i.kind=c.kind AND i.code=c.code AND i.dealer_id=c.dealer_id
  CROSS JOIN (VALUES ('shop'),('detailer'),('ppf_installer'),('certified')) AS r(rank)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.wizard_catalog_item_ranks x WHERE x.catalog_item_id=i.id AND x.rank=r.rank
  );

  SELECT count(*) INTO v_conflict_child
  FROM tmp_wc_cand c
  JOIN public.wizard_catalog_items i
    ON i.market='jp' AND i.product_mode='gyeon' AND i.kind=c.kind AND i.code=c.code AND i.dealer_id=c.dealer_id
  JOIN public.wizard_catalog_item_ranks x ON x.catalog_item_id=i.id
  WHERE x.rank NOT IN ('shop','detailer','ppf_installer','certified');
  IF v_conflict_child > 0 THEN
    RAISE EXCEPTION '106 backfill: % extraneous rank row(s) on a backfilled item', v_conflict_child;
  END IF;

  -- ---- 6. Child category (exactly the kind's canonical category) — insert missing; extraneous aborts ----
  INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
  SELECT i.id, c.category_id
  FROM tmp_wc_cand c
  JOIN public.wizard_catalog_items i
    ON i.market='jp' AND i.product_mode='gyeon' AND i.kind=c.kind AND i.code=c.code AND i.dealer_id=c.dealer_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.wizard_catalog_item_categories y WHERE y.catalog_item_id=i.id AND y.category_id=c.category_id
  );

  SELECT count(*) INTO v_conflict_child
  FROM tmp_wc_cand c
  JOIN public.wizard_catalog_items i
    ON i.market='jp' AND i.product_mode='gyeon' AND i.kind=c.kind AND i.code=c.code AND i.dealer_id=c.dealer_id
  JOIN public.wizard_catalog_item_categories y ON y.catalog_item_id=i.id
  WHERE y.category_id <> c.category_id;
  IF v_conflict_child > 0 THEN
    RAISE EXCEPTION '106 backfill: % extraneous category row(s) on a backfilled item', v_conflict_child;
  END IF;

  -- ---- 7. Lifecycle init: exactly one MIGRATED_UNREVIEWED row per dealer ----
  -- Any pre-existing lifecycle row with a non-default payload aborts (never overwrite a review).
  SELECT count(*) INTO v_conflict_life
  FROM public.dealer_wizard_catalog_lifecycle l
  WHERE NOT (
        l.state = 'MIGRATED_UNREVIEWED'
    AND l.current_configuration_revision = 0
    AND l.reviewed_configuration_revision IS NULL
    AND l.reviewed_at IS NULL AND l.reviewed_by IS NULL
  );
  IF v_conflict_life > 0 THEN
    RAISE EXCEPTION '106 lifecycle: % existing row(s) with an incompatible state', v_conflict_life;
  END IF;

  INSERT INTO public.dealer_wizard_catalog_lifecycle (dealer_id)
  SELECT d.id FROM public.dealers d
  WHERE NOT EXISTS (SELECT 1 FROM public.dealer_wizard_catalog_lifecycle l WHERE l.dealer_id = d.id);
END $$;

COMMIT;
