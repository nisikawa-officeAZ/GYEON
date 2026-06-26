# IMPLEMENTATION SPRINT 6.1 REPORT
## GYEON Detailer Agent — Quality Fix & Module Closure

| Field | Value |
|-------|-------|
| **Sprint** | 6.1 — Quality Fix & Module Closure |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `1618488` refactor(wizard): finalize estimate wizard v1 |
| **Lines changed** | +23 / −43 |

---

## 1. Build Checks

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS — 0 errors |
| Build | `npm run build` | ✅ PASS — 24/24 pages |
| Lint | N/A | N/A — no lint script |

---

## 2. Resolved Issues

### BUG-001 — Window Film step5 display order (RESOLVED)

**Before:** Window Film appeared at position 6/7 in the step5 confirmation breakdown (after Room Clean), while `serviceInputs` and PDF placed it at position 3/7 (after PPF, before Maintenance).

**After:** Step5 breakdown now matches the canonical service order:

```
coating → PPF → Window Film → Maintenance → Carwash → Room Clean → Other
```

This order is now consistent across:
- Step5 confirmation UI
- `serviceInputs` construction
- `buildLineItems()` sort_order
- PDF output

**Change:** Moved the Window Film JSX block in the step5 breakdown from position 6 to position 3 (after PPF, before Maintenance). Content unchanged.

---

### W-002 — Step5 local price recalculation removed (RESOLVED)

**Before:** Room Clean and Window Film item prices in the step5 breakdown were recomputed inline using `Math.round(basePrice × coeff)` — independent of the Pricing Engine output.

**After:** Both sections now read directly from the engine's `lineItems`:

```typescript
// Added to derived values block:
const windowSvc    = estCalc.services.find(s => s.type === "window");
const roomCleanSvc = estCalc.services.find(s => s.type === "roomclean");
```

```tsx
// Window — step5 display (was: windowPartSel.map with local price calc)
{windowSvc?.lineItems.map((item, i) => (
  <div key={i} className="flex justify-between text-sm">
    <span className="text-slate-300">{item.item_name}</span>
    <span className="text-slate-100">¥{item.unit_price.toLocaleString("ja-JP")}</span>
  </div>
))}

// Room Clean — step5 display (was: roomCleanSel.map with local price calc)
{roomCleanSvc?.lineItems.map((item, i) => (
  <div key={i} className="flex justify-between text-sm">
    <span className="text-slate-300">{item.item_name}</span>
    <span className="text-slate-100">¥{item.unit_price.toLocaleString("ja-JP")}</span>
  </div>
))}
```

**Additional effect:** Item names now reflect the engine's canonical labels. For Room Clean with non-normal condition, each item name includes the condition suffix (e.g., `"フロア（汚れあり）"`) — the condition was previously shown only in the section header. The section headers now show the service name only. For Window Film, item names include the grade suffix when non-standard (e.g., `"フロントサイド（プレミアム）"`). This makes step5 labels exactly match what is saved to `estimate_items`.

The step-roomclean and step-window *service screens* (before step5) continue to use the local recalculation for their interactive price previews — this is correct behavior and was not changed.

---

### W-003 — PPF rank auto-detect for existing vehicle selection (RESOLVED)

**Before:** `detectPpfRank()` only fired via `useEffect` on `nv.maker` changes — triggered only when the operator typed a maker in new-vehicle mode. Selecting an existing vehicle never updated `ppfVehicleRank`.

**After:** The existing-vehicle selection button now fires `detectPpfRank` inline:

```tsx
// EstimateWizard.tsx — existing vehicle select button
onClick={() => {
  setVehicleId(v.id);
  setVehLabel(label);
  if (v.maker) setPpfVehicleRank(detectPpfRank(v.maker));  // ← added
}}
```

Auto-detection now works for both flows:

| Flow | Trigger | Result |
|------|---------|--------|
| New vehicle | `nv.maker` change (useEffect) | rank auto-set |
| Existing vehicle | vehicle select button onClick | rank auto-set |
| No maker data | guard `if (v.maker)` | rank unchanged (stays "std") |

Manual override remains available — the operator can tap any rank button in step-ppf at any time.

---

## 3. Issues Not Fixed (by design)

| ID | Reason |
|----|--------|
| W-001 | Intentionally deferred — benign, step-window validation prevents any data issue |
| W-004 | Intentionally deferred — fix requires OCR / Vehicle module scope |

---

## 4. Regression Results

| Area | Result |
|------|--------|
| Wizard navigation — all 7 categories | ✅ No regression |
| Pricing Engine — all services | ✅ No regression (engine unchanged) |
| Estimate summary totals | ✅ No regression |
| estimate_items generation | ✅ No regression (buildLineItems unchanged) |
| PDF pipeline | ✅ No regression (PDF template unchanged) |
| PPF auto-detect — new vehicle | ✅ No regression |
| PPF auto-detect — existing vehicle | ✅ Now working |
| TypeScript | ✅ Clean |
| Build (24/24 pages) | ✅ Pass |

---

## 5. Module Readiness

The Estimate Wizard module is now functionally complete for v1.

| Component | Status |
|-----------|--------|
| Wizard navigation | ✅ Complete |
| Pricing Engine | ✅ Complete |
| Coating (7 products, topcoat, options) | ✅ Complete |
| PPF (plan, film, rank, front glass, parts) | ✅ Complete |
| Window Film (5 parts, 4 grades) | ✅ Complete |
| Maintenance (5 menus) | ✅ Complete |
| Carwash (5 menus) | ✅ Complete |
| Room Clean (5 parts, 3 conditions) | ✅ Complete |
| Other (free-form) | ✅ Complete |
| Discounts (coupon, extra, dealer) | ✅ Complete |
| Tax | ✅ Complete |
| Step5 confirmation | ✅ Complete |
| estimate_items persistence | ✅ Complete |
| PDF generation | ✅ Complete |
| Open issue W-001 | Open (benign) |
| Open issue W-004 | Open (deferred) |

---

*GYEON Detailer Agent | Implementation Sprint 6.1 Report | Office AZ | 2026-06-25*
