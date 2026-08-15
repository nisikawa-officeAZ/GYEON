# Estimate Persistence — Atomic RPC Design (Phase 11D)

Status: **architecture / specification only**. No implementation, no SQL, no migration, no RPC, no
database or Supabase change. This document specifies the canonical atomic Estimate persistence path so
a future phase can implement it after Architect approval.

Phase 11C established the blocking gap: the existing Estimate save path (`createEstimate`) is
NON-ATOMIC (estimate and items are separate inserts; item failure is swallowed) and there is no
transaction/RPC that saves customer + vehicle + estimate + items all-or-nothing. This design closes
that gap without weakening dealer isolation or duplicating existing services.

## Design principles

- Reuse every existing production service (dealer context, auth, numbering, customer/vehicle creation,
  server pricing). Only the **orchestration + atomic boundary** is new.
- Dealer identity comes ONLY from `getCurrentDealer()` server-side. `dealer_id` is never accepted from
  the client, the Wizard, or the payload.
- One transactional boundary (a Postgres RPC) — the JS layer never spans multiple inserts.
- No partial success is representable.

## Canonical flow

```
Wizard (Screen 7)
  → EstimateSaveRequest (Phase 11A/11B DTO)
  → Server Action  saveEstimateFromWizard(request)         [ "use server" ]
      → requireStaffCapability("edit")                     [ existing auth ]
      → getCurrentDealer() → { dealer_id, role }           [ existing dealer authority ]
      → server re-validation (validateEstimateSaveRequest + server repricing)
      → single atomic RPC  save_estimate_from_wizard(p_dealer_id, p_payload)
            ├─ Resolve/Create Customer   (dealer-scoped)
            ├─ Resolve/Create Vehicle    (dealer-scoped, linked to customer)
            ├─ Allocate Estimate Number  (existing sequence authority)
            ├─ Insert Estimate
            ├─ Insert Estimate Items
            └─ Return { estimate_id, estimate_number, customer_id, vehicle_id }
         (any failure → whole transaction rolls back)
  → EstimateSaveResult
```

## 1. RPC signature

Conceptual: `save_estimate_from_wizard(p_dealer_id uuid, p_actor_user_id uuid, p_payload jsonb) →
jsonb`. `SECURITY DEFINER` consistent with existing RLS/permission conventions. `p_dealer_id` and
`p_actor_user_id` are supplied by the trusted server action (from `getCurrentDealer()` / the
authenticated session) — never from client payload. The RPC body runs in a single implicit
transaction (a Postgres function is atomic), so a raised exception rolls back every write.

## 2. Input JSON schema (`p_payload`)

Derived from `EstimateSaveRequest` (dealer id intentionally absent):

- `customer`: `{ mode: "existing", customerId }` OR `{ mode: "new", …approved fields }`.
- `vehicle`: `{ mode: "existing", vehicleId, bodySizeKey }` OR `{ mode: "new", …approved fields }`.
- `services[]`: `{ lineId, category, pricingSource, pricingReferenceId|null, manualPricingIdentity|null,
  label, description, quantity, unitPrice, subtotal, selectedOptionReferenceIds[], metadata }`.
- `nonPriceableSelections[]`: `{ category, identity, label }`.
- `discount`: `{ intent: { mode, fixedAmount, percentage, percentageSupported }, appliedAmount }`.
- `coupon`: `{ selectedCouponIds[], status, appliedAmount }`.
- `pricing`: `{ currency, completeness, subtotal, discountTotal, couponTotal, taxableSubtotal,
  taxRatePercent, taxTotal, grandTotal, warnings[], errors[], unresolvedItems[] }`.
- `notes`: `{ customerNotes, internalMemo }`.
- `metadata`: `{ source, schemaVersion, createdFromWizard, draftLastUpdatedAt, previewConfirmed }`.
- `idempotencyKey`: stable client-supplied token (see §13).

## 3. Output JSON schema

Success: `{ ok: true, estimateId, estimateNumber, customerId, vehicleId }`.
Failure: the RPC raises a typed exception carrying a stable error code (§12); the server action maps it
to `{ ok: false, error: { code, message } }`. Raw database messages are never returned to the client.

## 4. Customer resolution

- `existing`: verify the customer exists AND `customer.dealer_id = p_dealer_id` (cross-dealer →
  `CUSTOMER_NOT_FOUND`). Reuse the id; do not update unrelated fields.
- `new`: insert into `customers` with `dealer_id = p_dealer_id` (server-injected), reusing the field
  set and rules of the existing `createCustomer` service. No client dealer id, no silent dedup beyond
  existing production rules. Failure → `CUSTOMER_CREATE_FAILED` (rolls back).

