# GDA-1W Completion Authority Contract

| Field | Value |
|---|---|
| Phase | `GDA-1W-C1` |
| Status | **ACCEPTED — product owner approved the contract on 2026-08-10; implementation, migration, DB access, push, and PR mutation remain separately authorized** |
| Owner | Office AZ / Product Owner |
| Technical authority | MacBook Codex |
| Governing plan | `GYEON_DA_COMPLETION_PLAN.md` |
| Source audit | `GDA-1W` in `GYEON_DA_PHASE_RESULTS.md` |
| Audit commit | `94bac3ad439eb07d780c74d4573eb6ba1ca92f7a` |
| Audit tree | `feafd3cba8c22de7c45cd941d674a7763712677c` |
| Created | 2026-08-10 |

## 0. Authority and phase boundary

This accepted contract closes the design questions raised by the `GDA-1W` read-only audit. It defines the future completion authority but changes no application behavior.

The only path authorized for creation in `GDA-1W-C1` is:

```text
docs/master_specification/GDA_1W_COMPLETION_AUTHORITY_CONTRACT.md
```

This phase does **not** authorize source edits, tests, dependency changes, migration generation or application, database or Supabase access, Storage or LINE access, staging or production access, commit, push, PR mutation, Ready conversion, merge, or deployment.

The product owner accepted this contract by explicitly directing the work to proceed on 2026-08-10. No implementation phase may begin until the exact later phase, final literal allowlist, and permitted verification commands are separately authorized.

## 1. Purpose

The completion flow exists to remove clerical work after a detailing job while keeping the customer-facing work report factually correct.

The operator should perform one deliberate completion action that:

1. confirms when the work ended;
2. confirms what work was actually performed;
3. completes the work order;
4. creates or reuses exactly one canonical completion report;
5. allocates one authoritative report number; and
6. returns one stable result even when the request is retried.

The accepted monetary-free work-report visual design remains unchanged. This contract changes the authority feeding that design, not the design itself.

## 2. Explicit non-goals

The following are outside this contract:

- sending LINE, email, SMS, or any other customer message;
- issuing an invoice, recording a payment, or changing financial data;
- automatically creating a maintenance reminder;
- changing the accepted work-report visual layout;
- persisting a generated PDF artifact;
- inventory, product ordering, EC, or SaaS commercialization;
- AI-generated performed-work facts;
- production migration, backfill, deployment, or real customer-data access.

Completion must commit without calling an external provider. Later communication, invoice, maintenance, and review flows consume the committed result through separately authorized and idempotent phases.

## 3. Fixed business decisions

### 3.1 One canonical report

There is exactly one canonical completion report for each `(dealer_id, work_order_id)` pair.

- Repeated clicks, browser retries, two tabs, and concurrent requests must never create a second report.
- A work order may not be rebound to another completion report.
- A completion report may not be rebound to another work order or dealer.
- The existing `draft`, `generated`, `shared`, and `archived` values remain readable for compatibility.
- New completion creates status `draft`.
- On-demand PDF rendering does not change status to `generated`.
- `shared` and `archived` require dedicated future operations; an ordinary form may not set them.

### 3.2 Performed-work authority

`estimate_items` are a proposal and are not evidence of completed work. A work report must never read its performed-work rows directly from `estimate_items`.

The completion surface may prefill a draft from the linked estimate, but the operator must review and explicitly confirm a **monetary-free performed-work snapshot**. The confirmed snapshot becomes the authority for the work report and no longer follows later estimate changes.

Each performed-work item contains only:

| Field | Rule |
|---|---|
| `category` | trimmed text, 1–100 characters |
| `item_name` | trimmed text, 1–200 characters |
| `description` | optional trimmed text, maximum 2,000 characters |
| `sort_order` | server-derived from JSON array order, beginning at 0 |

The snapshot must contain 1–100 items. The input object must have exactly the three client fields above. Quantity, unit price, line total, tax, discount, cost, margin, or other monetary fields are rejected rather than ignored.

### 3.3 Human confirmation and correction

The completion button is the human confirmation of both `actual_end_at` and the performed-work snapshot.

