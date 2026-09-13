# Claude Directive — INV001-P20D2 Book D3A Gate B1 Uncommitted Persistence Candidate

## Status

`GOVERNANCE_CANDIDATE_UNSTAGED_UNCOMMITTED_EXECUTION_NOT_AUTHORIZED`

This document reconciles the accepted D3A diagnosis, the one-time B0 migration-path reservation, and the first blocked B1 attempt. It does not authorize Claude execution or any implementation action. A later B1 run requires every governance and Owner gate in this document to pass first.

The first separately authorized B1 attempt correctly returned:

```text
VERDICT=BLOCKED_GOVERNANCE_PRECONDITION
ACTIONS=ZERO
```

Its result SHA-256 is `5c2018bf2d5e2d6aaa00a02b0ee441b7e7f394bd50788c2b4218f53fd681b4fe`. Do not treat that attempt as implementation evidence and do not rerun B1 from chat history alone.

## Accepted authority

- Accepted diagnosis result: `INV001_P20D2_BOOK_D3A_R1_PERSISTENCE_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Accepted source-result SHA-256: `6e49fed2f5e37ab502fd4ab1e9c11327512fd89d6397e0c02421a07190933579`
- Accepted verdict: `PASS_D3A_IMPLEMENTATION_GOVERNANCE_READY`
- Correction scope: `ADDED_MISSING_VERDICT_ONLY`
- Correction result SHA-256: `c82a23fb87053737f674687f4500b82a282ce32d503519931468e5368139090a`
- Target repository: `nisikawa-officeAZ/GYEON`
- Target worktree: `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/dealeros-inv001-p20d2-b2-runtime-wrapper`
- Governance branch: `agent/inv001-p20d2-d3a-governance-baseline-reconciliation-r1`
- Pre-B0 HEAD: `141735c03ab6c6068934389a4ead84024c0b0623`
- Pre-B0 tree: `e270c889c13443c95951a7716e4bac51d29f0605`
- Fixed Book `main`: commit `91b4db7a8133bf7bfc0df66534c2acb286bcff27`, tree `1db51156e3d838ff026a1ebeb09936b95a2d8018`
- Installed immutable package: `@nisikawa-officeaz/detaileros-inventory-foundation@0.1.0`

The shipped package store contract remains exactly:

```ts
snapshot(): InventoryRuntimeSnapshot
commit(expectedRevision: number, next: InventoryRuntimeCommitInput): boolean
```

Do not widen or reinterpret this interface. The existing B2 wrapper binds exactly `dispatchCommand`, `readAuditLog`, `exportSnapshot`, `importSnapshot`, and `evaluateRecoveryEvidence`.

## B0 evidence and bounded ordering reconciliation

MacBook Codex executed the separately authorized local Supabase CLI command exactly once with CLI `2.116.0`:

```text
supabase migration new foundation_inventory_runtime
```

The CLI generated exactly:

```text
supabase/migrations/20260912004445_foundation_inventory_runtime.sql
```

The generated file is currently untracked, mode `0644`, size `0`, and SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

B0 occurred after accepted Gate A diagnosis but before this three-document B1 governance reconciliation. This is a bounded ordering deviation only: the file remained empty, no SQL or source was authored, no test or database was run, and no Git or provider delivery occurred. This record accepts the path-reservation evidence but grants no B1 implementation authority.

Do not rerun the CLI command in B1. Do not hand-create, guess, rename, replace, or reuse a timestamped migration. The historical proposal `supabase/migrations/20260903010000_foundation_inventory_runtime.sql` is not authority.

## Mandatory future governance gate

Before any later B1 invocation, MacBook Codex must independently verify all of the following:

1. This directive, `GYEON_DA_COMPLETION_PLAN.md`, and `GYEON_DA_PHASE_RESULTS.md` are committed together as one exact three-document governance commit.
2. That commit is normally pushed and is the head of one dedicated open Draft PR.
3. The execution HEAD/tree, base ancestry, exact governance delta, empty index, protected metadata, and B0 file state are fixed and accepted.
4. This directive is posted by MacBook Codex on that Draft PR as the newest non-superseded instruction matching the fixed execution identity.
5. The Owner separately authorizes exactly one B1 uncommitted implementation attempt after seeing that identity and instruction.
6. The B0 file still exists at the exact path above, remains untracked and empty, and no other worktree change exists before implementation.

If any item is absent, stale, ambiguous, or conflicting, stop without reading implementation files and return:

```text
INV001_P20D2_BOOK_D3A_B1_UNCOMMITTED_IMPLEMENTATION_RESULT_V1
VERDICT=BLOCKED_GOVERNANCE_PRECONDITION
ACTIONS=ZERO
```

## Mandatory future start gate

After the governance gate passes and before reading or editing implementation files:

1. Read the repository `AGENTS.md`, completion plan, latest phase-results entries, and this directive completely.
2. Verify the repository, branch, fixed execution HEAD/tree supplied by MacBook Codex, and fixed Book `main` identity above.
3. Verify the index is empty.
4. Verify the only permitted pre-existing worktree change is the exact untracked empty B0 file.
5. Verify its basename ends with `_foundation_inventory_runtime.sql` and it remains under `supabase/migrations/`.

If the B0 path is absent, ambiguous, non-empty, renamed, tracked, or accompanied by another dirty path, stop with:

```text
INV001_P20D2_BOOK_D3A_B1_UNCOMMITTED_IMPLEMENTATION_RESULT_V1
VERDICT=BLOCKED_B0_EXACT_PATH_OR_CLEAN_STATE_REQUIRED
ACTIONS=ZERO
```

## Literal four-path future write allowlist

Only after every prior gate passes, a separately authorized B1 attempt may edit exactly:

1. `supabase/migrations/20260912004445_foundation_inventory_runtime.sql`
2. `src/lib/inventory/foundation/foundation-persistence-adaptor.ts`
3. `src/lib/inventory/foundation/foundation-persistence-adaptor.test.ts`
4. `scripts/e2e/inv001-foundation-persistence-disposable.mjs`

No other file may be created, modified, deleted, renamed, staged, formatted, or generated. Existing migrations and all D1/D2/package files are read-only. `src/components/estimates/wizard/screens/ScreensPreview.tsx`, `.github/`, UI, routes, Android, LINE, invoice, product-order, dependency, lockfile, environment, and configuration files remain protected and out of scope.

## Required future candidate behavior

1. Create only new Foundation-specific persistence objects in the one forward-only migration.
2. Preserve opaque Foundation state and evidence; do not reproduce Foundation business rules in SQL or Book TypeScript.
3. Preserve owner, location, opaque product identity, request identity, idempotency identity, aggregate revision, actor, operator, authorization evidence, and recovery evidence without defaults or omission.
4. Enforce atomic compare-and-swap: the expected revision matches the stored revision, one success advances exactly once, and stale mutation leaves state and audit unchanged.
5. Enforce idempotency: identical replay returns the recorded outcome; a reused idempotency key with different material fails closed.
6. Persist an accepted state transition and append-only audit atomically. Record denied/rejected evidence without mutating state. Application roles cannot update or delete audit rows.
7. Preserve snapshot V1/V2/V3 export/import/recovery evidence. Import remains validation-only and non-committing; no automatic apply, fallback, retry, or reconciliation is introduced.
8. Make raw browser writes impossible. Enable RLS on exposed tables, revoke implicit/public privileges, and grant only the minimum server-side callable boundary justified by the accepted contract.
9. Authentication alone is not authorization. User-editable metadata is never authority, and service-role credentials never enter browser-compatible code.
10. Return deterministic fail-closed classifications for duplicate, replay conflict, stale revision, denied, malformed, partial, and transport failure without logging secrets, raw SQL, raw authorization material, or personal data.
11. Keep Foundation product identity opaque. Do not implement D3B mapping, D4 request authority, product-order wiring, UI/action wiring, provider behavior, or dealer-local stock authority.
12. The disposable harness may be authored but not executed. It must target a future fresh one-time local runtime outside the worktree, genuine trusted claims, two real database connections, rollback failure, concurrency conflict, RLS/grant checks, recovery checks, and cleanup proof.

## Forbidden reuse

Do not use or mutate existing Book inventory, logistics, GYEON ordering, product-order, or generic audit objects as the Foundation ledger or fallback. This includes `gyeon_products`, `product_orders`, `product_order_items`, `gyeon_order_v3_*`, legacy inventory/counting/logistics tables, and generic audit tables. Architecture patterns may be studied read-only; their objects and data are not shared authority.

## Test source requirements — author only

Author focused coverage for empty bootstrap, successful CAS, stale CAS, identical replay, replay conflict, state/audit atomicity, denied audit without state mutation, injected rollback failure, append-only audit denial, cross-owner/location denial, raw-client write denial, snapshot V1/V2/V3 behavior, malformed snapshot rejection, forbidden legacy-table isolation, and absence of automatic retry/fallback/mapping/rule duplication.

Do not execute tests, typecheck, build, database commands, or the disposable harness in B1. Executable verification is a separately authorized gate.

## Required future stop state

- Exactly the four allowlisted paths are modified or untracked.
- The index remains empty.
- No commit, push, PR/Issue comment, Ready, merge, tag, or release.
- No database, Supabase runtime, MCP, provider, registry, or network connection.
- No migration apply, reset, seed, or backfill.
- No shared, Preview, staging, or production mutation.
- No D3B-D7, Android, Studio implementation, UI, or deployment work.

## Required future result

Return one concise result headed exactly:

```text
INV001_P20D2_BOOK_D3A_B1_UNCOMMITTED_IMPLEMENTATION_RESULT_V1
```

Include the verdict, verified identities, exact four changed paths, schema and permission inventory, CAS/transaction/idempotency/audit/snapshot/recovery summary, authored test matrix, `EXECUTABLE_VERIFICATION=NOT_RUN_SEPARATE_GATE`, index/worktree state, actions not performed, and confirmation that protected and forbidden-reuse paths were untouched. Then stop for MacBook Codex review.
