# Claude Directive — GDA Estimate Wizard 郵便番号マスター R5 Disposable-DB Harness Implementation

## Directive identity

- Directive ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_HARNESS_IMPLEMENTATION_V1`
- Phase: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DISPOSABLE_DB_VERIFICATION`
- Mode: `BOUNDED_HARNESS_SOURCE_CANDIDATE_ONLY`
- Repository: `nisikawa-officeAZ/GYEON`
- Required PR: `#48`, `OPEN/Draft`, base `main`
- Required branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Required execution HEAD/tree: MacBook Codexがinvocation時に固定する受理済みgovernance commit/tree
- Target migration: `supabase/migrations/20260901001246_jp_postal_master.sql`
- Target SHA-256: `2325168075511e7a1657f6c2b2299109a41a0181ac590a86817cf94d44467f7a`
- Target: uncommitted seven-path harness candidate

This directive is governance only. It does not authorize Claude transmission or invocation, file writes, tests, Git delivery, Colima/Docker/database/Supabase runtime, Auth/PostgREST, provider/network access, hosted environment access, migration application, CSV import, PR mutation, Ready, merge, or deployment. Every action remains separately gated.

## Required first reads

Read completely before implementation:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. the latest postal-master entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DISPOSABLE_DB_VERIFICATION_PLAN.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R4_IMPLEMENTATION.md`
6. the exact five R4 source/test paths listed below
7. existing `scripts/e2e/gyeon-order-v3-c5d/` files only as read-only safety-pattern reference, if present

Exact R4 source/test read scope:

1. `supabase/migrations/20260901001246_jp_postal_master.sql`
2. `supabase/tests/jp_postal_master_rpc.test.sql`
3. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
4. `scripts/postal-master/import-japan-post.ts`
5. `scripts/postal-master/import-japan-post.test.ts`

No protected file content may be read even if another document references it.

## Preflight stop conditions

Return `BLOCKED_BASE_OR_SCOPE` without writing if any condition fails:

- PR/branch/invocation-supplied HEAD/tree differ;
- PR is not `OPEN/Draft` against `main`;
- worktree or index is not clean;
- GitHub PR headRefOid differs from local HEAD;
- target migration path/mode/blob/SHA-256 differs or same-name candidate count is not exactly one;
- any R4 source/test hash differs from the invocation manifest;
- repository contains `supabase/config.toml` or `supabase/.temp/project-ref` unexpectedly;
- protected metadata differs;
- any target harness path already exists;
- implementation needs an eighth path or an existing-file edit;
- implementation would require weakening or bypassing canonical project-ref binding.

Do not require the local branch upstream to equal HEAD when its configured upstream is `origin/main`; GitHub PR headRefOid equality is the remote branch authority for this phase.

## Exact write allowlist

Create only these seven new paths:

1. `scripts/e2e/gda-estimate-postal-master-r5/config.toml`
2. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
3. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
4. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`
5. `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs`
6. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`
7. `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql`

No existing file may be edited, deleted, moved, formatted, staged, or copied over. Do not touch source, migration, tests, dependencies, lockfiles, repository config, UI, existing C5 harness, provider code, or environment files.

## Harness contract

Implement two isolated loopback-only lanes under one fresh suffix:

- `fresh`: full-chain CLI-native migration replay, postal pgTAP, real Auth/PostgREST lookup, grant/RLS and shared-schema non-regression, lint;
- `import`: separate full-chain replay followed by service-role PostgREST import-RPC interruption/resume, duplicate no-op, promotion, status safety, terminal fail-closed, importer validate-only, and importer local-URL rejection.

The harness must:

- require confirmation literal `I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE`;
- require invocation-supplied accepted HEAD/tree and GitHub PR headRefOid equality;
- require an unused UTC timestamp plus six-lowercase-alphanumeric suffix;
- create runtime only outside the worktree and outside `/private/tmp`;
- reject existing runtime paths, linked projects, hosted/pooler URLs, non-loopback hosts, and source drift before start;
- allocate distinct project IDs and all relevant ports per lane;
- stage formal migrations byte-identically, exclude `DRAFT_DO_NOT_APPLY`, and record the protected LINE migration as `excluded_protected` without reading it;
- apply migrations only through current local Supabase CLI native commands discovered from `--help`;
- never apply the target migration through `psql -f`;
- use deterministic synthetic rows only; never download Japan Post data or store real names/addresses;
- call local service-role RPC directly only from the R5 import test driver;
- verify the production importer rejects localhost as `NON_CANONICAL_SUPABASE_URL` before client creation;
- never add a localhost/test bypass to production importer;
- burn the entire suffix on either lane failure;
- attempt stop/removal of both lanes exactly once during cleanup;
- redact anon/service-role keys, JWTs, passwords, raw stack banners, and address rows from output/evidence.

## Required runtime proof design

The candidate must implement evidence capture for:

### Fresh lane

- full formal migration replay and exactly-one target migration ledger entry;
- execution of the existing postal pgTAP file through local `supabase test db` behavior;
- direct table privilege denial for browser roles and contract-correct service access;
- real authenticated active-member lookup success;
- anon, inactive, missing-membership, and cross-dealer denial;
- normalized postal lookup, multiple candidates, empty result, active-batch filtering, bounded input;
- preservation of the existing GYEON-order private-function/RLS contract;
- `db lint` error count zero.

### Import lane

- begin/append interruption followed by a new-process status/resume;
- skip of accepted sequences;
- duplicate sequence successful zero-write no-op;
- finalize/promote and active lookup;
- already-promoted idempotent success;
- rejected, rolled-back, and promoted-but-superseded fail-closed identity;
- status RPC safe metadata only;
- validate-only with zero client construction and zero HTTP/RPC;
- mutating importer localhost refusal before client construction.

## Static verification only during implementation

Do not run setup, capture, cleanup, Colima, Docker, psql, SQL, Auth, PostgREST, HTTP, provider, network, or database-affecting Supabase commands while authoring the candidate.

Run only:

- `SUPABASE_TELEMETRY_DISABLED=1 supabase --version` and required Supabase `--help` commands;
- `bash -n` on the three new shell files;
- `node --check` on the two new `.mjs` files;
- non-runtime SQL static checks only;
- exact seven-path changed-file verification;
- `git diff --no-index --check /dev/null <new-path>` for every new path;
- static positive/zero-match checks for loopback-only, two lanes, no linked/hosted access, fresh suffix, burn, cleanup, CLI-native migration, no direct target `psql -f`, synthetic-only, no secrets, and no project-ref bypass;
- protected pathname/mode/blob/Git-state verification only.

Harness implementation PASS is not runtime approval and is not stage/commit/push approval.

## Protected paths

Metadata only. Never open, read, print, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` — blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` — blob `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — blob `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — blob `fe3c80f22fd80dcbfab076082473216dda582c14`

## Required result

Return `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_HARNESS_IMPLEMENTATION_RESULT_V1` with:

1. verdict: `READY_FOR_CODEX_STATIC_REVIEW`, `CHANGES_REQUIRED_HARNESS`, or `BLOCKED_BASE_OR_SCOPE`;
2. PR, branch, HEAD, tree, PR-head equality, clean pre-state;
3. exact seven new paths and confirmation that no existing path changed;
4. migration and R4 source/test identity;
5. protected metadata;
6. two-lane architecture and the explicit canonical-project-ref non-bypass design;
7. syntax/static command results and exit codes;
8. confirmation that no runtime, DB, network, hosted environment, Git delivery, or PR action occurred;
9. known limitation: disposable execution, Development history preflight, migration apply, and real CSV import remain unrun.

Return only to the invoking Codex session. Do not persist a result file and do not post to GitHub.
