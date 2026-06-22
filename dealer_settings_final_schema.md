# dealer_settings — Final Schema Specification

**Version:** 1.1  
**Date:** 2026-06-22 (updated 2026-06-22)  
**Sources:**
- Current `DealerSettingsDB` (`src/lib/line/line-types.ts`)
- `gyeon_settings_flow.json` (Genspark canonical settings spec)
- `EstimateWizard.tsx` hardcoded constants (to be migrated to DB)
- Canonical settings JSON (12-group spec saved in memory)

**Rules:**
- `dealer_id` is always sourced from `getCurrentDealer()` — never from forms
- Secrets (`line_channel_secret`, `line_access_token`) are server-side only — never expose to client
- RLS must remain mandatory on this table
- All migrations require CTO approval before execution

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ EXISTS | Column already exists in current schema |
| ➕ ADD | New column to be added |
| 🔁 RENAME | Column exists but needs rename |
| ⚠️ NOTE | Exists but currently unused or partial |

---

## 1. Identity & Timestamps

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `id` | uuid | NO | gen_random_uuid() | ✅ EXISTS | PK |
| `dealer_id` | uuid | NO | — | ✅ EXISTS | FK → dealers.id, UNIQUE |
| `created_at` | timestamptz | NO | now() | ✅ EXISTS | |
| `updated_at` | timestamptz | NO | now() | ✅ EXISTS | |

---

## 2. Store Profile (店舗情報)

Maps to: gyeon_settings_flow.json `drawer_details.store` + current `DealerSettingsDB`

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `business_name` | text | YES | null | ✅ EXISTS | 店舗名 (`store-name` in Genspark) |
| `company_name` | text | YES | null | ✅ EXISTS | 会社名（法人正式名） |
| `contact_name` | text | YES | null | ✅ EXISTS | 担当者名 (`staff-name` in Genspark) |
| `postal_code` | text | YES | null | ✅ EXISTS | 郵便番号 |
| `business_address` | text | YES | null | ✅ EXISTS | 住所 |
| `business_phone` | text | YES | null | ✅ EXISTS | 電話番号 |
| `business_phone_alt` | text | YES | null | ➕ ADD | 電話番号（予備）`store-tnum` in Genspark |
| `business_email` | text | YES | null | ✅ EXISTS | メールアドレス |
| `business_website` | text | YES | null | ✅ EXISTS | Webサイト |
| `logo_url` | text | YES | null | ✅ EXISTS | ロゴURL |
| `bank_account` | text | YES | null | ➕ ADD | 振込先口座情報（フリーテキスト。`store-bank` in Genspark） |

**Decision note:** `bank_account` は Genspark では自由テキスト1フィールド。DealerOS でも同様にシンプルなテキストカラムとする。構造化（JSON）は将来拡張とする。

---

## 3. Detailer Rank & Business Days (ランク・営業日)

Maps to: gyeon_settings_flow.json `drawer_details.rank` + `drawer_details.closed-days`

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `detailer_rank` | text | NO | 'detailer' | ➕ ADD | `'detailer'` または `'certified'`。EstimateWizardのコーティング表示制御に使用 |
| `closed_weekdays` | integer[] | YES | null | ➕ ADD | 定休曜日。`[0,6]` = 日・土。`closed-weekdays` in Genspark |
| `temp_holidays` | jsonb | YES | null | ➕ ADD | 臨時休業日。`["2026-08-13","2026-08-14"]`。`temp-holidays` in Genspark |

**Constraint:** `detailer_rank` CHECK (`detailer_rank` IN ('detailer', 'certified'))

> **Owner decision (2026-06-22):** Valid values are exactly `'detailer'` and `'certified'`. No additional ranks will be added. Do not design for extensibility here — the CHECK constraint is intentionally narrow.

---

## 4. Dealer Trade Defaults (業者・掛け売り設定)

Maps to: v1.1 spec STEP1 業者設定 (currently stored in vehicles.notes as workaround)

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `default_dealer_rate_percent` | numeric(5,2) | NO | 70 | ➕ ADD | 業者掛け率デフォルト。EstimateWizardの `useState(70)` を置き換え |
| `dealer_closing_day` | smallint | YES | null | ➕ ADD | 締め日（1〜31）。`closing_day` in v1.1 spec |
| `dealer_payment_day` | smallint | YES | null | ➕ ADD | 支払日（1〜31）。`payment_day` in v1.1 spec |

