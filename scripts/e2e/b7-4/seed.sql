-- B7-4 disposable tenant seed. Transaction-safe; one external psql variable only:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v vuser="<disposable-auth-uuid>" -f seed.sql
--
-- Creates ONE actor tenant (fully wired for a real wizard save) plus ONE foreign
-- sentinel tenant (no membership/staff link to the verification user), so tenant
-- isolation can be proven. Deterministic UUIDs are literal; `vuser` is stored in a
-- context table and read inside PL/pgSQL (never a psql variable inside $$).
--
-- ── R84B-F7B / F8B: dealer-owned bootstrap catalog (film_type + maintenance) ─
-- The actor dealer owns exactly TWO catalog items, written as ONE atomic
-- bootstrap snapshot:
--
--   • film_type       — without it the authoritative runtime resolver fails closed
--                       with `window-film-no-film-types` (rank detailer can sell
--                       window film and the 7 global window_area rows exist, but
--                       zero dealer film types are configured), so /estimates/new
--                       never mounts at all.
--   • maintenance_menu — without it the wizard mounts but the contracted UI
--                       scenario is unreachable: verify.md requires the manual line
--                       `manual:maintenance:maint-a`, whose identity can only come
--                       from a dealer-owned maintenance menu whose `code` is
--                       `maint-a`. There is no free-form maintenance identity.
--
-- Mechanism: DIRECT fixture INSERT. `wiz_upsert_catalog_item` is unusable here —
-- setup.sh runs this file through psql over a direct libpq connection, so
-- auth.uid() is NULL and the RPC raises WIZ_UNAUTHENTICATED. Forging claims or
-- roles is forbidden, so the item/rank/category rows are written directly. After
-- both fixtures are complete, the actor's explicit maintenance offering is inserted;
-- the dealer-service-offerings migration §7 trigger invokes the authoritative invalidation point
-- `wiz_bump_dealer_revision` exactly ONCE. Dealer-scope catalog INSERTs themselves
-- trigger no automatic bump (108 §5 acts only on global rows; the child tables carry
-- no bump trigger).
--
-- ORDERING IS CONTRACTUAL: the catalog fixtures and offering-trigger bump land BEFORE the
-- lifecycle is activated, so the reviewed revision provably covers both the catalog
-- and the offering it certifies. Activating first would be invalidated by the offering
-- trigger, which is precisely why the ordering, not a later repair, is the guard.
--
-- All catalog INSERTs are plain: no ON CONFLICT, no upsert, no DO NOTHING, so a
-- duplicate identity raises rather than silently degrading to a no-op. The
-- deferred whole-item validator (103 §8d) runs at COMMIT and is never bypassed.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE b7_seed_context ( vuser uuid NOT NULL ) ON COMMIT DROP;
INSERT INTO b7_seed_context(vuser) VALUES (:'vuser'::uuid);

-- ── Actor tenant ────────────────────────────────────────────────────────────
INSERT INTO public.dealers (id, name, detailer_rank, owner_user_id)
  VALUES ('b7400000-0000-4000-8000-0000000000d1', 'B7-4 Actor Dealer', 'detailer', :'vuser');

INSERT INTO public.dealer_settings (dealer_id)
  VALUES ('b7400000-0000-4000-8000-0000000000d1');

INSERT INTO public.dealer_members (dealer_id, user_id, role, status)
  VALUES ('b7400000-0000-4000-8000-0000000000d1', :'vuser', 'owner', 'active');

INSERT INTO public.dealer_staff (dealer_id, user_id, role, status)
  VALUES ('b7400000-0000-4000-8000-0000000000d1', :'vuser', 'owner', 'active');

