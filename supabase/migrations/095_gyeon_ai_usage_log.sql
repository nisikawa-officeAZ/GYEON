-- =============================================================================
-- AI Center: GYEON AI usage log (minimal)
-- File: 095_gyeon_ai_usage_log.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 094.
--
-- Purpose:
--   Minimal per-call usage log for GYEON-managed AI features. One row is
--   inserted per feature invocation (initially: vehicle registration OCR
--   success/failure). This is intentionally minimal — NO broader analytics
--   and NO billing logic. estimated_cost is reserved (nullable) for later.
--
-- Access model:
--   RLS ENABLED with NO policies → service-role only (server-side writes/reads).
--   Inserted via src/lib/ai/log-ai-usage.ts (best-effort, never blocks the call).
--
-- Related: docs/AI_API_OWNERSHIP_POLICY.md, gyeon_ai_settings (094).
-- =============================================================================

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
  status         text not null check (status in ('success', 'failed')),
  error_code     text,
  created_at     timestamptz not null default now()
);

comment on table public.gyeon_ai_usage_log is
  'Minimal per-call usage log for GYEON-managed AI features. Service-role only. No billing logic.';

-- Index for the AI Center summary (recent-first, per feature).
create index if not exists gyeon_ai_usage_log_feature_created_idx
  on public.gyeon_ai_usage_log (feature_key, created_at desc);

alter table public.gyeon_ai_usage_log enable row level security;