**Constraint:**  
- `default_dealer_rate_percent` CHECK (0 <= val <= 100)  
- `dealer_closing_day` CHECK (1 <= val <= 31)  
- `dealer_payment_day` CHECK (1 <= val <= 31)

**Migration note:** vehicles.notes に書かれている既存の業者設定データは手動 or スクリプトによる移行が必要。vehicles.notes への新規書き込みは本カラム追加後に廃止。

---

## 5. OCR Settings (車検証OCR)

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `ocr_enabled` | boolean | NO | true | ➕ ADD | 車検証OCR機能のON/OFF。現在は常時ON（設定不可） |

**Note:** `human_confirmation_required` は設定カラム不要。コード上で常時強制（OFFにできない仕様）。

---

## 6. LINE Integration (LINE連携)

Maps to: current `DealerSettingsDB` LINE fields + gyeon_settings_flow.json `drawer_details.line` / `sns`

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `line_channel_id` | text | YES | null | ✅ EXISTS | **SERVER ONLY** |
| `line_channel_secret` | text | YES | null | ✅ EXISTS | **SERVER ONLY — never expose to client** |
| `line_access_token` | text | YES | null | ✅ EXISTS | **SERVER ONLY — never expose to client** |
| `line_liff_id` | text | YES | null | ✅ EXISTS | |
| `webhook_url` | text | YES | null | ✅ EXISTS | |
| `line_enabled` | boolean | NO | false | ✅ EXISTS | |
| `friend_add_qr_url` | text | YES | null | ➕ ADD | LINE友だち追加QRコードURL。EstimateWizardのSTEP1で使用 |
| `line_message_header` | text | YES | null | ➕ ADD | 見積LINE転送・冒頭文。`line-header` in Genspark |
| `line_message_footer` | text | YES | null | ➕ ADD | 見積LINE転送・末尾文。`line-footer` in Genspark |
| `maintenance_message_header` | text | YES | null | ➕ ADD | メンテナンス通知・冒頭文。`maint-header` in Genspark |
| `maintenance_message_footer` | text | YES | null | ➕ ADD | メンテナンス通知・末尾文。`maint-footer` in Genspark |
| `sns_urls` | jsonb | YES | null | ➕ ADD | `{ instagram, x, google, line }` URLオブジェクト。`sns-urls` in Genspark |

**Security rule:** `getDealerSettingsPublic()` は引き続き `line_channel_secret` / `line_access_token` を strip する。

---

## 7. PDF & Document Settings (PDF・書類)

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `tax_rate` | numeric(5,2) | NO | 10 | ✅ EXISTS | 消費税率（%）。10 / 8 / 0 |
| `qualified_invoice_number` | text | YES | null | ✅ EXISTS | 適格請求書番号（T番号） |
| `stamp_url` | text | YES | null | ✅ EXISTS | 印影URL |
| `pdf_footer` | text | YES | null | ✅ EXISTS | 見積書フッター |
| `invoice_note` | text | YES | null | ✅ EXISTS | 請求書備考 |
| `completion_note` | text | YES | null | ⚠️ EXISTS | 完了報告備考（DBにあり、CompanySettingsFormには非表示） |
| `terms_and_conditions` | text | YES | null | ⚠️ EXISTS | 利用規約テキスト（DBにあり、CompanySettingsFormには非表示） |

**Action:** `completion_note` と `terms_and_conditions` を `CompanySettingsForm` の「書類・税務」セクションに追加表示する（スキーマ変更不要、UI変更のみ）。

---

## 8. Pricing & Discounts (価格・割引)

Maps to: gyeon_settings_flow.json `drawer_details.coupon` + `drawer_details.discount`  
Currently hardcoded in `EstimateWizard.tsx` as `DEFAULT_COUPONS`.

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `coupon_settings` | jsonb | YES | null | ➕ ADD | クーポン5枠固定。スキーマ→下記参照 |
| `discount_presets` | jsonb | YES | null | ➕ ADD | 値引きプリセット（無制限）。スキーマ→下記参照 |

### `coupon_settings` JSONB スキーマ

```json
[
  { "name": "新規ご来店クーポン",   "amount": 5000  },
  { "name": "リピーター割引",       "amount": 3000  },
  { "name": "紹介特典クーポン",     "amount": 5000  },
  { "name": "キャンペーンクーポン", "amount": 10000 },
  { "name": "スタッフ割引",         "amount": 3000  }
]
```

