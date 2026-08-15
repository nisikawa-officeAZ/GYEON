-- ============================================================================
-- 103_wizard_catalog_schema.sql — Estimate Wizard authoritative catalog (C1)
--
-- SCHEMA ONLY. INERT BY CONSTRUCTION.
--
-- This migration creates tables, constraints, indexes, helper functions, triggers,
-- grants and RLS. It seeds EXACTLY TWO rows: the product-mode registry entries that
-- the dealers.product_mode foreign key requires.
--
-- It deliberately seeds NO business policy and NO content:
--   • wizard_kind_policy            — EMPTY
--   • wizard_kind_ownership_policy  — EMPTY
--   • wizard_rank_category_policy   — EMPTY
--   • wizard_catalog_items          — EMPTY
--   • dealer_wizard_catalog_overrides — EMPTY
--
-- Because wizard_catalog_items carries a composite FK into wizard_kind_ownership_policy,
-- and that table is empty, EVERY catalog insert is rejected after this migration — global
-- and dealer alike, service_role included. The catalog is unusable until C2 seeds the
-- approved policy manifests. That is the intent: C1 is inert because the data model makes
-- it inert, not because a flag says so.
--
-- Nothing in the application reads these tables. The Estimate Wizard remains unmounted.
--
-- ── SAFE ROLLBACK (PRE-C2 ONLY) ─────────────────────────────────────────────
-- Valid ONLY while every table below is still empty (i.e. before C2 runs). Order matters:
-- dealers.product_mode holds an FK INTO wizard_product_modes, so it must go first.
--
--   1. ALTER TABLE public.dealers DROP CONSTRAINT dealers_product_mode_fkey;
--      ALTER TABLE public.dealers DROP COLUMN product_mode;
--      DROP TRIGGER trg_dealers_product_mode_guard ON public.dealers;
--   2. DROP TABLE public.dealer_wizard_catalog_overrides;
--      DROP TABLE public.wizard_catalog_item_categories;
--      DROP TABLE public.wizard_catalog_item_ranks;
--      DROP TABLE public.wizard_catalog_items;
--   3. DROP TABLE public.wizard_kind_ownership_policy;
--      DROP TABLE public.wizard_kind_policy;
--      DROP TABLE public.wizard_rank_category_policy;
--      DROP TABLE public.wizard_product_modes;
--   4. DROP FUNCTION public.wiz_validate_item_child_trigger();
--      DROP FUNCTION public.wiz_validate_item_trigger();
--      DROP FUNCTION public.wiz_revalidate_items_for_kind();
--      DROP FUNCTION public.wiz_revalidate_items_for_mode();
--      DROP FUNCTION public.wiz_validate_catalog_item(uuid);
--      DROP FUNCTION public.wiz_guard_override();
--      DROP FUNCTION public.wiz_reject_hard_delete();
--      DROP FUNCTION public.wiz_guard_catalog_item();
--      DROP FUNCTION public.wiz_guard_catalog_item_immutable();
--      DROP FUNCTION public.wiz_guard_dealers_product_mode();
--      DROP FUNCTION public.wiz_can_configure(uuid);
--      DROP FUNCTION public.wiz_is_active_member(uuid);
--      DROP FUNCTION public.wiz_is_any_active_member();
--
-- AFTER C2 HAS RUN, POPULATED DATA MUST NEVER BE DROPPED.
-- Once dealers have written configuration, rollback is DISABLEMENT, not deletion:
-- set wizard_product_modes.runtime_enabled = false and leave the Wizard unmounted.
-- Catalog rows, dealer overrides and any future snapshots are always retained; defects
-- are forward-fixed by rows, never by dropping a populated table.
-- ============================================================================

-- ── Section 0: constants ────────────────────────────────────────────────────
-- The zero UUID is the sentinel used by the identity index to make NULL dealer_id
-- comparable. It must therefore never be a real dealer_id.

-- ── Section 1: product-mode registry ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wizard_product_modes (
  mode            text        PRIMARY KEY,
  runtime_enabled boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wizard_product_modes_mode_check CHECK (mode IN ('gyeon', 'generic'))
);

-- The ONLY seed in this migration. Required by the dealers.product_mode FK.
-- 'generic' exists so the schema is ready for the Generic Detailer Agent, but it is
-- runtime-DISABLED: no dealer-owned row can be created under it (see wiz_guard_catalog_item).
INSERT INTO public.wizard_product_modes (mode, runtime_enabled) VALUES
  ('gyeon',   true),
  ('generic', false)
ON CONFLICT (mode) DO NOTHING;

-- ── Section 2: dealers.product_mode ─────────────────────────────────────────
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS product_mode text NOT NULL DEFAULT 'gyeon';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dealers_product_mode_fkey'
  ) THEN
    ALTER TABLE public.dealers
      ADD CONSTRAINT dealers_product_mode_fkey
      FOREIGN KEY (product_mode) REFERENCES public.wizard_product_modes(mode);
  END IF;
END $$;

-- Migration 071 records that NO dealer-facing UPDATE policy on public.dealers exists, so a
-- client cannot switch product_mode today. This trigger is defence in depth: if such a policy
-- is ever added, product_mode still cannot be changed by a normal authenticated session.
-- Only service_role / superuser (the admin lifecycle path) may switch it.
CREATE OR REPLACE FUNCTION public.wiz_guard_dealers_product_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.product_mode IS DISTINCT FROM OLD.product_mode
     AND current_setting('role', true) NOT IN ('service_role', 'postgres')
     AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'product_mode may only be changed by the admin lifecycle (service_role)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dealers_product_mode_guard ON public.dealers;
