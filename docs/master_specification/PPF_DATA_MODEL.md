# PPF DATA MODEL
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Document** | PPF Data Model |
| **Sprint** | 5A — Design |
| **Date** | 2026-06-25 |
| **Status** | Blueprint — no code written |

---

## 1. pricing-data.ts additions

### 1.1 PPF_PLANS

```typescript
export const PPF_PLANS: { id: string; name: string; desc: string }[] = [
  { id: "front-half", name: "フロントフル",  desc: "ボンネット・フロントフェンダー・サイドミラー・バンパー" },
  //                   ↑ OD-10: may change to "フロントハーフ"
  { id: "full-body",  name: "フルボディ",   desc: "全パネル施工" },
];
```

### 1.2 PPF_PLAN_PRICES

```typescript
export const PPF_PLAN_PRICES: Record<string, Record<string, number>> = {
  "front-half": {
    SS:  130000,
    S:   150000,
    M:   170000,
    ML:  180000,
    L:   190000,
    LL:  220000,
    XL:  260000,   // canonical LL+ mapped to XL
    XXL: 260000,   // fallback = XL price until OD-15 provides XXL price point
  },
  "full-body": {
    SS:  250000,
    S:   290000,
    M:   330000,
    ML:  350000,
    L:   370000,
    LL:  430000,
    XL:  520000,   // canonical LL+ mapped to XL
    XXL: 520000,   // fallback = XL price until OD-15
  },
};
```

> **OD-2 note:** These prices are from the canonical spec. The implementation had different values (¥30k–¥130k higher). Use these canonical values; update after operator session.
> **OD-15 note:** XXL = 520000/260000 fallback is a safe default. Operator must provide the actual XXL price.

### 1.3 PPF_FILM_TYPES

```typescript
export const PPF_FILM_TYPES: { id: string; name: string; coeff: number }[] = [
  { id: "clear",  name: "クリア",   coeff: 1.0 },
  { id: "matte",  name: "マット",   coeff: 1.3 },
  { id: "carbon", name: "カーボン", coeff: 1.5 },  // OD-4: verify canonical
  { id: "color",  name: "カラー",   coeff: 1.8 },  // OD-4: coeff was 1.2 in impl
];
```

> **OD-4 note:** Carbon and color coefficients differ from the previous implementation. Use canonical values (1.5 and 1.8). Verify with operator.

### 1.4 PPF_VEHICLE_RANKS

```typescript
export const PPF_VEHICLE_RANKS: { id: string; name: string; coeff: number }[] = [
  { id: "std",     name: "スタンダード",   coeff: 1.0 },
  { id: "premium", name: "プレミアム",     coeff: 1.3 },
  { id: "upper",   name: "アッパー",       coeff: 1.5 },  // OD-3: new rank
  { id: "luxury",  name: "ラグジュアリー", coeff: 1.8 },  // OD-3: new rank
];
```

> **OD-3 note:** Implementation had 3 ranks (std/premium/upper). Canonical spec has 4 ranks adding luxury. Architecture uses 4 ranks.

### 1.5 PPF_RANK_AUTO_DETECT

```typescript
export const PPF_RANK_AUTO_DETECT: { makers: string[]; rank: string }[] = [
  {
    rank: "luxury",
    makers: ["フェラーリ", "ランボルギーニ", "マクラーレン", "ベントレー", "ロールスロイス", "マセラティ", "アストンマーチン"],
  },
  {
    rank: "upper",
    makers: ["BMW", "メルセデス", "Mercedes", "アウディ", "Audi", "VW", "フォルクスワーゲン", "ポルシェ", "ランドローバー", "ボルボ", "ジャガー", "テスラ", "Tesla", "レクサス"],
  },
  {
    rank: "premium",
    makers: ["トヨタ", "Toyota", "日産", "Nissan", "ホンダ", "Honda", "マツダ", "Mazda", "スバル", "Subaru", "三菱", "Mitsubishi", "スズキ", "ダイハツ"],
  },
  // "std" is the default fallback — not listed here
];

export function detectPpfRank(maker: string): string {
  if (!maker) return "std";
  const normalized = maker.trim().toLowerCase();
  for (const group of PPF_RANK_AUTO_DETECT) {
    if (group.makers.some(m => normalized.includes(m.toLowerCase()))) {
      return group.rank;
    }
  }
  return "std";
}
```

### 1.6 PPF_FRONT_GLASS

```typescript
export const PPF_FRONT_GLASS: { id: string; name: string; price: number }[] = [
  { id: "ppf", name: "PPFフィルム貼り", price: 80000 },
  { id: "tpu", name: "TPUフィルム貼り", price: 60000 },
];
```

### 1.7 PPF_SINGLE_PARTS

```typescript
export const PPF_SINGLE_PARTS: {
  id: string; name: string; price: number; maxQty: number;
}[] = [
  { id: "sp-headlight", name: "ヘッドライト",         price: 25000, maxQty: 1 },
  { id: "sp-b-pillar",  name: "Bピラー",             price: 15000, maxQty: 1 },
  { id: "sp-c-pillar",  name: "Cピラー",             price: 15000, maxQty: 1 },
  { id: "sp-mirror",    name: "ドアミラー",           price: 12000, maxQty: 1 },
  { id: "sp-step",      name: "サイドステップ",       price: 18000, maxQty: 1 },
  { id: "sp-rear-bump", name: "リアバンパー",         price: 20000, maxQty: 1 },
  { id: "sp-door-cup",  name: "ドアカップ（1枚）",   price:  3000, maxQty: 6 },
];
```

---

## 2. pricing-engine.ts changes

### 2.1 PpfInput (replaces stub)

