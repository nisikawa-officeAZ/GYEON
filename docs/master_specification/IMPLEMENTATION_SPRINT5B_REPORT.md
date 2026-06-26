# IMPLEMENTATION SPRINT 5B REPORT
## GYEON Detailer Agent — PPF Core Engine

| Field | Value |
|-------|-------|
| **Sprint** | 5B — PPF Core Engine |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `c48f916` feat(ppf): implement core pricing engine |
| **Lines changed** | +169 / −5 |

---

## 1. Files Modified

| File | Change |
|------|--------|
| `src/lib/pricing/pricing-data.ts` | +7 exports, +1 helper function |
| `src/lib/pricing/pricing-engine.ts` | `PpfInput` updated, `PpfConfig` added, `sum()` fixed, `calcPpf()` + `buildPpfConfig()` added |

No UI changes. No wizard changes. No database changes.

---

## 2. Engine API

### New exports from `pricing-data.ts`

| Export | Type | Purpose |
|--------|------|---------|
| `PPF_PLANS` | `{ id, name, desc }[]` | 2 plans (front-half, full-body) |
| `PPF_PLAN_PRICES` | `Record<planId, Record<sizeKey, number>>` | Flat price table: 2×8 absolute prices |
| `PPF_FILM_TYPES` | `{ id, name, coeff }[]` | 4 film types with price coefficients |
| `PPF_VEHICLE_RANKS` | `{ id, name, coeff }[]` | 4 vehicle ranks with price coefficients |
| `PPF_RANK_AUTO_DETECT` | `{ rank, makers[] }[]` | Maker-to-rank detection table |
| `PPF_FRONT_GLASS` | `{ id, name, price }[]` | 2 front-glass options |
| `PPF_SINGLE_PARTS` | `{ id, name, price, maxQty }[]` | 7 single parts (sp-door-cup maxQty: 6) |
| `detectPpfRank()` | `(maker: string) → string` | Normalised maker string → rank id |

### New/updated exports from `pricing-engine.ts`

| Export | Type | Change |
|--------|------|--------|
| `PpfInput` | interface | Redefined from stub; all content fields optional for Sprint 5C compatibility |
| `PpfConfig` | interface | New — serialisable snapshot for future integrations |
| `buildPpfConfig()` | function | New public API |

---

## 3. Unit Calculation

### Formula

```
planBasePrice  = PPF_PLAN_PRICES[planId][sizeKey]
adjustedPrice  = round(planBasePrice × filmCoeff × rankCoeff)
frontGlassPx   = frontGlass ? PPF_FRONT_GLASS[fg].price : 0
singlePartsTot = Σ( part.price × min(sp.qty, part.maxQty) )
ppfSubtotal    = adjustedPrice + frontGlassPx + singlePartsTot
```

### Example: Full-body, matte, luxury, XL + front PPF + 3 door cups

```
basePlanPrice  = PPF_PLAN_PRICES["full-body"]["XL"]  = 520,000
filmCoeff      = 1.3  (matte)
rankCoeff      = 1.8  (luxury)
adjustedPrice  = round(520,000 × 1.3 × 1.8) = round(1,216,800) = 1,216,800
frontGlassPx   = 80,000  (ppf)
doorCup        = 3,000 × 3 = 9,000
ppfSubtotal    = 1,216,800 + 80,000 + 9,000 = 1,305,800
```

### Line items emitted

| item_name | unit_price | qty | category |
|-----------|-----------|-----|----------|
| PPF フルボディ（マット × ラグジュアリー） | 1,216,800 | 1 | "ppf" |
| PPFフィルム貼り | 80,000 | 1 | "ppf" |
| ドアカップ（1枚） | 3,000 | 3 | "ppf" |

---

## 4. Quantity Fix

### Before

```typescript
function sum(items: PricedLineItem[]): number {
  return items.reduce((s, i) => s + i.unit_price, 0);
}
```

Ignored `quantity` — correct only because all prior items had `qty = 1`.

### After

```typescript
function sum(items: PricedLineItem[]): number {
  return items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
}
```

