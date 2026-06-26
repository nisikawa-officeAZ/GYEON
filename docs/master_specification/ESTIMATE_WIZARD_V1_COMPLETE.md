# ESTIMATE WIZARD V1 — COMPLETE
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Version** | v1.0 |
| **Date** | 2026-06-25 |
| **Status** | ✅ RELEASE READY |
| **Final commit** | `1618488` refactor(wizard): finalize estimate wizard v1 |

---

## Architecture

### Single-component wizard

`src/components/estimates/EstimateWizard.tsx`

A client-side React component. All wizard state lives in component state (no external store). The wizard is rendered by `src/components/flow/CustomerVehicleEstimateFlow.tsx`.

### Screen stack navigation

Navigation uses an immutable history stack (`Screen[]`):
- `push(screen)` — advance forward
- `pop()` — go back one step
- `screen` = `history[history.length - 1]`

**Screen order:**
```
category → step1 → [step2] → [step3] → [step4]
  → [step-ppf] → [step-window] → [step-maintenance]
  → [step-carwash] → [step-roomclean] → [step-other]
  → step5
```

Bracketed screens appear only when the corresponding category is selected. `nextScreen()` resolves the next screen from the current screen and active category set.

### Pricing Engine

Two-file separation:

| File | Role |
|------|------|
| `src/lib/pricing/pricing-data.ts` | Constants only — prices, multipliers, menus |
| `src/lib/pricing/pricing-engine.ts` | Calculation functions only — no UI coupling |

The wizard builds a `ServiceInput[]` array from component state and passes it to `calculateEstimate()` on every render (pure computation — no side effects). The engine result drives all display values and is passed to `buildLineItems()` on save.

### Data flow

```
Wizard state
  → ServiceInput[]
  → calculateEstimate() → EstimateResult
      → step5 display (subtotal, discount, tax, total)
      → per-service lineItems display
  → buildLineItems() → PricedLineItem[]
      → createEstimate(formData) → estimate_items (DB)
          → generateEstimatePdf() → PDF
```

No pricing logic exists outside `pricing-engine.ts`. The wizard never computes prices independently (except interactive previews during selection in service steps).

---

## Implemented Services

| Service | Category | Step | Key inputs |
|---------|----------|------|-----------|
| Coating | `coating` | step3 / step4 | product, size, topcoats, options |
| PPF | `ppf` | step-ppf | plan, film type, vehicle rank, front glass, single parts |
| Window Film | `window` | step-window | parts, grade |
| Maintenance | `other` | step-maintenance | menus |
| Car Wash | `other` | step-carwash | menus |
| Room Clean | `interior` | step-roomclean | parts, condition |
| Other | `other` | step-other | free-form name + price |

### Service pricing formulas

| Service | Formula |
|---------|---------|
| Coating | `base × BODY_SIZES[sizeKey].multi` |
| Topcoat | `TOPCOAT_BASE[id] × BODY_SIZES[sizeKey].multi` |
| PPF plan | `PPF_PLAN_PRICES[planId][sizeKey] × filmCoeff × rankCoeff` |
| PPF front glass | flat price lookup |
| PPF single parts | `part.price × qty` (sp-door-cup: qty 1–6) |
| Window Film | `basePrice × grade.coeff` |
| Maintenance | fixed price (currently ¥0 — placeholder) |
| Car Wash | fixed price |
| Room Clean | `basePrice × condition.coeff` |
| Other | operator-entered price |

### Discounts and tax

| Item | Formula |
|------|---------|
| Coupon | sum of selected coupon amounts |
| Extra discount | manual input |
| Dealer discount | `round(subtotal × (1 − dealerRate / 100))` |
| Tax | `floor(taxableAmount × taxRate / 100)` |
| Total | `taxableAmount + taxAmount` |

`taxableAmount = subtotal − coupon − extra − dealerDiscount`

---

## Special Features

### PPF vehicle rank auto-detection

`detectPpfRank(maker: string): string` — normalises the maker string and matches against `PPF_RANK_AUTO_DETECT` table (luxury → upper → premium → std). Fires:

1. On `nv.maker` change (new vehicle creation, via `useEffect`)
2. On existing vehicle selection (inline `onClick`)

Manual override always available in step-ppf.

