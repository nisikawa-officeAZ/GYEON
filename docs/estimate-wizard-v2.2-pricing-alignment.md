# Estimate Wizard Ver2.2 — Pricing Identity & Rule Alignment Specification

**Phase:** 10A (analysis / contract definition only — no runtime pricing).
**Status:** specification. No production pricing behavior changed. No runtime integration added.
**Scope:** define authoritative service identity, Wizard→production mapping strategy, per-category
pricing/manual-override policy, discount contract, deferred coupon behavior, production-engine gap
analysis, and the 10B–10E implementation sequence.

All identifiers, prices, and behaviors below were read directly from the current source; nothing
is guessed. Where a business rule is not discoverable from code, it is flagged as an **Architect
decision required** rather than assumed.

---

## 1. Production pricing authority

**Single authority (confirmed):** `src/lib/pricing/canonical-pricing-engine.ts` — "THE single entry
point for all estimate pricing." It re-exports the calculators; there is no competing engine.

| Concern | File | Notes |
|---|---|---|
| Canonical entry (barrel) | `src/lib/pricing/canonical-pricing-engine.ts` | re-exports engine + totals + catalog |
| Service calculators | `src/lib/pricing/pricing-engine.ts` | `calculateEstimate`, `calculateService`, `buildLineItems`, `buildPpfConfig` |
| Authoritative totals | `src/lib/pricing/estimate-totals.ts` | `calculateEstimateTotals`, `lineTotal` (shared by client preview + server persist) |
| Catalog type + defaults | `src/lib/pricing/pricing-catalog.ts` | `PricingCatalog`, `DEFAULT_PRICING_CATALOG`, `makePricingCatalog`, `dealerSettingsToPricingCatalog`, `bodySizeMultiplier` |
| Catalog data | `src/lib/pricing/pricing-data.ts` | `COATINGS`, `MAINTENANCE_MENUS`, `PPF_*`, etc. |
| Dealer overlay (I/O) | `src/lib/pricing/get-dealer-pricing-catalog.ts` | **`"use server"`** server action; reads dealer settings (DB); returns defaults on failure |

**Purity:** `calculateEstimate` / `calculateEstimateTotals` / `buildLineItems` with
`DEFAULT_PRICING_CATALOG` are **pure** (no I/O). `getDealerPricingCatalog()` is a server action with
DB reads — must **not** be called from a read-only client hook.

**Input:** `calculateEstimate(services: ServiceInput[], discounts: DiscountInput, taxRate: number,
catalog?: PricingCatalog)`.
**Output:** `EstimateResult { services, subtotal, couponDiscount, extraDiscount, dealerDiscount,
taxableAmount, taxAmount, total }`.

**Totals model (`calculateEstimateTotals`):**
- `lineTotal = round(qty × unit_price × (1 − discount_rate%))`
- `subtotal = Σ lineTotal`
- `discount = clamp(couponTotal + extraAmount + dealerDiscount, 0, subtotal)`
- `taxable = max(0, subtotal − discount)`
- `tax = floor(taxable × rate/100)` (default rate 10)
- `total = taxable + tax`

**Tax:** single exclusive rate parameter (`estimate?.tax_rate ?? 10`). **No** 8% reduced, tax-exempt
lines, inclusive pricing, or mixed rates exist.
**Rounding:** line = `Math.round`; catalog multipliers/coeffs = `Math.round`; document tax =
`Math.floor`; discount integer, clamped `[0, subtotal]`.
**Manual price:** only `OtherInput.items:{name,price}[]` accepts operator prices. All other categories
are catalog-priced (id + coefficient); overrides are ignored.

---

## 2. Current Wizard identity model

The Wizard Ver2.2 canonical draft (`wizard/draft/wizard-draft-types.ts`) stores service selections
as **presentation-config ids** sourced from the `wizard/screens/*-config.ts` files and
`coating-matrix.ts`. These are presentation fixtures — **not** production catalog ids. The Wizard
imports **no** production pricing module (`calculateEstimate`, `PricingCatalog`, catalog ids) in any
Ver2.2 file. (Only the *excluded* legacy `wizard/steps/*` draft references the engine.)

