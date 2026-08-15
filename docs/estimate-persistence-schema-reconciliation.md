# Estimate Persistence — Customer/Vehicle Schema & Numbering Reconciliation (Phase 11G-A)

Status: **reconciliation specification only**. No SQL, no migration, no RPC, no DB/Supabase/RLS/service
change. This resolves the two Phase 11G blockers so Phase 11G can resume without guessing.

Schema is reconstructed from the ACTUAL current migrations (001 base + additive ALTERs), cross-checked
against the working services `create-customer.ts` / `create-vehicle.ts` (which prove the current column
names). Nothing is guessed; every NOT NULL column has a confirmed value source.

## 1. Customer authoritative schema (`customers`)

Base `001_create_core_tables.sql` + `035` + `073` + `100` + `101`.

| Column | Type | Null | Default | Constraint / note |
| --- | --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | **NO** | — | full name (the only NOT-NULL-without-default) |
| kana | text | yes | — | legacy single kana |
| phone | text | yes | — | |
| email | text | yes | — | |
| postal_code | text | yes | — | |
| address | text | yes | — | **legacy single address (001)** |
| line_id | text | yes | — | legacy |
| memo | text | yes | — | legacy |
| dealer_id | uuid | yes | — | server-injected; RLS key |
| deleted_at | timestamptz | yes | — | soft delete |
| created_at / updated_at | timestamptz | NO | now() | |
| customer_code | text | yes | — | 035 |
| last_name / first_name | text | yes | — | 035 |
| last_name_kana / first_name_kana | text | yes | — | 035 |
| prefecture / city / address1 / address2 | text | yes | — | 035 structured address |
| birthday | date | yes | — | 035 |
| gender / occupation / notes | text | yes | — | 035 |
| line_user_id / line_display_name / line_picture_url | text | yes | — | 035 |
| line_connected | boolean | NO | false | 035 |
| is_business | boolean | NO | false | 073 |
| trade_discount_pct | numeric(5,2) | NO | 0 | 073 CHECK 0–100 |
| credit_terms | text | yes | — | 073 |
| closing_day | integer | yes | — | 100 CHECK null or 1–31 |
| payment_day | integer | yes | — | 100 CHECK null or 1–31 |
| billing_name / billing_contact | text | yes | — | 100 |
| accounts_receivable_allowed | boolean | NO | false | 101 |

Existing services/rules: create service `createCustomer` (`src/lib/customers/create-customer.ts`),
update `update-customer.ts` / `update-customer-notes.ts`, duplicate lookup `find-customer-duplicates.ts`.
`name` is the full name; `last_name` is set to `last_name ?? fullName` for legacy compat. `customer_code`
is optional (nullable). Business fields: `is_business`, `trade_discount_pct`, `credit_terms`,
`closing_day`, `payment_day`, `accounts_receivable_allowed`. Kana: `kana` (legacy) + `last_name_kana` /
`first_name_kana`. Address: legacy single `address` + structured `prefecture/city/address1/address2`.
Dealer isolation: `dealer_id` server-injected, never from client.

## 2. Customer exact mapping table

Wizard Customer Draft → `EstimateSaveCustomer` (11B) → `customers` columns.

| Wizard source | Save DTO field | DB column | Transformation | Req/Opt | Fallback | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| name | customer.name | `name` | trim | **required** | — | non-empty (CUSTOMER_REQUIRED) |
| phone | customer.phone | `phone` | trim/null | opt | null | — |
| email | customer.email | `email` | trim/null | opt | null | — |
| postal | customer.postalCode | `postal_code` | trim/null | opt | null | — |
| address (single) | customer.address | `address` (legacy single) | trim/null | opt | null | — |
| lineId | customer.lineId | `line_user_id` | trim/null | opt | null | — |
| isBusiness | customer.isBusiness | `is_business` | bool | opt | false | — |
| tradeRate | customer.tradeRatePercent | `trade_discount_pct` | number | opt | 0 | 0–100 (CHECK) |
| arAllowed | customer.accountsReceivableAllowed | `accounts_receivable_allowed` | bool | opt | false | — |
| closingDay | customer.closingDay | `closing_day` | string→int | opt | null | null or 1–31 (CHECK) |
| paymentDay | customer.paymentDay | `payment_day` | string→int | opt | null | null or 1–31 (CHECK) |
| — (server) | — | `dealer_id` | getCurrentDealer() | **required** | — | server-only |

