-- 20260727112326 — B2-D.3: durable customer match keys for the Screen 1 duplicate warning.
--
-- FORWARD-ONLY. No existing migration is edited. This migration ADDS three STORED generated columns
-- and two partial indexes to public.customers. It performs no DML, no backfill, no policy change and
-- no change to any existing column: generated columns are computed for every existing row by the
-- ALTER itself, so historical rows are represented automatically.
--
-- ── WHY GENERATED COLUMNS RATHER THAN A CLIENT-SIDE SCAN ────────────────────────
-- The pre-existing helper (src/lib/customers/find-customer-duplicates.ts) fetches at most 200 rows
-- and normalises phone numbers in JavaScript. Above 200 customers for a dealer it simply stops
-- finding matches — no error, no truncation flag. A duplicate warning that quietly degrades as a
-- dealer grows is worse than none, because staff come to trust it. Exact matching therefore has to
-- happen IN the database, on an indexed expression, with no row window at all.
--
-- ── WHY GENERATED COLUMNS RATHER THAN EXPRESSION INDEXES ────────────────────────
-- The same normalisation must be applied to the QUERY value as to the stored value. An expression
-- index would leave that expression duplicated between this migration and TypeScript, and a silent
-- divergence between the two is exactly the class of defect that produced the canonical/legacy
-- column split repaired in 20260727033223. A stored column names the contract once; the TypeScript
-- side mirrors it and a shared fixture table (src/lib/customers/duplicate-match-fixtures.ts) asserts
-- the two agree.
--
-- ── NFKC ────────────────────────────────────────────────────────────────────────
-- `normalize(text, NFKC)` is IMMUTABLE and is the single operation that makes both required
-- equivalences hold, rather than a hand-rolled character map:
--     full-width digits   ０９０１２３４５６７８  →  09012345678
--     full-width hyphens  ０９０－１２３４       →  090-1234
--     half-width kana     ﾔﾏﾀﾞﾀﾛｳ              →  ヤマダタロウ   (dakuten recomposed)
--     ideographic space   U+3000                →  U+0020        (then stripped as whitespace)
-- Every function used below — normalize, regexp_replace, btrim, length, coalesce, nullif — is
-- IMMUTABLE, which a STORED generated column requires.
--
-- ── PHONE: 10 OR 11 DIGITS, ELSE NULL ───────────────────────────────────────────
-- A stored fragment such as "03" must never match a typed "03". Constraining the key itself to 10 or
-- 11 digits makes an out-of-range value NULL, and NULL never equals anything — so the rule cannot be
-- forgotten on the query side. The TypeScript core applies the identical length rule, so a too-short
-- input produces no phone key and the phone branch is simply not issued.
--
-- ── NAME / KANA: CANONICAL FIRST, LEGACY FALLBACK ───────────────────────────────
-- Migration 035 introduced last_name/first_name/last_name_kana/first_name_kana and back-filled them
-- once from the legacy name/kana columns; 20260727033223 made the wizard write both sets. Rows
-- created by the wizard BEFORE that fix carry only the legacy columns. The coalesce chain below
-- matches both generations without any backfill, which is why this migration contains no DML.
--
-- ── NO POLICY, NO RLS, NO CONSTRAINT ────────────────────────────────────────────
-- Adding columns does not change row visibility: the existing dealer_members-scoped SaaS policies
-- continue to govern every read. No UNIQUE constraint is added — duplicate detection here is
-- ADVISORY, and a unique index would convert a warning into a hard registration block, which the
-- product decision explicitly forbids.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS match_phone_digits text
    GENERATED ALWAYS AS (
      CASE
        WHEN length(regexp_replace(normalize(coalesce(phone, ''), NFKC), '[^0-9]', '', 'g')) IN (10, 11)
        THEN regexp_replace(normalize(coalesce(phone, ''), NFKC), '[^0-9]', '', 'g')
        ELSE NULL
      END
    ) STORED,

  ADD COLUMN IF NOT EXISTS match_name_norm text
    GENERATED ALWAYS AS (
      nullif(
        regexp_replace(
          normalize(
            coalesce(
              nullif(btrim(coalesce(last_name, '') || coalesce(first_name, '')), ''),
              coalesce(name, '')
            ),
            NFKC
          ),
          '\s+', '', 'g'
        ),
        ''
      )
    ) STORED,

  ADD COLUMN IF NOT EXISTS match_kana_norm text
    GENERATED ALWAYS AS (
      nullif(
        regexp_replace(
          normalize(
            coalesce(
              nullif(btrim(coalesce(last_name_kana, '') || coalesce(first_name_kana, '')), ''),
              coalesce(kana, '')
            ),
            NFKC
          ),
          '\s+', '', 'g'
        ),
        ''
      )
    ) STORED;

-- Partial indexes: soft-deleted customers are never candidates, so they are excluded from the index
-- as well as from the query. Both are (dealer_id, key…) so the tenant predicate and the equality
-- predicate are satisfied by one index scan.
CREATE INDEX IF NOT EXISTS customers_match_phone_idx
  ON public.customers (dealer_id, match_phone_digits)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customers_match_name_kana_idx
  ON public.customers (dealer_id, match_name_norm, match_kana_norm)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- Rollback note (manual, never automatic)
-- =============================================================================
--   DROP INDEX IF EXISTS public.customers_match_name_kana_idx;
--   DROP INDEX IF EXISTS public.customers_match_phone_idx;
--   ALTER TABLE public.customers
--     DROP COLUMN IF EXISTS match_kana_norm,
--     DROP COLUMN IF EXISTS match_name_norm,
--     DROP COLUMN IF EXISTS match_phone_digits;
--   No customer data is lost: these columns are derived, hold no independent value, and are
--   recomputed in full if the migration is re-applied.
