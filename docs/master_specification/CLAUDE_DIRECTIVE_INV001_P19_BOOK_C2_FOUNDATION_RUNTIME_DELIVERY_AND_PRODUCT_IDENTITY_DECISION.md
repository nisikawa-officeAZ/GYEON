# Claude Directive — INV001-P19 Book C2 Foundation Runtime Delivery and Product Identity Decision

## 1. Identity

- Directive: `INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION_V1`
- Required result marker: `INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Proposed dedicated branch: `agent/inv001-p19-book-c2-runtime-delivery-product-identity-decision`
- Book C1 coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/53`
- Book C1 execution HEAD/tree: `dd2bb58a68ddffbc6c87efe5c1dd4265eb0785ae` / `5f71abe6345d2ec6abe86b62089e11d7152d1869`
- Foundation repository: `nisikawa-officeAZ/detaileros-inventory-foundation`
- Fixed Foundation source commit/tree: `c0cc42de8ef1e95482b31a981a7d2d6e2571fa8e` / `c2e925295e1e0384010e6744a5c7ec15cb7668a1`
- Mode: one bounded cross-repository read-only decision-package diagnosis; zero edits and zero executable tests

C2 prepares two explicit owner decisions only:

1. how the sealed Foundation runtime is delivered to and invoked by Book; and
2. how Book product references bind to the Foundation inventory product identity without creating another canonical product master.

C2 does not authorize implementation and must not silently make either decision for the owner.

## 2. Accepted C1 Findings and Codex Corrections

Treat PR #53 comment `INV001_P19_BOOK_C1_CODEX_CONDITIONAL_ACCEPTANCE_AND_CORRECTION_V1` as the accepted C1 disposition.

1. Foundation is the canonical Office AZ inventory contract/runtime authority.
2. Book-local inventory, receiving, movement, adjustment, and stocktake state remains dealer-local or a compatibility surface until an authorized cutover proves otherwise.
3. No Book-to-Foundation package, import, generated client, route, RPC, or live HTTP bridge is proven in the C1 scope.
4. Foundation hosts no live HTTP service and runtime delivery remains `NOT_CONFIGURED`.
5. `gyeon_products` to Foundation product identity remains `NOT_CONFIGURED`. Neither Book UUID nor JAN may be silently assumed canonical.
6. No dual-write, shadow-write, source duplication, competing ledger, fallback-to-local success, guessed product mapping, or mixed authority is allowed.
7. Partial or ambiguous results fail closed. Actor and operator are distinct bindings. All later path allowlists must be literal and contain no wildcard.
8. Android and M1-M6 remain a separate owner-gated track.

## 3. Invocation Preconditions

Before receiving any private file, Claude must verify from the supplied evidence:

1. C1 is accepted only through the Codex correction comment and PR #53 remains open/Draft unless a later owner-approved merge identity is supplied.
2. The newest non-superseded instruction names this directive and the exact result marker.
3. The instruction supplies the exact Book execution HEAD/tree and a clean path/mode/blob manifest for every file transmitted.
4. The fixed Foundation commit/tree match Section 1.
5. The committed delta from the stated Book base contains governance files only.
6. Separate explicit owner authorization exists to transmit exactly the private files actually supplied.
7. No protected-path contents are supplied.

If any precondition fails, return `BLOCKED_GOVERNANCE_PRECONDITION` and stop before reading further private source.

## 4. Exact Book Private Read Allowlist

Claude may receive exactly these 16 Book files and no others:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C1_FOUNDATION_V2_CONSUMER_BINDING_DIAGNOSIS.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION.md`
7. `package.json`
8. `src/lib/supabase/server.ts`
9. `src/lib/products/get-gyeon-products.ts`
10. `src/lib/inventory/inventory-types.ts`
11. `src/lib/inventory/inventory-actions.ts`
12. `src/lib/inventory/office-az-inventory-core.ts`
13. `src/lib/inventory/office-az-channel-contracts-core.ts`
14. `src/lib/admin/logistics/logistics-types.ts`
15. `src/lib/admin/logistics/get-logistics-inventory.ts`
16. `src/lib/admin/logistics/stocktaking-actions.ts`

No package lockfile, migration, environment file, generated output, payment/order source, unrelated UI, or protected-path content is authorized.

## 5. Exact Foundation Private Read Allowlist

Claude may receive exactly these 4 Foundation files at the fixed Foundation commit and no others:

1. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.md`
2. `docs/handoffs/SPEC_INVENTORY_001_FOUNDATION_INTEGRATION_CONTRACT_V2.json`
3. `docs/audits/SPEC_INVENTORY_001_P19_POST_P18_FOUNDATION_RELEASE_MANIFEST_AND_BOOK_HANDOFF.md`
4. `docs/adr/0075-spec-inventory-001-post-p18-foundation-release-manifest-and-book-handoff.md`

No Foundation implementation, test implementation, migration, draft SQL, dependency, lockfile, environment file, or other document is authorized.

