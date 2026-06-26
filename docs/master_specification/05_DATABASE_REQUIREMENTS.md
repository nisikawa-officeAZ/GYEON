# 05 — DATABASE REQUIREMENTS

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Canonical |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | `gyeon_flow.json`, `gyeon_settings_flow.json`, `supabase/migrations/` |
| **Related Documents** | `03_BUSINESS_WORKFLOW.md`, `04_SETTINGS_WORKFLOW.md`, `06_OCR_REQUIREMENTS.md`, `07_LINE_REQUIREMENTS.md`, `11_CANONICAL_RULES.md` |

> Derived from the Canonical JSON (data contracts) **and** the verified implementation (`supabase/migrations/`).
> Canonical data contracts come first; the implemented schema must satisfy them.
> **All migrations require CTO approval before execution. See `11_CANONICAL_RULES.md` §3.**

---

## 1. Canonical Data Contracts (from JSON)

### 1.1 Estimate (`currentEstimate`, from `gyeon_flow.json`)
The estimate must persist all fields in `03_BUSINESS_WORKFLOW.md` §5 — customer block, customer_id link, car block, size, coating + layer/topcoats, options, and per-category objects (ppf, windowFilm, maintenance, carWash, roomCleaning, otherWork), categories[], notes, couponDiscount, appliedCoupons[], discountAmount, is_dealer, dealer_rate, dealer_discount, created_at.

### 1.2 Canonical entity stores (from `gyeon_flow.json`)

| Store | Key | Indexes |
|-------|-----|---------|
| estimates | id (auto) | created_at |
| settings | key | — |
| customers | id (auto) | name, phone |
| maintenances | id (auto) | customer_id, date |
| schedules | id (auto) | start_date, category |
| past_histories | id (auto) | customer_id, date |
| dealer_statements | id (auto) | customer_id, year_month |

### 1.3 Canonical settings store (from `gyeon_settings_flow.json`)
A single key/value settings store holding the **37 keys** enumerated in `04_SETTINGS_WORKFLOW.md` §7.

---

## 2. Implemented Schema (Supabase / PostgreSQL)

**Migration files** in `supabase/migrations/` (legacy `001`–`004`, feature line `035`–`070+`).

| Domain | Tables (migration range) |
|--------|--------------------|
| Tenancy | `dealers`, `dealer_members`, `dealer_settings` (070 canonical) |
| Customers / Vehicles | `customers` (035), `vehicles` (036), `vehicle_registration_files` (067) |
| Estimates | `estimates`, `estimate_items` (037) |
| Work Orders | `work_orders` (038), `work_order_files` (039), `completion_reports` (040) |
| Billing docs | `invoices` (041), `payments` (042), `document_sequences` (046), `document_files` (053) |
| LINE | `line_customers` (043), `line_message_logs` (044) |
| Scheduling | `maintenance_reminders` (045), `reservations` (052) |
| Products | `gyeon_products` (047), `product_orders` (048) |
| Staff | `staff_roles`, `staff_members` (050) |
| Platform | `notifications`, `activity_timeline` (054), `audit_logs` (055) |
| Commercial | subscription/license (058), onboarding (059), staging verification (062), UAT (063), billing (064) |

All feature tables are RLS-enabled and **dealer-scoped** (`dealer_id` resolved server-side via `getCurrentDealer()`).

---

## 3. Canonical ↔ Implemented Mapping

| Canonical store/contract | Implemented equivalent | Status |
|--------------------------|------------------------|--------|
| `estimates` + `currentEstimate` | `estimates` + `estimate_items` (037) | ✅ present — **verify every per-category field & pricing field is represented** |
| `customers` | `customers` (035) | ✅ |
| `maintenances` | `maintenance_reminders` (045) | 🟡 verify field parity (customer_id, date, menus) |
| `schedules` | `reservations` (052) | 🟡 verify parity |
| `past_histories` | (completion_reports / activity_timeline?) | ⚠️ **operator decision** — no direct table |
| `dealer_statements` | (billing / invoices?) | ⚠️ **operator decision** — 業販 statement model unclear |
| settings (37 keys) | `dealer_settings` (070 canonical) | 🟡 **verify all 37 keys covered** |

