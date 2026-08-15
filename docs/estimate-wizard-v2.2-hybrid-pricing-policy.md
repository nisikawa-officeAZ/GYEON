# Estimate Wizard Ver2.2 — Hybrid Pricing Policy (Phase 10F-R)

Status: implemented (read-only pricing preview). No Estimate Save, no persistence, no migration.

## 1. Architect decision

DealerOS Estimate Wizard Ver2.2 uses a **hybrid pricing identity model**. A selected service is
priced from **either** an authoritative production catalog reference **or** an authoritative
operator-entered manual amount — never both, never neither. Catalog identity is not mandatory for
every Wizard category.

## 2. Reason the full catalog migration was rejected

Phase 10F attempted to connect every Screen 3/4 selection to a production catalog identity. Source
review proved this impossible without guessing:

- Only **Coating** uses production catalog IDs directly (`layer1Id` = `COATINGS[].id`).
- PPF, Window Film, Body Maintenance, Car Wash, Room Cleaning, and Store Global Options use a
  different presentation taxonomy **and** collect an operator-entered manual unit price
  (`unitPriceInput` / `unitPricesByMenu` / `unitPricesByOption`). Their config IDs do not correspond
  to any production catalog identity, several presentation items have no production entity at all,
  and production maintenance menus are ¥0 placeholders.
- Bridging them would require label matching, array-index identity, or invented catalog IDs — all
  forbidden. The approved GenSpark Ver2.2 UI is a **manual-price** design for these categories, so
  forcing the production coefficient catalog onto it would redesign approved business logic.

The full migration was therefore cancelled and replaced by this hybrid policy.

## 3. Approved category pricing policies

| Category | Pricing source | Pricing policy |
| --- | --- | --- |
| Coating | Production catalog | `catalog_only` |
| PPF | Approved Wizard manual inputs | `manual_only` |
| Window Film | Approved Wizard manual inputs | `manual_only` |
| Body Maintenance | Approved Wizard manual inputs | `manual_only` |
| Car Wash | Approved Wizard manual inputs | `manual_only` |
| Room Cleaning | Approved Wizard manual inputs | `manual_only` |
| Other Work | Approved manual service path | `manual_only` |
| Store Global Options | Per-option | `manual_only` / `not_priceable` |

Encoded in `WIZARD_CATEGORY_PRICING_POLICY` (`pricing/wizard-pricing-identity.ts`).

## 4. Hybrid identity contract

```ts
export type WizardPricingIdentity =
  | { source: "catalog"; pricingReferenceId: string }
  | { source: "manual"; manualPricingIdentity: string }
  | { source: "not_priceable" };
```

Rules: catalog items require a real authoritative production ID; manual items require a stable
internal manual identity; a manual identity never pretends to be a catalog ID; labels and array
indexes are never used as identity; `not_priceable` never affects totals; no temporary mapping table.

## 5. Manual identity sources

Every manual identity originates from an existing stable config/draft field (never a label, never an
index):

| Category | Manual identity source |
| --- | --- |
| PPF | `installationMethod` (main line) / `interiorRows[].id` (interior rows) |
| Window Film | `filmTypeId` |
| Body Maintenance | `bodyMaintenance.menuId` |
| Car Wash | `carWash.menuId` |
| Room Cleaning | each `roomCleaning.selectedMenuIds[]` |
| Other Work | each `customRows[].id` |
| Store Global Options | each `selectedOptionIds[]` (config option id) |

If a stable identity does not exist for a selected item, it is reported
(`MANUAL_PRICING_IDENTITY_MISSING`), never invented.

## 6. Category amount semantics

The priced amount is the **operator-entered value only**. The EXAMPLE config `defaultPrice` is a
PREVIEW fixture and is never used in a total (config supplies labels and quantity rules only).

