# IMPLEMENTATION SPRINT 3 REPORT
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Sprint** | Implementation Sprint 3 |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `c890927` feat(pricing): extract unified Pricing Engine |
| **Lines changed** | +353 / −163 |

---

## 1. Architecture Changes

### Before Sprint 3

Pricing logic was scattered across EstimateWizard.tsx:
- Inline data constants (COATINGS, BODY_SIZES, etc.)
- Three helper functions (`sizeMulti`, `coatingPrice`, `topcoatPrice`)
- Price calculation block with per-service inline `reduce` calls
- `handleSave` contained ~30 lines of line-item building logic duplicating the same data lookups

### After Sprint 3

Single-responsibility separation:

```
src/lib/pricing/
  pricing-data.ts    — all data constants (single source of truth)
  pricing-engine.ts  — all calculation logic (pure functions)

src/components/estimates/EstimateWizard.tsx
  — UI state + navigation only
  — calls calculateEstimate() once per render for display
  — calls buildLineItems() in handleSave for DB insert
```

---

## 2. Files Created

### `src/lib/pricing/pricing-data.ts`

Exports all shared pricing data previously inlined in EstimateWizard:

| Export | Type | Contents |
|--------|------|---------|
| `BODY_SIZES` | `{ key, name, multi }[]` | 8 body size multipliers |
| `COATINGS` | `const` array | 7 coating products with base prices |
| `CoatingId` | `type` | Derived from COATINGS |
| `TOPCOAT_BASE` | `Record<string, number>` | 9 topcoat base prices |
| `TOPCOAT_NAME` | `Record<string, string>` | Topcoat display names |
| `COATING_OPTIONS` | `{ id, name, price, cat }[]` | 10 add-on options |
| `MAINTENANCE_MENUS` | `{ id, name, price }[]` | 5 maintenance menus |
| `CARWASH_MENUS` | `{ id, name, price }[]` | 5 carwash menus |
| `ROOM_CLEAN_PARTS` | `{ id, name, basePrice }[]` | 5 room clean parts |
| `ROOM_CLEAN_CONDITIONS` | `{ id, label, coeff }[]` | 3 condition multipliers |

### `src/lib/pricing/pricing-engine.ts`

#### Input Types

```typescript
CoatingInput     { type: "coating"; coatingId; sizeKey; topcoat2?; topcoat3?; optionIds? }
MaintenanceInput { type: "maintenance"; menuIds }
CarwashInput     { type: "carwash"; menuIds }
RoomCleanInput   { type: "roomclean"; partIds; condition }
OtherInput       { type: "other"; items: { name; price }[] }
PpfInput         { type: "ppf" }      // reserved
WindowInput      { type: "window" }   // reserved
ServiceInput     = union of all above
```

#### Output Types

```typescript
PricedLineItem   { category, item_name, quantity, unit_price, discount_rate,
                   sort_order, item_type, product_id, sku, ... }
ServiceSubtotal  { type, lineItems, subtotal }
DiscountInput    { couponTotal, extraAmount, isDealer, dealerRate }
EstimateResult   { services, subtotal, couponDiscount, extraDiscount,
                   dealerDiscount, taxableAmount, taxAmount, total }
```

#### Public API

| Function | Signature | Description |
|----------|-----------|-------------|
| `calculateService` | `(input, sortOffset?) → ServiceSubtotal` | Single service price |
| `calculateEstimate` | `(services[], discounts, taxRate) → EstimateResult` | Full estimate |
| `buildLineItems` | `(services[]) → PricedLineItem[]` | Line items for DB |

---

## 3. Files Modified

### `src/components/estimates/EstimateWizard.tsx`

**Removed:**
- 9 inline data constants (all moved to pricing-data.ts)
- `sizeMulti()`, `coatingPrice()`, `topcoatPrice()` helper functions
- 30-line item-building block in `handleSave`
- `type LineItem` and `mk()` helper in `handleSave`
- `import { EstimateCategory }` (no longer needed in wizard)

**Added:**
- Imports from `@/lib/pricing/pricing-data` and `@/lib/pricing/pricing-engine`
- `serviceInputs: ServiceInput[]` array built from current UI state (includes ppf/window stubs)
- `calculateEstimate()` call replacing the entire inline price calculation block
- Per-service derived display values from engine result

**Key pattern in price calculation:**
```typescript
const serviceInputs: ServiceInput[] = [];
// ... push active services from state

const estCalc = calculateEstimate(serviceInputs, { couponTotal, extraAmount, isDealer, dealerRate }, taxRate);
const { subtotal, taxAmount, total, ... } = estCalc;

// Display-only derivations from engine result
const coatSvc      = estCalc.services.find(s => s.type === "coating");
const cPrice       = coatSvc?.lineItems[0]?.unit_price ?? 0;
const maintTot     = estCalc.services.find(s => s.type === "maintenance")?.subtotal ?? 0;
// ...
```

**handleSave simplified to:**
```typescript
const items = buildLineItems(serviceInputs);
// then fd.set("items_json", JSON.stringify(items))
```

---

## 4. Pricing Engine API

### calculateEstimate

```typescript
calculateEstimate(
  services: ServiceInput[],
  discounts: { couponTotal: number; extraAmount: number; isDealer: boolean; dealerRate: number },
  taxRate: number,
): EstimateResult
```

Calculates:
1. Each service subtotal via `calculateService()`
2. Total subtotal across all services
3. Dealer discount: `round(subtotal × (1 - dealerRate/100))` when `isDealer`
4. Taxable amount: `subtotal − couponTotal − extraAmount − dealerDiscount`
5. Tax: `floor(taxableAmount × taxRate / 100)`
6. Total: `taxableAmount + taxAmount`

### buildLineItems

Returns a flat `PricedLineItem[]` with globally sequential `sort_order` values (0, 1, 2...). Each item has `item_type: "manual"` and null product fields. Category mapping:

| Service | EstimateCategory |
|---------|-----------------|
| coating base + topcoats + options | `"coating"` / per-option `cat` |
| maintenance | `"other"` |
| carwash | `"other"` |
| roomclean | `"interior"` |
| other | `"other"` |
| ppf, window | empty (0 items) |

---

## 5. Current Integrations

| Service | Engine Support | Wizard Step | Status |
|---------|---------------|-------------|--------|
| Coating | ✅ Full | step2 → step3 → step4 | Complete |
| Maintenance | ✅ Full | step-maintenance | Complete |
| Carwash | ✅ Full | step-carwash | Complete |
| Room Clean | ✅ Full | step-roomclean | Complete |
| Other | ✅ Full | step-other | Complete |

---

## 6. Remaining Integrations (Future)

| Service | Engine Support | Wizard Step | Blocked by |
|---------|---------------|-------------|-----------|
| PPF | ⏳ Stub (0 price) | step-ppf (placeholder) | OD-2/3/4/10/15 |
| Window Film | ⏳ Stub (0 price) | step-window (placeholder) | OD-5/6 |

When ODs are resolved:
1. Add PPF/window pricing logic to `pricing-engine.ts` (calcPpf, calcWindow)
2. Populate `PpfInput` / `WindowInput` types with required fields
3. Implement step-ppf / step-window UI in EstimateWizard
4. No changes needed to serviceInputs building (stubs already push to array)

---

## 7. Test Results

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean |
| ESLint | N/A — not installed |
| Build (`npm run build`) | ✅ Passing — 24/24 pages |

---

*GYEON Detailer Agent | Implementation Sprint 3 Report | Office AZ | 2026-06-25*
