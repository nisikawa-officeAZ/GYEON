# IMPLEMENTATION SPRINT 4 REPORT
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Sprint** | Implementation Sprint 4 |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `310ea93` feat(wizard): implement window film step |
| **Lines changed** | +134 / −8 |

---

## 1. Files Modified

| File | Change type |
|------|------------|
| `src/lib/pricing/pricing-data.ts` | Added WINDOW_FILM_PARTS, WINDOW_FILM_GRADES |
| `src/lib/pricing/pricing-engine.ts` | Expanded WindowInput, added calcWindow() |
| `src/components/estimates/EstimateWizard.tsx` | State, UI, derived values, breakdown |

---

## 2. Pricing Engine Changes

### New data constants (`pricing-data.ts`)

```typescript
WINDOW_FILM_PARTS: { id: string; name: string; basePrice: number }[]
  wf-front-side  フロントサイド   ¥25,000
  wf-rear-side   リアサイド       ¥20,000
  wf-rear        リアウィンドウ   ¥18,000
  wf-quarter     クォーター       ¥12,000
  wf-all         全窓一括         ¥80,000

WINDOW_FILM_GRADES: { id: string; name: string; coeff: number }[]
  standard  スタンダード  ×1.0
  uv-cut    UVカット      ×1.1
  ir-cut    IRカット      ×1.2
  premium   プレミアム    ×1.3
```

### WindowInput shape (`pricing-engine.ts`)

**Before (stub):**
```typescript
export interface WindowInput { type: "window"; }
```

**After:**
```typescript
export interface WindowInput {
  type:    "window";
  partIds: string[];   // selected WINDOW_FILM_PARTS ids
  grade:   string;     // selected WINDOW_FILM_GRADES id
}
```

### calcWindow logic

```
for each partId in input.partIds:
  price = round(part.basePrice × grade.coeff)
  label = grade !== "standard" ? "{part.name}（{grade.name}）" : part.name
  mkItem("window", label, price, idx++)

subtotal = sum(lineItems)
```

- Category on all items: `"window"` (valid EstimateCategory)
- Grade label appended to item name when non-standard (consistent with roomclean pattern)
- Empty partIds → empty lineItems, subtotal 0

---

## 3. EstimateWizard Changes

### State added

```typescript
const [windowPartSel, setWindowPartSel] = useState<string[]>([]);
const [windowGrade,   setWindowGrade]   = useState<string>("standard");
```

### serviceInputs

```typescript
if (has("window"))
  serviceInputs.push({ type: "window", partIds: windowPartSel, grade: windowGrade });
```

### Derived display values

```typescript
const wfGradeCoeff = WINDOW_FILM_GRADES.find(g => g.id === windowGrade)?.coeff ?? 1.0;
const windowTot    = estCalc.services.find(s => s.type === "window")?.subtotal ?? 0;
```

### PLACEHOLDER_SCREENS

**Before:** `["step-ppf", "step-window"]`
**After:** `["step-ppf"]`

---

## 4. step-window UI

**Section 1 — Grade selector (2×2 grid):**
- 4 grade buttons: スタンダード / UVカット / IRカット / プレミアム
- Blue active state, coefficient shown below label (e.g. `×1.3`)
- Default: スタンダード

**Section 2 — Part checkboxes:**
- 5 areas with blue checkbox + right-aligned price
- Price shown = `basePrice × gradeCoeff` (live update when grade changes)
- When grade ≠ standard: strikethrough base price displayed below adjusted price
- Multi-select; toggling updates subtotal live

**Section 3 — Running subtotal:**
- Shown when ≥1 part selected: `ウィンドウフィルム小計 ¥XX,XXX`
- Value is read from `windowTot` (engine-derived — no in-component calculation)

---

## 5. Validation

Validation enforced on step-window → next navigation:

```typescript
if (windowPartSel.length === 0) {
  setError("施工箇所を1か所以上選択してください");
  return;
}
```

No other wizard step enforces minimum selection (maintenance/carwash/roomclean are advisory-skip). Window film validation is appropriate because the category is meaningless with zero parts.

---

## 6. step5 Breakdown

New section added after ルームクリーニング, before その他作業:

```
ウィンドウフィルム（プレミアム）   ← grade badge when non-standard
  フロントサイド              ¥32,500
  リアウィンドウ              ¥23,400
```

---

## 7. PDF Integration

Window film items are written to `estimate_items` via `buildLineItems(serviceInputs)` in `handleSave`. All items have `category: "window"` (valid EstimateCategory). No PDF-specific changes required — the existing PDF pipeline reads `estimate_items` from the DB.

---

## 8. Validation Results

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean |
| ESLint | N/A — not installed |
| Build (`npm run build`) | ✅ Passing — 24/24 pages |

---

## 9. Remaining Placeholder Screens

```typescript
const PLACEHOLDER_SCREENS: Screen[] = ["step-ppf"];
```

| Screen | Blocked by | Required ODs |
|--------|-----------|-------------|
| `step-ppf` | OD-2, OD-3, OD-4, OD-10, OD-15 | PPF pricing package |

---

## 10. Sprint Summary

| Service | Sprint | Status |
|---------|--------|--------|
| Maintenance | Sprint 1 | ✅ Complete |
| Carwash | Sprint 1 | ✅ Complete |
| Other | Sprint 1 | ✅ Complete |
| Room Clean | Sprint 2 | ✅ Complete |
| Pricing Engine | Sprint 3 | ✅ Complete |
| Window Film | Sprint 4 | ✅ Complete |
| PPF | — | ⏳ Awaiting OD-2/3/4/10/15 |

---

*GYEON Detailer Agent | Implementation Sprint 4 Report | Office AZ | 2026-06-25*
