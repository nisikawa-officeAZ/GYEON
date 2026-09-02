# GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R3_READ_ONLY_REPAIR_DIAGNOSIS

Directive ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R3_READ_ONLY_REPAIR_DIAGNOSIS_V1`

## Objective

Perform one bounded read-only diagnosis of the Japan Post postal-master migration and importer before any environment activation. Confirm or refute four pre-activation safety defects: shared `private`-schema privilege regression, all-pending migration-chain blast radius, interrupted-import recovery failure, and missing target-project guard/validate-only mode. Return the smallest safe later repair allowlist and verification plan.

Do not implement, edit, test, execute Git, connect to a database or provider, apply a migration, import a dataset, or recommend an activation command that can silently apply unrelated migrations. Diagnosis and repair remain separate gates.

## Dispatch identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#48`, required `OPEN` and `Draft`
- Base branch: `main`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Source baseline commit: `d220c480947d09f0f21d834301e037a86d5f2d88`
- Source baseline tree: `92fdcdbde39e56cdb6e8adf7f32e779292fbb62b`
- Observed `origin/main`: `49a1dc4c396e50d5869f372a399c9ca1c10bc300`
- A later owner-approved dispatch must provide exact `DISPATCH_HEAD` and `DISPATCH_TREE` after this three-path governance candidate is committed and normally pushed.
- The source baseline must be an ancestor of `DISPATCH_HEAD`.
- The baseline-to-dispatch delta must be exactly the three governance paths named below.
- Responsible diagnosis agent: MacBook terminal Claude Code
- Independent acceptance authority: MacBook Codex

Return `BLOCKED_CANDIDATE_DRIFT` without diagnosis if identity, ancestry, clean committed state, exact governance delta, PR state, or protected metadata differs.

## Mandatory complete read scope

Read only these paths completely:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R3_READ_ONLY_REPAIR_DIAGNOSIS.md`
5. `supabase/migrations/20260901001246_jp_postal_master.sql`
6. `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
7. `supabase/migrations/20260826143000_window_film_v1_atomic_persistence.sql`
8. `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql`
9. `scripts/postal-master/import-japan-post.ts`
10. `scripts/postal-master/import-japan-post.test.ts`
11. `src/lib/geo/jp-postal-master-csv.ts`
12. `src/lib/geo/jp-postal-master-csv.test.ts`
13. `src/lib/geo/jp-postal-master-contract.ts`
14. `src/lib/geo/jp-postal-master-contract.test.ts`
15. `src/lib/geo/jp-postal-master-actions.ts`
16. `src/lib/geo/jp-postal-master-actions.test.ts`
17. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
18. `supabase/tests/jp_postal_master_rpc.test.sql`
19. `supabase/tests/data_api_matrix.test.sql`
20. `supabase/tests/grant_rls_role_matrix.test.sql`
21. `supabase/tests/catalog_manifest.test.sql`
22. `src/components/estimates/wizard/steps/postal-master-apply.ts`
23. `src/components/estimates/wizard/steps/postal-master-apply.test.ts`
24. `package.json`

If one additional existing path is essential, stop with `BLOCKED_READ_SCOPE` and identify the exact path and reason. Do not read it.

## Mandatory diagnosis

### A. Shared-schema and object privilege safety

Trace the effects of the postal migration's schema and table privilege statements against every earlier allowed migration in scope. Determine:

1. Whether revoking `authenticated` usage from `private` makes an existing authenticated SECURITY DEFINER/private-function contract unusable.
2. Whether schema-wide `revoke all on all tables in schema private` changes unrelated objects.
3. The smallest object-scoped repair for new postal tables, sequences, functions, and RPCs that preserves existing consumers and remains fail closed.
4. The exact regression assertions needed for authenticated, anon, service-role, and public roles.

Do not solve this by restoring broad shared-schema privileges without proving least privilege.

### B. Migration-chain activation safety

Use source order only; do not query an environment. Explain how normal Supabase migration application handles all pending migrations in timestamp order. Given that the postal migration follows three earlier migrations, return:

1. The exact preflight evidence needed to compare remote migration history with local history.
2. Whether postal activation can proceed independently without applying the earlier pending migrations.
3. The safest owner-decision options if it cannot, including their tradeoffs and required approval boundaries.
4. Commands that are read-only in preflight and commands that would mutate an environment, clearly separated.

Never recommend `supabase db push` or an equivalent all-pending action as postal-only unless the exact history proves that assertion.

### C. Interrupted-import lifecycle

