# Claude Directive — GYEON Order V3 C5-C A3-Bound Read-Only Diagnosis V2

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_C_A3_READ_ONLY_DIAGNOSIS_V2`
- Phase: `GYEON_ORDER_V3_C5_C_R2_A3_BOUND_DISPOSABLE_DB_ACCEPTANCE_DESIGN`
- Mode: `READ_ONLY_DIAGNOSIS`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- A3 source candidate commit: `37573c3f9cc476b8d7911221a8696ee61109b9bf`
- A3 source candidate tree: `c94ca1944e1c2d54b5728943501fbc07edc9668a`
- SQL SHA-256: `7b72c49baa7a42e56e23959bfc69919c181ba7f51b4aa186aa69edfa575015f4`
- RPC contract test SHA-256: `990a94cdd7417de89348e5a357a33a6766ee9f6b07289cc0f89be3494852b0ba`
- Migration contract test SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`
- Required execution HEAD: the accepted governance commit that contains this V2 directive
- Required execution tree: the tree of that accepted governance commit
- Invocation requirement: the future invocation must state the exact execution HEAD/tree; stop if checked-out values differ
- Coordination PR: `#36` — must remain OPEN/Draft

This V2 supersedes V1 only for future C5-C diagnosis. The historical V1 directive and its result remain unchanged evidence. This directive authorizes source inspection only. It does not authorize edits, tests, database work, Docker/Colima/Supabase operations, Git mutation, PR mutation, or external-provider access.

## Required first reads

