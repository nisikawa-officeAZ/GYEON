# Claude Directive — INV001-P20D2 Book D3A-R1 Persistence Read-Only Diagnosis

## 1. Identity and current gate

- Directive: `INV001_P20D2_BOOK_D3A_R1_PERSISTENCE_READ_ONLY_DIAGNOSIS_V1`
- Required result marker: `INV001_P20D2_BOOK_D3A_R1_PERSISTENCE_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Fixed Book commit: `91b4db7a8133bf7bfc0df66534c2acb286bcff27`
- Fixed Book tree: `1db51156e3d838ff026a1ebeb09936b95a2d8018`
- Governance branch: `agent/inv001-p20d2-d3a-governance-baseline-reconciliation-r1`
- Coordination Draft PR: `NOT_CREATED`
- Current mode: governance authoring and local verification only

This document supersedes the stale execution baseline in
`CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE.md` without deleting
that historical directive. It does not authorize Claude execution or private-file
transmission. Execution becomes eligible only after this exact three-document
governance candidate is separately committed, normally pushed, opened as a
dedicated Draft PR, independently verified, and followed by a new Owner
authorization on that matching Draft PR.

The Issue #39 comments below are preserved but are not executable Book
governance and must not be used to start Claude:

- `5635814089`
- `5635874792`
- `5636134595`

Their correction is Issue #39 comment `5635978070`.

## 2. Accepted D2 closure baseline

### Gate B1 — immutable package consumer

- PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/69`
- Source head: `9d2802a46f482e240fddcf380a113741cfe27dd2`
- Merge commit/tree: `e8b3d89e6520d0c5e5e13ef8f100586e51041a86` / `3205c57d5716fffd47a741fa8809eb8f33a47e22`
- Exact changed paths: `.npmrc`, `package.json`, `package-lock.json`
- Package: `@nisikawa-officeaz/detaileros-inventory-foundation@0.1.0`
- Lockfile resolved artifact: `https://npm.pkg.github.com/download/@nisikawa-officeaz/detaileros-inventory-foundation/0.1.0/ac6b37d8030c94bcf6428de1c4253f3c5bb16062`
- Lockfile integrity: `sha512-VIgMOs45cJub1/18jfHGDiqWjMtyO+z+nm8keWXxfgq3cnyA7QJNm5CKQKypHab6+EWEa+YBy+XQvhGcWQ303A==`
- Registry declaration: `@nisikawa-officeaz:registry=https://npm.pkg.github.com`
- Production and exact-branch Preview package-auth closeout was Owner-ratified in Foundation Issue #39 comments `5634524279` and `5634539855`.

### Gate B2 — server-only runtime wrapper

- PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/70`
- Accepted source head: `fd9da4fa61db19caecb3f69634ea1d5fa978f9c1`
- Merge commit/tree: `91b4db7a8133bf7bfc0df66534c2acb286bcff27` / `1db51156e3d838ff026a1ebeb09936b95a2d8018`
- Exact changed paths:
  - `src/lib/inventory/foundation/foundation-runtime-package.ts`
  - `src/lib/inventory/foundation/foundation-runtime-package.test.ts`
- Accepted checks: B2 focused `14/14`, D1 regression `71/71`, typecheck PASS, `git diff --check` PASS.
- Accepted production closeout: Foundation Issue #39 comment `5635813825`.

D2 is closed. This closure proves package installation, build authentication,
the server-only wrapper, and its five D1 surfaces. It does not prove durable
persistence, real product-order wiring, D3B product mapping, D4 request
authorization, D5 UI cutover, D6 database concurrency, or D7 retirement.

## 3. Shipped persistence boundary that must be diagnosed

The installed package exports `InventoryRuntimeStore` with exactly two methods:

1. `snapshot(): InventoryRuntimeSnapshot`
2. `commit(expectedRevision: number, next: InventoryRuntimeCommitInput): boolean`

The package contract states that `commit` replaces the snapshot only when the
exact expected revision matches and otherwise returns `false` without changing
state. The package runtime audit returned by `createInventoryCommandDispatch`
is append-only in memory. The Book B2 wrapper injects the store and does not
create a durable store, transaction, retry, fallback, or database connection.

Gate A must determine the minimum Book-owned durable store and database
transaction boundary that preserves this exact contract without copying or
reinterpreting Foundation business rules.

## 4. Fixed architecture and authority

1. Foundation remains the canonical inventory rule/runtime authority.
2. Office AZ is the sole currently enabled live inventory owner.
3. Existing Book dealer stock, product-order, receiving, logistics, and order
   tables are evidence to classify, not authority to reuse automatically.
4. Dealer-local stock must never become the Office AZ total, fallback, shadow
   ledger, dual-write target, or reconciliation truth.
5. SQL persists Foundation-owned opaque state and evidence; it must not
   calculate stock, reservation, transfer, fulfillment, stocktake, recovery, or
   CSV business rules.
6. Foundation product identity remains opaque in D3A. Its one-to-one mapping to
   `gyeon_products.id` belongs only to D3B.
7. Actor and operator remain distinct. D4 later binds authenticated request and
   capability authority. D3A must not invent either policy.
8. D6 later owns genuine request-scope RLS, separate-connection concurrency,
   and shared-environment evidence. Gate A may design those proofs but may not
   execute them.
9. No automatic retry, command chaining, guessed success, in-memory production
   fallback, partial commit, or raw client write is permitted.

## 5. Later one-time Claude execution preconditions

All of the following must be true before a Claude invocation:

1. this three-document candidate is committed and normally pushed;
2. a dedicated Draft PR exists for this governance branch against `main`;
3. its fixed HEAD/tree, exact diff, protected metadata, and checks are accepted;
4. the newest non-superseded Claude-targeted instruction is posted on that
   Draft PR and matches its fixed HEAD/tree;
5. the Owner separately authorizes the exact private-file transmission and one
   tool-disabled read-only invocation;
6. GitHub `main` still matches the fixed Book commit/tree above, or the
   directive is formally reconciled before execution.

Any mismatch returns `BLOCKED_GOVERNANCE_PRECONDITION` without additional file
inspection or action.

## 6. Proposed exact Gate A read payload

This is a proposed future private read payload only. It is not authorized for
transmission by this document.

### Book governance and package binding

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE.md`
9. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P20D2_BOOK_D3A_R1_PERSISTENCE_READ_ONLY_DIAGNOSIS.md`
10. `.npmrc`
11. `package.json`
12. `package-lock.json`
13. `tsconfig.json`
14. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
15. `src/lib/inventory/foundation/foundation-adaptor-core.ts`
16. `src/lib/inventory/foundation/foundation-adaptor-core.test.ts`
17. `src/lib/inventory/foundation/foundation-runtime-package.ts`
18. `src/lib/inventory/foundation/foundation-runtime-package.test.ts`

### Installed immutable package artifact

19. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/package.json`
20. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/README.md`
21. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/package/inventoryRuntime.d.ts`
22. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryRuntimePorts.d.ts`
23. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryCommandDispatch.d.ts`
24. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryRuntimeAudit.d.ts`
25. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/dist/runtime/inventoryRuntimeSnapshot.d.ts`
26. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.json`
27. `node_modules/@nisikawa-officeaz/detaileros-inventory-foundation/docs/bound/SPEC_INVENTORY_001_FOUNDATION_RELEASE_MANIFEST_V1.json`

No Foundation repository source is part of this payload.

### Book persistence and forbidden-reuse evidence

28. `src/lib/supabase/server.ts`
29. `src/lib/supabase/admin.ts`
30. `supabase/migrations/000_shared_functions.sql`
31. `supabase/migrations/003_create_dealers_and_members.sql`
32. `supabase/migrations/048_create_product_orders.sql`
33. `supabase/migrations/104_least_privilege_grants.sql`
34. `supabase/migrations/20260814084825_revoke_public_execute_from_internal_functions.sql`
35. `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
36. `src/lib/product-orders/product-order-types.ts`
37. `src/lib/product-orders/create-product-order.ts`
38. `src/lib/product-orders/get-product-orders.ts`
39. `src/lib/product-orders/update-product-order.ts`
40. `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
41. `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
42. `src/app/product-orders/page.tsx`
43. `src/app/product-orders/ProductOrdersClient.tsx`

No glob, directory-wide scan, environment file, token, PAT, Vercel value,
provider credential, production row, or customer data is allowed. Direct
dependencies outside these 43 paths must be returned as an exact
`CHANGES_REQUIRED_READ_SCOPE` list and must not be opened.

## 7. Required diagnosis

Using only the authorized payload, Gate A must:

1. verify fixed Book commit/tree, PR #69/#70 identities, package version,
   resolved artifact, lockfile integrity, and every received file hash;
2. enumerate the exact `InventoryRuntimeStore` and five B2/D1 surfaces without
   inferring methods or widening their shapes;
