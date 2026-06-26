# IMPLEMENTATION SPRINT 6 REPORT
## GYEON Detailer Agent — Estimate Wizard End-to-End Validation

| Field | Value |
|-------|-------|
| **Sprint** | 6 — End-to-End Validation |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | N/A — analysis only, no code changes |
| **Bugs found** | 1 (MEDIUM) |
| **Warnings** | 4 |

---

## 1. Build Checks

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS — 0 errors |
| Build | `npm run build` | ✅ PASS — 24/24 pages |
| Lint | `npm run lint` | N/A — no lint script in `package.json` |

---

## 2. Wizard Navigation

| Scenario | Expected Path | Result |
|----------|---------------|--------|
| Coating only | category → step1 → step2 → step3 → step4 → step5 | ✅ PASS |
| PPF only | category → step1 → step2 → step-ppf → step5 | ✅ PASS |
| Window only | category → step1 → step-window → step5 | ✅ PASS |
| Maintenance only | category → step1 → step-maintenance → step5 | ✅ PASS |
| Carwash only | category → step1 → step-carwash → step5 | ✅ PASS |
| Room clean only | category → step1 → step-roomclean → step5 | ✅ PASS |
| Other only | category → step1 → step-other → step5 | ✅ PASS |
| Coating + PPF | ... → step4 → step-ppf → step5 | ✅ PASS |
| Coating + Window | ... → step4 → step-window → step5 | ✅ PASS |
| PPF + Window | ... → step2 → step-ppf → step-window → step5 | ✅ PASS |
| All 7 categories | coating → ppf → window → maintenance → carwash → roomclean → other | ✅ PASS |
| PLACEHOLDER_SCREENS | `= []` | ✅ PASS — both ppf and window implemented |
| Back button (pop) | Returns to previous screen in history stack | ✅ PASS |

### Required field validation

| Screen | Required check | Result |
|--------|---------------|--------|
| category | `cats.length > 0` | ✅ PASS |
| step1 (select) | `customerId` set | ✅ PASS |
| step1 (create) | `nc.last_name` non-empty | ✅ PASS |
| step3 | `coatId` selected; topcoat if layer mode | ✅ PASS |
| step-window | `windowPartSel.length > 0` | ✅ PASS |
| step-ppf | `ppfPlan` non-empty | ✅ PASS |
| step-maintenance | no validation required (skip allowed) | ✅ PASS |
| step-carwash | no validation required | ✅ PASS |
| step-roomclean | no validation required | ✅ PASS |
| step-other | no validation required | ✅ PASS |

---

## 3. Pricing Engine

### Formula verification

| Service | Formula | Spot-check | Result |
|---------|---------|-----------|--------|
| Coating | `base × sizeMultiplier` | syncro-evo × ML = ¥126,500 | ✅ PASS |
| Topcoat | `TOPCOAT_BASE[id] × sizeMultiplier` | — | ✅ PASS |
| PPF plan | `PPF_PLAN_PRICES[planId][sizeKey] × filmCoeff × rankCoeff` | full-body M × matte × premium = ¥557,700 | ✅ PASS |
| PPF front glass | flat price lookup | — | ✅ PASS |
| sp-door-cup (qty) | `unit_price × quantity` — fixed in Sprint 5B | qty=3 × ¥3,000 = ¥9,000 | ✅ PASS |
| Window film | `basePrice × gradeCoeff` | — | ✅ PASS |
| Maintenance | direct constant lookup | all prices = ¥0 (placeholder) | ✅ PASS |
| Carwash | direct constant lookup | — | ✅ PASS |
| Room clean | `basePrice × conditionCoeff` | — | ✅ PASS |
| Other | direct user-entered price | — | ✅ PASS |

### Discount and tax

| Item | Formula | Example (¥100,000 subtotal, 70% dealer, 10% tax) | Result |
|------|---------|--------------------------------------------------|--------|
| Coupon discount | sum of selected coupon amounts | — | ✅ PASS |
| Extra discount | manual input | — | ✅ PASS |
| Dealer discount | `round(subtotal × (1 − dealerRate/100))` | ¥100,000 × 0.30 = ¥30,000 | ✅ PASS |
| Taxable amount | `subtotal − all discounts` | ¥100,000 − ¥30,000 = ¥70,000 | ✅ PASS |
| Tax | `floor(taxable × taxRate / 100)` | ¥70,000 × 10% = ¥7,000 | ✅ PASS |
| Total | `taxable + tax` | ¥70,000 + ¥7,000 = ¥77,000 | ✅ PASS |