- New completion stores `performed_work_confirmed_at`, `performed_work_confirmed_by`, and snapshot version `1`.
- Before the report is shared, an active edit-capable staff member may use a dedicated draft-update operation to correct the non-monetary snapshot.
- A correction replaces all snapshot rows atomically, increments the version, and records who changed it and when.
- After status `shared` or `archived`, the snapshot is immutable. A future correction/revision flow requires its own contract and authorization.
- No raw table update may change snapshot rows, the report/work-order binding, the report number, confirmation fields, or snapshot version.

### 3.4 Completion state

Allowed first completion transitions are:

```text
scheduled | in_progress | on_hold  -> completed
```

`cancelled -> completed` is forbidden. `completed` is terminal for this contract.

Completion requires:

- a real work order in the caller's dealer;
- `deleted_at IS NULL`;
- a non-null customer and vehicle;
- a non-null `actual_end_at` supplied as a timestamp with timezone;
- `actual_end_at >= actual_start_at` when `actual_start_at` exists;
- `actual_end_at <= database now() + 5 minutes`; and
- a valid, explicitly confirmed performed-work snapshot.

The report date is derived in the database from `actual_end_at` using the `Asia/Tokyo` calendar date. It is not accepted as an authoritative client field during completion.

A linked estimate is optional. When present it may prefill the editable performed-work candidate and must belong to the same dealer, customer, and vehicle. When absent, the operator enters the performed-work items directly. The absence of an estimate must not block an otherwise valid completion or work report.

### 3.5 No automatic side effects

The completion transaction must not:

- send or queue a message;
- issue or update an invoice;
- record a payment;
- create a maintenance reminder;
- upload a PDF; or
- call an external service.

Existing post-update event and maintenance behavior must not be invoked by the new atomic completion operation. A future transactional outbox may consume only the result where `outcome = 'created'`; it is outside this contract.

## 4. Canonical database model

### 4.1 `completion_reports` hardening

The existing table remains the report header authority and gains:

| Column | Contract |
|---|---|
| `performed_work_confirmed_at timestamptz` | null for legacy/unconfirmed rows; non-null for work-report eligibility |
| `performed_work_confirmed_by uuid` | authenticated actor that confirmed the current snapshot |
| `performed_work_version integer` | null for legacy/unconfirmed rows; positive and monotonic after confirmation |
| `performed_work_updated_at timestamptz` | timestamp of the current confirmed version |

Required constraints/indexes:

```text
UNIQUE (dealer_id, work_order_id)
UNIQUE (dealer_id, report_number) WHERE report_number IS NOT NULL
CHECK (performed_work_version IS NULL OR performed_work_version > 0)
```

The work-order foreign key remains but must use a reviewed non-destructive delete rule (`RESTRICT`/`NO ACTION`, not cascade). The migration must also prove that the report's `dealer_id` equals the referenced work order's `dealer_id`; a trigger or a dealer-qualified composite foreign key may enforce this, but source checks alone are insufficient.

### 4.2 `completion_report_items`

A new normalized table stores the authoritative monetary-free snapshot:

```text
id                          uuid primary key default gen_random_uuid()
dealer_id                   uuid not null
completion_report_id        uuid not null
sort_order                  integer not null
category                    text not null
item_name                   text not null
description                 text null
created_at                  timestamptz not null default now()
updated_at                  timestamptz not null default now()
```

Required integrity:

- foreign key to `completion_reports(id)` using `RESTRICT`/`NO ACTION`;
- tenant binding proving item `dealer_id` equals report `dealer_id`;
- `UNIQUE (completion_report_id, sort_order)`;
- row checks matching the text and sort-order limits in section 3.2;
- aggregate item count 1–100 enforced by both the RPC and the completed-state database guard;
- indexes on `dealer_id` and `completion_report_id` as required by the foreign keys and RLS reads;
- no authenticated, anonymous, or service-role raw INSERT, UPDATE, or DELETE grant.

### 4.3 `work_order_completion_requests`

A new immutable request ledger owns idempotency and audit evidence:

```text
id                          uuid primary key default gen_random_uuid()
dealer_id                   uuid not null
idempotency_key             text not null
request_fingerprint         text not null
work_order_id               uuid not null
completion_report_id        uuid not null
actor_user_id               uuid not null
outcome                     text not null  -- created | replayed | recovered
created_at                  timestamptz not null default now()
```

Required integrity:

- `UNIQUE (dealer_id, idempotency_key)`;
- `RESTRICT`/`NO ACTION` foreign keys and dealer-binding checks for work order and report;
- `CHECK (idempotency_key = btrim(idempotency_key))` and length 16–128;
- `CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')`;
- `CHECK (outcome IN ('created','replayed','recovered'))`;
- indexes supporting the work-order and report foreign keys;
- append-only behavior: no runtime UPDATE or DELETE grant;
- no anonymous, authenticated, or service-role raw INSERT grant.

The key is generated once by the client and retained for every retry of the same intent. The database computes the fingerprint from normalized authoritative inputs; the client cannot supply the fingerprint.

## 5. Atomic completion operation

### 5.1 Function contract

The database operation is:

```sql
public.complete_work_order_v1(
  p_work_order_id uuid,
  p_idempotency_key text,
  p_actual_end_at timestamptz,
  p_performed_items jsonb
)
```

It returns exactly one row:

```text
work_order_id
completion_report_id
report_number
performed_work_version
request_fingerprint
outcome                 -- created | replayed | recovered
created                 -- true only for outcome created
replayed                -- true for replayed or recovered existing authority
```

The client does not supply `dealer_id`, actor ID, role, report ID, report number, report date, report status, confirmation timestamp, version, shared state, or any financial value.

### 5.2 Security mode and privileges

The function is `SECURITY DEFINER` only because raw DML on the authority tables is denied and the function must update them atomically. It must:

- be owned by the reviewed migration owner;
- use `SET search_path = ''`;
- schema-qualify every table, function, operator-sensitive relation, and extension call;
- use no dynamic SQL;
- derive identity only from `auth.uid()`;
- contain its own active staff authorization before any write;
- revoke execute from `PUBLIC`, `anon`, `authenticated`, and `service_role` immediately after create/replace; and
- regrant execute only to `authenticated`.

Required privilege shape:

```sql
REVOKE EXECUTE ON FUNCTION public.complete_work_order_v1(uuid, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_work_order_v1(uuid, text, timestamptz, jsonb)
  TO authenticated;
```

The same revoke-then-exact-regrant rule applies to every new helper or draft-update function. Trigger-only functions receive no runtime EXECUTE grant.

### 5.3 Actor and tenant authorization

Authorization is fail-closed and evaluated for the dealer that owns `p_work_order_id`:

1. `auth.uid()` must be non-null.
2. Missing, deleted, or cross-dealer work orders return the same coarse `NOT_FOUND` outcome.
3. If a `dealer_staff` row exists for `(dealer_id, auth.uid())`, it is authoritative. Its status must be `active` and role must be `owner`, `manager`, or `staff`.
4. A `disabled`, `invited`, unknown-role, or duplicate/ambiguous staff state denies access and never falls back.
5. Only when no `dealer_staff` row exists may an active same-dealer `dealer_members` role of `owner`, `manager`, or `staff` authorize.
6. The dealer's `owner_user_id` may authorize as `owner` only when no blocking `dealer_staff` row exists.
7. `readonly`, inactive membership, anonymous, service role, and any different dealer are denied.

No client-provided tenant or role is consulted. Application authorization remains defense in depth and must resolve the same actor/tenant pair, but it cannot replace the database check.

### 5.4 Validation and fingerprint

The database normalizes:

- trimmed idempotency key;
- `p_actual_end_at` as one instant;
- performed items with trimmed text and array-derived order; and
- server-derived report date.

The fingerprint is lowercase SHA-256 over one versioned canonical JSON value containing:

```json
{
  "contractVersion": 1,
  "workOrderId": "uuid",
  "actualEndAt": "UTC ISO instant",
  "performedItems": [
    { "category": "...", "itemName": "...", "description": null, "sortOrder": 0 }
  ]
}
```

Exact canonicalization and the UTC timestamp representation must have one pure TypeScript contract test and one PostgreSQL test vector. A database-computed fingerprint is authoritative.

### 5.5 Transaction order

One function call is one short PostgreSQL transaction. It acquires locks in this order for every caller:

1. work order row by primary key with `FOR UPDATE`;
2. existing canonical completion report, if any, with `FOR UPDATE`;
3. existing idempotency request, if any, through the unique `(dealer_id, idempotency_key)` arbiter;
4. document-sequence row through the internal sequence-allocation core `private.allocate_next_document_number_v1` — the single atomic arbiter of the sequence row — only when a new report number is required.

Then it:

1. authorizes the actor;
2. validates and fingerprints the normalized intent;
3. resolves an existing same-key request;
4. resolves existing completed/canonical state;
5. allocates an authoritative number without any guessed fallback;
6. creates or repairs the canonical report;
7. replaces/creates the confirmed item snapshot;
8. records the immutable request row;
9. sets `work_orders.status = 'completed'`, `actual_end_at`, and `updated_at`; and
10. returns the stable result.

All multi-row reads and writes remain inside the function. Locks on multiple objects must always use the order above. Deadlock victims may be retried with the same idempotency key.

### 5.6 Number allocation

Number allocation uses a two-layer allocator contract (C2R ruling). The C2 diagnosis proved that requiring the completion function to call `public.get_next_document_number` directly is inconsistent with §5.3: that public allocator authorizes only an active `dealer_members` row or `dealers.owner_user_id`, so a §5.3-authorized `dealer_staff`-only actor would fail allocation mid-transaction. The nested-public-allocator rule is therefore replaced as follows:

1. A non-exposed internal sequence-allocation core, provisionally named `private.allocate_next_document_number_v1(uuid, text, integer, text, integer, text)`, becomes the single atomic arbiter of the sequence row.
2. The internal core is `SECURITY INVOKER`, uses `SET search_path = ''`, schema-qualifies every reference, and contains only the existing `INSERT ... ON CONFLICT` atomic increment behavior.
3. `PUBLIC`, `anon`, `authenticated`, and `service_role` receive no `USAGE` on the `private` schema and no `EXECUTE` on the internal core; the `private` schema is not exposed through the Data API.
4. The existing `public.get_next_document_number` keeps its exact signature, its active-member-or-owner authorization, its direct-caller behavior, its return semantics, and its authenticated-only `EXECUTE` grant, and delegates the increment to the internal core.
5. `complete_work_order_v1` performs the exact §5.3 authorization first, then invokes the internal core — never the public wrapper — for `completion_report` within the same transaction.
6. Both wrappers are owned/deployed so that their `SECURITY DEFINER` context can invoke the `SECURITY INVOKER` core; no client can invoke the core directly.
7. All create/replace and revoke/grant statements for the core and wrappers occur in one migration transaction with no window in which `PUBLIC` holds `EXECUTE`.

This preserves the legacy allocator's authorization for its existing direct callers, adds no new direct numbering capability for any client role, and permits valid `dealer_staff`-only completion.

The following allocation rules are preserved unchanged:

- The stored sequence configuration must be resolved deterministically.
- If no configuration row exists, the existing default contract (`REP`, padding 5, reset `never`) is used.
- The persisted number must be formatted using the same semantic segments as `formatDocumentNumber`.
- If configuration, allocation, formatting, or insert fails, the entire transaction fails.
- The legacy one-argument TypeScript fallback is forbidden.
- The report-number unique index is the final collision guard.

### 5.7 Draft correction operation

Confirmed performed work may need a spelling or factual correction before customer sharing. That correction uses a second atomic database operation:

```sql
public.update_completion_report_draft_v1(
  p_completion_report_id uuid,
  p_expected_performed_work_version integer,
  p_title text,
  p_customer_message text,
  p_internal_memo text,
  p_performed_items jsonb
)
```

It is governed by the same security-definer, empty-search-path, schema-qualification, active-edit-role, tenant, grant, validation, and logging rules as `complete_work_order_v1`.

The operation first reads the report binding without locking, then locks the work order and canonical report in the same work-order-then-report order used by `complete_work_order_v1`; it revalidates the binding after both locks are held. It then:

- accepts only status `draft`;
- requires `p_expected_performed_work_version` to equal the stored version;
- updates only title, customer message, internal memo, and the monetary-free performed-work snapshot;
- replaces all item rows inside the same transaction;
- increments the version exactly once and records actor/time;
- returns the report ID and new version; and
- returns `STALE_VERSION` without writes when another correction won first.

It cannot change dealer, work order, report number/date, status, sharing fields, PDF fields, next-maintenance fields, or any financial value. Report sharing and maintenance scheduling remain separate future operations.

## 6. Created, replayed, conflict, and recovery outcomes

