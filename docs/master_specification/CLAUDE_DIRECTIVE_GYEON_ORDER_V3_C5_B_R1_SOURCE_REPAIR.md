# Claude Directive — GYEON Order V3 C5-B R1 Source-Integrity Repair

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_B_R1_SOURCE_REPAIR_V1`
- Phase: `GYEON_ORDER_V3_C5_B_R1_SOURCE_INTEGRITY_REPAIR`
- Mode: `BOUNDED_IMPLEMENTATION_AND_FOCUSED_TEST`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Diagnosed base HEAD: `33aac8f1a4e035141c2c0dc12856b7528494e09c`
- Diagnosed base tree: `c5dbf56af3ccfce99391ac81fc3ac0bbd6c76666`
- Required execution HEAD: the accepted governance commit that contains this directive
- Required execution tree: the tree of that accepted governance commit
- Invocation requirement: the PR instruction must state the exact execution HEAD/tree; stop if the checked-out values differ
- Coordination PR: `#36` — must remain OPEN/Draft
- Execution channel: terminal Claude only; never invoke or post `@claude`

The owner explicitly authorized transmission of the three private allowlisted files to Anthropic Claude Code for this repair and focused test execution. This directive does not authorize Git delivery, database work, external providers, or release.

## Mandatory first reads

Read completely before editing:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. Latest three `GYEON-ORDER-V3-C5-*` entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. This directive

State the active phase, exact execution HEAD/tree, authorization, three-path write allowlist, protected paths, and exact verification command. Stop if Git, the plan, the ledger, or the newest non-superseded PR instruction conflicts.

## Literal write allowlist

Exactly three existing files:

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

Do not create, delete, rename, format, stage, or modify any other path. Read only the allowlisted files and the required governance documents, plus these accepted pure-contract references when needed:

- `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
- `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`
- `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
- `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`

If another content path is required, return `BLOCKED_READ_SCOPE` with its exact path and reason. Do not broaden scope.

## Protected paths

Metadata only. Never open, read, print, diff, copy, stage, or modify content:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## Required repairs

### R1-01 — classification-version integrity

Repair the qualification loop so that:

- every order line resolves a non-null current server-owned `classification_version`;
- the first valid version becomes the candidate version;
- every later line must have the identical version;
- a missing version fails closed with the existing stable missing/stale authority result;
- a mixed version fails closed with one deterministic stable result;
- no last-line overwrite can become snapshot authority;
- the snapshot receives one version only after equality is proven.

Add deterministic source-contract tests for same-version success, missing-version denial, mixed-version denial, and absence of the old unconditional last-line overwrite pattern.

### R1-02 — immutable qualification snapshot replay

Remove the mutable `ON CONFLICT ... DO UPDATE` behavior. For an existing `(order_id, order_version)` snapshot:

- exact canonical replay returns or reuses the existing immutable snapshot without changing `evaluated_at`;
- dealer, evaluation mode, rule version, classification version, input fingerprint, decision, lifecycle state, and every retained canonical field must match;
- any mismatch returns one stable conflict result;
- no replay or conflict path updates, rebinds, or partially overwrites historical authority.

Add deterministic assertions for exact unchanged replay and individual canonical-field conflicts. Do not solve this with caller-authoritative replay flags or caller-supplied success.

### R1-03 — payment-method-specific warehouse release authority

Replace the payment-status blocklist with explicit fail-closed method-specific release rules while preserving the existing order lock, idempotency, supply, reservation/backorder, and one-unaccepted-task behavior.

Required behavior:

- `card`: require the accepted card authorization state/binding. If the order contains backorder and policy is `ship_available_first`, deny as the existing unresolved split-capture condition. `voided`, failed, pending, unknown, or missing authority denies.
- `bank_transfer_prepaid`: require one exact `bank_payment_match` evidence row with server-verified authority, succeeded state, unexpired status, unused state, and exact dealer/order/current version/fingerprint/amount/currency binding. Lock and consume it exactly once in the release transaction. Missing, mismatched, expired, consumed, duplicate, stale, or ambiguous evidence denies without creating a warehouse task.
- `cash_on_delivery`: continue to deny customer-direct shipping and require the already-authorized submitted-owner state. Do not invent a payment-provider fact.
- `credit_account`: require the dealer credit terms to remain configured, active, and effective at release time. If credit account is configured for the dealer, a different selected payment method must not bypass it.
- unknown payment method or payment status always denies.

Do not add PSP, PayPay Bank, webhook, signature, provider payload, token, secret, retry, email, inventory-provider, or network behavior.

Add focused source-contract tests for valid method-specific success and at least: missing/mismatched/expired/consumed bank evidence; exact one-time consumption; stopped/expired credit terms; card split-capture; voided/unknown status; and cash-on-delivery customer-direct denial.

## Required verification

Run exactly:

```text
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts
```

Then run `git diff --check` only for the three allowlisted paths. Report:

- exact changed paths;
- focused test command, count, and exit code;
- diff-check result;
- per-path SHA-256;
- HEAD/tree unchanged from the PR instruction;
- worktree status showing only the three allowlisted paths;
- protected-path metadata confirmation without content access.

## Prohibited

- No typecheck, full test suite, build, lint, install, config, generated file, or formatting sweep.
- No Supabase, SQL/database execution, migration derivation/application, Docker, Colima, Auth, HTTP, provider, Vercel, or deployment.
- No Git add, commit, push, checkout, reset, restore, stash, clean, rebase, amend, Ready, merge, or GitHub/PR comment.
- No C5-C harness authoring or execution.
- No protected content access.
- No redesign or change outside R1-01, R1-02, and R1-03.

## Required result

Return only `GYEON_ORDER_V3_C5_B_R1_SOURCE_REPAIR_RESULT_V1` to the invoking MacBook Codex session with:

1. verdict: `READY_FOR_CODEX_READ_ONLY_REVIEW` or `BLOCKED`;
2. exact execution HEAD/tree and PR state supplied by the PR instruction;
3. exact changed paths;
4. R1-01/R1-02/R1-03 repair summaries;
5. focused test evidence;
6. diff-check and per-path hashes;
7. protected metadata confirmation;
8. explicit zero DB/provider/Git/GitHub/release actions;
9. known limitations;
10. `next=CODEX_READ_ONLY_REVIEW_OR_BLOCKED`.