CREATE TRIGGER trg_dealers_product_mode_guard
  BEFORE UPDATE ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_dealers_product_mode();

-- ── Section 3: policy tables (EMPTY in C1 — this is what makes C1 inert) ─────
CREATE TABLE IF NOT EXISTS public.wizard_kind_policy (
  product_mode        text    NOT NULL REFERENCES public.wizard_product_modes(mode),
  kind                text    NOT NULL,
  permitted_ranks     text[]  NOT NULL,
  supports_categories boolean NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_mode, kind),
  CONSTRAINT wizard_kind_policy_kind_check CHECK (kind IN (
    'film_type', 'window_area', 'maintenance_menu', 'wash_menu', 'room_cleaning_menu',
    'other_work_preset', 'store_global_option', 'coupon',
    'ppf_method', 'ppf_part', 'ppf_type_group'
  )),
  -- No permissive default: a kind with an empty rank set cannot exist.
  CONSTRAINT wizard_kind_policy_ranks_nonempty CHECK (cardinality(permitted_ranks) > 0),
  CONSTRAINT wizard_kind_policy_ranks_valid CHECK (
    permitted_ranks <@ ARRAY['shop','detailer','ppf_installer','certified']::text[]
  )
);

-- PRESENCE = allowed. ABSENCE = forbidden. There is no flag and no code default:
-- wizard_catalog_items FKs onto this five-tuple, so an unlisted combination is
-- unrepresentable. This replaces the earlier `requires_pricing_ref` boolean, which could
-- not express that a GLOBAL maintenance menu is PricingCatalog-owned while a DEALER one is
-- wizard-owned.
CREATE TABLE IF NOT EXISTS public.wizard_kind_ownership_policy (
  product_mode text NOT NULL,
  kind         text NOT NULL,
  owner_scope  text NOT NULL,
  label_owner  text NOT NULL,
  price_owner  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_mode, kind, owner_scope, label_owner, price_owner),
  FOREIGN KEY (product_mode, kind)
    REFERENCES public.wizard_kind_policy (product_mode, kind) ON DELETE RESTRICT,
  CONSTRAINT wizard_kop_owner_scope_check CHECK (owner_scope IN ('global','dealer')),
  CONSTRAINT wizard_kop_label_owner_check CHECK (label_owner IN ('pricing_catalog','wizard_catalog')),
  CONSTRAINT wizard_kop_price_owner_check CHECK (price_owner IN ('pricing_catalog','wizard_catalog')),
  -- If PricingCatalog owns the price it must own the label too, or one pricing_ref could
  -- carry two different labels — exactly the divergence this design forbids.
  CONSTRAINT wizard_kop_price_implies_label CHECK (
    price_owner = 'wizard_catalog' OR label_owner = 'pricing_catalog'
  )
);

-- Rank → category authorisation, SCOPED BY PRODUCT MODE. PRESENCE = allowed; ABSENCE = denied.
-- This is the CENTRAL rule set. Item rank/category pairs are validated against it, so a
-- dealer can never author an item that widens what their rank permits.
--
-- `product_mode` is part of the key: GYEON and Generic may legitimately permit different
-- category sets per rank, and an item is always validated against its own mode's rules.
CREATE TABLE IF NOT EXISTS public.wizard_rank_category_policy (
  product_mode text NOT NULL REFERENCES public.wizard_product_modes(mode) ON DELETE RESTRICT,
  rank         text NOT NULL,
  category_id  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_mode, rank, category_id),
  CONSTRAINT wizard_rcp_rank_check CHECK (rank IN ('shop','detailer','ppf_installer','certified')),
  CONSTRAINT wizard_rcp_category_check CHECK (category_id IN (
    'coating','ppf','window','maintenance','carwash','roomclean','other'
  ))
);

