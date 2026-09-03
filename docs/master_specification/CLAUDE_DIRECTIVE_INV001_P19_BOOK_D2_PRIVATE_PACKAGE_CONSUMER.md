# Claude Directive — INV001-P19 Book D2 Private Package Consumer

## 1. Identity

- Directive: `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER_V1`
- Readiness diagnosis marker: `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER_DIAGNOSIS_RESULT_V1`
- Dependency-pin result marker: `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_DEPENDENCY_PIN_RESULT_V1`
- Wrapper implementation result marker: `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_WRAPPER_IMPLEMENTATION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `79632bd0f6af769a9145e6f1c1de2b4558b23189` / `4e81f89e6bbe2b7f4e7fe839c80c20ae6deb5bb8`
- Proposed dedicated branch: `agent/inv001-p19-book-d2-private-package-consumer`
- D1 merged PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/56`
- D1 merged source commit: `cb4c5e92d480cb1211d8614efaa13d8c9e2e03b8`
- Foundation repository: `nisikawa-officeAZ/detaileros-inventory-foundation`
- Current fixed Foundation commit/tree: `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e` / `c2e925295e1e0384010e6744a5c7ec15cb7668a1`
- Proposed package identity: `@nisikawa-officeaz/detaileros-inventory-foundation`
- Current mode: governance candidate only; no private-source transmission, Claude invocation, registry access, dependency change, install, implementation, or test is authorized by this file's creation

D2 binds the accepted D1 pure adaptor to one immutable, privately published Foundation package artifact. It does not publish the Foundation package, create persistence, expose an HTTP route, alter UI, or authorize Android, staging, or production work.

## 2. Binding Architecture

1. Foundation V2 remains the canonical runtime and business-rule authority.
2. Book consumes Foundation through a private immutable GitHub Packages artifact, server-side only.
3. Book must pin one exact package version and prove its Foundation commit, tree, package integrity, and export surface. Floating ranges are prohibited.
4. D1 request/result types remain the Book-owned boundary. D2 may translate that boundary to the proven package API but may not reinterpret inventory rules or return guessed success.
5. Actor and operator remain distinct. Owner, location, product, request, idempotency, aggregate version, authorization, and recovery context must not be discarded.
6. D2 must not use an in-memory Foundation store as a production fallback. Persistent state is a later D3A gate.
7. Existing Book Office AZ inventory cores remain non-authoritative compatibility code and may not be imported, dual-written, or used as fallback-success paths.

## 3. Current Blocking Preflight

At directive creation, the fixed Foundation `package.json` proves all of the following:

- package name is `detaileros-inventory-foundation`, not the ratified scoped identity;
- version is `0.1.0`;
- `private` is `true`;
- no `main`, `exports`, `types`, `files`, or build/publish script is declared;
- no compiled immutable package artifact or GitHub Packages publication evidence is part of the accepted P19 handoff.

Therefore D2 dependency installation and wrapper implementation are currently blocked. The first D2 action is a read-only readiness diagnosis after the caller supplies independently verified publication evidence. Claude must not repair or publish Foundation from Book.

The minimum prerequisite is a separate Foundation-owned publication phase proving:

1. the exact scoped package name is available and published privately;
2. an immutable exact semantic version maps to one Foundation commit and tree;
3. package tarball integrity, provenance/SBOM, file catalogue, declarations, and server runtime entry point;
4. the package exports the exact runtime command, audit, snapshot export/import, and recovery surfaces required by D1;
5. consumer installation and rollback evidence without committed credentials;
6. no draft SQL, migration, secret, test-only fixture, or unrelated source is shipped unintentionally.

## 4. Separate D2 Gates

### Gate A — tool-disabled read-only package compatibility diagnosis

After separate Owner authorization for the exact private files and artifact metadata, Claude may perform one read-only diagnosis. It must decide whether the published immutable package can implement the D1 `FoundationPort` without rule duplication, context loss, persistence guessing, or source copying.

Gate A may return only:

- `PASS_PACKAGE_CONTRACT_READY`
- `BLOCKED_FOUNDATION_PACKAGE_UNPUBLISHED`
- `CHANGES_REQUIRED_PACKAGE_EXPORT`
- `CHANGES_REQUIRED_READ_SCOPE`
- `BLOCKED_GOVERNANCE_PRECONDITION`

Gate A authorizes no edit, install, registry request, or executable test.

### Gate B1 — registry declaration and exact dependency pin

Only after Gate A acceptance and separate Owner authorization may Claude modify `.npmrc`, `package.json`, and `package-lock.json`. Registry access and lockfile generation are external actions and require a separate explicit gate. No token may be requested for chat output, read from a file, written to Git, or printed.

