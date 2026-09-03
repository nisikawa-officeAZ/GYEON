# Claude Directive — INV001-P19 Book D3B Product Identity Mapping

## 1. Identity

- Directive: `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_V1`
- Readiness diagnosis marker: `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_DIAGNOSIS_RESULT_V1`
- Implementation result marker: `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_IMPLEMENTATION_RESULT_V1`
- Disposable verification marker: `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_DISPOSABLE_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `00f2df7dc5574d0a06a219cb51b4629f1f337f9b` / `b770a987a5573beb4249bfef68dea2926e751f82`
- Proposed governance branch: `agent/inv001-p19-book-d3b-product-mapping-governance`
- D3A governance PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/58`
- Current mode: governance preparation only; implementation blocked until D2 and D3A are fully closed

D3B defines the explicit one-to-one integration mapping between the immutable Foundation product identity and the existing Book catalogue reference `gyeon_products.id`. It must not create another product master, change inventory rules, or infer an authoritative mapping from JAN, SKU, name, or fuzzy matching.

## 2. Ratified Product Authority

1. Foundation immutable product ID is canonical for Foundation inventory commands and state.
2. `public.gyeon_products.id` remains the Book catalogue reference.
3. A Book-owned one-to-one integration mapping relates the two identifiers; the mapping is not a catalogue, stock ledger, price table, or product master.
4. JAN, SKU, product name, category, capacity, and other descriptive fields are evidence/candidate-search values only.
5. No JAN/SKU/name match, including an exact match, may create, activate, repair, or switch a mapping automatically.
6. Missing, duplicate, ambiguous, stale, retired, changed-JAN, changed-SKU, inactive-Book-product, cross-owner, malformed, and unauthorized mappings fail closed.
7. A missing accepted mapping returns `NOT_CONFIGURED` and must deny reservation, availability publication, inventory mutation, fulfillment, transfer, stocktake, and EC quantity authorization.
8. Mapping changes require explicit authorized human confirmation and append-only evidence. Silent remapping and destructive history replacement are prohibited.
9. `gyeon_products` must not be altered, backfilled, renamed, deleted, re-keyed, or made subordinate to the mapping phase.
10. Existing Book inventory/logistics code remains non-authoritative until the later D5/D7 cutover gates; D3B adds no dual-write or fallback.

## 3. Current Blockers and Gate Order

D3B implementation must not start until:

1. D2 private package publication, exact pin, wrapper, delivery review, and merge are complete.
2. D3A persistence diagnosis, migration-path reconciliation, implementation, disposable verification, delivery review, and merge are complete.
3. The accepted Foundation package exposes or proves the exact immutable product identity shape and owner dimension.
4. The accepted D3A persistence layer can receive the resolved Foundation product identity without schema or rule guessing.
5. Book `main`, Foundation package version/integrity, D2 wrapper, and D3A persistence commit/tree are fixed.

This directive may be created early only to save planning time. Its creation authorizes no diagnosis, private-source transmission, Claude invocation, migration, DB connection, implementation, test, stage, commit, push, PR mutation, provider, Android, staging, or production action.

## 4. Mapping Contract to Prove Before Implementation

Gate A must fix, without guessing:

- exact Foundation product ID type, normalization, immutability, and owner scope;
- whether the unique Foundation side is global or composite with owner;
- the exact one-to-one uniqueness rule for `gyeon_products.id`;
- mapping revision/version and stale-write contract;
- active, suspended, retired, and superseded behavior without destructive overwrite;
- authorized confirmer identity and immutable confirmation evidence;
- evidence snapshots for JAN/SKU/name comparisons that never become authority;
- lookup direction from Book to Foundation and Foundation to Book;
- closed fail-closed result union and stable public-safe failure codes;
- mapping audit/read boundary, with D4 authentication policy remaining separate;
- behavior when the Book product is inactive, removed, changed, or inaccessible;
- behavior when a Foundation product is retired, unknown, owner-mismatched, or version-stale.

No schema column or RPC name is final until Gate A accepts this matrix.

## 5. Supabase and PostgreSQL Security Contract

The later candidate must follow current Supabase/PostgreSQL security requirements:

- enable RLS on every new table in an exposed schema;
- never treat `TO authenticated` alone as authorization;
- never use user-editable metadata for authorization;
- deny `anon` and ordinary authenticated direct mapping writes;
- use trusted server-owned authority and D4-compatible claims without implementing D4 in this phase;
- use both `USING` and `WITH CHECK` for any allowed update path;
- keep privileged functions out of `public` by default, revoke implicit `PUBLIC EXECUTE`, fix `search_path`, and explicitly grant only approved callers;
- prefer `SECURITY INVOKER`; never add `SECURITY DEFINER` merely to bypass RLS;
- do not assume Data API exposure; schema exposure and grants are explicit;
- ensure concurrency correctness with database constraints, not pre-check-only application logic;
- make mapping confirmation/change and append-only evidence atomic;
- expose no service-role or secret key to browser-compatible code.