**Constraint:** 配列長は常に5。追加・削除不可。名称・金額のみ変更可。`amount` は整数（円）。

### `discount_presets` JSONB スキーマ

```json
[
  { "id": "uuid-or-nanoid", "name": "下取り特典", "discount_type": "fixed",   "value": 10000 },
  { "id": "uuid-or-nanoid", "name": "紹介割引",   "discount_type": "percent", "value": 5     }
]
```

**Constraint:** `discount_type` は `'fixed'` または `'percent'`。`value` は正数。追加・削除・並び替え自由。

---

## 9. Service Price Settings (施工メニュー価格)

Maps to: gyeon_settings_flow.json `drawer_details.coating` / `ppf-new` / `window-film` / `maintenance-menu` / `car-wash` / `room-cleaning` / `option`  
Currently hardcoded in `EstimateWizard.tsx` as `COATINGS`, `TOPCOAT_BASE`, `COATING_OPTIONS`, `BODY_SIZES`.

> **Owner decision (2026-06-22):**
> - `service_price_settings` must contain **all 6 service groups**: coating, ppf, window_film, maintenance, carwash, room_cleaning. No group may be omitted.
> - PPF also requires a **dedicated `ppf_price_tables` column** (see Section 9a) for detailed partial installation pricing. `service_price_settings.ppf` holds only the active flag and plan-level overview; full pricing lives in `ppf_price_tables`.
> - PPF + coating combined estimate is a **first-class use case** and must be fully supported.

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `service_price_settings` | jsonb | YES | null | ➕ ADD | 全6施工グループの価格設定。NULL時はEstimateWizardのハードコードデフォルトにフォールバック |
| `ppf_price_tables` | jsonb | YES | null | ➕ ADD | PPF詳細価格テーブル専用（Section 9a参照）。PPF部分施工・フィルム係数・車両ランク係数・フロントガラス |

### `service_price_settings` JSONB 完全スキーマ

