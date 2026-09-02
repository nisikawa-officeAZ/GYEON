# Claude Directive — INV001-P19 Book C1 Foundation V2 Consumer-Binding Read-only Diagnosis

## 1. Identity

- Directive: `INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS_V1`
- Required result marker: `INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Proposed dedicated branch: `agent/inv001-p19-book-c1-foundation-v2-consumer-binding-diagnosis`
- Fixed Book source commit: `f75242a1e79bb0dc6c18926cf8a004874d4ec278`
- Fixed Book source tree: `82981feb3e26d2bc70db2c11cf708063e56d6ccd`
- Foundation repository: `nisikawa-officeAZ/detaileros-inventory-foundation`
- Fixed Foundation source commit: `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e`
- Fixed Foundation source tree: `c2e925295e1e0384010e6744a5c7ec15cb7668a1`
- Mode: one bounded cross-repository private-file read-only diagnosis; zero edits and zero executable tests

This phase determines the smallest safe Book-side consumer/adaptor boundary for the accepted Foundation V2 inventory runtime. It does not authorize implementation. Foundation remains the sole Office AZ inventory authority. Book remains responsible only for its own later server integration, UI integration, authentication, and consumer operation.

Creating or committing this directive does not authorize transmitting private files to Anthropic. A later Claude invocation requires separate explicit owner authorization for the exact private read allowlist below.

## 2. Governing Status and Non-negotiable Boundary

Treat the fixed Foundation release as `FOUNDATION_HANDOFF_READY_NOT_PRODUCTION_READY`.

1. Office AZ is the sole inventory owner and Foundation is the canonical inventory contract/runtime authority.
2. Existing Book `dealer_stock_levels`, receiving, logistics, and stocktaking tables/actions are not automatically Office AZ canonical inventory.
3. Book must not create a second product master, shadow catalogue, independent Office AZ ledger, duplicated allocation rule, or competing inventory calculation.
4. Foundation hosts no live HTTP service. Delivery of its sealed runtime to Book is not configured by source presence alone.
5. Foundation draft SQL is not applied and must not be treated as live schema evidence.
6. The Foundation release does not authorize Book source changes, DB/migration work, provider configuration, Android implementation, deployment, or production use.
7. Mobile integration remains `NOT_CONFIGURED` for M1-M6 until separately decided and authorized.
8. `confirm_shipment` must not be auto-wired to `ship_fulfillment`; each command retains its own accepted contract and evidence boundary.

## 3. Invocation Preconditions

Before reading any allowed private file, Claude must verify all of the following:

1. The Book coordination PR is open and Draft, targets `main`, and uses the proposed dedicated branch or a later Codex-approved literal replacement.
2. The newest non-superseded Claude-targeted instruction names this directive and exact result marker.
3. The instruction supplies the exact execution Book HEAD/tree and preserves the fixed Book source commit as an ancestor.
4. The committed Book delta from the fixed source commit contains governance files only, with no application source, test, dependency, lockfile, migration, generated output, or protected-path content change.
5. The fixed Foundation commit/tree match Section 1.
6. Both repositories' supplied path/mode/blob manifests match the exact files to be read.
7. The Book worktree and index are clean.
8. Separate explicit owner authorization exists to transmit exactly the private files actually supplied to Anthropic.

If any precondition fails, return `BLOCKED_GOVERNANCE_PRECONDITION` and stop with zero further private-source reads, edits, tests, Git actions, DB access, or external-service access.

## 4. Exact Book Private Read Allowlist

Claude may receive and read exactly these 31 Book paths and no others:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS.md`
6. `package.json`
7. `src/lib/supabase/server.ts`
8. `src/lib/products/get-gyeon-products.ts`
9. `src/lib/inventory/inventory-types.ts`
10. `src/lib/inventory/inventory-actions.ts`
11. `src/lib/inventory/receiving-actions.ts`
12. `src/lib/inventory/office-az-inventory-core.ts`
13. `src/lib/inventory/office-az-inventory-core.test.ts`
14. `src/lib/inventory/office-az-channel-contracts-core.ts`
15. `src/lib/inventory/office-az-channel-contracts-core.test.ts`
16. `src/lib/admin/logistics/logistics-types.ts`
17. `src/lib/admin/logistics/get-logistics-inventory.ts`
18. `src/lib/admin/logistics/logistics-receiving-actions.ts`
19. `src/lib/admin/logistics/warehouse-adjustment-actions.ts`
20. `src/lib/admin/logistics/get-stock-movements.ts`
21. `src/lib/admin/logistics/stocktaking-actions.ts`
22. `src/lib/admin/logistics/stocktaking-types.ts`
23. `src/app/inventory/page.tsx`
24. `src/app/inventory/InventoryClient.tsx`
25. `src/app/admin/logistics/inventory/page.tsx`
26. `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx`
27. `src/app/admin/logistics/stocktaking/page.tsx`
28. `src/app/admin/logistics/stocktaking/StocktakingListClient.tsx`
29. `src/app/admin/logistics/stocktaking/[sessionId]/page.tsx`
30. `src/app/admin/logistics/stocktaking/[sessionId]/StocktakingSessionClient.tsx`
31. `src/app/admin/logistics/receiving/LogisticsReceivingClient.tsx`

