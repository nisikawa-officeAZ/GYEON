# 04 — SETTINGS WORKFLOW
## Store Registration & Settings — Canonical Specification

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Canonical |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | `gyeon_settings_flow.json` (meta.version 2024-06) |
| **Related Documents** | `03_BUSINESS_WORKFLOW.md`, `05_DATABASE_REQUIREMENTS.md`, `07_LINE_REQUIREMENTS.md`, `11_CANONICAL_RULES.md` |

> **Derived directly from `gyeon_settings_flow.json`** (`meta.version = 2024-06`).
> Canonical. Documents auth, plans, init sequence, every settings group, every drawer, the save mechanism, and persistence. Implementation (`src/app/settings`, `src/lib/dealer-settings`, `src/components/settings/SettingsCategoryNav.tsx`, migration `070_dealer_settings_canonical.sql`) must conform.

---

## 1. Authentication Flow

**Startup sequence (canonical JSON):**
1. `DOMContentLoaded`.
2. If URL has `?t=TOKEN`, store in localStorage + Cookie (legacy compat).
3. `getAuthToken()` — localStorage first → Cookie fallback.
4. Token present → `fetchPlan()` (server user info).
5. Success → `_initApp()` → `showAppWithPlan()` → home.
6. Failure (network) → retry after 3 s → still failing → auth screen.
7. No token → auth screen (`screen-auth`).

**Panels:**
- **Login:** email (req) + password (req). Both required; empty → client error (no submit). `POST /api/auth/login` → success: store token + go to app; failure: show error. Links to register / reset.
- **Register:** email + password + confirm password. pw≠pw2 → "パスワードが一致しません". `POST /api/auth/register`. Goes straight into app after register (no email verification).
- **Reset:** email. `POST /api/auth/reset-request`. Same success message on success/failure (security).

**Token management:** key `gyeon_auth_token`; localStorage (primary) + Cookie (SameSite=Lax/Secure/365d). Get: localStorage→Cookie (and write back). Set: both. Clear: remove both. iOS: Cookie shared Safari↔PWA enables hand-off.
**Logout:** `POST /api/auth/logout` (Bearer token) → clear token → auth screen.

> ⚠️ **Implementation uses Supabase Auth** (email/password + JWT) + middleware, not the custom AuthToken scheme above. Business intent (email/password login, register-then-enter, password reset, persistent session) is preserved. Supabase Auth is canonical going forward. See `11_CANONICAL_RULES.md` §6.

---

## 2. Plan System

| id | label | restrictions | banner |
|----|-------|--------------|--------|
| free | FREE | 顧客管理・分析画面 grayed out (`.pro-feature` lock overlay) | upgrade banner |
| trial | TRIAL | none (all unlocked) | trial days-left banner |
| pro | PRO | none | PRO+ upsell in settings |
| pro_plus | PRO+ | none | trial days-left if in trial |

PRO-gated screens: `screen-customers` (顧客管理), `screen-analytics` (売上分析).
Guards: `requirePro` (free → upgrade modal; else callback); `requireProPlus` (free → upgrade modal; trial/pro/pro_plus → callback).

> Implemented plans (per `src/lib/subscriptions`, mig 058): Trial / Pro / Pro Plus. The canonical `free` tier and exact gating must be reconciled with the implemented subscription tiers — operator decision.

---

## 3. App Init Sequence (after login)

| Order | Action | Detail |
|-------|--------|--------|
| 1 | `initDB()` | IndexedDB gyeon_db v5 — open/create schema |
| 2 | `loadSettings()` | KV→IndexedDB, reflect in globals |
| 3 | `loadStaffSettings()` | staff names + closed-day data from DB |
| 4 | `loadClosedSettings()` | closed weekdays + temp holidays from DB |
| 5 | `updateHistoryCount()` | estimate history count badge |
| 6 | `updateReminderCount()` | reminder count badge |
| 7 | `updateScheduleBadge()` | today's schedule badge |
| 8 | `_fixBrokenScheduleDates()` | auto-repair end_date < start_date |
| 9 | `renderSizeGrid()` | body-size selection grid |
| 10 | `renderCoatingList()` | coating selection list |
| 11 | `renderOptionsList()` | options selection list |
| 12 | `refreshLineInboxBadge()` | LINE unread count badge |
| 13 | Cloud Sync pull (1.5 s) | D1→IndexedDB sync (never overwrite existing IDs) |

