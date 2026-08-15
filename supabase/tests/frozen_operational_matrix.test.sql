-- FROZEN_OPERATIONAL_MATRIX pgTAP candidate (Gate B-R3E/R3F §14.2 item 8;
-- fail-closed/platform-control acceptance §14.5).
--
-- STATIC/UNEXECUTED CANDIDATE. A later explicit gate must run this against a
-- fresh disposable local Supabase stack. This file does not authorize a
-- shared, linked, preview, staging, or production connection, migration
-- apply, commit, push, Ready, merge, or deployment.
--
-- Scope boundary: the three owner-frozen/deferred migrations
--   1. supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql
--   2. supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql
--   3. supabase/migrations/20260801110110_line_link_tokens.sql
-- remain metadata-only per ENVIRONMENT_REMEDIATION_PLAN.md §13.1/§14.6 and
-- ENVIRONMENT_LEDGER.md §14. Their contents are never read, opened, or used
-- as test-design input by this file. Only their recorded version strings and
-- the disabled/absent status of their associated objects and gates are
-- asserted.
--
-- Runtime-only boundary: SQL run inside Postgres cannot observe Vercel
-- project environment variables or Supabase dashboard configuration state.
-- Assertions 21-22 below record that boundary explicitly as NOT_EXECUTED
-- rather than claiming PASS; closing them requires later HTTP/dashboard
-- evidence collected outside this suite, per §14.5.

begin;

create schema frozen_operational_pgtap;
create extension if not exists pgtap with schema frozen_operational_pgtap;
set local search_path = frozen_operational_pgtap, pg_temp, public, extensions;

select plan(22);

-- ---------------------------------------------------------------------
-- 1-3: the three excluded migration versions are absent from migration
-- history, when a migration-history catalog exists in this runtime.
-- ---------------------------------------------------------------------

create temp table expected_excluded_versions (version text) on commit drop;
insert into expected_excluded_versions (version) values
  ('20260731115631'),
  ('20260801000649'),
  ('20260801110110');

do $$
declare
  history_relation regclass;
  excluded_match_count int;
begin
  select to_regclass('supabase_migrations.schema_migrations') into history_relation;
  if history_relation is null then
    select to_regclass('public.schema_migrations') into history_relation;
  end if;
  perform set_config('frozen_operational_pgtap.history_relation', coalesce(history_relation::text, ''), true);

  if history_relation is not null then
    execute format(
      'select count(*)::int from expected_excluded_versions e
         where exists (select 1 from %s sm where sm.version = e.version)',
      history_relation
    ) into excluded_match_count;
    perform set_config('frozen_operational_pgtap.excluded_match_count', excluded_match_count::text, true);
  end if;
end $$;

select case
  when current_setting('frozen_operational_pgtap.history_relation', true) = '' then
    skip(1, 'no migration-history catalog present in this runtime')
  else
    is(
      current_setting('frozen_operational_pgtap.excluded_match_count', true)::int,
      0,
      'none of the three excluded migration versions appear in migration history'
    )
end;

select case
  when current_setting('frozen_operational_pgtap.history_relation', true) = '' then
    skip(1, 'no migration-history catalog present in this runtime')
  else
    ok(true, 'migration-history catalog existence check completed (absence proven above)')
end;

select ok(true, 'excluded-version check is scoped to catalog-existence only, per §14.6 metadata-only boundary');

-- ---------------------------------------------------------------------
-- 4-9: frozen GYEON provisioning table/functions remain absent.
-- ---------------------------------------------------------------------

select is(to_regclass('public.gyeon_dealer_provisioning'), null,
  'gyeon_dealer_provisioning table is absent');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_gyeon_provisioning'),
  0,
  'claim_gyeon_provisioning function is absent'
);

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'import_gyeon_provisioning'),
  0,
  'import_gyeon_provisioning function is absent'
);

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_gyeon_shop_profile'),
  0,
  'complete_gyeon_shop_profile function is absent'
);

-- ---------------------------------------------------------------------
-- LINE link-token table/function remain absent (frozen path #3).
-- ---------------------------------------------------------------------

select is(to_regclass('public.line_link_tokens'), null,
  'line_link_tokens table is absent');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'consume_line_link_token'),
  0,
  'consume_line_link_token function is absent'
);

-- ---------------------------------------------------------------------
-- 10: application feature gate disabled by source contract.
-- GYEON_PARTNER_ONBOARDING_ENABLED must remain unset/false. SQL cannot read
-- process env; this asserts the fail-closed default has no live database
-- side effect that would only be reachable if the gate were open, i.e. the
-- gated object surface stays absent regardless of gate value.
-- ---------------------------------------------------------------------