Production `ServiceInput` shapes vs Wizard draft shapes differ structurally:

| Production `ServiceInput` | Keyed by | Wizard draft (Screen 4) | Keyed by |
|---|---|---|---|
| `CoatingInput{coatingId,sizeKey,topcoat2,topcoat3,optionIds}` | catalog coating id | `coating{layerCount, layer1Id, layer2Id, layer3Id}` | matrix layer ids |
| `PpfInput{planId,filmType,vehicleRank,sizeKey,frontGlass,singleParts}` | plan/film/rank ids | `ppf{installationMethod, selectedPartIds, ppfTypeId, unitPriceInput, interiorRows}` | method/part/type ids |
| `WindowInput{partIds,grade}` | `wf-*` parts + grade | `windowFilm{selectedAreaIds, filmTypeId, unitPriceInput}` | area + film ids |
| `MaintenanceInput{menuIds}` | `A..E` | `bodyMaintenance{menuId, unitPriceInput}` | `maint-*` |
| `CarwashInput{menuIds}` | `cw-*` | `carWash{menuId, unitPriceInput}` | `wash-*` |
| `RoomCleanInput{partIds,condition}` | `rc-*` + condition | `roomCleaning{selectedMenuIds, unitPricesByMenu}` | `room-*` |
| `OtherInput{items:{name,price}[]}` | free name+price | `otherWork{selectedPresetIds, customRows}` | `ow-*` + custom |
| *(none)* | — | `storeGlobalOptions{selectedOptionIds,...}` | `gopt-*` |

---

## 3. Identity mismatch summary

| Category | Wizard ids | Production ids | Overlap | Model match |
|---|---|---|---|---|
| Coating | `one-evo, cancoat-evo, pure-evo, mohs-evo, syncro-evo, matte-evo, infinite-base-1, infinite-base-2` | `cancoat-evo, one-evo, pure-evo, mohs-evo, syncro-evo, infinit1, infinit2` | **5 of 8** match; `matte-evo` (no prod id), `infinite-base-1/2 ≠ infinit1/2` | layer-model vs coatingId+topcoat |
| PPF | methods `full/partial/…`; parts `front-bumper/bonnet/…`; types `gloss/matte/color/…` | plans `front-half/full-body`; film `clear/matte/carbon/color`; rank `std/…`; parts `sp-*` | **~0** (only film `matte`/`color` names coincide) | different model |
| Window film | areas `front-windshield/front-side/…`; film `standard/ir-cut/carbon/clear-uv` | parts `wf-front-side/wf-rear-side/…`; grade `standard/premium/uv-cut/ir-cut` | grade `standard`,`ir-cut` only | area vs part+grade |
| Body maintenance | `maint-6m/12m/coating/light/premium` | `A,B,C,D,E` | **none** | menu ids |
| Car wash | `wash-hand/premium/pure/hydrophobic/maint` | `cw-hand/polish/coat/wax/vacuum` | **none** | menu ids |
| Room cleaning | `room-interior/seat/leather/ceiling/carpet/deodor/premium` | `rc-floor/seat/ceiling/dash/full` + condition | **none** (`rc-*` vs `room-*`) | part+condition |
| Other work | presets `ow-*` + custom rows | `OtherInput` free name+price | custom rows map natively | manual |
| Store global options | `gopt-iron/hardpolish/scratch/headlight/touchpen` | `COATING_OPTIONS` (`iron/polish/headlight/…`) | name-level only (`iron`,`polish`,`headlight`); `scratch`,`touchpen` none | option ids |

**Conclusion:** except coating (mostly aligned, 3 discrepancies) and custom other-work rows, the
Wizard's selectable ids are **not** authoritative production ids, and 5 categories use structurally
different models. A safe mapping cannot be authored without either (a) re-keying Wizard configs to
catalog ids, or (b) projecting Wizard options from the catalog. Both are **10C** work.

---

## 4. Complete service identity matrix

Columns: Wizard Category | Wizard Item ID | Wizard Label | Production Category | Production ID |
Identity Strategy | Pricing Policy | Manual Override Policy | Current Status | Required Future Change | Blocking Issue.

