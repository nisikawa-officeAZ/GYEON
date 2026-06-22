-- =============================================================================
-- PHASE70: dealer_settings — Canonical Column Set
-- =============================================================================
-- DO NOT AUTO-APPLY.
-- Paste into Supabase SQL Editor manually after CTO review.
-- Apply AFTER migration 067 (vehicle_registration_ocr).
--
-- Strategy: Additive only.
--   - No DROP statements.
--   - No destructive changes.
--   - No RLS weakening.
--   - All new columns use ADD COLUMN IF NOT EXISTS (idempotent).
--   - service_price_settings / ppf_price_tables default NULL so EstimateWizard
--     falls back to hardcoded values until a dealer configures pricing.
--   - LINE secrets (line_channel_secret, line_access_token) remain untouched.
--     line_public_settings jsonb must NEVER contain secrets.
--
-- References:
--   dealer_settings_final_schema.md (v1.1, 2026-06-22)
--   PHASE70 task specification
-- =============================================================================


-- =============================================================================
-- Section 1: Store Profile additions
-- =============================================================================
-- Existing: business_name, business_phone, business_email, business_address,
--           logo_url, company_name, postal_code, contact_name, business_website
-- New: granular text columns + jsonb blob for flexible extension

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS business_phone_alt  text,
  ADD COLUMN IF NOT EXISTS bank_account        text,
  ADD COLUMN IF NOT EXISTS store_profile       jsonb NOT NULL DEFAULT '{}';

-- store_profile jsonb usage guide:
-- {
--   "store_name_short": "...",  // Display name abbreviation
--   "opening_hours": "...",     // Free text
--   "parking_info": "..."       // Free text
-- }
-- Individual columns (business_name, business_phone, etc.) remain primary.
-- store_profile holds supplementary fields not covered by individual columns.


-- =============================================================================
-- Section 2: Detailer Rank & Business Days
-- =============================================================================

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS detailer_rank    text    NOT NULL DEFAULT 'detailer',
  ADD COLUMN IF NOT EXISTS closed_weekdays  integer[],
  ADD COLUMN IF NOT EXISTS temp_holidays    jsonb,
  ADD COLUMN IF NOT EXISTS business_days    jsonb   NOT NULL DEFAULT '{}';

-- detailer_rank CHECK constraint (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname = 'public'
      AND  t.relname = 'dealer_settings'
      AND  c.conname = 'dealer_settings_detailer_rank_check'
  ) THEN
    ALTER TABLE public.dealer_settings
      ADD CONSTRAINT dealer_settings_detailer_rank_check
      CHECK (detailer_rank IN ('detailer', 'certified'));
  END IF;
END;
$$;

-- closed_weekdays: integer[] where 0=Sun, 1=Mon, ..., 6=Sat
-- Example: [0, 6] = closed on Sunday and Saturday
-- temp_holidays: jsonb array of YYYY-MM-DD strings
-- Example: '["2026-08-13","2026-08-14"]'
-- business_days jsonb: flexible extension (opening hours per weekday, etc.)


-- =============================================================================
-- Section 3: Dealer Trade Defaults
-- =============================================================================

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS default_dealer_rate_percent  numeric(5,2) NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS dealer_closing_day           smallint,
  ADD COLUMN IF NOT EXISTS dealer_payment_day           smallint,
  ADD COLUMN IF NOT EXISTS dealer_trade_defaults        jsonb        NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname = 'public'
      AND  t.relname = 'dealer_settings'
      AND  c.conname = 'dealer_settings_dealer_rate_check'
  ) THEN
    ALTER TABLE public.dealer_settings
      ADD CONSTRAINT dealer_settings_dealer_rate_check
      CHECK (default_dealer_rate_percent BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname = 'public'
      AND  t.relname = 'dealer_settings'
      AND  c.conname = 'dealer_settings_closing_day_check'
  ) THEN
    ALTER TABLE public.dealer_settings
      ADD CONSTRAINT dealer_settings_closing_day_check
      CHECK (dealer_closing_day BETWEEN 1 AND 31);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname = 'public'
      AND  t.relname = 'dealer_settings'
      AND  c.conname = 'dealer_settings_payment_day_check'
  ) THEN
    ALTER TABLE public.dealer_settings
      ADD CONSTRAINT dealer_settings_payment_day_check
      CHECK (dealer_payment_day BETWEEN 1 AND 31);
  END IF;
