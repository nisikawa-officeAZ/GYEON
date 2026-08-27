# Claude Directive — GYEON Order V3 C5-C Read-Only Disposable-DB Diagnosis

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_C_READ_ONLY_DIAGNOSIS_V1`
- Phase: `GYEON_ORDER_V3_C5_C_DISPOSABLE_DB_ACCEPTANCE_DESIGN`
- Mode: `READ_ONLY_DIAGNOSIS`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- C5-B source candidate commit: `1ae0f7e91f3889ea08c894bcb589bb35a15303ec`
- C5-B source candidate tree: `a6f7fde6b4b9b8c15689ccd5124f17632c6e9f92`
- Required execution HEAD: the accepted governance commit that contains this directive
- Required execution tree: the tree of that accepted governance commit
- Invocation requirement: the PR instruction must state the exact execution HEAD/tree; Claude must stop if the checked-out values differ
- Coordination PR: `#36` — must remain Draft

This directive authorizes source inspection only. It does not authorize edits, tests, database work, Docker/Colima/Supabase operations, Git mutation, PR mutation, or external-provider access.

## Required first reads

Read completely before diagnosis:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest two `GYEON-ORDER-V3-C5-*` entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md`
5. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
6. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-plan.md`
7. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-result.md`

## Literal read scope

After the required reads, inspect only these source/test/harness paths:

- `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
- `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`
- `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
- `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`
- `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
- `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`
- `scripts/e2e/gyeon-order-v3-c4/config.toml`
- `scripts/e2e/gyeon-order-v3-c4/setup.sh`
- `scripts/e2e/gyeon-order-v3-c4/schema-rls.test.sql`
- `scripts/e2e/gyeon-order-v3-c4/business-contract.test.sql`
- `scripts/e2e/gyeon-order-v3-c4/real-auth.mjs`
- `scripts/e2e/gyeon-order-v3-c4/concurrency.mjs`
- `scripts/e2e/gyeon-order-v3-c4/capture-evidence.sh`
- `scripts/e2e/gyeon-order-v3-c4/cleanup.sh`

Do not expand the read scope. If another content path is essential, return `BLOCKED_READ_SCOPE` with its exact path and reason.

## Protected paths

The following are metadata-only. Never open, read, print, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

For the four paths above, only pathname, mode, Git blob, and Git status may be reported.

## Ratified contracts

1. C5-B evidence purposes are exactly `initial_authorization`, `edit_reauthorization`, `bank_payment_match`, and `inventory_reservation`.
2. `void` and `capture` are future provider operations, not C5-B/C5-C evidence purposes.
3. Office AZ owns qualification mode and product-classification values. DealerOS only stores and consumes versioned server-owned projections.
4. No browser/MacBook writer, seed, default/fallback mode, rank/history inference, or client qualification mode/result is allowed.
5. `shop_to_detailer` stays fail-closed until shipped/unreturned purchase-history authority exists.
6. Durable compensation inserts exactly one `void_new_card_authorization` intent and returns normal failure JSON; raising after insert is forbidden because it would roll back the intent.
7. Warehouse release creates one existing `unaccepted` task only after payment, supply, reservation/backorder, and calendar authorities are ready. Warehouse accept consumes it and never first-inserts it.
8. Office AZ inventory implementation remains Mac Studio-owned and outside this phase.
9. C5-C uses a fresh loopback-only PostgreSQL 17 disposable runtime outside the Git worktree and outside `/private/tmp`.
10. Any failed suffix/evidence set is burned and never repaired or rerun into acceptance.

## Required diagnosis

### A. Exact object and signature inventory

Report every C5-B-added/changed:

- public/private table, constraint, index, policy, grant;
- private helper and public RPC exact signature;
- security mode, search path, caller role;
- read/write relation set;
- lock acquisition order;
- idempotency and unique identity.

### B. Executable success and failure paths

Map exact prerequisites and expected result/code for:

- qualification mode missing, stale, error, none, shop initial, detailer initial, shop-to-detailer;
- evidence missing, wrong purpose/provider/order/version/fingerprint/amount/currency, expired, consumed, failed, unknown;
- owner-submit prepare/finalize;
- pre-warehouse edit prepare/finalize with changed and unchanged card amounts;
- durable compensation;
- warehouse release and warehouse accept.

