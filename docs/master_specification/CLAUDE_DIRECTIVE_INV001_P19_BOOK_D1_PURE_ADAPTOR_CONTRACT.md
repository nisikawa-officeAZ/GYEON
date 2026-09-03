# Claude Directive — INV001-P19 Book D1 Pure Adaptor Contract

## 1. Identity

- Directive: `INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT_V1`
- Diagnosis result marker: `INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT_DIAGNOSIS_RESULT_V1`
- Implementation result marker: `INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT_IMPLEMENTATION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `8516506fe700348b4e8436fbc6d53ce44747ca2e` / `e341a26719354cbdc193d6414e0175771b67d05f`
- Proposed dedicated branch: `agent/inv001-p19-book-d1-pure-adaptor-contract`
- C3 governance PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/55`
- Foundation repository: `nisikawa-officeAZ/detaileros-inventory-foundation`
- Fixed Foundation commit/tree: `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e` / `c2e925295e1e0384010e6744a5c7ec15cb7668a1`
- Current mode: governance candidate only; no private-source transmission, Claude invocation, implementation, or test is authorized by this file's creation

D1 defines the smallest Book-owned pure TypeScript adaptor contract for the sealed Foundation V2 inventory runtime. It must preserve Foundation authority and must not install or invoke the private package, access persistence, expose a route, or alter a UI.

## 2. Binding Owner Decisions

1. Office AZ is the sole inventory owner and Foundation V2 is the canonical inventory contract/runtime authority.
2. Runtime delivery is a private immutable GitHub Packages artifact, executed by Book server code only.
3. Durable state will use new Foundation-specific tables in the existing DealerOS Supabase environment through a later authorized persistence adaptor.
4. Foundation immutable product ID is canonical; Book later owns a one-to-one mapping to `gyeon_products.id`. JAN/SKU are evidence only.
5. Existing Book Office AZ pure cores remain non-authoritative compatibility code until verified cutover and must not become fallback-success or dual-write paths.
6. D1 may define an injected runtime port and boundary types only. Foundation business calculations and state transitions remain Foundation-owned.

## 3. Two Separate D1 Gates

### Gate A — read-only contract diagnosis

After a separate Owner authorization for the exact private files, Claude may perform one tool-disabled, read-only diagnosis. It must extract the minimum adaptor type surface and test matrix from the fixed Book and Foundation evidence. It may not edit or execute tests.

### Gate B — three-file implementation candidate

Only after MacBook Codex accepts Gate A and the Owner separately authorizes implementation may Claude edit the exact three D1 source paths in Section 7 and run only the approved checks in Section 9. Gate B does not authorize stage, commit, push, PR mutation, package installation, DB work, or deployment.

Gate A authorization never implies Gate B authorization.

## 4. Gate A Invocation Preconditions

Before receiving private content, Claude must verify from the supplied evidence:

1. PR #55 is merged into `main` and the supplied Book fixed base matches Section 1.
2. The newest non-superseded instruction names this directive and Gate A's exact result marker.
3. The execution HEAD/tree and the path/mode/blob/SHA-256 manifest for every transmitted file are supplied and mutually consistent.
4. The Foundation fixed commit/tree match Section 1.
5. Separate explicit Owner authorization exists for exactly the private files actually transmitted.
6. No protected-path content, environment file, secret, migration, generated artifact, or unlisted source is supplied.

If any condition fails, return `BLOCKED_GOVERNANCE_PRECONDITION` and stop.

## 5. Exact Book Private Read Allowlist for Gate A

Claude may receive exactly these 13 Book files and no others:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
8. `package.json`
9. `src/lib/inventory/inventory-types.ts`
10. `src/lib/inventory/office-az-inventory-core.ts`
11. `src/lib/inventory/office-az-inventory-core.test.ts`
12. `src/lib/inventory/office-az-channel-contracts-core.ts`
13. `src/lib/inventory/office-az-channel-contracts-core.test.ts`