## 5. Vehicle resolution

- `existing`: verify the vehicle exists, `vehicle.dealer_id = p_dealer_id`, and (where required) it is
  linked to the resolved customer (cross-dealer → `VEHICLE_NOT_FOUND`). Reuse the id.
- `new`: insert into `vehicles` with `dealer_id = p_dealer_id` and the resolved `customer_id`, reusing
  the existing `createVehicle` field set. No inference, no OCR, no client dealer id. Failure →
  `VEHICLE_CREATE_FAILED` (rolls back).

## 6. Estimate numbering

Reuse the existing authority: the `document_sequences` table + `get_next_document_number('estimate')`
RPC (migration 046). Allocation happens INSIDE the transaction, immediately before the estimate insert,
so a rolled-back save does not strand a consumed number (gap policy follows the existing allocator; if
the existing allocator intentionally allows gaps, that behavior is inherited and documented). Numbers
are never generated on the client, in the mapper, or via `Date.now()`/`random`/`count+1`/`MAX+1`.

## 7. Estimate insert

Map the DTO into the EXISTING `estimates` columns only (confirmed in Phase 11C):
`customer_id`, `vehicle_id`, `estimate_no`, `estimate_number`, `title`, `status` (default `draft`),
`subtotal`, `tax`, `tax_rate`, `tax_amount`, `discount_amount`, `total`, `valid_until`, `notes`
(← `customerNotes`), `internal_memo` (← `internalMemo`, internal-only column — never the customer-facing
`notes`), `dealer_id` (server). Totals come from the server-verified pricing result (§10). No new column
is assumed; fields with no existing column are handled per §19.

## 8. Estimate items insert

Insert every priceable `services[]` line into the EXISTING `estimate_items` columns: `estimate_id`,
`dealer_id`, `category`, `item_name` (← label snapshot), `description`, `quantity`, `unit_price`,
`discount_rate`, `line_total` (← subtotal), `sort_order`, `item_type` (`manual`). No line is silently
omitted; no unresolved line is treated as free; no line is inserted without validated monetary values.
The hybrid-identity fields (`pricingSource`, `pricingReferenceId`, `manualPricingIdentity`,
`selectedOptionReferenceIds`, `metadata`) have NO existing column — see §19 (open decision: dedicated
columns vs a metadata/jsonb column). Until resolved, they cannot be persisted without either a
migration or lossy flattening; this is an explicit gap, not a guess.

## 9. Dealer isolation

`dealer_id` is derived once, server-side, from `getCurrentDealer()` and passed as `p_dealer_id`. Every
insert stamps it; every existing-resource lookup filters by it. The payload carries no dealer id; a
client-supplied dealer id is impossible to honor by construction. RLS remains unchanged and continues to
enforce tenant isolation as a second layer.

## 10. Validation flow

Two layers. (a) Client/server-action pre-check reuses `validateEstimateSaveRequest` + server repricing
(**Option A — server repricing**: recompute totals from the saved identities/inputs using the existing
production pricing engine, which `createEstimate` already does via `calculateEstimateTotals`; the client
summary is verification input only, never trusted as authoritative). (b) The RPC re-checks structural
invariants it can enforce transactionally (dealer ownership, non-empty items, presence of totals,
identity presence per line). Save proceeds only when both pass. Client readiness is advisory; server
validation is authoritative.

## 11. Rollback behavior

The RPC is one transaction. Any raised exception (customer, vehicle, numbering, estimate, or items
failure) rolls back ALL writes — no orphan customer/vehicle, no estimate without items, no partial
items. This is real database atomicity, not JS-level compensation. The forbidden partial states from
Phase 11C (§18) are structurally impossible.

## 12. Error codes

`UNAUTHENTICATED`, `DEALER_CONTEXT_REQUIRED`, `PERMISSION_DENIED`, `CUSTOMER_NOT_FOUND`,
`CUSTOMER_CREATE_FAILED`, `VEHICLE_NOT_FOUND`, `VEHICLE_CREATE_FAILED`, `PRICING_INCOMPLETE`,
`PRICING_VERIFICATION_FAILED`, `ESTIMATE_NUMBER_FAILED`, `ESTIMATE_CREATE_FAILED`,
`ESTIMATE_ITEM_CREATE_FAILED`, `TRANSACTION_FAILED`, `DUPLICATE_SUBMISSION`, `VALIDATION_ERROR`,
`UNKNOWN_SAVE_ERROR`. The RPC raises typed codes; the server action maps them to controlled results and
logs diagnostic context via existing logging conventions (no raw Supabase message to the client, no
unnecessary personal data logged).

## 13. Idempotency strategy