Identify branches that cannot currently be reached with only server-owned disposable fixtures.

### C. Defect audit before harness implementation

Decide whether source repair is required before C5-C execution. Examine at least:

1. Whether multiple product-classification versions can be mixed in one qualification evaluation while the snapshot stores only one version.
2. Whether qualification snapshots are immutable enough for replay/audit, including upsert behavior and fingerprint/version rebinding.
3. Whether prepared operation expiry/version/fingerprint conflict can durably create compensation without consuming or corrupting the wrong evidence.
4. Whether every normal-JSON compensation path is exactly-once under concurrent replay.
5. Whether release consumes or validates `bank_payment_match` and `inventory_reservation` evidence correctly for every payment method.
6. Whether warehouse task creation/acceptance and cancellation share a deterministic lock order.
7. Whether any public `SECURITY DEFINER` retains an unintended caller or any authority table is reachable through inherited/default grants.
8. Whether the terminal guarded SQL can be derived by exactly one `ROLLBACK`→`COMMIT` replacement after the formal migration chain.

For each finding return `PASS`, `SOURCE_DEFECT`, `UNREACHABLE_EXPECTED_STUB`, or `C5C_HARNESS_REQUIREMENT`, with path and line range.

### D. C4 harness reuse map

For every C4 harness file in scope, classify:

- reuse structure unchanged;
- copy pattern into new C5-C file;
- prohibited to reuse because it asserts superseded C4 signatures/behavior;
- cleanup dependency requiring extension.

Do not edit C4 evidence assets.

### E. Exact C5-C harness allowlist

Review the proposed ten paths in the C5-C plan. Return:

- exact minimal later write allowlist;
- path additions/removals with reason;
- exact approved command sequence for static harness verification only;
- exact later disposable execution sequence;
- exact stop/burn points.

### F. Real Auth and concurrency matrix

Give a row-by-row matrix for:

- principal/token;
- HTTP/RPC/table action;
- expected HTTP status and database result;
- fixture prerequisites;
- secret-safe evidence fields.

For each required race, specify the two independent connection operations, third observer query, expected winner/loser, invariant counts, and timeout/deadlock interpretation.

### G. Fixture and cleanup dependency order

List exact creation and deletion order for every dealer, auth user, membership, product, offer, supply projection, qualification projection/rule/classification, order/item, prepared operation, evidence, snapshot, compensation, notification, and warehouse task fixture. Report every FK/trigger-created dependent that must be cleaned first.

## Prohibitions

- No file write, formatting, report persistence, or generated file.
- No tests, typecheck, lint, build, script execution, package command, or dependency action.
- No Supabase CLI, Docker, Colima, psql, database connection, SQL execution, migration derivation/application, pgTAP, Auth token creation, HTTP request, or network/provider call.
- No Git add/commit/push/branch/checkout/stash/restore/cleanup.
- No PR comment, Ready conversion, merge, deployment, environment access, or secret inspection.
- No Office AZ inventory implementation or provider-specific design invention.

Read-only shell commands may only identify HEAD/tree/status, list the literal read-scope paths, and print allowed content. Do not run repo-wide searches that may surface protected content.

## Required result

Return `GYEON_ORDER_V3_C5_C_READ_ONLY_DIAGNOSIS_RESULT_V1` with:

1. `verdict`: `READY_FOR_HARNESS_IMPLEMENTATION`, `CHANGES_REQUIRED_SOURCE`, or `BLOCKED_READ_SCOPE`.
2. confirmed branch/HEAD/tree and clean/dirty state.
3. protected metadata-only confirmation.
4. complete object/signature/lock inventory.
5. success/failure path matrix.
6. defect audit with path/line evidence.
7. C4 reuse map.
8. exact minimal C5-C harness allowlist.
9. exact static verification commands.
10. exact disposable execution order and stop/burn points.
11. real Auth matrix and concurrency matrix.
12. fixture/cleanup dependency order.
13. known limitations and external-authority blockers.
14. explicit confirmation of zero writes/tests/DB/network/Git/PR actions.

Return only to the invoking Codex session. Do not post to GitHub and do not persist a result file.
