# PPF ARCHITECTURE
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Document** | PPF Architecture |
| **Sprint** | 5A — Design |
| **Date** | 2026-06-25 |
| **Status** | Blueprint — no code written |
| **Source** | `03_BUSINESS_WORKFLOW.md` §4.5, `pricing-engine.ts`, `EstimateWizard.tsx` |

---

## 1. User Workflow

### 1.1 Entry conditions

PPF step (`step-ppf`) is reached when:
- `cats.includes("ppf")` is true
- Navigation: `step2 → step-ppf` (ppf-only) OR `step4 → step-ppf` (coating + ppf)

### 1.2 Sub-step flow within `step-ppf`

PPF has 5 sequential sub-steps, all within the single `step-ppf` screen. Navigation between sub-steps uses internal state (not the wizard history stack).

```
Sub-step 1 — Plan selection
  ↓
Sub-step 2 — Film type
  ↓
Sub-step 3 — Vehicle rank (auto-detected from maker; user can override)
  ↓
Sub-step 4 — Front glass option (optional; skip = no charge)
  ↓
Sub-step 5 — Single parts (optional; skip = no charge)
  ↓
[running subtotal shown throughout]
  ↓
「次へ」 → next wizard screen
```

### 1.3 Validation rules

| Sub-step | Required | Error message |
|----------|----------|---------------|
| 1 — Plan | Yes | プランを選択してください |
| 2 — Film type | Yes (default: clear) | — |
| 3 — Vehicle rank | Yes (auto-detected; override optional) | — |
| 4 — Front glass | No | — |
| 5 — Single parts | No | — |

### 1.4 Body size sharing

When `coating` and `ppf` are both selected, `step2` (body size) runs once. The `sizeKey` from step2 is used for BOTH coating price calculation AND PPF plan price lookup.

When ONLY `ppf` is selected (no coating), `step2` still runs (body size is required for PPF).

---

## 2. Data Model

### 2.1 Pricing constants (in `pricing-data.ts`)

#### Plans

```typescript
PPF_PLANS: { id: string; name: string }[]
  "front-half"  → name pending OD-10 ("フロントフル" or "フロントハーフ")
  "full-body"   → "フルボディ"
```

#### Plan prices (¥) — 8 body size keys

Canonical spec uses 7 sizes (SS–LL+). Wizard uses 8 (SS–XXL). Architecture maps LL+ → XL, with XXL using XL price as fallback until OD-15 resolves the XXL price point.

```typescript
PPF_PLAN_PRICES: Record<string, Record<string, number>>
  {
    "front-half": {
      SS: 130000, S: 150000, M: 170000, ML: 180000, L: 190000,
      LL: 220000, XL: 260000, XXL: 260000  // XXL falls back to XL until OD-15
    },
    "full-body": {
      SS: 250000, S: 290000, M: 330000, ML: 350000, L: 370000,
      LL: 430000, XL: 520000, XXL: 520000  // XXL fallback
    }
  }
```

#### Film types

```typescript
PPF_FILM_TYPES: { id: string; name: string; coeff: number }[]
  "clear"  → クリア     ×1.0
  "matte"  → マット     ×1.3
  "carbon" → カーボン   ×1.5   // may change per OD-4
  "color"  → カラー     ×1.8   // coeff may change per OD-4
```

#### Vehicle ranks

```typescript
PPF_VEHICLE_RANKS: { id: string; name: string; coeff: number }[]
  "std"     → スタンダード ×1.0
  "premium" → プレミアム   ×1.3
  "upper"   → アッパー     ×1.5   // added per OD-3
  "luxury"  → ラグジュアリー ×1.8   // added per OD-3
```

#### Rank auto-detection table