END;
$$;

-- default_dealer_rate_percent: replaces EstimateWizard useState(70)
-- dealer_trade_defaults jsonb: extension slot for additional B2B settings


-- =============================================================================
-- Section 4: OCR Settings
-- =============================================================================

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS ocr_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ocr_policy   jsonb   NOT NULL DEFAULT '{}';

-- ocr_enabled: toggles VehicleRegistrationUpload in EstimateWizard STEP1
-- ocr_policy jsonb usage guide:
-- {
--   "human_confirmation_required": true,  // always true — cannot be disabled (code-level)
--   "allowed_formats": ["jpeg","png","pdf"],
--   "max_file_size_mb": 10
-- }


-- =============================================================================
-- Section 5: LINE — Public Settings (non-secret extensions)
-- =============================================================================
-- Existing: line_channel_id, line_channel_secret, line_access_token,
--           line_liff_id, webhook_url, line_enabled
-- line_channel_secret and line_access_token MUST remain server-only.
-- New columns below are public-safe. NEVER add secrets to line_public_settings.

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS friend_add_qr_url           text,
  ADD COLUMN IF NOT EXISTS line_message_header         text,
  ADD COLUMN IF NOT EXISTS line_message_footer         text,
  ADD COLUMN IF NOT EXISTS maintenance_message_header  text,
  ADD COLUMN IF NOT EXISTS maintenance_message_footer  text,
  ADD COLUMN IF NOT EXISTS sns_urls                    jsonb,
  ADD COLUMN IF NOT EXISTS line_public_settings        jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS line_message_templates      jsonb NOT NULL DEFAULT '{}';

-- sns_urls jsonb schema:
-- { "instagram": "...", "x": "...", "google": "...", "line": "..." }
--
-- line_public_settings: public-safe LINE display settings (NOT secrets).
-- line_message_templates jsonb schema:
-- {
--   "estimate_sent": { "header": "...", "footer": "..." },
--   "maintenance_reminder": { "header": "...", "footer": "..." }
-- }


-- =============================================================================
-- Section 6: PDF & Document Settings
-- =============================================================================
-- Existing: stamp_url, pdf_footer, invoice_note, completion_note,
--           terms_and_conditions, qualified_invoice_number, tax_rate

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS pdf_settings       jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_settings  jsonb NOT NULL DEFAULT '{}';

-- pdf_settings jsonb: layout, page size, header/footer overrides, watermark, etc.
-- document_settings jsonb: estimate validity days, auto-expiry rules, etc.


-- =============================================================================
-- Section 7: Pricing & Discounts
-- =============================================================================
-- coupon_settings / discount_presets default NULL (not '[]') so application
-- can distinguish "not yet configured" from "configured with empty list".

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS coupon_settings    jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_presets   jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_settings       jsonb NOT NULL DEFAULT '{}';

-- coupon_settings jsonb schema (5 fixed slots):
-- [
--   {"name":"新規ご来店クーポン",   "amount":5000},
--   {"name":"リピーター割引",       "amount":3000},
--   {"name":"紹介特典クーポン",     "amount":5000},
--   {"name":"キャンペーンクーポン", "amount":10000},
--   {"name":"スタッフ割引",         "amount":3000}
-- ]
-- NULL → EstimateWizard uses hardcoded DEFAULT_COUPONS.
--
-- discount_presets jsonb schema (unlimited):
-- [{"id":"...","name":"下取り特典","discount_type":"fixed","value":10000}]
-- discount_type: "fixed" | "percent"
--
-- tax_settings jsonb: reduced-rate rules, rounding mode, etc.


-- =============================================================================
-- Section 8: Service Price Settings (全6サービスグループ)
-- =============================================================================
-- Both columns default NULL — EstimateWizard falls back to hardcoded defaults
-- (COATINGS, TOPCOAT_BASE, COATING_OPTIONS, BODY_SIZES) when NULL.
-- PPF + coating combined estimate is a first-class use case.
-- Required service groups in service_price_settings:
--   coating, ppf (overview only), window_film, maintenance, carwash, room_cleaning

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS service_price_settings  jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ppf_price_tables        jsonb DEFAULT NULL;

