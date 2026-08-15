-- =============================================================================
-- B2-E2G — Dealer service-offering model (five managed families).
--
-- Replaces rank as the authority over WHICH services a dealer offers. Rank never
-- decides eligibility for these five families; an explicit, dealer-owned opt-in
-- does, and it defaults to OFF.
--
-- Forward-only. No existing migration is edited. Supersedes the retired
-- window-film-only candidate, whose window_area rank work is folded into §6 here
-- and completed for the PPF families it omitted.
--
-- Families: window_film, ppf, maintenance, room_cleaning, car_wash.
-- coating and other_work are deliberately OUT of this model and unchanged.
--
-- ── SECTION ORDER IS LOAD-BEARING ───────────────────────────────────────────
--   §1 vocabulary → §2 offering table → §3 compatibility backfill
--   → §4 narrow revision bump → §5 catalog permission policy → §6 rank completion
--   → §7 invalidation trigger
--
-- §5 MUST precede §6. The rank rows §6 adds are validated against the central kind and
-- rank/category policy by a deferred constraint trigger, so the policy has to permit them or the
-- entire migration rolls back at COMMIT.
--
-- §7 MUST be last. The trigger bumps the configuration revision, and
-- wiz_bump_dealer_revision resets the row to MIGRATED_UNREVIEWED and clears every
-- review field. If it existed during §3, the compatibility backfill would
-- invalidate the review of precisely the dealers the backfill exists to protect —
-- everyone already selling a service would be knocked out of their reviewed state
-- and blocked from estimating until they re-reviewed. Backfilling first means §3
-- performs ZERO bumps, while every real offering change afterwards bumps exactly
-- once.
-- =============================================================================


-- ── §1: system-owned family vocabulary ──────────────────────────────────────
-- A reference table rather than a CHECK constraint: adding a sixth family later is
-- one INSERT, with no DDL, no constraint edit and no redesign.
CREATE TABLE IF NOT EXISTS public.service_families (
  family        text        PRIMARY KEY,
  label_ja      text        NOT NULL,
  display_order integer     NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.service_families (family, label_ja, display_order) VALUES
  ('window_film',   'ウィンドウフィルム',     1),
  ('ppf',           'PPF',                   2),
  ('maintenance',   'ボディ定期メンテナンス', 3),
  ('car_wash',      'メンテナンス洗車',       4),
  ('room_cleaning', 'ルームクリーニング',     5)
ON CONFLICT (family) DO NOTHING;


-- ── §2: the dealer-owned offering table ─────────────────────────────────────
-- ABSENCE OF A ROW MEANS OFF. A newly created dealer therefore starts opted out of
-- every family with no seeding required, and no per-dealer backfill is needed to
-- honour the default.
CREATE TABLE IF NOT EXISTS public.dealer_service_offerings (
  dealer_id  uuid        NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  family     text        NOT NULL REFERENCES public.service_families(family),
  enabled    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dealer_id, family)
);

CREATE INDEX IF NOT EXISTS dealer_service_offerings_dealer_idx
  ON public.dealer_service_offerings (dealer_id);

-- Reuse the established shared updated_at trigger, as 106 does.
DROP TRIGGER IF EXISTS trg_dso_updated_at ON public.dealer_service_offerings;
CREATE TRIGGER trg_dso_updated_at
  BEFORE UPDATE ON public.dealer_service_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants + RLS mirror the canonical dealer-settings path exactly: the dealer-facing
-- write goes through the user-scoped authenticated client under RLS, never
-- service_role and never raw SQL from the app.
REVOKE ALL PRIVILEGES ON TABLE public.service_families         FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.dealer_service_offerings FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT                         ON TABLE public.service_families          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_families          TO service_role;
-- No DELETE for authenticated. The UI turns a family OFF by writing enabled = false, so the
-- privilege has no legitimate caller; withholding it means the missing DELETE policy is not the
-- only thing standing between an operator and a removed row.
GRANT SELECT, INSERT, UPDATE         ON TABLE public.dealer_service_offerings  TO authenticated;
REVOKE DELETE                        ON TABLE public.dealer_service_offerings  FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dealer_service_offerings  TO service_role;

