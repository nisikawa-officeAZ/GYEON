# Book Directive — INV001-P19 Book C3 Owner Decision Ratification

## 1. Identity

- Directive: `INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION_V1`
- Result marker: `INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Proposed dedicated branch: `agent/inv001-p19-book-c3-owner-decision-ratification`
- C2 Draft PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/54`
- C2 fixed HEAD/tree: `81e03a381b29ce8357182317bb5890d0a76055ee` / `8ace929836ac3847bb2566dbf41f2f2cbb7d8b69`
- C2 accepted Owner decision: `https://github.com/nisikawa-officeAZ/GYEON/pull/54#issuecomment-5518304280`
- Foundation fixed commit/tree: `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e` / `c2e925295e1e0384010e6744a5c7ec15cb7668a1`
- Mode: documentation-only ratification; zero implementation and zero executable tests

C3 converts the accepted C2 Owner decisions into Book governance. It does not reopen C2, make a new architecture choice, or authorize implementation.

## 2. Ratified Owner Decisions

### 2.1 Runtime delivery

`PRIVATE_IMMUTABLE_GITHUB_PACKAGES_ARTIFACT`

1. The sealed Foundation runtime will be delivered to Book as a private immutable GitHub Packages artifact.
2. Book must pin one exact package version, Foundation commit/tree, and integrity evidence.
3. The runtime is server-only. Browser/client components and Android must not import it directly.
4. Floating versions, copied/vendored Foundation source, Git submodule drift, an invented live Foundation HTTP service, and database-mediated rule duplication are rejected.
5. The proposed package identity is `@nisikawa-officeaz/detaileros-inventory-foundation`; publication remains a separate Foundation-owned gate and the name must be verified against GitHub Packages before first publication.

### 2.2 Persistent runtime state

`EXISTING_DEALEROS_SUPABASE_WITH_DEDICATED_FOUNDATION_TABLES`

1. Durable Foundation inventory state will use new Foundation-specific tables in the existing DealerOS Supabase environment.
2. Existing Book dealer/local inventory tables are not Foundation canonical state and must not be reused, renamed, backfilled, dual-written, or silently promoted.
3. Only an authorized Book server persistence adaptor implementing the accepted Foundation contract may access the new tables.
4. Direct client/UI writes, guessed success, fallback-to-local, automatic reconciliation, and mixed authority are prohibited.
5. Migration, RLS, RPC, grants, rollback, backup, restore, and disposable Postgres verification remain separate gates.

### 2.3 Product identity

`FOUNDATION_IMMUTABLE_PRODUCT_ID_WITH_EXPLICIT_BOOK_MAPPING`

1. Foundation's immutable product ID is canonical for inventory.
2. `gyeon_products.id` remains the Book catalogue reference.
3. A Book-owned one-to-one integration mapping will relate the two IDs; it is not a second product master.
4. JAN and SKU are lookup/evidence fields only.
5. Missing, duplicate, stale, retired, changed-JAN, cross-owner same-JAN, and ambiguous mappings fail closed.

### 2.4 Existing Book pure inventory modules

`SUPERSEDE_AFTER_VERIFIED_CUTOVER`

1. `src/lib/inventory/office-az-inventory-core.ts` and `src/lib/inventory/office-az-channel-contracts-core.ts` remain non-authoritative compatibility code until cutover.
2. They must receive no new Office AZ authority and must never act as a dual-write or fallback-success path.
3. Retirement or reduction to explicitly non-authoritative helpers occurs only after package, persistence, mapping, authenticated request, disposable runtime, staging, rollback, and recovery evidence pass.

## 3. C3 Exact Change Allowlist

C3 may change exactly these three governance paths and no others:

1. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md` (new)
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

No private-source transmission or Claude invocation is required for C3.

## 4. Proposed Later Book Phases and Literal Non-overlapping Allowlists

These are proposed scopes only. Each phase requires its own directive, fixed base/HEAD, independent review, and separate Owner authorization. A path listed in one phase is not authorized in any other phase unless a later Owner-approved reconciliation explicitly moves it.

### D1 — pure adaptor contract

- `src/lib/inventory/foundation/foundation-adaptor-types.ts` (new)
- `src/lib/inventory/foundation/foundation-adaptor-core.ts` (new)
- `src/lib/inventory/foundation/foundation-adaptor-core.test.ts` (new)

No package installation, DB, route, or UI work.

### D2 — private package consumer integration

- `.npmrc` (new; registry declaration only, never a token)
- `package.json`
- `package-lock.json`
- `src/lib/inventory/foundation/foundation-runtime-package.ts` (new)
- `src/lib/inventory/foundation/foundation-runtime-package.test.ts` (new)

Foundation package publication, registry credentials, Vercel environment configuration, and deployment are separate external gates.

### D3A — Foundation persistence schema and server adaptor

- `supabase/migrations/20260903010000_foundation_inventory_runtime.sql` (new)
- `src/lib/inventory/foundation/foundation-persistence-adaptor.ts` (new)
- `src/lib/inventory/foundation/foundation-persistence-adaptor.test.ts` (new)
- `scripts/e2e/inv001-foundation-persistence-disposable.mjs` (new)

The migration must use new Foundation-specific objects, include least-privilege RLS/grants/RPC boundaries and rollback evidence, and pass a disposable PostgreSQL verification before any shared or staging apply.

### D3B — product identity mapping

- `supabase/migrations/20260903011000_foundation_product_mapping.sql` (new)
- `src/lib/inventory/foundation/foundation-product-mapping.ts` (new)
- `src/lib/inventory/foundation/foundation-product-mapping.test.ts` (new)
- `scripts/e2e/inv001-foundation-product-mapping-disposable.mjs` (new)

The mapping must enforce one-to-one uniqueness and fail closed without altering `gyeon_products` as a product master.

### D4 — authenticated server command/query boundary

- `src/lib/inventory/foundation/foundation-server-actions.ts` (new)
- `src/lib/inventory/foundation/foundation-server-actions.test.ts` (new)
- `src/app/api/inventory/foundation/route.ts` (new)
- `src/app/api/inventory/foundation/route.test.ts` (new)

Actor, operator, Office AZ owner, location, dealer/tenant, role/claims, request identity, idempotency identity, version, and authorization evidence must be explicitly bound. No client direct DB or runtime access.

### D5 — compatibility/cutover UI

- `src/app/inventory/InventoryClient.tsx`
- `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx`
- `src/lib/inventory/foundation/foundation-cutover-ui.test.ts` (new)

This phase may expose Foundation-derived state only after D1-D4 acceptance. It must not enable dual-write or fallback-to-local.

### D6 — disposable runtime and authenticated request verification

- `scripts/e2e/inv001-foundation-runtime-disposable.mjs` (new)
- `scripts/e2e/inv001-foundation-authenticated-request.mjs` (new)
- `docs/master_specification/INV001_P19_BOOK_D6_RUNTIME_VERIFICATION_EVIDENCE.md` (new)

Disposable and authenticated-request proofs remain separate evidence classes. No staging or production mutation.

### D7 — verified legacy-core retirement

- `src/lib/inventory/office-az-inventory-core.ts`
- `src/lib/inventory/office-az-inventory-core.test.ts`
- `src/lib/inventory/office-az-channel-contracts-core.ts`
- `src/lib/inventory/office-az-channel-contracts-core.test.ts`

D7 may delete or reduce these modules only after all cutover and recovery gates pass and all remaining imports are proven. It must not delete dealer-local inventory functionality outside these four paths.

### Android — deferred separate repository/project gate

No Android path is authorized or proposed because the Android project root and M1-M6 are still `NOT_CONFIGURED`. A later Android directive must identify the real project first and list every path literally with no wildcard.

## 5. Foundation Package Publication Boundary

GitHub Packages publication belongs to the Foundation repository and is not authorized by this Book directive. Studio must receive a separate Foundation-owned directive that fixes:

1. package name and scope availability;
2. export surface and compiled artifact content;
3. semantic version and immutable commit/tree binding;
4. registry authentication without committed secrets;
5. package integrity/SBOM/provenance evidence;
6. consumer compatibility and rollback evidence;
7. exact literal Foundation path allowlist.

Book must not copy Foundation implementation while waiting for the package.

## 6. Required Gates

For every later phase, keep these actions separate unless one later Owner authorization literally combines them:

1. directive/governance creation;
2. private-source transmission if required;
3. diagnosis;
4. implementation;
5. focused tests;
6. whole-suite/typecheck/diff-check where required;
7. stage and local commit;
8. normal non-force push and Draft PR;
9. independent Codex acceptance;
10. Ready conversion;
11. merge;
12. disposable DB apply;
13. staging apply;
14. production apply.

Failed disposable suffixes and evidence must not be reused. Production requires explicit rollback, backup, recovery, and Owner authorization.

## 7. Protected Paths

The following contents remain prohibited from open/read/diff/copy/transmit/stage/modify in C3:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state may be checked.

## 8. Exit Gate

C3 is complete only when:

1. the exact three-path governance diff passes `git diff --check`;
2. protected-path metadata is unchanged;
3. the Owner separately authorizes stage/local commit;
4. the committed candidate is independently verified;
5. normal push/Draft PR, Ready, and merge each remain separate gates.

Completion of C3 authorizes no D1-D7, Foundation package, DB, Android, staging, or production work.