Backwards-compatible: all existing services (coating, maintenance, carwash, roomclean, other, window) still set `quantity = 1`. Only `sp-door-cup` uses qty > 1.

`mkItem()` also gained an optional 5th parameter `qty = 1`, used only by `calcPpf` for `sp-door-cup`.

---

## 5. Future Compatibility

### PpfConfig

```typescript
export interface PpfConfig {
  planId:           string;
  planName:         string;
  filmType:         string;
  filmName:         string;
  vehicleRank:      string;
  rankName:         string;
  sizeKey:          string;
  frontGlass?:      string;
  frontGlassName?:  string;
  singleParts:      { id: string; name: string; qty: number; unitPrice: number }[];
  adjustedPlanPrice: number;
  subtotal:         number;
  // Reserved — uncomment when integrations are built:
  // product_sku?:        string;   // inventory link
  // cut_template_id?:    string;   // cutting software
  // dealer_order_ref?:   string;   // dealer orders
}
```

### buildPpfConfig()

```typescript
export function buildPpfConfig(input: PpfInput, result: ServiceSubtotal): PpfConfig
```

Takes a fully populated `PpfInput` and the `ServiceSubtotal` from `calcPpf()`, and returns a `PpfConfig` JSON-serialisable object.

**Intended use per integration:**

| Integration | When | What to persist |
|-------------|------|----------------|
| Cutting software | Sprint C+ | `cut_template_id` populated from film type → template lookup |
| Inventory | Sprint C+ | `product_sku` populated from film type → product catalog |
| Dealer Orders | Sprint D+ | `dealer_order_ref` populated when order is raised |

Storage: new column `ppf_config` (JSONB) on the `estimates` table — no migration needed for Sprint 5B/5C/5D. Column added in a future migration when integrations are built.

---

## 6. PpfInput — Optional Fields Design Decision

All content fields (`planId`, `filmType`, `vehicleRank`, `sizeKey`) are typed as `string | undefined`. This is deliberate:

- The wizard currently pushes `{ type: "ppf" }` (stub, no state yet)
- Sprint 5C adds the wizard state that fills these fields
- Until Sprint 5C, `calcPpf()` receives `planId = ""`, which resolves to `basePlanPrice = 0`, returns `{ lineItems: [], subtotal: 0 }` — safe and correct
- After Sprint 5C, all fields are populated and the engine produces full output

This avoids a breaking change to `EstimateWizard.tsx` in a sprint where UI changes are prohibited.

---

## 7. Test Results

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean |
| ESLint | N/A — not installed |
| Build (`npm run build`) | ✅ Passing — 24/24 pages |

---

## 8. Open OD Annotations in Code

| OD | Location | Comment |
|----|----------|---------|
| OD-10 | `PPF_PLANS[0].name` | `"フロントフル"` — may change to `"フロントハーフ"` |
| OD-2 | `PPF_PLAN_PRICES` | Canonical spec prices used; update after operator session |
| OD-15 | `PPF_PLAN_PRICES["front-half"]["XXL"]` | Fallback = XL price (260,000); operator provides actual XXL |
| OD-4 | `PPF_FILM_TYPES` carbon/color | Carbon ×1.5, color ×1.8 — verify with operator |
| OD-3 | `PPF_VEHICLE_RANKS` | 4-rank system (canonical); was 3-rank in previous impl |

All OD resolutions require only data changes in `PPF_PLAN_PRICES` / `PPF_FILM_TYPES` / `PPF_PLANS` — no structural engine changes.

---

## 9. Remaining Sprint Map

| Sprint | Status | Next action |
|--------|--------|------------|
| 5A — Architecture | ✅ Complete | — |
| 5B — Core Engine | ✅ Complete | — |
| 5C — PPF UI | ⏳ Pending | step-ppf UI, wizard state, auto-detect hook |
| 5D — Integration | ⏳ Pending | serviceInputs, step5 breakdown, handleSave |

---

*GYEON Detailer Agent | Implementation Sprint 5B Report | Office AZ | 2026-06-25*