```typescript
PPF_RANK_AUTO_DETECT: { pattern: string; rank: string }[]
  luxury: フェラーリ, ランボルギーニ, マクラーレン, ベントレー, ロールスロイス, マセラティ, アストンマーチン
  upper:  BMW, Mercedes, Audi, VW, ポルシェ, ランドローバー, ボルボ, ジャガー, テスラ, レクサス
  premium: トヨタ, 日産, ホンダ, マツダ, スバル, 三菱, スズキ, ダイハツ
  std:    (fallback for unknown/empty)
```

#### Front-glass options

```typescript
PPF_FRONT_GLASS: { id: string; name: string; price: number }[]
  "ppf" → PPFフィルム貼り   ¥80,000
  "tpu" → TPUフィルム貼り   ¥60,000
```

#### Single parts

```typescript
PPF_SINGLE_PARTS: { id: string; name: string; price: number; maxQty: number }[]
  "sp-headlight"  → ヘッドライト         ¥25,000  maxQty: 1
  "sp-b-pillar"   → Bピラー             ¥15,000  maxQty: 1
  "sp-c-pillar"   → Cピラー             ¥15,000  maxQty: 1
  "sp-mirror"     → ドアミラー           ¥12,000  maxQty: 1
  "sp-step"       → サイドステップ       ¥18,000  maxQty: 1
  "sp-rear-bump"  → リアバンパー         ¥20,000  maxQty: 1
  "sp-door-cup"   → ドアカップ（1枚）   ¥3,000   maxQty: 6
```

### 2.2 PpfInput (in `pricing-engine.ts`)

```typescript
export interface PpfInput {
  type:         "ppf";
  planId:       string;               // "front-half" | "full-body"
  filmType:     string;               // "clear" | "matte" | "carbon" | "color"
  vehicleRank:  string;               // "std" | "premium" | "upper" | "luxury"
  sizeKey:      string;               // "SS"|"S"|"M"|"ML"|"L"|"LL"|"XL"|"XXL"
  frontGlass?:  string;               // "ppf" | "tpu" | undefined
  singleParts?: { id: string; qty: number }[];
}
```

### 2.3 Wizard state additions

```typescript
const [ppfPlan,        setPpfPlan]        = useState<string>("");
const [ppfFilmType,    setPpfFilmType]    = useState<string>("clear");
const [ppfVehicleRank, setPpfVehicleRank] = useState<string>("std");
const [ppfFrontGlass,  setPpfFrontGlass]  = useState<string>("");
const [ppfSingleParts, setPpfSingleParts] = useState<{ id: string; qty: number }[]>([]);
const [ppfSubStep,     setPpfSubStep]     = useState<number>(1);
```

---

## 3. UI Flow

### 3.1 Sub-step 1 — Plan selection

Layout: 2 large cards (フロントフル/ハーフ, フルボディ)

Each card shows:
- Plan name
- Base price for the currently selected sizeKey
- Short description (coverage area)

Selection → blue active state; auto-advance to sub-step 2.

### 3.2 Sub-step 2 — Film type

Layout: 2×2 button grid

Each button shows:
- Film type name
- Coefficient label (×1.0, ×1.3, ×1.5, ×1.8)
- Running plan price with this film applied (preview only)

Default: clear (×1.0). Sub-step 2 → sub-step 3 on selection.

### 3.3 Sub-step 3 — Vehicle rank

Layout: 2×2 button grid (same style as film type)

Auto-detection: on entering step-ppf, run `detectPpfRank(makerString)` and pre-set `ppfVehicleRank`. Show a "自動検出: {rankName}" notice when auto-detected. User can override.

Each button shows:
- Rank name
- Coefficient (×1.0 – ×1.8)
- Cumulative plan price preview

「次へ」 button advances to sub-step 4 (or user may auto-advance on selection).

### 3.4 Sub-step 4 — Front glass (optional)

Layout: 3 options — none (スキップ), PPFフィルム (¥80,000), TPUフィルム (¥60,000)

Default: none. Display running subtotal at bottom.

### 3.5 Sub-step 5 — Single parts (optional)