-- ── Section 4: catalog items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wizard_catalog_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market                text NOT NULL DEFAULT 'jp',
  product_mode          text NOT NULL,
  kind                  text NOT NULL,
  owner_scope           text NOT NULL,
  dealer_id             uuid REFERENCES public.dealers(id) ON DELETE RESTRICT,
  code                  text NOT NULL,

  label_owner           text NOT NULL,
  price_owner           text NOT NULL,
  pricing_ref           text,
  label_ja              text,
  label_en              text,
  description           text,

  display_order         integer NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,

  default_unit_price    integer,
  editable_unit_price   boolean NOT NULL DEFAULT false,
  priceable             boolean NOT NULL DEFAULT true,

  quantity_required     boolean NOT NULL DEFAULT false,
  min_quantity          integer NOT NULL DEFAULT 1,
  max_quantity          integer,

  coupon_discount_type  text,
  coupon_discount_value integer,
  coupon_combinable     boolean,
  coupon_valid_from     date,
  coupon_valid_to       date,

  ppf_type_group_id     uuid REFERENCES public.wizard_catalog_items(id) ON DELETE RESTRICT,

  presentation          jsonb NOT NULL DEFAULT '{}'::jsonb,

  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- No ownership combination can exist without an approved policy row. With
  -- wizard_kind_ownership_policy empty (C1), this FK rejects EVERY insert.
  FOREIGN KEY (product_mode, kind, owner_scope, label_owner, price_owner)
    REFERENCES public.wizard_kind_ownership_policy
      (product_mode, kind, owner_scope, label_owner, price_owner) ON DELETE RESTRICT,

  CONSTRAINT wci_owner_scope_check CHECK (owner_scope IN ('global','dealer')),
  CONSTRAINT wci_label_owner_check CHECK (label_owner IN ('pricing_catalog','wizard_catalog')),
  CONSTRAINT wci_price_owner_check CHECK (price_owner IN ('pricing_catalog','wizard_catalog')),
  CONSTRAINT wci_market_check CHECK (market ~ '^[a-z]{2}$'),

  -- Ownership ↔ dealer_id
  CONSTRAINT wci_ownership_dealer_check CHECK (
    (owner_scope = 'global' AND dealer_id IS NULL)
    OR (owner_scope = 'dealer' AND dealer_id IS NOT NULL)
  ),
  -- The zero UUID is the identity-index sentinel. It must never be a real dealer.
  CONSTRAINT wci_dealer_not_zero_uuid CHECK (
    dealer_id IS NULL OR dealer_id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),

  -- Stable code format (identity is a code, never a label).
  CONSTRAINT wci_code_format_check CHECK (code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  CONSTRAINT wci_pricing_ref_format_check CHECK (
    pricing_ref IS NULL OR pricing_ref ~ '^[a-zA-Z][a-zA-Z0-9]*:[A-Za-z0-9_-]+$'
  ),

  -- ── Label / price ownership. Divergence is UNREPRESENTABLE. ──
  -- A pricing_ref exists iff PricingCatalog owns the label or the price.
  CONSTRAINT wci_pricing_ref_iff_catalog_owned CHECK (
    (pricing_ref IS NOT NULL)
    = (label_owner = 'pricing_catalog' OR price_owner = 'pricing_catalog')
  ),
  -- PricingCatalog price implies PricingCatalog label (one ref, one label).
  CONSTRAINT wci_price_implies_label CHECK (
    price_owner = 'wizard_catalog' OR label_owner = 'pricing_catalog'
  ),
  -- A PricingCatalog-owned label stores NO local label to diverge from.
  CONSTRAINT wci_catalog_label_has_no_local_label CHECK (
    label_owner <> 'pricing_catalog' OR (label_ja IS NULL AND label_en IS NULL)
  ),
  -- A wizard-owned label must actually have one (non-empty).
  CONSTRAINT wci_wizard_label_required CHECK (
    label_owner <> 'wizard_catalog' OR (label_ja IS NOT NULL AND btrim(label_ja) <> '')
  ),
  -- A PricingCatalog-owned price stores NO local price.
  CONSTRAINT wci_catalog_price_has_no_local_price CHECK (
    price_owner <> 'pricing_catalog' OR default_unit_price IS NULL
  ),
  CONSTRAINT wci_price_non_negative CHECK (default_unit_price IS NULL OR default_unit_price >= 0),

  -- ── Behavioural fields ──
  -- Quantity behaviour belongs to store-global options and nothing else.
  CONSTRAINT wci_quantity_scope CHECK (
    kind = 'store_global_option'
    OR (quantity_required = false AND min_quantity = 1 AND max_quantity IS NULL)
  ),
  CONSTRAINT wci_min_quantity_check CHECK (min_quantity >= 1),
  CONSTRAINT wci_max_quantity_check CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),

  -- Coupon behaviour belongs to coupons and nothing else.
  CONSTRAINT wci_coupon_fields_scope CHECK (
    kind = 'coupon'
    OR (coupon_discount_type IS NULL AND coupon_discount_value IS NULL
        AND coupon_combinable IS NULL
        AND coupon_valid_from IS NULL AND coupon_valid_to IS NULL)
  ),
  CONSTRAINT wci_coupon_required_fields CHECK (
    kind <> 'coupon'
    OR (coupon_discount_type IN ('amount','percent')
        AND coupon_discount_value IS NOT NULL AND coupon_discount_value >= 0
        AND coupon_combinable IS NOT NULL)
  ),
  CONSTRAINT wci_coupon_percent_range CHECK (
    coupon_discount_type <> 'percent'
    OR (coupon_discount_value >= 0 AND coupon_discount_value <= 100)
  ),
  CONSTRAINT wci_coupon_validity_order CHECK (
    coupon_valid_to IS NULL OR coupon_valid_from IS NULL OR coupon_valid_to >= coupon_valid_from
  ),

  -- PPF group linkage exists only on PPF type-group products.
  CONSTRAINT wci_ppf_group_scope CHECK (
    ppf_type_group_id IS NULL OR kind = 'ppf_type_group'
  ),
  CONSTRAINT wci_ppf_group_not_self CHECK (ppf_type_group_id IS NULL OR ppf_type_group_id <> id),

  -- presentation carries icon/badge/colour ONLY. It is never read by authorisation,
  -- pricing, validation or persistence logic. It must be an object, not a scalar or array.
  CONSTRAINT wci_presentation_is_object CHECK (jsonb_typeof(presentation) = 'object')
);