```jsonc
{
  // ─── コーティング ──────────────────────────────────────────────
  "coating": {
    "products": [
      // base_price_m = Mサイズ基準価格（円・税抜）
      // certified_only = true の場合、detailer_rank='certified' 時のみ表示
      { "id": "cancoat-evo",  "name": "CanCoat EVO",          "grade": "エントリー",   "base_price_m": 55000,  "certified_only": false, "active": true },
      { "id": "one-evo",      "name": "ONE EVO",              "grade": "エントリー",   "base_price_m": 45000,  "certified_only": false, "active": true },
      { "id": "pure-evo",     "name": "PURE EVO",             "grade": "スタンダード", "base_price_m": 60000,  "certified_only": false, "active": true },
      { "id": "mohs-evo",     "name": "MOHS EVO",             "grade": "スタンダード", "base_price_m": 60000,  "certified_only": false, "active": true },
      { "id": "syncro-evo",   "name": "SYNCRO EVO",           "grade": "プレミアム",   "base_price_m": 110000, "certified_only": false, "active": true },
      { "id": "infinit1",     "name": "infinit Base Type 1",  "grade": "CERTIFIED",    "base_price_m": 130000, "certified_only": true,  "active": true },
      { "id": "infinit2",     "name": "infinit Base Type 2",  "grade": "CERTIFIED",    "base_price_m": 160000, "certified_only": true,  "active": true }
    ],
    // サイズ係数（M=1.0 が基準）
    "size_multipliers": {
      "SS": 0.75, "S": 0.85, "M": 1.0, "ML": 1.15,
      "L": 1.3, "LL": 1.5, "XL": 1.7, "XXL": 1.9
    },
    // トップコートのMサイズ基準価格（円・税抜）。サイズ係数は coating.size_multipliers と同じ
    "topcoat_prices": {
      "one-evo":        15000,
      "pure-evo":       20000,
      "mohs-evo":       25000,
      "cancoat-evo":    18000,
      "cancoat-evo-pro":25000,
      "infinit1":       130000,
      "infinit2":       160000,
      "infinit-t1":     40000,
      "infinit-t2":     50000
    },
    // オプション価格（固定額・サイズ係数なし）
    "option_prices": {
      "polish":        30000,
      "iron":           8000,
      "glass":         15000,
      "wheel":         18000,
      "interior":      20000,
      "leather-clean": 15000,
      "leather-coat":  18000,
      "headlight":     12000,
      "engine-clean":  20000,
      "engine-coat":   15000
    },
    // オプション表示名（空欄でEstimateWizardデフォルト名を使用）
    "option_names": {
      "polish":        "ハードポリッシュ",
      "iron":          "鉄粉除去",
      "glass":         "ガラス撥水コート",
      "wheel":         "ホイールコーティング",
      "interior":      "室内クリーニング",
      "leather-clean": "レザークリーニング",
      "leather-coat":  "レザーコーティング",
      "headlight":     "ヘッドライトリペア",
      "engine-clean":  "エンジンルームクリーニング",
      "engine-coat":   "エンジンルームコーティング"
    }
  },

  // ─── PPF（サービスグループ登録） ──────────────────────────────
  // NOTE: 詳細価格テーブル（plan_prices / film_coeff / rank_coeff /
  //       glass_prices / parts_prices）は ppf_price_tables カラムに格納。
  //       ここには active フラグとプラン名リストのみ保持する。
  "ppf": {
    "active": true,
    // 表示上のプラン名（Wizard のカテゴリー選択に使用）
    "plan_labels": {
      "front-half": "フロントハーフ",
      "full-body":  "フルボディ",
      "partial":    "部分施工"
    }
    // 価格計算は dealer_settings.ppf_price_tables を参照
  },

  // ─── ウィンドウフィルム ────────────────────────────────────────
  "window_film": {
    // 部位基準価格（円・税抜。grade_coeff=1.0 時の価格）
    "base_prices": {
      "wf-front-side":  25000,
      "wf-rear-side":   20000,
      "wf-rear":        18000,
      "wf-quarter":     12000,
      "wf-all":         80000
    },
    // グレード係数（standard=基準）
    "grade_coeff": {
      "standard": 1.0, "premium": 1.3, "uv-cut": 1.1, "ir-cut": 1.2
    }
  },

  // ─── メンテナンスメニュー ──────────────────────────────────────
  "maintenance": {
    // 5枠固定（A〜E）。nameが空のスロットはWizardに表示しない
    "menus": [
      { "id": "A", "name": "メンテナンスA", "price": 0 },
      { "id": "B", "name": "メンテナンスB", "price": 0 },
      { "id": "C", "name": "メンテナンスC", "price": 0 },
      { "id": "D", "name": "メンテナンスD", "price": 0 },
      { "id": "E", "name": "メンテナンスE", "price": 0 }
    ]
  },

  // ─── 洗車メニュー ─────────────────────────────────────────────
  "carwash": {
    // 無制限（追加/削除可能）
    "menus": [
      { "id": "cw-hand",   "name": "手洗い洗車",      "price": 3000 },
      { "id": "cw-polish", "name": "ポリッシュ洗車",  "price": 5000 },
      { "id": "cw-coat",   "name": "簡易コーティング","price": 8000 },
      { "id": "cw-wax",    "name": "ワックス仕上げ",  "price": 5000 },
      { "id": "cw-vacuum", "name": "室内掃除機",      "price": 2000 }
    ]
  },

  // ─── ルームクリーニング ────────────────────────────────────────
  "room_cleaning": {
    // 部位基準価格（円・税抜。condition_coeff=1.0 時の価格）
    "base_prices": {
      "rc-floor":   12000,
      "rc-seat":    15000,
      "rc-ceiling":  8000,
      "rc-dash":    10000,
      "rc-full":    45000
    },
    // 状態係数（normal=基準）
    "condition_coeff": {
      "normal": 1.0, "dirty": 1.3, "heavy": 1.6
    }
  }
}
```

**Read logic in EstimateWizard:**
1. サーバーから `dealer_settings.service_price_settings` と `dealer_settings.ppf_price_tables` を取得
2. NULL または各サブキーが欠如 → EstimateWizard内のハードコードデフォルトにフォールバック
3. 値が存在 → DB値でハードコードデフォルトを上書き
4. PPF価格計算では `ppf_price_tables` を優先参照し、NULL時はウィザード内PPFデフォルトを使用

---

## 9a. PPF Price Tables — Dedicated Column (PPF詳細価格テーブル)

> **Owner decision (2026-06-22):** PPF partial installation pricing is mandatory. PPF + coating combination is a first-class use case. PPF pricing is complex enough (5 independent table groups) to require its own top-level column separate from `service_price_settings`.

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `ppf_price_tables` | jsonb | YES | null | ➕ ADD | PPF全価格テーブル。NULL時はEstimateWizardハードコードデフォルトを使用 |

