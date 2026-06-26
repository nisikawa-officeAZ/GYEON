# 02 — BUSINESS WORKFLOW
## Estimate Creation — Canonical Specification

> **Derived directly from `gyeon_flow.json`** (`meta.version = 2024-06`).
> This document is canonical. It documents every screen, step, condition, calculation, and transition exactly as defined in the JSON. The implementation (`src/components/estimates/EstimateWizard.tsx`, `src/components/flow/`, `lib/estimates`) must conform to this.

---

## 1. Screens (13)

| Screen ID | Name |
|-----------|------|
| `screen-home` | ホーム |
| `screen-category` | カテゴリ選択 |
| `screen-step1` | STEP1 顧客・車両情報 |
| `screen-step2` | STEP2 ボディサイズ選択 |
| `screen-step3` | STEP3 コーティング選択 |
| `screen-step4` | STEP4 追加オプション |
| `screen-step-ppf` | PPF見積ステップ |
| `screen-step-window` | ウインドフィルム見積ステップ |
| `screen-step-maintenance` | メンテナンス見積ステップ |
| `screen-step-carwash` | 洗車メニューステップ |
| `screen-step-roomclean` | ルームクリーニングステップ |
| `screen-step-other` | その他作業ステップ |
| `screen-step5` | STEP5 お見積書確認・完了 |

Terminal targets (non-screens): `screen-complete`, `LINE共有`, `PDF生成`.

---

## 2. Categories (7) — multi-select

| id | label |
|----|-------|
| `coating` | コーティング（GYEON） |
| `ppf` | PPFフィルム |
| `window` | ウインドフィルム |
| `maintenance` | メンテナンス |
| `carwash` | 洗車 |
| `roomclean` | ルームクリーニング |
| `other` | その他作業 |

One or more categories may be selected. The selected categories determine which steps run and in what order.

---

## 3. Flow & Transitions

Start: `screen-home`.

### 3.1 Transition table

| From | Trigger / Condition | To | Note |
|------|--------------------|----|----|
| `screen-home` | 「新規見積もり作成」ボタン | `screen-category` | |
| `screen-category` | coating OR ppf selected | `screen-step1` | STEP1→STEP2 (body size) required |
| `screen-category` | only window/carwash/roomclean/maintenance/other | `screen-step1` | STEP2 may be skipped |
| `screen-step1` | coating OR ppf selected | `screen-step2` | body size required (`needsBodySize()==true`) |
| `screen-step1` | window only | `screen-step-window` | |
| `screen-step1` | carwash only | `screen-step-carwash` | |
| `screen-step1` | roomclean only | `screen-step-roomclean` | |
| `screen-step1` | other only | `screen-step-other` | |
| `screen-step1` | maintenance only | `screen-step-maintenance` | |
| `screen-step2` | coating selected (priority 1) | `screen-step3` | |
| `screen-step2` | ppf selected, no coating (priority 2) | `screen-step-ppf` | |
| `screen-step2` | window selected, no coating/ppf (priority 3) | `screen-step-window` | |
| `screen-step3` | (after coating selection) | `screen-step4` | |
| `screen-step4` | ppf(1) / window(2) / maintenance(3) / carwash(4) / roomclean(5) / other(6); else | first matching, else `screen-step5` | priority-ordered |
| `screen-step-ppf` | window(1)/carwash(2)/roomclean(3)/other(4); else | first matching, else `screen-step5` | |
| `screen-step-window` | carwash(1)/roomclean(2)/other(3); else | first matching, else `screen-step5` | |
| `screen-step-maintenance` | carwash(1)/roomclean(2)/other(3); else | first matching, else `screen-step5` | |
| `screen-step-carwash` | roomclean(1)/other(2); else | first matching, else `screen-step5` | |
| `screen-step-roomclean` | other(1); else | `screen-step-other`, else `screen-step5` | |
| `screen-step-other` | (always) | `screen-step5` | |
| `screen-step5` | 「保存して完了」 | `screen-complete` | IndexedDB save + Cloud Sync push¹ |
| `screen-step5` | 「LINE転送」 | LINE共有 | send estimate text via LINE |
| `screen-step5` | 「PDF保存」 | PDF生成 | html2canvas → PDF¹ |