### Gate B2 — server-only package wrapper

Only after Gate B1 is independently accepted and the exact installed artifact is proven may Claude create the wrapper and focused test. Gate B2 may not change package metadata, persistence, route, UI, Android, or Foundation source.

Gate A, Gate B1, and Gate B2 never imply one another. Stage, commit, push, Ready, merge, deployment, DB, staging, and production remain later separate gates.

## 5. Gate A Preconditions

Before Claude receives private content, MacBook Codex must supply and verify:

1. Book `main` contains D1 merge commit `79632bd0f6af769a9145e6f1c1de2b4558b23189` and the supplied execution HEAD/tree are fixed.
2. D1's three source files match the merged blobs and D1 tests/typecheck passed.
3. Foundation publication has a merged, immutable commit/tree separate from the current blocking preflight.
4. GitHub Packages metadata proves the exact private package identity, exact version, tarball integrity, published time, and source commit/tree binding.
5. The package file catalogue and declaration/export evidence are supplied without registry credentials or secrets.
6. Separate explicit Owner authorization exists for every private file actually transmitted.
7. No protected-path content, environment file, token, migration, draft SQL, generated secret, or unlisted source is supplied.

If items 3–5 are absent, return `BLOCKED_FOUNDATION_PACKAGE_UNPUBLISHED` without requesting broad source access.

## 6. Exact Book Private Read Allowlist for Gate A

Claude may receive exactly these 13 Book files and no others:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
8. `package.json`
9. `package-lock.json`
10. `tsconfig.json`
11. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
12. `src/lib/inventory/foundation/foundation-adaptor-core.ts`
13. `src/lib/inventory/foundation/foundation-adaptor-core.test.ts`

`.npmrc` does not exist at the fixed Book base. Only its absence may be reported until Gate B1.

## 7. Exact Foundation Private Read Allowlist for Gate A

Claude may receive exactly these 13 Foundation files from the separately accepted publication commit and no others:

1. `package.json`
2. `package-lock.json`
3. `tsconfig.json`
4. `src/index.ts`
5. `src/runtime/index.ts`
6. `src/runtime/inventoryRuntimePorts.ts`
7. `src/runtime/inventoryCommandDispatch.ts`
8. `src/runtime/inventoryRuntimeAudit.ts`
9. `src/runtime/inventoryRuntimeSnapshot.ts`
10. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.md`
11. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.json`
12. `docs/bound/SPEC_INVENTORY_001_FOUNDATION_RELEASE_MANIFEST_V1.md`
13. `docs/bound/SPEC_INVENTORY_001_FOUNDATION_RELEASE_MANIFEST_V1.json`

The caller must additionally supply non-secret registry metadata, package tarball SHA-512/integrity, package file catalogue, declaration/export catalogue, provenance/SBOM reference, and the publication commit/tree binding. No Foundation implementation outside the list may be transmitted.

## 8. Exact D2 Change Allowlist

D2 as a whole may change only these five Book paths, split by gate:

### Gate B1

1. `.npmrc` (new; registry declaration only, never a token)
2. `package.json`
3. `package-lock.json`

### Gate B2

4. `src/lib/inventory/foundation/foundation-runtime-package.ts` (new)
5. `src/lib/inventory/foundation/foundation-runtime-package.test.ts` (new)

The three D1 files are read-only in D2. No path may move between B1 and B2 without a later Owner-approved directive correction.

## 9. Gate A Required Diagnosis

Gate A must produce:

1. exact Book/Foundation execution identities and complete received-file hashes;
2. exact package identity, version, integrity, source commit/tree, registry visibility, and file catalogue;
3. exact package `exports`/`types`/server entry points and Node/TypeScript module compatibility with Book;
4. one mapping row for each D1 port surface: command, audit read, snapshot V3 export, V1/V2/V3 import, and recovery-evidence evaluation;
5. one mapping row for all 18 sealed commands, with no renaming or automatic chaining;
6. proof that actor/operator and every applicable identity/version/evidence field reaches the package API unchanged or an exact fail-closed blocker;
7. the required injected store/persistence interface, explicitly marking D3A-dependent behavior and prohibiting in-memory fallback;
8. a closed conversion matrix from package results/errors to D1 outcomes, with raw error/secret leakage prohibited;
9. exact proposed exports for `foundation-runtime-package.ts` and the focused test matrix;
10. confirmation that B1 and B2 allowlists are sufficient or the minimum literal additional read scope;
11. zero-action confirmation and final Git state.

## 10. Gate B1 Contract

If separately authorized:

1. `.npmrc` may contain only `@nisikawa-officeaz:registry=https://npm.pkg.github.com` and non-secret npm behavior required by the accepted diagnosis.
2. No `_authToken`, credential interpolation committed as application data, literal token, username, email, or secret-bearing URL may be written.
3. `package.json` must pin the exact accepted package version without `^`, `~`, tag, branch, Git URL, workspace, file path, or wildcard.
4. `package-lock.json` must resolve the exact private registry artifact and accepted integrity.
5. Installation must use ephemeral environment-provided authentication without printing its value. Missing authentication returns `BLOCKED_REGISTRY_AUTH`; it must not trigger a workaround.
6. No lifecycle script may mutate Book, Foundation, DB, provider, or deployment state.

## 11. Gate B2 Wrapper Contract

If separately authorized:

1. Import only the exact pinned Foundation package and the sibling D1 types.
2. Enforce server-only consumption and expose no client-compatible secret or package object.
3. Implement all five D1 port methods and preserve complete validated request context.
4. Dispatch every command exactly once. No retry, batching, reordering, reconciliation, or `confirm_shipment` to `ship_fulfillment` chaining.
5. Do not calculate inventory, reservation, transfer, stocktake, shipment, or recovery rules in Book.
6. Require the accepted runtime/store dependency explicitly; never create an in-memory, legacy-core, empty-object, zero-quantity, or guessed-success fallback.
7. Convert only proven package outcomes to the closed D1 port union. Unknown, partial, malformed, stale, denied, replay-conflict, invalid-recovery, thrown, or rejected results fail closed with sanitized output.
8. Do not access DB, Supabase, filesystem, network, environment, clock, randomness, React, Next.js route/UI, Android, or global mutable state in the wrapper.

## 12. Approved Verification by Gate

### Gate A

No executable command. Tool-disabled diagnosis only.

### Gate B1

The later authorization must state the exact package-manager command, accepted package version, non-secret registry host, and credential injection method. At minimum verify:

- exact dependency and lockfile integrity;
- package file/declaration/export catalogue against publication evidence;
- `npm ls --depth=0` or an accepted equivalent without update;
- `npm run typecheck`;
- `git diff --check` limited to the three B1 paths;
- token/credential absence scan limited to the three B1 paths.

### Gate B2

After separate authorization, run only the exact focused wrapper test, D1 regression test, `npm run typecheck`, and `git diff --check` limited to the two B2 paths. The later Gate A result must provide the literal focused command before execution.

No broad install, update, audit-fix, formatter, build, DB, HTTP, provider, UI, Android, deployment, staging, or production action is implied.

## 13. Required Results

### Gate A

Return one result headed `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER_DIAGNOSIS_RESULT_V1` with the verdict, manifests, mapping matrices, blockers, exact B1/B2 recommendation, and zero-action statement.

### Gate B1

Return one result headed `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_DEPENDENCY_PIN_RESULT_V1` proving exact version/integrity, exact three changed paths, raw verification statuses, credential non-disclosure, and final unstaged/uncommitted state.

### Gate B2

Return one result headed `INV001_P19_BOOK_D2_PRIVATE_PACKAGE_WRAPPER_IMPLEMENTATION_RESULT_V1` proving exact two changed paths, five-surface and 18-command mapping, raw verification statuses, protected metadata, and final unstaged/uncommitted state.

## 14. Protected Paths

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 15. Absolute Prohibitions

- No Foundation package publication or Foundation repository edit from Book.
- No registry/package access before a separate explicit Owner gate.
- No credential, environment file, token, keychain, npm login state, or secret output.
- No floating dependency, Git dependency, submodule, copied/vendored Foundation source, live Foundation HTTP invention, or database-mediated rule duplication.
- No D3 persistence/migration/mapping, D4 route/auth, D5 UI, D6 disposable/staging proof, D7 retirement, Android, provider, deployment, staging, or production action.
- No legacy-core fallback, in-memory production fallback, dual-write, shadow-write, automatic reconciliation, retry, guessed success, or business-rule reimplementation.
- No stage, commit, push, PR mutation, Ready, merge, tag, or release within Gate A, B1, or B2.
- No sub-agent, delegation, wildcard read scope, broad repository scan by Claude, or scope expansion.

## 16. Exit Gate

D2 is complete only when:

1. Foundation separately publishes and proves the immutable private package;
2. Gate A diagnosis is separately authorized and accepted;
3. Gate B1 exact dependency pin is separately authorized, implemented, and accepted;
4. Gate B2 exact wrapper is separately authorized, implemented, and accepted;
5. stage/local commit, normal push/Draft PR, independent review, Ready, and merge are separately authorized and completed.

D2 completion authorizes no D3A persistence, D3B product mapping, D4 server route, D5 UI, D6 runtime verification, D7 retirement, Android, DB, staging, or production work.