Strategies: **S1** Direct Production ID · **S2** Catalog Projection · **S3** Manual Service Identity ·
**S4** Non-Priceable.

### Coating (`coating-matrix.ts` — layer products)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Manual | Status | Future change | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| one-evo | Q² ONE EVO | coating | one-evo | S1 | catalog_only | catalog_only | id matches | store `coatingId` in draft | none |
| cancoat-evo | Q² CANCOAT EVO | coating | cancoat-evo | S1 | catalog_only | catalog_only | id matches | store `coatingId` | none |
| pure-evo | PURE EVO | coating | pure-evo | S1 | catalog_only | catalog_only | id matches | store `coatingId` | none |
| mohs-evo | MOHS EVO | coating | mohs-evo | S1 | catalog_only | catalog_only | id matches | store `coatingId` | none |
| syncro-evo | SYNCRO EVO | coating | syncro-evo | S1 | catalog_only | catalog_only | id matches | store `coatingId` | none |
| matte-evo | (matte) | coating | **—** | S2 | catalog_only | catalog_only | **no prod id** | add to catalog OR remove from Wizard | **id absent in production** |
| infinite-base-1 | infinit Base 1 | coating | infinit1 | S2 | catalog_only | catalog_only | **id renamed** | reconcile `infinite-base-1`↔`infinit1` | **id string mismatch** |
| infinite-base-2 | infinit Base 2 | coating | infinit2 | S2 | catalog_only | catalog_only | **id renamed** | reconcile `infinite-base-2`↔`infinit2` | **id string mismatch** |
| *topcoat/2nd-3rd layer* | — | coating | `TOPCOAT_BASE` keys | S2 | catalog_only | catalog_only | Wizard "layers" ≠ prod topcoats | map layer2/3 → `topcoat2/3` | model gap |

### PPF (`ppf-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Manual | Status | Future change | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| full / partial / windshield / sunroof / interior | installation methods | ppf | plans `front-half/full-body` | S2 | catalog_only | (see note) | **no method→plan map** | define method→plan(+size) projection | model mismatch |
| front-bumper, bonnet, fender, door, door-edge, rocker, side-step, a/b/c-pillar, roof, trunk, door-mirror, headlight, taillight, other | partial parts | ppf | `sp-headlight, sp-b-pillar, sp-c-pillar, sp-mirror` | S2 | catalog_only | — | **~no overlap** | project parts from `ppfSingleParts` | id/set mismatch |
| gloss, protect-plus, enhance, hybrid, matte, color | PPF types | ppf | film `clear/matte/carbon/color` | S2 | catalog_only | — | partial (matte/color names) | map type→`filmType` | id mismatch |
| *interior rows* | free location+amount | ppf | *(none — manual)* | S3 | manual_only | manual_only | manual entry | route via manual line items | none |
| *unitPriceInput* | editable PPF price | ppf | *(not accepted)* | — | catalog_with_override? | **Architect** | override ignored by engine | decide policy | engine gap |

### Window Film (`window-film-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Manual | Status | Future change | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| front-windshield, front-side, rear-side, rear-window, sunroof, quarter, full, other | install areas | window | parts `wf-front-side/wf-rear-side/wf-rear/wf-quarter/wf-all` | S2 | catalog_only | — | **id mismatch** | project areas from `windowParts` | id/set mismatch |
| standard, ir-cut, carbon, clear-uv | film types | window | grade `standard/premium/uv-cut/ir-cut` | S2 | catalog_only | — | `standard/ir-cut` match; `carbon/clear-uv` no | map film→grade | partial |
| *unitPriceInput* | editable price | window | *(not accepted)* | — | catalog_with_override? | **Architect** | override ignored | decide policy | engine gap |