3. classify existing Book product-order/database objects as `COVERED`,
   `PARTIAL`, `MISSING`, or `FORBIDDEN_REUSE` for:
   - durable snapshot/state storage;
   - atomic compare-and-swap revision enforcement;
   - atomic accepted/denied append-only audit;
   - request/idempotency replay identity;
   - crash/restart recovery and snapshot V1/V2/V3 evidence;
   - owner/location/product partitioning deferred to D3B/D4;
   - the server transaction boundary required before D4;
   - separate-connection concurrency proof deferred to D6;
4. decide whether D3A requires one new forward-only migration;
5. propose the minimum schema objects, constraints, indexes, RLS, grants, and
   callable boundary without embedding Foundation rules;
6. pin exact stale-write, replay-conflict, audit append, failure rollback,
   snapshot import/export, and crash-recovery semantics;
7. identify every reuse that would create rule duplication, dual write,
   non-authoritative fallback, weakened CAS, lost audit evidence, or
   dealer-local stock authority;
8. return one exact B0 migration-path command and filename reconciliation flow;
9. return one literal non-overlapping B1 implementation/test allowlist and exact
   static/focused/typecheck/diff commands;
10. return a separate future disposable test matrix using genuine trusted
    claims and two real database connections, without executing it;
11. list every file read and declare zero actions.

## 8. Security requirements

- Every table in an exposed schema has RLS enabled.
- `TO authenticated` alone is authentication, not authorization.
- `user_metadata` is never authority; trusted server-owned data or appropriate
  `app_metadata` may be evaluated only under the later D4/D6 contracts.
- UPDATE requires both `USING` and `WITH CHECK` when applicable.
- Views in exposed schemas use `security_invoker = true`, or are not exposed.
- `SECURITY DEFINER` is not used to bypass permission failures. Any later
  exception requires a non-exposed schema, fixed `search_path`, explicit
  authorization, and revoked `PUBLIC EXECUTE`.
- Raw writes from `anon` and browser `authenticated` roles are denied.
- `service_role` possession is never itself business authorization and is never
  exposed to client-compatible code.
- New tables are not assumed to be Data API-visible; exposure and grants are
  explicit and least privilege.
- Existing migrations are immutable; later schema work is forward-only.

Before any later implementation, re-check the current official Supabase
changelog and RLS/migration documentation. Gate A itself performs no web access.

## 9. Required result and verdicts

Return exactly one report headed:

`INV001_P20D2_BOOK_D3A_R1_PERSISTENCE_READ_ONLY_DIAGNOSIS_RESULT_V1`

Use exactly one verdict:

- `PASS_D3A_IMPLEMENTATION_GOVERNANCE_READY`
- `CHANGES_REQUIRED_READ_SCOPE`
- `CHANGES_REQUIRED_PACKAGE_PERSISTENCE_EXPORT`
- `BLOCKED_GOVERNANCE_PRECONDITION`
- `BLOCKED_PRODUCT_OR_AUTHORITY_BOUNDARY`

The report must include all identities and hashes, exact store API evidence,
the complete coverage matrix, migration-needed decision, atomicity/CAS/audit/
recovery findings, literal later allowlists and commands, files read, actions
not performed, and one exact next gate.

## 10. Absolute prohibitions and stop rule

- No file create/edit/delete, test, typecheck, build, package command, process,
  shell, Git command, browser, subagent, delegation, or network during Claude
  diagnosis.
- No DB, Supabase, Auth, Storage, LINE, provider, Vercel, migration creation or
  application, SQL execution, deployment, production data, or Android action.
- No package install/update/publish and no token, PAT, secret, environment, or
  credential inspection.
- No source implementation, product-order wiring, UI/action wiring, D3B-D7,
  retry, dual write, rule duplication, or fallback.
- No stage, commit, push, PR mutation, Ready, merge, or Issue comment by Claude.
- `src/components/estimates/wizard/screens/ScreensPreview.tsx` and the other
  protected paths remain metadata-only; their content must never be opened,
  read, diffed, copied, hashed, transmitted, staged, or modified.

Stop immediately after returning the one read-only result to MacBook Codex.

## 11. Later gate separation

After diagnosis, every step remains separately authorized:

1. MacBook Codex diagnosis acceptance;
2. D3A implementation-governance authoring;
3. exact-path stage/local commit;
4. normal push/Draft PR update;
5. one Supabase CLI-created migration-path reservation;
6. uncommitted source/migration/test/harness candidate;
7. independent source acceptance;
8. fresh local disposable PostgreSQL/Supabase verification;
9. source commit/push and PR review;
10. Ready and merge;
11. any shared/staging/production migration apply or deployment.

D3A authorizes none of D3B, D4, D5, D6, D7, Android, Studio implementation,
or EC quantity/reservation work.