ALTER TABLE public.service_families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sf_read_all ON public.service_families;
CREATE POLICY sf_read_all ON public.service_families
  FOR SELECT TO authenticated
  USING (true);   -- system-owned vocabulary; contains no tenant data

ALTER TABLE public.dealer_service_offerings ENABLE ROW LEVEL SECURITY;

-- Tenant isolation and write authority use the SAME canonical helpers as every other
-- dealer-settings table (cf. the dealer_wizard_catalog_overrides policies in 103):
--
--   READ  — public.wiz_is_active_member(dealer_id): any active member of THIS dealer.
--           Staff need to see which families their store sells; that is not a configuration act.
--   WRITE — public.wiz_can_configure(dealer_id): active owner/manager of THIS dealer, or the
--           dealer's own owner_user_id. Membership alone is NOT sufficient. An offering change
--           invalidates the dealer's entire catalog review (§7), so allowing staff or readonly
--           members to flip a family would let a non-configurer knock the whole store out of its
--           reviewed state and block estimating.
--
-- A hand-rolled `dealer_id IN (SELECT ... FROM dealer_members ...)` predicate is deliberately NOT
-- used: it cannot express the role rule, and duplicating tenancy logic is how the two drift apart.
--
-- No DELETE policy: the UI turns a family OFF by writing enabled = false, never by removing the
-- row, so an explicit choice is always persisted rather than inferred. The DELETE privilege is
-- withheld above as well, so the absent policy is not the only barrier.
DROP POLICY IF EXISTS dso_tenant_select ON public.dealer_service_offerings;
CREATE POLICY dso_tenant_select ON public.dealer_service_offerings
  FOR SELECT TO authenticated
  USING (public.wiz_is_active_member(dealer_id));

DROP POLICY IF EXISTS dso_tenant_insert ON public.dealer_service_offerings;
CREATE POLICY dso_tenant_insert ON public.dealer_service_offerings
  FOR INSERT TO authenticated
  WITH CHECK (public.wiz_can_configure(dealer_id));

-- Both sides guarded: USING decides which existing rows may be updated, WITH CHECK decides what
-- the updated row may become. Guarding only USING would let a configurer rewrite a row's
-- dealer_id into another tenant.
DROP POLICY IF EXISTS dso_tenant_update ON public.dealer_service_offerings;
CREATE POLICY dso_tenant_update ON public.dealer_service_offerings
  FOR UPDATE TO authenticated
  USING      (public.wiz_can_configure(dealer_id))
  WITH CHECK (public.wiz_can_configure(dealer_id));


-- ── §3: deterministic compatibility backfill (MUST precede §7) ──────────────
-- A dealer keeps selling what it already sells. Evidence is dealer-OWNED, ACTIVE,
-- non-deleted catalog data only — nothing is inferred, defaulted or invented.
--
--   window_film   ← ≥1 dealer film_type
--   maintenance   ← ≥1 dealer maintenance_menu
--   car_wash      ← ≥1 dealer wash_menu
--   room_cleaning ← ≥1 dealer room_cleaning_menu
--
-- PPF is deliberately ABSENT: every PPF prerequisite is a GLOBAL row, so no
-- dealer-owned artifact can evidence that a dealer sells PPF. Per the fixed
-- decision, PPF is OFF for all existing dealers and must be opted into explicitly.
--
-- Set-based, clock-free and order-independent; emits ZERO revision bumps because
-- §7 does not exist yet.
INSERT INTO public.dealer_service_offerings (dealer_id, family, enabled)
SELECT DISTINCT i.dealer_id,
       CASE i.kind
         WHEN 'film_type'          THEN 'window_film'
         WHEN 'maintenance_menu'   THEN 'maintenance'
         WHEN 'wash_menu'          THEN 'car_wash'
         WHEN 'room_cleaning_menu' THEN 'room_cleaning'
       END AS family,
       true
  FROM public.wizard_catalog_items i
 WHERE i.owner_scope = 'dealer'
   AND i.dealer_id IS NOT NULL
   AND i.is_active
   AND i.deleted_at IS NULL
   AND i.kind IN ('film_type', 'maintenance_menu', 'wash_menu', 'room_cleaning_menu')
