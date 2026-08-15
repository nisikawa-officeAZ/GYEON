# Estimate Save Architecture (Phase 11A)

Status: **architecture and contracts only**. No persistence, no DB, no API, no server action, no
migration is implemented in this phase. No estimate can be saved yet.

## Save flow

Each layer has a single responsibility:

```
Estimate Wizard
      │
      ▼
Canonical Draft            (EstimateWizardDraftV22 — operator intent, no calculation)
      │
      ▼
Pricing Result             (WizardPricingResult — production engine totals + hybrid line breakdown)
      │
      ▼
Estimate Save Mapper       (mapDraftToEstimateSaveRequest — pure translation, no persistence)
      │
      ▼
Estimate Save DTO          (EstimateSaveRequest — UI-independent canonical save object)
      │
      ▼
Estimate Save Service      (EstimateSaveService — FUTURE transactional persistence boundary)
      │
      ▼
Database
```

The mapper never writes; the validator never writes; only the (future) service writes.

## Files (all new, `src/components/estimates/wizard/save/`)

| File | Responsibility |
| --- | --- |
| `estimate-save-dto.ts` | Canonical, UI-independent DTO shapes |
| `estimate-save-errors.ts` | Error codes, save status union, validation result shape |
| `estimate-save-contracts.ts` | Mapper / validator / service interfaces, transaction plan, rollback policy |
| `estimate-save-mapper.ts` | Pure draft + pricing → DTO mapper |
| `estimate-save-validation.ts` | Pure validator (prepared validation only) |
| `index.ts` | Barrel |

## DTO

`EstimateSaveRequest` = `{ customer, vehicle, services[], discount, pricing, notes, metadata }`.

- `EstimateSaveCustomer` — discriminated `existing` (id reference) vs `new` (snapshot). Creating a
  customer is a future concern; the DTO records intent only.
- `EstimateSaveVehicle` — discriminated `existing` vs `new`, carrying `bodySizeKey`.
- `EstimateSaveServiceLine` — a priced line tagged `catalog` or `manual`. Exactly one of
  `pricingReferenceId` / `manualPricingIdentity` is populated (hybrid identity model). Never a label,
  never an array index.
- `EstimateSaveDiscount` — intent only (`none` / `fixed_amount` / `percentage` + `couponIds`).
  Coupons and percentage discount remain deferred; no calculation occurs here.
- `EstimateSavePricing` — final figures from the production engine. Numbers are nullable to carry an
  incomplete state faithfully; validation forbids saving unless complete.
- `EstimateSaveMetadata` — `source`, `schemaVersion`, caller-supplied `clientCreatedAt`, and a
  reserved server-assigned `estimateNumber` (always `null` here).

The DTO imports no screen state, no React, no draft/pricing type. Screen state is never reused
directly.

## Validation

`validateEstimateSaveRequest(request): EstimateSaveValidationResult` is pure — it inspects the DTO and
returns blocking issues. It never saves and never calls the database. Rules:

- Customer required (existing id or new name).
- Vehicle required (existing id or new maker/model).
- At least one service line.
- Pricing must be `complete`; `partial` / `unavailable` → `PRICING_INCOMPLETE`; `error` →
  `VALIDATION_ERROR`; null totals → `PRICING_INCOMPLETE`.
- Per-line identity integrity: a manual line must carry `manualPricingIdentity`; a catalog line must
  carry `pricingReferenceId` (else `UNKNOWN_PRICING_IDENTITY`).

Unresolved pricing is never eligible for save.

### Save status

`EstimateSaveStatus = idle | validating | ready | saving | success | error`. State machine only — no
save logic is implemented.

### Error codes

`CUSTOMER_REQUIRED`, `VEHICLE_REQUIRED`, `SERVICE_REQUIRED`, `PRICING_INCOMPLETE`,
`UNRESOLVED_PRICING`, `MANUAL_PRICE_MISSING`, `UNKNOWN_PRICING_IDENTITY`, `VALIDATION_ERROR`,
`SAVE_FAILED` (reserved for the service), `NETWORK_ERROR` (reserved for the service).

## Transaction

Design only — no executor exists. The future save is ONE atomic transaction:

```
Begin Transaction
  → Customer      (resolve / create)
  → Vehicle       (resolve / create)
  → Estimate      (insert header)
  → Estimate Items (insert priced lines)
Commit
```

`ESTIMATE_SAVE_TRANSACTION_PLAN` encodes this ordered step list.

## Rollback

`ESTIMATE_SAVE_ROLLBACK_POLICY = "atomic_rollback_on_any_failure"`. The transaction is atomic: any
failure before `commit` discards all preceding steps. No compensating writes, no partial estimate is
ever persisted.

## Future numbering

Estimate numbering is out of scope. `metadata.estimateNumber` is reserved and always `null` here; the
server will assign an authoritative number inside the transaction in a future phase.

## Future PDF trigger

PDF generation is out of scope and must never run during save. A future phase may trigger PDF
generation AFTER a successful commit, from the returned `estimateId` — never inline with persistence.

## Future product-order trigger

Product ordering and inventory deduction are out of scope. A future phase may trigger a product-order
flow AFTER a successful commit, decoupled from the save transaction — never inline.

## Phase 11B — Draft → Save DTO mapping

The deterministic, pure mapping from the canonical draft + pricing result into the Save DTO. Still no
persistence, no DB, no API, no server action, no dealer id, no numbering, no PDF.