-- ── Precondition: untouched initial actor lifecycle (revision 0) ────────────
-- Migration 108 auto-provisions the lifecycle row when the dealer is inserted.
-- Require that exact untouched initial row and fail closed if it is absent or has
-- already diverged from the migration-defined initial state. This is now a PROOF
-- only: activation happens later, after the film fixture and its revision bump.
DO $b7_seed_lifecycle_init$
BEGIN
  IF (SELECT count(*) FROM public.dealer_wizard_catalog_lifecycle
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND state = 'MIGRATED_UNREVIEWED'
          AND current_configuration_revision = 0
          AND reviewed_configuration_revision IS NULL
          AND reviewed_at IS NULL
          AND reviewed_by IS NULL
          AND last_reviewed_configuration_revision IS NULL
          AND last_reviewed_at IS NULL
          AND last_reviewed_by IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:lifecycle-init';
  END IF;
END
$b7_seed_lifecycle_init$;

-- ── Preconditions: the central policy the film fixture depends on ───────────
-- Without these the fixture would fail as a raw foreign-key or trigger error
-- instead of a typed, named seed failure.
DO $b7_seed_film_precond$
BEGIN
  -- Exactly one (gyeon, film_type) kind policy, permitting exactly
  -- {shop, detailer, ppf_installer, certified} and supporting categories.
  IF (SELECT count(*) FROM public.wizard_kind_policy
        WHERE product_mode = 'gyeon'
          AND kind = 'film_type'
          AND supports_categories = true
          AND cardinality(permitted_ranks) = 4
          AND permitted_ranks @> ARRAY['shop','detailer','ppf_installer','certified']::text[]
          AND permitted_ranks <@ ARRAY['shop','detailer','ppf_installer','certified']::text[]) <> 1
     OR (SELECT count(*) FROM public.wizard_kind_policy
        WHERE product_mode = 'gyeon' AND kind = 'film_type') <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:film-kind-policy';
  END IF;

  -- Exactly one (gyeon, film_type) ownership tuple, and it is the dealer-scope
  -- wizard_catalog/wizard_catalog tuple the fixture requires.
  IF (SELECT count(*) FROM public.wizard_kind_ownership_policy
        WHERE product_mode = 'gyeon'
          AND kind = 'film_type'
          AND owner_scope = 'dealer'
          AND label_owner = 'wizard_catalog'
          AND price_owner = 'wizard_catalog') <> 1
     OR (SELECT count(*) FROM public.wizard_kind_ownership_policy
        WHERE product_mode = 'gyeon' AND kind = 'film_type') <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:film-ownership-policy';
  END IF;

  -- The window category is permitted for EXACTLY shop, detailer,
  -- ppf_installer, and certified under gyeon — no missing rank, and no
  -- additional rank silently widening it.
  IF (SELECT count(*) FROM public.wizard_rank_category_policy
        WHERE product_mode = 'gyeon' AND category_id = 'window') <> 4
     OR (SELECT count(*) FROM public.wizard_rank_category_policy
        WHERE product_mode = 'gyeon' AND category_id = 'window'
          AND rank IN ('shop','detailer','ppf_installer','certified')) <> 4 THEN
    RAISE EXCEPTION 'SEED_PRECOND:film-rank-category-policy';
  END IF;

  -- No pre-existing actor-owned film type of any state.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND kind = 'film_type') <> 0 THEN
    RAISE EXCEPTION 'SEED_PRECOND:actor-film-absent';
  END IF;

  -- Neither the deterministic id nor the deterministic identity tuple may exist.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE id = 'b7400000-0000-4000-8000-0000000000a1') <> 0
     OR (SELECT count(*) FROM public.wizard_catalog_items
        WHERE market = 'jp' AND product_mode = 'gyeon' AND kind = 'film_type'
          AND code = 'film-b7400000-0000-4000-8000-0000000000a1'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1') <> 0 THEN
    RAISE EXCEPTION 'SEED_PRECOND:film-identity-absent';
  END IF;
END
$b7_seed_film_precond$;

-- ── Preconditions: the central policy the maintenance fixture depends on ────
-- Same fail-closed discipline as the film preconditions: without these the
-- fixture would surface as a raw foreign-key or trigger error rather than a
-- typed, named seed failure.
DO $b7_seed_maintenance_precond$
BEGIN
  -- Exactly one (gyeon, maintenance_menu) kind policy, permitting exactly the
  -- four business ranks and supporting categories.
  IF (SELECT count(*) FROM public.wizard_kind_policy
        WHERE product_mode = 'gyeon'
          AND kind = 'maintenance_menu'
          AND supports_categories = true
          AND cardinality(permitted_ranks) = 4
          AND permitted_ranks @> ARRAY['shop','detailer','ppf_installer','certified']::text[]
          AND permitted_ranks <@ ARRAY['shop','detailer','ppf_installer','certified']::text[]) <> 1
     OR (SELECT count(*) FROM public.wizard_kind_policy
        WHERE product_mode = 'gyeon' AND kind = 'maintenance_menu') <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:maintenance-kind-policy';
  END IF;

  -- Exactly one (gyeon, maintenance_menu) ownership tuple, and it is the
  -- dealer-scope wizard_catalog/wizard_catalog tuple the fixture requires.
  IF (SELECT count(*) FROM public.wizard_kind_ownership_policy
        WHERE product_mode = 'gyeon'
          AND kind = 'maintenance_menu'
          AND owner_scope = 'dealer'
          AND label_owner = 'wizard_catalog'
          AND price_owner = 'wizard_catalog') <> 1
     OR (SELECT count(*) FROM public.wizard_kind_ownership_policy
        WHERE product_mode = 'gyeon' AND kind = 'maintenance_menu') <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:maintenance-ownership-policy';
  END IF;

  -- The maintenance category is permitted for EXACTLY the four permitted ranks
  -- under gyeon — no missing pair, and no additional rank silently widening it.
  IF (SELECT count(*) FROM public.wizard_rank_category_policy
        WHERE product_mode = 'gyeon' AND category_id = 'maintenance') <> 4
     OR (SELECT count(*) FROM public.wizard_rank_category_policy
        WHERE product_mode = 'gyeon' AND category_id = 'maintenance'
          AND rank IN ('shop','detailer','ppf_installer','certified')) <> 4 THEN
    RAISE EXCEPTION 'SEED_PRECOND:maintenance-rank-category-policy';
  END IF;

  -- No pre-existing actor-owned maintenance menu of any state. Migration 106
  -- backfills these from dealer_settings JSON, which the seed leaves at defaults.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND kind = 'maintenance_menu') <> 0 THEN
    RAISE EXCEPTION 'SEED_PRECOND:actor-maintenance-absent';
  END IF;

  -- Neither the deterministic id nor the deterministic identity tuple may exist.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE id = 'b7400000-0000-4000-8000-0000000000a2') <> 0
     OR (SELECT count(*) FROM public.wizard_catalog_items
        WHERE market = 'jp' AND product_mode = 'gyeon' AND kind = 'maintenance_menu'
          AND code = 'maint-a'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1') <> 0 THEN
    RAISE EXCEPTION 'SEED_PRECOND:maintenance-identity-absent';
  END IF;
END
$b7_seed_maintenance_precond$;

-- ── Actor-dealer-owned film_type fixture (item + ranks + category) ──────────
-- Explicit column list; every value deterministic. Identity is the code, never
-- the label. Quantity/duration fields are held at the values the schema forces
-- for a non-store_global_option, non-menu kind.
INSERT INTO public.wizard_catalog_items (
  id, market, product_mode, kind, owner_scope, dealer_id, code,
  label_owner, price_owner, pricing_ref, label_ja, label_en, description,
  display_order, is_active, default_unit_price, editable_unit_price, priceable,
  quantity_required, min_quantity, max_quantity, duration_minutes,
  presentation, deleted_at
) VALUES (
  'b7400000-0000-4000-8000-0000000000a1', 'jp', 'gyeon', 'film_type', 'dealer',
  'b7400000-0000-4000-8000-0000000000d1', 'film-b7400000-0000-4000-8000-0000000000a1',
  'wizard_catalog', 'wizard_catalog', NULL, 'B7-4 ACTOR FILM', NULL, NULL,
  0, true, NULL, false, true,
  false, 1, NULL, NULL,
  '{}'::jsonb, NULL
);

-- Ranks are the BUSINESS ranks the item is offered to (103 §5) — NOT the actor
-- dealer's current rank. Derived from the authoritative policy array in its own
-- ordinal order, exactly as wiz_upsert_catalog_item derives them.
INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
SELECT 'b7400000-0000-4000-8000-0000000000a1'::uuid, r.rank
  FROM public.wizard_kind_policy p
  CROSS JOIN LATERAL unnest(p.permitted_ranks) WITH ORDINALITY AS r(rank, ord)
 WHERE p.product_mode = 'gyeon' AND p.kind = 'film_type'
 ORDER BY r.ord;

-- Exactly one category. film_type maps canonically to 'window' (108 §6.9), and
-- the runtime resolver rejects any item carrying more than one category.
INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
  VALUES ('b7400000-0000-4000-8000-0000000000a1', 'window');

-- ── Actor-dealer-owned maintenance_menu fixture (item + ranks + category) ───
-- The production wizard offers no free-form maintenance identity: the menu id it
-- emits is exactly this row's `code` (BodyMaintenanceSelector -> screenConfig ->
-- wizard-runtime-config `menu()`), and the save mapper composes the persisted
-- lineId as `manual:<category>:<code>`. `maint-a` is therefore the exact code
-- that produces verify.md's contracted `manual:maintenance:maint-a` line; it is
-- also migration 106's ratified legacy mapping for maintenance menu 'A'.
--
-- default_unit_price is a DISPLAY default only. The saved amount is the value the
-- operator types (maintenance is manual_only / amount required), so this value
-- exists so the card face agrees with the contracted ¥5,000 rather than showing
-- ¥0 via the resolver's `default_unit_price ?? 0` coercion.
INSERT INTO public.wizard_catalog_items (
  id, market, product_mode, kind, owner_scope, dealer_id, code,
  label_owner, price_owner, pricing_ref, label_ja, label_en, description,
  display_order, is_active, default_unit_price, editable_unit_price, priceable,
  quantity_required, min_quantity, max_quantity, duration_minutes,
  presentation, deleted_at
) VALUES (
  'b7400000-0000-4000-8000-0000000000a2', 'jp', 'gyeon', 'maintenance_menu', 'dealer',
  'b7400000-0000-4000-8000-0000000000d1', 'maint-a',
  'wizard_catalog', 'wizard_catalog', NULL, 'メンテA', NULL, NULL,
  0, true, 5000, false, true,
  false, 1, NULL, NULL,
  '{}'::jsonb, NULL
);

