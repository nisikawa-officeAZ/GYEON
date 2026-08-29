# Claude Directive — GYEON Order V3 C5-C R2-Bound Read-Only Harness Diagnosis

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_C_R2_READ_ONLY_HARNESS_DIAGNOSIS_V1`
- Phase: `GYEON_ORDER_V3_C5_C_R3_R2_BOUND_HARNESS_GOVERNANCE`
- Mode: `READ_ONLY_DIAGNOSIS`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- R2 source commit: `3403918d0166c30c44abb95bad1c8a7335877cab`
- R2 source tree: `1d1617a49bc1dd1e4b21515fec4940c3fdc4f827`
- SQL SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- RPC contract test SHA-256: `dbc7be4c08195c944eb00a0c28dc839736340b7c0df3e31ad617bdfa957a4159`
- Migration contract test SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`
- Focused source provenance: `77/77 PASS`, exit `0`, `git diff --check` PASS
- Required execution HEAD: the later accepted governance commit containing this directive
- Required execution tree: the tree of that accepted governance commit
- Coordination PR: `#36` — must remain OPEN/Draft

This committed directive defines a future read-only diagnosis only. It does not authorize external transmission or execution. Start only after a later explicit owner authorization and an invocation that states the exact accepted execution HEAD/tree. Stop if branch, HEAD, tree, source hashes, plan identity, or instruction identity differs.

## Required first reads

Read completely before diagnosis:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest C5 entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
5. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-plan.md`
6. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-result.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR.md`

## Literal read scope

After the required reads, inspect only:

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

Only pathname, mode, Git blob, and Git status may be reported.

## Required diagnosis

Return an implementation-readiness decision for the R2 source. Do not design new product behavior.

1. Confirm the exact R2 object, signature, RLS/grant, lock, and transaction inventory needed by C5-C.
2. Verify that payment-contract snapshot persistence, edit preservation, missing-snapshot fail-closed behavior, non-retroactive standard payment, and exact credit-terms-version release checks are executable in a disposable runtime.
3. Verify that non-backorder `inventory_reservation` evidence is selected as one exact dealer/order/current-version/fingerprint/amount/currency candidate, locked, consumed once before task insertion, and never consumed by the backorder path.
4. Classify every C4 harness file as `REUSE_STRUCTURE`, `COPY_PATTERN`, `SUPERSEDED_PROHIBITED`, or `CLEANUP_EXTENSION`.
5. Review the nine-path future harness allowlist below. Return additions/removals only when strictly required; do not write them.
6. Give the exact fixture dependency order, cleanup order, and the minimal server-owned success fixtures.
7. Give the exact real local GoTrue/PostgREST principal matrix and every two-connection-plus-observer race, including the two credit-activation races and inventory evidence consumption.
8. Identify any branch that cannot be tested without inventing provider behavior or implementing Office AZ inventory on MacBook.
9. Confirm that no new owner contract decision or C5-B source repair is required before harness authoring.

## Future harness candidate allowlist — review only

1. `scripts/e2e/gyeon-order-v3-c5c/config.toml`
2. `scripts/e2e/gyeon-order-v3-c5c/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql`
4. `scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql`
5. `scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql`
6. `scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
7. `scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
8. `scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh`
9. `scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`

The result document is not part of harness implementation. It belongs to a later disposable-execution result-recording gate.

## Prohibitions

- No file write, formatting, report persistence, or generated file.
- No tests, typecheck, lint, build, script execution, package command, or dependency action.
- No Supabase CLI, Docker, Colima, psql, database connection, SQL execution, migration derivation/application, pgTAP, Auth token creation, HTTP request, network call, or provider call.
- No Git add/commit/push/branch/checkout/stash/restore/cleanup.
- No PR comment, Ready conversion, merge, deployment, environment access, or secret inspection.
- No Office AZ inventory implementation or provider-specific invention.
- No content access outside the required reads and literal read scope.

Read-only shell commands may only confirm branch/HEAD/tree/status, list the literal read-scope paths, compute allowed-path hashes, and print allowed content.

## Required result

Return `GYEON_ORDER_V3_C5_C_R2_READ_ONLY_HARNESS_DIAGNOSIS_RESULT_V1` with:

1. `verdict`: exactly one of `READY_FOR_HARNESS_IMPLEMENTATION`, `CHANGES_REQUIRED_SOURCE`, `CHANGES_REQUIRED_PLAN`, or `BLOCKED_READ_SCOPE`;
2. confirmed branch/execution HEAD/tree, R2 source commit/tree/hashes, clean/dirty state, and PR OPEN/Draft state;
3. protected metadata-only confirmation;
4. exact R2 object/signature/RLS/grant/lock/transaction inventory;
5. payment-contract snapshot and inventory-evidence executable assertion map;
6. C4 reuse classification and exact future harness allowlist;
7. real Auth matrix, separate-connection race matrix, and observer assertions;
8. fixture and cleanup dependency order;
9. known external-authority limitations and stop conditions;
10. explicit confirmation of zero writes/tests/DB/network/Git/PR actions.

Return only to the invoking Codex session. Do not post to GitHub and do not persist a result file.
