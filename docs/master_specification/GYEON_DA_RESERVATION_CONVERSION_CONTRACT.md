# GYEON DA Reservation → Estimate → Work-Order Conversion Contract

## 1. Metadata

| Field | Value |
|---|---|
| Document status | ACCEPTED_COMMITTED_PUSHED — the GDA-1R2-C1/C1R/C1R2 contract candidate was independently accepted by MacBook Codex, committed, and pushed at commit `09c564deba08123623c75ff435c0792403f9d5fc`, tree `dcf9dc1f6d484f30312fe13ed6a184b75c8078fd`; implementation remains separately unauthorized |
| Phase | GDA-1R2-C1_RESERVATION_TO_ESTIMATE_WORK_ORDER_CONVERSION_CONTRACT, repaired by GDA-1R2-C1R_TWO_PATH_CONTRACT_SEMANTICS_REPAIR_UNCOMMITTED, finally repaired by GDA-1R2-C1R2_DIRECT_PATH_NON_BILLABLE_TERMINAL_RULE_UNCOMMITTED |
| Owner | Office AZ / Product Owner (nisikawa@office-az.com) |
| Technical authority | MacBook Codex (specification authority and independent acceptance) |
| Authoring agent | MACBOOK_CLAUDE (bounded implementation agent; documentation-only in this phase) |
| Base commit | `f5c06755589ffcf9d1b87ac06e89f69cb3751511` |
| Base tree | `481c9f600a56e3eaa28018fb0b894ffba4714489` |
| Branch / worktree | `plan/gyeon-da-completion-v1` / `work/dealeros-gyeon-da-completion-v1` |
| Governing instruction | GDA-1R2-C1R2 final repair: https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250189948 (supersedes, for this document's direct-path billing semantics, the C1R repair instruction https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250093680 and the C1 authoring instruction https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5249905852) |
| Delivery evidence | GDA-1R2-C1C evidence: https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250332496 — GDA-1R2-C1P evidence: https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250439406 — GDA-1R2-C1D delivery-status sync instruction: https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250527990 |
| Predecessor diagnosis/acceptance | GDA-1R2 reservation diagnosis and owner approval are summarized inside the C1 authoring instruction above. The GDA-1R2-C1 candidate result is https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5249985100, the Codex CHANGES_REQUIRED review driving the C1R repair is https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5249995628, the GDA-1R2-C1R repair result is https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250169579, and the Codex CHANGES_REQUIRED review driving this C1R2 final repair is https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5250174185. The accepted completion-authority predecessor chain is recorded in `GYEON_DA_PHASE_RESULTS.md` (GDA-1W-C1 through GDA-1W-C6L), including C6/C6P acceptance at https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5249254499 and https://github.com/nisikawa-officeAZ/GYEON/pull/8#issuecomment-5249277187 |
| Document precedence | Explicit current user authorization → `AGENTS.md` + `GYEON_DA_COMPLETION_PLAN.md` → latest accepted `GYEON_DA_PHASE_RESULTS.md` entry → this contract → frozen v2.0 architecture documents where not in conflict → older roadmaps/status/chat as historical evidence only |
| Evidence level | E0/E1 documentation contract. This document grants no executable evidence and authorizes no implementation, test, migration, database, external-service, Git-mutation, Ready, merge, or deployment action. |
| Companion contract | `GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md` (accepted completion authority; this contract must not weaken it) |
| Result ledger | `GYEON_DA_PHASE_RESULTS.md` (GDA-1R2-C1 entry plus the superseding GDA-1R2-C1R and GDA-1R2-C1R2 entries) |

## 2. Mission and non-goals

### 2.1 Mission

Define one unambiguous, security-bounded, idempotent contract for converting a confirmed customer reservation into a priced estimate and an executable work order, so that a GYEON detailer never re-enters customer, vehicle, service, or schedule data by hand and never receives a duplicated, orphaned, mispriced, or cross-tenant work order.

### 2.2 Non-goals

This contract does NOT:

- Authorize any source, test, migration, dependency, configuration, database, Supabase, Storage, LINE, or deployment change. Implementation is a separate future gate (§17).
- Redesign the accepted work-order completion authority contract, the closed finance track, or the frozen estimate save/pricing contracts.
- Define the public/LIFF customer-facing booking product surface (§13); that is a separate external-security contract.
- Turn advisory capacity checking into a hard scheduling blocker (§14).
- Invent physical storage columns, tables, enum values, or migration filenames; physical schema decisions are deferred to the separately authorized migration subphase (§6, §7, §17).
- Authorize resumption of frozen GYEON order Draft PR #7, Office AZ inventory work, or any SaaS/EC scope.

## 3. Definitions

| Term | Definition |
|---|---|
| Reservation | A tenant-scoped scheduling-intent record: which customer/vehicle is expected, for which service, with which staff/bay, at which local time. It expresses intent to occupy schedule capacity only. It is never a pricing authority and never a work authorization. |
| Reservation scheduling state | One of two independent logical lifecycle dimensions. Values: `pending`, `confirmed`, `cancelled`, `no_show`. It describes scheduling intent only, is owned by the reservation, and never encodes conversion progress (§7). |
| Conversion/artifact state | The second, independent logical lifecycle dimension. Values: `none`, `estimate_draft`, `estimate_approved`, `converting`, `work_order_created`, `failed_retryable`. It describes how far conversion has progressed for a reservation and is owned by the conversion operation and its authoritative artifacts, never by the reservation's scheduling state (§7). |
| `failed_retryable` | A conversion-attempt result/audit state on the conversion/artifact axis. It records that a conversion attempt rolled back completely. It is not a reservation state, and it is never committed by the failed transaction itself: it exists only as non-authoritative failure evidence recorded outside the rolled-back authority mutation (§8). |
| Execution scope snapshot | The non-monetary description of the work authorized on the direct path: the server-reloaded, explicitly configured service scope/version, snapshotted at explicit staff confirmation (§6). It carries no price, discount, tax, total, monetary line item, or invoice permission. |
| Estimate | The authoritative priced offer. Pricing, line items, discounts, and totals become authoritative only through the existing accepted atomic estimate save path with human review. |
| Work order | The authoritative execution record for performing the work. It drives work files, completion, reporting, and downstream invoicing boundaries. |
| Conversion | The server-side operation that produces the next authoritative artifact from a reservation: a prefilled draft estimate (default path) or, only under the explicit exception of §6, a work order directly. |
| Authoritative pricing | Pricing that has passed the accepted estimate save/approval path. No reservation field, client payload, query parameter, or prefill hint is ever authoritative pricing. |
| Lifecycle-non-billable service | A service that server-owned configuration explicitly classifies as non-billable for its entire lifecycle: no price, charge, monetary line item, tax, discount, total, or invoice may be required for it now or later. Only such a service can be direct-path eligible. If any of those monetary elements may be required now or later, the service is not lifecycle-non-billable, the direct path is ineligible, and the default estimate-first flow must be selected before any work order is created (§6). |
| Direct-work-order exception | The explicitly configured, server-owned, default-off eligibility that allows a confirmed reservation to produce a work order without a separate estimate approval step, available only for a lifecycle-non-billable service (§6). The resulting work order is terminally non-billable: it is never a pricing, discount, tax, total, monetary line item, or invoice authority, and it can never be retrofitted, converted, priced, invoiced, or linked into billable work under this contract (§12). |
| Created vs replayed | The two success outcomes of an idempotent conversion: `created` means this request produced the authoritative artifact; `replayed` means a prior accepted request already produced it and this response deterministically returns the same artifact. |
| Idempotency key | A durable, caller-supplied, per-conversion-request key persisted by the server and used to make retries deterministic (§8). |
| Tenant actor | The authenticated user resolved server-side to exactly one active dealer membership with the capability required for the operation. Anonymous, inactive, suspended, readonly, ambiguous, or cross-dealer resolutions are not tenant actors and deny (§10). |

## 4. Canonical default flow

```
confirmed reservation
  -> server-validated prefilled draft estimate
  -> human pricing review and approval (accepted estimate save path)
  -> work order created from the authoritative estimate
```

Binding rules:

1. The default conversion path always passes through a human-reviewed estimate. A reservation by itself never authorizes a price and never authorizes work-order creation.
2. A reservation is scheduling intent only. Confirming a reservation changes schedule state; it must not create, price, or approve any estimate or work order as a side effect.
3. The estimate produced from a reservation starts as a draft. It becomes authoritative only through the existing accepted estimate save/approval contract; this contract adds no new pricing authority.
4. Work-order creation from an approved estimate must preserve the accepted work-order and completion-authority contracts unchanged.
5. Skipping the estimate step is possible only through the direct-work-order exception in §6, and only for a lifecycle-non-billable service (§3). If any price, charge, monetary line item, tax, discount, total, or invoice may be required now or later, the direct path is ineligible and this default estimate-first flow must be selected before any work order is created. Absence or ambiguity of eligibility means the default flow applies.
6. On every path, no reservation field, query parameter, or client-supplied datum ever authorizes a price, discount, tax, total, monetary line item, or invoice permission. Any work that may require billing must select this estimate-first authoritative path before any work order is created; a work order created through the direct path can never later become billable (§6, §12).

## 5. Prefill authority

1. Prefill is a server responsibility. The server re-loads the reservation by its tenant-bound identifier under the acting tenant actor's authorization; it never trusts a client-supplied snapshot of reservation data.
2. Customer, vehicle, service selection, assigned staff, bay, local schedule/timezone, and notes taken from the reservation are hints/defaults only. They populate the draft for human confirmation; they carry no authority until a human confirms them through the authoritative save path.
3. Query-string values, client-side state, hidden form fields, and any other client-controlled input are never authority for identity, tenancy, pricing, or eligibility. The server must re-resolve every authoritative value.
4. Estimate save remains the sole pricing authority. Prefilled amounts, if any are displayed, are provisional and must be visibly re-confirmed by the human before the authoritative save.
5. If the reservation cannot be re-loaded (missing, cross-tenant, cancelled, wrong state), prefill fails closed: no draft is produced from stale or unauthorized data.

## 6. Direct-work-order exception

1. Eligibility is a logical, server-owned decision with default `false`. Only a lifecycle-non-billable service (§3) — one that server-owned configuration explicitly classifies as non-billable for its entire lifecycle — may be eligible. If any price, charge, monetary line item, tax, discount, total, or invoice may be required for the service now or later, the direct path is ineligible and the default estimate-first flow must be selected before any work order is created.
2. Eligibility must never be inferred from a service label, name pattern, category string, client flag, or query parameter.
3. Even when eligible, an edit-capable staff tenant actor must explicitly confirm the direct conversion in the UI; there is no automatic conversion on reservation confirmation.
4. Service authority is server-reloaded: at direct conversion the server re-loads the explicitly configured service scope/version from server-owned configuration under exact tenant match and the acting tenant actor's edit capability. It never trusts the reservation's stored service selection, a query parameter, or any client payload as service authority.
5. Explicit staff confirmation snapshots execution scope only: what the staff member confirms is the server-reloaded execution scope snapshot (§3). Confirmation authorizes performing that work; it authorizes no price, discount, tax, total, monetary line item, and no invoice permission.
6. No monetary authority from reservation/query/client data: on the direct path, exactly as on the default path, reservation fields, query parameters, and client-supplied data authorize no price, discount, tax, total, monetary line item, or invoice permission. Billable work never enters this path: it must use the estimate-first authoritative path before any work order is created.
7. The direct-path work order is execution-only with respect to commerce and terminally non-billable. It drives work files, completion, and reporting, but it cannot itself be a pricing or invoice authority, its existence grants no invoicing permission, and it can never be retrofitted, converted, priced, invoiced, or linked into billable work under this contract (§12).
8. No later-billing design is granted here: any future design that links an estimate to an existing direct-path work order requires a separate owner-approved contract defining one-to-one linkage, no second work order, idempotency, and pricing and invoice authority. It remains default denied under this contract.
9. The direct path obeys the same atomicity, idempotency, numbering, authorization, and RLS rules as the default path (§8–§10). It is a shortcut in workflow, never a shortcut in security, commerce authority, or transactional integrity.
10. Absence, ambiguity, misconfiguration, or unreadable eligibility, non-billable classification, or service-configuration state denies the direct path and falls back to the default estimate flow. Fail closed.
11. This contract does NOT invent a storage column, table, enum, or RPC for eligibility, the non-billable lifecycle classification, or service scope/version. The physical representation is decided in the separately authorized migration subphase (§17). Until then, eligibility, the non-billable classification, and service scope/version are logical contract terms only.

## 7. Logical state model — two independent lifecycle axes

These are logical contract states. Existing physical schemas may differ; physical storage mapping is deferred to the implementation/migration subphase and must be reconciled there without weakening this contract. No physical table, column, enum, or RPC is invented here.

A reservation's lifecycle is described by two independent logical dimensions, never by one conflated state value:

- **Axis A — Reservation scheduling state** (owned by the reservation): `pending`, `confirmed`, `cancelled`, `no_show`.
- **Axis B — Conversion/artifact state** (owned by the conversion operation and its authoritative artifacts): `none`, `estimate_draft`, `estimate_approved`, `converting`, `work_order_created`, `failed_retryable`.

### 7.1 Axis A — reservation scheduling transitions

| From | To | Trigger |
|---|---|---|
| `pending` | `confirmed` | Human confirmation by an authorized tenant actor |
| `pending` / `confirmed` | `cancelled` | Authorized cancellation |
| `confirmed` | `no_show` | Authorized no-show recording |

Reschedule is an Axis A schedule-data change (date/time/staff/bay), not a distinct state; the reservation remains `confirmed` and §12 drift rules apply to any linked artifacts.

### 7.2 Axis B — conversion/artifact transitions

| From | To | Trigger |
|---|---|---|
| `none` | `estimate_draft` | Server-validated prefill draft creation (§5); requires Axis A `confirmed` |
| `estimate_draft` | `estimate_approved` | Human pricing review through the accepted estimate save path |
| `estimate_approved` | `converting` | Authorized work-order conversion request begins its transaction |
| `none` | `converting` | ONLY via the §6 direct-work-order exception with explicit staff confirmation; requires Axis A `confirmed` |
| `converting` | `work_order_created` | Transaction commits with exactly one accepted work order |
| `converting` | `failed_retryable` | Conversion attempt rolls back completely; recorded only as non-authoritative failure evidence (§8); same-key retry is safe |
| `failed_retryable` | `converting` | Retry by an authorized tenant actor |

`failed_retryable` is a conversion-attempt result/audit state, not a reservation state. The failed transaction itself commits nothing: neither an Axis A change nor an Axis B change is committed by the rolled-back transaction (§8). The `failed_retryable` designation exists only in non-authoritative failure evidence recorded outside the rolled-back authority mutation.

### 7.3 Cross-axis rules

1. Starting any Axis B conversion transition (`none` → `estimate_draft`, `none`/`estimate_approved` → `converting`) requires Axis A to be `confirmed`. Reservations in `pending`, `cancelled`, or `no_show` never begin a new conversion.
2. Axis A remains live after conversion progress: cancellation, no-show, and reschedule remain possible while Axis B is `estimate_draft`, `estimate_approved`, or `work_order_created`. Such an Axis A change surfaces drift/conflict on the linked artifacts per §12 and never silently mutates the estimate or an accepted work order.
3. Axis B never mutates Axis A: creating a draft estimate, approving it, converting, or failing a conversion attempt changes no reservation scheduling state.
4. Axis A never mutates Axis B artifacts: cancelling or no-showing a reservation deletes or rewrites no estimate and no accepted work order; artifact decisions after an Axis A change are explicit human decisions (§12).

Denied transitions (non-exhaustive; anything not listed above is denied):

- Any Axis B conversion start while Axis A is `pending`, `cancelled`, or `no_show` (unconfirmed, cancelled, or no-show reservations never convert).
- `work_order_created` → `converting` (no second accepted conversion for the same reservation; replay returns the existing result, §8).
- Any transition initiated by a non-tenant actor, a readonly member, or an anonymous/service-role caller.

Fail-closed behavior: unknown, missing, or ambiguous state on either axis denies the transition and reports a semantic error (§15); it never guesses, coerces, or silently repairs state.

## 8. Transaction and idempotency contract

1. One conversion request executes in one database transaction.
2. The transaction locks the reservation row first, then validates state (§7), tenant, and actor capability (§10) inside the lock.
3. The caller supplies a durable idempotency key. The server persists it inside the same transaction so that a retry after any failure is deterministic.
4. Success responses distinguish `created` from `replayed` (§3). Both return the same authoritative artifact identifiers.
5. Exactly one accepted work order may exist per reservation. Replaying the same key returns the identical prior result byte-for-byte in its semantic fields.
6. A different key for the same reservation, after an accepted conversion exists, converges: it must not create a second work order; it returns/binds to the single accepted result as a replay-equivalent outcome.
7. No orphans: if linking the work order to the reservation (or to the estimate) fails, the whole transaction fails. There is never a success response with a missing or broken link.
8. Rollback is exact: a failed transaction leaves the reservation, the estimate, the work order, number allocation (§9), and the idempotency authority unchanged. It leaves no partial rows, no consumed number, no dangling idempotency record that would poison a same-key retry, and it commits no reservation scheduling-state change and no conversion/artifact-state change (§7).
9. Non-authoritative failure evidence: the fact and reason of a failed conversion attempt (the `failed_retryable` result, §7.2) may be recorded only outside the rolled-back authority mutation. Such evidence must not poison a same-key retry, must not imply any authoritative artifact mutation, and is never itself an authority over reservation, estimate, work-order, numbering, or idempotency state.
10. Operator recovery: a `failed_retryable` conversion attempt is recoverable by retrying with the same key; an operator must be able to see the failure reason without database surgery. Any recovery that would mutate authoritative artifacts requires a human decision, never an automatic overwrite.
11. Acceptance of the implementation requires genuine separate-connection concurrency evidence: two racing conversions on real separate connections/processes must yield exactly one `created` and one `replayed`/converged outcome, matching the standard proven in the accepted GDA-1W Attempt-17 runtime verification.

## 9. Numbering

1. No legacy unpersisted numbering fallback may be used for any artifact created by conversion. The documented legacy fallback that can return an unpersisted duplicate number is prohibited on this path.
2. Number allocation happens inside the conversion transaction using the accepted allocator authority (two-layer allocator ruling of GDA-1W-C2R where applicable).
3. Allocation collision fails the whole transaction and rolls back; it never retries into a silent duplicate.
4. Database-level uniqueness must enforce number uniqueness; application checks alone are insufficient.
5. Replay (§8) returns the previously allocated number; it never allocates a second number for the same accepted conversion.

## 10. Authorization, RLS, and grants

Cited official guidance (must be followed by the future implementation):

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/changelog?types=breaking-change

Rules:

1. A conversion requires: authenticated session + active membership + exact tenant match + edit capability. All four; server-resolved.
2. Deny: readonly members, inactive/suspended members, ambiguous membership resolution, cross-dealer access, and anonymous callers. Deny on ambiguity; never resolve ambiguity in favor of access.
3. Grants and RLS are separate layers and both must be correct: table/function grants restrict who can call; RLS restricts which rows. Neither substitutes for the other.
4. RLS policies must be `TO authenticated` plus an ownership/capability predicate; a bare `TO authenticated` without a tenant/capability predicate is not acceptable.
5. Every UPDATE policy needs both `USING` and `WITH CHECK` so a row can neither be read into an update nor written out of tenant/capability scope.
6. The known `work_orders` inactive-member gap (member-scoped writes without active-status/staff-role predicates, identified in GDA-1W) must be closed by the conversion implementation's security work; conversion must not ship on top of the open gap.
7. Direct Data API (PostgREST) access must not bypass capability: raw authenticated writes to reservation/estimate/work-order tables must be denied or constrained so that conversion authority cannot be forged outside the server operation.
8. `SECURITY DEFINER` is used only when justified; prefer a trusted non-exposed schema where feasible; pin `search_path` (empty, schema-qualified); perform explicit inline auth checks inside the function; `REVOKE` from PUBLIC and `anon` and re-`GRANT EXECUTE` exactly to the intended role in the same migration transaction with no open window.
9. `user_metadata` must never be used for authorization decisions (it is user-writable); only server-controlled membership/capability records decide.

## 11. Source-of-truth matrix

| Data | Owning entity | Copy semantics at conversion |
|---|---|---|
| Reservation scheduling state (Axis A, §7) | Reservation | Never copied; other entities reference, never own it; it never encodes conversion progress |
| Conversion/artifact state (Axis B, §7) | The conversion operation and its authoritative artifacts (estimate, work order) plus the persisted idempotency record | Never stored as, or inferred from, reservation scheduling state; `failed_retryable` exists only as non-authoritative failure evidence outside the rolled-back authority mutation (§8) |
| Direct-path service scope/version and non-billable classification | Server-owned explicit dealer service configuration | Re-loaded by the server at conversion under exact tenant and edit capability; snapshotted as execution scope only at explicit staff confirmation; never taken from reservation/query/client data; never a pricing authority; only an explicit non-billable-for-entire-lifecycle classification makes the direct path eligible (§6) |
| Pricing / monetary data on the direct path | No entity — none may ever exist for a direct-path work order | The direct path is eligible only for lifecycle-non-billable services; the work order carries no price, discount, tax, total, monetary line item, or invoice permission and can never be retrofitted, converted, priced, invoiced, or linked into billable work under this contract; work that may require billing selects the estimate-first path before any work order is created (§6, §12) |
| Estimate pricing / line items | Estimate (via accepted save path) | Authoritative in estimate; never synchronized backward from reservation or forward from client |
| Work-order execution status | Work order | Never derived from reservation status after creation |
| Customer identity | Customer record | Referenced by id; identity fields are never forked into editable copies |
| Vehicle identity | Vehicle record | Referenced by id; same rule as customer |
| Staff assignment | Reservation (before conversion) → work order (after) | Snapshot at conversion; later reservation edits do not silently mutate the work order |
| Bay assignment | Reservation (scheduling) | Snapshot into work order if carried; schedule remains reservation-owned |
| Schedule / local timezone | Reservation | Snapshot into downstream artifacts for display; reschedule follows §12, never silent sync |
| Service contents | Estimate (after approval); reservation is a hint before | Reservation service selection is a prefill hint; estimate line items are the authority |
| Notes | Each entity owns its own notes | Reservation notes may be copied once as a snapshot hint; never two-way synchronized |

Snapshot means: copied once at conversion time, after which the copy is owned by the target entity. Synchronized would mean ongoing propagation — this contract permits no silent synchronization between authoritative entities.

## 12. Post-conversion rules

1. Cancellation/no-show after conversion progress: cancelling or recording no-show remains possible at any Axis B stage — after a draft estimate, after estimate approval, and after an accepted work order exists. The Axis A change surfaces the drift/conflict to a human on the linked artifacts; it never silently deletes or mutates the estimate or the accepted work order. The human decides on those artifacts explicitly.
2. Reschedule: rescheduling remains possible at any Axis B stage, including after draft/approval. It updates reservation-owned schedule state and flags the drift on the linked artifacts; it never silently rewrites work-order or estimate contents.
3. Estimate rejection/expiry: a rejected or expired estimate blocks the default conversion path forward; it does not retroactively invalidate an already-accepted work order without human decision.
4. Work-order completion: governed entirely by the accepted `GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md`; this contract adds nothing to and removes nothing from completion authority.
5. Drift detection and recovery: when linked artifacts disagree (schedule, staff, service scope), the system detects and reports the drift for human resolution. Recovery never silently overwrites one authoritative entity with another's data.
6. Direct-path terminal non-billable boundary after creation: a work order created through §6 remains non-billable for its whole life. It can never be retrofitted, converted, priced, invoiced, or linked into billable work under this contract, and its existence never becomes a pricing or invoice authority. Work that may require billing must instead have selected the default estimate-first flow before any work order was created (§4, §6). Any future design that links an estimate to an existing direct-path work order requires a separate owner-approved contract defining one-to-one linkage, no second work order, idempotency, and pricing and invoice authority; it remains default denied here.

## 13. Customer/LIFF boundary

1. Public customer booking (including `src/app/liff/reservation/page.tsx`) is a separate external-security contract and a separate product/security subphase. Nothing in this contract authorizes exposing conversion, pricing, or work-order surfaces to unauthenticated or LIFF-authenticated customers.
2. Demo or misleading customer-facing UI on this surface must be gated or removed until the separate external contract is accepted; it must not imply live booking/pricing that the server does not authoritatively provide.
3. The protected LINE migration (`supabase/migrations/20260801110110_line_link_tokens.sql`) remains metadata-only; this contract and its future implementation must not inspect, modify, or apply it.

## 14. Capacity is advisory only

Capacity checking (bay/staff occupancy, warnings, reasons, overrides) remains advisory. The existing warn/reason/override behavior may be preserved and surfaced during conversion, but this contract must never silently convert capacity advice into a hard blocker. Making capacity blocking would be a separate, owner-approved product decision.

## 15. API / result / error contract

Semantic outcomes are stable; final function names are not fixed by this contract.

Success outcomes:

- `created` — this request produced the artifact (draft estimate or work order).
- `replayed` — a prior accepted request produced it; identical artifact identifiers returned.

Denial/failure outcomes (each fail-closed, each safe to retry where marked):

- `unauthorized` — no authenticated session.
- `forbidden` — authenticated but not an edit-capable active tenant actor for this reservation's tenant (covers readonly, inactive, suspended, ambiguous, cross-dealer).
- `invalid_state` — the reservation scheduling state or the conversion/artifact state does not permit the transition on its axis (§7).
- `not_eligible` — direct-work-order path requested but §6 eligibility, the explicit non-billable-for-entire-lifecycle classification, or the server-owned service scope/version configuration is absent, false, ambiguous, or unreadable; the default estimate-first flow applies.
- `conflict` — concurrent conversion detected; retry with the same idempotency key is safe and converges.
- `retryable_failure` — the conversion attempt's transaction rolled back completely and exactly (§8): reservation, estimate, work order, number allocation, and idempotency authority are unchanged. The `failed_retryable` result exists only as non-authoritative failure evidence; same-key retry is safe.
- `permanent_failure` — human/operator intervention required; the reason is reportable without database surgery.

Errors never leak cross-tenant existence information and never return partial artifact identifiers.

No outcome — success or failure, on either path — ever grants a price, discount, tax, total, monetary line item, or invoice permission from reservation, query, or client data. A direct-path `created`/`replayed` result returns execution-only work-order identifiers with no monetary authority and no path to later pricing or invoicing (§6, §12).

## 16. Evidence gates

| Gate | Evidence |
|---|---|
| E1 | Contract/source review: implementation matches this contract on read; ownership and security boundaries identifiable. |
| E2 | Focused unit/source tests for prefill authority, the two-axis state model, idempotency semantics, eligibility fail-closed behavior, and numbering rules. |
| E3 | Disposable migration replay + pgTAP raw-role probes (grants, RLS `USING`/`WITH CHECK`, denial matrix) + genuine separate-connection race evidence + authenticated browser verification. |
| E4 | Later field proof: a GYEON detailer converts a real reservation without re-entry and without developer assistance. |

Separate gates, each requiring its own authorization: audit, repair, migration generation, runtime verification, commit, push, migration apply, Ready/merge/deploy. A failed disposable evidence set is burned, never repaired into acceptance.

## 17. Proposed future repair allowlist — NOT AUTHORIZED

The following literal paths are the proposed scope for the future implementation phase. This section authorizes NOTHING; it exists so the future phase has an exact, pre-reviewed boundary.

Source candidates:

- `src/lib/reservations/update-reservation.ts`
- `src/lib/reservations/create-reservation.ts`
- `src/lib/reservations/cancel-reservation.ts`
- `src/components/reservations/ReservationTable.tsx`
- `src/components/reservations/ReservationForm.tsx`
- `src/app/estimates/new/page.tsx`
- `src/lib/work-orders/create-work-order.ts`
- `src/app/liff/reservation/page.tsx` (separate product/security subphase only; NOT part of the first bounded repair)

Test candidates:

- `src/lib/reservations/create-reservation.test.ts`
- `src/lib/reservations/update-reservation.test.ts`
- `src/lib/reservations/create-work-order-from-reservation.test.ts`
- `src/lib/reservations/cancel-reservation.test.ts`
- `src/lib/capacity/capacity-calculator.test.ts`
- `src/lib/capacity/occupancy-expander.test.ts`
- `src/lib/reservations/get-capacity-preview.test.ts`

Migration:

- Status: REQUIRED_LATER. Filename: GENERATED_LATER_BY_SUPABASE_CLI via a separately authorized `supabase migration new` subphase. Never invent or hand-write the timestamp.

Split of work:

- Likely first bounded repair: server-side conversion operation, prefill authority, state validation, idempotency/numbering transaction, authorization/RLS closure, and the internal (staff-facing) reservation/estimate/work-order paths plus their focused tests.
- Deferred: all customer-facing/LIFF surface work (separate external-security contract), any capacity-policy change, and any physical eligibility storage design beyond the minimum the migration subphase accepts.

No implementation, test edit, or migration generation is authorized by this contract.

## 18. Acceptance checklist, rollback, limitations, next gate

### 18.1 Acceptance checklist (for MacBook Codex review of this document)

- [ ] Default flow keeps reservation as scheduling intent only; no pricing or work authority leaks from reservation, query, or client values.
- [ ] Direct-work-order exception is server-owned, default-false, explicitly configured, explicitly confirmed, fail-closed, storage-deferred, and eligible only for a service explicitly classified as non-billable for its entire lifecycle.
- [ ] Direct-path service and pricing authority: the server re-loads the explicitly configured service scope/version under exact tenant and edit capability; explicit staff confirmation snapshots execution scope only; reservation/query/client data authorizes no price, discount, tax, total, monetary line item, or invoice permission; any service for which a price, charge, monetary line item, tax, discount, total, or invoice may be required now or later is direct-path ineligible and must select the estimate-first flow before any work order is created; the direct-path work order is terminally non-billable — it can never be retrofitted, converted, priced, invoiced, or linked into billable work under this contract; any future estimate-to-existing-direct-work-order linkage design requires a separate owner-approved contract (one-to-one linkage, no second work order, idempotency, pricing and invoice authority) and remains default denied here.
- [ ] Lifecycle is modeled as two independent axes (reservation scheduling state `pending`/`confirmed`/`cancelled`/`no_show`; conversion/artifact state `none`/`estimate_draft`/`estimate_approved`/`converting`/`work_order_created`/`failed_retryable`), fail-closed on both axes, with physical storage explicitly deferred and no invented tables, columns, enums, RPCs, or migration filenames.
- [ ] Cross-axis semantics: cancellation, no-show, and reschedule remain possible after draft/approval and after work-order creation; they surface drift/conflict and never silently mutate the estimate or the accepted work order; `failed_retryable` is a conversion-attempt result/audit state, never a reservation state committed by the failed transaction.
- [ ] Transaction/idempotency contract guarantees one accepted work order per reservation, deterministic replay, different-key convergence, no orphans, and separate-connection race evidence; exact rollback leaves reservation, estimate, work order, number allocation, and idempotency authority unchanged; non-authoritative failure evidence lives only outside the rolled-back authority mutation, cannot poison same-key retry, and implies no authoritative artifact mutation.
- [ ] Numbering prohibits the legacy unpersisted fallback and requires in-transaction allocation with DB uniqueness.
- [ ] Authorization/RLS/grants section closes the `work_orders` inactive-member gap, requires `USING` + `WITH CHECK`, blocks Data API bypass, constrains `SECURITY DEFINER`, and bans `user_metadata` authorization, consistent with the cited official Supabase guidance.
- [ ] Source-of-truth matrix defines snapshot-vs-synchronized for every listed datum with no silent synchronization.
- [ ] Customer/LIFF surface is excluded and protected-path rules are preserved.
- [ ] Capacity remains advisory.
- [ ] Future allowlist is literal, split into first-bounded vs deferred, and marked NOT AUTHORIZED.

### 18.2 Rollback

This candidate is three uncommitted working-tree documentation changes (this file as finally repaired by GDA-1R2-C1R2, `INDEX.md`, and the appended GDA-1R2-C1, GDA-1R2-C1R, and GDA-1R2-C1R2 ledger blocks). Rollback is discarding those three working-tree changes. No source, test, migration, database, external-service, Git-history, or deployment state exists to roll back.

### 18.3 Known limitations

- This is a decision document; no executable, environment, or field evidence exists for the conversion path yet.
- Physical schema mapping for the two logical lifecycle axes, the direct-eligibility configuration, and the service scope/version representation is intentionally undecided; no physical table, column, enum, or RPC is invented here.
- The physical recording location for non-authoritative failure evidence is intentionally undecided; only its logical constraints are fixed (outside the rolled-back authority mutation, no same-key retry poisoning, no implied authoritative artifact mutation).
- A direct-path work order is terminally non-billable under this contract; any future design that links an estimate to an existing direct-path work order requires a separate owner-approved contract defining one-to-one linkage, no second work order, idempotency, and pricing and invoice authority, and remains default denied here.
- The exact migration filename does not exist and must not be invented.
- The customer/LIFF booking surface remains uncontracted.

### 18.4 Next gate

Return this finally repaired uncommitted documentation candidate to MacBook Codex for independent acceptance: `RETURN_GDA-1R2-C1R2_FINAL_REPAIR_TO_CODEX_UNCOMMITTED`. Stage/commit/push, implementation, migration generation, runtime verification, Ready conversion, merge, and deployment each remain separate, later, owner-authorized gates.
