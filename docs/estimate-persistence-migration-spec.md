# Estimate Persistence — Atomic Migration Specification (Phase 11F-A)

Status: **specification only**. No SQL written/executed, no migration created/applied, no RPC
implemented, no DB/Supabase/RLS/production-code change. This document is implementation-ready: it fixes
every column, type, constraint, and RPC step so a future migration phase has no ambiguity. Structures
are described as field specs (name / type / nullability / default / constraint), not executable SQL.

Sources of truth for existing structures: migration `037_rebuild_estimate_core.sql`, `093_estimate_
category_expand.sql`, `046_create_document_sequences.sql`, and the confirmed insert in
`src/lib/estimates/create-estimate.ts`. Nothing is guessed; unknown/unverified fields are flagged.

## 1. Confirmed existing schema (baseline — do NOT re-create)

### estimates (columns confirmed via 037 + create-estimate.ts)
`id (uuid, pk)`, `dealer_id (uuid)`, `customer_id (uuid)`, `vehicle_id (uuid)`, `estimate_no (text,
legacy)`, `estimate_number (text)`, `title (text)`, `status (text, CHECK: DRAFT|SENT|APPROVED|REJECTED|
draft|sent|approved|rejected|expired)`, `subtotal (numeric)`, `tax (numeric, legacy)`, `tax_rate
(numeric, default 10)`, `tax_amount (numeric, default 0)`, `discount_amount (numeric, default 0)`,
`total (numeric)`, `valid_until (date)`, `notes (text)`, `internal_memo (text)`, `created_at`,
`updated_at`. RLS: dealer-scoped via `dealer_members`.

### estimate_items (037 + later product columns)
`id (uuid, pk)`, `estimate_id (uuid, FK → estimates(id) ON DELETE CASCADE)`, `dealer_id (uuid)`,
`category (text, CHECK below)`, `item_name (text)`, `description (text)`, `quantity (numeric)`,
`unit_price (numeric)`, `discount_rate (numeric)`, `line_total (numeric)`, `sort_order (integer)`,
`item_type (text)`, `product_id (uuid|null)`, `sku (text|null)`, `product_name_snapshot (text|null)`,
`retail_price_snapshot (numeric|null)`, `created_at`, `updated_at`. Indexes: `(estimate_id)`,
`(dealer_id)`. RLS: dealer-scoped. **category CHECK (after 093):** `coating, ppf, window, interior,
glass, other, maintenance, carwash, roomclean` — **`store_global_options` is NOT allowed.**

### document_sequences (046) + get_next_document_number RPC
`(dealer_id, sequence_type, fiscal_year)` UNIQUE; the `get_next_document_number(dealer_id, type, ...)`
RPC allocates the next number atomically. Reused as-is.

## 2. Database changes

### 2.1 estimate_items — new columns (hybrid identity)

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `pricing_source` | text | NOT NULL | `'manual'` | CHECK `IN ('catalog','manual')` |
| `pricing_reference_id` | text | NULL | — | catalog identity; NULL for manual |
| `manual_pricing_identity` | text | NULL | — | manual identity; NULL for catalog |
| `option_reference_ids` | text[] | NOT NULL | `'{}'` | selected option identities |
| `wizard_category` | text | NULL | — | true wizard category incl. `store_global_options` |
| `line_metadata` | jsonb | NOT NULL | `'{}'` | approved presentation metadata (no PII) |

Constraint: CHECK that exactly one identity is present per source
(`(pricing_source='catalog' AND pricing_reference_id IS NOT NULL AND manual_pricing_identity IS NULL)
OR (pricing_source='manual' AND manual_pricing_identity IS NOT NULL AND pricing_reference_id IS NULL)`).
Index: `(pricing_source)` optional; `(estimate_id, sort_order)` for ordered reads.

**Category strategy (gopt):** the `category` column keeps satisfying the existing 093 CHECK. A
`store_global_options` line is stored with `category='other'` (allowed) and its true category in
`wizard_category`. This avoids widening the 093 CHECK and its invoice_items lockstep. (Alternative,
requiring an extra migration + invoice_items lockstep: add `store_global_options` to both CHECKs — NOT
recommended unless invoicing must distinguish it.)

**Taxonomy dependency:** `maintenance/carwash/roomclean` in `category` require migration 093 applied AND
`ESTIMATE_TAXONOMY_READY=true`; otherwise the RPC must map them to `other`/`interior` exactly as the
current engine does. `wizard_category` always records the precise category regardless of the flag.

### 2.2 estimates — new columns (idempotency + wizard snapshot)

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `idempotency_key` | text | NULL | — | client-supplied save token |
| `wizard_schema_version` | text | NULL | — | e.g. `'2.2'` |
| `source` | text | NULL | — | e.g. `'estimate-wizard-v2.2'` |
| `pricing_completeness` | text | NULL | — | snapshot: `complete` at save time |
| `pricing_snapshot` | jsonb | NULL | — | totals + warnings + errors + currency (audit) |
| `discount_intent` | jsonb | NULL | — | requested intent (mode/amount/percentage/supported) |
| `coupon_intent` | jsonb | NULL | — | selected coupon ids + status (never applied) |
| `non_priceable_selections` | jsonb | NOT NULL | `'{}'::jsonb` | operational selections, non-financial |