-- service_price_settings jsonb top-level keys (all required when non-NULL):
--   coating, ppf, window_film, maintenance, carwash, room_cleaning
--   Full schema: see dealer_settings_final_schema.md Section 9
--
-- ppf_price_tables jsonb top-level keys:
--   plan_prices, film_coeff, rank_coeff, glass_prices, parts_prices
--   Full schema: see dealer_settings_final_schema.md Section 9a
--
-- Price formula (PPF full plan):
--   price = plan_prices["{plan}_{size_key}"] × film_coeff[filmId] × rank_coeff[rankId]
-- Price formula (PPF partial):
--   price = Σ parts_prices[partId]


-- =============================================================================
-- Section 9: Reminder Templates
-- =============================================================================

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS maintenance_reminder_templates  jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_templates              jsonb NOT NULL DEFAULT '[]';

-- maintenance_reminder_templates = reminder_templates conceptually.
-- maintenance_reminder_templates: spec-canonical name, NULL = not yet configured.
-- reminder_templates: task-canonical name, default '[]' (always present).
-- Application should read maintenance_reminder_templates first; fall back to reminder_templates.
--
-- Schema (3 fixed slots, id 1/2/3):
-- [
--   {"id":1,"name":"1ヶ月メンテナンス","months_after":1,"message":"","menus":[],"enabled":false,"repeat_yearly":false},
--   {"id":2,"name":"6ヶ月メンテナンス","months_after":6,"message":"","menus":[],"enabled":false,"repeat_yearly":false},
--   {"id":3,"name":"12ヶ月メンテナンス","months_after":12,"message":"","menus":[],"enabled":true,"repeat_yearly":false}
-- ]


-- =============================================================================
-- Section 10: DR / Health (operational metadata)
-- =============================================================================

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS backup_settings  jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS health_settings  jsonb NOT NULL DEFAULT '{}';

-- These columns hold dealer-level operational preferences (not runtime state).
-- Actual health check results and backup status live in runtime/separate tables.


-- =============================================================================
-- RLS — No changes
-- =============================================================================
-- dealer_settings already has RLS enabled (migration 043):
--   Policy: "Dealer members can manage their settings"
--   FOR ALL USING (dealer_id IN (
--     SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
--   ))
--
-- No new policies added. No existing policies modified. No RLS weakening.
--
-- Security rules preserved:
--   1. dealer_id always sourced from getCurrentDealer() — never from client forms.
--   2. line_channel_secret / line_access_token: server-only, stripped by getDealerSettingsPublic().
--   3. line_public_settings must never contain line_channel_secret or line_access_token.
--   4. All queries must scope by dealer_id via getCurrentDealer().


-- =============================================================================
-- Migration gap: LINE secrets secure storage
-- =============================================================================
-- RISK NOTE: line_channel_secret and line_access_token are stored as plain text
-- in dealer_settings. They are protected only by RLS, not at-rest encryption.
-- For production hardening, consider migrating secrets to Supabase Vault or
-- an external secrets manager. This is out of scope for PHASE70 but documented
-- as a known gap for future CTO review.


-- =============================================================================
-- Post-apply verification (run after applying — do not run as part of migration)
-- =============================================================================

-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'dealer_settings'
-- ORDER BY ordinal_position;
--
-- Expected new columns (27 total added by this migration):
--   business_phone_alt, bank_account, store_profile,
--   detailer_rank, closed_weekdays, temp_holidays, business_days,
--   default_dealer_rate_percent, dealer_closing_day, dealer_payment_day, dealer_trade_defaults,
--   ocr_enabled, ocr_policy,
--   friend_add_qr_url, line_message_header, line_message_footer,
--   maintenance_message_header, maintenance_message_footer,
--   sns_urls, line_public_settings, line_message_templates,
--   pdf_settings, document_settings,
--   coupon_settings, discount_presets, tax_settings,
--   service_price_settings, ppf_price_tables,
--   maintenance_reminder_templates, reminder_templates,
--   backup_settings, health_settings
