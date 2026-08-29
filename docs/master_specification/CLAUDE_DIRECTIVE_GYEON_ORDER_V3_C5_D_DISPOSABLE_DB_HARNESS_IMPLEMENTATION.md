# Claude Directive — GYEON Order V3 C5-D Disposable-DB Harness Implementation

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_D_DISPOSABLE_HARNESS_IMPLEMENTATION_V1`
- Phase: `GYEON_ORDER_V3_C5_D_DISPOSABLE_DB_VERIFICATION`
- Mode: `BOUNDED_HARNESS_SOURCE_CANDIDATE_ONLY`
- Repository: `nisikawa-officeAZ/GYEON`
- Required branch: `agent/gyeon-order-v3-c5d-formal-migration-promotion`
- Required execution HEAD/tree: exact accepted governance commit/tree supplied by MacBook Codex at invocation
- Formal migration: `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
- Formal SHA-256: `bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b`
- Previous migration version: `20260826143000`
- Target: uncommitted ten-path harness candidate

This directive is governance only. It does not authorize external transmission, Claude execution, file writes, tests, Git delivery, Colima/Docker, database/Supabase runtime, Auth/PostgREST, provider access, network access, environment application, PR mutation, Ready, merge, or deployment. Every such action remains separately gated.

## Required first reads

Read completely before implementation:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. latest C5-D entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/integrations/gyeon-order/v3-c5d-formal-migration-promotion-plan.md`
5. `docs/integrations/gyeon-order/v3-c5d-disposable-db-verification-plan.md`
6. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-result.md`
7. all nine files under `scripts/e2e/gyeon-order-v3-c5c/` as read-only reference

## Preflight stop conditions

Return `BLOCKED_BASE_OR_SCOPE` without writing if any condition fails:

- branch, invocation-supplied HEAD, or tree differs;
- worktree or index is not clean;
- upstream is missing or differs from HEAD;
- main base `96a66c3fb5969718418da1ef4c75fe62407b48aa` is not an ancestor;
- formal path/hash differs or candidate count is not exactly one;
- DRAFT hash differs or its terminal ROLLBACK guard is absent;
- protected blob metadata differs;
- any target harness path already exists;
- implementation needs an eleventh path or an existing-file edit.

## Exact write allowlist

Create only these ten new paths:

1. `scripts/e2e/gyeon-order-v3-c5d/config.toml`
2. `scripts/e2e/gyeon-order-v3-c5d/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c5d/capture-evidence.sh`
4. `scripts/e2e/gyeon-order-v3-c5d/cleanup.sh`
5. `scripts/e2e/gyeon-order-v3-c5d/real-auth.mjs`
6. `scripts/e2e/gyeon-order-v3-c5d/concurrency.mjs`
7. `scripts/e2e/gyeon-order-v3-c5d/schema-rls.test.sql`
8. `scripts/e2e/gyeon-order-v3-c5d/qualification-evidence.test.sql`
9. `scripts/e2e/gyeon-order-v3-c5d/prepare-finalize-warehouse.test.sql`
10. `scripts/e2e/gyeon-order-v3-c5d/populated-upgrade.test.sql`

No existing file may be edited, deleted, moved, formatted, staged, or copied over. Do not touch migrations, DRAFT, C5-C harness, dependencies, lockfiles, config outside the new directory, UI, provider code, or Office AZ inventory code.

## Harness contract

Implement three isolated loopback-only runtime lanes beneath one fresh suffix:

- `fresh`: full chain through current `supabase db reset --local` behavior;
- `populated`: reset through version `20260826143000`, insert representative legacy fixtures, then apply pending formal migration through `supabase migration up --local`;
- `runner`: reset through version `20260826143000` without fixtures, prove formal pending, apply it through `supabase migration up --local`, then prove it applied exactly once.

Discover exact flags first with current `supabase db reset --help`, `supabase migration up --help`, `supabase migration list --help`, and `supabase db lint --help`. Record the discovered CLI version and commands. Never use `psql -f` to apply the formal migration.