---

## 4. dealer_settings — Canonical Schema (Final)

Source: `dealer_settings_final_schema.md` v1.1 (2026-06-22).

### 4.1 Full column listing

```sql
-- Identity
id                              uuid PRIMARY KEY DEFAULT gen_random_uuid()
dealer_id                       uuid NOT NULL UNIQUE REFERENCES dealers(id)
created_at                      timestamptz NOT NULL DEFAULT now()
updated_at                      timestamptz NOT NULL DEFAULT now()

-- Store Profile
business_name                   text            -- 店舗名
company_name                    text            -- 会社名（法人正式名）
contact_name                    text            -- 担当者名
postal_code                     text
business_address                text
business_phone                  text
business_phone_alt              text            -- ➕ NEW: 電話番号（予備）
business_email                  text
business_website                text
logo_url                        text
bank_account                    text            -- ➕ NEW: 振込先口座情報

-- Detailer Rank & Business Days
detailer_rank  text NOT NULL DEFAULT 'detailer' -- ➕ NEW
               CHECK (detailer_rank IN ('detailer','certified'))
closed_weekdays                 integer[]       -- ➕ NEW: 定休曜日
temp_holidays                   jsonb           -- ➕ NEW: 臨時休業日
business_days                   jsonb NOT NULL DEFAULT '{}'  -- ➕ NEW: 営業時間設定

-- Dealer Trade Defaults
default_dealer_rate_percent  numeric(5,2) NOT NULL DEFAULT 70  -- ➕ NEW (⚠️ see OD-9)
                             CHECK (default_dealer_rate_percent BETWEEN 0 AND 100)
dealer_closing_day           smallint CHECK (dealer_closing_day BETWEEN 1 AND 31)  -- ➕ NEW
dealer_payment_day           smallint CHECK (dealer_payment_day BETWEEN 1 AND 31)  -- ➕ NEW
dealer_trade_defaults        jsonb NOT NULL DEFAULT '{}'  -- ➕ NEW: extended trade config

-- OCR Settings
ocr_enabled                     boolean NOT NULL DEFAULT true   -- ➕ NEW
ocr_policy                      jsonb NOT NULL DEFAULT '{}'     -- ➕ NEW: OcrPolicySettings

-- LINE Integration (server-side secrets — NEVER expose to client)
line_channel_id                 text
line_channel_secret             text            -- SERVER ONLY
line_access_token               text            -- SERVER ONLY
line_liff_id                    text
webhook_url                     text
line_enabled                    boolean NOT NULL DEFAULT false
friend_add_qr_url               text            -- ➕ NEW
line_message_header             text            -- ➕ NEW
line_message_footer             text            -- ➕ NEW
maintenance_message_header      text            -- ➕ NEW
maintenance_message_footer      text            -- ➕ NEW
sns_urls                        jsonb           -- ➕ NEW: {instagram, x, google, line}
line_public_settings            jsonb NOT NULL DEFAULT '{}' -- ➕ NEW: public-safe LINE metadata (NO SECRETS)
line_message_templates          jsonb NOT NULL DEFAULT '{}' -- ➕ NEW: {estimate_sent, maintenance_reminder} (⚠️ see OD-11)

-- PDF & Document Settings
tax_rate                        numeric(5,2) NOT NULL DEFAULT 10
qualified_invoice_number        text
stamp_url                       text
pdf_footer                      text
invoice_note                    text
completion_note                 text
terms_and_conditions            text
pdf_settings                    jsonb NOT NULL DEFAULT '{}' -- ➕ NEW: PdfSettings
document_settings               jsonb NOT NULL DEFAULT '{}' -- ➕ NEW: DocumentSettings

-- Pricing & Discounts
coupon_settings                 jsonb           -- ➕ NEW: 5 fixed slots (nullable; fallback to hardcoded)
discount_presets                jsonb           -- ➕ NEW: unlimited presets (nullable)
tax_settings                    jsonb NOT NULL DEFAULT '{}' -- ➕ NEW: TaxSettings

-- Service Price Settings (all 6 service groups)
service_price_settings          jsonb           -- ➕ NEW (nullable; fallback to hardcoded defaults)

-- PPF Dedicated Price Tables
ppf_price_tables                jsonb           -- ➕ NEW: plan_prices, film_coeff, rank_coeff, glass_prices, parts_prices (nullable)

-- Reminders
maintenance_reminder_templates  jsonb           -- ➕ NEW: 3 fixed slots (nullable; see fallback rule below)
reminder_templates              jsonb NOT NULL DEFAULT '[]' -- ➕ NEW: fallback alias

-- System
backup_settings                 jsonb NOT NULL DEFAULT '{}'  -- ➕ NEW
health_settings                 jsonb NOT NULL DEFAULT '{}'  -- ➕ NEW

-- Onboarding
onboarding_completed            boolean NOT NULL DEFAULT false
onboarding_completed_at         timestamptz
onboarding_step                 smallint NOT NULL DEFAULT 0

-- Store profile extension
store_profile                   jsonb NOT NULL DEFAULT '{}'  -- ➕ NEW: structured store fields
```