ON CONFLICT (dealer_id, family) DO NOTHING;


-- ── §4: narrow, deduplicated one-time revision bump ─────────────────────────
-- §6 widens which GLOBAL rows a rank can resolve, which changes what those dealers
-- may offer while their review still attests to the old configuration. There is no
-- revision trigger on wizard_catalog_item_ranks, so the bump must be explicit.
--
-- Deliberately narrow — bump only where the change is BOTH relevant and visible:
--   • PPF prerequisites gain rank 'shop'           → shop dealers, ppf enabled
--   • window_area gains 'shop' + 'ppf_installer'   → those ranks, window_film enabled
--
-- Opted-out dealers see no difference and are never bumped; detailer and certified
-- dealers already had every one of these rank rows. UNION de-duplicates, so a
-- dealer qualifying under both branches is bumped EXACTLY ONCE.
--
-- Runs before §5, §6 and §7 deliberately: the set is derived from offering state, not
-- from the rank rows or the policy widening, so ordering cannot change the result, and
-- keeping it ahead of §7 preserves the "no invalidation trigger yet" guarantee end to end.
--
-- NOTE: after §3, PPF is disabled for every existing dealer, so the first branch
-- selects nothing today. It is retained because it states the rule correctly for
-- any environment where PPF was already enabled before this migration ran.
SELECT public.wiz_bump_dealer_revision(t.dealer_id)
FROM (
  SELECT d.id AS dealer_id
    FROM public.dealers d
    JOIN public.dealer_service_offerings o
      ON o.dealer_id = d.id AND o.family = 'ppf' AND o.enabled
   WHERE d.detailer_rank IN ('shop', 'gyeon_shop')
  UNION
  SELECT d.id
    FROM public.dealers d
    JOIN public.dealer_service_offerings o
      ON o.dealer_id = d.id AND o.family = 'window_film' AND o.enabled
   WHERE d.detailer_rank IN ('shop', 'ppf_installer', 'gyeon_shop', 'gyeon_ppf_installer')
) AS t;


-- ── §5: central catalog permission policy (MUST precede the §6 rank inserts) ─
-- wizard_kind_policy and wizard_rank_category_policy are the CENTRAL authority that
-- wiz_validate_catalog_item enforces, via the deferred constraint trigger on
-- wizard_catalog_item_ranks. As seeded, that policy permits window_area only for
-- {detailer, certified} and the three PPF kinds only for {detailer, ppf_installer, certified},
-- which is precisely what §6 widens. Without this section every §6 row is rejected at COMMIT with
--   'wizard_catalog: rank shop is not permitted for kind window_area'
-- and the whole migration rolls back. Verified empirically on a fresh PostgreSQL 17 database.
--
-- Two independent gates must both be opened, because the validator checks the kind's permitted
-- ranks AND then every rank x category pair the item carries:
--   (1) permitted_ranks per kind          — window_area is a 'window' item, the PPF kinds are 'ppf'
--   (2) rank -> category pairs            — shop had neither 'window' nor 'ppf'; ppf_installer had
--                                           no 'window'
--
-- film_type is widened for the SAME two ranks even though §6 adds no rows for it, because it is
-- DEALER-AUTHORED rather than global. Rank no longer decides who may sell window film — the
-- dealer's own window_film opt-in does — so a shop or ppf_installer dealer that enables the family
-- must also be able to author the film types it sells. Widening only window_area would leave those
-- dealers with the glass areas but no product to apply to them: a family they can switch on and
-- then cannot use. detailer and certified are already present and are preserved by the merge.
--
-- Both are ADDITIVE and IDEMPOTENT. Existing permitted ranks are merged, never overwritten, so
-- unrelated permissions survive untouched; the DISTINCT + array_agg pair cannot produce a
-- duplicate entry; and the IS DISTINCT FROM guard makes a replay a genuine no-op, which also keeps
-- the policy revalidation trigger from re-running for nothing. Scoped to product_mode 'gyeon',
-- the only mode these kinds are seeded for ('generic' has no policy rows and is runtime-disabled).
UPDATE public.wizard_kind_policy p
   SET permitted_ranks = w.merged
  FROM (
    SELECT k.kind,
           (SELECT array_agg(DISTINCT r ORDER BY r)
              FROM unnest(cur.permitted_ranks || k.add_ranks) AS r) AS merged
      FROM (VALUES
              ('window_area',    ARRAY['shop', 'ppf_installer']::text[]),
              ('film_type',      ARRAY['shop', 'ppf_installer']::text[]),
              ('ppf_method',     ARRAY['shop']::text[]),
              ('ppf_part',       ARRAY['shop']::text[]),
              ('ppf_type_group', ARRAY['shop']::text[])
           ) AS k(kind, add_ranks)
      JOIN public.wizard_kind_policy cur
        ON cur.product_mode = 'gyeon' AND cur.kind = k.kind
  ) AS w
 WHERE p.product_mode = 'gyeon'
   AND p.kind         = w.kind
   AND p.permitted_ranks IS DISTINCT FROM w.merged;