Read completely before diagnosis:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest three `GYEON-ORDER-V3-C5-*` entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md`
5. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
6. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-plan.md`
7. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-result.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R1_A2_SOURCE_CORRECTION.md`

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

These paths are metadata-only. Never open, read, print, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, Git blob, and Git status may be reported for those four paths.

## Ratified contracts

1. Evidence purposes are exactly `initial_authorization`, `edit_reauthorization`, `bank_payment_match`, and `inventory_reservation`; `void` and `capture` are not evidence purposes.
2. Office AZ owns qualification mode and product-classification values. DealerOS consumes versioned server-owned projections only. No client mode/result, fallback, rank/history inference, browser writer, or MacBook writer is allowed.
3. All evaluated items must use one identical non-null classification version. Mixed or missing versions fail closed.
4. Qualification snapshot is immutable: exact replay is allowed only for identical order/version/fingerprint and canonical authority inputs; conflicting input must not mutate the prior snapshot.
5. A submitted card order must persist both the accepted evidence ID and its accepted server-owned request fingerprint. `payment_status = 'authorized'` alone is never authority.
6. Card release must revalidate dealer, order, purpose, provider, fingerprint, amount, currency, succeeded state, expiry, and the exact prepared-operation consumption pairing before warehouse-task creation.
7. Amount-changing card edit atomically replaces both authority fields with accepted `edit_reauthorization` evidence. Amount-preserving edit preserves both fields.
8. Active/effective credit terms force `credit_account`; card, bank transfer, and COD fail closed. Missing, stopped, expired, or mismatched credit authority never releases an order.
9. If credit terms become active after a new card authorization succeeds but before finalize, exactly one durable `void_new_card_authorization` compensation intent must survive the denial transaction.
10. Bank release consumes one exact `bank_payment_match` evidence; inventory release validates and consumes one exact `inventory_reservation` evidence as defined by source. Missing, stale, mismatched, expired, or reused evidence fails closed.
11. Warehouse release creates one `unaccepted` task only after all payment, supply, reservation/backorder, and calendar authorities are ready. Accept consumes an existing task and never first-inserts it.
12. C5-C uses one fresh loopback-only PostgreSQL 17 disposable runtime outside the Git worktree and outside `/private/tmp`; any failed suffix/evidence set is burned.

## Required diagnosis

### A. Provenance and exact inventory

1. Confirm branch, required execution HEAD/tree from the invocation, A3 commit/tree, the three source hashes above, clean/dirty state, and PR OPEN/Draft state.
2. Report every C5-B/A3-added or changed table, column, constraint, index, policy, grant, helper, public RPC exact signature, security mode, search path, caller role, relation set, lock order, idempotency key, and unique identity.
3. Confirm the terminal guarded SQL has exactly one derivable `ROLLBACK` to `COMMIT` change after formal migration replay.

### B. Repaired-contract regression map

For every item below, return `PASS_REGRESSION_ASSERTION_AVAILABLE`, `C5C_HARNESS_REQUIREMENT`, `SOURCE_DEFECT`, or `BLOCKED_READ_SCOPE`, with path and tight line range:

1. single classification-version enforcement;
2. qualification snapshot exact replay and conflict immutability;
3. persisted card evidence ID plus accepted fingerprint;
4. expiry and exact purpose/consumed-operation pairing;
5. amount-changing replacement and amount-preserving preservation;
6. finalize-time credit activation and durable exactly-once compensation;
7. exact payment-method release states;
8. exact bank-match and inventory-reservation validation/consumption;
9. warehouse task create/accept/cancel lock ordering.

Do not reopen items 1 and 2 as unbounded defect hypotheses. They are repaired contracts requiring hostile runtime regression evidence.

### C. High-risk post-finalize credit decision

Diagnose this exact sequence:

1. a card order finalizes successfully with valid persisted card authority;
2. active/effective credit-account terms become effective before warehouse release;
3. warehouse release is attempted.

Answer separately:

- Does release fail closed before warehouse-task insertion?
- Is the existing external card authorization left live?
- Does source create a durable, idempotent void compensation intent?
- Is a void intent required by the ratified safety model, or does that require an owner contract decision?
- What exact transaction and lock ordering prevents duplicate compensation under concurrent release/replay?

Classify this sequence as exactly one of `PASS`, `SOURCE_DEFECT`, `CONTRACT_DECISION_REQUIRED`, or `C5C_HARNESS_REQUIREMENT`. If the safe terminal state is not already defined and executable, do not recommend harness implementation.

### D. Success/failure and hostile-path matrix

Map prerequisites, caller, operation, expected code/result, mutation set, and preserved state for:

- all qualification authority states;
- all four evidence purposes and all mismatch/expiry/reuse states;
- owner-submit prepare/finalize;
- changed and unchanged pre-warehouse card edits;
- finalize-time and post-finalize credit-activation races;
- bank, card, COD, and credit warehouse release;
- inventory reservation, backorder/supply, calendar, warehouse accept, and cancellation.

Identify any branch that cannot be reached with server-owned disposable fixtures only.

### E. C4 reuse and exact future allowlist

1. Classify every C4 harness file as reuse-structure, copy-pattern, superseded/prohibited, or cleanup-extension.
2. Review the ten-path candidate allowlist in the R2 C5-C plan and return the minimal future write allowlist with additions/removals and reasons.
3. Give exact later static-verification commands, exact later disposable-execution order, and every stop/burn point. Do not run them.

### F. Real Auth, concurrency, fixture, and cleanup design

1. Provide the real local GoTrue/PostgREST matrix for owner, manager, staff, readonly, suspended, other dealer, no membership, and expired ordering membership.
2. For every required race, give two independent connection operations, the third-observer query, expected winner/loser, invariant counts, backend-PID proof, and timeout/deadlock classification.
3. Include both credit activation races: before finalize and after finalized card order but before release.
4. List exact fixture creation and deletion order, including all trigger-created dependents.
5. Keep tokens, passwords, keys, and provider payloads out of proposed evidence.

## Prohibitions

- No file write, formatting, report persistence, or generated file.
- No tests, typecheck, lint, build, script execution, package command, or dependency action.
- No Supabase CLI, Docker, Colima, psql, database connection, SQL execution, migration derivation/application, pgTAP, Auth token creation, HTTP request, network call, or provider call.
- No Git add/commit/push/branch/checkout/stash/restore/cleanup.
- No PR comment, Ready conversion, merge, deployment, environment access, or secret inspection.
- No Office AZ inventory implementation or provider-specific invention.
- No content access outside the required reads and literal read scope.

Read-only shell commands may only identify HEAD/tree/status, list the literal read-scope paths, compute/confirm hashes of those allowed paths, and print allowed content. Do not run repository-wide searches that may surface protected content.

## Required result

Return `GYEON_ORDER_V3_C5_C_A3_READ_ONLY_DIAGNOSIS_RESULT_V2` with:

1. `verdict`: exactly one of `READY_FOR_HARNESS_IMPLEMENTATION`, `CHANGES_REQUIRED_SOURCE`, `CONTRACT_DECISION_REQUIRED`, or `BLOCKED_READ_SCOPE`;
2. confirmed branch/execution HEAD/tree, A3 source commit/tree/hashes, clean/dirty state, and PR OPEN/Draft state;
3. protected metadata-only confirmation;
4. exact object/signature/lock inventory;
5. repaired-contract regression map;
6. the post-finalize credit decision and exact evidence;
7. success/failure and hostile-path matrix;
8. C4 reuse map and exact minimal future harness allowlist;
9. exact unexecuted static/disposable command sequences and stop/burn points;
10. real Auth and separate-connection concurrency matrices;
11. fixture/cleanup dependency order;
12. known limitations and external-authority blockers;
13. explicit confirmation of zero writes/tests/DB/network/Git/PR actions.

Return only to the invoking Codex session. Do not post to GitHub and do not persist a result file.