Not collected by the Wizard (left NULL/default, never fabricated): `kana`, `last_name`/`first_name`,
`*_kana`, `customer_code`, `prefecture`/`city`/`address1`/`address2`, `birthday`, `gender`, `occupation`,
`notes`, `credit_terms`, `billing_name`/`billing_contact`, LINE display fields.

**Approved mapping proposal (single-field reconciliation):** the Wizard collects ONE `name` and ONE
`address`. Map `name → customers.name` (the NOT NULL full-name column; leave `last_name`/`first_name`
NULL) and `address → customers.address` (the legacy single column; leave `prefecture/city/address1/
address2` NULL). This avoids any split-guessing. Architect may later prefer `address → address1`; both
are valid text columns — flagged as a decision, not a blocker.

## 3. Vehicle authoritative schema (`vehicles`)

Base `001` + `036` + `073` + `098`.

| Column | Type | Null | Default | Note |
| --- | --- | --- | --- | --- |
| id | uuid | NO | gen_random_uuid() | PK |
| customer_id | uuid | **NO** | — | FK → customers(id) ON DELETE CASCADE (only NOT-NULL-without-default) |
| manufacturer | text | yes | — | legacy (001) |
| model | text | yes | — | |
| year | text | yes | — | |
| grade | text | yes | — | |
| body_color | text | yes | — | legacy |
| license_plate | text | yes | — | legacy |
| vin | text | yes | — | |
| memo | text | yes | — | legacy |
| dealer_id | uuid | yes | — | server-injected; RLS key |
| deleted_at | timestamptz | yes | — | |
| created_at / updated_at | timestamptz | NO | now() | |
| vehicle_code | text | yes | — | 036 |
| maker | text | yes | — | 036 (current maker column) |
| color | text | yes | — | 036 |
| plate_number | text | yes | — | 036 |
| body_size | text | yes | — | 036 |
| mileage | integer | yes | — | 036 |
| inspection_expiry_date | date | yes | — | 036 |
| notes | text | yes | — | 036 |
| displacement | text | yes | — | 073 |
| fuel_type | text | yes | — | 073 |
| registration_date | date | yes | — | 073 |
| first_registration_year_month | text | yes | — | 098 |

Existing services/rules: create `createVehicle` (`src/lib/vehicles/create-vehicle.ts`), update
`update-vehicle.ts`, lookup `find-vehicle-by-vin-or-plate.ts`. Registration-number handling: stored as
plain text (`plate_number`); NEVER OCR-inferred here. Customer association: `customer_id` (validated to
belong to the dealer). Body size: `body_size` text (the 3M size key). Year: `year` text. Fuel:
`fuel_type` text. Mileage: `mileage` integer.

## 4. Vehicle exact mapping table

Wizard Vehicle Draft → `EstimateSaveVehicle` (11B) → `vehicles` columns.

| Wizard source | Save DTO field | DB column | Transformation | Req/Opt | Fallback |
| --- | --- | --- | --- | --- | --- |
| maker | vehicle.maker | `maker` | trim/null | opt | null |
| model | vehicle.model | `model` | trim/null | opt | null |
| grade | vehicle.grade | `grade` | trim/null | opt | null |
| vehicle_code | vehicle.vehicleCode | `vehicle_code` | trim/null | opt | null |
| vin | vehicle.vin | `vin` | trim/null | opt | null |
| first_registration_year_month | vehicle.firstRegistration | `first_registration_year_month` | trim/null | opt | null |
| registration_date | vehicle.registrationDate | `registration_date` | string→date/null | opt | null |
| inspection_expiry_date | vehicle.inspectionExpiry | `inspection_expiry_date` | string→date/null | opt | null |
| displacement | vehicle.displacement | `displacement` | trim/null | opt | null |
| color | vehicle.color | `color` | trim/null | opt | null |
| plate_number | vehicle.plateNumber | `plate_number` | trim/null | opt | null |
| bodySizeKey | vehicle.bodySizeKey | `body_size` | trim/null | opt | null |
| — (resolved) | — | `customer_id` | resolved customer id | **required** | — |
| — (server) | — | `dealer_id` | getCurrentDealer() | required | — |

Not collected by the Wizard (left NULL, never inferred): `year`, `mileage`, `fuel_type`, legacy
`manufacturer`/`body_color`/`license_plate`, `memo`. No OCR, no inference, no generated id.

## 5. NOT NULL supply table

