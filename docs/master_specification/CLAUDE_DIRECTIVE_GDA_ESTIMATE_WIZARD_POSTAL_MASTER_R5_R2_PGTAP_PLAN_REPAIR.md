# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5-R2 pgTAP Plan Count Repair

Instruction ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R2_PGTAP_PLAN_REPAIR`

Required result marker: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R2_PGTAP_PLAN_REPAIR_RESULT_V1`

Status: `GOVERNANCE CANDIDATE ONLY — NOT EXECUTION AUTHORITY`

## 1. Objective

Prepare one future bounded source repair for a single pgTAP plan-count defect found by the second R5 disposable attempt. This document does not itself authorize Claude invocation, private-file transmission, source editing, tests, Git delivery, or database/runtime execution.

## 2. Fixed authority and evidence

- Repository: `nisikawa-officeAZ/GYEON`
- PR: `#48`, which must remain `OPEN/Draft` with base `main`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Fixed HEAD: `71570c3f7ac37f97b97002a83aa18b94e8193a62`
- Fixed tree: `1566df7ff5e57de26c2ada038b117d7a1e0abfac`
- Vercel: `SUCCESS`
- Burned suffix: `20260902T144100Z-123caa` — never reuse
- Retained evidence root: `/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5-evidence/gda-postal-r5.20260902T144100Z-123caa`
- Aggregate manifest SHA-256: `7ba16efe081e536abab4df342c8a67916e819e4d2bcee30ddc2722debbeed066`
- Retained artifacts: `32`; independently recomputed hash mismatches: `0`

The fresh and import setups both completed full migration replay and ledger verification. The fresh runtime contract passed `20/20`. The existing postal pgTAP file returned exit `1` only because its plan declared 74 while 75 assertions ran. All assertion bodies passed. Fail-closed execution then stopped before later fresh Auth/lint gates, and import capture was not run. Both disposable projects and the runtime path were removed; no R5 containers remained; Git returned clean and unchanged; no shared, hosted, staging, or production environment was contacted.

## 3. Accepted defect

Target: `supabase/tests/jp_postal_master_rpc.test.sql`

The file contains `SELECT plan(74);`, but now runs 75 assertions. The assertion added for `public.jp_postal_import_rollback(uuid)` with human label `20b` increased the total to 75. The pgTAP output therefore reports a bad plan: planned 74, ran 75.

This is a plan-count-only defect. It is not a failure of any assertion body, migration behavior, RLS/grant rule, importer state machine, runtime harness, or fixture.

## 4. Future read scope

Only after separate owner approval for private-source transmission and Claude execution, Claude may read exactly:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R2_PGTAP_PLAN_REPAIR.md`
5. `supabase/tests/jp_postal_master_rpc.test.sql`

The retained evidence directory is outside this read scope and must not be opened, copied, transmitted, or changed. The sanitized evidence facts necessary for the repair are already recorded in sections 2 and 3.

## 5. Future write allowlist — exactly one existing path

1. `supabase/tests/jp_postal_master_rpc.test.sql`

No other file may be created, edited, deleted, renamed, reformatted, or normalized.

## 6. Exact required edit

Replace exactly one line:

```sql
SELECT plan(74);
```

with:

```sql
SELECT plan(75);
```

Do not change or renumber any human-readable assertion label, including the final label beginning `74`. Do not modify assertion bodies, assertion order, SQL logic, functions, grants, RLS, migration files, harness files, fixtures, dependencies, lockfiles, repository configuration, UI, or governance prose.

## 7. Tool and execution boundary

If later invoked under separate approval, Claude is limited to `Read`, `Edit`, and `Grep` on the exact read/write scopes above. Claude must not use Bash or any shell, run tests, start Supabase/Docker/Colima, access PostgreSQL/Auth/PostgREST, create or reuse a disposable suffix, use network or provider tools, access hosted environments, or perform any Git/GitHub action.

MacBook Codex, not Claude, will independently perform the later static checks:

- confirm exactly one `SELECT plan(75);` and zero `SELECT plan(74);` in the target;
- confirm only the one allowed path changed and the diff is the exact one-line replacement;
- confirm assertion structure and labels are otherwise unchanged;
- run `git diff --check` limited to the target;
- confirm protected metadata and unrelated work remain unchanged.

Executable pgTAP, database, and disposable runtime verification require a later independent owner authorization after source delivery. The burned suffix must never be reused.

## 8. Protected-path boundary

`ScreensPreview.tsx` is metadata-only and must never be opened, read, diffed, copied, transmitted, staged, or modified. LINE and monthly-invoice protected files are also metadata-only. Baseline Git blobs:

- ScreensPreview: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- Monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- Monthly-invoice boundary test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## 9. Required future result

After a separately authorized edit, return exactly one report headed by:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R2_PGTAP_PLAN_REPAIR_RESULT_V1`

The report must state:

- verdict: `CANDIDATE_READY_FOR_CODEX_STATIC_REVIEW` or `BLOCKED`;
- exact read paths and the single edited path;
- old and new literal;
- confirmation that no label, assertion, migration, harness, fixture, dependency, lockfile, or unrelated file changed;
- confirmation that no Bash, test, Git, database, Supabase, Docker, Colima, network, provider, hosted environment, Ready, merge, or deployment action occurred;
- that the candidate remains unstaged, uncommitted, and unpushed.

Then stop. Do not infer permission for any next gate.