-- All four permitted business ranks, derived from the authoritative policy array
-- in its own ordinal order — never the actor dealer's current rank, and never a
-- hardcoded VALUES list that could drift from policy.
INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
SELECT 'b7400000-0000-4000-8000-0000000000a2'::uuid, r.rank
  FROM public.wizard_kind_policy p
  CROSS JOIN LATERAL unnest(p.permitted_ranks) WITH ORDINALITY AS r(rank, ord)
 WHERE p.product_mode = 'gyeon' AND p.kind = 'maintenance_menu'
 ORDER BY r.ord;

-- Exactly one category. maintenance_menu maps canonically to 'maintenance'
-- (108 §6.9, matching 106's backfill), and more than one would be rejected by
-- the runtime resolver.
INSERT INTO public.wizard_catalog_item_categories (catalog_item_id, category_id)
  VALUES ('b7400000-0000-4000-8000-0000000000a2', 'maintenance');

-- ── Actor-only maintenance offering + the single authoritative revision bump ─
-- Absence means OFF. This one explicit actor row makes the Step-3 maintenance
-- selection visible in Step 4. The dealer-service-offerings migration §7 INSERT trigger performs the
-- ONE required revision bump after both catalog fixtures are complete; there is
-- deliberately no second manual bump here. The foreign sentinel receives no row.
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled)
VALUES ('b7400000-0000-4000-8000-0000000000d1', 'maintenance', true);