Immediately before implementation, re-check:

- `https://supabase.com/changelog`
- `https://supabase.com/docs/guides/database/postgres/row-level-security`
- `https://supabase.com/docs/guides/deployment/database-migrations`

## 6. Separate D3B Gates

### Gate A — tool-disabled read-only mapping diagnosis

After D2 and D3A closure and separate Owner authorization for every transmitted private file, Claude may diagnose the exact mapping contract. Gate A authorizes no command, edit, package access, DB connection, or executable test.

Allowed verdicts:

- `PASS_PRODUCT_MAPPING_CONTRACT_READY`
- `BLOCKED_D2_OR_D3A_NOT_CLOSED`
- `CHANGES_REQUIRED_FOUNDATION_PRODUCT_IDENTITY_EXPORT`
- `CHANGES_REQUIRED_READ_SCOPE`
- `BLOCKED_PRODUCT_AUTHORITY`
- `BLOCKED_GOVERNANCE_PRECONDITION`

### Gate B0 — migration-path reservation

Only after Gate A acceptance and separate Owner authorization may the installed local Supabase CLI be inspected with `supabase --help`, `supabase migration --help`, and `supabase migration new foundation_product_mapping`. The exact generated path must be reported and approved before SQL authoring.

The historical C3 proposal `supabase/migrations/20260903011000_foundation_product_mapping.sql` is not an authorized hand-created filename. It remains a reservation only unless it equals the CLI-created path or a later Owner-approved reconciliation replaces it.

### Gate B1 — uncommitted implementation candidate

After B0 reconciliation and separate Owner authorization, Claude may edit exactly the accepted four implementation paths. No database may be started or contacted in B1.

### Gate C — fresh disposable verification

After independent B1 acceptance and separate Owner authorization, run one fresh isolated PostgreSQL/Supabase disposable environment outside the worktree. Shared, preview, staging, and production resources are forbidden.

### Later delivery gates

Stage/local commit, normal push/Draft PR, independent review, Ready, merge, shared/staging apply, and production apply remain separate explicit gates. D4, D5, D6, D7, and Android are not implied.

## 7. Proposed Gate A Private Read Allowlist

Transmission is not authorized by this directive.

### Book — exact paths

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
9. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE.md`
10. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING.md`
11. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
12. `src/lib/inventory/foundation/foundation-runtime-package.ts`
13. `src/lib/inventory/foundation/foundation-runtime-package.test.ts`
14. `src/lib/inventory/foundation/foundation-persistence-adaptor.ts`
15. `src/lib/inventory/foundation/foundation-persistence-adaptor.test.ts`
16. `supabase/migrations/047_create_gyeon_products.sql`
17. `supabase/migrations/20260812091313_gyeon_products_storage_authority.sql`
18. the exact accepted D3A migration path
19. `src/lib/products/get-gyeon-products.ts`
20. `src/lib/products/import-gyeon-products-csv.ts`
21. `src/lib/products/import-gyeon-products-csv.test.ts`
22. `src/lib/supabase/server.ts`
23. `src/lib/supabase/admin.ts`

Items 12–15 and 18 must exist at the accepted D2/D3A merged heads. Their absence returns `BLOCKED_D2_OR_D3A_NOT_CLOSED`.

### Foundation package evidence — exact artifacts

1. exact immutable package identity/version/integrity/commit/tree;
2. exported Foundation product identity and owner type declarations;
3. product lifecycle/error declarations required by the mapping boundary;
4. package export/declaration catalogue;
5. accepted Foundation integration contract and release-manifest identities.

No unlisted Foundation implementation source may be transmitted.

## 8. Gate A Required Diagnosis

Gate A must report:

1. exact Book, D2, D3A, and Foundation package identities plus every received hash;
2. exact Foundation product identity type, owner scope, lifecycle, and version behavior;
3. exact `gyeon_products` primary key, SKU/JAN constraints, active state, current RLS/grants, and mutation authority;
4. a closed mapping-state matrix covering missing, candidate, confirmed, stale, suspended, retired, superseded, duplicate, ambiguous, cross-owner, inactive, and malformed cases;
5. the minimum one-to-one constraint design in both directions;
6. the exact human-confirmation and append-only evidence contract;
7. proof that JAN/SKU/name are candidate evidence only and can never auto-authorize;
8. the exact Book-to-Foundation and Foundation-to-Book resolver API and closed failure codes;
9. D3A and D4 boundaries, proving no product mapping logic is duplicated in persistence or route/auth code;
10. the minimum new mapping/evidence objects, indexes, RLS, grants, and RPC/function needs;
11. B0 migration-generation command and literal-path reconciliation procedure;
12. B1 exact four-path allowlist or minimum correction requiring new Owner approval;
13. focused static/unit/typecheck/diff commands;
14. C disposable test matrix with genuine claims and separate-connection uniqueness races;
15. zero-action and final Git-state confirmation.

