# Estimate Persistence — Atomic Feasibility Audit (Phase 11E-A)

Status: **investigation only**. No SQL, no RPC, no migration, no DB/server-action/Supabase/pricing
change. This audit answers exactly one question: can DealerOS implement atomic Estimate Save with the
existing production architecture, or is a new Atomic RPC mandatory?

**Answer: OPTION C — a new dedicated Atomic RPC + migration are mandatory.** Evidence below.

## 1. Existing persistence architecture

Next.js Server Actions (`"use server"`) over Supabase (`@/lib/supabase/server`, PostgREST). Each
entity has its own action performing a single-table `.insert`/`.update`; dealer isolation is enforced
by server-injected `dealer_id` (`getCurrentDealer()`) + RLS. There is no application-level or
database-level transaction spanning multiple tables for estimate creation.

## 2. Existing reusable components

All reusable as building blocks (no redesign needed):

- `getCurrentDealer()` (`src/lib/auth/get-current-dealer.ts`) — dealer authority.
- `requireStaffCapability` / `getCurrentUser` — auth + permission.
- `getNextDocumentNumber` + `document_sequences` + `get_next_document_number` RPC (migration 046) —
  numbering authority.
- `createCustomer` (`src/lib/customers/create-customer.ts`) — customer insert rules.
- `createVehicle` (`src/lib/vehicles/create-vehicle.ts`) — vehicle insert rules.
- `createEstimate` (`src/lib/estimates/create-estimate.ts`) — estimate + item insert logic + server
  total re-computation (`calculateEstimateTotals`).

These are the pieces a future orchestration RPC would reuse.

## 3. Existing transaction capability

**None for multi-table estimate save.** Supabase/PostgREST does not support client-side multi-statement
transactions across tables. The JS layer issues independent `.insert` calls, each auto-committing. The
only way to obtain cross-table atomicity is a Postgres function (RPC) executing in one implicit
transaction. No such estimate function exists.

## 4. Existing RPC capability

The full inventory of Postgres functions in `supabase/migrations` is:

- `get_next_document_number` — numbering (the only business-logic RPC).
- `update_updated_at_column` and per-table `update_*_updated_at` — `updated_at` trigger functions.
- `pg_version` — diagnostic.

There is **no estimate-save function, no multi-table atomic-save function, and no reusable atomic
orchestration RPC pattern** anywhere in the codebase (reservations/points/etc. do not use a multi-table
atomic RPC). The codebase DOES use an RPC for atomic sequence allocation, proving the pattern is
available — but it has never been applied to estimate persistence.

## 5. Existing rollback capability

**None.** `createEstimate` inserts the estimate, then inserts items in a separate call, and explicitly
swallows item-insert failure ("Don't fail the whole request — estimate was created successfully"). A
failure after the estimate insert leaves an estimate with no/partial items. New customer/vehicle would
be created by earlier independent calls and would remain even if the estimate fails. There is no
transactional rollback and no compensation logic.

## 6. Existing numbering capability