Trace begin, chunk append, validation, promotion, rollback, duplicate source date/checksum, and concurrency. Diagnose the state after a network/process failure during chunk upload or validation. Return a deterministic later contract for one of:

- resume of the exact batch with identity/checksum/offset validation; or
- explicit fail-closed abort/reject followed by a fresh import.

Specify batch-id visibility, legal transitions, retry idempotency, row-count/chunk sequencing, lock/concurrency rules, stale-batch handling, audit evidence, and rollback. A batch must never remain permanently undiscoverable or block the same official source forever.

### D. Target environment and validate-only guards

Determine the smallest CLI contract that prevents a valid service-role secret from writing to the wrong Supabase project. At minimum analyze:

- mandatory `--expected-project-ref` or equivalent explicit identity;
- canonical parsing and comparison against `SUPABASE_URL`;
- refusal on custom/ambiguous hosts unless a separately approved identity mechanism exists;
- validate-only mode that parses, validates, counts, normalizes, hashes, and reports without network/database calls;
- explicit final confirmation for mutating mode;
- logs containing only safe batch/count/checksum/source-date metadata, never addresses, CSV rows, secrets, or tokens.

### E. Later repair and verification boundary

Return:

1. Any additional severity-one or severity-two source defects found strictly within the read scope.
2. The smallest literal future write allowlist; separate mandatory repair files from test-only/catalog files.
3. Focused unit/source-contract commands.
4. Disposable PostgreSQL/Supabase runtime tests proving privilege preservation, role denial, import interruption/recovery, concurrency, idempotency, rollback, active-pointer atomicity, and no partial promotion.
5. Failure-injection cases for interrupted chunks and validation.
6. A separate read-only environment-preflight gate and a later owner-approved activation/import gate.

Do not include OCR, customer/vehicle mapping, vehicle name, chassis, grade, pricing, PPF/coating, save RPC, or unrelated order implementation in the later repair allowlist.

## Governance write allowlist

The only paths that may differ from the source baseline in the later dispatch commit are:

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R3_READ_ONLY_REPAIR_DIAGNOSIS.md`

This directive itself authorizes no write.

## Protected paths

`src/components/estimates/wizard/screens/ScreensPreview.tsx` is pathname/mode/blob/status metadata only. Never open, read, diff, copy, stage, or modify it.

The following also remain unchanged and content must not be opened during this diagnosis:

- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Required baseline blobs:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `line_link_tokens`: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- monthly-invoice test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## Prohibited actions

- No file edit, creation, deletion, formatting, or generated artifact.
- No executable test, typecheck, build, dev server, browser, dependency, shell, Git, or CLI command.
- No Git stage, commit, push, clean, stash, restore, PR comment, Ready, merge, or deployment.
- No database, Supabase, Auth, Storage, RPC execution, migration action, CSV download/import, provider, Vercel, Preview, production, or external-service access.
- No real PDF, PII, customer data, address row, secret, environment value, database row, or log in the diagnosis packet or result.
- No implementation recommendation that silently broadens beyond the smallest literal later allowlist.

## Required result

Return identifier:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R3_READ_ONLY_REPAIR_DIAGNOSIS_RESULT_V1`

Then report:

1. `VERDICT`: `READY_FOR_BOUNDED_POSTAL_R3_REPAIR`, `OWNER_DECISION_REQUIRED_MIGRATION_CHAIN`, `CHANGES_REQUIRED_DIAGNOSIS`, `BLOCKED_CANDIDATE_DRIFT`, or `BLOCKED_READ_SCOPE`
2. `BASE_AND_SCOPE_PROOF`
3. `SHARED_SCHEMA_PRIVILEGE_FINDINGS`
4. `OBJECT_SCOPED_REPAIR_CONTRACT`
5. `MIGRATION_CHAIN_FINDINGS_AND_OWNER_OPTIONS`
6. `INTERRUPTED_IMPORT_ROOT_CAUSE_AND_RECOVERY_CONTRACT`
7. `TARGET_PROJECT_AND_VALIDATE_ONLY_CONTRACT`
8. `ADDITIONAL_HIGH_SEVERITY_FINDINGS`
9. `EXACT_FUTURE_WRITE_ALLOWLIST`
10. `FOCUSED_AND_DISPOSABLE_RUNTIME_TEST_PLAN`
11. `SEPARATE_ENVIRONMENT_PREFLIGHT_AND_ACTIVATION_GATES`
12. `PROTECTED_AND_NO_EXTERNAL_ACTION_PROOF`
13. `REMAINING_OWNER_DECISIONS`

Stop after the result.