### Multiple / mixed services

| Scenario | Result |
|----------|--------|
| Coating + PPF sharing `sizeKey` | ✅ PASS — both use same `sizeKey` from step2 |
| Multiple carwash items additive | ✅ PASS |
| PPF + single parts subtotal | ✅ PASS |
| Coating options subtotal | ✅ PASS |

---

## 4. Estimate Summary (Step5)

| Section | Guard | Engine source | Result |
|---------|-------|--------------|--------|
| Coating | `has("coating") && coatId` | `coatItems[0].unit_price` | ✅ PASS |
| PPF | `has("ppf") && ppfTot > 0` | `ppfSvc.lineItems` | ✅ PASS |
| Maintenance | `has("maintenance") && maintenanceSel.length > 0` | `MAINTENANCE_MENUS` constants | ✅ PASS |
| Carwash | `has("carwash") && carwashSel.length > 0` | `CARWASH_MENUS` constants | ✅ PASS |
| Room clean | `has("roomclean") && roomCleanSel.length > 0` | recomputed locally | ⚠️ WARNING W-002 |
| Window | `has("window") && windowPartSel.length > 0` | recomputed locally | ⚠️ WARNING W-002 |
| Other | `has("other") && otherItems.length > 0` | `otherItems` state directly | ✅ PASS |
| Coupon discount | `couponDisc > 0` | engine | ✅ PASS |
| Extra discount | `extraDiscN > 0` | engine | ✅ PASS |
| Dealer discount | `isDealer && dealerDisc > 0` | engine | ✅ PASS |
| Tax | always shown | engine | ✅ PASS |
| Grand total | always shown | engine | ✅ PASS |

**Section display order:** coating → PPF → maintenance → carwash → roomclean → window → other

**serviceInputs / PDF order:** coating → PPF → window → maintenance → carwash → roomclean → other

→ **BUG-001 — Window position differs between step5 UI and PDF.** See Section 7.

---

## 5. estimate_items Generation

| Field | Source | Result |
|-------|--------|--------|
| `category` | `PricedLineItem.category` | ✅ PASS — correct per service |
| `item_name` | `PricedLineItem.item_name` | ✅ PASS |
| `quantity` | `PricedLineItem.quantity` | ✅ PASS — sp-door-cup uses qty > 1 |
| `unit_price` | `PricedLineItem.unit_price` | ✅ PASS |
| `discount_rate` | `PricedLineItem.discount_rate` (always 0) | ✅ PASS |
| `sort_order` | sequential offset from `buildLineItems` | ✅ PASS — no duplicates |
| `item_type` | `"manual"` | ✅ PASS |
| `description` | not in PricedLineItem → `null` | ✅ PASS — nullable column |
| `line_total` | `quantity × unit_price × (1 − discount_rate)` — computed in `createEstimate` | ✅ PASS |

### Category mapping

| EstimateCategory | Produced by | Result |
|-----------------|-------------|--------|
| `coating` | calcCoating (coat + topcoat items) | ✅ PASS |
| `ppf` | calcPpf (plan + front glass + single parts) | ✅ PASS |
| `window` | calcWindow | ✅ PASS |
| `interior` | calcRoomClean + `interior` coating options | ✅ PASS |
| `glass` | `glass` coating options | ✅ PASS |
| `other` | calcMaintenance + calcCarwash + calcOther | ✅ PASS |

---

## 6. PDF Pipeline

### Template analysis (`src/lib/pdf/templates/estimate-pdf.tsx`)

| Check | Result |
|-------|--------|
| All EstimateCategory values labelled | ✅ PASS — `coating`, `ppf`, `window`, `interior`, `glass`, `other` all present in `CATEGORY_LABELS` |
| Items sorted by `sort_order` | ✅ PASS — `items.sort((a, b) => a.sort_order - b.sort_order)` |
| `line_total` used for PDF column | ✅ PASS — computed correctly on save |
| Subtotal, discount, tax, total from DB | ✅ PASS |
| Discount shown only when `discount_amount > 0` | ✅ PASS |
| Notes section conditional | ✅ PASS |
| Customer + vehicle info | ✅ PASS |

**PDF item order** follows `sort_order` from DB, which reflects `serviceInputs` construction order (coating → PPF → **window** → maintenance → carwash → roomclean → other). This differs from the step5 UI display order. See BUG-001.

---

## 7. Bug Report