The two legacy cores and their tests are comparison evidence only. D1 must not modify, import as Office AZ authority, or expand them.

## 6. Exact Foundation Private Read Allowlist for Gate A

Claude may receive exactly these 4 Foundation files at the fixed Foundation commit and no others:

1. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.md`
2. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.json`
3. `docs/audits/SPEC_INVENTORY_001_P19_POST_P18_FOUNDATION_RELEASE_MANIFEST_AND_BOOK_HANDOFF.md`
4. `docs/adr/0075-spec-inventory-001-post-p18-foundation-release-manifest-and-book-handoff.md`

No Foundation implementation, tests, migration, draft SQL, package output, dependency, lockfile, environment file, or generated artifact may be supplied.

## 7. Exact Gate B Implementation Allowlist

Gate B may create and edit exactly these three Book paths and no others:

1. `src/lib/inventory/foundation/foundation-adaptor-types.ts` (new)
2. `src/lib/inventory/foundation/foundation-adaptor-core.ts` (new)
3. `src/lib/inventory/foundation/foundation-adaptor-core.test.ts` (new)

No existing source file may be modified in D1.

## 8. Required Pure Adaptor Contract

Gate A must determine the exact type names and Gate B must implement the accepted form while preserving all rules below:

1. **Pure injected boundary.** The adaptor receives a runtime port as an injected value. It contains no package import, dynamic import, network, DB, Supabase, environment, filesystem, clock, randomness, global mutable state, React, or Next.js dependency.
2. **No rule duplication.** Book does not recalculate available quantity, reservation effects, transfer effects, stocktake variance, shipment transitions, or any Foundation state machine.
3. **Literal command preservation.** The adaptor supports the 18 sealed commands without renaming, merging, or auto-chaining them: `authorize_with_evidence`, `receive_supplier_shipment`, `adjust_inventory`, `reserve`, `cancel_reservation`, `confirm_shipment`, `open_fulfillment`, `pick_fulfillment`, `pack_fulfillment`, `ship_fulfillment`, `return_fulfillment`, `restock_fulfillment`, `request_transfer`, `dispatch_transfer`, `receive_transfer`, `stocktake_open`, `stocktake_finalize_line`, and `stocktake_complete`.
4. **Snapshot separation.** `INV001-P18_RUNTIME_SNAPSHOT_V3` remains distinct from historical compatibility imports and CSV surfaces. D1 must not invent a combined API.
5. **Opaque canonical identity.** Foundation product, owner, location, actor, operator, request, idempotency, aggregate, version, evidence, and recovery identifiers remain explicit opaque boundary values. Book catalogue mapping is not implemented in D1.
6. **Actor/operator distinction.** Actor and operator may not be collapsed into one field or silently defaulted to each other.
7. **Fail-closed result.** Missing/ambiguous identity, stale version, unsupported contract version, invalid command, authorization denial, replay conflict, partial/unknown runtime result, and malformed recovery evidence return an explicit typed failure. No empty object, zero quantity, local fallback, or guessed success is allowed.
8. **No automatic workflow coupling.** `confirm_shipment` must not automatically call `ship_fulfillment` or any other command.
9. **Deterministic forwarding.** The adaptor may validate boundary shape and forward a command once. It must not retry, reorder, batch, reconcile, or mutate command meaning.
10. **Audit-safe output.** Success and failure preserve the minimum request/version/evidence correlation required by the Foundation contract without exposing secrets or inventing persistence.
11. **Compatibility isolation.** D1 imports neither legacy Book Office AZ core and provides no fallback to them.
12. **Server-only intent.** Types and exports must make later server-only consumption possible, but D1 itself must not use server framework APIs or claim runtime/package availability.

If the supplied Foundation documents do not prove an exact field or behavior, Gate A must mark it `NOT_PROVEN` and propose a fail-closed type boundary rather than inventing it.

## 9. Gate B Approved Verification

After separate Gate B authorization, Claude may run only:

1. `node --import tsx --test src/lib/inventory/foundation/foundation-adaptor-core.test.ts`
2. `npx tsc --noEmit`
3. `git diff --check -- src/lib/inventory/foundation/foundation-adaptor-types.ts src/lib/inventory/foundation/foundation-adaptor-core.ts src/lib/inventory/foundation/foundation-adaptor-core.test.ts`
4. read-only Git status/diff-stat/path/mode/blob checks limited to the exact D1 allowlist and protected-path metadata

No install, package resolution update, build, lint, broad formatter, DB, HTTP, provider, or UI test is authorized. If existing dependencies are unavailable, report `BLOCKED_ENVIRONMENT`; do not install them.

## 10. Gate A Required Result

Return one result headed `INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT_DIAGNOSIS_RESULT_V1` containing:

1. verdict `PASS_CONTRACT_READY`, `CHANGES_REQUIRED_READ_SCOPE`, or `BLOCKED_GOVERNANCE_PRECONDITION`;
2. verified Book/Foundation identities and exact files received with SHA-256 attestations;
3. the exact proposed exports for the types file and core file;
4. one command-envelope mapping row for each of the 18 literal commands;
5. the snapshot/query boundary kept separate from command, historical import, and CSV surfaces;
6. explicit success/failure unions and the fail-closed classification matrix;
7. actor/operator, owner/location, product identity, request/idempotency, version, evidence, and recovery bindings;
8. a focused test matrix proving no rule duplication, no automatic chaining, one-call forwarding, no retry, no fallback, and rejection of partial/unknown results;
9. any unproven field or behavior marked `NOT_PROVEN`, with no guessed implementation;
10. confirmation that Gate B's three paths are sufficient or an exact `CHANGES_REQUIRED_READ_SCOPE` explanation without editing;
11. zero-action confirmation and final worktree/index state.

Stop after Gate A result. Do not implement until Codex acceptance and separate Owner authorization.

## 11. Gate B Required Result

After separate authorization, return one result headed `INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT_IMPLEMENTATION_RESULT_V1` containing:

1. verdict `PASS_CANDIDATE_READY`, `CHANGES_REQUIRED_CONTRACT`, or `BLOCKED_ENVIRONMENT`;
2. exact execution HEAD/tree and clean pre-edit state;
3. exact changed paths, proving they equal the three-path allowlist;
4. concise implementation mapping to every accepted Gate A contract item;
5. raw exit status and summary for each approved command;
6. protected-path metadata before/after and confirmation of no content access;
7. final unstaged/uncommitted diff summary and worktree/index state;
8. confirmation of zero package, DB, Supabase, route, UI, Android, provider, deployment, or production action.

Stop with the candidate unstaged and uncommitted.

## 12. Protected Paths

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 13. Absolute Prohibitions

- No private-source transmission or Claude invocation without a separate explicit Owner gate.
- No package publication/install, `.npmrc`, dependency, lockfile, registry, token, or GitHub Packages access.
- No migration, SQL, DB, Supabase, RLS, RPC, backfill, direct CRUD, provider, Vercel, HTTP route, deployment, staging, or production action.
- No UI, legacy-core, product-mapping, Android, Studio, or Foundation repository edit.
- No dual-write, shadow-write, fallback-to-local, source copying, business-rule reimplementation, implicit retry, guessed success, or destructive action.
- No stage, commit, push, PR mutation, Ready conversion, merge, tag, or release in either Gate A or Gate B.
- No sub-agent, delegation, environment/secret read, secret request/output, or scope expansion.

## 14. Exit Gate

D1 is not complete when this directive is created. The required sequence is:

1. verify and deliver the exact three-path governance candidate;
2. separately authorize and execute Gate A once;
3. independently accept Gate A;
4. separately authorize Gate B;
5. independently verify the unstaged three-file candidate;
6. separately authorize stage/local commit, then normal push/Draft PR, Ready, and merge.

D1 completion authorizes no D2 package consumer, D3 persistence/mapping, D4 route, D5 UI, D6 runtime verification, D7 retirement, Android, staging, or production work.