**New columns count: 32** | **Existing columns: ~29** | **Total: ~61**

> ⚠️ NOTE (PHASE75 correction): The previous spec stated "New columns count: 19 / Total: 48." Migration 070 actually adds **32 new columns** (including 12 extra JSONB extension blobs not listed in the earlier `dealer_settings_final_schema.md` v1.1). The true total is approximately 61 columns.

> ⚠️ **Nullable vs TypeScript asymmetry:** Several columns are nullable in the DB (`coupon_settings`, `ppf_price_tables`, `service_price_settings`, `maintenance_reminder_templates`) but typed as non-nullable in `CanonicalDealerSettings` TypeScript interface (`src/lib/dealer-settings/dealer-settings-types.ts`). The TypeScript type applies defaults in code. This is intentional — read-layer applies fallbacks; DB stores NULL when not yet configured.

> **reminder_templates fallback rule:** Read `maintenance_reminder_templates` first. If NULL, read `reminder_templates`. If both NULL, use hardcoded defaults from `dealer-settings-defaults.ts`. See `11_CANONICAL_RULES.md` §7.6.

> **TypeScript type reference:** `CanonicalDealerSettings` in `src/lib/dealer-settings/dealer-settings-types.ts` is the authoritative read contract for all columns added in PHASE70–71.

### 4.2 service_price_settings JSONB structure

Contains all 6 service groups: `coating`, `ppf`, `window_film`, `maintenance`, `carwash`, `room_cleaning`.

- `coating`: products[], size_multipliers{}, topcoat_prices{}, option_prices{}, option_names{}
- `ppf`: active flag, plan_labels{} (detailed pricing lives in `ppf_price_tables`)
- `window_film`: base_prices{}, grade_coeff{}
- `maintenance`: menus[] (5 fixed slots A–E)
- `carwash`: menus[] (unlimited)
- `room_cleaning`: base_prices{}, condition_coeff{}

NULL in any sub-key → EstimateWizard falls back to hardcoded defaults.

### 4.3 ppf_price_tables JSONB structure

Separate column (not nested in `service_price_settings`).

- `plan_prices`: `{"front-half_SS": 130000, "front-half_S": 150000, …, "full-body_XL": 650000}`
- `film_coeff`: `{"clear": 1.0, "matte": 1.3, "color": 1.2, "self-heal": 1.1}`
- `rank_coeff`: `{"std": 1.0, "premium": 1.3, "ultra": 1.6}`
- `glass_prices`: `{"ppf": 80000, "tpu": 60000}`
- `parts_prices`: `{"sp-headlight": 25000, "sp-b-pillar": 15000, …}`

### 4.4 coupon_settings JSONB structure