### `ppf_price_tables` JSONB 完全スキーマ

```jsonc
{
  // ─── プラン×サイズ価格表（新方式・主方式） ────────────────────
  // key = "{plan}_{size_key}"。価格は円・税抜
  "plan_prices": {
    "front-half_SS":  130000, "front-half_S":  150000, "front-half_M":  170000,
    "front-half_ML":  195000, "front-half_L":  220000, "front-half_LL": 260000, "front-half_XL": 300000,
    "full-body_SS":   280000, "full-body_S":   320000, "full-body_M":   360000,
    "full-body_ML":   415000, "full-body_L":   470000, "full-body_LL":  550000, "full-body_XL":  650000,
    "roof_SS":         30000, "roof_S":         35000, "roof_M":         40000,
    "roof_ML":         45000, "roof_L":         52000, "roof_LL":        60000,  "roof_XL":        70000
    // front-half / full-body / roof / hood / door-edge は必須プラン
    // partial は ppf_price_tables.parts_prices で個別計算
  },

  // ─── フィルム係数（clear = 1.0 が基準） ──────────────────────
  "film_coeff": {
    "clear":     1.0,
    "matte":     1.3,
    "color":     1.2,
    "self-heal": 1.1
  },

  // ─── 車両ランク係数（std = 1.0 が基準） ─────────────────────
  // 適用タイミング: plan_price × film_coeff × rank_coeff
  "rank_coeff": {
    "std":     1.0,
    "premium": 1.3,
    "ultra":   1.6
  },

  // ─── フロントガラス価格（円・税抜。係数なし・固定額） ─────────
  "glass_prices": {
    "ppf": 80000,
    "tpu": 60000
  },

  // ─── 単品部位価格（部分施工・旧方式も兼用） ──────────────────
  // PPF + coating 組み合わせ時に部位単位で加算できる
  // 価格は円・税抜・固定額（サイズ係数なし）
  "parts_prices": {
    "sp-headlight":  25000,
    "sp-b-pillar":   15000,
    "sp-c-pillar":   15000,
    "sp-mirror":     12000,
    "sp-step":       10000,
    "sp-rear-bump":  18000,
    "sp-door-cup":    8000,
    "sp-hood":       35000,
    "sp-door-edge":  12000
  }
}
```

**価格計算式（PPFフルプラン）:**
```
price = plan_prices["{plan}_{size_key}"] × film_coeff[filmId] × rank_coeff[rankId]
```

**価格計算式（PPF部分施工）:**
```
price = Σ parts_prices[partId]   // サイズ係数・フィルム係数なし
```

**PPF + コーティング 組み合わせ時の処理:**
- body_size は coating と PPF で共有（STEP2で1回だけ選択）
- 合計 = coating_price(coatId, sizeKey) + ppf_price(plan, sizeKey, filmId, rankId)
- Wizard の nextScreen() 優先順: coating → ppf → window → ... の順でステップを消費
- 最終確認（STEP5）で全カテゴリーの小計を分離表示してから税計算

---

## 10. Maintenance Reminder Templates (リマインダー)

Maps to: gyeon_settings_flow.json `drawer_details.reminder-templates`

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `maintenance_reminder_templates` | jsonb | YES | null | ➕ ADD | 3枠固定。スキーマ→下記参照 |

### `maintenance_reminder_templates` JSONB スキーマ

```json
[
  {
    "id": 1,
    "name": "1ヶ月メンテナンス",
    "months_after": 1,
    "message": "",
    "menus": [],
    "enabled": false,
    "repeat_yearly": false
  },
  {
    "id": 2,
    "name": "6ヶ月メンテナンス",
    "months_after": 6,
    "message": "",
    "menus": [],
    "enabled": false,
    "repeat_yearly": false
  },
  {
    "id": 3,
    "name": "12ヶ月メンテナンス",
    "months_after": 12,
    "message": "",
    "menus": [],
    "enabled": true,
    "repeat_yearly": false
  }
]
```

**Constraint:** 配列長は常に3。`id` は 1/2/3 固定。`menus` は `maintenance.menus[].id` の参照配列。

---

## 11. Estimate Category — Multiple Selection Rules (見積カテゴリー複数選択)

> **Owner decision (2026-06-22):** Single-category selection is prohibited. The estimate flow **must** support multiple categories per estimate. The following rules apply to both the Wizard UI and the price calculation logic.

### Valid Categories