### Body Maintenance (`body-maintenance-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Manual | Status | Future change | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| maint-6m | 6か月メンテナンス | maintenance | *(none)* | S2 | catalog_only | — | **no map** (`A..E`) | project from `maintenanceMenus` OR re-key | id mismatch |
| maint-12m | 12か月メンテナンス | maintenance | *(none)* | S2 | catalog_only | — | no map | project/re-key | id mismatch |
| maint-coating | コーティング定期 | maintenance | *(none)* | S2 | catalog_only | — | no map | project/re-key | id mismatch |
| maint-light | ライトメンテナンス | maintenance | *(none)* | S2 | catalog_only | — | no map | project/re-key | id mismatch |
| maint-premium | プレミアムメンテナンス | maintenance | *(none)* | S2 | catalog_only | — | no map | project/re-key | id mismatch |
| *(production A..E have price 0 — see §8)* | | | | | | | | | |

### Car Wash (`car-wash-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Status | Blocker |
|---|---|---|---|---|---|---|---|
| wash-hand | 手洗い洗車 | carwash | *(none)* | S2 | catalog_only | no map (`cw-*`) | id mismatch |
| wash-premium | プレミアム洗車 | carwash | *(none)* | S2 | catalog_only | no map | id mismatch |
| wash-pure | 純水洗車 | carwash | *(none)* | S2 | catalog_only | no map | id mismatch |
| wash-hydrophobic | 撥水洗車 | carwash | *(none)* | S2 | catalog_only | no map | id mismatch |
| wash-maint | メンテナンス洗車 | carwash | *(none)* | S2 | catalog_only | no map | id mismatch |

### Room Cleaning (`room-cleaning-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Status | Blocker |
|---|---|---|---|---|---|---|---|
| room-interior | 車内クリーニング | roomclean | *(none)* | S2 | catalog_only | no map (`rc-*`) | id mismatch |
| room-seat | シートクリーニング | roomclean | `rc-seat`? (name-coincident only) | S2 | catalog_only | name-coincident, not id-authoritative | id mismatch |
| room-leather | レザークリーニング | roomclean | *(none)* | S2 | catalog_only | no map | id mismatch |
| room-ceiling | 天井クリーニング | roomclean | `rc-ceiling`? (name only) | S2 | catalog_only | name-coincident | id mismatch |
| room-carpet | カーペットクリーニング | roomclean | *(none)* | S2 | catalog_only | no map | id mismatch |
| room-deodor | 消臭・除菌 | roomclean | *(none)* | S2 | catalog_only | no map | id mismatch |
| room-premium | プレミアムルーム | roomclean | `rc-full`? (concept only) | S2 | catalog_only | not id-authoritative | id mismatch |
| *(production room-clean also has condition coeff `normal/dirty/heavy`; Wizard has no condition selector)* | | | | | | model gap | |

### Other Work (`other-work-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Manual | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| ow-travel | 出張費 | other | *(none — manual)* | S3 | manual_only | manual_only | preview price; safe as manual name+price | preview price is fixture (§20) |
| ow-disposal | 廃材処理 | other | *(none)* | S3 | manual_only | manual_only | fixture price | fixture |
| ow-parts | 部品代 | other | *(none)* | S3 | manual_only | manual_only | fixture price | fixture |
| ow-repair | 特殊補修 | other | *(none)* | S3 | manual_only | manual_only | fixture price | fixture |
| ow-labor | 追加作業工賃 | other | *(none)* | S3 | manual_only | manual_only | fixture price | fixture |
| *custom rows* | user name+price | other | *(none)* | S3 | manual_only | manual_only | **maps natively to `OtherInput`** | none |

### Store Global Options (`store-global-options-config.ts`)
| WizItemID | Label | ProdCat | ProdID | Strat | Policy | Manual | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| gopt-iron | 鉄粉除去 | coating option | `iron` | S2 | catalog_only | catalog_only | name-coincident, id differs | reconcile `gopt-iron`↔`iron` |
| gopt-hardpolish | ハードポリッシュ | coating option | `polish` | S2 | catalog_only | catalog_only | name-coincident, id differs | reconcile `gopt-hardpolish`↔`polish` |
| gopt-scratch | 傷補修 | — | **—** | S3/S4 | manual_only or not_priceable | manual? | **no prod option** | Architect: add option or treat manual |
| gopt-headlight | ヘッドライトリペア | coating option (`other` cat) | `headlight` | S2 | catalog_only | catalog_only | name-coincident, id differs | reconcile `gopt-headlight`↔`headlight` |
| gopt-touchpen | タッチペン | — | **—** | S3/S4 | manual_only or not_priceable | manual? | **no prod option** | Architect: add option or treat manual |

