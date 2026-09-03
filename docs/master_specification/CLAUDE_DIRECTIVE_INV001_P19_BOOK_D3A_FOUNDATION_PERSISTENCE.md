# Claude Directive — INV001-P19 Book D3A Foundation Persistence

## 1. Identity

- Directive: `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_V1`
- Readiness diagnosis marker: `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_DIAGNOSIS_RESULT_V1`
- Implementation result marker: `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_IMPLEMENTATION_RESULT_V1`
- Disposable verification marker: `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_DISPOSABLE_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `2e1df23f1aa64b7c9ca2a608f36f2dccd107cf7b` / `1116b7e768a1a1ca1cfd5bff99263f235cf6bcb8`
- Proposed governance branch: `agent/inv001-p19-book-d3a-persistence-governance`
- D2 governance PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/57`
- D2 governance merge: `2e1df23f1aa64b7c9ca2a608f36f2dccd107cf7b`
- Current mode: governance preparation only; blocked until D2 is fully closed

D3A defines a durable Book-side persistence boundary for the sealed Foundation V2 runtime. It does not implement inventory rules, product mapping, an HTTP route, UI, Android, or any shared/staging/production database change.

## 2. Current Blocker and Gate Order

D3A implementation must not start until all D2 exit gates are complete:

1. Foundation publishes and proves one immutable private package.
2. D2 Gate A package compatibility diagnosis is accepted.
3. D2 Gate B1 exact dependency pin is accepted and merged.
4. D2 Gate B2 server-only package wrapper is accepted and merged.
5. The resulting Book `main` commit/tree and Foundation package identity/version/integrity are fixed.

This directive may be created before those events only to save planning time. Its creation authorizes no D3A diagnosis, migration creation, package access, private-source transmission, Claude invocation, implementation, test, DB access, stage, commit, push, or PR mutation.

## 3. Binding Architecture

1. Foundation V2 remains the canonical inventory runtime and sole business-rule authority.
2. The Book database stores Foundation-owned state and evidence; SQL must not recalculate stock, reservation, transfer, fulfillment, stocktake, recovery, or CSV rules.
3. New Foundation-specific database objects are required. Existing Book inventory, logistics, product-order, and dealer tables remain non-authoritative and must not be reused as the Foundation ledger, dual-written, shadow-written, reconciled automatically, or treated as fallback success.
4. `OFFICE_AZ` is the only currently authorized live inventory owner. The closed Foundation identity `ATTRACTION` may remain representable for contract compatibility but must fail closed in Book authorization until a separate Owner decision explicitly enables it.
5. Foundation immutable product identity is stored without reinterpretation. Mapping to `gyeon_products.id` belongs only to D3B.
6. Actor and operator remain separate. Owner, location, product, request, idempotency, aggregate version, authorization, and recovery context must not be discarded or defaulted.
7. Each mutation must be atomic at the database transaction boundary and must preserve append-only audit evidence, idempotency/replay evidence, and optimistic-concurrency failure semantics.
8. No adapter retry, automatic command chaining, guessed success, zero-quantity fallback, in-memory production fallback, or partial commit is allowed.
9. Browser/client code must never receive direct Foundation package, database, privileged RPC, service-role, or secret access.
10. D4 will bind authenticated request claims. D3A must expose only an injected server-side persistence port and must not invent D4 authorization policy.

## 4. Supabase and PostgreSQL Security Contract

The later implementation must follow the current official Supabase security model:

- every table in an exposed schema has RLS enabled;
- `TO authenticated` alone is never authorization;
- ownership/tenant/role predicates use trusted server-owned or `app_metadata`-derived authority, never user-editable metadata;
- update policy design includes both `USING` and `WITH CHECK` where updates are permitted;
- views in exposed schemas use `security_invoker = true`, or are not exposed and have public access revoked;
- privileged functions are not placed in `public` by default and never retain implicit `PUBLIC EXECUTE`;
- `SECURITY DEFINER` is not used to bypass a permission failure; if independently justified later, it must be in a non-exposed schema, have a fixed `search_path`, perform explicit authorization, and revoke `PUBLIC EXECUTE`;
- `anon`, `authenticated`, and `service_role` receive only the minimum explicitly documented grants;
- direct raw mutation of Foundation persistence tables from browser roles is denied;
- newly created tables are not assumed to be Data API-visible; exposure and grants are explicit;
- migrations are forward-only, deterministic, fail closed, and paired with separately tested rollback/recovery evidence.

References to re-check immediately before implementation:

- `https://supabase.com/changelog`
- `https://supabase.com/docs/guides/database/postgres/row-level-security`
- `https://supabase.com/docs/guides/deployment/database-migrations`