No Book package lockfile, environment file, migration, generated artifact, unrelated order/payment/finance source, or other UI/source file is authorized.

## 5. Exact Foundation Private Read Allowlist

Claude may receive and read exactly these 10 Foundation paths at the fixed Foundation commit and no others:

1. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.md`
2. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.json`
3. `docs/audits/SPEC_INVENTORY_001_P19_POST_P18_FOUNDATION_RELEASE_MANIFEST_AND_BOOK_HANDOFF.md`
4. `docs/adr/0075-spec-inventory-001-post-p18-foundation-release-manifest-and-book-handoff.md`
5. `docs/handoffs/MOBILE_INVENTORY_API_005_BOOK_ANDROID_HANDOFF_INDEX_V1.json`
6. `docs/bound/MOBILE-INVENTORY-API-006_GOLDEN_CONFORMANCE_FIXTURES_V1.json`
7. `docs/handoffs/MOBILE_INVENTORY_API_006_BOOK_CONFORMANCE_ACCEPTANCE_V1.json`
8. `docs/handoffs/MOBILE_INVENTORY_API_007_BOOK_HANDOFF_DISPOSITION_V1.json`
9. `docs/bound/MOBILE-INVENTORY-API-007_FOUNDATION_RELEASE_MANIFEST_V1.json`
10. `docs/audits/MOBILE_INVENTORY_API_007_FOUNDATION_RELEASE_MANIFEST_AND_BOOK_HANDOFF_DISPOSITION.md`

No Foundation source implementation, test implementation, migration, draft SQL, dependency, lockfile, environment file, or other document is authorized for this C1 diagnosis.

## 6. Accepted Foundation Runtime Surface

The diagnosis must preserve these 18 sealed command names literally and must not silently merge or reimplement their business rules:

1. `authorize_with_evidence`
2. `receive_supplier_shipment`
3. `adjust_inventory`
4. `reserve`
5. `cancel_reservation`
6. `confirm_shipment`
7. `open_fulfillment`
8. `pick_fulfillment`
9. `pack_fulfillment`
10. `ship_fulfillment`
11. `return_fulfillment`
12. `restock_fulfillment`
13. `request_transfer`
14. `dispatch_transfer`
15. `receive_transfer`
16. `stocktake_open`
17. `stocktake_finalize_line`
18. `stocktake_complete`

The accepted snapshot family is `INV001-P18_RUNTIME_SNAPSHOT_V3`. Historical V1/V2 import compatibility, P13/P15 CSV contracts, and P18 `createInventoryCsvRuntime` remain separate surfaces and must not be collapsed into one invented API.

## 7. Mobile Boundary Preserved for Later Phases

The following accepted Foundation target symbols may be mapped for future consumption, but C1 must not implement Android, HTTP routes, local storage, camera scanning, authentication, offline replay, or distribution:

- `parseMobileInventoryQueryEnvelope`
- `evaluateMobileInventorySyncAndStaleGates`
- `buildMobileProductLookupResult`
- `buildMobileStockSnapshot`
- `parseMobileStocktakeScanEnvelope`
- `evaluateMobileStocktakeSessionGates`
- `parseMobileStocktakeSubmitEnvelope`
- `evaluateMobileStocktakeVarianceReview`
- `buildMobileStocktakeRecoveryHandoff`
- `parseMobileInventoryOfflineQueueItem`
- `orderMobileInventoryOfflineReplayBatch`
- `evaluateMobileInventoryReplayConflict`
- `buildMobileInventorySyncRecoveryHandoff`

Android ownership is Book/DetailerOS only after a later explicit phase. Foundation does not host routes. M1-M6 remain `NOT_CONFIGURED`, including transport, auth/claims, endpoint ownership, persistence/offline policy, device/operator UX, and signing/distribution decisions.

## 8. Required Diagnosis

Return an evidence-backed diagnosis covering every item below:

1. **Current Book inventory map.** Classify each allowed Book module as dealer-local UI/data access, Office AZ pure-contract candidate, admin logistics compatibility surface, or unrelated to the Foundation consumer bridge.
2. **Authority-conflict map.** Identify every allowed Book read/write path that uses `dealer_stock_levels`, `inventory_receipts`, `stock_movements`, stocktaking tables, or other Book-local state and explain why it must not become Office AZ canonical authority by assumption.
3. **Product-authority boundary.** Determine how Book can reference the Office AZ product identity without creating a second product master or silently treating `gyeon_products` as the Foundation canonical catalogue.
4. **Existing bridge proof.** Prove whether any package, import, generated client, route, RPC, or live HTTP bridge from Book to the fixed Foundation V2 runtime currently exists. Source absence must be reported as absence, not as proof of external runtime absence.
5. **Delivery-mechanism gap.** Identify the smallest unresolved decision needed to deliver the sealed Foundation runtime to Book. Classify it `NOT_CONFIGURED`; do not choose package copying, Git submodule, HTTP service, duplicated source, or database coupling without owner approval.
6. **Smallest server adaptor boundary.** Propose the minimum Book-owned server-only interface that can invoke or consume all 18 commands and `INV001-P18_RUNTIME_SNAPSHOT_V3` without copying Foundation rules. Separate command, query/snapshot, CSV, error, idempotency, version, and audit-evidence contracts.
7. **Compatibility plan.** Define how current Book dealer-local inventory and logistics screens remain behaviorally isolated until an authorized cutover. No dual-write, shadow-write, fallback-to-local, or silent mixed authority may be proposed as production-safe.
8. **Auth and tenancy gap.** Identify the exact actor, operator, location, dealer, role/claim, request identity, and evidence bindings required by Foundation but not proven by the allowed Book source. Mark unresolved bindings `NOT_CONFIGURED`.
9. **Error and recovery map.** Preserve fail-closed handling for stale snapshot, replay conflict, duplicate/idempotent command, partial result, transport ambiguity, authorization denial, and recovery handoff without inventing success defaults.
10. **Mobile handoff separation.** State what a future Book Android phase may consume from the 13 target symbols and 35-vector/77-binding golden set, while proving why C1 cannot authorize an Android project, Room database, camera, queue, live endpoint, or production claim.
11. **Later verification gates.** Specify the exact evidence required for a later pure adaptor unit phase, contract-conformance phase, disposable server-runtime phase, authenticated request-scope phase, migration/DB phase if any, Android phase, staging phase, and production phase. Keep each as a separate owner gate.
12. **Exact later allowlists.** Propose literal and non-overlapping allowlists for: Book pure adaptor types/tests; transport/package integration; authenticated server routes; compatibility/cutover UI; disposable verification; and Android. Label proposed new files as new. Do not authorize any allowlist.
13. **Conflict report.** Report any conflict between Book source, Book governance, Foundation V2 handoff, and the responsibility boundary. Do not resolve product-authority conflicts independently.

## 9. Protected Paths

Claude must not open, read, diff, copy, transmit, stage, or modify:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 10. Absolute Prohibitions

- No edit, formatting, generated artifact, test, typecheck, build, lint, install, package resolution, lockfile access, dependency change, or source copying.
- No stage, commit, push, fetch, pull, branch mutation, worktree creation, PR mutation, comment, Ready conversion, merge, tag, release, or deployment.
- No migration read or write, SQL execution, Supabase, DB, Docker, Colima, provider, Vercel, Android build, emulator, device, Studio mutation, or production access.
- No live HTTP/API creation or invocation and no assumption that Foundation exposes one.
- No direct use of Book-local tables as Foundation authority, no dual write, no data backfill, no product-ID remap, and no destructive action.
- No environment-file read, secret request, secret output, sub-agent, delegation, or scope expansion.

## 11. Required Result

Return one result headed by `INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS_RESULT_V1` containing:

- verdict: `PASS_DIAGNOSIS_COMPLETE`, `CHANGES_REQUIRED_READ_SCOPE`, or `BLOCKED_GOVERNANCE_PRECONDITION`;
- verified Book repository, branch, fixed source commit/tree, execution HEAD/tree, PR URL/state/Draft/base, and exact governance delta;
- verified Foundation repository and fixed commit/tree;
- exact Book and Foundation files actually read, proving they are subsets of Sections 4 and 5;
- one classification row per allowed Book inventory/logistics module actually read;
- authority-conflict, product-authority, existing-bridge, delivery-gap, adaptor, compatibility, auth/tenancy, error/recovery, mobile-separation, and governance-conflict findings;
- all unresolved external or runtime facts classified as `NOT_CONFIGURED`, never guessed;
- exact proposed later phase sequence and separate literal allowlists, with proposed new files labeled;
- SHA-256 for every private file actually read from both repositories;
- confirmation of zero edit/test/Git/PR-comment/DB/Supabase/provider/HTTP/Android/deployment/production action;
- Book worktree/index state at completion.

Stop after the result. Do not implement, test, commit, push, or contact an external service.
