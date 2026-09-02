# GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R4_IMPLEMENTATION

Directive ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R4_IMPLEMENTATION_V1`

## Objective

Implement only the accepted and Codex-corrected pre-activation postal-master safety repair: preserve existing shared-schema privileges, scope postal revokes to postal objects, resume interrupted imports without deletion, bind every mutation to an explicitly confirmed Supabase project ref, and add an offline validate-only mode. Modify exactly five existing paths and run only the focused source/unit tests named below.

This directive does not authorize database access, Supabase CLI, migration apply, real CSV acquisition/import, provider/Preview/production access, stage, commit, push, PR mutation, Ready, merge, or deployment.

## Dispatch identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#48`, required `OPEN` and `Draft`
- Base branch: `main`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Source baseline commit: `99e7e20629ff4c4b5037c4263cce16bc39eceb05`
- Source baseline tree: `6cd7dc8f1ee6689c3358f6f2b3111571c48d0aa8`
- A later owner-approved dispatch must provide exact `DISPATCH_HEAD` and `DISPATCH_TREE` after this exact three-path governance candidate is committed and normally pushed.
- The source baseline must be an ancestor of `DISPATCH_HEAD`, and only the exact three governance paths may differ between them.

Return `BLOCKED_CANDIDATE_DRIFT` without editing if identity, ancestry, PR state, clean committed state, governance delta, or protected metadata differs.

## Mandatory complete read scope

Read only these paths completely:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R4_IMPLEMENTATION.md`
5. `supabase/migrations/20260901001246_jp_postal_master.sql`
6. `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
7. `supabase/tests/jp_postal_master_rpc.test.sql`
8. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
9. `scripts/postal-master/import-japan-post.ts`
10. `scripts/postal-master/import-japan-post.test.ts`
11. `package.json`

If another path is essential, stop with `BLOCKED_READ_SCOPE`, name the exact path, and do not read or edit it.

## Exact implementation write allowlist

Modify exactly these five existing paths; create, delete, rename, format, or touch no other path:

1. `supabase/migrations/20260901001246_jp_postal_master.sql`
2. `supabase/tests/jp_postal_master_rpc.test.sql`
3. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
4. `scripts/postal-master/import-japan-post.ts`
5. `scripts/postal-master/import-japan-post.test.ts`

## Required repairs

### A. Shared `private` schema privilege preservation

1. Remove the postal migration's `revoke all on schema private from public, anon, authenticated, service_role` statement. Do not replace it with any shared-schema privilege reset.
2. Retain only the additive schema usage required by the postal implementation without removing a prior migration's grants.
3. Replace `revoke all on all tables in schema private ...` with explicit revokes against only:
   - `private.jp_postal_import_batches`
   - `private.jp_postal_master`
   - `private.jp_postal_active_batch`
4. Preserve authenticated schema usage and execution of `private.gyeon_order_v3_can_read_dealer(uuid)` established by the earlier GYEON-order migration.
5. Keep direct postal-table access denied to public, anon, authenticated, and service_role. Service-role operation remains through narrow SECURITY DEFINER public RPCs only.

### B. Deterministic interrupted-import resume

1. Add a service-role-only SECURITY DEFINER status RPC keyed by exact `source_date`, lowercase SHA-256, and `expected_row_count`.
2. Return only stable metadata: result code, batch id, status, expected row count, appended sequence numbers, and whether the batch is the active promoted generation. Never return source rows or addresses.
3. Validate SHA-256 and expected count before lookup. A mismatched expected count for an existing identity fails closed.
4. The CLI uses status before begin. `NOT_FOUND` may proceed to begin; `staged` or `validating` resumes the same batch; current active `promoted` is an idempotent already-promoted success; `rejected`, `rolled_back`, or promoted-but-superseded fails closed.
5. Close the status/begin race: if begin returns `IMPORT_IN_PROGRESS`, re-read status once and resume only when the exact identity/count contract still matches.
6. Skip sequences already present in the status result. If a concurrent runner appends the same sequence after the status read, `jp_postal_import_append` must return `OK`, zero inserted rows, and an explicit already-appended marker. The CLI treats this as successful idempotent progress.
7. Do not add abort, delete, truncate, reset, or rejected-batch recycling. Do not delete partial rows or change a terminal identity back to `staged`.