Every NOT NULL column, with its value source. **No unresolved NOT NULL field remains.**

| Table | NOT NULL column | Source |
| --- | --- | --- |
| customers | id | DB default (gen_random_uuid) |
| customers | name | Wizard payload (customer.name) |
| customers | line_connected | DB default (false) |
| customers | is_business | Wizard payload / DB default false |
| customers | trade_discount_pct | Wizard payload / DB default 0 |
| customers | accounts_receivable_allowed | Wizard payload / DB default false |
| customers | created_at / updated_at | DB default now() |
| vehicles | id | DB default |
| vehicles | customer_id | resolved customer id (server) |
| vehicles | created_at / updated_at | DB default |
| estimates | id | DB default |
| estimates | customer_id / vehicle_id | resolved (server) |
| estimates | estimate_no | server-formatted number (§9) |
| estimates | status | DB default 'DRAFT' (RPC sets draft) |
| estimates | subtotal / tax / total | server-verified pricing snapshot |
| estimates | created_at / updated_at | DB default now() |
| estimate_items | id | DB default |
| estimate_items | estimate_id | from estimate insert |
| estimate_items | dealer_id | server context (getCurrentDealer) |
| estimate_items | category | mapped value / DB default 'other' |
| estimate_items | item_name | line label / DB default '' |
| estimate_items | quantity / unit_price / discount_rate / line_total | pricing result / DB defaults |
| estimate_items | sort_order | line index / DB default 0 |
| estimate_items | created_at / updated_at | DB default now() |

Only `customers.name`, `vehicles.customer_id`, `estimates.estimate_no/customer_id/vehicle_id`, and
`estimate_items.estimate_id/dealer_id` require an explicit value — all cleanly supplied. Everything else
NOT NULL has a DB default. **Nothing is fabricated, empty, demo, random, or label-inferred.**

## 6. Existing service reuse analysis

| Rule | Reuse? | Note |
| --- | --- | --- |
| Dealer injection (`dealer_id` server-only) | ✅ reuse verbatim | identical in create-customer/vehicle |
| Cross-dealer validation of existing customer/vehicle | ✅ reuse pattern | `.eq('dealer_id', …).single()` → RPC filters by dealer |
| Customer field set + NOT NULL coverage | ✅ authoritative | mirror the confirmed current columns |
| Vehicle field set + column names | ✅ authoritative | maker/color/plate_number/body_size etc. |
| `name` full-name rule + legacy `last_name` | must remain authoritative | RPC sets `name`; `last_name` optional |
| `trade_discount_pct` CHECK 0–100, closing/payment 1–31 | must remain authoritative | RPC validates before insert |
| Number formatting (`formatDocumentNumber`) | cannot run in SQL directly | stays the TS authority (§9 Option B) |
| Activity log / revalidatePath side effects | NOT reused | side effects excluded from the atomic RPC |

Rules that cannot run inside SQL (TS-only): estimate-number formatting, `computeFiscalYear` (uses the
current date). Rules to fold into the RPC (duplicated in SQL, kept minimal): dealer stamping,
cross-dealer checks, insert column mapping. Future: extract shared domain field-mapping helpers so the
RPC and the TS services share one definition (later phase).

## 7. Numbering authority audit

Flow (confirmed): `getNextDocumentNumber(type)` (`src/lib/numbering/get-next-document-number.ts`) →
reads per-dealer `document_sequences` (`prefix`, `padding`, `reset_policy`, `fiscal_year`,
`current_number`) → `computeFiscalYear(resetPolicy)` (never→0, yearly→YYYY, monthly→YYYYMM, uses the
current date) → atomic RPC `get_next_document_number(p_dealer_id, p_sequence_type, p_fiscal_year,
p_prefix, p_padding, p_reset_policy)` **returns an integer** (INSERT … ON CONFLICT DO UPDATE, so it is
concurrency-safe) → `formatDocumentNumber(prefix, n, padding, fiscalYear)` → e.g. `EST-2026-00001`
(yearly), `EST-00001` (never), `EST-2026-06-00001` (monthly). Default estimate prefix `EST`. The
FORMATTING authority is entirely in TypeScript (`numbering-types.ts`); the DB RPC only allocates the
integer. EstimateEditor's `createEstimate` uses this same `getNextDocumentNumber`.

## 8. Selected numbering option

**Option B — SQL allocates the integer (existing atomic RPC), the server formats via the existing
TypeScript authority, and the final formatted `estimate_number` is passed INTO the atomic estimate RPC.**

