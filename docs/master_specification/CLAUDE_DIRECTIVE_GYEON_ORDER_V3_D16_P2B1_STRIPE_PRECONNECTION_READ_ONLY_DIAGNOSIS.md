# Claude Directive — GYEON Order V3 D16-P2B1 Stripe Pre-connection Read-only Diagnosis

## 1. Identity

- Directive: `GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS_V1`
- Required result marker: `GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Dedicated branch: `agent/gyeon-order-d16-p2b1-stripe-read-only-diagnosis`
- Fixed source base commit: `35fa921b786572d5a780dd34d45cdbab9d938260`
- Fixed source base tree: `baa4017ee17185645ac46fcea72f6fa3da13d7fe`
- Mode: one bounded private-file read-only diagnosis; zero edits and zero executable tests

This phase diagnoses the smallest safe Book-side forward correction needed before any Stripe SDK, PaymentIntent, Webhook, payment/refund database, sandbox, or deployment implementation. Claude diagnoses only. MacBook Codex independently accepts or rejects the result and defines every later implementation gate.

## 2. Invocation Preconditions

Before reading the allowed private files, Claude must verify all of the following:

1. The active coordination pull request is an open Draft PR from the dedicated branch to `main`.
2. The newest non-superseded Claude-targeted instruction on that PR names this directive and exact result marker.
3. The instruction supplies the exact execution HEAD and tree.
4. The fixed source base is an ancestor of the execution HEAD.
5. The committed delta from the fixed source base contains exactly these governance paths:
   - `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
   - `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
   - `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS.md`
6. The worktree and index are clean.

If any precondition fails, return `BLOCKED_GOVERNANCE_PRECONDITION` with zero further source reads, edits, tests, Git actions, or external access.

## 3. Exact Private Read Allowlist

Claude may receive and read exactly these 25 private paths and no others:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B0_BOOK_PAYMENT_CONTRACT_ALIGNMENT.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS.md`
7. `docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md`
8. `docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md`
9. `docs/integrations/gyeon-order/v3-db-rpc-rls-design.md`
10. `package.json`
11. `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
12. `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`
13. `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
14. `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`
15. `src/lib/product-orders/product-order-types.ts`
16. `src/lib/product-orders/create-product-order.ts`
17. `src/lib/product-orders/update-product-order.ts`
18. `src/lib/supabase/admin.ts`
19. `src/lib/supabase/server.ts`
20. `src/app/api/line/webhook/route.ts`
21. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
22. `supabase/migrations/DRAFT_DO_NOT_APPLY/README.md`
23. `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
24. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
25. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

No package lockfile, environment value, secret, UI source, unrelated payment/accounting source, Studio repository source, or other migration is authorized for transmission or reading.

## 4. Accepted Owner Payment Contract

Treat the merged D16-P2B0 pure contract as authoritative:

1. Only the shop owner may perform final submit.
2. Create one card payment for the entire immutable tax-inclusive JPY payable order total at final submit, including back-ordered items.
3. Capture count is exactly one. Both back-order shipping policies are logistics-only.
4. JCB uses the same flow; no multicapture, delayed shipment charge, SetupIntent later charge, authorization extension, or card-brand branch.
5. Warehouse release requires exact server-verified `succeeded` full-payment evidence bound to dealer, order, version, fingerprint, amount, currency, provider payment, and provider event.
6. All post-payment item, quantity, or payable-total edits fail with `post_payment_amount_edit_forbidden`; additions require a separate order.
7. Confirmed cancellation, confirmed non-fulfillable item, or final shortage permits only an exact server-calculated partial or full refund.
8. Cumulative refunds may not exceed the validated succeeded payment. Duplicate refund operation keys fail closed.
9. If finalization fails after payment succeeds, compensation is an exact full refund, never an authorization void.
10. Existing bank-transfer, cash-on-delivery, credit-account, qualification, inventory, warehouse-calendar, and warehouse-task contracts remain unchanged except where a literal stale card branch must be separated.

## 5. Official Provider and Database Facts Supplied by MacBook Codex

Use these as diagnosis constraints; do not contact Stripe, Supabase, or any external documentation endpoint:

- Stripe recommends one PaymentIntent per order and server-side Webhook monitoring after confirmation.
- Stripe requires the unmodified raw request body and `Stripe-Signature` plus endpoint secret for signature verification; the official Stripe library is preferred.
- Stripe may redeliver the same event and does not guarantee event delivery order. Persist provider event IDs and make processing idempotent and order-independent.
- Stripe POST mutations support idempotency keys; reuse of the same key returns the first stored result, so the Book operation identity and parameter fingerprint must be stable.
- PaymentIntent metadata may carry a non-sensitive order reference for reconciliation, but no customer PII or card data belongs in metadata.
- The account and Webhook endpoint API versions must be explicitly pinned and verified later in sandbox; do not invent an exact version in this diagnosis.
- Supabase exposed tables require explicit grants and RLS. Service-role credentials remain server-only and must never be exposed through a `NEXT_PUBLIC_` variable.

## 6. Required Diagnosis

Return a line-by-line evidence-backed diagnosis covering all of the following:

1. **Stale DB contract map.** Identify every table, column, constraint, purpose enum, prepared-operation kind, function, branch, status, compensation kind, grant/policy, and source-contract assertion that still encodes authorization, reauthorization, `authorized`, or authorization voiding instead of full-payment success and refund.
2. **Existing bypass map.** Determine whether `create-product-order.ts`, `update-product-order.ts`, generic `product_orders` types, or direct Supabase CRUD can bypass the accepted V3 owner-submit/payment/RPC contract. Do not fix it.
3. **Provider adapter boundary.** Propose the smallest server-only Stripe adapter surface for PaymentIntent creation/retrieval and refund creation/retrieval, including stable idempotency keys, exact order metadata, explicit API version policy, timeouts, ambiguous-result reconciliation, and zero secret leakage.
4. **Webhook boundary.** Propose the smallest route and worker split using raw-body signature verification, immutable inbox storage, event-ID uniqueness, duplicate acceptance, unordered delivery handling, asynchronous processing, and object re-fetch/reconciliation where necessary.
5. **Persistence contract.** Define the minimum new or corrected durable records for:
   - prepared provider operation;
   - immutable Stripe Webhook inbox;
   - one succeeded full-payment record used for warehouse release and refund cap;
   - append-only refund operation/ledger with provider refund identity and exact server-calculated amount;
   - ambiguous or failed provider operations requiring manual review;
   - exact full-refund compensation after post-payment finalization failure.
6. **Atomicity and locks.** Identify the exact DB transaction/RPC boundaries for evidence consumption, payment-record linkage, owner-submit finalization, warehouse task creation, refund ledger append, and compensation outbox. No provider network call may occur while a DB lock or transaction is held.
7. **RLS/grants boundary.** State which data is service-only, what a dealer may read, what the client must never write, and the required explicit grants/RLS/test obligations.
8. **Legacy separation.** Prove that generic accounts-receivable `payments` and monthly-invoice finance artifacts are not reused as the Stripe ordering ledger and remain untouched.
9. **Forward-only migration plan.** Recommend the smallest new forward-only migration and source/test files. Do not rewrite the historical formal migration, apply SQL, or claim live schema state.
10. **Later sandbox gates.** Define the exact later evidence needed for success, decline, authentication-required, timeout/ambiguous response, retry, duplicate/unordered Webhook, partial/full refund, duplicate refund, over-refund, compensation refund, and provider/object reconciliation.
11. **Exact later allowlists.** Propose separate literal allowlists for: pure/source correction, DB migration/tests, provider adapter/Webhook, and sandbox harness. Keep implementation, test execution, commit, push, migration apply, provider configuration, and deployment as distinct owner gates.

## 7. Protected Paths

Claude must not open, read, diff, copy, transmit, stage, or modify:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only Git pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 8. Absolute Prohibitions

- No file edit, formatting, generated artifact, test, typecheck, build, lint, install, package resolution, lockfile access, or dependency change.
- No stage, commit, push, fetch, pull, branch, worktree, PR mutation, comment, Ready, merge, tag, release, or deployment.
- No Stripe API, Dashboard, CLI, account, key, Webhook endpoint, sandbox, Supabase, DB, provider, Vercel, Studio repository, or other external-service access.
- No environment-file read beyond `.env.example`; no secret-name expansion beyond what the allowed files already show; no secret value request or output.
- No sub-agent, delegation, or scope expansion.

## 9. Required Result

Return one result headed by `GYEON_ORDER_V3_D16_P2B1_STRIPE_PRECONNECTION_READ_ONLY_DIAGNOSIS_RESULT_V1` containing:

- verdict: `PASS_DIAGNOSIS_COMPLETE`, `CHANGES_REQUIRED_READ_SCOPE`, or `BLOCKED_GOVERNANCE_PRECONDITION`;
- verified repository, branch, fixed source base, execution HEAD/tree, PR URL/state/Draft/base, and exact governance delta;
- exact files actually read, proving they are a subset of the exact 25-path allowlist;
- stale-contract, bypass, provider, Webhook, persistence, atomicity, RLS/grants, legacy-separation, migration, and sandbox findings;
- exact proposed later allowlists with new files clearly labeled;
- unresolved facts classified as `NOT_CONFIGURED`, never guessed;
- SHA-256 of every allowed private file actually read;
- confirmation of zero edit/test/Git/DB/Supabase/Stripe/provider/network/deployment action;
- worktree/index state at completion.

Stop after the result. Do not implement or test.
