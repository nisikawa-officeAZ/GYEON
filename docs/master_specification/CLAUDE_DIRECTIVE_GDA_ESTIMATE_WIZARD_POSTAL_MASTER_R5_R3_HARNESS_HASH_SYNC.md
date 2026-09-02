# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5-R3 Harness Hash Synchronization

Instruction ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R3_HARNESS_HASH_SYNC`

Required result marker: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R3_HARNESS_HASH_SYNC_RESULT_V1`

Status: `GOVERNANCE CANDIDATE ONLY — NOT EXECUTION AUTHORITY`

## 1. Objective

Prepare one future bounded synchronization of the R5 harness manifest pins after the accepted pgTAP plan-count repair changed the committed identity of `supabase/tests/jp_postal_master_rpc.test.sql`. This document does not authorize Claude invocation, private-file transmission, harness editing, tests, Git delivery, suffix creation, or database/runtime execution.

## 2. Fixed authority

- Repository: `nisikawa-officeAZ/GYEON`
- PR: `#48`, which must remain `OPEN/Draft` with base `main`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Fixed HEAD: `233487590cc60d8b4ba315bfbd422a571d888481`
- Fixed tree: `212cc46284a19bcb1ec6e58cbb57499153340a10`
- Vercel: `SUCCESS`
- Worktree/index: clean before governance authoring

The fixed HEAD contains exactly the accepted `SELECT plan(74);` → `SELECT plan(75);` change in the pgTAP file.

## 3. Accepted pre-runtime finding

The repaired pgTAP identity is:

- Git blob: `81894d341dde80eb5bfda418629ae932aaa5cd93`
- SHA-256: `c77fe474dd038b0de04d9e038c3191003a230f27884a6834ec85635fa1e153cd`

The harness still contains:

- old Git blob `9832459e92176498944353d38e02ddee4db444ea`: three occurrences total — two in `setup.sh`, one in `cleanup.sh`;
- old SHA-256 `5859bc01453e7a172e52ff3eddaf75bf1ab04e0c2a81d963cb6b40176b2360dc`: two occurrences total — both in `setup.sh`.

This mismatch would correctly fail closed as source drift before database startup. MacBook Codex therefore issued no suffix, created no runtime path, started no Supabase/database/Docker container, and contacted no hosted environment.

## 4. Future read scope

Only after separate owner approval for private-source transmission and Claude execution, Claude may read exactly:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R3_HARNESS_HASH_SYNC.md`
5. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
6. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`

No other path may be opened, searched, copied, transmitted, or changed.

## 5. Future write allowlist — exactly two existing paths

1. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
2. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`

No file may be created, deleted, renamed, reformatted, or normalized.

## 6. Exact required replacements

Within the exact two-file write allowlist only:

1. Replace all three occurrences of `9832459e92176498944353d38e02ddee4db444ea` with `81894d341dde80eb5bfda418629ae932aaa5cd93`.
2. Replace both occurrences of `5859bc01453e7a172e52ff3eddaf75bf1ab04e0c2a81d963cb6b40176b2360dc` with `c77fe474dd038b0de04d9e038c3191003a230f27884a6834ec85635fa1e153cd`.

Required post-edit counts across the exact two write paths:

- old blob: `0`
- old SHA-256: `0`
- new blob: `3`
- new SHA-256: `2`

Do not modify code flow, shell commands, conditions, comments, status prose, formatting, migration pins, any other R4 manifest entry, tests, migration files, fixtures, dependencies, lockfiles, repository configuration, UI, or governance documents.

## 7. Tool and execution boundary

If later invoked under separate approval, Claude is limited to `Read`, `Edit`, and `Grep` on the exact scopes above. Claude must not use Bash or any shell, run syntax checks or tests, create a suffix/runtime path, start Supabase/Docker/Colima, access PostgreSQL/Auth/PostgREST, use Git/GitHub, invoke WebFetch/WebSearch or any additional network tool, contact providers or hosted environments, or perform Ready, merge, or deployment actions.

MacBook Codex will independently perform the later static checks:

- verify the required old/new literal counts;
- verify exactly two changed paths and exactly five replacements;
- run `bash -n` on both scripts;
- run `git diff --check` on both scripts;
- confirm every other file, protected metadata, HEAD, and tree remain unchanged.

Executable tests and the Disposable DB rerun require a later independent owner authorization after synchronization delivery.

## 8. Protected-path boundary

`ScreensPreview.tsx` is metadata-only and must never be opened, read, diffed, copied, transmitted, staged, or modified. LINE and monthly-invoice protected files are also metadata-only. Baseline Git blobs:

- ScreensPreview: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- Monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- Monthly-invoice boundary test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## 9. Required future result

After a separately authorized edit, return exactly one report headed by:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R3_HARNESS_HASH_SYNC_RESULT_V1`

The report must state:

- verdict: `CANDIDATE_READY_FOR_CODEX_STATIC_REVIEW` or `BLOCKED`;
- exact six read paths and exact two edited paths;
- the old/new blob and SHA-256 values;
- post-edit occurrence counts;
- confirmation that no other byte or path changed;
- confirmation that no Bash, test, Git, suffix, database, Supabase, Docker, Colima, WebFetch/WebSearch or additional network-tool use, provider/hosted-environment contact, Ready, merge, or deployment action occurred;
- that the candidate remains unstaged, uncommitted, and unpushed.

Then stop. Do not infer permission for any next gate.
