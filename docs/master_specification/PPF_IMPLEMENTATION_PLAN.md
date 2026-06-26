# PPF IMPLEMENTATION PLAN
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Document** | PPF Implementation Plan |
| **Sprint** | 5A — Design |
| **Date** | 2026-06-25 |
| **Status** | Blueprint — no code written |
| **Preconditions** | `PPF_ARCHITECTURE.md` and `PPF_DATA_MODEL.md` approved |

---

## Sprint Map

| Sprint | Name | Focus | Output |
|--------|------|-------|--------|
| 5A | PPF Architecture | Design only | This document + architecture docs |
| 5B | PPF Core | Engine + data constants | `pricing-data.ts`, `pricing-engine.ts` |
| 5C | PPF UI | Wizard step implementation | `EstimateWizard.tsx` — step-ppf |
| 5D | PPF Integration | Step5 + save + validation | `EstimateWizard.tsx` — serviceInputs, step5, handleSave |

---

## Sprint 5B — PPF Core

**Objective:** Implement the pricing engine support for PPF. No UI changes.

**Files modified:**
1. `src/lib/pricing/pricing-data.ts`
2. `src/lib/pricing/pricing-engine.ts`

### 5B Task List

#### pricing-data.ts

1. Add import-free exports (no new imports needed — PPF data is self-contained):
   - `PPF_PLANS` — 2 plans
   - `PPF_PLAN_PRICES` — 2×8 price table
   - `PPF_FILM_TYPES` — 4 film types with coefficients
   - `PPF_VEHICLE_RANKS` — 4 ranks with coefficients
   - `PPF_RANK_AUTO_DETECT` — maker-to-rank table
   - `PPF_FRONT_GLASS` — 2 options
   - `PPF_SINGLE_PARTS` — 7 parts including sp-door-cup

2. Add exported `detectPpfRank(maker: string): string` helper function.

#### pricing-engine.ts

1. Update imports from `pricing-data` to include the 7 new PPF exports.

2. Update `PpfInput` interface (replace stub):
   ```typescript
   export interface PpfInput {
     type: "ppf"; planId: string; filmType: string;
     vehicleRank: string; sizeKey: string;
     frontGlass?: string; singleParts?: { id: string; qty: number }[];
   }
   ```

3. Update `sum()` helper to handle quantity:
   ```typescript
   function sum(items: PricedLineItem[]): number {
     return items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
   }
   ```
   > **Breaking change check:** All existing services set quantity = 1. `unit_price × 1 = unit_price`. No impact on existing services.

4. Add `calcPpf(input: PpfInput, offset: number): ServiceSubtotal` private function.
   - Safe fallback on unknown planId/sizeKey: return empty ServiceSubtotal.
   - Line item structure: see `PPF_DATA_MODEL.md` §2.2.

5. Update `calculateService()`:
   ```typescript
   case "ppf": return calcPpf(input, sortOffset);
   ```

#### 5B Testing

```
npx tsc --noEmit   → must pass
npm run build      → must pass
```

No UI tests — engine is pure functions.

#### 5B Commit message

```
feat(pricing): implement PPF pricing engine
```

---

## Sprint 5C — PPF UI

**Objective:** Implement `step-ppf` UI in EstimateWizard. No step5/save changes yet.

**Files modified:**
1. `src/components/estimates/EstimateWizard.tsx`

### 5C Task List

#### Imports

Add to import from `@/lib/pricing/pricing-data`:
```
PPF_PLANS, PPF_PLAN_PRICES, PPF_FILM_TYPES, PPF_VEHICLE_RANKS,
PPF_FRONT_GLASS, PPF_SINGLE_PARTS, detectPpfRank
```

#### State variables

Add 6 state variables (see `PPF_DATA_MODEL.md` §3):
```typescript
ppfPlan, ppfFilmType, ppfVehicleRank, ppfFrontGlass, ppfSingleParts, ppfSubStep
```

#### Auto-detect hook

Add `useEffect` on vehicle maker field change:
```typescript
useEffect(() => {
  if (nv.maker) setPpfVehicleRank(detectPpfRank(nv.maker));
}, [nv.maker]);
```

#### Remove step-ppf from PLACEHOLDER_SCREENS

```typescript
const PLACEHOLDER_SCREENS: Screen[] = [];   // step-ppf removed
```

#### step-ppf UI block

Insert after the step-window block, before the placeholder block.

**Sub-step 1 — Plan selection:**
- 2 cards (front-half, full-body)
- Each shows plan name + base price for current sizeKey
- Auto-advance to sub-step 2 on selection

**Sub-step 2 — Film type:**
- 2×2 button grid
- Shows film name + coefficient + preview plan price
- Default: clear

**Sub-step 3 — Vehicle rank:**
- 2×2 button grid (same style as film type)
- Auto-detection notice when rank was auto-filled
- Shows rank name + coefficient + cumulative price preview

**Sub-step 4 — Front glass (optional):**
- 3-option selector: none / PPFフィルム (¥80,000) / TPUフィルム (¥60,000)
- Default: none

**Sub-step 5 — Single parts (optional):**
- Checklist; sp-door-cup has `+`/`-` quantity control (1–6)
- Running subtotal shown

