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

## Current known state (2026-09-02)

Design and ratification are pushed to PR #48. A first implementation invocation stopped before any write because plan/ledger ratification was missing. A later invocation created the seven-path harness candidate listed in the write allowlist below; it remains Git-untracked, unstaged, and uncommitted. Codex static review found defects requiring repair (`CHANGES_REQUIRED`). A first repair attempt partially changed `setup.sh`, `capture-evidence.sh`, and `cleanup.sh` but ended incomplete. A second seven-file repair attempt changed nothing. The bounded four-document dealer-boundary/runtime-location doc repair (`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DOC_REPAIR_RESULT_V1`) then completed. Codex static re-review of the harness candidate found two remaining source findings — A) the OS-temp exclusion was not enforced in source across `setup.sh`/`capture-evidence.sh`/`cleanup.sh`, and B) `real-auth.mjs`/`import-resume.mjs`/`runtime-contract.test.sql` used postal/JIS fixture values resembling or colliding with real Japan Post data — plus stale governance status wording (finding C). The bounded three-shell-script OS-temp exclusion repair (finding A) is now completed, and a final repair (result marker `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_FINAL_STATIC_REPAIR_RESULT_V1`) applied findings A, B, and C together as one candidate. Codex static review of that candidate returned `CHANGES_REQUIRED_HARNESS`: the synthetic postal/JIS fixture correction (finding B) was accepted, but the OS-temp fail-closed ordering in finding A's repair was defective — `setup.sh`/`capture-evidence.sh`/`cleanup.sh` could each write burn evidence (`mkdir`, `burned.txt`) into an unvalidated `LANE_DIR`/`SUFFIX_DIR`/`RUNTIME_DIR`/retained-destination path from inside the very failure path triggered by that path's own excluded-root rejection. This repair (result marker `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_OS_TEMP_GUARD_REPAIR_RESULT_V1`) introduces a `PATHS_VALIDATED` gate in all three shell scripts: canonical runtime parent, suffix path, and lane path (plus, in `cleanup.sh`, retained-evidence parent and derived retained destination) are all validated outside every excluded root before ordinary failure handling or the EXIT trap may write burn evidence; a prevalidation rejection is non-writing (stderr and exit only). Codex static review of that candidate again returned `CHANGES_REQUIRED_HARNESS`: in `cleanup.sh`, the retained-destination existence check (`[[ ! -e "$RETAINED_DIR" ]]`) ran before `PATHS_VALIDATED=1`, so when the four canonical paths were safe but `RETAINED_DIR` already existed, `fail()` exited without burning the safe existing suffix, weakening the one-attempt/no-retry contract. A first closeout dispatch invocation (Claude session `d5ca2074-2f62-4bc6-b407-3e2e84d10970`) used one unauthorized but read-only Bash command, `wc -l`, solely on `GYEON_DA_COMPLETION_PLAN.md` and `GYEON_DA_PHASE_RESULTS.md`; Codex detected it, stopped the invocation, and confirmed it produced no edits, so it is not an accepted repair run. The successful replacement dispatch used only Read/Edit and produced the OS-temp guard repair candidate described above; Codex then found the retained-destination-exists burn gap. This repair (result marker `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_FINAL_CLOSEOUT_REPAIR_RESULT_V1`) moves the `PATHS_VALIDATED=1` transition in `cleanup.sh` to immediately after all four canonical excluded-root checks and before the `[[ ! -e "$RETAINED_DIR" ]]` check, so a safe-but-already-existing retained destination now calls the validated failure path and burns the existing safe suffix; the literal unsafe-path checks remain before the gate, and every other mkdir, cleanup-started write, aggregate-log write, lane operation, copy, and removal remains after validation, unweakened. No database or runtime execution has occurred. This closeout invocation used only Read/Edit and is unstaged, uncommitted, unpushed, and pending Codex static review. The candidate remains Git-untracked, unstaged, uncommitted, and unpushed. This directive and the R5 design plan grant no runtime or Git-delivery authority; every action remains separately gated.

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
- create runtime only outside the worktree, outside `/private/tmp`, and outside any general OS tmpdir (`$TMPDIR`, `/tmp`, `/var/folders`, or any other `os.tmpdir()`-equivalent location);
- retain evidence only outside the worktree, outside `/private/tmp`, and outside any general OS tmpdir, using the same exclusion rule as the runtime;
- reject existing runtime paths, linked projects, hosted/pooler URLs, non-loopback hosts, and source drift before start;
- allocate distinct project IDs and all relevant ports per lane;
- stage formal migrations byte-identically, exclude `DRAFT_DO_NOT_APPLY`, and record the protected LINE migration as `excluded_protected` without reading it;
- apply migrations only through current local Supabase CLI native commands discovered from `--help`;
- never apply the target migration through `psql -f`;
- use deterministic, unmistakably fictional synthetic rows only, generated solely inside the disposable runtime; never download Japan Post data or store real names/addresses;
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
- real authenticated active-member lookup success, including success for an authenticated user whose only active `dealer_members` membership belongs to a dealer different from any other test dealer (the lookup RPC is dealer-independent global reference data, carries no dealer id, and returns no dealer-owned data, so cross-dealer denial must not be required);
- anon, missing-membership, and inactive-only-membership denial;
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