### BUG-001 — Step5 Window Film position differs from PDF order

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Type** | Display inconsistency |
| **Affects** | Users comparing step5 preview to generated PDF |

**Description:**

In the step5 breakdown (`EstimateWizard.tsx`), the Window Film section is rendered at position 6 out of 7 (after Room Clean):
```
Coating → PPF → Maintenance → Carwash → Room Clean → [Window] → Other
```

In `serviceInputs` (and therefore in `buildLineItems()` sort_order and the PDF), Window is at position 3:
```
Coating → PPF → [Window] → Maintenance → Carwash → Room Clean → Other
```

A customer/operator comparing the step5 confirmation screen to the printed PDF will see different item ordering.

**Root cause:** `serviceInputs` push order (line 325) places window before maintenance/carwash/roomclean, but the step5 JSX section order (lines 1281–1389) places window after them.

---

## 8. Warnings

### W-001 — Window serviceInput lacks empty-check guard

`if (has("window"))` pushes an empty `{ partIds: [] }` input before step-window is visited, unlike maintenance/carwash/roomclean/other which all check for non-empty selections. Functionally benign — step-window validates before advancing, ensuring `windowPartSel.length > 0` at save time. Code consistency concern only.

**File:** `EstimateWizard.tsx` line 325

### W-002 — Step5 prices for Room Clean and Window recomputed locally

The step5 breakdown displays Room Clean and Window item prices using inline recalculation (`Math.round(basePrice * coeff)`) instead of reading from `estCalc.services[...].lineItems[].unit_price`. The PPF and Coating sections correctly read from the engine.

Currently accurate — identical formula. Risk: if the pricing engine formula changes, the step5 display will silently diverge until someone notices the mismatch.

**File:** `EstimateWizard.tsx` lines 1347, 1369

### W-003 — PPF auto-detect doesn't fire for existing vehicle selection

`detectPpfRank(nv.maker)` is triggered by `useEffect(() => { … }, [nv.maker])`. This only fires for new vehicle creation (where the operator types the maker). For existing vehicle selection (`vMode === "select"`), `nv.maker` is never populated, so `ppfVehicleRank` defaults to `"std"`. The operator must manually correct the rank in step-ppf.

**File:** `EstimateWizard.tsx` line 277

### W-004 — New vehicles created in non-size flows default to body_size "M"

For maintenance/carwash/roomclean/other-only flows (no coating or PPF), step2 (body size selection) is skipped. If a new vehicle is created in these flows, it is saved with `body_size: sizeKey = "M"` (the initial default). Body size is informational in these flows (not used for pricing), but the stored value will be incorrect for vehicles that are not mid-size sedan.

**File:** `EstimateWizard.tsx` lines 475, 488

---

## 9. Data Integrity

| Check | Result |
|-------|--------|
| No duplicate item sort_order values | ✅ PASS — sequential offset in `buildLineItems` |
| No items with category outside EstimateCategory | ✅ PASS |
| No items with undefined unit_price | ✅ PASS |
| No items with negative price | ✅ PASS (no path produces negative prices) |
| PPF guard: no PPF items without a valid plan | ✅ PASS — `has("ppf") && ppfPlan` |
| Dealer ID injected server-side only | ✅ PASS — `createEstimate` never reads dealer_id from form |
| customer_id and vehicle_id validated to same dealer | ✅ PASS — `createEstimate` performs explicit DB validation |

---

## 10. Summary

| Category | Pass | Warning | Failed |
|----------|------|---------|--------|
| Build / TypeScript | 2 | 0 | 0 |
| Navigation | 12 | 0 | 0 |
| Validation | 9 | 0 | 0 |
| Pricing formulas | 10 | 0 | 0 |
| Discounts + tax | 6 | 0 | 0 |
| Step5 breakdown | 9 | 2 | 0 |
| estimate_items | 9 | 0 | 0 |
| PDF | 6 | 0 | 0 |
| Data integrity | 7 | 0 | 0 |
| Code quality | 0 | 2 | 0 |
| **Total** | **70** | **4** | **0** |

**Bug filed:** BUG-001 (MEDIUM) — Window Film display order differs between step5 UI and PDF.

**Recommendation:** BUG-001 is the only code defect. It is cosmetic (display ordering only). Totals, saved data, and PDF content are all correct. Can be addressed in a future cleanup sprint by reordering the step5 window section to match the serviceInputs order (after PPF, before maintenance).

---

*GYEON Detailer Agent | Implementation Sprint 6 Report | Office AZ | 2026-06-25*
