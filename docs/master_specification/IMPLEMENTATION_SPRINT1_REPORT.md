# IMPLEMENTATION SPRINT 1 REPORT
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Sprint** | Implementation Sprint 1 |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `1335b92` feat(wizard): implement step-maintenance, step-carwash, step-other |
| **File changed** | `src/components/estimates/EstimateWizard.tsx` |
| **Lines changed** | +213 / −5 |

---

## 1. Scope

Implement the three estimate wizard steps that have no blocking Operator Decisions:

| Step | Screen ID | Description |
|------|-----------|-------------|
| Maintenance | `step-maintenance` | Multi-select maintenance menu checklist |
| Carwash | `step-carwash` | Multi-select carwash menu checklist |
| Other Work | `step-other` | Free-form item entry (name + price) |

**Out of scope (blocked by Operator Decisions):**
- `step-ppf` — blocked by OD-2, OD-3, OD-4, OD-10, OD-15
- `step-window` — blocked by OD-5, OD-6
- `step-roomclean` — blocked by OD-7

---

## 2. Changes Made

### 2a. New Constants

Added two data constants after `DEFAULT_COUPONS`:

```typescript
const MAINTENANCE_MENUS: { id: string; name: string; price: number }[]
// 5 menus: A–E, price 0 (operator-configurable)

const CARWASH_MENUS: { id: string; name: string; price: number }[]
// 5 menus: hand/polish/coat/wax/vacuum, prices ¥2,000–¥8,000
```

Data matches `DEFAULT_SERVICE_PRICE_SETTINGS` in `dealer-settings-defaults.ts` exactly.

### 2b. PLACEHOLDER_SCREENS Reduced

**Before:**
```typescript
const PLACEHOLDER_SCREENS: Screen[] = [
  "step-ppf", "step-window", "step-maintenance", "step-carwash", "step-roomclean", "step-other",
];
```

**After:**
```typescript
const PLACEHOLDER_SCREENS: Screen[] = ["step-ppf", "step-window", "step-roomclean"];
```

### 2c. State Variables Added

```typescript
const [maintenanceSel, setMaintenanceSel] = useState<string[]>([]);
const [carwashSel,     setCarwashSel]     = useState<string[]>([]);
const [otherItems, setOtherItems] = useState<{ id: string; name: string; price: number }[]>([]);
const [otherName,  setOtherName]  = useState("");
const [otherPrice, setOtherPrice] = useState("");
```

### 2d. Price Calculation Extended

```typescript
const maintTot   = maintenanceSel.reduce(...MAINTENANCE_MENUS prices...);
const carwashTot = carwashSel.reduce(...CARWASH_MENUS prices...);
const otherTot   = otherItems.reduce(...item.price...);
const subtotal   = cPrice + tc2P + tc3P + optTot + maintTot + carwashTot + otherTot;
```

### 2e. Screen Implementations

**step-maintenance:** Multi-select checkboxes with blue selected state. Shows "価格未設定" for menus with `price: 0`. Live subtotal when selections have non-zero prices.

**step-carwash:** Multi-select checkboxes with live price display and running subtotal.

**step-other:** Two-field entry form (text + number) with Add button. Added items shown as a removable list. ✕ button per item. Running subtotal.

All screens use the existing style constants (`inp`, `lbl`, `bg-[#0f172a] border-slate-700` pattern, blue selected state `bg-blue-950/20 border-[#1d4ed8]/40`).

### 2f. handleSave Updated

Added line item construction for all three categories (using `category: "other"` — no new EstimateCategory values needed):

```typescript
if (has("maintenance") && maintenanceSel.length > 0) { ... mk("other", m.name, m.price) }
if (has("carwash") && carwashSel.length > 0) { ... mk("other", m.name, m.price) }
if (has("other") && otherItems.length > 0) { ... mk("other", item.name, item.price) }
```

**Vehicle creation gap fixed:** For maintenance/carwash/other flows that bypass `step4`, the vehicle was never created (step4Next was responsible). Added inline vehicle creation in handleSave:

```typescript
if (!resolvedVehicleId && vMode === "create") {
  const vr = await createVehicle(vfd);
  // sets vehicleId, vehLabel, resolvedVehicleId
}
```

### 2g. STEP5 Breakdown Extended

Added three new category sections in the estimate breakdown:
- **ボディ定期メンテナンス** — lists selected menus, shows "—" for unpriced menus
- **メンテナンス洗車** — lists selected menus with prices
- **その他作業** — lists all free-form items with prices

---

## 3. Verification

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean (no output) |
| ESLint | ⚠️ Not installed — no `eslint` binary in node_modules, no lint script in package.json |
| Build (`npm run build`) | ✅ Passing — 24/24 pages, no new errors |
| Pre-existing build warnings | `/products` dynamic-server-usage — pre-existing, not introduced by this sprint |

---

## 4. Architecture Notes

### CategoryId Mapping

`maintenance`, `carwash`, `other` are valid `CategoryId` values in the wizard's internal state. They do NOT correspond to `EstimateCategory` (DB enum: `coating | ppf | window | interior | glass | other`). All three new categories write line items with `category: "other"` — the `item_name` field carries the descriptive label.

### Navigation

Navigation for all three screens was already wired in `nextScreen()` and the footer Next button at line ~1091. No navigation changes were required.

### Data Source

Constants are defined inline in the component, consistent with the existing pattern (COATINGS, COATING_OPTIONS, etc. are also inline). They match `DEFAULT_SERVICE_PRICE_SETTINGS` in `dealer-settings-defaults.ts`.

---

## 5. Known Limitations (by design)

| Limitation | Reason | Resolution |
|-----------|--------|-----------|
| Maintenance menus all have `price: 0` | Operator has not configured prices yet — defaults are zero-value | Operator configures in Settings → ServicePricing |
| No validation requiring at least one selection | These steps are optional within their category | Consistent with existing step4 optional-skip behavior |
| ESLint not run | No ESLint binary installed in this project | Pre-existing project state; TypeScript and build both clean |

---

## 6. Sprint 1 Completion vs. Backlog

| Task | Status |
|------|--------|
| Read dealer-settings-defaults.ts | ✅ Complete |
| Remove 3 screens from PLACEHOLDER_SCREENS | ✅ Complete |
| Implement step-maintenance UI | ✅ Complete |
| Implement step-carwash UI | ✅ Complete |
| Implement step-other UI | ✅ Complete |
| Add state variables | ✅ Complete |
| Add price calculation | ✅ Complete |
| Update handleSave — new items | ✅ Complete |
| Fix vehicle creation gap (bypass step4) | ✅ Complete |
| Update STEP5 breakdown | ✅ Complete |
| TypeScript check | ✅ Passed |
| Build check | ✅ Passed |
| Clean commit | ✅ `1335b92` |

---

## 7. Next Sprint Candidates

After Operator Decision Session completes:

| Priority | Task | Unblocked by |
|----------|------|-------------|
| 1 | Fix `DEFAULT_DEALER_RATE` (OD-9) | OD-9 decided |
| 2 | Apply migration 070 to staging (OD-1) | OD-1 confirmed |
| 3 | Implement `step-ppf` | OD-2 + OD-3 + OD-4 + OD-10 + OD-15 |
| 4 | Implement `step-window` | OD-5 + OD-6 |
| 5 | Implement `step-roomclean` | OD-7 |

---

*GYEON Detailer Agent | Implementation Sprint 1 Report | Office AZ | 2026-06-25*
