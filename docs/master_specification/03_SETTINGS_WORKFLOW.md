# 03 — SETTINGS WORKFLOW
## Store Registration & Settings — Canonical Specification

> **Derived directly from `gyeon_settings_flow.json`** (`meta.version = 2024-06`).
> Canonical. Documents auth, plans, init sequence, every settings group, every drawer, the save mechanism, and persistence. Implementation (`src/app/settings`, `lib/dealer-settings`, `components/settings/SettingsCategoryNav.tsx`, migration `070_dealer_settings_canonical.sql`) must conform.

---

## 1. Authentication Flow

**Startup sequence:**
1. `DOMContentLoaded`.
2. If URL has `?t=TOKEN`, store in localStorage + Cookie (legacy compat).
3. `getAuthToken()` — localStorage first → Cookie fallback.
4. Token present → `fetchPlan()` (server user info).
5. Success → `_initApp()` → `showAppWithPlan()` → home.
6. Failure (network) → retry after 3 s → still failing → auth screen.
7. No token → auth screen (`screen-auth`).

**Panels:**
- **Login:** `auth-login-email` (email, req), `auth-login-pw` (password, req). Both required; empty → client error (no submit). API `POST /api/auth/login` {email,password} → success: `setAuthToken(data.token)`, `_currentUser=data.user`, `showAppWithPlan()`; failure: show `data.error`. Links to register / reset.
- **Register:** `auth-reg-email`, `auth-reg-pw`, `auth-reg-pw2`. pw≠pw2 → "パスワードが一致しません". API `POST /api/auth/register`. Goes straight into app after register (no email verification).
- **Reset:** `auth-reset-email`. API `POST /api/auth/reset-request`. Same success message on success/failure (security).

**Token management:** key `gyeon_auth_token`; storage localStorage (primary) + Cookie (SameSite=Lax/Secure/365d). Get: localStorage→Cookie (and write back). Set: both. Clear: remove both. iOS: Cookie shared Safari↔PWA enables hand-off.
**Logout:** `POST /api/auth/logout` (Bearer token) → `clearAuthToken()` → `_currentUser=null` → auth screen.

> ⚠️ Implementation uses **Supabase Auth** (email/password) + middleware, not this custom `AuthToken`/`/api/auth/*` scheme. Business intent (email/password login, register-then-enter, password reset, persistent session) is preserved. Operator decision: keep Supabase Auth as the canonical auth (recommended). See `08` §6.

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

> Implemented plans (per `lib/subscription`, mig 058): Trial / Pro / Pro Plus. The canonical `free` tier and exact gating must be reconciled with the implemented subscription tiers — operator decision.

---

## 3. App Init Sequence (after login)

1 `initDB()` (IndexedDB gyeon_db v5) · 2 `loadSettings()` (KV→IndexedDB) · 3 `loadStaffSettings()` · 4 `loadClosedSettings()` · 5 `updateHistoryCount()` · 6 `updateReminderCount()` · 7 `updateScheduleBadge()` · 8 `_fixBrokenScheduleDates()` (end<start auto-repair) · 9 `renderSizeGrid()` · 10 `renderCoatingList()` · 11 `renderOptionsList()` · 12 `refreshLineInboxBadge()` · 13 Cloud Sync pull (after 1.5 s).