| category_id | Label | Body size required | Price source |
|-------------|-------|-------------------|-------------|
| `coating` | ボディコーティング | YES | `service_price_settings.coating` |
| `ppf` | PPF施工 | YES | `ppf_price_tables` |
| `window` | ウィンドウフィルム | NO (部位ベース) | `service_price_settings.window_film` |
| `maintenance` | ボディ定期メンテナンス | NO | `service_price_settings.maintenance` |
| `carwash` | メンテナンス洗車 | NO | `service_price_settings.carwash` |
| `roomclean` | ルームクリーニング | NO (部位ベース) | `service_price_settings.room_cleaning` |
| `other` | その他作業 | NO | 自由入力 |

### Supported Combinations (Examples)

```
coating + ppf
coating + ppf + roomclean
coating + ppf + window + maintenance
ppf + window
coating + maintenance + carwash
coating + ppf + roomclean + other
```

All combinations are valid. No combination is blocked.

### Body Size Sharing Rule

- `coating` と `ppf` はどちらもボディサイズが必要。
- 同一見積内で両方が選択されている場合、STEP2のボディサイズ選択を**1回だけ**行い、両方に同じ `size_key` を適用する。
- `window_film` と `room_cleaning` は部位ベース価格であり、ボディサイズ係数を使用しない。

### Processing Priority Order

Wizard の nextScreen() は選択カテゴリーを以下の優先順で処理する:

```
1. coating  (STEP3 → STEP4)
2. ppf      (step-ppf)
3. window   (step-window)
4. maintenance (step-maintenance)
5. carwash  (step-carwash)
6. roomclean (step-roomclean)
7. other    (step-other)
8. → STEP5 (最終確認・合計)
```

選択されていないカテゴリーのステップは自動的にスキップされる。

### STEP2 Trigger Rule

STEP2（ボディサイズ選択）は `coating` または `ppf` が1つ以上選択されている場合のみ表示する。  
`window` + `carwash` のみの組み合わせなど、どちらも含まない場合はSTEP2をスキップしてSTEP1の次のサービスステップへ進む。

### STEP5 (最終確認) 表示ルール

- 選択された各カテゴリーの小計を個別行で表示
- 合算した subtotal に対してクーポン・値引き・業者掛け率を適用
- 税額は `(subtotal - 各種割引) × tax_rate / 100`

---

## 12. Onboarding (オンボーディング)

| Column | Type | Nullable | Default | Status | Notes |
|--------|------|----------|---------|--------|-------|
| `onboarding_completed` | boolean | NO | false | ✅ EXISTS | |
| `onboarding_completed_at` | timestamptz | YES | null | ✅ EXISTS | |
| `onboarding_step` | smallint | NO | 0 | ✅ EXISTS | |

---

## 13. Final Column Summary

全カラム一覧（最終確定）:

```sql
-- Identity
id                              uuid PRIMARY KEY DEFAULT gen_random_uuid()
dealer_id                       uuid NOT NULL UNIQUE REFERENCES dealers(id)
created_at                      timestamptz NOT NULL DEFAULT now()
updated_at                      timestamptz NOT NULL DEFAULT now()

-- Store Profile
business_name                   text
company_name                    text
contact_name                    text
postal_code                     text
business_address                text
business_phone                  text
business_phone_alt              text                           -- ➕ NEW
business_email                  text
business_website                text
logo_url                        text
bank_account                    text                           -- ➕ NEW

-- Detailer Rank & Business Days
detailer_rank                   text NOT NULL DEFAULT 'detailer'  -- ➕ NEW
                                    CHECK (detailer_rank IN ('detailer','certified'))
closed_weekdays                 integer[]                      -- ➕ NEW
temp_holidays                   jsonb                          -- ➕ NEW

-- Dealer Trade Defaults
default_dealer_rate_percent     numeric(5,2) NOT NULL DEFAULT 70  -- ➕ NEW
                                    CHECK (default_dealer_rate_percent BETWEEN 0 AND 100)
dealer_closing_day              smallint CHECK (dealer_closing_day BETWEEN 1 AND 31)  -- ➕ NEW
dealer_payment_day              smallint CHECK (dealer_payment_day BETWEEN 1 AND 31)  -- ➕ NEW

-- OCR Settings
ocr_enabled                     boolean NOT NULL DEFAULT true  -- ➕ NEW

-- LINE Integration (server-side secrets)
line_channel_id                 text
line_channel_secret             text                           -- SERVER ONLY
line_access_token               text                           -- SERVER ONLY
line_liff_id                    text
webhook_url                     text
line_enabled                    boolean NOT NULL DEFAULT false
friend_add_qr_url               text                           -- ➕ NEW
line_message_header             text                           -- ➕ NEW
line_message_footer             text                           -- ➕ NEW
maintenance_message_header      text                           -- ➕ NEW
maintenance_message_footer      text                           -- ➕ NEW
sns_urls                        jsonb                          -- ➕ NEW

-- PDF & Document Settings
tax_rate                        numeric(5,2) NOT NULL DEFAULT 10
qualified_invoice_number        text
stamp_url                       text
pdf_footer                      text
invoice_note                    text
completion_note                 text
terms_and_conditions            text

-- Pricing & Discounts
coupon_settings                 jsonb                          -- ➕ NEW
discount_presets                jsonb                          -- ➕ NEW

-- Service Price Settings (全6サービスグループ含む)
service_price_settings          jsonb                          -- ➕ NEW

-- PPF Dedicated Price Tables (詳細価格・部分施工・係数テーブル)
ppf_price_tables                jsonb                          -- ➕ NEW

-- Reminders
maintenance_reminder_templates  jsonb                          -- ➕ NEW

-- Onboarding
onboarding_completed            boolean NOT NULL DEFAULT false
onboarding_completed_at         timestamptz
onboarding_step                 smallint NOT NULL DEFAULT 0
```