The client supplies a stable `idempotencyKey` (e.g. derived from the canonical draft id + a per-attempt
save token, generated at Save time — never a label). The estimate carries this key under a UNIQUE
`(dealer_id, idempotency_key)` constraint. On a duplicate submission (double-click, retry, resubmit) the
unique constraint makes the second transaction a no-op that returns the original result (or
`DUPLICATE_SUBMISSION`). This requires a new column + unique index (§19). A UI double-click guard is an
additional convenience, NOT the server-side guarantee. Until the column exists, only the UI guard is
available — an explicit residual risk.

## 14. Future EstimateEditor integration

The RPC becomes the ONE shared persistence primitive. A future step routes both the Wizard and
`EstimateEditor` save through the same server action / RPC so persistence rules (dealer injection,
numbering, atomicity, totals verification) live in exactly one place. EstimateEditor behavior is not
changed in this design; convergence is a later, explicitly-scoped step.

## 15. Future Product Order integration

Out of scope and never inline with save. After a confirmed commit, a future decoupled step may trigger a
product-order flow from the returned `estimateId`. The RPC never touches product orders.

## 16. Future Inventory integration

Out of scope. Inventory deduction, if ever coupled, happens in a separate post-commit step (or its own
transaction), never inside the estimate save RPC.

## 17. Future PDF trigger

Out of scope and never inline with save. A future step may generate a PDF AFTER a successful commit from
`estimateId` — never during persistence.

## 18. Future LINE trigger

Out of scope and never inline with save. `internalMemo` must never reach any LINE-facing payload. Any
future LINE notification runs post-commit and customer-facing only.

## 19. Required migration list (proposals — Architect approval required; NOT implemented here)

1. **Atomic RPC** `save_estimate_from_wizard(...)` (Postgres function; the transactional boundary).
2. **Idempotency**: add `idempotency_key` (text) to `estimates` + UNIQUE index `(dealer_id,
   idempotency_key)`.
3. **Hybrid item identity** (open decision): either add `pricing_source`, `pricing_reference_id`,
   `manual_pricing_identity`, `option_reference_ids`, `line_metadata` (jsonb) to `estimate_items`, OR a
   single `line_metadata jsonb` column carrying the hybrid fields. Required so catalog/manual identity
   survives persistence without label reconstruction.
4. **Estimate-level metadata** (open decision): store `source` / `schemaVersion` / `previewConfirmed` /
   `discount intent` / `coupon intent` / `nonPriceableSelections` in a metadata/jsonb column OR dedicated
   columns — needed to keep discount-intent-vs-applied and deferred-coupon distinctions (§16 of 11B) and
   non-priceable operational selections (§15) without misleading financial data.

Items 3 and 4 are the fields the current schema cannot represent (Phase 11C/11D finding). They are flagged
as decisions, never guessed. If the Architect prefers minimal schema change, a single jsonb metadata
column per table satisfies both.

## 20. Required RPC SQL outline (conceptual — no SQL written)

Ordered steps the future function performs within one transaction:

1. Guard inputs (`p_dealer_id`, `p_actor_user_id` present).
2. Resolve customer: verify-dealer (existing) or insert (new, dealer-stamped) → `customer_id`.
3. Resolve vehicle: verify-dealer+customer (existing) or insert (new, dealer+customer-stamped) →
   `vehicle_id`.
4. Idempotency check: if an estimate with `(dealer_id, idempotency_key)` exists, short-circuit to its
   result.
5. Allocate estimate number via the existing sequence authority.
6. Insert the estimate row (server totals, notes/internal_memo separation, dealer-stamped).
7. Insert all estimate item rows (dealer-stamped, snapshots, hybrid identity per §19).
8. Return `{ estimate_id, estimate_number, customer_id, vehicle_id }`.
9. Any failure raises a typed exception → full rollback.

No SQL is authored in this phase; the above is the architecture the approved migration will realize.

## Existing services reused (no redesign)

- Dealer authority: `getCurrentDealer()` (`src/lib/auth/get-current-dealer.ts`).
- Auth/permission: `requireStaffCapability`.
- Numbering: `getNextDocumentNumber` + `document_sequences` + `get_next_document_number` RPC.
- Customer creation rules: existing `createCustomer` field set/validation.
- Vehicle creation rules: existing `createVehicle` field set/validation.
- Server pricing verification: existing `calculateEstimateTotals` / production pricing engine.
- Tables: existing `estimates` / `estimate_items` (+ the additive columns in §19).

Only the orchestration server action and the atomic RPC boundary are new.

## Non-goals

RPC/SQL/migration implementation, Supabase/RLS changes, Estimate Save/EstimateEditor/Pricing/PDF/OCR/
LINE/Inventory/Product-Order changes. None are performed in this phase.