-- ── Stable identity: NON-PARTIAL. A soft-deleted code can NEVER be reused. ──
-- Deliberately has no `WHERE deleted_at IS NULL`: reusing a retired code would let a new
-- item inherit the meaning of an old one on historical estimates. Codes are permanent.
CREATE UNIQUE INDEX IF NOT EXISTS wizard_catalog_items_identity_uidx
  ON public.wizard_catalog_items (
    market,
    product_mode,
    kind,
    code,
    COALESCE(dealer_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS wizard_catalog_items_lookup_idx
  ON public.wizard_catalog_items (market, product_mode, kind, is_active)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS wizard_catalog_items_dealer_idx
  ON public.wizard_catalog_items (dealer_id) WHERE dealer_id IS NOT NULL;

-- ── Section 5: rank / category child tables ─────────────────────────────────
-- Ranks are the BUSINESS ranks an item is offered to. They are NOT the creating dealer's
-- rank: a dealer's rank may legitimately change, and their coupons and menus must survive
-- it. The dealer's authoritative rank is applied only by the resolver, as an intersection.
CREATE TABLE IF NOT EXISTS public.wizard_catalog_item_ranks (
  catalog_item_id uuid NOT NULL REFERENCES public.wizard_catalog_items(id) ON DELETE CASCADE,
  rank            text NOT NULL,
  PRIMARY KEY (catalog_item_id, rank),
  CONSTRAINT wcir_rank_check CHECK (rank IN ('shop','detailer','ppf_installer','certified'))
);

CREATE TABLE IF NOT EXISTS public.wizard_catalog_item_categories (
  catalog_item_id uuid NOT NULL REFERENCES public.wizard_catalog_items(id) ON DELETE CASCADE,
  category_id     text NOT NULL,
  PRIMARY KEY (catalog_item_id, category_id),
  CONSTRAINT wcic_category_check CHECK (category_id IN (
    'coating','ppf','window','maintenance','carwash','roomclean','other'
  ))
);

-- ── Section 6: dealer overrides (may only NARROW) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.dealer_wizard_catalog_overrides (
  -- RESTRICT, not CASCADE (C1H): a dealer hard-deletion must never silently erase wizard
  -- configuration. This now matches wizard_catalog_items.dealer_id, which was already RESTRICT.
  -- Dealers are soft-deleted in this repository (088_dealer_soft_delete), so RESTRICT costs
  -- nothing operationally and closes the asymmetry.
  dealer_id       uuid NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  -- RESTRICT, never CASCADE: a catalog item cannot be erased out from under live
  -- dealer configuration.
  catalog_item_id uuid NOT NULL REFERENCES public.wizard_catalog_items(id) ON DELETE RESTRICT,
  is_enabled      boolean,          -- NULL = inherit. TRUE is rejected when the global row is off.
  unit_price      integer,          -- rejected when price_owner = 'pricing_catalog'
  display_order   integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dealer_id, catalog_item_id),
  CONSTRAINT dwco_unit_price_non_negative CHECK (unit_price IS NULL OR unit_price >= 0)
);

-- ── Section 7: RLS helper functions (wiz_ prefixed to avoid collisions) ─────
-- Configuration-capable roles follow the repository's existing convention
-- (see 050_create_staff_roles.sql): an ACTIVE dealer_members row with role owner|manager,
-- or the dealer's owner_user_id. dealer_members.role vocabulary is
-- ('owner','manager','staff','readonly') per 003; status is ('active','invited','suspended','removed').

CREATE OR REPLACE FUNCTION public.wiz_is_any_active_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dealer_members
     WHERE user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.wiz_is_active_member(d uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dealer_members
     WHERE dealer_id = d AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.wiz_can_configure(d uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dealer_members
     WHERE dealer_id = d AND user_id = auth.uid()
       AND status = 'active' AND role IN ('owner','manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.dealers WHERE id = d AND owner_user_id = auth.uid()
  );
$$;

-- ── Section 8: integrity triggers ───────────────────────────────────────────

-- 8a. Immutable ownership/identity. Labels and prices may be corrected where ownership
--     permits; identity and ownership may never be rewritten after insert.
CREATE OR REPLACE FUNCTION public.wiz_guard_catalog_item_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.market       IS DISTINCT FROM OLD.market       THEN RAISE EXCEPTION 'market is immutable'; END IF;
  IF NEW.product_mode IS DISTINCT FROM OLD.product_mode THEN RAISE EXCEPTION 'product_mode is immutable'; END IF;
  IF NEW.kind         IS DISTINCT FROM OLD.kind         THEN RAISE EXCEPTION 'kind is immutable'; END IF;
  IF NEW.owner_scope  IS DISTINCT FROM OLD.owner_scope  THEN RAISE EXCEPTION 'owner_scope is immutable'; END IF;
  IF NEW.dealer_id    IS DISTINCT FROM OLD.dealer_id    THEN RAISE EXCEPTION 'dealer_id is immutable'; END IF;
  IF NEW.code         IS DISTINCT FROM OLD.code         THEN RAISE EXCEPTION 'code is immutable'; END IF;
  IF NEW.label_owner  IS DISTINCT FROM OLD.label_owner  THEN RAISE EXCEPTION 'label_owner is immutable'; END IF;
  IF NEW.price_owner  IS DISTINCT FROM OLD.price_owner  THEN RAISE EXCEPTION 'price_owner is immutable'; END IF;
  IF NEW.pricing_ref  IS DISTINCT FROM OLD.pricing_ref  THEN RAISE EXCEPTION 'pricing_ref is immutable'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 8b. Product-mode + PPF-group integrity, on INSERT and UPDATE.
CREATE OR REPLACE FUNCTION public.wiz_guard_catalog_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_dealer_mode   text;
  v_mode_enabled  boolean;
  v_grp           public.wizard_catalog_items%ROWTYPE;
BEGIN
  IF NEW.owner_scope = 'dealer' THEN
    SELECT d.product_mode INTO v_dealer_mode FROM public.dealers d WHERE d.id = NEW.dealer_id;
    IF v_dealer_mode IS NULL THEN
      RAISE EXCEPTION 'unknown dealer for dealer-owned catalog item';
    END IF;
    -- A dealer-owned row must live in that dealer's own product mode.
    IF NEW.product_mode <> v_dealer_mode THEN
      RAISE EXCEPTION 'dealer-owned item product_mode (%) must equal the dealer product_mode (%)',
        NEW.product_mode, v_dealer_mode;
    END IF;
    -- Generic remains schema-ready but runtime-DEAD until the Generic Detailer Agent phase.
    SELECT m.runtime_enabled INTO v_mode_enabled
      FROM public.wizard_product_modes m WHERE m.mode = NEW.product_mode;
    IF v_mode_enabled IS NOT TRUE THEN
      RAISE EXCEPTION 'product_mode % is not runtime-enabled; dealer-owned items are blocked',
        NEW.product_mode;
    END IF;
  END IF;

  -- PPF type-group linkage must resolve to a real group in the same market/mode, with
  -- compatible ownership and no cross-dealer reference.
  IF NEW.ppf_type_group_id IS NOT NULL THEN
    SELECT * INTO v_grp FROM public.wizard_catalog_items WHERE id = NEW.ppf_type_group_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ppf_type_group_id does not resolve';
    END IF;
    IF v_grp.kind <> 'ppf_type_group' THEN
      RAISE EXCEPTION 'ppf_type_group_id must reference a ppf_type_group row';
    END IF;
    IF v_grp.market <> NEW.market OR v_grp.product_mode <> NEW.product_mode THEN
      RAISE EXCEPTION 'ppf_type_group_id must share market and product_mode';
    END IF;
    -- A dealer row may reference a global group or its OWN group — never another dealer's.
    IF v_grp.owner_scope = 'dealer'
       AND (NEW.owner_scope <> 'dealer' OR v_grp.dealer_id IS DISTINCT FROM NEW.dealer_id) THEN
      RAISE EXCEPTION 'cross-dealer ppf_type_group reference is forbidden';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- 8c. Hard deletion is rejected for EVERY caller, including normal application paths.
--     Retirement is `deleted_at`; historical estimates must never lose their referent.
CREATE OR REPLACE FUNCTION public.wiz_reject_hard_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'hard deletion of wizard catalog items is forbidden; set deleted_at instead';
END $$;

DROP TRIGGER IF EXISTS trg_wci_immutable ON public.wizard_catalog_items;
CREATE TRIGGER trg_wci_immutable
  BEFORE UPDATE ON public.wizard_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_catalog_item_immutable();

DROP TRIGGER IF EXISTS trg_wci_guard ON public.wizard_catalog_items;
CREATE TRIGGER trg_wci_guard
  BEFORE INSERT OR UPDATE ON public.wizard_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_catalog_item();

DROP TRIGGER IF EXISTS trg_wci_no_hard_delete ON public.wizard_catalog_items;
CREATE TRIGGER trg_wci_no_hard_delete
  BEFORE DELETE ON public.wizard_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.wiz_reject_hard_delete();

-- 8d. THE WHOLE-ITEM INVARIANT (C1H) — deferred, order-independent, unbypassable.
--
-- ── THE DEFECT THIS REPLACES ────────────────────────────────────────────────
-- The previous design validated per-row and IMMEDIATELY: the category trigger looped over the
-- ranks that existed AT THAT MOMENT, and the rank trigger checked only rank ∈ permitted_ranks.
-- Insert the category FIRST (zero ranks ⇒ the loop body never ran ⇒ vacuous pass), then insert
-- the rank (passes on its own), and the item committed holding a (rank, category) pair that
-- central policy forbids. Both triggers passed individually; the invariant was violated only in
-- combination. That is precisely the privilege widening this schema exists to prevent.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- ONE reusable validator over the FINAL committed state of a single item, invoked by DEFERRABLE
-- INITIALLY DEFERRED constraint triggers. Deferred triggers fire at COMMIT, after every row in
-- the transaction is in place, so NO insertion order of (item, ranks, categories) can bypass it.
--
-- SECURITY DEFINER on purpose: an invoker-rights validator would read wizard_catalog_items and
-- its children THROUGH RLS, so a row the caller cannot see would validate vacuously. A security
-- decision must not depend on the caller's visibility. search_path is pinned.
CREATE OR REPLACE FUNCTION public.wiz_validate_catalog_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item       public.wizard_catalog_items%ROWTYPE;
  v_permitted  text[];
  v_supports   boolean;
  v_rank_count integer;
  v_cat_count  integer;
  v_bad_rank   text;
  v_bad_pair   record;
BEGIN
  SELECT * INTO v_item FROM public.wizard_catalog_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    -- The item no longer exists at COMMIT (its children cascaded away with it). Nothing to check.
    RETURN;
  END IF;

  -- Central policy for this (product_mode, kind). MISSING POLICY ALWAYS FAILS.
  SELECT p.permitted_ranks, p.supports_categories
    INTO v_permitted, v_supports
    FROM public.wizard_kind_policy p
   WHERE p.product_mode = v_item.product_mode AND p.kind = v_item.kind;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'wizard_catalog: no kind policy for (product_mode=%, kind=%) — item % is forbidden',
      v_item.product_mode, v_item.kind, p_item_id;
  END IF;

  -- (1) At least one rank. No permissive default: an item visible to nobody-by-omission is not
  --     allowed to exist, because "no ranks" must never be mistaken for "all ranks" later.
  SELECT count(*) INTO v_rank_count
    FROM public.wizard_catalog_item_ranks r WHERE r.catalog_item_id = p_item_id;
  IF v_rank_count = 0 THEN
    RAISE EXCEPTION 'wizard_catalog: item % has no ranks; at least one is required', p_item_id;
  END IF;

  -- (2) Every rank must be permitted for this kind by CENTRAL policy.
  --     Note what is NOT consulted: the owning dealer's current rank. Item ranks are the BUSINESS
  --     ranks an item is offered to. A dealer's rank may legitimately change and their coupons and
  --     menus must survive it; the dealer's authoritative rank is applied only at resolution time,
  --     as an intersection.
  SELECT r.rank INTO v_bad_rank
    FROM public.wizard_catalog_item_ranks r
   WHERE r.catalog_item_id = p_item_id
     AND NOT (r.rank = ANY (v_permitted))
   LIMIT 1;
  IF v_bad_rank IS NOT NULL THEN
    RAISE EXCEPTION 'wizard_catalog: rank % is not permitted for kind % (item %)',
      v_bad_rank, v_item.kind, p_item_id;
  END IF;

  SELECT count(*) INTO v_cat_count
    FROM public.wizard_catalog_item_categories c WHERE c.catalog_item_id = p_item_id;

  IF v_supports THEN
    -- (3) A category-supporting kind must carry at least one category.
    IF v_cat_count = 0 THEN
      RAISE EXCEPTION 'wizard_catalog: kind % requires at least one category (item %)',
        v_item.kind, p_item_id;
    END IF;

    -- (4) EVERY rank × category pair must exist in central policy, for THIS product_mode.
    --     Evaluated as a full cross-product over the final committed state, so the order in which
    --     ranks and categories were inserted is irrelevant.
    SELECT r.rank AS rank, c.category_id AS category_id
      INTO v_bad_pair
      FROM public.wizard_catalog_item_ranks r
      CROSS JOIN public.wizard_catalog_item_categories c
     WHERE r.catalog_item_id = p_item_id
       AND c.catalog_item_id = p_item_id
       AND NOT EXISTS (
         SELECT 1 FROM public.wizard_rank_category_policy pol
          WHERE pol.product_mode = v_item.product_mode
            AND pol.rank        = r.rank
            AND pol.category_id = c.category_id
       )
     LIMIT 1;
    IF v_bad_pair IS NOT NULL THEN
      RAISE EXCEPTION
        'wizard_catalog: category % is not permitted for rank % in mode % (item %)',
        v_bad_pair.category_id, v_bad_pair.rank, v_item.product_mode, p_item_id;
    END IF;
  ELSE
    -- (5) A kind that does not support categories may carry none (e.g. document-level coupons).
    IF v_cat_count > 0 THEN
      RAISE EXCEPTION 'wizard_catalog: kind % does not support categories (item %)',
        v_item.kind, p_item_id;
    END IF;
  END IF;
END $$;

-- Constraint-trigger shims. Each resolves the affected item and defers to the one validator.
CREATE OR REPLACE FUNCTION public.wiz_validate_item_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.wiz_validate_catalog_item(NEW.id);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.wiz_validate_item_child_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  -- DELETE supplies OLD; INSERT/UPDATE supply NEW. An UPDATE that re-parents a link must
  -- re-validate BOTH the old and the new item.
  IF TG_OP = 'DELETE' THEN
    PERFORM public.wiz_validate_catalog_item(OLD.catalog_item_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.wiz_validate_catalog_item(OLD.catalog_item_id);
    PERFORM public.wiz_validate_catalog_item(NEW.catalog_item_id);
  ELSE
    PERFORM public.wiz_validate_catalog_item(NEW.catalog_item_id);
  END IF;
  RETURN NULL;
END $$;

-- Item: INSERT/UPDATE.
DROP TRIGGER IF EXISTS trg_wci_validate ON public.wizard_catalog_items;
CREATE CONSTRAINT TRIGGER trg_wci_validate
  AFTER INSERT OR UPDATE ON public.wizard_catalog_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.wiz_validate_item_trigger();

-- Ranks: INSERT/UPDATE/DELETE.
DROP TRIGGER IF EXISTS trg_wcir_validate ON public.wizard_catalog_item_ranks;
CREATE CONSTRAINT TRIGGER trg_wcir_validate
  AFTER INSERT OR UPDATE OR DELETE ON public.wizard_catalog_item_ranks
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.wiz_validate_item_child_trigger();

-- Categories: INSERT/UPDATE/DELETE.
DROP TRIGGER IF EXISTS trg_wcic_validate ON public.wizard_catalog_item_categories;
CREATE CONSTRAINT TRIGGER trg_wcic_validate
  AFTER INSERT OR UPDATE OR DELETE ON public.wizard_catalog_item_categories
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.wiz_validate_item_child_trigger();

-- 8e. Policy changes must not strand existing items in an invalid state.
--     Narrowing policy (removing a permitted rank, deleting a rank/category pair) re-validates
--     every affected item and fails if any would become invalid. EXPANDING policy (adding ranks
--     or pairs) re-validates too and simply passes — expansion is always allowed.
CREATE OR REPLACE FUNCTION public.wiz_revalidate_items_for_kind()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT i.id FROM public.wizard_catalog_items i
     WHERE i.product_mode = NEW.product_mode AND i.kind = NEW.kind
  LOOP
    PERFORM public.wiz_validate_catalog_item(v_id);
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.wiz_revalidate_items_for_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_mode text;
  v_id   uuid;
BEGIN
  v_mode := COALESCE(NEW.product_mode, OLD.product_mode);
  FOR v_id IN
    SELECT i.id FROM public.wizard_catalog_items i WHERE i.product_mode = v_mode
  LOOP
    PERFORM public.wiz_validate_catalog_item(v_id);
  END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wkp_revalidate ON public.wizard_kind_policy;
CREATE CONSTRAINT TRIGGER trg_wkp_revalidate
  AFTER UPDATE ON public.wizard_kind_policy
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.wiz_revalidate_items_for_kind();

DROP TRIGGER IF EXISTS trg_wrcp_revalidate ON public.wizard_rank_category_policy;
CREATE CONSTRAINT TRIGGER trg_wrcp_revalidate
  AFTER UPDATE OR DELETE ON public.wizard_rank_category_policy
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.wiz_revalidate_items_for_mode();

-- 8f. Overrides may only NARROW.
CREATE OR REPLACE FUNCTION public.wiz_guard_override()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item public.wizard_catalog_items%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.wizard_catalog_items WHERE id = NEW.catalog_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown catalog item'; END IF;

  -- A globally disabled or retired item can NEVER be re-enabled by a dealer.
  IF NEW.is_enabled IS TRUE AND (v_item.is_active IS NOT TRUE OR v_item.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'a globally inactive or deleted item cannot be re-enabled by a dealer';
  END IF;

  -- A dealer may not price what PricingCatalog owns.
  IF NEW.unit_price IS NOT NULL AND v_item.price_owner = 'pricing_catalog' THEN
    RAISE EXCEPTION 'unit_price is owned by pricing_catalog and cannot be overridden here';
  END IF;

  -- A dealer may only override an item they can actually see: a global row, or their own.
  IF v_item.owner_scope = 'dealer' AND v_item.dealer_id IS DISTINCT FROM NEW.dealer_id THEN
    RAISE EXCEPTION 'cross-dealer override is forbidden';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dwco_guard ON public.dealer_wizard_catalog_overrides;
CREATE TRIGGER trg_dwco_guard
  BEFORE INSERT OR UPDATE ON public.dealer_wizard_catalog_overrides
  FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_override();

-- ── Section 9: RLS ──────────────────────────────────────────────────────────
-- Every table below enables RLS with NO permissive default policy. Absence of a matching
-- policy DENIES. Writes with no policy are service_role only.

ALTER TABLE public.wizard_product_modes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_kind_policy             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_kind_ownership_policy   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_rank_category_policy    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_catalog_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_catalog_item_ranks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_catalog_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_wizard_catalog_overrides ENABLE ROW LEVEL SECURITY;

-- Registry + policy tables: readable by any active member; writes are service_role only.
CREATE POLICY wiz_product_modes_select ON public.wizard_product_modes
  FOR SELECT TO authenticated USING (public.wiz_is_any_active_member());
CREATE POLICY wiz_kind_policy_select ON public.wizard_kind_policy
  FOR SELECT TO authenticated USING (public.wiz_is_any_active_member());
CREATE POLICY wiz_kind_ownership_policy_select ON public.wizard_kind_ownership_policy
  FOR SELECT TO authenticated USING (public.wiz_is_any_active_member());
CREATE POLICY wiz_rank_category_policy_select ON public.wizard_rank_category_policy
  FOR SELECT TO authenticated USING (public.wiz_is_any_active_member());

-- Catalog items — GLOBAL rows: read-only to any active member. No write policy at all.
CREATE POLICY wiz_wci_select_global ON public.wizard_catalog_items
  FOR SELECT TO authenticated
  USING (owner_scope = 'global' AND deleted_at IS NULL AND public.wiz_is_any_active_member());

-- Catalog items — DEALER rows.
CREATE POLICY wiz_wci_select_dealer ON public.wizard_catalog_items
  FOR SELECT TO authenticated
  USING (owner_scope = 'dealer' AND deleted_at IS NULL AND public.wiz_is_active_member(dealer_id));

CREATE POLICY wiz_wci_insert_dealer ON public.wizard_catalog_items
  FOR INSERT TO authenticated
  WITH CHECK (owner_scope = 'dealer' AND dealer_id IS NOT NULL AND public.wiz_can_configure(dealer_id));

CREATE POLICY wiz_wci_update_dealer ON public.wizard_catalog_items
  FOR UPDATE TO authenticated
  USING      (owner_scope = 'dealer' AND public.wiz_can_configure(dealer_id))
  WITH CHECK (owner_scope = 'dealer' AND public.wiz_can_configure(dealer_id));
-- No DELETE policy anywhere: hard deletion is additionally rejected by trg_wci_no_hard_delete.

-- Child tables: reads follow the parent's visibility; writes follow the parent's ownership
-- (global parent ⇒ service_role only, so no policy is granted for global-parent writes).
CREATE POLICY wiz_wcir_select ON public.wizard_catalog_item_ranks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.id = catalog_item_id AND i.deleted_at IS NULL
       AND ((i.owner_scope = 'global' AND public.wiz_is_any_active_member())
         OR (i.owner_scope = 'dealer' AND public.wiz_is_active_member(i.dealer_id)))
  ));
CREATE POLICY wiz_wcir_write ON public.wizard_catalog_item_ranks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.id = catalog_item_id AND i.owner_scope = 'dealer'
       AND public.wiz_can_configure(i.dealer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.id = catalog_item_id AND i.owner_scope = 'dealer'
       AND public.wiz_can_configure(i.dealer_id)
  ));

CREATE POLICY wiz_wcic_select ON public.wizard_catalog_item_categories
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.id = catalog_item_id AND i.deleted_at IS NULL
       AND ((i.owner_scope = 'global' AND public.wiz_is_any_active_member())
         OR (i.owner_scope = 'dealer' AND public.wiz_is_active_member(i.dealer_id)))
  ));
