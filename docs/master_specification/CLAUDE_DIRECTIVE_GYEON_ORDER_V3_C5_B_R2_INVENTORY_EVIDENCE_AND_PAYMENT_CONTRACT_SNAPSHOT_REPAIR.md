# Claude Directive — GYEON Order V3 C5-B R2 Inventory Evidence and Payment-Contract Snapshot Repair

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR_V1`
- Phase: `GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR`
- Mode: `BOUNDED_SOURCE_REPAIR_AND_FOCUSED_TEST`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- Accepted source predecessor commit: `37573c3f9cc476b8d7911221a8696ee61109b9bf`
- Accepted source predecessor tree: `c94ca1944e1c2d54b5728943501fbc07edc9668a`
- Governance predecessor HEAD: `5b8624c5a30fa961268e9a4535b935a6d00e7407`
- Governance predecessor tree: `9615cd5a754a11bd14c49dce23e7ee6ee1f36b27`
- Required execution HEAD: the later accepted governance commit containing this directive
- Required execution tree: the tree of that accepted governance commit
- Coordination PR: `#36` — must remain OPEN/Draft
- Execution channel: terminal Claude only; GitHub bot invocation is prohibited

This committed directive defines a future source-repair gate only. It does not authorize external transmission or execution. Start only after a later explicit owner authorization and an invocation that states the exact accepted execution HEAD/tree. Stop if branch, HEAD, tree, source hashes, plan, ledger, or instruction identity differs.

## Mandatory first reads

Read completely before editing:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. Latest five `GYEON-ORDER-V3-C5-*` entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R1_A2_SOURCE_CORRECTION.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_C_A3_READ_ONLY_DIAGNOSIS_V2.md`
8. This directive

State the active phase, exact execution HEAD/tree, authorization boundary, three-path write allowlist, protected paths, accepted source hashes, exact repair contracts, and verification command. Stop rather than guessing if any authority conflicts.

## Required clean source baseline

The three implementation paths must start exactly as follows:

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
   - status: unchanged
   - SHA-256: `7b72c49baa7a42e56e23959bfc69919c181ba7f51b4aa186aa69edfa575015f4`
2. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`
   - status: unchanged
   - SHA-256: `990a94cdd7417de89348e5a357a33a6766ee9f6b07289cc0f89be3494852b0ba`
3. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
   - status: unchanged
   - SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`

The Git index must be empty and no tracked or untracked path may exist outside the committed governance state. If the baseline differs, return `BLOCKED_BASELINE_MISMATCH`. Do not restore, stash, clean, reset, reconstruct, or overwrite any difference.

## Literal content scope and write allowlist

Read and modify exactly these three existing implementation paths:

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

No other source, test, migration, script, configuration, dependency, document, generated file, or artifact may be opened for content or modified. Do not create, delete, rename, format, stage, or copy any other path. If another content path is essential, return `BLOCKED_ALLOWLIST` with the exact path and reason; do not broaden scope.

## Protected paths

Metadata only. Never open, read, print, diff, copy, stage, or modify content:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, Git blob, and Git status may be reported for these paths.

## Accepted A3 contracts to preserve

Preserve every accepted R1/A2/A3 contract, including:

- one identical non-null classification version across every order line;
- immutable qualification snapshots with exact canonical replay and stable conflict denial;
- bound card evidence ID plus accepted server-owned request fingerprint;
- exact card expiry, purpose, amount, currency, and consumption-operation validation;
- amount-changing card-authority replacement and amount-preserving preservation;
- finalize-time durable exactly-once compensation when a newly successful authorization cannot be attached;
- exact bank-match validation/consumption and payment-status transition;
- explicit card, bank, cash-on-delivery, and credit-account release branches;
- one `unaccepted` warehouse task and accept-as-consumption behavior;
- the single terminal `ROLLBACK` and visible `DRAFT_DO_NOT_APPLY` guard.

R2 must not redesign or weaken these accepted contracts.

## Owner-ratified payment-contract rule

This section is authoritative and replaces the earlier unresolved post-finalize credit question.

1. The first successful owner confirmation/finalize freezes one explicit server-owned payment-contract snapshot on the order.
2. The snapshot distinguishes `standard_payment` from `credit_account`. For `credit_account`, it also binds the exact dealer credit-terms version used at confirmation.
3. If active and effective credit terms govern the dealer at first finalize, only `credit_account` is valid. Card, bank transfer, and cash on delivery fail closed.
4. Credit terms activated after a standard-payment order was successfully finalized do not retroactively alter that order and do not automatically void its existing card authorization.
5. Amount-changing and amount-preserving pre-warehouse edits preserve the same payment-contract snapshot. A cancel followed by a new order performs a new first-finalize evaluation.
6. Credit-account warehouse release revalidates the exact bound terms version. Missing, stopped, expired, mismatched, or invalid bound authority fails closed.
7. A submitted order without an explicit payment-contract snapshot fails closed. Do not infer authority from the mutable current credit row, default a mode, guess a version, or auto-backfill old submitted rows.

## Required repairs

### R2-01 — exact inventory-reservation evidence and atomic one-time consumption

- For a non-backorder release, derive the expected reservation request fingerprint from server-owned order state. Do not accept a caller-supplied fingerprint, success boolean, reservation identifier, amount, or currency as authority.
- Require exactly one `inventory_reservation` evidence row bound to the same dealer, order, current order version, exact server-owned request fingerprint, amount, and currency.
- Require exact purpose, server-verified succeeded state, valid expiry, and unconsumed state.
- Lock the exact candidate with a transactionally safe row lock before deciding release.
- Consume the same row exactly once in the warehouse-release transaction before inserting the warehouse task. Bind consumption to the release/order operation so unrelated or later operations cannot reuse it.
- Zero candidate, multiple candidates, wrong dealer/order/version/fingerprint/amount/currency, wrong purpose, failed/unknown/unverified state, expired evidence, pre-consumed evidence, or wrong consumption pairing must return stable fail-closed results before task creation.
- Preserve the approved backorder authority path. A backorder release does not require a fabricated reservation-evidence row and must not search for or consume unrelated `inventory_reservation` evidence.
- Reuse an existing private evidence-validation helper only if it can satisfy this exact contract without weakening other evidence purposes. Do not expose a new browser-authoritative RPC.

### R2-02 — explicit immutable payment-contract snapshot

- Add the minimal explicit server-owned order fields and constraints required to persist the payment-contract snapshot at the first successful owner finalize.
- The representation must distinguish standard payment from credit account and bind the exact credit-terms version for credit account. Do not rely on a mutable current-row lookup as the historical contract.
- Initial finalize must lock/read the relevant terms authority, validate the requested method, and atomically write the snapshot with the successful order transition.
- Exact replay may return the already-bound contract only when canonical order/finalize inputs match. A conflicting attempt must not rewrite the snapshot.
- A later activation of dealer credit terms must leave an already-finalized standard-payment snapshot unchanged. Release continues under the original card/bank/COD contract when its original method-specific authority is valid. Do not create a card-void compensation intent solely because terms became active after first finalize.
- If the snapshot is credit account, warehouse release must revalidate the exact bound terms row/version and its current active/effective validity. Another current terms row/version is not a substitute.
- Both amount-changing and amount-preserving pre-warehouse edits preserve the snapshot. The existing payment-method-specific reauthorization behavior remains intact.
- Cancel does not mutate the historical snapshot. A separately created new order starts without a snapshot and evaluates terms at its own first finalize.
- Missing snapshot on a submitted order fails closed in edit/release paths. Do not auto-migrate, infer, or backfill old submitted data in this guarded draft.
- Add the smallest migration-safe constraints needed for internal consistency. The SQL remains a guarded draft with one terminal `ROLLBACK`; no database migration is generated or applied.

### R2-03 — deterministic hostile contract coverage

Add focused source-contract assertions that fail if any of these regressions is present:

1. inventory release accepts an existence-only evidence check;
2. evidence is not bound to exact dealer/order/current version/fingerprint/amount/currency;
3. zero, ambiguous, expired, unverified, failed, mismatched, reused, or wrongly consumed evidence can create a task;
4. release does not lock and consume the exact evidence before warehouse-task insertion;
5. backorder consumes unrelated reservation evidence;
6. first owner finalize does not write an explicit server-owned payment-contract snapshot;
7. credit-account snapshot omits the exact terms version;
8. initial active/effective credit terms permit a non-credit method;
9. later credit activation rewrites/overrides a finalized standard-payment contract or creates an automatic card-void intent;
10. amount-changing or amount-preserving edit changes/clears the snapshot;
11. credit release accepts missing, stopped, expired, or mismatched bound terms;
12. submitted missing-snapshot rows are inferred, backfilled, or released;
13. existing A3 card, bank, COD, credit, compensation, qualification, and warehouse-task contracts regress.

Preserve all 68 accepted focused assertions. The final focused count must be greater than 68 with zero failures.

## Required verification

Run exactly:

```text
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts
```

Then run `git diff --check` limited to the exact three allowlisted implementation paths. Report exact changed paths, test count, exit code, diff-check result, per-path SHA-256, execution HEAD/tree, index state, and protected metadata confirmation.

Do not run typecheck, build, lint, a full suite, any database-backed test, or any command not expressly listed above apart from read-only Git identity/status/hash checks required by this directive.

## Prohibited

- No file action outside the three-path write allowlist.
- No dependency install/update, formatter sweep, generated artifact, or harness implementation.
- No Supabase CLI/MCP, SQL/database execution, migration derivation/application, Docker, Colima, psql, pgTAP, Auth, HTTP, provider, Vercel, environment, or network action.
- No Office AZ inventory implementation, inventory API invention, PSP/PayPay Bank adapter, webhook, secret, or provider payload work.
- No Git add, commit, push, checkout, reset, restore, stash, clean, rebase, amend, branch mutation, Ready conversion, merge, or GitHub/PR comment.
- No protected-content access.

## Stop conditions

Return immediately without modifying files if:

- execution branch/HEAD/tree or source hashes differ;
- the Git index or worktree is not clean before repair;
- any required repair needs a fourth content path;
- the owner-ratified payment contract cannot be represented without inventing provider behavior or modifying Office AZ inventory authority;
- preserving an accepted A3 contract conflicts with R2;
- the exact focused command cannot be run as written.

If an allowed repair was started before a new blocker is discovered, leave only the three-path candidate diff and return `BLOCKED_ALLOWLIST` or `CHANGES_REQUIRED`; do not broaden, clean, stage, or commit.

## Required result

Return only `GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR_RESULT_V1` to the invoking MacBook Codex session with:

1. `verdict`: exactly one of `READY_FOR_CODEX_READ_ONLY_REVIEW`, `BLOCKED_ALLOWLIST`, or `CHANGES_REQUIRED`;
2. exact execution branch/HEAD/tree and starting hashes;
3. exact changed paths;
4. R2-01 inventory-evidence repair summary;
5. R2-02 payment-contract snapshot repair summary;
6. R2-03 hostile-coverage summary;
7. focused test command, exit code, and exact pass/fail count;
8. `git diff --check` result and final per-path SHA-256;
9. index state and protected metadata-only confirmation;
10. explicit confirmation of zero DB/Supabase/provider/network/Git-delivery/GitHub/release actions;
11. known limitations or blocker;
12. `next=CODEX_READ_ONLY_REVIEW_OR_BLOCKED`.

Return only to the invoking Codex session. Do not post to GitHub and do not persist a separate result file.