¹ Persistence/sync described against the legacy Genspark runtime; see `04_DATABASE_REQUIREMENTS.md` §4.

### 3.2 Canonical ordering rule
Steps execute in this fixed category order, each skipped if its category is not selected:
**coating(→size→coating→options) → ppf → window → maintenance → carwash → roomclean → other → STEP5.**
Body-size (STEP2) is shown only if `coating` or `ppf` is selected.

---

## 4. Step Details

### 4.1 STEP1 — 顧客・車両情報 (`screen-step1`)
Fields:
- **customer.name** (text, **required**, "お客様名")
- customer.phone (tel), customer.address (text)
- car.maker, car.model, car.year (number), car.color, car.plate
- line_id (text)
- **is_dealer** (boolean, "業者フラグ（業販）")
- **dealer_rate** (number %, shown when `is_dealer === true`, default **100**)

Special features:
- Existing-customer picker modal (search the customer store).
- `detectPpfRankFromMaker` — auto-detects PPF vehicle rank from the maker input.
- "Next" button label changes dynamically based on selected categories.

### 4.2 STEP2 — ボディサイズ選択 (`screen-step2`)
Display condition: only when `coating` OR `ppf` selected.
Input modes: (a) manual 8-size buttons; (b) dimension input (L×W×H mm → auto-classify).

| key | name | baseMulti | m³ range |
|-----|------|-----------|----------|
| SS | 軽自動車 | 0.75 | < 8.5 or 全長≤3400mm |
| S | コンパクト | 0.85 | 8.5–10.5 |
| M | セダン/HB | 1.0 | 10.5–12.2 (基準) |
| ML | ミニバンS | 1.15 | 12.2–13.5 |
| L | ミニバンL | 1.3 | 13.5–14.0 |
| LL | SUV/大型 | 1.5 | 14.0–17.7 |
| XL | 高級大型 | 1.7 | ≥17.7 |
| XXL | プレミアムカー | 1.9 | manual only |

> ⚠️ **Known canonical inconsistency:** body sizes use `XL`/`XXL`, but PPF `plan_prices` (§4.5) are keyed `LL+`. The size key set and the PPF price key set do not align. Flagged for operator decision (see `09`/report).

### 4.3 STEP3 — GYEONコーティング選択 (`screen-step3`)
Display condition: only when `coating` selected.
Detailer rank modes: `detailer` (normal) / `certified`.

| id | name | grade | basePrice_M (¥) | certified_only |
|----|------|-------|-----------------|----------------|
| cancoat-evo | CanCoat EVO | エントリー | 55,000 | false |
| one-evo | ONE EVO | エントリー | 45,000 | false |
| pure-evo | PURE EVO | スタンダード | 60,000 | false |
| mohs-evo | MOHS EVO | スタンダード | 60,000 | false |
| syncro-evo | SYNCRO EVO | プレミアム | 110,000 | false |
| infinit1 | infinit Base Type 1 | CERTIFIED | 130,000 | **true** |
| infinit2 | infinit Base Type 2 | CERTIFIED | 160,000 | **true** |

**Price formula:** `最終価格 = getBasePrice(coatingId) × getSizeMulti(sizeKey)`

**Layer modes:** `none` (single) / `2layer` (main + topcoat) / `3layer` (main + topcoat×2).

**Topcoat options by context:**
- detailer_2layer: ONE EVO, PURE EVO, MOHS EVO, CanCoat EVO
- detailer_3layer: CanCoat EVO
- certified_normal_2layer: + CanCoat EVO PRO
- certified_normal_3layer: CanCoat EVO, CanCoat EVO PRO
- certified_infinit_2layer: infinit Base T1/T2, infinit TopCoat T1/T2
- certified_infinit_3layer: infinit TopCoat T1/T2
- syncro_2layer: MOHS EVO · syncro_3layer: 不可 (not allowed)

**Topcoat base prices (M, ¥):** one-evo 15,000 · pure-evo 20,000 · mohs-evo 25,000 · cancoat-evo 18,000 · cancoat-evo-pro 25,000 · infinit1 130,000 · infinit2 160,000 · infinit-t1 40,000 · infinit-t2 50,000.
**Topcoat formula:** `getTopcoatBasePrice(topcoatId) × getSizeMulti(sizeKey)`.

