-- =============================================================================
-- Developer Preview — diagnostics support
-- File: 096_dev_diagnostics.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 095.
--
-- Purpose:
--   1. Add gyeon_ai_usage_log.response_ms so the AI Center / Developer Preview
--      can show real last/average response time.
--   2. pg_version(): a tiny read-only helper so the diagnostics screen can show
--      the database version. SECURITY DEFINER, returns only the version string.
--
-- Both are additive and idempotent. No data is modified.
-- =============================================================================

-- 1. Response time column (nullable, additive)
alter table public.gyeon_ai_usage_log
  add column if not exists response_ms integer;

-- 2. Database version helper (read-only)
create or replace function public.pg_version()
returns text
language sql
security definer
set search_path = public
as $$ select version() $$;

comment on function public.pg_version() is
  'Developer Preview diagnostics: returns the PostgreSQL version string.';