> Store Global Options are cross-category in the Wizard, but production models them as **coating
> options** (`COATING_OPTIONS`, attachable to a `CoatingInput.optionIds`). Applying a global option
> when no coating is selected has **no** production representation → Architect decision (see §8).

---

## 5. Category pricing policy matrix (proposed)

Allowed: `catalog_only` · `manual_only` · `catalog_with_override` · `derived` · `not_priceable`.

| Category | Proposed policy | Why | Prod matches? | Wizard matches? | Must change | DB/catalog change |
|---|---|---|---|---|---|---|
| Coating | `catalog_only` | prod prices by `coatingId × size multiplier`; no override path | Yes | Wizard exposes no coating price edit → Yes | store `coatingId`+`sizeKey`+topcoats; reconcile 3 ids | reconcile `infinit1/2`, add/remove `matte-evo` |
| PPF | `catalog_only` (base) + `manual_only` (interior rows) | prod prices by plan×film×rank×size + `sp-*` parts; Wizard `unitPriceInput` unsupported | base Yes; override No | Wizard has `unitPriceInput` (mismatch) | define method→plan projection; decide override | possibly extend catalog for missing parts/types |
| Window Film | `catalog_only` | prod prices by `wf-part × grade coeff`; Wizard `unitPriceInput` unsupported | base Yes; override No | mismatch (`unitPriceInput`) | project areas from `windowParts`; decide override | none if projected |
| Body Maintenance | **Architect** (likely `catalog_only`) | prod menus `A..E` have **price 0** (unconfigured) | prod exists but priced 0 | Wizard has 5 named menus + editable price | decide: re-key to `A..E` w/ dealer prices, or make dealer-config | dealer settings must define menu prices |
| Car Wash | `catalog_only` | prod `cw-*` priced | Yes | id mismatch + editable price | re-key/project to `cw-*` | none |
| Room Cleaning | `catalog_only` | prod `rc-* × condition coeff` | Yes | id mismatch; no condition selector; per-menu editable price | project from `rc-*`; add condition or default `normal` | none |
| Other Work | `manual_only` | prod `OtherInput` = free name+price | Yes | Yes (custom rows); presets carry fixture prices | drop fixture preset prices OR make presets dealer-config | optional dealer preset catalog |
| Store Global Options | **Architect** (`catalog_with_override` or split) | prod models as coating options; 2 of 5 have no prod id; applies only to coating | partial | Wizard treats as cross-category w/ editable price | reconcile ids; decide cross-category semantics | add missing options (`scratch`,`touchpen`) or manual |

---

## 6. Manual unit price decision matrix

| Category | Wizard editable price? | Prod override support | Proposed future policy | Engine change | UI change | Save-mapping change |
|---|---|---|---|---|---|---|
| Coating | No | No | `catalog_only` | none | none | map `coatingId` |
| PPF (base) | Yes (`unitPriceInput`) | No | **Architect**: `catalog_only` (recommend) or `catalog_with_override` | override → engine change | remove/keep edit per decision | map plan/film/rank |
| PPF (interior rows) | Yes (location+amount) | Only via `OtherInput` | `manual_only` | none (route as manual line) | none | map to manual items |
| Window Film | Yes (`unitPriceInput`) | No | **Architect**: `catalog_only` (recommend) | override → engine change | remove/keep edit | map areas→`wf-*` |
| Body Maintenance | Yes | No | `catalog_only` (dealer-priced) | none | remove edit or make dealer-config | map to `A..E` |
| Car Wash | Yes | No | `catalog_only` | none | remove edit | map to `cw-*` |
| Room Cleaning | Yes (per-menu) | No | `catalog_only` (+condition) | none | remove edit; add condition | map to `rc-*` |
| Other Work | Yes (preset + custom) | Yes (`OtherInput`) | `manual_only` | none | keep | map to `OtherInput.items` |
| Store Global Options | Yes | No (options are fixed catalog price) | **Architect**: `catalog_with_override` or `manual_only` | override → engine change | per decision | map to coating `optionIds` |