Layout: part checklist with qty stepper for sp-door-cup

Each part row:
- Checkbox
- Part name
- Unit price
- For sp-door-cup: quantity control (1–6)

Display running subtotal. 「次へ」 exits step-ppf and advances to next wizard screen.

### 3.6 Sub-step navigation

Internal "Back" button returns to the previous sub-step. At sub-step 1, "Back" goes to the previous wizard screen (step2 or step4).

### 3.7 Running subtotal

Shown from sub-step 2 onwards, updating on every change:
```
PPF 小計: ¥XXX,XXX
```
Breakdown: plan price × filmCoeff × rankCoeff + front glass + single parts.

---

## 4. Pricing Flow

### 4.1 Formula

```
planBasePrice  = PPF_PLAN_PRICES[planId][sizeKey]
adjustedPrice  = round(planBasePrice × filmCoeff × rankCoeff)
frontGlassPx   = frontGlass ? PPF_FRONT_GLASS[frontGlass].price : 0
singlePartsTot = Σ(PPF_SINGLE_PARTS[sp.id].price × sp.qty)
ppfSubtotal    = adjustedPrice + frontGlassPx + singlePartsTot
```

### 4.2 Line item decomposition (for estimate_items)

PPF produces multiple PricedLineItems:

| # | item_name | unit_price | qty | category |
|---|-----------|-----------|-----|----------|
| 1 | PPF {planName}（{filmName} × {rankName}） | adjustedPrice | 1 | "ppf" |
| 2 | {frontGlassName} *(if selected)* | frontGlassPrice | 1 | "ppf" |
| 3+ | {singlePartName} *(per part)* | partPrice | qty | "ppf" |

`sp-door-cup` uses `quantity: N` (1–6) rather than N separate rows.

### 4.3 Integration with calculateEstimate()

`calculateEstimate()` receives `serviceInputs` including a `PpfInput`. PPF subtotal is included in the global subtotal. Dealer discount, coupon, tax are applied at the estimate level — unchanged.

---

## 5. Estimate Integration

### 5.1 serviceInputs push

```typescript
if (has("ppf") && ppfPlan)
  serviceInputs.push({
    type: "ppf",
    planId: ppfPlan,
    filmType: ppfFilmType,
    vehicleRank: ppfVehicleRank,
    sizeKey,
    frontGlass: ppfFrontGlass || undefined,
    singleParts: ppfSingleParts.filter(sp => sp.qty > 0),
  });
```

### 5.2 handleSave

PPF items are included in `buildLineItems(serviceInputs)` — no special handling needed. The engine emits the items; `handleSave` passes the full flat array to `createEstimate` via `items_json`.

### 5.3 Step5 breakdown

New section in the step5 estimate summary, after coating (if both selected):

```
PPF                                   ¥XXX,XXX
  フロントフル（マットフィルム × レクサス）  ¥XXX,XXX
  フロントガラス PPFフィルム貼り             ¥80,000
  ヘッドライト                             ¥25,000
  ドアカップ ×3                            ¥9,000
```

---

## 6. PDF Integration

No changes to the PDF pipeline are required. The PDF template (`estimate-pdf.tsx`) reads `estimate_items` from the DB and renders them in sort_order. PPF items with `category: "ppf"` are rendered as any other line item.

Optional enhancement (Phase C): group items by category with category headers.

---

## 7. Pricing Engine Integration

### 7.1 Changes to `pricing-engine.ts`

| Change | Detail |
|--------|--------|
| `PpfInput` interface | Updated from stub `{ type: "ppf" }` to full shape |
| `calcPpf()` function | New private function; replaces stub return |
| `calculateService()` | `case "ppf"` delegates to `calcPpf()` |

### 7.2 `calcPpf()` output guarantee

- Returns `ServiceSubtotal` with `type: "ppf"` and `lineItems: PricedLineItem[]`
- On invalid/missing planId or sizeKey: returns `{ type: "ppf", lineItems: [], subtotal: 0 }` (safe fallback, no throw)
- All items have `category: "ppf"`, `item_type: "manual"`, `product_id: null`