## 5. Separate D3A Gates

### Gate A — tool-disabled read-only persistence diagnosis

After D2 closure and separate Owner authorization for exact private files, Claude may diagnose the package persistence interface and propose the minimum schema/adaptor contract. Gate A authorizes no edit, command execution, DB connection, package access, or test.

Allowed verdicts:

- `PASS_PERSISTENCE_CONTRACT_READY`
- `BLOCKED_D2_NOT_CLOSED`
- `CHANGES_REQUIRED_PACKAGE_PERSISTENCE_EXPORT`
- `CHANGES_REQUIRED_READ_SCOPE`
- `BLOCKED_PRODUCT_AUTHORITY`
- `BLOCKED_GOVERNANCE_PRECONDITION`

### Gate B0 — migration-path reservation

Only after Gate A acceptance and separate Owner authorization may the local installed Supabase CLI be inspected with `supabase --help`, `supabase migration --help`, and `supabase migration new foundation_inventory_runtime`. The command-created exact migration path must be reported before SQL is added. No hand-created or guessed migration filename is allowed.

The C3 path `supabase/migrations/20260903010000_foundation_inventory_runtime.sql` remains a historical proposed reservation only. It is not authorized for creation unless it is the exact CLI-created path or a later Owner-approved reconciliation replaces it.

### Gate B1 — uncommitted implementation candidate

Only after B0 path reconciliation and separate Owner authorization may Claude edit the approved exact four-path implementation allowlist. No DB may be started or contacted in B1. Static/focused tests and typecheck must be explicitly listed by Gate A.

### Gate C — isolated disposable PostgreSQL/Supabase verification

Only after B1 is independently accepted and separately authorized may the disposable harness run. It must use a fresh one-time local runtime outside the worktree, no shared/staging/production project, no real customer data, and no reused failed evidence directory.

### Later delivery gates

Stage/local commit, normal push/Draft PR, independent review, Ready, merge, any shared/staging apply, and production apply are separate explicit gates. D3B, D4, D5, D6, D7, and Android are not implied.

## 6. Proposed Gate A Private Read Allowlist

This is a proposed scope only. Transmission is not authorized by this directive.