```typescript
export interface PpfInput {
  type:         "ppf";
  planId:       string;               // "front-half" | "full-body"
  filmType:     string;               // "clear" | "matte" | "carbon" | "color"
  vehicleRank:  string;               // "std" | "premium" | "upper" | "luxury"
  sizeKey:      string;               // "SS"|"S"|"M"|"ML"|"L"|"LL"|"XL"|"XXL"
  frontGlass?:  string;               // "ppf" | "tpu" | undefined/""
  singleParts?: { id: string; qty: number }[];
}
```

### 2.2 calcPpf() — private function

```typescript
function calcPpf(input: PpfInput, offset: number): ServiceSubtotal {
  const items: PricedLineItem[] = [];
  let idx = offset;

  // Plan base price lookup
  const planPrices = PPF_PLAN_PRICES[input.planId];
  const basePlanPrice = planPrices?.[input.sizeKey] ?? 0;
  if (basePlanPrice === 0) return { type: "ppf", lineItems: [], subtotal: 0 };

  // Apply film and rank coefficients
  const filmCoeff  = PPF_FILM_TYPES.find(f => f.id === input.filmType)?.coeff  ?? 1.0;
  const rankCoeff  = PPF_VEHICLE_RANKS.find(r => r.id === input.vehicleRank)?.coeff ?? 1.0;
  const filmName   = PPF_FILM_TYPES.find(f => f.id === input.filmType)?.name  ?? input.filmType;
  const rankName   = PPF_VEHICLE_RANKS.find(r => r.id === input.vehicleRank)?.name ?? input.vehicleRank;
  const planName   = PPF_PLANS.find(p => p.id === input.planId)?.name ?? input.planId;

  const adjustedPlanPrice = Math.round(basePlanPrice * filmCoeff * rankCoeff);
  const planLabel = `PPF ${planName}（${filmName} × ${rankName}）`;
  items.push(mkItem("ppf", planLabel, adjustedPlanPrice, idx++));

  // Front glass option
  if (input.frontGlass) {
    const fg = PPF_FRONT_GLASS.find(g => g.id === input.frontGlass);
    if (fg) items.push(mkItem("ppf", fg.name, fg.price, idx++));
  }

  // Single parts
  (input.singleParts ?? []).forEach(sp => {
    if (sp.qty <= 0) return;
    const part = PPF_SINGLE_PARTS.find(p => p.id === sp.id);
    if (part) {
      const qty = Math.min(sp.qty, part.maxQty);
      const unitPrice = part.price;
      items.push({
        ...mkItem("ppf", part.name, unitPrice, idx++),
        quantity: qty,
      });
    }
  });

  return { type: "ppf", lineItems: items, subtotal: sum(items.map(i => ({ ...i, unit_price: i.unit_price * i.quantity }))) };
}
```

> **Implementation note on subtotal:** `sum()` currently sums `unit_price` assuming qty = 1. For sp-door-cup with qty > 1, `subtotal` must account for quantity. The `sum()` helper will need to handle `unit_price × quantity`. This is a small engine change needed in Sprint 5B.

### 2.3 calculateService() switch update

```typescript
case "ppf": return calcPpf(input, sortOffset);   // replaces stub
```

---

## 3. EstimateWizard.tsx state additions

```typescript
// ── PPF ───────────────────────────────────────────────────────────────────────
const [ppfPlan,        setPpfPlan]        = useState<string>("");
const [ppfFilmType,    setPpfFilmType]    = useState<string>("clear");
const [ppfVehicleRank, setPpfVehicleRank] = useState<string>("std");
const [ppfFrontGlass,  setPpfFrontGlass]  = useState<string>("");
const [ppfSingleParts, setPpfSingleParts] = useState<{ id: string; qty: number }[]>([]);
const [ppfSubStep,     setPpfSubStep]     = useState<number>(1);
```

### 3.1 serviceInputs push

```typescript
if (has("ppf") && ppfPlan)
  serviceInputs.push({
    type:        "ppf",
    planId:      ppfPlan,
    filmType:    ppfFilmType,
    vehicleRank: ppfVehicleRank,
    sizeKey,
    frontGlass:  ppfFrontGlass || undefined,
    singleParts: ppfSingleParts.filter(sp => sp.qty > 0),
  });
```

### 3.2 Derived display values

```typescript
const ppfSvc = estCalc.services.find(s => s.type === "ppf");
const ppfTot = ppfSvc?.subtotal ?? 0;
```

---

## 4. DB Schema — estimate_items

No schema changes needed. PPF line items map to existing columns:

| Column | PPF plan item | PPF front glass | PPF single part |
|--------|--------------|----------------|----------------|
| category | "ppf" | "ppf" | "ppf" |
| item_name | "PPF フロントフル（マット × アッパー）" | "PPFフィルム貼り" | "ヘッドライト" |
| quantity | 1 | 1 | 1–6 |
| unit_price | adjusted plan price | 80000 | part price |
| discount_rate | 0 | 0 | 0 |
| item_type | "manual" | "manual" | "manual" |
| product_id | null | null | null |
| sku | null | null | null |

All null fields are reserved for future inventory/product integration (columns already exist).

---

## 5. TypeScript type impact summary

| File | Change | Type |
|------|--------|------|
| `pricing-data.ts` | +7 new exports | constants + helper function |
| `pricing-engine.ts` | `PpfInput` redefined, `calcPpf()` added | interface + function |
| `EstimateWizard.tsx` | +6 state vars, serviceInputs push, derived ppfTot | state + derivation |

No changes to:
- `estimate-types.ts` — `EstimateCategory` already includes `"ppf"`
- `create-estimate.ts` — no changes needed
- `estimate-pdf.tsx` — no changes needed

---

*GYEON Detailer Agent | PPF Data Model | Office AZ | 2026-06-25*