| Situation | Required result |
|---|---|
| First valid call | one work order completion, one report, one snapshot, one request row; `outcome=created` |
| Same dealer + same key + same fingerprint | same IDs and number; no write except optional safe access telemetry; `outcome=replayed` |
| Same dealer + same key + different fingerprint or work order | `IDEMPOTENCY_CONFLICT`; no write |
| Different key + same work order + identical authoritative fingerprint | insert an immutable alias request pointing to the same report; `outcome=replayed` |
| Different key + same work order + different fingerprint | `ALREADY_COMPLETED_CONFLICT`; no write |
| Two concurrent valid calls with same key | exactly one `created`; the other returns the same result as `replayed` |
| Two concurrent keys with identical intent | exactly one `created`; the other returns the same canonical result as `replayed` |
| Cancelled or deleted work order | domain error; no write |
| Completed legacy order with exactly one eligible unconfirmed report | no silent conversion; requires explicit recovery confirmation; `outcome=recovered` only through the reviewed recovery branch |
| Completed order with no report, multiple reports, or inconsistent dealer binding | fail closed and require a separate data-recovery decision |

Errors returned to application code are stable domain codes, not raw SQL text. Logs must not include customer, vehicle, performed-work, or idempotency payload content.

## 7. Database guardrails and RLS

### 7.1 Raw write boundary

Future migration and source work must establish:

- `completion_reports`: authenticated runtime gets tenant-scoped SELECT only; raw INSERT/UPDATE/DELETE is revoked;
- `completion_report_items`: authenticated runtime gets tenant-scoped SELECT only; no raw writes;
- `work_order_completion_requests`: no normal application SELECT unless a proven operator view needs it; no raw writes;
- `work_orders`: existing non-completion edits may remain, but table-wide UPDATE is replaced with reviewed column grants plus a database guard that rejects raw changes entering/leaving `completed`; authenticated and service-role callers have no raw UPDATE privilege on `actual_end_at`;
- `anon`: no application-table or function access;
- `service_role`: no function execute and no raw mutation of completion authority;
- `private` schema and internal allocation core: no `USAGE` on the schema and no `EXECUTE` on `private.allocate_next_document_number_v1` for `PUBLIC`, `anon`, `authenticated`, or `service_role`; the core is reachable only through the two `SECURITY DEFINER` wrappers (§5.6);
- `public.get_next_document_number`: exact existing signature, active-member-or-owner authorization, return semantics, and authenticated-only `EXECUTE` remain unchanged;
- report header and item DELETE remain denied; archival is a separately authorized state change.

The generic `updateWorkOrder` path must not be able to set `completed` or change `actual_end_at`. A completed row may leave `completed` only through a future correction/recovery operation. The database completed-state guard also requires one canonical confirmed report and 1–100 valid snapshot items. The generic completion-report form must not directly set status, sharing state, report number, report/work-order binding, confirmation metadata, version, or snapshot rows.

### 7.2 Command-specific policies

Replace the existing `FOR ALL` completion-report policy with command-specific policies.

- SELECT requires active same-dealer membership/owner context.
- Every UPDATE policy must have both `USING` and `WITH CHECK`.
- Mutable draft metadata is changed only through a dedicated function with the same inline active-edit-role authorization.
- Tenant IDs and foreign bindings are immutable.
- Unknown, error, disabled, invited, readonly, and cross-tenant states deny.
- No DELETE policy is created for reports, items, or request rows.

RLS is defense in depth. Grants, function privileges, constraints, triggers, and inline authorization are all independently tested.

## 8. Work-report eligibility and source binding

One pure eligibility contract must be consumed by both the completion UI and the authenticated PDF route. The route remains the final authority.

A work report is ready only when all are true:

- the request has a genuine authenticated user and active dealer context;
- report, work order, customer, and vehicle belong to that dealer;
- when an estimate is linked, it also belongs to the same dealer, customer, and vehicle;
- the report is the one canonical report for the work order;
- work order status is `completed` and `actual_end_at` is non-null;
- report number and report date are non-null;
- `performed_work_confirmed_at` and positive version are present;
- the confirmed snapshot has at least one valid item; and
- report status is not `archived`.

The loader must select performed items from `completion_report_items`, ordered by `sort_order`, and map only `category`, `item_name`, and `description` into the existing monetary-free `WorkReportSourceItem` contract.

It must not select or return quantity, price, cost, tax, discount, totals, margins, payment data, or invoice data. It must not fall back to estimate items when the snapshot is absent.

The completion-report page must not show a contradictory “PDF is preparing” message when the authenticated route exists. It displays the exact readiness reason from the shared contract.

## 9. Existing-data migration and recovery

No production migration is authorized by this contract.