**Architect defaults applied where non-contradictory:** standard catalog services →
`catalog_only`; custom work → `manual_only`. **Deviations flagged** where the Wizard currently
exposes an editable price the engine cannot honor (PPF/Window/Maintenance/CarWash/RoomClean/Global
Options) — these are the manual-override policy decisions the Architect must confirm.

---

## 7. Discount contract proposal

**Current production behavior (from `pricing-engine.ts` + `estimate-totals.ts`):**
- `DiscountInput = { couponTotal, extraAmount, isDealer, dealerRate }`.
- Application: `combined = couponTotal + extraAmount + dealerDiscount`, where
  `dealerDiscount = round(subtotal × (1 − dealerRate/100))` when `isDealer`.
- `combined` is **clamped to `[0, subtotal]`** → `taxable = subtotal − combined` → tax → total.
- Dealer rate and operator (`extraAmount`) discount **do stack** (both summed).
- **No percentage operator-discount path exists.** `dealerRate` is the only percentage.
- Rounding: discount amounts are integers; dealer discount `round`; tax `floor`.
- Max-discount guard: clamp to subtotal. Negative-total prevention: `taxable = max(0, …)`.

**Proposed future contract (target — NOT implemented this phase):**
```ts
export type PricingDiscountIntent =
  | { mode: 'none' }
  | { mode: 'fixed_amount'; amount: number; reason?: string }
  | { mode: 'percentage'; percentage: number; reason?: string }
  | { mode: 'dealer_rate'; percentage: number; source: 'business_customer' };
```
| Rule | Current | Proposal | Decision owner |
|---|---|---|---|
| Fixed amount range | `[0, subtotal]` (clamped) | keep clamp | derived from code |
| Percentage range | **none** | e.g. `0–100`; Wizard preview uses `0–30` | **Architect** |
| dealer_rate range | UI `0–100` | keep | code |
| Application order | subtotal → sum(coupon+extra+dealer) → clamp → tax | subtotal → operator discount → dealer_rate → coupon (deferred) → clamp → tax | **Architect** (stacking order) |
| Dealer + operator stack? | **Yes** (summed) | keep unless Architect changes | **Architect confirm** |
| Coupon before/after discount | coupon summed same stage (but reserved) | **deferred** (see §8) | **Architect** |
| Rounding stage | line=round, tax=floor, discount integer | keep | code |
| Tax stage | after discount clamp | keep | code |
| Max-discount guard | clamp `[0, subtotal]` | keep | code |
| Zero/negative-total | `taxable=max(0,…)`, `total≥0` | keep | code |
| Error codes | none in engine | `INVALID_DISCOUNT`, `DISCOUNT_EXCEEDS_SUBTOTAL`, `PERCENT_OUT_OF_RANGE` | proposal |

**Architect decisions required:** percentage discount range; whether percentage stacks with
dealer_rate; coupon-vs-discount order (when coupons exist).

---

## 8. Coupon deferred contract

Production coupons are **reserved, not implemented** (`canonical-pricing-engine.ts`:
"coupon: DiscountInput.couponTotal is reserved — coupons NOT implemented"). Wizard `EXAMPLE_COUPONS`
are preview-only fixtures.

**Deferred behavior (target):**
```ts
export type WizardCouponPricingState =
  | { status: 'none' }
  | { status: 'selected_not_priced'; couponId: string; label: string;
      warningCode: 'COUPON_PRICING_NOT_IMPLEMENTED' };
```
- Keep coupon selection UI (Screen 5) and coupon intent in the draft.
- **Do not** apply coupon values to totals; `couponTotal = 0` in any pricing call.
- Screen 7 shows a **non-blocking warning**: "Coupon selected, but production coupon calculation is
  not yet available. The coupon is not included in the current calculated total."
- Save mapping must not mark a coupon as financially applied; PDF must not show a coupon deduction.
- No fake coupon amount may appear anywhere.