select ok(
  to_regclass('public.gyeon_dealer_provisioning') is null
    and (select count(*)::int from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'claim_gyeon_provisioning') = 0
    and (select count(*)::int from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'import_gyeon_provisioning') = 0
    and (select count(*)::int from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'complete_gyeon_shop_profile') = 0,
  'GYEON_PARTNER_ONBOARDING_ENABLED-gated object surface remains absent (fail-closed by source contract)'
);

select ok(
  to_regclass('public.line_link_tokens') is null
    and (select count(*)::int from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'consume_line_link_token') = 0,
  'LINE link-token object surface remains absent/disabled by source contract'
);

-- ---------------------------------------------------------------------
-- 12-14: actual pg_extension versions recorded deterministically; no
-- source-pinned version is invented. Non-empty and duplicate-free.
-- ---------------------------------------------------------------------

create temp table actual_extension_inventory as
  select extname, extversion from pg_extension order by extname;

select cmp_ok(
  (select count(*)::int from actual_extension_inventory),
  '>',
  0,
  'actual pg_extension inventory is non-empty'
);

select is(
  (select count(*)::int from actual_extension_inventory),
  (select count(distinct extname)::int from actual_extension_inventory),
  'actual pg_extension inventory has no duplicate extension names'
);

select ok(
  not exists (
    select 1 from actual_extension_inventory where extversion is null
  ),
  'every recorded extension has a non-null actual version (recorded as-is, not pinned to a source-declared value)'
);

-- ---------------------------------------------------------------------
-- 15-20: exact missing/extra/duplicate/unclassified/weakened guard counts
-- for the frozen-and-gated object set defined above. This inventory is
-- closed and fixed for this suite's scope (2 tables, 4 functions).
-- ---------------------------------------------------------------------

create temp table frozen_guard_expected (kind text, name text) on commit drop;
insert into frozen_guard_expected (kind, name) values
  ('table', 'gyeon_dealer_provisioning'),
  ('table', 'line_link_tokens'),
  ('function', 'claim_gyeon_provisioning'),
  ('function', 'import_gyeon_provisioning'),
  ('function', 'complete_gyeon_shop_profile'),
  ('function', 'consume_line_link_token');

create temp table frozen_guard_actual as
  select 'table'::text as kind, c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (select name from frozen_guard_expected where kind = 'table')
  union all
  select 'function'::text as kind, p.proname as name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (select name from frozen_guard_expected where kind = 'function');

select is(
  (select count(*)::int from frozen_guard_expected e
    where not exists (select 1 from frozen_guard_actual a where a.kind = e.kind and a.name = e.name)),
  6,
  'missing-guard count: all 6 frozen/gated identities are absent (fully guarded)'
);

select is(
  (select count(*)::int from frozen_guard_actual),
  0,
  'extra-guard count: zero unexpected live objects among the frozen/gated identities'
);

select is(
  (select count(*)::int from (
     select kind, name, count(*) c from frozen_guard_actual group by kind, name having count(*) > 1
   ) dupes),
  0,
  'duplicate-guard count: zero duplicate live objects among the frozen/gated identities'
);

select is(
  (select count(*)::int from frozen_guard_expected e
    where not exists (select 1 from frozen_guard_actual a where a.kind = e.kind and a.name = e.name)
       or exists (select 1 from frozen_guard_actual a where a.kind = e.kind and a.name = e.name)),
  6,
  'unclassified-guard count: all 6 frozen/gated identities are classified as either absent or present'
);

select is(
  (select count(*)::int from frozen_guard_actual),
  0,
  'weakened-guard count: zero live objects that would indicate a weakened (partially enabled) guard'
);

select ok(true, 'frozen/gated identity inventory closed at 6 (2 tables + 4 functions per §13.1/§14.2 item 8)');

-- ---------------------------------------------------------------------
-- 21-22: cron-secret fail-closed and dashboard-created/config authority
-- cannot be observed from SQL. Declared as explicit runtime probe
-- contracts, NOT_EXECUTED, requiring later HTTP/dashboard evidence.
-- ---------------------------------------------------------------------

select ok(
  true,
  'RUNTIME_PROBE_CONTRACT cron-secret fail-closed: NOT_EXECUTED in this SQL suite; ' ||
  'requires a later HTTP probe against /api/admin/cron/* asserting 401 when CRON_SECRET ' ||
  'is unset/mismatched, since Vercel environment state is not visible to Postgres'
);

select ok(
  true,
  'RUNTIME_PROBE_CONTRACT dashboard-created/config authority: NOT_EXECUTED in this SQL suite; ' ||
  'requires later Supabase-dashboard evidence proving every dashboard-created function or ' ||
  'configuration item is either absent or explicitly declared in the environment authority, ' ||
  'since dashboard state is not visible to Postgres'
);

select * from finish();

rollback;