### 4.4 STEP4 — 追加オプション (`screen-step4`)
Display condition: only when `coating` selected (optional — 0 items allowed).
**Options are fixed price (NOT affected by size multiplier).**

| id | name | price (¥) |
|----|------|-----------|
| polish | ハードポリッシュ | 30,000 |
| iron | 鉄粉除去 | 8,000 |
| glass | ガラス撥水コート | 15,000 |
| wheel | ホイールコーティング | 18,000 |
| interior | 室内クリーニング | 20,000 |
| leather-clean | レザークリーニング | 15,000 |
| leather-coat | レザーコーティング | 18,000 |
| headlight | ヘッドライトリペア | 12,000 |
| engine-clean | エンジンルームクリーニング | 20,000 |
| engine-coat | エンジンルームコーティング | 15,000 |

### 4.5 PPF step (`screen-step-ppf`)
Display condition: `ppf` selected. Sub-steps: ①plan ②film type ③vehicle rank ④front-glass option (optional) ⑤single parts (optional).

**Plans & prices (¥) by size:**
| plan | SS | S | M | ML | L | LL | LL+ |
|------|----|----|----|----|----|----|----|
| front-half (フロントフル) | 130,000 | 150,000 | 170,000 | 180,000 | 190,000 | 220,000 | 260,000 |
| full-body (フルボディ) | 250,000 | 290,000 | 330,000 | 350,000 | 370,000 | 430,000 | 520,000 |

**Film types (coeff):** clear 1.0 · matte 1.3 · carbon 1.5 · color 1.8
**Vehicle ranks (coeff):** std 1.0 · premium 1.3 · upper 1.5 · luxury 1.8
**Auto-detect rank from maker:**
- luxury: フェラーリ, ランボルギーニ, マクラーレン, ベントレー, ロールスロイス, マセラティ, アストンマーチン
- upper: BMW, Mercedes, Audi, VW, ポルシェ, ランドローバー, ボルボ, ジャガー, テスラ, レクサス
- premium: トヨタ, 日産, ホンダ, マツダ, スバル, 三菱, スズキ, ダイハツ
- std: anything else / unknown (manual)

**Front-glass options:** ppf (PPFフィルム貼り) ¥80,000 · tpu (TPUフィルム貼り) ¥60,000
**Single parts (¥):** sp-headlight 25,000 · sp-b-pillar 15,000 · sp-c-pillar 15,000 · sp-mirror 12,000 · sp-step 18,000 · sp-rear-bump 20,000 · sp-door-cup 3,000 (per piece, max 6).

**Price formula:**
`プラン基準価格[planId][sizeKey] × filmCoeff × rankCoeff + frontGlassPrice + Σ(singlePartPrice × count)`

### 4.6 Window film step (`screen-step-window`)
Display condition: `window` selected.
**Parts (¥):** wf-front-side 25,000 · wf-rear-side 22,000 · wf-rear-glass 20,000 · wf-rear-qtr 15,000 · wf-sunroof 18,000 · wf-windshield 30,000 · wf-all (全窓セット) 90,000.
**Grades (coeff):** standard 1.0 · premium 1.3 · high-heat (高断熱) 1.6 · security (防犯・防飛散) 1.2.
Per-part sub-fields: color name, part number.
**Formula:** `Σ( basePrice[partId] × gradeCoeff[gradeId] )`

### 4.7 Maintenance step (`screen-step-maintenance`)
Display condition: `maintenance` selected.
Menu structure: **5 fixed slots A–E** (name/price editable in settings; empty name = hidden). Plus free items (free name/price, add/remove rows).
**Formula:** `Σ(selected menu price) + Σ(free item price)`

### 4.8 Car wash step (`screen-step-carwash`)
Display condition: `carwash` selected.
Default menus (¥): cw-hand 3,000 · cw-polish 5,000 · cw-coat 8,000 · cw-wax 5,000 · cw-vacuum 2,000. (Settings allow unlimited add/edit/delete.)
**Formula:** `Σ(selected menu price)`