Flow at save time: the server action allocates + formats the number via the existing
`getNextDocumentNumber('estimate')` (which calls the atomic integer RPC and applies
`formatDocumentNumber`/`computeFiscalYear`), then calls `save_estimate_from_wizard(..., p_estimate_number
=> <formatted>)`. The RPC writes it to both `estimate_no` and `estimate_number` inside its single
transaction with customer/vehicle/estimate/items.

Rejected: Option A (SQL formats) would DUPLICATE the TS formatting in PL/pgSQL → two authorities → drift
risk (monthly/yearly/never branching, fiscal-year date logic) → violates "one authoritative formatting
rule". Option C (a new shared formatting RPC) is the ideal long-term convergence but requires a new
RPC/migration + porting the formatter to SQL + refactoring EstimateEditor's numbering — out of scope now;
recommended as a future unification step.

## 9. Concurrency and idempotency analysis

- **Dealer isolation:** `p_dealer_id` from `getCurrentDealer()`; every row stamped; existing-resource
  lookups filtered by it. ✅
- **No duplicate estimate number:** the integer allocation is atomic (`get_next_document_number` INSERT …
  ON CONFLICT); concurrent saves get distinct integers → distinct formatted numbers. ✅
- **Concurrency safety:** the estimate/items/customer/vehicle inserts run in one RPC transaction. ✅
- **Correct fiscal year / prefix / padding:** taken from the per-dealer `document_sequences` config via
  the single TS authority at save time. ✅
- **Idempotent retry:** `estimates (dealer_id, idempotency_key)` partial-unique (per 11F-A migration
  spec) → a retried request returns the existing estimate; no second number is consumed. ✅
- **Gap behavior on failure:** if the atomic RPC rolls back after a number was allocated, that number is
  a gap — IDENTICAL to today's `createEstimate` behavior (the sequence increments independently). This is
  acceptable and does not violate atomicity of the estimate itself. ✅
- **One authoritative formatting rule:** TS `formatDocumentNumber`; SQL stores the string only. ✅
- **EstimateEditor compatibility:** same numbering authority. ✅

All Option B acceptance criteria are met.

## 10. Required PHASE 11G changes (now unblocked)

1. **Migration**: additive columns per 11F-A (§2) — `estimate_items` hybrid identity; `estimates`
   idempotency + wizard snapshot; partial-unique `(dealer_id, idempotency_key)`. No customer/vehicle
   schema change needed (existing columns cover the mapping).
2. **RPC** `save_estimate_from_wizard(p_dealer_id, p_actor_user_id, p_estimate_number, p_payload)`:
   idempotency check → resolve/create customer (mapping §2) → resolve/create vehicle (mapping §4, dealer
   + customer checks) → insert estimate (`estimate_no` = `estimate_number` = `p_estimate_number`; totals
   from snapshot; `notes`/`internal_memo` separate) → insert estimate_items (hybrid identity;
   `category` mapped, `wizard_category` exact) → return result. Rollback on any failure.
3. **Server action**: allocate+format the number via existing `getNextDocumentNumber('estimate')` before
   the RPC; pass it as `p_estimate_number`. Keep dealer id from `getCurrentDealer()` only.
4. **Gateway**: implement the concrete gateway calling the RPC, still disabled-by-default until wired.

## 11. Remaining blockers

**None for schema or numbering.** Both Phase 11G blockers are resolved: the authoritative
customer/vehicle schema is confirmed (single NOT-NULL-without-default per table, all mappings defined),
and numbering has a selected, criteria-satisfying model (Option B). Phase 11G may resume.

## 12. Architect decisions required (non-blocking confirmations)

1. Confirm the single-field mappings: `name → customers.name` (leave last_name/first_name null) and
   `address → customers.address` (legacy single column, vs `address1`).
2. Confirm Option B for numbering (server formats via existing TS authority; number allocated just
   before the atomic RPC; failure gaps acceptable as today), vs Option C long-term convergence.
3. Confirm `estimates.status` initial value for wizard saves (`draft`) and whether wizard estimates
   should differ from EstimateEditor's default.
4. Confirm the hybrid-identity storage shape from 11F-A (dedicated columns vs one jsonb) for the
   Phase 11G migration.

## Non-goals (this phase)

SQL/migration/RPC implementation, DB/Supabase/RLS/service/numbering changes, save runtime enablement.
None performed. Reconciliation specification only.
