# Claude Directive — GDA Estimate Managed Service Offering R1-B Direct RPC/SQL Read-only Diagnosis

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_DIRECT_RPC_SQL_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-B`
- Mode: one bounded read-only direct-RPC/SQL diagnosis only
- Responsible diagnosis agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This invocation must identify the smallest forward-only SQL, pgTAP, and fresh disposable-local-database phase that prevents a caller from bypassing the accepted server-save offering guard by invoking `public.save_estimate_from_wizard` directly. It must not edit files, run tests, start a database, contact a provider, mutate Git, or redesign any accepted UI or business rule.

## Invocation identity

MacBook Codex must supply the exact committed governance execution HEAD and tree containing this directive.

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#44`, which must remain `OPEN/Draft`.
- Branch must be `plan/estimate-managed-service-offering-enforcement-r1`.
- Accepted Phase-A source predecessor must be commit `1bb530f3105055707b7387f6492ede3078402f36` with tree `daddebc2e89919b22cdb534d1cb91c07b3474787`.
- The accepted Phase-A source predecessor must be an ancestor of the supplied governance execution HEAD.
- The committed delta from that predecessor to the supplied execution HEAD must contain exactly these three governance paths:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_DIRECT_RPC_SQL_READ_ONLY_DIAGNOSIS.md`
- The worktree and index must be clean before diagnosis.

If PR state, branch, identity, ancestry, exact-delta, or clean-state verification fails, return `BLOCKED_BASE_MISMATCH` and stop.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_A_SERVER_SAVE_IMPLEMENTATION.md`
6. This directive

Then state the active phase, exact read allowlist, protected paths, frozen contract, prohibitions, and stop boundary before diagnosis.

## Literal SQL and contract read allowlist

Only the following implementation paths may be opened or searched:

1. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
2. `src/components/estimates/wizard/save/estimate-persistence-payload.ts`
3. `src/components/estimates/wizard/save/save-estimate-from-wizard-action.ts`
4. `src/components/estimates/wizard/save/save-estimate-from-wizard-action.test.ts`
5. `src/components/estimates/wizard/save/save-estimate-from-wizard-intent-action.ts`
6. `src/components/estimates/wizard/save/wizard-save-intent-types.ts`
7. `src/lib/estimates/service-categories.ts`
8. `supabase/migrations/102_estimate_wizard_atomic_save.sql`
9. `supabase/migrations/104_least_privilege_grants.sql`
10. `supabase/migrations/110_store_pricing_configuration.sql`
11. `supabase/migrations/20260719122621_estimate_wizard_atomic_save_hardening.sql`
12. `supabase/migrations/20260720024724_estimate_wizard_atomic_numbering.sql`
13. `supabase/migrations/20260726090000_extend_estimate_wizard_snapshot_metadata.sql`
14. `supabase/migrations/20260727033223_persist_wizard_customer_canonical_columns.sql`
15. `supabase/migrations/20260728150348_dealer_service_offerings.sql`
16. `supabase/migrations/20260825151059_persist_existing_vehicle_confirmed_body_size.sql`
17. `supabase/tests/estimate_wizard_atomic_save.test.sql`
18. `supabase/tests/estimate_wizard_dml_integrity.test.sql`
19. `supabase/tests/grant_rls_role_matrix.test.sql`
20. `supabase/tests/function_trigger_matrix.test.sql`
21. `package.json`

Do not open any other migration, source, test, schema, generated type, or configuration file. Git pathname metadata may be used to determine which allowed migration is the last definition of an object. If one exact superseding definition or called object cannot be proved from this list, return one bounded follow-up read request naming the minimum path; do not broaden the read set yourself.

## Literal existing harness reference allowlist

The following existing B7-4 paths are read-only structural references. They are not authorized future edit targets:

1. `scripts/e2e/b7-4/setup.sh`
2. `scripts/e2e/b7-4/seed.sql`
3. `scripts/e2e/b7-4/assertions.sql`
4. `scripts/e2e/b7-4/capture-evidence.sh`
5. `scripts/e2e/b7-4/cleanup.sh`
6. `scripts/e2e/b7-4/config.toml`
7. `scripts/e2e/b7-4/run-app.sh`
8. `scripts/e2e/b7-4/run-e2e-auto.sh`
9. `scripts/e2e/b7-4/verify.md`
10. `scripts/e2e/b7-4/e2e/b7-4.spec.ts`
11. `scripts/e2e/b7-4/e2e/playwright.config.ts`

If these files do not provide enough proof for a fresh disposable SQL-only harness, return one bounded follow-up read request rather than guessing or reusing a browser/UI harness blindly.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs at the accepted Phase-A predecessor:

- `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `32fda49583ae1217bc13711784ad8fa31744726c`
- `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Frozen product and security contract

1. The managed families remain exactly `window_film`, `ppf`, `maintenance`, `room_cleaning`, and `car_wash`.
2. The existing category authority remains `src/lib/estimates/service-categories.ts`; SQL must not silently invent a conflicting sixth vocabulary or redefine `coating`/`other` as managed.
3. `coating` and `other` remain outside this offering-switch contract.
4. PR #43 Step-3 UI and accepted Phase-A server-save behavior are frozen.
5. `public.dealer_service_offerings` is the dealer-owned offering authority. A missing row or `enabled = false` means OFF.
6. The SQL/RPC gate must derive the dealer from the authenticated, tenant-owned save contract. It must never trust a caller-supplied offering map, rank, UI state, catalog inference, or service-role shortcut.
7. Direct RPC input carrying any disabled managed-family intent must fail atomically with zero estimate, item, numbering, revision, or related mutation.
8. Enabled-family saves and all accepted coating/other behavior must remain unchanged.
9. Preserve the existing actor, tenant, role, stale-revision, DTO, idempotency, numbering, vehicle/body-size, pricing snapshot, and least-privilege contracts.
10. The diagnosis must determine the exact safe error/return contract and precedence from current SQL and TypeScript evidence; do not invent a public family-specific failure.
11. Historical migrations are immutable. Any repair must be one new forward-only migration created only in a later separately authorized implementation phase.
12. Database acceptance must use a fresh loopback-only PostgreSQL 17 disposable runtime with real authenticated claims and direct RPC calls. Hosted/shared/staging/production Supabase is forbidden.
13. A failed disposable suffix and its evidence are burned and never repaired into acceptance.
14. Phase B is not complete from source inspection, pgTAP alone, or the server action alone. Static source, pgTAP, and fresh disposable direct-RPC evidence are all required later.

## Required diagnosis questions

Answer every question with file-and-line evidence:

1. Which allowed migration is the last active definition of `public.save_estimate_from_wizard`, and what exact signature, owner/security mode, `search_path`, grants, and return/error contract does it expose?
2. What exact JSON/RPC fields reach SQL for each selected estimate line, and which stable field or relation can map a persisted intent to each of the five managed families without trusting a new client flag?
3. Can the canonical application category-to-family mapping be represented in SQL by joining an existing authority, or is one explicit SQL mapping unavoidable? Identify the smallest non-drifting option and its migration impact.
4. At what exact point does the active function resolve authenticated user, dealer/tenant, membership/role, configuration revision, idempotency, and numbering? Give the required precedence for offering rejection without weakening any earlier fail-closed guard.
5. How must SQL interpret missing, false, true, duplicate, inactive, or cross-tenant `dealer_service_offerings` rows? Confirm that absence and false both deny and that another tenant's row can never authorize the caller.
6. Identify every write the active function can perform and the exact transaction/exception behavior needed to prove a disabled-family rejection leaves zero mutation, including sequence/number allocation and idempotency records.
7. Trace every production-capable direct caller and grant path for the RPC. Confirm which roles can invoke it and whether RLS, function security mode, or a direct SQL caller can bypass dealer offering ownership today.
8. Determine the smallest new forward-only migration contract: object(s) replaced or added, required privilege re-grants, comments, stable error/return mapping, and how later migrations remain preserved. Do not assign a timestamp or create the migration.
9. Determine the smallest pgTAP write allowlist and exact assertions for all five families OFF-by-absence, OFF-by-false, ON-by-true, mixed-family input, coating/other unaffected, cross-tenant denial, stale revision precedence, idempotent replay, and zero-write rollback.
10. Determine whether any race between offering changes and save requires locking or one transaction snapshot assertion. If yes, specify the exact separate-connection test; if no, prove why current transaction semantics are sufficient.
11. Define the smallest dedicated fresh disposable harness path set, required PostgreSQL/Supabase CLI version checks, unique suffix rule, loopback-only checks, real signed claim roles, direct REST/RPC requests, raw SQL evidence, cleanup, hash manifest, and fail/burn behavior.
12. Provide the exact later implementation sequence and literal write allowlists as separate gates: forward-only source/pgTAP candidate, harness implementation, fresh disposable execution, result recording, Git delivery, Ready, merge, and any shared/production application.
13. Confirm that no UI redesign, settings mutation, pricing change, data backfill, rank decision, owner business decision, or production access is required.

## Allowed commands

Read-only only:

- `git status --short --branch`
- `git rev-parse HEAD HEAD^{tree}`
- `git merge-base --is-ancestor <phase-a-predecessor> HEAD`
- `git diff --name-only <phase-a-predecessor>...HEAD`
- `git ls-tree HEAD -- <protected-path>`
- `git log --format=... -- <allowed-migration-paths>` only to establish supersession order
- `sed`, `rg`, `wc`, and `sha256sum`/`shasum` limited to mandatory documents and literal allowlists

Do not run tests, typecheck, build, application runtime, browser, Docker, Colima, Supabase CLI, SQL, PostgreSQL, Auth, PostgREST, network, provider, package manager, or package-install commands.

## Prohibitions and stop boundary

- Do not modify, create, delete, rename, format, stage, commit, push, stash, restore, clean, or reset any file.
- Do not create or mutate a PR/comment, mark Ready, merge, deploy, or access Preview/production.
- Do not contact GitHub APIs, Supabase, Auth, Vercel, or any other external service.
- Do not expose secrets, auth material, raw customer data, or private file contents outside the one explicitly authorized diagnosis transmission.
- Stop immediately after returning the one report.

## Required result schema

Return:

1. `verdict`: `PASS_NO_SQL_CHANGE_REQUIRED`, `CHANGES_REQUIRED_SQL_AND_TESTS`, `BLOCKED_READ_SCOPE`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, full HEAD/tree, Phase-A predecessor ancestry, exact committed governance delta, PR state supplied by Codex, and clean-state result.
3. Active RPC definition table: defining migration, signature, owner/security/search-path/grants, caller roles, tenant authority, write order, and error/return behavior.
4. A five-row family table: family, incoming RPC evidence, SQL mapping authority, OFF/ON lookup semantics, and current bypass status.
5. Exact guard position and precedence, plus proof of atomic zero-write failure.
6. Exact smallest forward-only source/pgTAP write allowlist and focused static command, without implementation.
7. Exact smallest dedicated disposable-harness write allowlist and execution command, or one bounded follow-up read request if literal paths cannot be proved.
8. Required direct-RPC cases, real claim roles, cross-tenant cases, optional separate-connection race case, evidence files, hash manifest, cleanup, and fail/burn rules.
9. Protected-path metadata-only verification.
10. Explicit confirmation that no file, test, Git, database, Supabase, provider, Preview, or production mutation occurred.
11. Owner decision required: `NONE` or one exact question.

Stop after the report. Do not author or implement the SQL phase.
