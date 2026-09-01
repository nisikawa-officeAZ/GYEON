# Claude Directive — GYEON Order V3 D16-P2B0 Book Payment Contract Alignment

## 1. Identity

- Directive: `GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT_V1`
- Required result marker: `GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT_RESULT_V1`
- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Dedicated branch: `agent/gyeon-order-d16-p2b0-book-contract-alignment`
- Fixed source base commit: `b79296305f60374849e983163109b5ec297379d1`
- Fixed source base tree: `102146dfe671e8fe33b60983bcbbf6fff7907688`
- Mode: bounded Book-side pure-contract implementation and focused verification

This directive authorizes no Stripe connection, provider runtime, database, migration, UI, deployment, Ready transition, or merge. Claude is the bounded implementation agent. MacBook Codex independently verifies the result and controls every later Git or release gate.

## 2. Invocation Preconditions

Before reading or editing source, Claude must verify all of the following:

1. The active coordination pull request is an open Draft PR from the dedicated branch to `main`.
2. The newest non-superseded Claude-targeted instruction on that PR names this directive and the exact result marker.
3. The instruction supplies the exact execution HEAD and tree.
4. The fixed source base above is an ancestor of the execution HEAD.
5. The committed delta from the fixed source base to the execution HEAD contains exactly these governance paths:
   - `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
   - `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
   - `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT.md`
6. The worktree and index are clean before source implementation begins.

If any precondition fails, stop with `BLOCKED_GOVERNANCE_PRECONDITION` and make zero edits.

## 3. Mandatory Reads

Read these governance sources completely before implementation:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. the latest D16-P2B0 and C5-E0 records in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. this directive
6. the newest non-superseded Claude-targeted instruction on the active Draft PR

Do not read unrelated source, SQL, migrations, UI, package metadata, environment files, or protected-file contents.

## 4. Exact Read/Write Allowlist

Claude may read and edit exactly these four source paths:

1. `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
2. `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
4. `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`

No other source path is authorized. Governance files are mandatory read-only inputs during implementation.

## 5. Accepted Owner Contract

The Book pure contract must express all of the following literally:

1. Only the shop owner can perform final submit.
2. Card payment charges and captures the entire immutable tax-inclusive payable JPY order total once at final submit, including back-ordered items.
3. Capture count is exactly one. `ship_available_first` and `ship_when_complete` are logistics choices only and never alter payment amount or capture count.
4. JCB follows the same single full-payment flow. No JCB-specific multicapture, delayed-charge, or authorization branch exists.
5. Card warehouse release requires exact server-verified succeeded-payment evidence. Authorization-only evidence, caller-owned booleans, unsigned evidence, duplicates, amount/currency/order mismatch, and out-of-order evidence fail closed.
6. Historical split capture, multicapture, shipment PaymentIntent, SetupIntent later charge, authorization extension, and edit reauthorization paths are unreachable.
7. After payment succeeds, any item, quantity, or payable-total increase or decrease is denied with the literal reason `post_payment_amount_edit_forbidden`. Additional items require a separate order.
8. A confirmed cancellation, confirmed non-fulfillable item, or final shortage may authorize only an exact server-calculated partial or full refund. Cumulative refunds must never exceed the succeeded payment amount. Duplicate refund operation keys fail closed.
9. If finalization fails after succeeded payment, compensation requires an exact full refund; it must not void a prior authorization.
10. Existing bank-transfer, cash-on-delivery, credit-account, qualification, business-calendar, inventory, warehouse-acceptance, and six-state order behavior outside the obsolete card branch must remain unchanged.

## 6. Minimum Focused Tests

The exact two test files must cover at least:

- owner versus staff final-submit behavior;
- full JPY payable amount including back-order lines;
- exactly one capture for both shipping policies;
- JCB following the same flow;
- succeeded evidence required before card warehouse release;
- rejection of authorization-only, unsigned, duplicate, mismatched, and out-of-order payment evidence;
- rejection of all historical split/multicapture/SetupIntent/authorization-extension/reauthorization paths;
- literal post-payment amount-edit denial;
- exact partial refund, exact full refund, cumulative refund cap, and duplicate refund-operation denial;
- full-refund compensation after post-payment finalization failure;
- preservation of non-card release gates and accepted order-state behavior.

## 7. Approved Commands

Run each command at most once after editing:

```bash
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/product-orders/gyeon-order-v3-contract-core.test.ts src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts
git diff --check -- src/lib/product-orders/gyeon-order-v3-contract-core.ts src/lib/product-orders/gyeon-order-v3-contract-core.test.ts src/lib/product-orders/gyeon-order-v3-external-authority-core.ts src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts
```

Do not install dependencies, regenerate lockfiles, or substitute broader test commands.

## 8. Protected and Prohibited Actions

Claude must not open, read, diff, copy, stage, or modify `src/components/ScreensPreview.tsx`. It may report only its Git blob identity if supplied by MacBook Codex. The same no-edit boundary applies to:

- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Also prohibited:

- Stripe SDK/API/Webhook implementation or network contact;
- DB, SQL, migration, Supabase, provider, environment, secrets, package, lockfile, UI, route, or deployment changes;
- Git stage, commit, push, restore, stash, cleanup, force operation, PR mutation, Ready, or merge;
- sub-agents or delegation;
- any edit outside the exact four-path allowlist.

## 9. Required Result

Return one result headed by the exact marker `GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT_RESULT_V1` and include:

- verdict: `PASS_CANDIDATE`, `CHANGES_REQUIRED`, or `BLOCKED_GOVERNANCE_PRECONDITION`;
- verified repo, branch, source base, execution HEAD, and execution tree;
- exact changed-path list and confirmation that it is a subset of the four-path allowlist;
- concise mapping of every accepted owner-contract item to code and focused tests;
- exact command, exit code, and passed/failed/skipped test counts;
- `git diff --check` result;
- SHA-256 for all four candidate files;
- worktree/index state and confirmation that nothing was staged or committed;
- confirmation of zero Stripe/provider/network, DB/Supabase/migration, package, UI, deployment, PR, Ready, or merge action;
- any residual mismatch explicitly classified for a later separately authorized DB/provider phase.

Stop after reporting. Do not stage, commit, push, or mutate the Draft PR.