CREATE POLICY wiz_wcic_write ON public.wizard_catalog_item_categories
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.id = catalog_item_id AND i.owner_scope = 'dealer'
       AND public.wiz_can_configure(i.dealer_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wizard_catalog_items i
     WHERE i.id = catalog_item_id AND i.owner_scope = 'dealer'
       AND public.wiz_can_configure(i.dealer_id)
  ));

-- Overrides — SEPARATE policies per command. A single FOR ALL policy would leave the DELETE
-- path guarded only by USING (WITH CHECK does not apply to DELETE), so each is explicit.
CREATE POLICY wiz_dwco_select ON public.dealer_wizard_catalog_overrides
  FOR SELECT TO authenticated USING (public.wiz_is_active_member(dealer_id));
CREATE POLICY wiz_dwco_insert ON public.dealer_wizard_catalog_overrides
  FOR INSERT TO authenticated WITH CHECK (public.wiz_can_configure(dealer_id));
CREATE POLICY wiz_dwco_update ON public.dealer_wizard_catalog_overrides
  FOR UPDATE TO authenticated
  USING      (public.wiz_can_configure(dealer_id))
  WITH CHECK (public.wiz_can_configure(dealer_id));
CREATE POLICY wiz_dwco_delete ON public.dealer_wizard_catalog_overrides
  FOR DELETE TO authenticated USING (public.wiz_can_configure(dealer_id));