Array of exactly 5 elements. Length is fixed — add/delete not allowed.

```json
[
  {"name": "新規ご来店クーポン",   "amount": 5000},
  {"name": "リピーター割引",       "amount": 3000},
  {"name": "紹介特典クーポン",     "amount": 5000},
  {"name": "キャンペーンクーポン", "amount": 10000},
  {"name": "スタッフ割引",         "amount": 3000}
]
```

### 4.5 maintenance_reminder_templates JSONB structure

Array of exactly 3 elements. IDs are fixed: 1/2/3.

```json
[
  {"id": 1, "name": "1ヶ月メンテナンス",  "months_after": 1,  "message": "", "menus": [], "enabled": false, "repeat_yearly": false},
  {"id": 2, "name": "6ヶ月メンテナンス",  "months_after": 6,  "message": "", "menus": [], "enabled": false, "repeat_yearly": false},
  {"id": 3, "name": "12ヶ月メンテナンス", "months_after": 12, "message": "", "menus": [], "enabled": true,  "repeat_yearly": false}
]
```

---

## 5. Migration 070 Status

> **PHASE75 CORRECTION:** The previous version of this section listed 5 "pending draft migrations." This was incorrect.
> `supabase/migrations/070_dealer_settings_canonical.sql` **already exists** in the repository as a complete, well-formed SQL file. It covers all columns described in §4.1 above via `ADD COLUMN IF NOT EXISTS`.

| Item | Status |
|------|--------|
| Migration 070 file created | ✅ Exists at `supabase/migrations/070_dealer_settings_canonical.sql` |
| CTO review completed | ⏳ Awaiting |
| Staging apply | ⏳ Awaiting (depends on OD-1) |
| Production apply | ⏳ Awaiting (depends on staging verification) |

**Migration 070 apply procedure:**
1. Obtain CTO approval.
2. Run in Supabase SQL Editor (staging environment first).
3. Verify all columns added correctly with `\d dealer_settings`.
4. Run staging verification suite.
5. Repeat for production.
6. Update this document to reflect applied status.

> **Pending data migration (HIGH risk):** Once migration 070 is applied, a separate data migration may be needed to populate `default_dealer_rate_percent` and `dealer_closing_day`/`dealer_payment_day` for existing dealers who have this data stored in `vehicles.notes`. This requires analysis before execution.

---

## 6. Persistence Architecture (Canonical Resolution)

The Canonical JSON specifies **IndexedDB + Cloudflare KV + D1** with offline-first sync. The implementation uses **Supabase (PostgreSQL)** server-side with RLS.

**Ratified resolution (operator-confirmed default):**
- Canonical JSON = *data shapes, semantics, settings keys, pricing formulas, business rules*.
- **Supabase is the canonical persistence substrate** going forward. The IndexedDB/KV/D1 text in the JSON is reference-only.
- Offline-first is a separate, explicit roadmap item — not implied.

---

## 7. Database Hygiene Findings (Informational)

- Numbering gaps `056, 057, 060, 061, 065, 068, 069` = code/doc-only phases (no schema changes). Intentional.
- Duplicate `001_create_core_tables.sql` + `001_create_core_tables_PASTE_ONLY.sql` — cleanup candidate (Phase D).
- `CHANGELOG.md` migration filenames do **not** match real files — unreliable; this doc is the reference.
- "Applied" status is manual (no automated drift check).

---

## 8. Requirements Summary

1. `estimates`/`estimate_items` MUST hold every field in `03_BUSINESS_WORKFLOW.md` §5, including per-category subtotals and all discount/dealer fields.
2. `dealer_settings` MUST store and serve all 37 canonical settings keys (`04_SETTINGS_WORKFLOW.md` §7).
3. Resolve `past_histories` and `dealer_statements` (業販 statements) to concrete tables or formally defer.
4. Apply migration 070 (§5) after CTO approval and staging verification. Migration file already exists.
5. All tables not listed as "out of scope" in `dealer_settings_final_schema.md` §17 must remain dealer-scoped with RLS.