> Legacy init order. In the Supabase implementation the equivalent is server-side data fetching per route. Preserve the *badge/counter* semantics (history count, reminder count, today's schedule, LINE unread).

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

## 5. Drawer Details (input · save target · validation)

### 5.1 Store Settings — `store`
Fields (db_key): store-name, staff-name, phone, address, email, store-tnum (予備), store-bank (振込先口座). Special: logo image (file → immediate IndexedDB only, not KV). Save targets: IndexedDB(settings) + Cloudflare KV (`POST /api/settings` partial). After save: update `store-name-display` on home.

### 5.2 Staff names — `staff-names`
`staff-name-input-{0..4}`; default "スタッフ{N}". db_key `staff-list` = JSON `[{id,name,color}]`. **Fixed 5 (no add/remove).**

### 5.3 Closed days — `closed-days`
`closed-weekdays` JSON `[0..6]` (0=Sun…6=Sat, multi). `temp-holidays` JSON `['YYYY-MM-DD']`. Real-time into `_shopClosedWeekdays`/`_shopTempHolidays`, written on save.

### 5.4 Detailer rank — `rank`
Radio: `detailer` (GYEONディテーラー) / `certified` (Certified Detailer). db_key `detailer-rank`. Effects: enables infinit1/infinit2 in STEP3 (certified only); changes topcoat options & detailer-type-card.

### 5.5 Pricing — coupon / discount / tax (group g2)
- **coupon:** 5 fixed slots `[{name,amount}]`, db_key `coupons`. Defaults: 新規ご来店 5,000 / リピーター 3,000 / 紹介特典 5,000 / キャンペーン 10,000 / スタッフ 3,000. Applied in STEP5.
- **discount:** `[{name,discountType:'percent'|'fixed',value}]`, db_key `discounts`, **unlimited** slots.
- **tax:** select `10` / `8` (軽減) / `0` (非課税), db_key `tax`.

### 5.6 PPF settings — `ppf` (legacy) & `ppf-new`
- **ppf (legacy):** `{partId:price}`, db_key `ppf-prices`. Parts: headlight, b-pillar, c-pillar, mirror, step, rear-bump, door-cup. (Superseded by ppf-new.)
- **ppf-new (current):** tabs plan/film/rank/glass/parts. Save keys: `ppf-plan-prices` `{'front-half_SS':130000,…}`, `ppf-film-coeff` `{clear:1.0,…}`, `ppf-rank-coeff` `{std:1.0,…}`, `ppf-glass-prices` `{ppf:80000,tpu:60000}`, `ppf-parts-prices` `{'sp-headlight':25000,…}`.

### 5.7 Service-menu pricing (group g3)
- **coating:** tabs base/size/topcoat. Keys: `custom-coating-prices` (M base), `custom-size-multi` (size coeff), `custom-topcoat-prices` (M topcoat).
- **option:** `custom-option-prices`, `custom-option-names` (blank = default name).
- **window-film:** tabs base/grade. Keys: `wfilm-base-prices`, `wfilm-grade-coeff`.
- **maintenance-menu:** 5 slots A–E `[{id,name,price}]`, db_key `maintenance-menus` (blank name = hidden).
- **car-wash:** unlimited `[{id,name,price}]`, db_key `car-wash-menus` (defaults cw-hand…cw-vacuum).
- **room-cleaning:** tabs base/condition. Keys: `rclean-base-prices`, `rclean-cond-coeff` `{normal:1.0,dirty:1.3,heavy:1.6}`.

### 5.8 Reminder — `reminder-templates`
3 slots `[{id,name,months,menus,message,enabled,yearly}]`, db_key `reminder-templates`. Defaults: 1-month (enabled:false), 6-month (false), 12-month (enabled:true). Editable: name, message (LINE text), menus, enabled, yearly (template 3 only). 1- & 6-month toggled per-customer in customer screen; 12-month toggled here.

### 5.9 LINE settings (group g5 — hidden / 準備中)
- **line (挨拶文):** `line-header`, `line-footer` (estimate-forward), `maint-header`, `maint-footer` (maintenance notice).
- **sns:** `s-sns-instagram/x/google/line` → `sns-urls` JSON.
- **line-api:** Channel ID, Channel Secret, Webhook URL (auto-generated). Save target **D1 server-side only** (not KV), `saveLineApiSettings()`.
- **auto-message:** D1 server-side only, `saveAutoMessageSettings()`.

> See `06_LINE_REQUIREMENTS.md` for full LINE spec.

### 5.10 Data & support (g6/g7)
- exportData() → JSON export of settings + estimates.
- confirmClearData() → **destructive** full wipe.
- Legal screens: contact, terms, privacy.

---

## 6. Drawer Save Mechanism

1 「保存する」 → `saveDrawerSettings()`. 2 button → disabled "保存中…". 3 `saveDrawerByKey(key)`: collect DOM values → `dbPut('settings',{key,value})` → accumulate `kvPatch` → after all items `POST /api/settings` (batch). 4 success → `screen-settings` → `closeSettingsDrawer()` → Toast "✅ 保存が完了しました"; failure → Toast "❌ 保存に失敗しました: {error}". 5 restore button.
Exceptions: `line-api`/`auto-message` save via D1 API (skip KV patch).
Load: `openSettingsDrawer(key)` → `loadDrawerValues(key)` → `dbGet()` from IndexedDB(settings) → DOM; fallback default when unsaved.

---

## 7. Settings Persistence

Stores & priority:
1. **Cloudflare KV** (server/cloud) — `POST/GET /api/settings`, auth `X-Auth-Token`. Priority 1 (loaded at startup → into IndexedDB).
2. **IndexedDB (settings store)** — `{key,value}`. Priority 2 (post-KV; offline fallback).

Load sequence: online → KV→IndexedDB (KV overwrites); offline → IndexedDB only (warn & continue).

**All canonical settings keys (39):** store-name, staff-name, staff-list, phone, address, email, store-tnum, store-bank, detailer-rank, tax, coupons, discounts, ppf-prices, ppf-plan-prices, ppf-film-coeff, ppf-rank-coeff, ppf-glass-prices, ppf-parts-prices, custom-coating-prices, custom-size-multi, custom-topcoat-prices, custom-option-prices, custom-option-names, wfilm-base-prices, wfilm-grade-coeff, maintenance-menus, car-wash-menus, rclean-base-prices, rclean-cond-coeff, reminder-templates, closed-weekdays, temp-holidays, sns-urls, line-header, line-footer, maint-header, maint-footer.

> ⚠️ **Persistence discrepancy.** Canonical persistence = KV + IndexedDB. Implementation = Supabase `dealer_settings` (canonical schema, mig 070). The **39 settings keys above are the canonical contract**; the implemented `dealer_settings` must store/serve all of them. Operator decision: confirm `dealer_settings` covers every key. See `04` §3.

---

## 8. OCR in settings — NOT in canonical JSON

`gyeon_settings_flow.json` contains **no OCR settings**. The "OCRエンジン: GPT-4o mini" entry exists only in the *implementation* (`components/settings/SettingsCategoryNav.tsx`). OCR requirements are therefore documented from implementation in `05_OCR_REQUIREMENTS.md` and flagged as **information missing from the canonical spec** (operator decision: add OCR to the canonical settings spec).