## 9. Proposed Implementation Allowlist

The C3 paths remain proposals until Gate A and B0 reconcile them:

1. `supabase/migrations/20260903011000_foundation_product_mapping.sql` (historical reservation only; actual path must be generated by the CLI gate)
2. `src/lib/inventory/foundation/foundation-product-mapping.ts` (new)
3. `src/lib/inventory/foundation/foundation-product-mapping.test.ts` (new)
4. `scripts/e2e/inv001-foundation-product-mapping-disposable.mjs` (new)

No existing migration, `gyeon_products` source, product importer, D1/D2/D3A source, route, or UI may be edited. Any literal-path change requires later Owner-approved reconciliation.

## 10. Implementation Contract

The later implementation must:

1. resolve only an accepted, active, unambiguous, version-current one-to-one mapping;
2. return `NOT_CONFIGURED` for an absent accepted mapping and deny all inventory authorization dependent on it;
3. reject duplicate, stale, retired, inactive, cross-owner, mismatched, or malformed mappings with stable sanitized failures;
4. preserve Foundation product and owner values exactly without normalizing them into Book UUID/JAN/SKU authority;
5. treat JAN/SKU/name comparison only as review evidence;
6. require explicit authorized confirmation before activation and atomically append confirmation/change evidence;
7. avoid mutation of `gyeon_products` and avoid any stock, price, order, reservation, or availability calculation;
8. perform no retry, fuzzy match, automatic repair, fallback-to-SKU/JAN, fallback-to-local inventory, or silent remap;
9. expose no privileged database or package object to client code;
10. integrate with D3A through an injected server-only boundary and leave authenticated request policy to D4.

## 11. Disposable Verification Minimums

The later disposable test must prove at least:

- migration apply, schema inventory, indexes, constraints, RLS, grants, and advisors;
- `anon` denial and unauthorized authenticated denial;
- authorized human confirmation with genuine trusted claims;
- one Foundation identity cannot map to two Book products;
- one Book product cannot map to two live Foundation identities;
- two separate connections racing conflicting inserts yield one accepted mapping and one deterministic denial;
- missing mapping returns `NOT_CONFIGURED`;
- same JAN across owners never auto-maps;
- exact JAN/SKU/name match never activates without confirmation;
- changed/null/duplicate JAN or changed SKU never silently remaps;
- inactive Book product, retired Foundation product, stale revision, and owner mismatch fail closed;
- mapping evidence is append-only and application roles cannot update/delete history;
- failed confirmation leaves no partial mapping/evidence state;
- `gyeon_products` row count/content and existing inventory tables remain unchanged;
- no surviving locks, prepared transactions, test data, or disposable runtime;
- Git remains unchanged and `git diff --check` is limited to the accepted four paths.

## 12. Protected and Frozen Content

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 13. Absolute Prohibitions

- No private-source transmission, Claude invocation, sub-agent, delegation, or broad repository scan from this governance creation.
- No DB/Supabase/MCP/provider connection, migration generation/apply, reset, seed, query, backfill, or schema mutation.
- No `gyeon_products` mutation, new product master, shadow catalogue, mapping inferred as authority, or identity rewrite.
- No Foundation, D1, D2, D3A, existing migration, product importer, inventory, logistics, route, UI, Android, dependency, lockfile, or environment edit.
- No shared/preview/staging/production verification or real-customer-data access.
- No dual-write, fallback-to-local, automatic reconciliation, retry, guessed success, or business-rule duplication.
- No stage, commit, push, PR mutation, Ready, merge, tag, release, deployment, or production-ready declaration.

## 14. Required Results

### Gate A

Return `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_DIAGNOSIS_RESULT_V1` with verdict, identities, hashes, identity/owner/lifecycle findings, state matrix, uniqueness contract, evidence/confirmation contract, exact scopes, tests, blockers, and zero-action statement.

### Gate B1

Return `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_IMPLEMENTATION_RESULT_V1` with exact changed paths, objects/constraints/indexes, RLS/grants, resolver API, closed failures, focused results, and final unstaged/uncommitted state.

### Gate C

Return `INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING_DISPOSABLE_RESULT_V1` with fresh runtime identity, PostgreSQL/Supabase versions, migration identity, RLS/grant/advisor evidence, one-to-one and race evidence, unchanged `gyeon_products` evidence, cleanup evidence, pass counts, hashes, and unchanged Git state.

## 15. Exit Gate

D3B completes only after D2 and D3A closure, Gate A acceptance, B0 path reconciliation, B1 implementation acceptance, C disposable acceptance, separately authorized stage/commit/push/Draft PR, independent review, Ready, and merge.

D3B completion authorizes no D4 route/auth, D5 UI/cutover, D6 runtime verification, D7 retirement, Android, provider, shared/staging/production apply, or deployment.