-- ── Section 10: grants ──────────────────────────────────────────────────────
GRANT SELECT ON public.wizard_product_modes,
                public.wizard_kind_policy,
                public.wizard_kind_ownership_policy,
                public.wizard_rank_category_policy,
                public.wizard_catalog_items,
                public.wizard_catalog_item_ranks,
                public.wizard_catalog_item_categories
  TO authenticated;

GRANT INSERT, UPDATE ON public.wizard_catalog_items,
                        public.wizard_catalog_item_ranks,
                        public.wizard_catalog_item_categories
  TO authenticated;   -- still gated by RLS (dealer-owned rows only) and by the policy FK.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_wizard_catalog_overrides TO authenticated;

-- No DELETE grant on wizard_catalog_items: soft delete only.

-- ── Section 11: function execution privileges (C1H) ─────────────────────────
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoke that everywhere,
-- then grant back only what is actually required.
--
-- • RLS helpers are referenced INSIDE policy expressions, which are evaluated as the querying
--   role — so `authenticated` genuinely needs EXECUTE on them. They are SECURITY DEFINER
--   (Phase C1V-H2) and leak nothing: they return only a boolean, and for `anon` auth.uid() is
--   NULL so every one returns false.
--
--   WHY DEFINER, PROVEN EMPIRICALLY: `authenticated` holds NO SELECT privilege on
--   `dealer_members` or `dealers`. PostgreSQL does not permission-check tables referenced
--   DIRECTLY inside an RLS policy expression (which is why migration 004's inline subqueries
--   work), but a SECURITY INVOKER *function* called from a policy runs with the CALLER's
--   privileges and is denied — `ERROR: permission denied for table dealer_members` (42501).
--   Under invoker rights every catalog RLS policy errored out and every dealer write failed.
--   DEFINER removes that dependency entirely. Every function pins search_path, so the definer
--   context cannot be redirected.
--
-- • Trigger functions are NOT granted to anyone. PostgreSQL does not check EXECUTE privilege
--   when firing a trigger, so revoking PUBLIC does not disable them — it only stops an ordinary
--   session from calling them directly. `wiz_validate_catalog_item` is likewise ungranted: it is
--   called only from SECURITY DEFINER trigger functions, whose definer (the migration owner)
--   already holds EXECUTE.

REVOKE ALL ON FUNCTION public.wiz_is_any_active_member()            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_is_active_member(uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_can_configure(uuid)               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_validate_catalog_item(uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_validate_item_trigger()           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_validate_item_child_trigger()     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_revalidate_items_for_kind()       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_revalidate_items_for_mode()       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_guard_dealers_product_mode()      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_guard_catalog_item_immutable()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_guard_catalog_item()              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_reject_hard_delete()              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wiz_guard_override()                  FROM PUBLIC;

-- The ONLY functions an ordinary session may call: the three RLS helpers.
GRANT EXECUTE ON FUNCTION public.wiz_is_any_active_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wiz_is_active_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wiz_can_configure(uuid)    TO authenticated, service_role;