**新規カラム数: 19本**（`ppf_price_tables` 追加により +1）  
**既存カラム数: 29本**  
**最終合計: 48本**

---

## 14. TypeScript 型定義（最終版）

`src/lib/line/line-types.ts` の `DealerSettingsDB` に追加するフィールド:

```typescript
// ─── Store Profile additions ──────────────────────────────────────────────
business_phone_alt:  string | null;  // ➕
bank_account:        string | null;  // ➕

// ─── Detailer Rank & Business Days ───────────────────────────────────────
detailer_rank:       'detailer' | 'certified';  // ➕
closed_weekdays:     number[] | null;            // ➕
temp_holidays:       string[] | null;            // ➕  YYYY-MM-DD[]

// ─── Dealer Trade Defaults ────────────────────────────────────────────────
default_dealer_rate_percent: number;  // ➕
dealer_closing_day:  number | null;   // ➕
dealer_payment_day:  number | null;   // ➕

// ─── OCR Settings ────────────────────────────────────────────────────────
ocr_enabled:         boolean;  // ➕

// ─── LINE additions ───────────────────────────────────────────────────────
friend_add_qr_url:           string | null;  // ➕
line_message_header:         string | null;  // ➕
line_message_footer:         string | null;  // ➕
maintenance_message_header:  string | null;  // ➕
maintenance_message_footer:  string | null;  // ➕
sns_urls:                    {
  instagram?: string;
  x?:         string;
  google?:    string;
  line?:      string;
} | null;  // ➕

// ─── Pricing & Discounts ─────────────────────────────────────────────────
coupon_settings:   CouponSetting[] | null;    // ➕
discount_presets:  DiscountPreset[] | null;   // ➕

// ─── Service Price Settings (全6グループ) ────────────────────────────────
service_price_settings: ServicePriceSettings | null;  // ➕

// ─── PPF Dedicated Price Tables ──────────────────────────────────────────
ppf_price_tables: PpfPriceTables | null;  // ➕

// ─── Reminders ────────────────────────────────────────────────────────────
maintenance_reminder_templates: ReminderTemplate[] | null;  // ➕
```

---

## 15. Migration Draft Plan (マイグレーションドラフト)

> **DRAFT ONLY — マイグレーションファイル未作成。実行禁止。CTOレビュー必須。**

### Migration 001 — Store Profile & Business Ops

```sql
-- dealer_settings に追加
ALTER TABLE dealer_settings
  ADD COLUMN business_phone_alt             text,
  ADD COLUMN bank_account                   text,
  ADD COLUMN detailer_rank                  text NOT NULL DEFAULT 'detailer'
                                              CHECK (detailer_rank IN ('detailer','certified')),
  ADD COLUMN closed_weekdays                integer[],
  ADD COLUMN temp_holidays                  jsonb,
  ADD COLUMN default_dealer_rate_percent    numeric(5,2) NOT NULL DEFAULT 70
                                              CHECK (default_dealer_rate_percent BETWEEN 0 AND 100),
  ADD COLUMN dealer_closing_day             smallint
                                              CHECK (dealer_closing_day BETWEEN 1 AND 31),
  ADD COLUMN dealer_payment_day             smallint
                                              CHECK (dealer_payment_day BETWEEN 1 AND 31),
  ADD COLUMN ocr_enabled                    boolean NOT NULL DEFAULT true;
```

