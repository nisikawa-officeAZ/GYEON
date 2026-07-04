-- =============================================================================
-- AI Center — COMPLETE one-paste setup + verification
-- File: DEV_PREVIEW_ai_setup_and_verify.sql
-- =============================================================================
-- Combines migrations 094 + 095 (+ 096 response_ms column) into ONE idempotent
-- script: tables, indexes, RLS, policies, grants, updated_at trigger, verify.
--
-- ⚠️ APPLY IN THE SQL EDITOR OF THE CONNECTED PROJECT:  fbieiotihlmpfzybowbt
--    (Verify the dashboard URL/ref matches before running.)
--
-- Manual apply only — this is never executed by the application.
-- Canonical migrations remain:
--   supabase/migrations/094_gyeon_ai_settings.sql
--   supabase/migrations/095_gyeon_ai_usage_log.sql
--   supabase/migrations/096_dev_diagnostics.sql
-- =============================================================================

-- ── Table: gyeon_ai_settings (094) — encrypted platform OpenAI key ────────────
create table if not exists public.gyeon_ai_settings (
  id                       integer primary key default 1,
  openai_api_key_encrypted text,
  last_tested_at           timestamptz,
  last_test_status         text check (last_test_status in ('success', 'failed')),
  updated_by               uuid,
  updated_at               timestamptz not null default now(),
  constraint gyeon_ai_settings_singleton check (id = 1)
);

-- ── Table: gyeon_ai_usage_log (095 + 096 response_ms) ─────────────────────────
create table if not exists public.gyeon_ai_usage_log (
  id             uuid primary key default gen_random_uuid(),
  feature_key    text not null,
  dealer_id      uuid,
  used_by        uuid,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  total_tokens   integer,
  estimated_cost numeric,
  response_ms    integer,
  status         text not null check (status in ('success', 'failed')),
  error_code     text,
  created_at     timestamptz not null default now()
);
-- (096) ensure response_ms exists even if the table pre-existed without it
alter table public.gyeon_ai_usage_log add column if not exists response_ms integer;

-- ── Indexes ────────────────────────────────────────────────────────────────────
create index if not exists gyeon_ai_usage_log_feature_created_idx
  on public.gyeon_ai_usage_log (feature_key, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────────
alter table public.gyeon_ai_settings  enable row level security;
alter table public.gyeon_ai_usage_log enable row level security;

-- ── Grants — service-role only; explicitly deny anon/authenticated ────────────
-- These tables hold the encrypted platform key and platform-wide usage; only the
-- server-side service-role client may touch them.
revoke all on public.gyeon_ai_settings  from anon, authenticated;
revoke all on public.gyeon_ai_usage_log from anon, authenticated;
grant  all on public.gyeon_ai_settings  to service_role;
grant  all on public.gyeon_ai_usage_log to service_role;

-- ── Policies ──────────────────────────────────────────────────────────────────
-- Access is exclusively via the service-role client (which bypasses RLS). We add
-- an explicit service_role policy for intent, and INTENTIONALLY add NO
-- anon/authenticated policy → those roles remain denied by default (deny-by-default).
-- Do NOT add a permissive anon/authenticated policy: it would expose the encrypted key.
drop policy if exists gyeon_ai_settings_service_role on public.gyeon_ai_settings;
create policy gyeon_ai_settings_service_role on public.gyeon_ai_settings
  for all to service_role using (true) with check (true);

drop policy if exists gyeon_ai_usage_log_service_role on public.gyeon_ai_usage_log;
create policy gyeon_ai_usage_log_service_role on public.gyeon_ai_usage_log
  for all to service_role using (true) with check (true);

-- ── updated_at trigger (gyeon_ai_settings) ────────────────────────────────────
create or replace function public.update_gyeon_ai_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gyeon_ai_settings_updated_at on public.gyeon_ai_settings;
create trigger gyeon_ai_settings_updated_at
  before update on public.gyeon_ai_settings
  for each row execute function public.update_gyeon_ai_updated_at();

-- ── Reload PostgREST schema cache immediately (fixes PGRST205) ────────────────
notify pgrst, 'reload schema';

-- ── VERIFICATION ──────────────────────────────────────────────────────────────
-- (1) Expect 2 rows: gyeon_ai_settings, gyeon_ai_usage_log
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('gyeon_ai_settings', 'gyeon_ai_usage_log')
order by table_name;

-- (2) Expect response_ms to be present on the usage log
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'gyeon_ai_usage_log'
  and column_name = 'response_ms';

-- (3) Expect the updated_at trigger to exist
select tgname
from pg_trigger
where tgrelid = 'public.gyeon_ai_settings'::regclass
  and not tgisinternal;