### 7.3 Changes to `pricing-data.ts`

New exports:
- `PPF_PLANS`
- `PPF_PLAN_PRICES`
- `PPF_FILM_TYPES`
- `PPF_VEHICLE_RANKS`
- `PPF_RANK_AUTO_DETECT`
- `PPF_FRONT_GLASS`
- `PPF_SINGLE_PARTS`
- `detectPpfRank(maker: string): string` — exported helper function

---

## 8. Future Compatibility

### 8.1 PPF Cutting Software

Cutting software integration will require: planId, filmType, and optionally singlePart IDs to generate cut patterns.

**Design decision:** PPF line items store `item_name` as human-readable text (e.g., "PPF フロントフル（マットフィルム × レクサス）"). This is sufficient for the PDF and estimate display.

For cutting software, the raw `PpfInput` fields (planId, filmType, partIds) are needed as structured data, not embedded in item_name strings. When cutting software is integrated, the architecture will:
1. Persist a `ppf_config` JSON blob alongside the estimate (new column `estimate_ppf_config` or separate table)
2. The cutting software API reads from `ppf_config`, not from `estimate_items`
3. This requires **no changes** to the current line-item architecture

**Current design is forward-compatible.** No structural changes needed.

### 8.2 Inventory

Inventory integration needs film type and quantity consumed per estimate.

**Design decision:** `filmType` is embedded in the first PPF line item name. When inventory is integrated:
1. Add `product_id` and `sku` to PPF line items (currently null)
2. These columns already exist in `estimate_items` — no migration needed
3. Connect PPF film types to GYEON product SKUs in the product catalog

**Current design is forward-compatible.** `product_id` and `sku` fields are null stubs now.

### 8.3 Dealer Orders

Dealer orders require PPF film product linkage to Dealer Order line items.

**Design decision:** Same `product_id` path as inventory. When Dealer Orders are implemented, the PPF pricing-data constants will gain a `product_id` field linked to `products.id`. The `buildLineItems()` output already carries `product_id: null` — when non-null, the order pipeline picks it up.

**Current design is forward-compatible.**

---

## 9. Open Operator Decisions Affecting PPF

| OD | Topic | Impact on Architecture |
|----|-------|----------------------|
| OD-2 | PPF plan prices | `PPF_PLAN_PRICES` values — update after session |
| OD-3 | PPF vehicle ranks | Verify 4-rank (std/premium/upper/luxury) is canonical |
| OD-4 | PPF film types | Verify carbon (×1.5) and color coeff (1.8 vs 1.2) |
| OD-10 | PPF plan label | `PPF_PLANS[0].name` — フロントフル or フロントハーフ |
| OD-15 | PPF body size 7th/8th key | `PPF_PLAN_PRICES["front-half"]["XXL"]` price point |

Architecture is designed to absorb all 5 ODs as **data-only changes** to `PPF_PLAN_PRICES`, `PPF_FILM_TYPES`, and `PPF_VEHICLE_RANKS`. No structural changes required after ODs resolve.

---

## 10. Constraints

- PPF pricing uses a **flat price lookup table** (not a multiplier), unlike coating which uses `base × sizeMultiplier`. The plan prices are absolute per-size values.
- The `sizeKey` for PPF comes from step2 state, not from PpfInput — PpfInput must receive it at construction time from the wizard.
- PPF and coating share step2 (body size). The `sizeKey` state variable is shared.
- `sp-door-cup` requires quantity (1–6) — the only single part with qty > 1. All others are binary (selected or not).
- Sub-steps within `step-ppf` use local component state, not the wizard history stack. The wizard Back button at sub-step 1 pops the wizard history.

---

*GYEON Detailer Agent | PPF Architecture | Office AZ | 2026-06-25*