---

## 9. Catalog-driven UI feasibility (Screens 3 & 4)

**Long-term direction (recommended):** *production catalog owns identity + pricing data; Wizard
config owns presentation metadata only (labels, grouping, icons, layout, rank gating, badges).*

| Aspect | Assessment |
|---|---|
| Benefits | Single identity source; dealer-specific prices flow automatically; eliminates id mismatch; removes fixture-price risk |
| Risks | Catalog shape is narrower than Wizard UX (PPF installation methods, window areas, room conditions not 1:1) |
| UI regression risk | Medium — Screen 4 selectors assume the current config shapes; projection must preserve them |
| GenSpark visual compat | Preserved if config files remain as **presentation metadata** keyed by catalog id |
| Rank-filter | `coating-matrix` gates by shop rank; catalog has `certOnly` — projection must keep rank gating |
| Dealer-specific price | `getDealerPricingCatalog()` (server action) supplies dealer prices; needs a load/SSR strategy |
| Offline/loading | Catalog fetch is async; need loading + `DEFAULT_PRICING_CATALOG` fallback (mirrors EstimateEditor) |
| Missing-item | Catalog overlay falls back to defaults by id; projection must handle absent ids as non-selectable |
| Migration | Keep config files; add a `pricingReferenceId` per presentation item OR generate items from catalog |
| Preview configs remain? | **Yes** — as presentation metadata; production identity/prices come from catalog |

Feasible, but it is **10C** scope. Not implemented here.

---

## 10. Production engine gap analysis

| # | Gap | Current | Required | Affected file | Risk | Backward-compat | Phase |
|---|---|---|---|---|---|---|---|
| 1 | Percentage discount | only fixed `extraAmount` + `dealerRate` | add `percentage` mode | `pricing-engine.ts`, `estimate-totals.ts` | Med | additive if new param | 10B |
| 2 | Explicit warning/error results | throws/returns numbers only | structured `warnings[]`/`errors[]` | `pricing-engine.ts` (new wrapper) | Low | additive (new return) | 10B |
| 3 | Manual override by category | only `OtherInput` | per-category override policy support | `pricing-engine.ts` | Med-High | risky; needs policy | 10B |
| 4 | Coupon support | reserved/not impl | coupon model + resolution | new module | High | additive; deferred | post-10D |
| 5 | Unknown service handling | silently returns subtotal 0 | controlled error `UNKNOWN_SERVICE_ID` | wrapper | Low | additive | 10B |
| 6 | Catalog id resolution | id lookup in catalog | Wizard must pass authoritative ids | Wizard mapping | High | — | 10C |
| 7 | Option pricing (global options) | `CoatingInput.optionIds` only | cross-category options? | `pricing-engine.ts` | Med | Architect | 10B/10C |
| 8 | Quantity pricing | PPF single parts only (`qty`) | Wizard qty (parts/options) | mapping + engine | Med | additive | 10C |
| 9 | Vehicle-size pricing | coating & PPF use `sizeKey` | Wizard must pass `bodySizeKey` | mapping | Low | — | 10C |
| 10 | PPF area/method pricing | plan/film/rank/size model | method→plan projection | mapping | High | — | 10C |
| 11 | Window-film area pricing | part+grade model | area→part projection | mapping | High | — | 10C |
| 12 | Tax rates | single exclusive rate | keep (no reduced tax) | — | — | none | — |
| 13 | Rounding | round line / floor tax / clamp | keep | — | — | none | — |

---

## 11. Required future type changes

Target canonical selected-service reference (specification target; **do not** replace runtime types
unless purely additive/non-behavioral):
```ts
export type WizardPriceableServiceReference = {
  sourceCategory: WizardServiceCategory;
  presentationId: string;                 // Wizard config id (label/grouping)
  pricingReferenceId: string | null;      // authoritative production catalog id (null = manual/none)
  pricingPolicy: 'catalog_only' | 'manual_only' | 'catalog_with_override' | 'derived' | 'not_priceable';
  manualUnitPrice: number | null;
  quantity: number;
  selectedOptionReferenceIds: string[];
};
```
- Additive only until 10C. The current `wizard-draft-types.ts` service drafts stay as the runtime
  source; a projection/adapter produces `WizardPriceableServiceReference[]` at pricing time.