### Mapper input

`EstimateSaveMapperInput = { draft: EstimateWizardDraftV22; pricingResult: WizardPricingResult }`. One
explicit object — no individual screen states, no React, no EstimateEditor, no browser storage, no DB
rows.

### Mapper output

`mapDraftToEstimateSaveRequest(input): EstimateSaveRequest` — independent from screen props, React
state, EstimateEditor internals, DB row types, Supabase types, and PDF types. It is an application-
domain contract.

### Customer mapping

Existing → `{ mode: "existing", customerId }` (no new id created). New → approved-field snapshot
(name, phone, email, postalCode, address, lineId, isBusiness, tradeRatePercent [intent only],
accountsReceivableAllowed, closingDay, paymentDay). No destructive normalization, no payment-date
calculation, no business-discount application, no customer search.

### Vehicle mapping

Existing → `{ mode: "existing", vehicleId, bodySizeKey }` (no new record). New → maker, model, grade,
vehicleCode, vin, firstRegistration, registrationDate, inspectionExpiry, displacement, color,
plateNumber, bodySizeKey. No OCR, no body-size inference, no vehicle-master lookup, no plate-text
modification, no fake id, no derived maker/model.

### Service-line correlation rules

- Monetary values (unitPrice, subtotal) come from `WizardPricingResult` lines — the mapper performs no
  arithmetic.
- Per-line identity comes from the pure pricing INPUT bundle (`buildWizardPricingInput`). Manual lines
  are correlated to pricing-result lines by the authoritative key `${category}:${manualPricingIdentity}`
  (the pricing-result `sourceId`). Catalog (coating) lines take `pricingReferenceId` = the coating
  layer-1 id. **No label matching, no display order, no array index, no fuzzy/amount matching.**
- `lineId` is deterministic: `catalog:${category}:${referenceId}` or `manual:${category}:${identity}` —
  composed from existing canonical identities, never generated.

### Catalog / manual identity handling

Each line carries exactly one identity source: `pricingSource: "catalog"` with `pricingReferenceId`, or
`pricingSource: "manual"` with `manualPricingIdentity`. The other is `null`. `selectedOptionReferenceIds`
carries the manual line's `optionIdentity` where present (e.g. PPF product type).

### Non-priceable option handling

`not_priceable` selections (config `editableUnitPrice === false`) never become monetary lines; they are
preserved in `nonPriceableSelections` (operational only). They are never zero-priced financial lines and
never treated as free. (No current example option is non-priceable — all are `manual_only`; the field
supports the distinction.)

### Discount intent vs applied result

`discount.intent` (mode / fixedAmount / percentage / percentageSupported) records the REQUEST;
`discount.appliedAmount` is the engine-applied amount (`pricingResult.discountTotal`). They are never
merged. Percentage discount is `percentageSupported: false` (production has no % path); the intent is
preserved but validation blocks a save while a percentage discount is selected-but-not-applied.

### Coupon deferred behavior

`coupon` records intent only: `selectedCouponIds`, `status` (`none` / `selected_not_priced`), and
`appliedAmount` = `pricingResult.couponTotal` (always 0). No fake coupon amount; validation prevents
misrepresenting a coupon as financially applied.

### Pricing completeness requirement

`pricing.completeness` is carried verbatim; JPY, production rounding, warnings, errors, and
`unresolvedItems` are preserved. Nulls are not converted to zero. A save is eligible only when
completeness is `complete` and totals are non-null.

### Internal memo protection

`notes.customerNotes` and `notes.internalMemo` are separate fields; line breaks are preserved.
`internalMemo` is never concatenated, never placed in customer-facing metadata/services (verified: it
does not appear in the customer/vehicle/services/metadata/customerNotes payload).

### Dealer ID enrichment boundary

The Save DTO OMITS dealer id. The mapper never accepts or generates a dealer id. The future save
service obtains dealer identity server-side via `getCurrentDealer()`; a client-provided dealer id is
never trusted.

### Determinism rules

Given identical `{ draft, pricingResult }`, the mapper returns a structurally identical
`EstimateSaveRequest`. No `Date.now()`, `new Date()`, `Math.random()`, or generated ids. Line ids use
existing canonical identities; `draftLastUpdatedAt` is read from the draft (not generated).

### Save readiness

`evaluateEstimateSaveReadiness(request): { status: "invalid" | "ready"; issues }`. No `saved` /
`submitted` / `persisted` state exists. Blocking codes: `CUSTOMER_REQUIRED`, `VEHICLE_REQUIRED`,
`SERVICE_REQUIRED`, `PRICING_INCOMPLETE`, `UNRESOLVED_PRICING`, `MANUAL_PRICE_MISSING`,
`UNKNOWN_PRICING_IDENTITY`, `VALIDATION_ERROR`.

### Phase 11C persistence boundary

Phase 11C will implement the server-side transactional `EstimateSaveService` (customer → vehicle →
estimate → estimate_items → commit), dealer-id enrichment via `getCurrentDealer()`, estimate numbering,
and the atomic rollback. None of that exists yet; 11B ends at a validated, save-ready DTO.

## Non-goals (this phase)

Database write, API route, server action, Supabase insert, PDF, estimate numbering, invoice creation,
product ordering, inventory deduction, payment, customer update, vehicle update. None are implemented.