Unique key: `UNIQUE (dealer_id, idempotency_key)` (partial, WHERE `idempotency_key IS NOT NULL`).

### 2.3 Required indexes / constraints / keys / FKs / JSON summary
- Unique: `estimates (dealer_id, idempotency_key)` partial-unique.
- Foreign keys: unchanged — `estimate_items.estimate_id → estimates(id) ON DELETE CASCADE`; the RPC
  relies on this cascade for item cleanup during rollback (rollback is transactional regardless).
- CHECK: `estimate_items.pricing_source ∈ {catalog,manual}` + the one-identity-per-source CHECK.
- JSON fields: `line_metadata` (item), `pricing_snapshot` / `discount_intent` / `coupon_intent` /
  `non_priceable_selections` (estimate). All non-PII, additive, defaulted so existing rows stay valid.
- Hybrid pricing fields: §2.1 columns. Idempotency fields: §2.2 `idempotency_key` + unique.

All additions are **additive** (`ADD COLUMN IF NOT EXISTS` semantics; defaults so existing rows remain
valid). No column is dropped or retyped.

## 3. Atomic RPC — `save_estimate_from_wizard`

### Signature
`save_estimate_from_wizard(p_dealer_id uuid, p_actor_user_id uuid, p_payload jsonb) → jsonb`.
`SECURITY DEFINER`, consistent with existing RLS/permission conventions. Runs in one implicit
transaction (a Postgres function is atomic — any raised exception rolls back all writes).

### Input (`p_payload`)
The Phase 11B `EstimateSaveRequest` JSON, **without dealer id** (customer, vehicle, services[],
nonPriceableSelections, discount, coupon, pricing, notes, metadata, idempotencyKey). `p_dealer_id` and
`p_actor_user_id` are supplied by the trusted server action only.

### Output
Success: `{ ok: true, estimate_id, estimate_number, customer_id, vehicle_id }`.
Failure: a typed exception (error code in §Error codes); the server action maps it to a controlled
result. Raw DB text is never returned to the client.

### Validation (inside the RPC, transactional)
Dealer ownership of any existing customer/vehicle; non-empty services; presence of totals; per-line
identity present per `pricing_source`; pricing completeness = complete. (App-layer `validateEstimate
SaveRequest` + server repricing run BEFORE the RPC; the RPC re-checks the invariants it can enforce.)

### Transaction order
1. Guard inputs (`p_dealer_id`, `p_actor_user_id`).
2. Idempotency: if `estimates (dealer_id, idempotency_key)` already exists → return its stored result
   (no new writes).
3. Resolve customer: verify-dealer (existing) OR insert new (dealer-stamped) → `customer_id`.
4. Resolve vehicle: verify-dealer+customer (existing) OR insert new (dealer+customer-stamped) →
   `vehicle_id`.
5. Allocate `estimate_number` via `get_next_document_number(p_dealer_id, 'estimate', …)`.
6. Insert `estimates` row (dealer-stamped; server totals; `notes` ← customerNotes, `internal_memo` ←
   internalMemo; snapshot/intent/idempotency columns).
7. Insert `estimate_items` rows (dealer-stamped; hybrid identity columns; `category` mapped to the
   allowed set, `wizard_category` exact).
8. Return `{ estimate_id, estimate_number, customer_id, vehicle_id }`.

### Rollback
Any failure at steps 3–7 raises → the whole transaction rolls back. No orphan customer/vehicle, no
estimate without items, no partial items, no consumed-number-with-failed-estimate beyond the existing
allocator's documented gap policy. True DB atomicity — never JS compensation.

### Error codes (typed, mapped by the server action)
`DEALER_CONTEXT_REQUIRED`, `PERMISSION_DENIED`, `CUSTOMER_NOT_FOUND`, `CUSTOMER_CREATE_FAILED`,
`VEHICLE_NOT_FOUND`, `VEHICLE_CREATE_FAILED`, `PRICING_INCOMPLETE`, `PRICING_VERIFICATION_FAILED`,
`ESTIMATE_NUMBER_FAILED`, `ESTIMATE_CREATE_FAILED`, `ESTIMATE_ITEM_CREATE_FAILED`, `DUPLICATE_
SUBMISSION`, `VALIDATION_ERROR`, `TRANSACTION_FAILED`, `UNKNOWN_SAVE_ERROR`.

### Dealer isolation
`p_dealer_id` from `getCurrentDealer()` only. Every insert stamps it; every existing-resource lookup
filters by it. The payload carries no dealer id. RLS remains the second enforcement layer.

### Authentication boundary
Auth + permission happen in the server action (`getCurrentUser` → `getCurrentDealer` →
`requireStaffCapability("edit")`) BEFORE the RPC. The RPC trusts only its two server-supplied id
arguments; it never reads client identity.