-- ── Precondition: the bump produced exactly the expected lifecycle state ────
-- wiz_bump_dealer_revision increments the current revision and forces the row back
-- to unreviewed, clearing every CURRENT review field and never touching durable
-- history.
DO $b7_seed_lifecycle_post_bump$
BEGIN
  IF (SELECT count(*) FROM public.dealer_wizard_catalog_lifecycle
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND state = 'MIGRATED_UNREVIEWED'
          AND current_configuration_revision = 1
          AND reviewed_configuration_revision IS NULL
          AND reviewed_at IS NULL
          AND reviewed_by IS NULL
          AND last_reviewed_configuration_revision IS NULL
          AND last_reviewed_at IS NULL
          AND last_reviewed_by IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:lifecycle-post-offering-bump';
  END IF;
END
$b7_seed_lifecycle_post_bump$;

-- ── Activate the disposable actor lifecycle (only now the catalog is complete) ─
-- Guarded on the exact post-bump state so the update can never land on a row that
-- has drifted. reviewed_by and the durable last-reviewed trio stay NULL: no user
-- reviewed this catalog, and the seed does not impersonate one.
DO $b7_seed_lifecycle_activate$
DECLARE
  v_updated bigint;
BEGIN
  UPDATE public.dealer_wizard_catalog_lifecycle
     SET state = 'CATALOG_ACTIVE',
         current_configuration_revision = 1,
         reviewed_configuration_revision = 1,
         reviewed_at = now()
   WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
     AND state = 'MIGRATED_UNREVIEWED'
     AND current_configuration_revision = 1
     AND reviewed_configuration_revision IS NULL
     AND reviewed_at IS NULL
     AND reviewed_by IS NULL
     AND last_reviewed_configuration_revision IS NULL
     AND last_reviewed_at IS NULL
     AND last_reviewed_by IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'SEED_PRECOND:lifecycle-activate';
  END IF;
END
$b7_seed_lifecycle_activate$;

INSERT INTO public.customers (id, dealer_id, name, last_name, first_name, phone)
  VALUES ('b7400000-0000-4000-8000-0000000000c1', 'b7400000-0000-4000-8000-0000000000d1',
          'アクター太郎', 'アクター', '太郎', '090-0000-0001');

INSERT INTO public.vehicles (id, dealer_id, customer_id, maker, model, plate_number, body_size)
  VALUES ('b7400000-0000-4000-8000-0000000000f1', 'b7400000-0000-4000-8000-0000000000d1',
          'b7400000-0000-4000-8000-0000000000c1', 'Toyota', 'Aqua', 'ACTOR-0001', 'M');

-- ── Foreign sentinel tenant (NO membership/staff for :vuser) ────────────────
INSERT INTO public.dealers (id, name, detailer_rank)
  VALUES ('b7400000-0000-4000-8000-0000000000d2', 'B7-4 Foreign Sentinel Dealer', 'detailer');

INSERT INTO public.customers (id, dealer_id, name, last_name, first_name, phone)
  VALUES ('b7400000-0000-4000-8000-0000000000c2', 'b7400000-0000-4000-8000-0000000000d2',
          'ZZ-SENTINEL-FOREIGN-CUSTOMER', 'ZZ-SENTINEL-FOREIGN-CUSTOMER', 'X', '090-9999-9999');

INSERT INTO public.vehicles (id, dealer_id, customer_id, maker, model, plate_number, body_size)
  VALUES ('b7400000-0000-4000-8000-0000000000f2', 'b7400000-0000-4000-8000-0000000000d2',
          'b7400000-0000-4000-8000-0000000000c2', 'ZZ-SENTINEL-MAKER', 'ZZ-SENTINEL-MODEL',
          'FOREIGN-SENTINEL-PLATE', 'L');

-- ── Postconditions: any failure aborts and rolls back the entire seed ───────
DO $b7_seed_check$
DECLARE v_user uuid;
BEGIN
  SELECT vuser INTO STRICT v_user FROM b7_seed_context;

  IF (SELECT count(*) FROM public.dealers
        WHERE id = 'b7400000-0000-4000-8000-0000000000d1') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-dealer';
  END IF;

  IF (SELECT count(*) FROM public.dealer_settings
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-settings';
  END IF;

  IF (SELECT count(*) FROM public.dealer_members
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND user_id = v_user AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-member';
  END IF;

  IF (SELECT count(*) FROM public.dealer_staff
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND user_id = v_user AND role = 'owner' AND status = 'active') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-staff';
  END IF;

  IF (SELECT count(*) FROM public.dealer_members
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d2' AND user_id = v_user) <> 0
     OR (SELECT count(*) FROM public.dealer_staff
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d2' AND user_id = v_user) <> 0 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:foreign-linkage';
  END IF;

  -- The actor opted into exactly one managed family, maintenance, and the foreign
  -- sentinel stayed at the migration-defined default OFF (absence of a row).
  IF (SELECT count(*) FROM public.dealer_service_offerings
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1') <> 1
     OR (SELECT count(*) FROM public.dealer_service_offerings
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND family = 'maintenance' AND enabled = true) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-maintenance-offering';
  END IF;

  IF (SELECT count(*) FROM public.dealer_service_offerings
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d2') <> 0 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:foreign-service-offerings';
  END IF;

  IF (SELECT count(*) FROM public.dealer_wizard_catalog_lifecycle
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND state = 'CATALOG_ACTIVE'
          AND current_configuration_revision = 1
          AND reviewed_configuration_revision = 1
          AND reviewed_at IS NOT NULL
          AND reviewed_by IS NULL
          AND last_reviewed_configuration_revision IS NULL
          AND last_reviewed_at IS NULL
          AND last_reviewed_by IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:lifecycle';
  END IF;

  IF (SELECT count(*) FROM public.customers c JOIN public.vehicles v ON v.customer_id = c.id
        WHERE c.id = 'b7400000-0000-4000-8000-0000000000c1'
          AND v.id = 'b7400000-0000-4000-8000-0000000000f1'
          AND c.dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND v.dealer_id = 'b7400000-0000-4000-8000-0000000000d1') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-coherence';
  END IF;

  IF (SELECT count(*) FROM public.customers c JOIN public.vehicles v ON v.customer_id = c.id
        WHERE c.id = 'b7400000-0000-4000-8000-0000000000c2'
          AND v.id = 'b7400000-0000-4000-8000-0000000000f2'
          AND c.dealer_id = 'b7400000-0000-4000-8000-0000000000d2'
          AND v.dealer_id = 'b7400000-0000-4000-8000-0000000000d2') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:foreign-coherence';
  END IF;

  IF (SELECT count(*) FROM public.dealers
        WHERE id IN ('b7400000-0000-4000-8000-0000000000d1','b7400000-0000-4000-8000-0000000000d2')) <> 2
     OR (SELECT count(*) FROM public.customers
        WHERE id IN ('b7400000-0000-4000-8000-0000000000c1','b7400000-0000-4000-8000-0000000000c2')) <> 2
     OR (SELECT count(*) FROM public.vehicles
        WHERE id IN ('b7400000-0000-4000-8000-0000000000f1','b7400000-0000-4000-8000-0000000000f2')) <> 2 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:id-inventory';
  END IF;

  -- ── Film catalog guarantees (R84B-F7B) ────────────────────────────────────

  -- Exactly one active, non-deleted, actor-owned film type.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND kind = 'film_type'
          AND is_active = true
          AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-film-count';
  END IF;

  -- The foreign sentinel owns no film type in any state.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d2'
          AND kind = 'film_type') <> 0 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:foreign-film-count';
  END IF;

  -- The actor's dealer-owned catalog is EXACTLY these two items and nothing
  -- else: the film_type fixture (…a1) and the maintenance_menu fixture (…a2).
  -- Migration 106's backfill contributes nothing on a fresh database because the
  -- seed leaves dealer_settings at column defaults; the offering migration's compatibility
  -- backfill ran before these disposable catalog fixtures were inserted.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1') <> 2 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-dealer-catalog-total';
  END IF;

  -- Every fixed identity and behavioural field, proven on exactly one row.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE id = 'b7400000-0000-4000-8000-0000000000a1'
          AND market = 'jp'
          AND product_mode = 'gyeon'
          AND kind = 'film_type'
          AND owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND code = 'film-b7400000-0000-4000-8000-0000000000a1'
          AND label_owner = 'wizard_catalog'
          AND price_owner = 'wizard_catalog'
          AND pricing_ref IS NULL
          AND label_ja = 'B7-4 ACTOR FILM'
          AND label_en IS NULL
          AND description IS NULL
          AND display_order = 0
          AND is_active = true
          AND default_unit_price IS NULL
          AND editable_unit_price = false
          AND priceable = true
          AND quantity_required = false
          AND min_quantity = 1
          AND max_quantity IS NULL
          AND duration_minutes IS NULL
          AND presentation = '{}'::jsonb
          AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-film-identity';
  END IF;

  -- Exactly four rank rows, and the set is exactly {shop, detailer,
  -- ppf_installer, certified}.
  IF (SELECT count(*) FROM public.wizard_catalog_item_ranks
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a1') <> 4
     OR (SELECT count(*) FROM public.wizard_catalog_item_ranks
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a1'
          AND rank IN ('shop','detailer','ppf_installer','certified')) <> 4 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-film-ranks';
  END IF;

  -- Exactly one category row, and it is exactly 'window'.
  IF (SELECT count(*) FROM public.wizard_catalog_item_categories
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a1') <> 1
     OR (SELECT count(*) FROM public.wizard_catalog_item_categories
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a1'
          AND category_id = 'window') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-film-category';
  END IF;

  -- Runtime eligibility, expressed the way the resolver expresses it: exactly one
  -- active actor film type carrying rank detailer and category window.
  IF (SELECT count(*)
        FROM public.wizard_catalog_items i
        JOIN public.wizard_catalog_item_ranks r ON r.catalog_item_id = i.id
        JOIN public.wizard_catalog_item_categories c ON c.catalog_item_id = i.id
       WHERE i.owner_scope = 'dealer'
         AND i.dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
         AND i.kind = 'film_type'
         AND i.is_active = true
         AND i.deleted_at IS NULL
         AND r.rank = 'detailer'
         AND c.category_id = 'window') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-film-runtime-eligible';
  END IF;

  -- ── Maintenance catalog guarantees (R84B-F8B) ─────────────────────────────

  -- Exactly one active, non-deleted, actor-owned maintenance menu.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND kind = 'maintenance_menu'
          AND is_active = true
          AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-maintenance-count';
  END IF;

  -- The foreign sentinel owns no maintenance menu in any state.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d2'
          AND kind = 'maintenance_menu') <> 0 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:foreign-maintenance-count';
  END IF;

  -- Every fixed identity and behavioural field, proven on exactly one row.
  IF (SELECT count(*) FROM public.wizard_catalog_items
        WHERE id = 'b7400000-0000-4000-8000-0000000000a2'
          AND market = 'jp'
          AND product_mode = 'gyeon'
          AND kind = 'maintenance_menu'
          AND owner_scope = 'dealer'
          AND dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
          AND code = 'maint-a'
          AND label_owner = 'wizard_catalog'
          AND price_owner = 'wizard_catalog'
          AND pricing_ref IS NULL
          AND label_ja = 'メンテA'
          AND label_en IS NULL
          AND description IS NULL
          AND display_order = 0
          AND is_active = true
          AND default_unit_price = 5000
          AND editable_unit_price = false
          AND priceable = true
          AND quantity_required = false
          AND min_quantity = 1
          AND max_quantity IS NULL
          AND duration_minutes IS NULL
          AND presentation = '{}'::jsonb
          AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-maintenance-identity';
  END IF;

  -- Exactly four rank rows, and the set is exactly the four permitted ranks.
  IF (SELECT count(*) FROM public.wizard_catalog_item_ranks
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a2') <> 4
     OR (SELECT count(*) FROM public.wizard_catalog_item_ranks
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a2'
          AND rank IN ('shop','detailer','ppf_installer','certified')) <> 4 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-maintenance-ranks';
  END IF;

  -- Exactly one category row, and it is exactly 'maintenance'.
  IF (SELECT count(*) FROM public.wizard_catalog_item_categories
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a2') <> 1
     OR (SELECT count(*) FROM public.wizard_catalog_item_categories
        WHERE catalog_item_id = 'b7400000-0000-4000-8000-0000000000a2'
          AND category_id = 'maintenance') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-maintenance-category';
  END IF;

  -- Runtime eligibility, expressed the way the resolver expresses it: exactly one
  -- active actor maintenance menu carrying rank detailer and category maintenance.
  IF (SELECT count(*)
        FROM public.wizard_catalog_items i
        JOIN public.wizard_catalog_item_ranks r ON r.catalog_item_id = i.id
        JOIN public.wizard_catalog_item_categories c ON c.catalog_item_id = i.id
       WHERE i.owner_scope = 'dealer'
         AND i.dealer_id = 'b7400000-0000-4000-8000-0000000000d1'
         AND i.kind = 'maintenance_menu'
         AND i.is_active = true
         AND i.deleted_at IS NULL
         AND r.rank = 'detailer'
         AND c.category_id = 'maintenance') <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:actor-maintenance-runtime-eligible';
  END IF;

  -- The foreign sentinel's lifecycle was never touched by the actor's bump.
  IF (SELECT count(*) FROM public.dealer_wizard_catalog_lifecycle
        WHERE dealer_id = 'b7400000-0000-4000-8000-0000000000d2'
          AND state = 'MIGRATED_UNREVIEWED'
          AND current_configuration_revision = 0
          AND reviewed_configuration_revision IS NULL
          AND reviewed_at IS NULL
          AND reviewed_by IS NULL
          AND last_reviewed_configuration_revision IS NULL
          AND last_reviewed_at IS NULL
          AND last_reviewed_by IS NULL) <> 1 THEN
    RAISE EXCEPTION 'SEED_POSTCOND:foreign-lifecycle';
  END IF;
END
$b7_seed_check$;

COMMIT;
