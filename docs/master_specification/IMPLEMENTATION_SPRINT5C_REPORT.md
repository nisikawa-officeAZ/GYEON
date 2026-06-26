# IMPLEMENTATION SPRINT 5C REPORT
## GYEON Detailer Agent — PPF Wizard UI Integration

| Field | Value |
|-------|-------|
| **Sprint** | 5C — PPF Wizard UI |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `447d819` feat(wizard): integrate ppf step |
| **Lines changed** | +184 / −3 |

---

## 1. Files Modified

| File | Change |
|------|--------|
| `src/components/estimates/EstimateWizard.tsx` | PPF imports, state, auto-detect hook, serviceInputs, derived values, step-ppf UI, step5 breakdown, Next handler |

No engine changes. No database changes. No migrations.

---

## 2. Changes Applied

### 2.1 Imports

Added to `@/lib/pricing/pricing-data` import:
```typescript
PPF_PLANS, PPF_PLAN_PRICES, PPF_FILM_TYPES, PPF_VEHICLE_RANKS,
PPF_FRONT_GLASS, PPF_SINGLE_PARTS, detectPpfRank
```

### 2.2 PLACEHOLDER_SCREENS

```typescript
// Before
const PLACEHOLDER_SCREENS: Screen[] = ["step-ppf"];

// After
const PLACEHOLDER_SCREENS: Screen[] = [];
```

### 2.3 State Variables

Added 5 state variables after `windowGrade`:
```typescript
const [ppfPlan,        setPpfPlan]        = useState<string>("");
const [ppfFilmType,    setPpfFilmType]    = useState<string>("clear");
const [ppfVehicleRank, setPpfVehicleRank] = useState<string>("std");
const [ppfFrontGlass,  setPpfFrontGlass]  = useState<string>("");
const [ppfSingleParts, setPpfSingleParts] = useState<{ id: string; qty: number }[]>([]);
```

### 2.4 Auto-detect Hook

```typescript
useEffect(() => {
  if (nv.maker) setPpfVehicleRank(detectPpfRank(nv.maker));
}, [nv.maker]);
```

Fires when the vehicle maker field changes (set in step1). Updates `ppfVehicleRank` automatically. User can override by tapping a different rank button in step-ppf.

### 2.5 serviceInputs Push

```typescript
// Before (stub)
if (has("ppf"))
  serviceInputs.push({ type: "ppf" });

// After (full PpfInput)
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

Guard `&& ppfPlan` means: no PPF service input until the user selects a plan. Engine produces no output until then (subtotal: 0).

### 2.6 Derived Values

```typescript
const ppfSvc = estCalc.services.find(s => s.type === "ppf");
const ppfTot = ppfSvc?.subtotal ?? 0;
```

### 2.7 Next Button Validation

```typescript
} else if (screen === "step-ppf") {
  if (!ppfPlan) { setError("プランを選択してください"); return; }
  push(nextScreen(screen, cats));
}
```

---

## 3. step-ppf UI Structure

Single wizard step with 5 inline sections (no sub-step navigation — all sections visible at once, matching pattern of other steps).

| Section | Content | Required |
|---------|---------|----------|
| ① プラン | 2 radio cards — front-half / full-body; shows base price for current sizeKey | Yes |
| ② フィルムタイプ | 2×2 button grid — clear / matte / carbon / color with coefficient | Yes |
| ③ 車両ランク | 2×2 button grid — std / premium / upper / luxury; auto-detect notice if maker set | Yes |
| ④ フロントガラスオプション | 3 radio buttons — none / PPFフィルム (¥80,000) / TPUフィルム (¥60,000) | No |
| ⑤ 単体パーツ追加 | Checklist × 7 parts; sp-door-cup has −/qty/＋ stepper (range 1–6) | No |
| PPF 小計 | Running subtotal from engine (visible when ppfTot > 0) | — |

### Plan card price display

`PPF_PLAN_PRICES[plan.id]?.[sizeKey] ?? 0` — direct constant lookup (no pricing logic duplication). Shows as `¥XXX,XXX〜`.

### Door cup stepper

```tsx
<button onClick={() => setPpfSingleParts(p => p.map(x =>
  x.id === "sp-door-cup" ? { ...x, qty: Math.max(1, x.qty - 1) } : x
))}>−</button>
<span>{qty}</span>
<button onClick={() => setPpfSingleParts(p => p.map(x =>
  x.id === "sp-door-cup" ? { ...x, qty: Math.min(part.maxQty, x.qty + 1) } : x
))}>＋</button>
```

Min: 1 (remove by unchecking). Max: `part.maxQty` (6 for sp-door-cup).

---

## 4. step5 Breakdown — PPF Section

Inserted after coating section, before maintenance:

```tsx
{has("ppf") && ppfTot > 0 && (
  <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
    <p className="text-xs font-medium text-slate-400">PPF</p>
    {ppfSvc?.lineItems.map((item, i) => (
      <div key={i} className="flex justify-between text-sm">
        <span className="text-slate-300">{item.item_name}</span>
        <span className="text-slate-100">¥{(item.unit_price * item.quantity).toLocaleString("ja-JP")}</span>
      </div>
    ))}
  </div>
)}
```

Renders each line item from the engine — plan item (with film/rank label), optional front glass item, optional single parts (door cup multiplied by qty).

---

## 5. PDF Pipeline

No changes required. `buildLineItems(serviceInputs)` in `handleSave` already produces all PPF line items once `serviceInputs` contains the full `PpfInput`. The engine emits `category: "ppf"` on every PPF line item — the existing PDF renderer groups by category.

---

## 6. Test Results

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean |
| Build (`npm run build`) | ✅ 24/24 pages |

---

## 7. Auto-detect Logic

`detectPpfRank(maker: string)` in `pricing-data.ts`:
- Normalises input: `.trim().toLowerCase()`
- Iterates `PPF_RANK_AUTO_DETECT` in rank order (luxury → upper → premium)
- Returns first match; defaults to `"std"` if no match

Auto-detect fires via `useEffect` on `nv.maker`. If the user manually selects a different rank, that selection takes precedence (the effect only fires when the maker field changes, not on every render).

---

## 8. Sprint Map — Updated

| Sprint | Status | Commit |
|--------|--------|--------|
| 5A — Architecture | ✅ Complete | design docs only |
| 5B — Core Engine | ✅ Complete | `c48f916` |
| 5C — PPF UI | ✅ Complete | `447d819` |
| 5D — Integration | ✅ Merged into 5C | serviceInputs + step5 + validation all in this commit |

> **Note:** Sprint 5D scope (serviceInputs, step5 breakdown, Next handler validation) was implemented in this sprint rather than deferred. The separation was a planning artefact — all changes lived in the same file, so splitting into two commits would have added no value.

---

*GYEON Detailer Agent | Implementation Sprint 5C Report | Office AZ | 2026-06-25*