### C. Target-project and offline-validation guards

1. Add required `--expected-project-ref <ref>` to import and rollback modes.
2. Add required `--confirm-project-ref <ref>` to every mutating import or rollback. It must exactly equal the expected ref.
3. Before creating a Supabase client or making an RPC, parse only canonical `https://<ref>.supabase.co` URLs and require the URL ref, expected ref, and confirmation ref to match exactly after safe normalization. Reject custom, malformed, ambiguous, or mismatched hosts without network access.
4. Add import-only `--validate-only`. It performs local argument validation, file read, expected/computed SHA-256 comparison, full 15-column CSV validation, row derivation, counts, and chunk planning. It must not require `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`, create a client, access network/database, or call any RPC.
5. Project refs must satisfy the canonical Supabase project-ref format already used by the platform. Never log the service-role key, full URL, CSV row, or address.
6. Preserve stable, non-sensitive outcome codes and logs containing only mode, source date, checksum, safe counts, project ref, batch id, sequence count, and state.

### D. Regression tests

Add deterministic assertions covering at least:

- absence of shared-schema and all-private-table revoke statements;
- exact postal-table revokes and preserved authenticated GYEON-order schema/function authority;
- service-role-only status RPC grants and browser-role denial;
- new batch, interrupted resume, already-promoted replay, terminal-state denial, count mismatch, begin race, skipped sequence, and concurrent duplicate-sequence no-op behavior;
- expected/confirmed/URL project-ref match and every mismatch/malformed/custom-host failure before RPC;
- validate-only success/failure with zero client construction and zero RPC calls;
- import and rollback refusing mutation without explicit confirmation;
- safe logging without URL, key, CSV row, or address exposure.

Do not weaken an existing assertion to make the repair pass.

## Focused verification allowed in this phase

Run only:

```bash
node --import tsx --test src/lib/geo/jp-postal-master-migration-contract.test.ts scripts/postal-master/import-japan-post.test.ts
git diff --check -- supabase/migrations/20260901001246_jp_postal_master.sql supabase/tests/jp_postal_master_rpc.test.sql src/lib/geo/jp-postal-master-migration-contract.test.ts scripts/postal-master/import-japan-post.ts scripts/postal-master/import-japan-post.test.ts
```

Do not execute pgTAP or SQL in this phase. Editing `supabase/tests/jp_postal_master_rpc.test.sql` prepares the later fresh disposable-database gate only.

## Protected paths

`src/components/estimates/wizard/screens/ScreensPreview.tsx` and the protected LINE migration, monthly-invoice migration, and monthly-invoice boundary test remain pathname/mode/blob/status metadata only. Never open, read, diff, copy, stage, or modify their contents.

Required blobs:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- monthly-invoice test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## Prohibited actions

- No edits outside the exact five-path write allowlist.
- No database, Supabase CLI, Auth, Storage, RPC execution, migration action, CSV download/import, provider, Vercel, Preview, production, or external-service access.
- No real Japan Post dataset, PDF, PII, customer data, secret, environment value, database row, or log in the implementation packet or result.
- No dependency install/update and no package or lockfile edit.
- No Git stage, commit, push, clean, stash, restore, PR comment, Ready, merge, or deployment.
- No executable test beyond the exact focused TypeScript command and five-path `git diff --check` above.

## Required result

Return identifier:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R4_IMPLEMENTATION_RESULT_V1`

Then report:

1. `VERDICT`: `IMPLEMENTED_TESTED`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, or `BLOCKED_READ_SCOPE`
2. `BASE_AND_SCOPE_PROOF`
3. `EXACT_CHANGED_PATHS`
4. `SHARED_SCHEMA_PRIVILEGE_REPAIR`
5. `RESUME_AND_IDEMPOTENCY_REPAIR`
6. `PROJECT_REF_AND_VALIDATE_ONLY_REPAIR`
7. `FOCUSED_TEST_RESULTS`
8. `PER_PATH_SHA256`
9. `PROTECTED_AND_NO_EXTERNAL_ACTION_PROOF`
10. `REMAINING_RUNTIME_AND_ENVIRONMENT_GATES`

Stop after the result. Do not stage or commit.