### Estimate numbering / customer resolution / vehicle resolution / inserts
Reuse existing authorities/rules: `get_next_document_number` (numbering), the `createCustomer` /
`createVehicle` field sets + dealer rules (folded into the RPC), the `createEstimate` estimate/item
column mapping + server totals — all executed inside the single transaction.

## 4. Migration plan

- **Migration 1 — estimate_items hybrid identity**: add §2.1 columns + CHECKs + index. Additive; zero
  downtime (defaults backfill implicitly; existing reads/writes unaffected).
- **Migration 2 — estimates idempotency + wizard snapshot**: add §2.2 columns + partial-unique index.
  Additive; zero downtime.
- **Migration 3 — RPC** `save_estimate_from_wizard`: create the function (no table change). Deployable
  independently; unused until the gateway is wired.

**Ordering:** 1 and 2 before 3 (the RPC references the new columns). Each is independently reversible.
**Rollback plan:** drop the RPC (M3); drop the added columns/indexes/constraints (M2, M1) — safe because
they are additive and nothing else depends on them until the gateway is wired. No data rewrite to
reverse. **Compatibility:** existing `createEstimate`/EstimateEditor keep working unchanged (they ignore
the new columns). **Zero-downtime:** all steps are additive; the RPC is inert until Phase 11F wires the
gateway. Apply migrations, then flip the gateway in a later phase.

## 5. Existing table impact (confirmed only)

| Table | Impact | Confirmed by |
| --- | --- | --- |
| `estimates` | ADD columns (§2.2) + partial-unique index; no existing column changed | 037 + create-estimate.ts |
| `estimate_items` | ADD columns (§2.1) + CHECK + index; `category` CHECK unchanged (gopt→other) | 037 + 093 |
| `invoice_items` | **none** (avoided by not widening the category CHECK) | 093 |
| `document_sequences` | none (reused via RPC) | 046 |
| `customers` / `vehicles` | none (existing insert rules reused inside the RPC) | create-customer/vehicle.ts |
| RLS (`dealer_members`) | none (existing dealer-scoped policies apply to new columns) | 037 |

No other table is affected. `ESTIMATE_TAXONOMY_READY` behavior is preserved.

## 6. Idempotency design

- **Request key:** client supplies `idempotencyKey` (derived from the canonical draft id + a per-attempt
  save token — never a label, never random-per-render). Stored in `estimates.idempotency_key`.
- **Unique constraint:** partial-unique `(dealer_id, idempotency_key)`.
- **Duplicate detection:** RPC step 2 looks up the key first; a match returns the original result with no
  new writes. A concurrent duplicate that races past the lookup is caught by the unique constraint →
  mapped to `DUPLICATE_SUBMISSION`.
- **Retry behavior:** a network retry with the SAME key is safe (returns the original estimate). A new
  save uses a new key.
- **Failure recovery:** because the transaction is atomic, a failed attempt leaves no row and no consumed
  key; the client may retry with the same or a new key safely.

## 7. Hybrid pricing storage

| Concept | Stored in | Notes |
| --- | --- | --- |
| Catalog identity | `estimate_items.pricing_reference_id` | NULL for manual |
| Manual identity | `estimate_items.manual_pricing_identity` | NULL for catalog |
| Pricing source | `estimate_items.pricing_source` | CHECK catalog\|manual |
| Pricing policy | `estimate_items.line_metadata.pricingPolicy` | catalog_only/manual_only (per category) |
| Manual price policy | `estimate_items.line_metadata.manualPricePolicy` | disabled/required |
| Applied pricing snapshot | `estimates` totals columns + `pricing_snapshot` jsonb | production figures verbatim |
| Pricing completeness | `estimates.pricing_completeness` | must be `complete` to save |
| Pricing warnings | `estimates.pricing_snapshot.warnings` | preserved, non-blocking |
| Pricing errors | `estimates.pricing_snapshot.errors` | preserved (must be empty of blockers to save) |

Option references live in `estimate_items.option_reference_ids`; non-priceable operational selections in
`estimates.non_priceable_selections` (never financial lines).

## 8. Future integration

- **EstimateEditor:** converge onto the same RPC/gateway so persistence rules live in one place; migrate
  EstimateEditor save in a later, explicitly-scoped step (no change now).
- **PDF:** post-commit only, from `estimate_id`; never inside the RPC. `internal_memo` never reaches
  PDF-facing content.
- **Product Order:** post-commit, decoupled; the RPC never touches product orders.
- **Inventory:** post-commit or separate transaction; never inside the estimate RPC.
- **LINE:** post-commit, customer-facing only; `internal_memo` never enters LINE payloads.
- **Customer Portal:** reads only customer-facing fields (`notes`, totals); never `internal_memo` or
  internal snapshot/intent columns.

## Non-goals (this phase)

SQL/migration/RPC implementation or execution, DB/Supabase/RLS changes, save implementation,
EstimateEditor/Pricing changes. None performed. Specification only.