### Book — exact paths

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE.md`
9. `package.json`
10. `package-lock.json`
11. `tsconfig.json`
12. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
13. `src/lib/inventory/foundation/foundation-adaptor-core.ts`
14. `src/lib/inventory/foundation/foundation-adaptor-core.test.ts`
15. `src/lib/inventory/foundation/foundation-runtime-package.ts`
16. `src/lib/inventory/foundation/foundation-runtime-package.test.ts`
17. `src/lib/supabase/server.ts`
18. `src/lib/supabase/admin.ts`
19. `supabase/migrations/000_shared_functions.sql`
20. `supabase/migrations/003_create_dealers_and_members.sql`
21. `supabase/migrations/104_least_privilege_grants.sql`
22. `supabase/migrations/20260814084825_revoke_public_execute_from_internal_functions.sql`

Items 15–16 must exist at the accepted D2 merged head. Their absence returns `BLOCKED_D2_NOT_CLOSED`.

### Foundation package evidence — exact artifacts

1. exact package `package.json` as shipped;
2. generated declarations and export catalogue;
3. complete tarball file catalogue without secret contents;
4. package integrity/provenance/SBOM metadata;
5. immutable package version to Foundation commit/tree binding;
6. exported persistence/runtime port declarations required by the accepted D2 wrapper.

No Foundation implementation source outside the separately accepted package/publication evidence may be transmitted.

## 7. Gate A Required Diagnosis

Gate A must report:

1. exact Book main commit/tree, D2 merge, package name/version/integrity, and all received hashes;
2. the exact Foundation persistence/store interface exported by the accepted package;
3. one state/evidence row for each of the five D1 surfaces and all 18 commands;
4. transaction boundaries, aggregate keys, version checks, idempotency keys, replay-conflict behavior, audit append rules, snapshot V1/V2/V3 storage/import/export, and recovery-evidence requirements;
5. the minimum Foundation-specific schema objects and indexes without embedding business rules;
6. exact RLS/grant/RPC design and which role can perform each operation;
7. proof that raw client writes, cross-owner reads, owner/location/product substitution, stale writes, duplicate idempotency, audit mutation, and partial commits fail closed;
8. explicit separation of D3B product mapping and D4 authenticated request policy;
9. the exact B0 command and expected filename-reconciliation procedure;
10. the exact B1 four-path allowlist, or the minimum literal correction requiring new Owner approval;
11. the focused unit/static/typecheck/diff commands for B1;
12. the disposable C test matrix, including real JWT claims and separate database connections for concurrency;
13. rollback/recovery evidence and confirmation that no production fallback is present;
14. zero-action and final Git-state confirmation.

## 8. Proposed Implementation Allowlist

The C3 paths remain proposals until Gate A and B0 reconcile them:

1. `supabase/migrations/20260903010000_foundation_inventory_runtime.sql` (historical proposed reservation; actual path must come from the CLI gate)
2. `src/lib/inventory/foundation/foundation-persistence-adaptor.ts` (new)
3. `src/lib/inventory/foundation/foundation-persistence-adaptor.test.ts` (new)
4. `scripts/e2e/inv001-foundation-persistence-disposable.mjs` (new)

No existing migration may be edited. No path may be added, removed, or renamed without a later Owner-approved directive reconciliation.

## 9. Implementation Contract

The later candidate must:

1. inject the accepted package persistence/store interface server-side;
2. persist only Foundation-owned state and opaque evidence needed by the proven package contract;
3. preserve exact owner/location/product/request/idempotency/version/actor/operator boundaries;
4. make mutations atomic and classify duplicate, stale, denied, malformed, partial, and transport failures without leaking raw SQL or secrets;
5. keep the audit log append-only and prevent update/delete by application roles;
6. prevent client direct mutation and unrestricted cross-owner/cross-location reads;
7. perform no retry, automatic reconciliation, rule calculation, command chaining, product mapping, or legacy dual-write;
8. use no service-role credential in browser-compatible code and log no token, connection string, raw authorization evidence, or personal data;
9. provide deterministic rollback/recovery instructions without applying them to a shared environment;
10. return a closed fail-closed result to the D2 wrapper.

## 10. Disposable Verification Minimums

The later isolated test must prove at least:

- fresh migration apply and schema/object/grant inventory;
- RLS enabled and forced/appropriate for every exposed table;
- `anon` denial and authenticated unauthorized-owner denial;
- genuine request-scope claims using trusted application metadata, not user metadata;
- authorized Office AZ server request success;
- actor/operator preservation;
- duplicate idempotency and conflicting replay behavior;
- stale aggregate-version rejection;
- two truly separate database connections racing the same aggregate;
- atomic rollback on injected failure with no audit/state split;
- append-only audit update/delete denial;
- snapshot V3 export and V1/V2/V3 import/recovery cases required by the package;
- no access to existing local inventory/product/order tables;
- rollback/recovery proof, post-test cleanup, and no surviving prepared transactions or locks;
- `git diff --check` limited to the exact accepted implementation paths.

## 11. Protected and Frozen Content

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

All existing migrations, D1 files, D2 files, package metadata, application routes, UI, Android, and legacy inventory cores are read-only unless explicitly listed in a later accepted implementation gate.

## 12. Absolute Prohibitions

- No private-source transmission, Claude invocation, sub-agent, delegation, or broad repository scan from this governance creation.
- No DB/Supabase/MCP/provider connection, migration apply, reset, seed, data read/write, backfill, or schema mutation.
- No shared, staging, preview, or production verification.
- No edits to Foundation, existing migrations, D1/D2 code, product mapping, route, UI, Android, dependency, lockfile, or environment.
- No legacy fallback, in-memory production fallback, dual-write, shadow table, automatic reconciliation, retry, guessed success, or rule duplication.
- No stage, commit, push, PR mutation, Ready, merge, tag, release, deployment, or production-ready declaration.

## 13. Required Results

### Gate A

Return one result headed `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_DIAGNOSIS_RESULT_V1` with verdict, identities, hashes, state/evidence mapping, schema/RLS/grant/RPC proposal, B0 filename procedure, B1 exact scope, C disposable plan, blockers, and zero-action statement.

### Gate B1

Return one result headed `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_IMPLEMENTATION_RESULT_V1` with the exact changed paths, schema objects, permission matrix, transaction/idempotency/version contract, focused results, and final unstaged/uncommitted state.

### Gate C

Return one result headed `INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE_DISPOSABLE_RESULT_V1` with fresh runtime identity, PostgreSQL/Supabase versions, migration identity, RLS/grant/advisor evidence, separate-connection concurrency evidence, rollback/cleanup evidence, raw pass counts, evidence hashes, and unchanged Git state.

## 14. Exit Gate

D3A is complete only after D2 closure, Gate A acceptance, B0 migration-path reconciliation, B1 implementation acceptance, Gate C disposable acceptance, separately authorized stage/commit/push/Draft PR, independent review, Ready, and merge.

D3A completion authorizes no shared/staging/production apply, D3B product mapping, D4 route/auth, D5 UI, D6 request verification, D7 retirement, Android, or deployment.