---

## 12. Required future source-file changes

| File | Change | Phase |
|---|---|---|
| `src/lib/pricing/pricing-engine.ts` | add percentage discount, warning/error results, override policy hooks, unknown-id handling (additive wrapper preferred) | 10B |
| `src/lib/pricing/estimate-totals.ts` | percentage-aware discount input (if not done via wrapper) | 10B |
| `src/lib/pricing/pricing-data.ts` / catalog | reconcile coating ids (`infinit1/2`, `matte-evo`); optionally add `scratch`/`touchpen` options | 10B/10C |
| `wizard/screens/*-config.ts` | add `pricingReferenceId` per item OR become catalog projections | 10C |
| `wizard/screens/coating-matrix.ts` | reconcile `infinite-base-1/2`→`infinit1/2`; resolve `matte-evo` | 10C |
| `wizard/draft/wizard-draft-types.ts` | additively carry `pricingReferenceId` where available | 10C |
| `wizard/pricing/*` (new) | input adapter, result adapter, `useWizardPricing`, error/status types | 10D |
| `wizard/screens/Step7Review.tsx` + `integration/WizardPreviewPanel.tsx` | show real totals + coupon warning; remove mock %→yen | 10D |
| `wizard/screens/ScreensPreview.tsx` | drop preview `Math.round(previewSubtotal*pct/100)` mock; feed `WizardPricingResult` | 10D |

---

## 13. Recommended implementation sequence (10B–10E)

- **10B — Production Pricing Contract Extension:** add (additively, behind the canonical engine)
  percentage-discount support, explicit `warnings[]`/`errors[]` result, per-category manual-override
  policy, unknown-id handling. Reconcile the 3 coating id discrepancies. **No** coupon calc. Verify
  byte-identical behavior when new features unused (regression guard).
- **10C — Catalog Identity Projection:** project Screen 3/4 selectable options from the production
  catalog (or attach authoritative `pricingReferenceId` to each config item); resolve the
  method→plan / area→part / menu id gaps; keep config files as presentation metadata. **No pricing
  execution.**
- **10D — Read-Only Pricing Integration:** Wizard draft → `WizardPricingInput` → production engine →
  `WizardPricingResult` → Screen 7. Coupon **warning only**. Remove mock arithmetic.
- **10E — Pricing Regression Audit + Checkpoint Commit.**

Do not begin 10B under this instruction.

---

## 14. Blocking Architect decisions

1. **Coating id reconciliation:** `infinite-base-1/2` vs `infinit1/2`; fate of `matte-evo` (add to
   catalog or remove from Wizard).
2. **Maintenance pricing source:** production `A..E` are priced **0** — dealer settings must define
   real prices, or maintenance becomes dealer-config; and Wizard `maint-*` must re-key/project.
3. **Manual-override policy** per category (PPF/Window/Maintenance/CarWash/RoomClean/Global Options)
   — the Wizard exposes editable prices the engine cannot honor today.
4. **Store Global Options semantics:** cross-category vs coating-option-only; and `scratch`/`touchpen`
   (no production id) → add options or treat as manual.
5. **Discount stacking & percentage range:** percentage range; whether percentage stacks with
   dealer_rate; coupon-vs-discount order.
6. **PPF / Window / Room models:** how installation-method/area/menu selections project onto
   plan/part/condition catalog entries.
7. **Other-work preset prices:** fixture prices must be dropped or sourced from a dealer preset
   catalog (cannot feed fixtures into production totals — §20).

---

## 15. Non-goals (this phase)

No runtime pricing; no engine/tax/discount/coupon calculation changes; no mapping tables (§15 rule —
no side authoritative source exists yet); no catalog loading; no save/DB/API/server-action/migration;
no PDF/LINE/OCR; no production route changes; no modification of the excluded Unified Wizard draft or
unrelated PDF/estimate-type files. This document is the sole deliverable.