**Sub-step navigation:**
- Internal back/next buttons for sub-steps 2–5
- At sub-step 1: back goes to wizard history (pop)
- Sub-step progression stored in `ppfSubStep` state

#### Derived display values (pricing block)

Add after existing derived values:
```typescript
const ppfSvc = estCalc.services.find(s => s.type === "ppf");
const ppfTot = ppfSvc?.subtotal ?? 0;
```

#### 5C Testing

```
npx tsc --noEmit   → must pass
npm run build      → must pass
```

Manual UI test path:
1. Select PPF category → navigate to step-ppf
2. Verify all 5 sub-steps render
3. Verify auto-detect fires on maker input
4. Verify subtotal updates on each selection
5. Verify back/next within sub-steps works

#### 5C Commit message

```
feat(wizard): implement step-ppf UI
```

---

## Sprint 5D — PPF Integration

**Objective:** Wire PPF into serviceInputs, step5 breakdown, handleSave. Full end-to-end.

**Files modified:**
1. `src/components/estimates/EstimateWizard.tsx`

### 5D Task List

#### serviceInputs push

Update the `if (has("ppf"))` line (currently stub) to use full PpfInput:
```typescript
if (has("ppf") && ppfPlan)
  serviceInputs.push({
    type: "ppf", planId: ppfPlan, filmType: ppfFilmType,
    vehicleRank: ppfVehicleRank, sizeKey,
    frontGlass: ppfFrontGlass || undefined,
    singleParts: ppfSingleParts.filter(sp => sp.qty > 0),
  });
```

#### Validation in Next button handler

Add step-ppf validation:
```typescript
else if (screen === "step-ppf") {
  if (!ppfPlan) { setError("プランを選択してください"); return; }
  push(nextScreen(screen, cats));
}
```

#### step5 breakdown — PPF section

Insert new section after the coating section, before maintenance:
```tsx
{has("ppf") && ppfTot > 0 && (
  <div className="px-4 py-3 border-t border-slate-700/40 flex flex-col gap-1.5">
    <p className="text-xs font-medium text-slate-400">PPF</p>
    {ppfSvc?.lineItems.map((item, i) => (
      <div key={i} className="flex justify-between text-sm">
        <span className="text-slate-300">{item.item_name}</span>
        <span className="text-slate-100">
          ¥{(item.unit_price * item.quantity).toLocaleString("ja-JP")}
        </span>
      </div>
    ))}
  </div>
)}
```

#### handleSave

No changes needed — `buildLineItems(serviceInputs)` already includes PPF items once the engine is wired in Sprint 5B.

#### Report generation

Generate `IMPLEMENTATION_SPRINT5_REPORT.md` after 5D passes tests.

#### 5D Testing

```
npx tsc --noEmit   → must pass
npm run build      → must pass
```

End-to-end test path:
1. Select PPF, navigate through all sub-steps, check step5 breakdown
2. Save estimate — verify DB contains PPF line items with category "ppf"
3. Open PDF — verify PPF items appear in PDF
4. Test coating + PPF combination — verify body size shared correctly
5. Test PPF-only (no coating) — verify step2 still appears

#### 5D Commit message

```
feat(wizard): wire PPF into estimate save and step5
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| OD-2/4/10/15 resolved with different values | High | Low | All OD impacts are data-only changes in `PPF_PLAN_PRICES`, `PPF_FILM_TYPES`, `PPF_PLANS` — no structural change |
| `sum()` change breaks existing services | Low | High | Verify that all existing line items have qty=1 before merging 5B |
| Sub-step state reset on wizard back/forward | Medium | Medium | Reset `ppfSubStep` to 1 when step-ppf is re-entered |
| sizeKey empty when ppf-only (step2 not reached) | Low | Medium | step2 is always shown when ppf is selected — enforced by `nextScreen()` |

---

## Dependency Map

```
Sprint 5A (this) — design complete
  ↓
Sprint 5B — engine + data
  └── pricing-data.ts (PPF constants + detectPpfRank)
  └── pricing-engine.ts (PpfInput, calcPpf, sum() fix)
  └── Tests: tsc + build
      ↓
Sprint 5C — UI
  └── EstimateWizard.tsx (state + step-ppf UI)
  └── Tests: tsc + build + manual UI
      ↓
Sprint 5D — integration
  └── EstimateWizard.tsx (serviceInputs + step5 + validation)
  └── Tests: tsc + build + E2E
  └── Generate IMPLEMENTATION_SPRINT5_REPORT.md
  └── One clean commit
```

---

## Definition of Done (Sprint 5D)

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — 24/24 pages passing
- [ ] PPF step renders all 5 sub-steps correctly
- [ ] Auto-detect fires from maker field
- [ ] Running subtotal updates on every selection
- [ ] Step5 shows PPF breakdown
- [ ] Saved estimate contains PPF line items in DB (category "ppf")
- [ ] PDF renders PPF line items
- [ ] Coating + PPF combination works (shared sizeKey)
- [ ] PPF-only flow works (step2 appears)
- [ ] PLACEHOLDER_SCREENS is `[]` (both PPF and window implemented)
- [ ] One clean commit with message `feat(wizard): wire PPF into estimate save and step5`
- [ ] `IMPLEMENTATION_SPRINT5_REPORT.md` generated

---

*GYEON Detailer Agent | PPF Implementation Plan | Office AZ | 2026-06-25*