**リスク:** LOW。全カラムが nullable or DEFAULT付き。既存データに影響なし。

### Migration 002 — LINE & SNS Extensions

```sql
ALTER TABLE dealer_settings
  ADD COLUMN friend_add_qr_url             text,
  ADD COLUMN line_message_header           text,
  ADD COLUMN line_message_footer           text,
  ADD COLUMN maintenance_message_header    text,
  ADD COLUMN maintenance_message_footer    text,
  ADD COLUMN sns_urls                      jsonb;
```

**リスク:** LOW。全カラム nullable。

### Migration 003 — Pricing & Service Settings

```sql
ALTER TABLE dealer_settings
  ADD COLUMN coupon_settings                jsonb,
  ADD COLUMN discount_presets               jsonb,
  ADD COLUMN service_price_settings         jsonb,  -- 全6サービスグループ
  ADD COLUMN ppf_price_tables               jsonb,  -- PPF専用詳細価格テーブル
  ADD COLUMN maintenance_reminder_templates jsonb;
```

**リスク:** LOW。全カラム nullable。EstimateWizardはNULL時ハードコードフォールバックで動作継続。PPF + coatingの複数カテゴリー見積はフォールバック値でも機能する。

### Migration 004 — Default Data Backfill (optional)

```sql
-- coupon_settings のデフォルト値を既存レコードに設定
UPDATE dealer_settings
SET coupon_settings = '[
  {"name":"新規ご来店クーポン","amount":5000},
  {"name":"リピーター割引","amount":3000},
  {"name":"紹介特典クーポン","amount":5000},
  {"name":"キャンペーンクーポン","amount":10000},
  {"name":"スタッフ割引","amount":3000}
]'::jsonb
WHERE coupon_settings IS NULL;

-- maintenance_reminder_templates のデフォルト値
UPDATE dealer_settings
SET maintenance_reminder_templates = '[
  {"id":1,"name":"1ヶ月メンテナンス","months_after":1,"message":"","menus":[],"enabled":false,"repeat_yearly":false},
  {"id":2,"name":"6ヶ月メンテナンス","months_after":6,"message":"","menus":[],"enabled":false,"repeat_yearly":false},
  {"id":3,"name":"12ヶ月メンテナンス","months_after":12,"message":"","menus":[],"enabled":true,"repeat_yearly":false}
]'::jsonb
WHERE maintenance_reminder_templates IS NULL;
```

**リスク:** MEDIUM。UPDATE文は既存レコードに書き込む。バックアップ確認後に実行。

### Migration 005 — vehicles.notes 業者データ移行

```sql
-- vehicles.notes に "dealer_rate:" / "closing_day:" / "payment_day:" 形式で
-- 書き込まれているデータがある場合、dealer_settings に移行する。
-- 実際のパターンはコードレビューで確認してから作成。
-- DRAFT — 実際のSQLはvehicles.notesの現在フォーマット確認後に作成。
```

**リスク:** HIGH（既存データ変換）。実行前にvehicles.notesの全データをバックアップ必須。

---

## 16. RLS Policy (確認事項)

現行の dealer_settings RLS ポリシーが以下を保証していることを migration 前に確認:

1. `SELECT`: dealer_idに一致する自ディーラーのみ参照可
2. `UPDATE`: dealer_idに一致する自ディーラーのみ更新可
3. `INSERT`: dealer_idは `getCurrentDealer()` から server-side で注入。フォームからの直接INSERTは不可
4. `line_channel_secret` / `line_access_token` を返すクエリはサーバーサイドのみ（`"use server"` 関数内）

---

## 17. What This Schema Does NOT Include

以下は dealer_settings の対象外。別テーブルで管理:

| 項目 | 管理テーブル |
|-----|------------|
| 書類番号 (prefix/padding/reset) | `document_sequences` |
| スタッフ情報 | `dealer_members` |
| プラン・サブスクリプション | `subscriptions` |
| ヘルスチェック | `health_checks` (or runtime-only) |
| 顧客・車両・見積データ | 各専用テーブル |