> Legacy init order from the Genspark runtime. In the Supabase implementation the equivalent is server-side data fetching per route. Preserve the **badge/counter semantics** (history count, reminder count, today's schedule, LINE unread).

---

## 4. Settings Screen — Groups

Navigation: home → gear icon / settings buttons. Each item opens a **drawer** (slides up from bottom).

| Group | Label | Items (drawer_key) |
|-------|-------|--------------------|
| g1 | 店舗・スタッフ | store, staff-names, closed-days, rank |
| g2 | 価格・割引 | coupon, discount, tax |
| g3 | 施工メニュー | ppf, coating, option, maintenance-menu, ppf-new, window-film, car-wash, room-cleaning |
| g4 | リマインダー設定 | reminder-templates |
| g5 | SNS・LINE連携 **(hidden / 準備中)** | line-api, auto-message, sns, line |
| g6 | データ | exportData(), confirmClearData() (destructive) |
| g7 | サポート・規約 | contact, terms, privacy |

---

## 5. Drawer Details

### 5.1 Store Settings — `store`
Fields (db_key): store-name, staff-name, phone, address, email, store-tnum (予備), store-bank (振込先口座). Special: logo image (file → immediate IndexedDB only, not KV). Save targets: IndexedDB(settings) + KV (`POST /api/settings` partial). After save: update `store-name-display` on home.

### 5.2 Staff names — `staff-names`
`staff-name-input-{0..4}`; default "スタッフ{N}". db_key `staff-list` = JSON `[{id,name,color}]`. **Fixed 5 slots — no add/remove.**

### 5.3 Closed days — `closed-days`
`closed-weekdays` JSON `[0..6]` (0=Sun…6=Sat, multi-select). `temp-holidays` JSON `['YYYY-MM-DD']`. Real-time into `_shopClosedWeekdays`/`_shopTempHolidays`, written on save.

### 5.4 Detailer rank — `rank`
Radio: `detailer` (GYEONディテーラー) / `certified` (Certified Detailer). db_key `detailer-rank`.
**Effects:** enables infinit1/infinit2 in STEP3 (certified only); changes topcoat options and detailer-type-card display.
**Valid values: `'detailer'` or `'certified'` only.** No additional ranks. See `11_CANONICAL_RULES.md` §7.2.

### 5.5 Pricing — coupon / discount / tax (group g2)

- **coupon:** 5 fixed slots `[{name,amount}]`, db_key `coupons`. **Fixed 5 — no add/remove.** Defaults: 新規ご来店 ¥5,000 · リピーター ¥3,000 · 紹介特典 ¥5,000 · キャンペーン ¥10,000 · スタッフ ¥3,000. Applied in STEP5.
- **discount:** `[{name,discountType:'percent'|'fixed',value}]`, db_key `discounts`, **unlimited** slots.
- **tax:** select `10` / `8` (軽減税率) / `0` (非課税), db_key `tax`.

### 5.6 PPF settings — `ppf` (legacy) & `ppf-new`

- **ppf (legacy):** `{partId:price}`, db_key `ppf-prices`. Parts: headlight, b-pillar, c-pillar, mirror, step, rear-bump, door-cup. (Superseded by ppf-new.)
- **ppf-new (current):** tabs plan/film/rank/glass/parts.
  - `ppf-plan-prices`: `{'front-half_SS':130000,…}`
  - `ppf-film-coeff`: `{clear:1.0, matte:1.3, carbon:1.5, color:1.8}` ← **canonical JSON values**
  - `ppf-rank-coeff`: `{std:1.0, premium:1.3, upper:1.5, luxury:1.8}` ← **canonical JSON values**
  - `ppf-glass-prices`: `{ppf:80000, tpu:60000}`
  - `ppf-parts-prices`: `{'sp-headlight':25000, …}`

> ⚠️ **Operator Decision Pending (OD-3, OD-4).** Implementation defaults (`dealer-settings-defaults.ts`) use different film types (`color:1.2, self-heal:1.1`) and rank names (`ultra:1.6`) from the canonical JSON above. See `OPERATOR_DECISIONS.md` OD-3 and OD-4 before implementing PPF settings UI.

### 5.7 Service-menu pricing (group g3)

- **coating:** tabs base/size/topcoat. Keys: `custom-coating-prices` (M base price), `custom-size-multi` (size coeff), `custom-topcoat-prices` (M topcoat price).
- **option:** `custom-option-prices`, `custom-option-names` (blank = use default name).
- **window-film:** tabs base/grade. Keys: `wfilm-base-prices`, `wfilm-grade-coeff`.
- **maintenance-menu:** 5 fixed slots A–E `[{id,name,price}]`, db_key `maintenance-menus` (blank name → hidden in wizard).
- **car-wash:** unlimited `[{id,name,price}]`, db_key `car-wash-menus`. Defaults: cw-hand ¥3,000 · cw-polish ¥5,000 · cw-coat ¥8,000 · cw-wax ¥5,000 · cw-vacuum ¥2,000.
- **room-cleaning:** tabs base/condition. Keys: `rclean-base-prices`, `rclean-cond-coeff` `{normal:1.0, dirty:1.3, heavy:1.6}`.

### 5.8 Reminder — `reminder-templates`
3 fixed slots `[{id,name,months,menus,message,enabled,yearly}]`, db_key `reminder-templates`. Defaults: 1-month (enabled:false), 6-month (enabled:false), 12-month (enabled:true). Editable: name, message (LINE text body), menus (reference ids), enabled, yearly (template 3 only). 1-month & 6-month toggled per-customer in customer screen; 12-month toggled here globally.

### 5.9 LINE settings (group g5 — hidden / 準備中)

- **line (挨拶文):** `line-header`, `line-footer` (estimate-forward), `maint-header`, `maint-footer` (maintenance notice).
- **sns:** Instagram, X, Google Maps, LINE official URL → `sns-urls` JSON.
- **line-api:** Channel ID, Channel Secret, Webhook URL (auto-generated by app). Save target: **D1 server-side only** (not KV), `saveLineApiSettings()`.
- **auto-message:** D1 server-side only, `saveAutoMessageSettings()`.

> See `07_LINE_REQUIREMENTS.md` for full LINE specification.

### 5.10 Data & support (g6/g7)

- `exportData()` → JSON export of settings + estimates.
- `confirmClearData()` → **destructive** full local data wipe.
- Legal screens: contact, terms, privacy.

---

## 6. Drawer Save Mechanism

1. 「保存する」 button pressed → `saveDrawerSettings()`.
2. Button → disabled, text → "保存中…".
3. `saveDrawerByKey(key)`:
   - Collect DOM values via `getEl(id)`.
   - `dbPut('settings', {key, value})` → IndexedDB.
   - Accumulate into `kvPatch`.
   - After all items: `POST /api/settings` with `kvPatch` (batch update).
4. Success → `screen-settings` → `closeSettingsDrawer()` → Toast "✅ 保存が完了しました".
5. Failure → Toast "❌ 保存に失敗しました: {error}".
6. Restore button to enabled, text → "保存する".

**Exceptions:** `line-api` / `auto-message` save via D1 API — skip KV patch.

**Load mechanism:** `openSettingsDrawer(key)` → `loadDrawerValues(key)` → `dbGet()` from IndexedDB(settings) → DOM; fallback to default when unsaved.

---

## 7. Settings Persistence

| Priority | Store | Access | Notes |
|----------|-------|--------|-------|
| 1 | Cloudflare KV (server/cloud) | `POST/GET /api/settings`, auth `X-Auth-Token` | Loaded at startup → into IndexedDB |
| 2 | IndexedDB (settings store) | `{key, value}` format | Post-KV; offline fallback |

**Load sequence:** online → KV overrides IndexedDB; offline → IndexedDB only (warn & continue).

**All canonical settings keys (37):**

| Key | Type | Description |
|-----|------|-------------|
| store-name | string | 店舗名 |
| staff-name | string | 担当者名（旧） |
| staff-list | JSON array | スタッフ5名リスト |
| phone | string | 電話番号 |
| address | string | 住所 |
| email | string | メールアドレス |
| store-tnum | string | 電話番号（予備） |
| store-bank | string | 振込先口座情報 |
| detailer-rank | string | 'detailer' or 'certified' |
| tax | string | '10' / '8' / '0' |
| coupons | JSON array | クーポン5枠 |
| discounts | JSON array | 値引きプリセット |
| ppf-prices | JSON object | PPF旧方式単価 |
| ppf-plan-prices | JSON object | PPF新方式プラン×サイズ価格表 |
| ppf-film-coeff | JSON object | PPFフィルム係数 |
| ppf-rank-coeff | JSON object | PPF車両ランク係数 |
| ppf-glass-prices | JSON object | PPFフロントガラス価格 |
| ppf-parts-prices | JSON object | PPF単品部位価格 |
| custom-coating-prices | JSON object | コーティング基準価格（M） |
| custom-size-multi | JSON object | サイズ係数 |
| custom-topcoat-prices | JSON object | トップコート基準価格（M） |
| custom-option-prices | JSON object | オプション施工価格 |
| custom-option-names | JSON object | オプション表示名 |
| wfilm-base-prices | JSON object | ウインドフィルム部位基準価格 |
| wfilm-grade-coeff | JSON object | ウインドフィルムグレード係数 |
| maintenance-menus | JSON array | メンテナンスメニューA〜E |
| car-wash-menus | JSON array | 洗車メニュー |
| rclean-base-prices | JSON object | ルームクリーニング部位基準価格 |
| rclean-cond-coeff | JSON object | ルームクリーニング状態係数 |
| reminder-templates | JSON array | リマインダーテンプレート3件 |
| closed-weekdays | JSON array | 定休曜日（0〜6） |
| temp-holidays | JSON array | 臨時休業日（YYYY-MM-DD） |
| sns-urls | JSON object | SNS URL 4種 |
| line-header | string | LINE見積転送冒頭文 |
| line-footer | string | LINE見積転送末尾文 |
| maint-header | string | メンテナンス通知冒頭文 |
| maint-footer | string | メンテナンス通知末尾文 |

> ⚠️ **Persistence discrepancy.** Canonical persistence = KV + IndexedDB. Implementation = Supabase `dealer_settings` (mig 070). The **37 settings keys above are the canonical contract**; `dealer_settings` must store/serve all of them. Verify all 37 keys are covered in the Supabase schema. See `05_DATABASE_REQUIREMENTS.md` §3.

> **Supabase mapping:** Most canonical keys map to top-level columns in `dealer_settings` or are packed into JSONB blobs. Detailed key→column mapping is a Phase C task (see `10_ROADMAP.md`). Primary containers: `service_price_settings` (coating/window_film/maintenance/carwash/room_cleaning pricing), `ppf_price_tables` (PPF pricing), `coupon_settings`, `discount_presets`, `maintenance_reminder_templates` (= `reminder-templates` key).

---

## 8a. Extension JSONB Columns (migration 070 — not in canonical settings keys)

Migration 070 adds 12 extra JSONB/structured columns that do not correspond directly to canonical settings keys. These extend the settings contract beyond the 37-key canonical set:

| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| `store_profile` | jsonb | Structured store identity fields | Supplements individual text columns |
| `business_days` | jsonb | Business day configuration (hours, etc.) | Extends `closed_weekdays` |
| `dealer_trade_defaults` | jsonb | Trade/wholesale configuration | See `DealerTradeDefaults` type |
| `ocr_policy` | jsonb | OCR behavior rules | See `OcrPolicySettings` type; `human_confirmation_required` must always be `true` |
| `line_public_settings` | jsonb | Public-safe LINE metadata | Must NEVER contain `line_channel_secret` or `line_access_token` |
| `line_message_templates` | jsonb | Structured LINE message templates | `{estimate_sent:{header,footer}, maintenance_reminder:{header,footer}}` |
| `pdf_settings` | jsonb | PDF generation options | See `PdfSettings` type |
| `document_settings` | jsonb | Document validity/expiry rules | See `DocumentSettings` type |
| `tax_settings` | jsonb | Tax configuration | See `TaxSettings` type |
| `backup_settings` | jsonb | Backup schedule/destination | — |
| `health_settings` | jsonb | System health monitoring | — |
| `reminder_templates` | jsonb | Alias/fallback for `maintenance_reminder_templates` | Read order: `maintenance_reminder_templates` first; fall back to `reminder_templates` |

TypeScript types for these columns: `src/lib/dealer-settings/dealer-settings-types.ts` (`CanonicalDealerSettings` interface).

---

## 8. OCR in Settings — Not in Canonical JSON

`gyeon_settings_flow.json` contains **no OCR settings**. The "OCRエンジン: GPT-4o mini" display in the implementation is code-only. OCR requirements are documented from implementation in `06_OCR_REQUIREMENTS.md` and flagged as **information missing from the canonical spec** — operator decision: add OCR to the canonical settings spec.
