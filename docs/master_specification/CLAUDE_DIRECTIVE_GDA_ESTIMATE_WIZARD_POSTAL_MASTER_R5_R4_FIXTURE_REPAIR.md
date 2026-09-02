# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5-R4 Fixture Repair

Instruction ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R4_FIXTURE_REPAIR`

Required result marker: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R4_FIXTURE_REPAIR_RESULT_V1`

Status: `GOVERNANCE CANDIDATE — NOT IMPLEMENTATION AUTHORITY`

## 1. Objective

Repair one synthetic Japan Post CSV field in the R5 import-resume harness. The burned Disposable attempt proved that the fixture reaches the real production importer with an empty `oldPostalCode`, so parsing stops before the intended validate-only and canonical-URL boundary assertions.

This document does not authorize implementation, private-source transmission, Claude invocation, tests, Git delivery, or another Disposable attempt. Those remain later independent gates after this governance candidate is committed, normally pushed, and published on the active Draft PR.

## 2. Fixed authority and evidence

- Repository: `nisikawa-officeAZ/GYEON`
- PR: `#48`, required `OPEN/Draft`, base `main`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Governance-authoring base HEAD: `35226bb55b8106dbced6859f9a0825de331dc2d6`
- Governance-authoring base tree: `7ef1f6e509bb8039488135758b399858ea8d5e64`
- Burned suffix: `20260902T153304Z-182ee3`, never reusable
- Retained evidence: `/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5-evidence/gda-postal-r5.20260902T153304Z-182ee3`
- Aggregate manifest SHA-256: `b538bdc26023d43b3d38f38d536d6f1119501ae1faa03a7444685497b02ea1f2`
- Import result: phase 1 `3/3`; phase 2 `23/25`; common error `CSV_PARSE_INVALID_OLD_POSTAL_CODE`

## 3. Accepted diagnosis

`src/lib/geo/jp-postal-master-csv.ts` requires `oldPostalCode` to contain one to five ASCII digits. The production-importer proof fixture in `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs` contains `99999,,0000007`, so its second field is empty. The two final proof assertions both stop during CSV parsing and do not reach their intended validate-only or canonical-URL checks.

One earlier Claude session, `caed03be-dcce-4fe6-b6a3-4b0b3ec56199`, independently confirmed the diagnosis but correctly returned `BLOCKED_UNGOVERNED_INSTRUCTION` with zero edits. That session is consumed and must not be resumed or counted as implementation.

## 4. Future Claude read allowlist — exactly six paths

Only after separate owner authorization following governance delivery may one new non-persistent Claude invocation read exactly:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R4_FIXTURE_REPAIR.md`
5. `src/lib/geo/jp-postal-master-csv.ts`
6. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`

No other path may be opened, searched, copied, transmitted, or changed.

## 5. Future write allowlist — exactly one existing path

1. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`

No file may be created, deleted, renamed, reformatted, or normalized during implementation.

## 6. Exact future edit

Replace exactly one literal in the production-importer synthetic CSV string:

- old: `99999,,0000007`
- new: `99999,000,0000007`

The new second field `000` is intentionally synthetic, consists of three ASCII digits, and satisfies the parser without introducing a real address or real postal authority value.

Required post-edit counts within the one-file write allowlist:

- old literal: `0`
- new literal: `1`

No other byte may change. Do not alter the direct-RPC synthetic rows, comments, assertions, control flow, result markers, migrations, parser, tests, dependencies, lockfiles, configuration, or governance documents.

## 7. Tool and execution boundary

A later separately authorized Claude implementation may use only `Read`, `Grep`, and `Edit` on the exact scopes above. It must not use Bash, Git, GitHub, WebFetch, WebSearch, tests, Node execution, DB, Supabase, Docker, Colima, HTTP, Auth, PostgREST, providers, Preview, staging, production, Ready, merge, migration application, import, or deployment.

MacBook Codex will independently perform only these static checks after the candidate exists:

- old/new literal occurrence counts;
- exact one-path, one-literal diff inspection;
- `node --check scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`;
- `git diff --check -- scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`;
- protected-path metadata and unchanged Git identity.

Source stage/commit/push and every new Disposable attempt require later separate owner authorization.

## 8. Protected paths

`ScreensPreview.tsx` remains metadata-only and must never be opened, read, diffed, copied, transmitted, staged, or modified. The LINE migration, monthly-invoice migration, and monthly-invoice boundary test also remain metadata-only. Accepted blobs:

- ScreensPreview: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- Monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- Monthly-invoice boundary test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## 9. Required future result

After separate implementation authorization, return one report headed by:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R4_FIXTURE_REPAIR_RESULT_V1`

It must state:

- verdict: `CANDIDATE_READY_FOR_CODEX_STATIC_REVIEW` or `BLOCKED`;
- exact six read paths and the exact one edited path;
- old and new literals and their post-edit counts;
- confirmation that no other byte or path changed;
- confirmation that no prohibited tool or external/runtime action occurred;
- that the candidate remains unstaged, uncommitted, and unpushed.

Then stop and infer no authority for a later gate.