-- Exactly the three missing pairs — nothing else in the 24-row C2B1A matrix is touched.
INSERT INTO public.wizard_rank_category_policy (product_mode, rank, category_id) VALUES
  ('gyeon', 'shop',          'window'),
  ('gyeon', 'shop',          'ppf'),
  ('gyeon', 'ppf_installer', 'window')
ON CONFLICT (product_mode, rank, category_id) DO NOTHING;


-- ── §6: global prerequisite completion for ALL FOUR ranks (46 rows) ─────────
-- buildConfigs rank-filters GLOBAL rows as well as dealer rows, so without these a
-- dealer could opt in and still resolve zero prerequisites — an unfixable
-- setup-required state, since none of these rows is dealer-authorable.
--
--   window_area    (7)  += shop, ppf_installer      → 14
--   ppf_method     (5)  += shop                     →  5
--   ppf_part      (16)  += shop                     → 16
--   ppf_type_group(11)  += shop                     → 11
--                                                     ── 46 total
--
-- Additive only; existing rank rows are never removed or modified. ON CONFLICT
-- makes a replay a no-op. wizard_catalog_item_ranks already CHECKs the vocabulary.
INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
SELECT i.id, r.rank
  FROM public.wizard_catalog_items i
 CROSS JOIN (VALUES ('shop'), ('ppf_installer')) AS r(rank)
 WHERE i.kind = 'window_area'
   AND i.owner_scope = 'global' AND i.dealer_id IS NULL
   AND i.is_active AND i.deleted_at IS NULL
ON CONFLICT (catalog_item_id, rank) DO NOTHING;

INSERT INTO public.wizard_catalog_item_ranks (catalog_item_id, rank)
SELECT i.id, 'shop'
  FROM public.wizard_catalog_items i
 WHERE i.kind IN ('ppf_method', 'ppf_part', 'ppf_type_group')
   AND i.owner_scope = 'global' AND i.dealer_id IS NULL
   AND i.is_active AND i.deleted_at IS NULL
ON CONFLICT (catalog_item_id, rank) DO NOTHING;


-- ── §7: offering changes invalidate the dealer's catalog review (LAST) ──────
-- The catalog review is PER DEALER, so any real offering change invalidates the
-- whole review — that is the reviewed scope, not an approximation of it.
--
-- Exactly once per real mutation:
--   INSERT → always (a row only appears when the dealer states a choice)
--   UPDATE → only when `enabled` actually changed (IS DISTINCT FROM), so a no-op
--            save or an updated_at touch does not invalidate a review
--   DELETE → always (removing a row reverts that family to OFF)
CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_offering_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.wiz_bump_dealer_revision(OLD.dealer_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.wiz_bump_dealer_revision(NEW.dealer_id);
  ELSIF NEW.enabled IS DISTINCT FROM OLD.enabled THEN
    PERFORM public.wiz_bump_dealer_revision(NEW.dealer_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_dso_wiz_invalidate ON public.dealer_service_offerings;
CREATE TRIGGER trg_dso_wiz_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON public.dealer_service_offerings
  FOR EACH ROW EXECUTE FUNCTION public.wiz_invalidate_on_offering_change();
