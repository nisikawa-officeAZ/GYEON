# Claude Directive — GYEON Order V3 C5-B R1-A2 Payment-Authority Correction

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_B_R1_A2_SOURCE_CORRECTION_V1`
- Phase: `GYEON_ORDER_V3_C5_B_R1_A2_PAYMENT_AUTHORITY_CORRECTION`
- Mode: `BOUNDED_DIRTY_BASELINE_CORRECTION_AND_FOCUSED_TEST`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Governance base HEAD before A2 documentation: `e6d78156c79ecd4a5d68ad88869f09db1b654192`
- Governance base tree before A2 documentation: `5438e4c33e7445d4eaa537cb53de5e9c2e31bacd`
- Required execution HEAD: the later accepted governance commit containing this directive
- Required execution tree: the tree of that accepted governance commit
- Coordination PR: `#36` — must remain OPEN/Draft
- Execution channel: terminal Claude only; GitHub bot invocation is prohibited

This committed directive defines a future correction gate only. It does not itself authorize external transmission or execution. Start only after a later explicit owner authorization and an exact non-triggering PR instruction state the execution HEAD/tree and the accepted dirty-source hashes.

## Mandatory first reads

Read completely before editing:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. Latest four `GYEON-ORDER-V3-C5-*` entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R1_SOURCE_REPAIR.md`
6. This directive

State the active phase, execution HEAD/tree, authorization, exact dirty baseline, three-path write allowlist, protected paths, and exact verification command. Stop if Git, hashes, plan, ledger, or newest non-superseded PR instruction conflicts.

## Required dirty-source baseline

The A1 source candidate must already exist uncommitted exactly as follows:

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
   - status: modified
   - SHA-256: `8313b9d5216049672850f2ff7c5d68d73f228c82b442e6f4df48bb94fd9127a8`
2. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`
   - status: modified
   - SHA-256: `d4fb000235680fbc8d9921d9c02d75dc9f2af8673c5275b44df6aa0c9acc7eba`
3. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
   - status: unchanged
   - SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`

Stop with `BLOCKED_DIRTY_BASELINE_MISMATCH` if any path, status, or hash differs. Do not restore, stash, clean, reset, or reconstruct the baseline.

## Literal write allowlist

Exactly the same three existing implementation paths:

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

Do not create, delete, rename, format, stage, or modify any other path. Read only the allowlisted files, mandatory governance documents, and the accepted pure-contract references already permitted by the R1 directive. If another content path is required, return `BLOCKED_READ_SCOPE` with its exact path and reason.

## Protected paths

Metadata only. Never open, read, print, diff, copy, stage, or modify content:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## Accepted A1 work to preserve

- R1-01: one identical non-null classification version across all lines, with mixed/missing versions denied.
- R1-02: immutable qualification snapshots with exact replay and stable conflict denial.
- R1-03 portions already present: bank evidence exact-one locking/consumption, COD customer-direct denial, credit-term release-time lookup, card split-capture denial, and explicit method branches.

Do not redesign these accepted portions. Correct only the gaps below and add hostile coverage.

## Required corrections

### A2-01 — card authority may never be synthesized from status text

- Owner-submit finalize with `p_payment_method = 'card'` must require the exact non-null prepared operation and exact non-null evidence ID.
- The evidence must pass the existing full server-owned validation and consumption contract before `authorized` is stored.
- Persist a server-owned order-to-current-card-authority link sufficient for release-time revalidation. The link must identify the accepted evidence; do not use a browser-supplied boolean, status string, or unbound fingerprint as authority.
- Release must verify the linked evidence exists and is bound to the same dealer/order, accepted purpose, fingerprint, amount, currency, server-verified succeeded state, and expected consumption operation. Missing, stale, voided, mismatched, unconsumed, wrongly consumed, or ambiguous authority denies before any task insert.
- An amount-changing card edit that succeeds with `edit_reauthorization` must atomically replace the current link with the accepted evidence. An amount-preserving edit must preserve the existing link.
- `payment_status = 'authorized'` without the complete persistent binding must fail closed.

### A2-02 — active credit-account terms force the payment method

- At owner-submit prepare, load current dealer credit terms regardless of the requested payment method.
- If active and effective credit terms exist, only `credit_account` is accepted. Card, bank transfer, and cash on delivery return one stable fail-closed code.
- Finalize independently preserves this rule; a caller may not bypass prepare by supplying another method.
- Release independently revalidates the same rule before method-specific release. An order for an active credit dealer using a non-credit method is denied.
- If `credit_account` is selected but terms are missing, stopped, expired, not yet effective, or otherwise inactive, deny.

### A2-03 — exact payment-status allow rules

- Card: exact `authorized` status plus A2-01 bound authority.
- Bank transfer: exact pre-release `payment_pending` status plus one valid bank-match evidence. On success, consume the evidence and atomically set `payment_status = 'paid'` before task creation.
- Cash on delivery: exact `not_required` status plus owner-confirmed state and non-customer-direct destination.
- Credit account: exact `not_required` status plus active/effective forced terms.
- `voided`, `failed`, `selection_required`, `authorization_pending`, wrong-method pending/paid states, unknown, null, or any other mismatch denies before task creation.

### A2-04 — hostile source-contract tests

Add deterministic assertions that would fail if any of these regressions returns:

1. card finalize accepts null prepared/evidence IDs;
2. card release trusts only `payment_status = 'authorized'`;
3. card evidence is not persistently linked or not revalidated at release;
4. amount-changing edit does not replace the link, or amount-preserving edit clears it;
5. active credit terms permit card, bank transfer, or cash on delivery at prepare, finalize, or release;
6. stopped/expired credit terms release a credit order;
7. bank or credit release accepts `voided`, `failed`, or wrong status;
8. bank evidence consumption does not advance the status to `paid` atomically before warehouse-task insertion;
9. a warehouse task can be inserted before every A2 authority/status guard.

Preserve all 58 accepted focused assertions. The final count must be greater than 58 with zero failures.

## Required verification

Run exactly:

```text
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts
```

Then run `git diff --check` only on the three allowlisted implementation paths. Report exact changed paths, test count and exit code, diff-check, per-path SHA-256, execution HEAD/tree, and protected metadata confirmation.

## Prohibited

- No typecheck, full suite, build, lint, dependency, formatting sweep, or generated file.
- No Supabase, SQL/database execution, migration derivation/application, Docker, Colima, Auth, HTTP, provider, Vercel, deployment, or C5-C harness work.
- No Git add, commit, push, checkout, reset, restore, stash, clean, rebase, amend, Ready, merge, or GitHub/PR comment.
- No protected-content access and no action outside A2-01 through A2-04.

## Required result

Return only `GYEON_ORDER_V3_C5_B_R1_A2_SOURCE_CORRECTION_RESULT_V1` to the invoking MacBook Codex session with:

1. verdict: `READY_FOR_CODEX_READ_ONLY_REVIEW` or `BLOCKED`;
2. exact execution HEAD/tree and starting dirty hashes;
3. exact changed paths;
4. A2-01/A2-02/A2-03/A2-04 summaries;
5. focused test evidence and exact test count;
6. diff-check and final per-path hashes;
7. protected metadata confirmation;
8. explicit zero DB/provider/Git/GitHub/release actions;
9. known limitations;
10. `next=CODEX_READ_ONLY_REVIEW_OR_BLOCKED`.