Before a uniqueness constraint is applied, a read-only preflight must identify:

- more than one completion report for one `(dealer_id, work_order_id)`;
- duplicate non-null report numbers within a dealer;
- report/work-order dealer mismatches;
- completed work orders with zero or multiple reports; and
- existing reports with no performed-work snapshot.

If any duplicate or mismatch exists, migration application stops. The migration must not guess a canonical report, merge text, renumber, archive, or delete data automatically.

Legacy reports receive null confirmation fields and are **not work-report ready**. The UI may copy estimate items into an editable candidate, but a human must confirm the actual work before snapshot rows are written. Existing generated/shared reports require a separately reviewed recovery policy; they must not be silently rewritten.

Disposable-database verification, staging preflight, staging apply, production preflight, production apply, and backfill/recovery are separate phases and separate approvals.

## 10. Acceptance evidence required before implementation can be accepted

### 10.1 Pure and source-scoped tests

- exact performed-item shape, normalization, limits, and rejection of monetary/extra keys;
- fingerprint canonicalization vectors shared between TypeScript and PostgreSQL;
- eligibility reason matrix shared by UI and route;
- state-transition and idempotency outcome matrix;
- generic work-order update cannot complete or change actual end;
- generic report update cannot change protected authority fields;
- work-report loader reads only confirmed snapshot rows;
- no estimate-item fallback;
- route uses a genuine request-scope authenticated session/cookie, not source-text assertions;
- candidate-scoped strict no-emit typecheck;
- `git diff --check` on the literal allowlist.

### 10.2 Disposable PostgreSQL/Supabase tests

Tests must run only against a separately authorized disposable local database and must prove:

- function owner, `SECURITY DEFINER`, empty `search_path`, and exact EXECUTE grants;
- `private` schema and internal-core ACL assertions: no `USAGE` on schema `private` and no `EXECUTE` on `private.allocate_next_document_number_v1` for `PUBLIC`, `anon`, `authenticated`, or `service_role`;
- direct invocation of the internal core is denied for each of `PUBLIC`, `anon`, `authenticated`, and `service_role`;
- the existing `public.get_next_document_number` role matrix is unchanged: an active member or owner succeeds, every other caller receives `FORBIDDEN`, and its `EXECUTE` grant remains authenticated-only;
- an active `dealer_staff`-only actor (owner/manager/staff with no active `dealer_members` row) completes successfully end-to-end, including number allocation;
- authenticated owner/manager/staff success;
- readonly, invited, disabled, anonymous, service-role, unknown-role, and cross-dealer denial;
- blocking `dealer_staff` state cannot fall back to `dealer_members`;
- RLS SELECT isolation;
- raw Data API INSERT/UPDATE/DELETE denial on report, items, and requests;
- raw work-order transition to `completed` and raw `actual_end_at` change are rejected;
- unique report and report-number constraints;
- tenant-coherent foreign keys and required FK indexes;
- same-key/same-payload replay;
- same-key/different-payload conflict;
- separate-connection same-key concurrency;
- separate-connection different-key/same-work-order concurrency;
- one committed transition, one canonical report, one number, one snapshot, and stable IDs;
- transaction rollback on validation, allocation, report insert, item insert, and request-ledger failure; and
- no message, invoice, payment, maintenance, Storage, or external-service mutation.

Source assertions may supplement but never replace executable database and genuine request evidence. A concurrency claim requires two real database connections; sequential calls in one session do not count.

## 11. Proposed future implementation allowlist

The following paths are the maximum currently justified source/test candidate. They are **proposed, not authorized**:

```text
src/lib/work-orders/work-order-completion-contract-core.ts
src/lib/work-orders/work-order-completion-contract-core.test.ts
src/lib/work-orders/work-order-completion-actor-context.ts
src/lib/work-orders/work-order-completion-actor-context.test.ts
src/lib/work-orders/complete-work-order.ts
src/lib/work-orders/complete-work-order.test.ts
src/lib/work-orders/update-work-order.ts
src/lib/work-orders/work-order-types.ts
src/components/work-orders/WorkOrderForm.tsx
src/lib/completion-reports/completion-report-types.ts
src/lib/completion-reports/completion-report-eligibility-core.ts
src/lib/completion-reports/completion-report-eligibility-core.test.ts
src/lib/completion-reports/create-completion-report.ts
src/lib/completion-reports/update-completion-report.ts
src/lib/completion-reports/get-completion-report.ts
src/components/completion-reports/CompletionReportForm.tsx
src/components/completion-reports/CompletionReportSection.tsx
src/app/completion-reports/page.tsx
src/lib/pdf/get-work-report-pdf-data.ts
src/app/pdf/work-report/route.ts
src/app/pdf/work-report/route.test.ts
src/lib/pdf/__tests__/template-c2/work-report-binding-boundary.test.ts
supabase/tests/work_order_completion_authority.test.sql
scripts/e2e/gda-1w-completion/run-concurrency.sh
scripts/e2e/gda-1w-completion/concurrency-a.sql
scripts/e2e/gda-1w-completion/concurrency-b.sql
```