Fully sufficient and reusable: `get_next_document_number('estimate')` over `document_sequences`
(per-dealer, fiscal-year, UNIQUE-constrained). Must be called inside the future transaction so a
rolled-back save does not strand a number (subject to the existing allocator's gap policy).

## 7. Existing customer flow

`createCustomer(formData)` — single insert into `customers` with server-injected `dealer_id`. Standalone
server action; not composable into an estimate transaction today. Reusable as the insert-rule source.

## 8. Existing vehicle flow

`createVehicle(formData)` — single insert into `vehicles` with server-injected `dealer_id` + customer
dealer validation. Standalone; not composable into an estimate transaction today. Reusable as the
insert-rule source.

## 9. Existing estimate flow

`createEstimate(formData)` — requires an EXISTING `customer_id` + `vehicle_id` (does not create new
ones), allocates a number, re-computes totals server-side, inserts the estimate row (columns incl.
`internal_memo` separate from `notes`). Cannot, by itself, atomically create customer + vehicle +
estimate.

## 10. Existing estimate item flow

Inline in `createEstimate`: items are inserted in a separate `.insert` after the estimate, and failure
is swallowed (non-atomic, partial-success possible). The `estimate_items` schema has no columns for the
hybrid identity fields (`pricing_source`, `pricing_reference_id`, `manual_pricing_identity`,
option references, metadata) — confirmed against migration 037.

## 11. Gap analysis

| Requirement | Existing support | Gap |
| --- | --- | --- |
| Auth + permission | ✅ `getCurrentUser` / `requireStaffCapability` | none |
| Dealer isolation | ✅ `getCurrentDealer()` + RLS | none |
| Numbering authority | ✅ `get_next_document_number` RPC | none (call inside tx) |
| Customer insert rules | ✅ `createCustomer` | not transaction-composable |
| Vehicle insert rules | ✅ `createVehicle` | not transaction-composable |
| Estimate insert | ✅ `createEstimate` (existing customer/vehicle only) | no new-cust/veh in same op |
| Server total verification | ✅ `calculateEstimateTotals` | none |
| **Atomic multi-table tx** | ❌ | **no RPC/transaction; PostgREST can't do it client-side** |
| **Rollback** | ❌ | **item failure swallowed; no compensation** |
| Hybrid item identity storage | ❌ | **no columns on `estimate_items`** |
| Idempotency (server-side) | ❌ | **no key/column/constraint** |

The building blocks exist; the transactional boundary, rollback, hybrid-identity columns, and
idempotency do not.

## 12. Selected Option

**OPTION C — Existing architecture cannot safely support atomic persistence. A new dedicated Atomic
RPC and migration are mandatory.**

Rationale: atomic customer + vehicle + estimate + items save is impossible today — the existing estimate
save is non-atomic (swallows item failures), no estimate-save RPC exists, and PostgREST cannot run a
client-side multi-table transaction. The only path to true atomicity is a Postgres function (a new RPC =
a migration). Option A is disproven (non-atomic today); Option B understates the situation — a new RPC
and migration are not merely a nice extension but MANDATORY, and additional columns (hybrid identity,
idempotency) also require migration. The mitigating fact is that the new RPC is an **orchestration
wrapper that reuses the existing services/rules** (numbering, customer/vehicle/estimate insert logic,
server totals), so scope is bounded — but it remains a mandatory new RPC + migration.

## 13. Architect recommendation

Approve, for a future implementation phase (not now):

1. A single transactional RPC `save_estimate_from_wizard(...)` per
   `docs/estimate-persistence-rpc-design.md` — resolve/create customer → resolve/create vehicle →
   allocate number → insert estimate → insert items → return, rolling back on any failure. It reuses
   existing insert rules and the numbering RPC; it does not replace them.
2. Migration additions: hybrid-identity storage on `estimate_items` (dedicated columns or one `jsonb`
   metadata column) and an idempotency key + unique `(dealer_id, idempotency_key)` on `estimates`.
3. Wire the approved Phase 11E gateway (`EstimatePersistenceGateway`) to this RPC, replacing the
   `RPC_NOT_IMPLEMENTED` placeholder. Converge the future EstimateEditor save onto the same primitive.

The non-atomic `createEstimate` should not be reused as-is for the Wizard (it would inherit the
partial-success bug); its insert rules should be folded into the RPC.

## 14. Required future work

- Author + review the RPC SQL (new migration; Architect-approved).
- Author + review the schema-addition migration(s) for hybrid identity + idempotency.
- Implement the concrete gateway calling the RPC (server-side), keeping dealer id from
  `getCurrentDealer()` only.
- Server-side re-validation + Option A server repricing before the RPC call.
- Screen 7 save-action wiring + save-status UI (post-RPC).
- Tests: atomic success, each-stage rollback, cross-dealer rejection, idempotent resubmission.

## Non-goals (this phase)

SQL, RPC, migration, DB/Supabase/RLS changes, save implementation, EstimateEditor/Pricing changes. None
performed. Investigation only.