| Category | Amount field | Quantity | Canonical line shape | Multiplication |
| --- | --- | --- | --- | --- |
| Coating | — (catalog) | — | catalog line(s) | engine |
| PPF | `unitPriceInput` (method) / `interiorRows[].amount` (interior) | 1 | single + interior rows | none |
| Window Film | `unitPriceInput` | 1 | single | none |
| Body Maintenance | `unitPriceInput` | 1 | single | none |
| Car Wash | `unitPriceInput` | 1 | single | none |
| Room Cleaning | `unitPricesByMenu[id]` | 1 | one line per selected menu | none |
| Other Work | `customRows[].unitPrice` | 1 (limitation preserved) | one line per named row | none |
| Store Global Options | `unitPricesByOption[id]` | `quantitiesByOption[id]` when `quantityRequired` | one line per option | unit × qty (config-authorized) |

Other Work custom-row quantity is a free operator note and is not multiplied (Phase 10D behavior
preserved); a warning is surfaced when a quantity greater than 1 is entered.

## 7. Store Global Option classification

Each option is classified from its config field, not its label: an option with
`editableUnitPrice !== false` is `manual_only`; an option the operator cannot price
(`editableUnitPrice === false`) is `not_priceable` and is excluded from totals with a warning. All
five current example options are `manual_only`. `gopt-scratch` and `gopt-touchpen` declare
`quantityRequired` and price as unit × quantity.

## 8. Error and warning codes

Errors (`WIZARD_PRICING_ERRORS`):

- `MANUAL_PRICE_REQUIRED` — a selected manual item needs an amount and none exists.
- `MANUAL_PRICING_IDENTITY_MISSING` — an amount exists but no stable identity was selected.
- `INVALID_MANUAL_PRICE` — the entered amount is not a valid non-negative number.
- `INVALID_QUANTITY` — a required quantity is out of the configured range.
- `UNKNOWN_PRICING_REFERENCE` — a catalog-claimed item has no production reference.
- `PERCENTAGE_NOT_SUPPORTED` — percentage discount is not applied (document-level).
- `NO_SERVICE_SELECTED`, `PRODUCTION_PRICING_ERROR` — document-level.

Warnings (`WIZARD_PRICING_WARNINGS`): `COUPON_PRICING_NOT_IMPLEMENTED`, `MULTI_LAYER_NOT_MAPPED`,
`MISSING_BODY_SIZE`, `PREVIEW_ONLY_ITEM`.

## 9. Pricing completeness rules

`WizardPricingCompleteness = "complete" | "partial" | "unavailable" | "error"`.

- `error` — an invalid amount/quantity or a production failure.
- `partial` — at least one line is priced and at least one selected priceable item is unresolved.
- `complete` — every selected priceable item is priced.
- `unavailable` — a selection exists but nothing is priceable yet (or no selection).

A `complete` state is never shown while a required manual amount is missing.

## 10. Screen 7 behavior

Screen 7 (`ReviewPricingSummary`) displays: a completeness badge; a line breakdown tagged
`カタログ` (catalog) vs `手入力` (manual); an explicit "未価格（合計に含まれません）" list of
unresolved items; document-level errors; warnings; and the engine-calculated totals. It shows no
internal IDs and performs no arithmetic.

## 11. Future dealer-specific catalog boundary

The catalog path uses `DEFAULT_PRICING_CATALOG` (read-only). Dealer-specific runtime catalog loading
requires a server-side execution path and is intentionally not wired here. The catalog resolution
remains replaceable by a future dealer-specific provider without changing the manual path.

## 12. Non-goals

Estimate Save, database/API/server-action writes, Supabase, migrations, PDF, LINE, OCR, product
ordering, inventory, coupon calculation, new percentage-discount calculation, dealer-specific catalog
loading, and any Screen 3/4 visual redesign are out of scope.

## 13. Remaining blocked / deferred items

- Other Work **presets** remain preview-only (excluded from totals) pending an approved manual-price
  path; custom rows are priced.
- Other Work custom-row **quantity** multiplication is unsupported (limitation kept explicit).
- Coating multi-layer topcoats (`layer2Id`/`layer3Id`) remain unmapped to production topcoat IDs
  (existing `MULTI_LAYER_NOT_MAPPED` warning).
- Coupons and percentage discount remain deferred (unchanged).
- Dealer-specific catalog pricing is deferred (requires a server path).