The migration path cannot truthfully be listed yet: project rules require `supabase migration new work_order_completion_authority`, and its timestamped pathname does not exist until that separately authorized command runs. Therefore:

1. a migration-generation-only subphase may run that one CLI command;
2. the generated pathname must be recorded verbatim in the result ledger;
3. the implementation allowlist must then be reissued with that exact path; and
4. no migration content may be written before the exact generated path is accepted.

The C2R allocator ruling (§5.6) adds no application-source path to this allowlist and edits no existing migration: the `private` schema, the internal allocation core, the `public.get_next_document_number` delegation, and every related ACL statement belong exclusively to the future generated completion migration path above.

No glob, directory-wide permission, placeholder filename, or implicit dependency is authorized. If diagnosis proves another path is necessary, implementation stops and returns an allowlist delta for approval.

The following remain protected and outside every completion implementation allowlist unless the user separately changes the boundary:

```text
src/components/estimates/wizard/screens/ScreensPreview.tsx
supabase/migrations/20260801110110_line_link_tokens.sql
supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

Only pathname, mode, blob hash, and Git state may be read for these protected paths.

## 12. Required phase sequence

No step may be combined silently:

1. **GDA-1W-C1 review** — accepted by the product owner on 2026-08-10.
2. **Documentation commit** — separately authorize staging and committing this one document.
3. **Documentation push/PR update** — separately authorize push and PR metadata/comment changes.
4. **Implementation diagnosis** — Claude reads the accepted contract and validates the proposed allowlist against current source; no edits.
5. **Migration pathname generation** — separately authorize `supabase migration new work_order_completion_authority`; record exact path; no SQL content. The two-layer allocator objects (`private` schema, internal core, public-allocator delegation, and their ACLs) are implemented only inside that generated migration; no existing migration is edited and no application-source path is added by the allocator ruling.
6. **Implementation candidate** — separately authorize the final literal allowlist; no DB connection or migration apply.
7. **Focused source verification** — separately authorize exact test and candidate typecheck commands.
8. **Disposable DB verification** — separately authorize local Supabase/PostgreSQL setup, migration replay, pgTAP, raw-role probes, and two-connection concurrency.
9. **Candidate acceptance** — Codex independently checks commit/tree/path/hash/test evidence.
10. **Commit, push, Draft PR update** — each follows the approved Git boundary; no Ready or merge.
11. **Staging and production** — preflight, migration application, authenticated smoke, Ready, merge, deployment, and production verification remain separately authorized phases.

## 13. Contract acceptance checklist

This contract is ready to accept only when the product owner confirms all of the following:

- one canonical completion report per work order;
- estimate items are prefill only, never completed-work authority;
- completion confirms a monetary-free performed-work snapshot;
- completion, report, snapshot, number, and idempotency result are one atomic operation;
- only active `owner`, `manager`, or `staff` may complete or correct a draft;
- raw Data API writes cannot bypass the operation;
- the two-layer allocator boundary: a non-exposed internal sequence-allocation core arbitrates the sequence row, the existing public allocator keeps its exact authorization and delegates to it, completion invokes the core only after §5.3 authorization, and no runtime role can call the core directly;
- report rendering reads only the confirmed snapshot;
- no automatic customer, finance, maintenance, Storage, or external side effect occurs;
- existing duplicates and legacy reports are not silently rewritten;
- genuine authenticated request, raw-role, rollback, and separate-connection concurrency evidence are mandatory; and
- every later mutation remains bounded by a literal allowlist and separate authorization.

This acceptance closes contract design only. It does not authorize source implementation, migration generation/application, tests, DB/Supabase access, push, PR mutation, Ready conversion, merge, or deployment.