## 6. Decision A — Runtime Delivery Mechanism

Compare these candidates without selecting one on behalf of the owner:

### A1 — Private immutable package artifact (preferred candidate to evaluate)

- Foundation publishes a versioned private package containing only the sealed consumer runtime/export surface.
- Book installs one exact version pinned to Foundation commit/tree and package-integrity evidence.
- Foundation remains source authority; Book owns only its server adaptor.
- Package production, registry, credential, installation, dependency, and lockfile work remain later gates.

### A2 — Live Foundation service

- Requires a new Foundation-owned HTTP/service phase because no live service currently exists.
- Requires transport, authentication, availability, idempotency, version negotiation, observability, and recovery contracts.
- Must not be described as currently available.

### A3 — Git dependency or submodule

- Evaluate reproducibility, private-repository credentials, build-system behavior, release isolation, and operational burden.
- Do not configure it.

### A4 — Vendored or copied source

- Presumptively conflicts with the no-duplication/no-competing-rule boundary.
- It may be recommended only if the evidence proves a governance mechanism that prevents drift; otherwise mark it rejected.

### A5 — Database-mediated coupling

- Presumptively rejected because Foundation draft SQL is unapplied and DB authority is not configured.
- Do not treat shared tables or Book-local tables as runtime delivery.

For each candidate report security, reproducibility, release rollback, drift risk, CI/testability, operational cost, outage behavior, and exact new owner decisions required. Recommend one candidate, but leave the final choice `OWNER_DECISION_REQUIRED`.

## 7. Decision B — Product Identity Contract

Compare these identity candidates without selecting one on behalf of the owner:

### B1 — Foundation immutable product ID with explicit Book mapping (preferred candidate to evaluate)

- Foundation inventory product ID remains canonical for inventory.
- Book `gyeon_products.id` remains the Book catalogue reference.
- A versioned one-to-one mapping contract relates them.
- JAN and SKU are lookup/evidence fields, not silent primary authority.
- Duplicate, missing, retired, changed-JAN, and cross-owner same-JAN cases fail closed.

### B2 — Shared immutable ID already present in both systems

- Acceptable only if the supplied evidence proves the same immutable identifier and lifecycle contract on both sides.
- Otherwise classify `NOT_PROVEN`.

### B3 — JAN as canonical identity

- Evaluate against Foundation's same-JAN cross-owner coexistence rule and product lifecycle changes.
- Reject if JAN alone cannot uniquely preserve owner/product identity.

### B4 — Book `gyeon_products.id` as Foundation identity

- Evaluate whether this would invert Foundation authority or make Book the source of inventory identity.
- Reject unless an explicit Foundation contract already accepts that exact identifier.

For each candidate report authority owner, immutable key, Book key, owner dimension, JAN/SKU role, versioning, lifecycle, duplicate/missing behavior, reconciliation evidence, and migration implications. Recommend one candidate, but leave the final choice `OWNER_DECISION_REQUIRED`.

## 8. Required Result

Return one result headed `INV001_P19_BOOK_C2_FOUNDATION_RUNTIME_DELIVERY_AND_PRODUCT_IDENTITY_DECISION_RESULT_V1` with:

1. verdict `PASS_DECISION_PACKAGE_READY`, `CHANGES_REQUIRED_READ_SCOPE`, or `BLOCKED_GOVERNANCE_PRECONDITION`;
2. supplied and independently distinguishable Book/Foundation Git identities and PR state;
3. exact files received and SHA-256 attestations for each;
4. a candidate matrix for A1-A5;
5. one recommended runtime-delivery candidate and concise rejection/deferral grounds for the others;
6. a candidate matrix for B1-B4;
7. one recommended product-identity candidate and concise rejection/deferral grounds for the others;
8. exact owner questions, each answerable by a short explicit choice;
9. the minimum future Book adaptor contract needed after both decisions;
10. fail-closed rules for missing mapping, duplicate mapping, stale version, partial result, transport ambiguity, authorization denial, and recovery;
11. separate exact future phase names and governance gates, without any wildcard path or implementation authorization;
12. all unresolved facts marked `NOT_CONFIGURED`, `NOT_PROVEN`, or `OWNER_DECISION_REQUIRED`;
13. zero-action confirmation and final worktree/index state.

Do not claim that a preferred recommendation is an owner decision.

## 9. Protected Paths

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 10. Absolute Prohibitions

- No edit, test, typecheck, build, lint, install, dependency resolution, package publication, registry access, generated output, or source copying.
- No stage, commit, push, branch mutation, PR mutation, comment, Ready conversion, merge, tag, release, deployment, or production action.
- No migration, SQL, DB, Supabase, provider, Vercel, Android, emulator, device, Studio mutation, or live HTTP/API action.
- No product-ID remap, table creation, backfill, dual-write, shadow-write, fallback-to-local, or guessed success.
- No environment/secret read, secret request/output, sub-agent, delegation, or scope expansion.

Stop after the one complete result. Implementation remains a later separately authorized phase.