The harness must:

- require exact confirmation literal `I_UNDERSTAND_GYEON_ORDER_V3_C5D_IS_DISPOSABLE`;
- require invocation-supplied accepted HEAD/tree;
- require a fresh suffix matching UTC timestamp plus six lowercase alphanumerics;
- reject existing runtime paths, linked projects, hosted URLs, non-loopback DB/API hosts, and source drift before start;
- stage only formal migrations, exclude `DRAFT_DO_NOT_APPLY`, and record protected LINE migration as `excluded_protected` without reading it;
- copy the formal migration byte-identically and bind its hash;
- use `GYEON_ORDER_V3_C5D_PSQL_BIN` for fixture/assertion/cleanup only, verify it is executable, and record its version;
- keep A/B/C project IDs and ports distinct;
- burn the entire suffix on any lane failure;
- stop and remove all partially or fully started lanes exactly once;
- never print or retain local anon/service-role keys, JWTs, passwords, or raw start banners.

## Evidence contract

The candidate must implement evidence capture for:

- A: formal full replay, migration list, pgTAP, real Auth/PostgREST, qualification, prepare/finalize, warehouse, genuine separate-connection concurrency, advisor, bounded plans;
- B: pre/post legacy fingerprints covering multiple dealers, four statuses, positive item quantity, nullable legacy values, money, timestamps, PK/FK, row counts, and constraint success;
- C: pending/applied migration lists, CLI command/exit timestamps, exactly one formal ledger row, and zero direct-psql formal application;
- aggregate source/harness hashes, command ledgers, backend PIDs, secret scan, fixture zero, cleanup, stop/removal, retained artifact hashes.

Retain C5-C assertion breadth. Do not weaken, delete, skip, TODO, or reduce existing schema/business/Auth/concurrency contracts while adapting them to C5-D labels and environment variables.

## Static verification only

During harness implementation, do not run setup, capture, cleanup, any database-affecting Supabase CLI command, Colima, Docker, psql, SQL, Auth, PostgREST, HTTP, provider, or network commands. The telemetry-disabled Supabase `--version` and exact `--help` commands listed below are the only permitted Supabase CLI executions.

Run only:

- `SUPABASE_TELEMETRY_DISABLED=1 supabase --version` and `supabase db reset --help`, `supabase migration up --help`, `supabase migration list --help`, `supabase db lint --help` with the same telemetry-disabled environment;
- `bash -n` on the three new shell files;
- `node --check` on the two new `.mjs` files;
- exact ten-path changed-file verification;
- `git diff --no-index --check /dev/null <new-path>` for every new path;
- static positive/zero-match checks for formal path/hash, previous version, three lanes, loopback-only, burn, cleanup, CLI-native application, and the `psql -f` formal-application prohibition;
- protected pathname/mode/blob/Git-state verification only.

## Protected paths

Metadata only. Never open, read, print, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` — blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` — blob `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — blob `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — blob `fe3c80f22fd80dcbfab076082473216dda582c14`

## Required result

Return `GYEON_ORDER_V3_C5_D_DISPOSABLE_HARNESS_IMPLEMENTATION_RESULT_V1` with:

1. verdict: `READY_FOR_CODEX_STATIC_REVIEW`, `CHANGES_REQUIRED_HARNESS`, or `BLOCKED_BASE_OR_SCOPE`;
2. branch, HEAD, tree, upstream equality, clean pre-state;
3. exact ten new paths and confirmation no existing path changed;
4. formal/DRAFT identity and protected metadata;
5. A/B/C architecture and CLI-native proof design;
6. syntax/static command results and exit codes;
7. confirmation that no DB/Supabase runtime, Colima, Docker, psql, SQL, Auth, PostgREST, HTTP, provider, network, Git delivery, or PR action occurred;
8. known limitations: disposable execution and evidence review are not yet run.

Return only to the invoking Codex session. Do not persist a result file and do not post to GitHub.