### 4.9 Room cleaning step (`screen-step-roomclean`)
Display condition: `roomclean` selected.
**Parts (¥):** rc-floor 12,000 · rc-seat 20,000 · rc-ceiling 15,000 · rc-door 10,000 · rc-dash 8,000 · rc-trunk 8,000.
**Condition coeff:** normal 1.0 · dirty 1.3 · heavy 1.6. Plus free items.
**Formula:** `Σ( basePrice[partId] × condCoeff[condId] ) + Σ(free item price)`

### 4.10 Other work step (`screen-step-other`)
Display condition: `other` selected. Unlimited free-form items (name/price).
**Formula:** `Σ(free item price)`

### 4.11 STEP5 — お見積書確認 (`screen-step5`)
Displays: customer/vehicle, per-category subtotals, coupon discount, manual discount (fixed/percent), dealer rate (if is_dealer), total (tax-excl & tax-incl).

**Coupon system:** 5 slots. Defaults: 新規ご来店 ¥5,000 · リピーター ¥3,000 · 紹介特典 ¥5,000 · キャンペーン ¥10,000 · スタッフ ¥3,000. Multiple selectable; summed into `couponDiscount`.
**Discount system:** types `fixed` / `percent`, from settings-registered presets.
**Dealer discount:** `小計 × (1 - dealer_rate/100)`, shown when `is_dealer === true`.
**Total formula:** `小計合計 - couponDiscount - discountAmount - dealer_discount`.

**Actions:**
| Label | Action | Note |
|-------|--------|------|
| 保存して完了 | `saveAndComplete()` | IndexedDB save + Cloud Sync push¹ |
| LINE転送 | `shareToLine()` | share estimate text via LINE |
| PDF保存 | `savePdf()` | html2canvas → PDF download¹ |

¹ Legacy runtime mechanism — see `04` / `08`.

---

## 5. `currentEstimate` data structure (canonical)

Held in memory while building an estimate. Fields:
`customer{name,phone,address}`, `customer_id`, `car{maker,model,year,color,plate}`, `size`(SS…XXL|null), `coating`(id|null), `layerMode`(none/2layer/3layer), `layerCount`(0/2/3), `topcoat2`, `topcoat3`, `topcoats[]`, `options[]`, `ppf{plan,filmType,vehicleRank,frontGlass,parts[],doorCupCount(1–6),sizeKey(…|LL+),subtotal}`, `windowFilm{parts[],grade,partColors{},subtotal}`, `maintenance{items[],freeItems[],subtotal}`, `carWash{items[],subtotal}`, `roomCleaning{parts[],condition,freeItems[],subtotal}`, `otherWork{items[],subtotal}`, `categories[]`, `notes`, `couponDiscount`, `appliedCoupons[]`, `discountAmount`, `is_dealer`, `dealer_rate`(%,default 100), `dealer_discount`, `created_at`(ISO8601).

> This canonical structure is the contract the implemented estimate tables/types must satisfy. See `04_DATABASE_REQUIREMENTS.md`.

---

## 6. Persistence & sync (as defined in canonical JSON — legacy runtime)

- **IndexedDB stores:** `estimates`(id,auto,idx created_at), `settings`(key), `customers`(id,auto,idx name/phone), `maintenances`(id,auto,idx customer_id/date), `schedules`(id,auto,idx start_date/category), `past_histories`(id,auto,idx customer_id/date), `dealer_statements`(id,auto,idx customer_id/year_month).
- **Cloud sync:** push on dbAdd/dbPut/dbDelete (`_cloudPush`); pull 1.5 s after launch (D1→IndexedDB, never overwrite existing IDs); backend Cloudflare Workers + Hono + D1; auth `AuthToken` (localStorage + Cookie, SameSite=Lax/Secure/365d); iOS fix: 8 s IndexedDB tx timeout + `tx.onabort`.

> ⚠️ The current implementation does **not** use this stack — it uses Supabase. The business meaning (estimates/customers/maintenance persist; offline-tolerant; per-dealer isolation) carries over; the mechanism is replaced. Operator decision required on how strictly to honor the legacy persistence text. See `04` §4 and `08` §6.
