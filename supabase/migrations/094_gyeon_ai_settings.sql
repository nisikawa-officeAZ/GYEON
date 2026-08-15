-- =============================================================================
-- AI Center: GYEON-managed AI settings (platform-level OpenAI key)
-- File: 094_gyeon_ai_settings.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 093.
--
-- Purpose:
--   Store the GYEON-managed (platform-owned) OpenAI API key and its connection
--   status, managed from the Super Admin AI Center. This is the key used by
--   GYEON-managed AI features (vehicle registration OCR, GYEON estimate
--   recommendation, inventory/sales diagnostics, system-level AI).
--
--   The key is stored ENCRYPTED (AES-256-GCM, same scheme as dealer keys —
--   see src/lib/ai/crypto.ts, DEALER_AI_KEY_SECRET). The plaintext key is never
--   stored, never returned to the client, and never logged.
--
-- Ownership policy:
--   docs/AI_API_OWNERSHIP_POLICY.md
--
-- Access model:
--   Singleton row (id = 1). RLS is ENABLED with NO policies, so only the
--   server-side service-role client (Super Admin server actions) can read or
--   write it. No dealer, no browser, and no anon/auth RLS role can touch it.
--
-- Fallback:
--   If this table/row is absent or empty, the key resolver falls back to the
--   OPENAI_API_KEY environment variable (development). See
--   src/lib/ai/gyeon-managed-key.ts.
-- =============================================================================

create table if not exists public.gyeon_ai_settings (
  id                       integer primary key default 1,
  openai_api_key_encrypted text,
  last_tested_at           timestamptz,
  last_test_status         text check (last_test_status in ('success', 'failed')),
  updated_by               uuid,
  updated_at               timestamptz not null default now(),
  -- Enforce a single platform-config row.
  constraint gyeon_ai_settings_singleton check (id = 1)
);

comment on table  public.gyeon_ai_settings is
  'Platform-level (GYEON-managed) AI configuration. Singleton row id=1. Service-role only.';
comment on column public.gyeon_ai_settings.openai_api_key_encrypted is
  'AES-256-GCM encrypted OpenAI API key (v1: format). Never store plaintext.';

-- RLS on, no policies → service-role only (matches admin operation model).
alter table public.gyeon_ai_settings enable row level security;