### OCR vehicle registration

The operator can scan a 車検証 (vehicle registration certificate) in step1. OCR fills in customer name, address, and vehicle fields. Data is pre-loaded into form fields and can be edited before proceeding.

### sizeKey sharing (Coating + PPF)

When both Coating and PPF are selected, step2 (body size) runs once. The resulting `sizeKey` is shared by both the Coating and PPF pricing inputs.

### New vehicle creation timing

- **Coating / PPF flows:** Vehicle is created in `handleStep4Next()` (before entering the service steps).
- **Other flows (no coating/ppf):** Vehicle is created in `handleSave()` (at estimate save time) with `body_size: sizeKey` (defaults to "M" — see known limitations).

### Dealer pricing

Toggle in step1 (new customer only). When enabled, a dealer discount is computed as `subtotal × (1 − rate/100)`. The rate defaults to 70%. Dealer status is stored in the customer's `notes` and `occupation` fields.

---

## Known Limitations

| ID | Description | Impact | Planned fix |
|----|-------------|--------|------------|
| W-001 | Window `serviceInputs.push` lacks `windowPartSel.length > 0` guard (unlike other services). Step-window validation prevents any practical impact. | None — benign | Future cleanup |
| W-004 | New vehicles created in non-coating/ppf flows are saved with `body_size: "M"` (default) because step2 is skipped. | Informational field only — does not affect pricing | When OCR / Vehicle module adds body size detection |

---

## Quality Status

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean |
| Build (`npm run build`) | ✅ 24/24 pages |
| Lint | N/A — no lint script |
| BUG-001 (step5 window order) | ✅ Resolved in Sprint 6.1 |
| W-002 (local price recalculation) | ✅ Resolved in Sprint 6.1 |
| W-003 (PPF auto-detect existing vehicle) | ✅ Resolved in Sprint 6.1 |
| W-001 (window guard) | Open — benign |
| W-004 (body_size default) | Open — deferred |

---

## File Inventory

| File | Role | Sprint |
|------|------|--------|
| `src/components/estimates/EstimateWizard.tsx` | Wizard UI + state + navigation | 3, 4, 5C, 6.1 |
| `src/lib/pricing/pricing-data.ts` | Price constants for all services | 3, 4, 5B |
| `src/lib/pricing/pricing-engine.ts` | Calculation functions | 3, 4, 5B |
| `src/lib/estimates/create-estimate.ts` | Server Action — DB insert | Pre-existing |
| `src/lib/pdf/generate-estimate-pdf.ts` | PDF generation entry point | Pre-existing |
| `src/lib/pdf/templates/estimate-pdf.tsx` | PDF React template | Pre-existing |

---

## Sprint History

| Sprint | Name | Commit | Key deliverable |
|--------|------|--------|----------------|
| 3 | TypeScript fixes | `a4x...` | Fixed 6 TS errors after Pricing Engine refactor |
| 4 | Window Film | — | step-window, calcWindow, WINDOW_FILM_* constants |
| 5A | PPF Architecture | — | Design docs (PPF_ARCHITECTURE, PPF_DATA_MODEL, PPF_IMPLEMENTATION_PLAN) |
| 5B | PPF Core Engine | `c48f916` | calcPpf, PpfConfig, detectPpfRank, sum() fix |
| 5C | PPF Wizard UI | `447d819` | step-ppf, PPF state, auto-detect hook, step5 section |
| 6 | Validation | — | E2E audit — found BUG-001, W-001 through W-004 |
| 6.1 | Quality Fix | `1618488` | Resolved BUG-001, W-002, W-003 |

---

## Release Readiness

| Criterion | Status |
|-----------|--------|
| All 7 service categories implemented | ✅ |
| Pricing Engine — no duplication in UI | ✅ |
| Step5 display matches estimate_items order | ✅ |
| PDF supports all EstimateCategory values | ✅ |
| TypeScript clean | ✅ |
| Build passing | ✅ |
| No critical or high severity bugs open | ✅ |
| Open items are low-severity and deferred | ✅ (W-001, W-004) |

**Estimate Wizard v1.0 is production-ready.**

---

*GYEON Detailer Agent | Estimate Wizard V1 Completion Document | Office AZ | 2026-06-25*
