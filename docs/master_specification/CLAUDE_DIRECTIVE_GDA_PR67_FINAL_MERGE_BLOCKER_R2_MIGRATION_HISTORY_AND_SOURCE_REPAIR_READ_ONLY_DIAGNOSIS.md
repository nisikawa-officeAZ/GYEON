# CLAUDE DIRECTIVE — GDA PR #67 FINAL MERGE BLOCKER R2

## Migration history and source repair — read-only diagnosis

### 0. Authority and hard stop

This document is a proposed, one-time, tool-disabled, read-only diagnosis directive for Anthropic Claude Code.

Creating or reading this directive does **not** authorize transmission of private repository contents. A separate, explicit owner approval is required before any allowlisted private file is sent to Anthropic Claude Code.

Even after that transmission approval, this phase authorizes diagnosis only. It does **not** authorize:

- tool use, network access, shell commands, repository access, or filesystem access by Claude;
- edits, file creation, deletion, rename, move, formatting, or lockfile regeneration;
- Supabase, PostgreSQL, migration-history, provider, Vercel, or production access;
- staging or production database reads or writes;
- `supabase migration repair`, `supabase db push`, migration apply, rollback, or import;
- Git staging, commit, push, force-push, branch changes, PR comments, Ready-for-review, merge, or deployment;
- retries or a second diagnosis run.

Claude must reason only from the exact plaintext bundle separately supplied after owner approval. If any required input is missing, inconsistent, truncated, or not pinned as specified below, stop with `BLOCKED_INPUT`.

### 1. Objective

Produce one bounded repair plan for the remaining PR #67 merge blockers, without changing anything:

1. reconcile the mismatch between repository migration filenames and Staging migration-history versions;
2. define the minimum exact dependency repair for the named Next.js critical advisories, while separating unrelated dependency debt;
3. define the minimum Step 4 window-film test-fixture repair;
4. define an append-only governance supersession record;
5. return a literal proposed implementation allowlist and exact verification gates for a later, separately authorized phase.

The diagnosis must make one clear recommendation. It must not hide migration-history risk behind a generic “repair migrations” statement.

### 2. Frozen repository identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#67`
- PR URL: `https://github.com/nisikawa-officeAZ/GYEON/pull/67`
- Branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`
- Base branch: `main`
- Base commit: `bde532f8266560311b1168dea7a6599763c7ad24`
- Fixed HEAD: `948403d0ecb23c612231132730fa459335cd85b3`
- Fixed tree: `214a5eb09abb098529ba420dc50e00b287304815`
- Fixed parent: `f5a4438573a97dd0ad1c7d9ac4f86f1ad676cc61`

Any conclusion referring to another repository identity, HEAD, tree, parent, base, or branch is invalid.

### 3. Protected and pre-existing work

The following file is protected and is **not** in the readable bundle. Do not request, infer, reconstruct, quote, or propose editing its contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
  - mode: `100644`
  - size: `31076`
  - SHA-256: `d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e`

The working tree already contains unrelated or earlier-phase changes. They must be preserved. This diagnosis does not authorize altering, cleaning, stashing, restoring, staging, or committing them.

Known pre-existing paths outside the prospective R2 implementation scope include:

- `scripts/postal-master/import-japan-post.test.ts`
- `src/lib/geo/jp-postal-master-csv.test.ts`
- `src/lib/geo/jp-postal-master-csv.ts`
- the three prior CR6-R3J/R3K directive files already present in the working tree

### 4. Exact private read bundle proposed for a separately approved run

The proposed bundle contains **21 files total**:

- 17 files sourced exactly from fixed HEAD `948403d0ecb23c612231132730fa459335cd85b3`;
- 3 current untracked files pinned by mode, size, and SHA-256;
- this R2 directive, pinned by its SHA-256 externally after authoring.

`supabase/config.toml` is deliberately excluded: it does not exist in the fixed HEAD tree. Any earlier count that included it was incorrect.

No other repository file, diff, log, environment file, secret, credential, generated output, or metadata may be sent.

#### 4.1 Fixed-HEAD files — mode and Git blob

All entries below have mode `100644` and must be extracted from the fixed HEAD, not from the working tree.

| # | Path | Git blob |
|---:|---|---|
| 1 | `AGENTS.md` | `2a3306fd572c0050b63a45ed7e7b673c534c6359` |
| 2 | `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` | `cc036ace8f3a7717c10e589770fa904d8d27eafa` |
| 3 | `docs/master_specification/GYEON_DA_PHASE_RESULTS.md` | `f4ff9e20145c9e1f58252d5d67bfc95e961bb139` |
| 4 | `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION.md` | `a9cfa3c7829c6418e3701b4c3e75bcc75b5d849a` |
| 5 | `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R5_STAGING_MIGRATION_AND_IMPORT_READ_ONLY_PREFLIGHT.md` | `81d3f5db75ed247572a3415ebccc6daed1c5558b` |
| 6 | `package.json` | `7734d0b1da145ca4496411482ded7641034d9d0c` |
| 7 | `package-lock.json` | `52c3cb65b5949c35cd9b550b7768e30f0c79827e` |
| 8 | `next.config.ts` | `e453611aa30e6409e93e87165221ae927bf133a5` |
| 9 | `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx` | `6cd579ed26ed675a8863b82b72a9bfb008cd5f29` |
| 10 | `src/components/estimates/wizard/screens/window-film-v1-suggested-price.ts` | `f70004192e4408864693a846ecf1cbef960ca880` |
| 11 | `src/lib/pricing/window-film-v1-contract.ts` | `770599fdffd520958620ac98c41de1a8c1e5d5f1` |
| 12 | `src/lib/wizard-catalog/wizard-runtime-config.ts` | `3008a86ebcb9e040f212e69f6fbbd8facf3d3438` |
| 13 | `src/lib/wizard-catalog/wizard-runtime-config.test.ts` | `0bbc1aa45935601764a46e0c7679788f19eb5c29` |
| 14 | `supabase/migrations/20260901001246_jp_postal_master.sql` | `65d2dd2096c29bceaf0060ffaf0f7b77117f0ede` |
| 15 | `src/lib/geo/jp-postal-master-migration-contract.test.ts` | `2b653364d0938e55787395cdfd845c9bcfcb1f30` |
| 16 | `scripts/e2e/gda-estimate-postal-master-r5-cr6/manifest-core.mjs` | `0834624e2eb06aa194111a3c33bace2804b607d0` |
| 17 | `scripts/e2e/gda-estimate-postal-master-r5-cr6/preflight.mjs` | `032614b9a4383c79a9b2941a237ad8293f590304` |

#### 4.2 Current untracked files — exact identity

| # | Path | Mode | Size | SHA-256 |
|---:|---|---|---:|---|
| 18 | `docs/master_specification/CLAUDE_DIRECTIVE_GDA_PR67_FINAL_MERGE_BLOCKER_R1_READ_ONLY_DIAGNOSIS.md` | `-rw-r--r--` | `13250` | `2a52ea7266fdf93951c491de717add9b3747f0a106b214257a18de9f22af68b8` |
| 19 | `src/lib/geo/jp-postal-master-old-code-compatibility-migration-contract.test.ts` | `-rw-r--r--` | `2389` | `ec912a2a2ffffb891f8d5946c58758726a5723240f922098e10d2d7fba7ee6e5` |
| 20 | `supabase/migrations/20260908045111_jp_postal_old_code_official_padding_compatibility.sql` | `-rw-r--r--` | `5833` | `9028c63cf88bad8c5396e3979cf77f24478fa474b0624b8f23f5d7d3ac024dee` |

#### 4.3 This directive

| # | Path | Identity rule |
|---:|---|---|
| 21 | `docs/master_specification/CLAUDE_DIRECTIVE_GDA_PR67_FINAL_MERGE_BLOCKER_R2_MIGRATION_HISTORY_AND_SOURCE_REPAIR_READ_ONLY_DIAGNOSIS.md` | Sender must record and verify the post-authoring SHA-256 before transmission. |

### 5. Accepted evidence supplied by Codex

Treat this section as evidence to analyze, not as permission to reproduce external access.

#### 5.1 Prior R1 result

- Result marker: `GDA_PR67_FINAL_MERGE_BLOCKER_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Verdict: `BLOCKED_NEEDS_READ_ONLY_STAGING_EVIDENCE`
- The replacement R1 run was tool-disabled, read-only, one-time, and performed no external or repository action.
- The missing Staging evidence has now been collected independently and is recorded below.

#### 5.2 Staging identity and audit boundary

- Audit timestamp: `2026-09-09T06:17:02Z`
- Project name: `DealerOS-Dev-Next`
- Project ref: `vhiuiwolnlvlwvoaingd`
- Region: `ap-northeast-1`
- Status: `ACTIVE_HEALTHY`
- PostgreSQL version: `17.6.1.147`
- Production ref `dmvyaykhibmphrmekjbb` was not contacted and remains prohibited.
- The audit was read-only. No database, migration-history, provider, repository, or deployment write was performed.

#### 5.3 Staging migration history

The Staging migration list contained 107 entries. The two relevant entries were:

| Remote version | Remote name |
|---|---|
| `20260908044118` | `jp_postal_master_20260901001246` |
| `20260908045438` | `jp_postal_old_code_official_padding_compatibility` |

The repository/current-source identities are:

| Source version | Source path | State |
|---|---|---|
| `20260901001246` | `supabase/migrations/20260901001246_jp_postal_master.sql` | tracked in fixed HEAD |
| `20260908045111` | `supabase/migrations/20260908045111_jp_postal_old_code_official_padding_compatibility.sql` | current untracked file pinned above |

Therefore, there is real history/source version drift:

- primary postal migration: source `20260901001246` versus Staging history `20260908044118`;
- compatibility migration: source `20260908045111` versus Staging history `20260908045438`.

The presence of working runtime objects does not prove migration-history consistency.

#### 5.4 Staging runtime objects and security

Row counts:

- `private.jp_postal_master`: `124523`
- `private.jp_postal_active_batch`: `1`
- `private.jp_postal_import_batches`: `1`

All three tables have RLS enabled.

RPCs present:

- `public.jp_postal_master_lookup_forward(p_postal_code text)`
- `public.jp_postal_master_lookup_reverse(p_address text)`

Both RPCs are `SECURITY DEFINER`, `STABLE`, use fixed `search_path = ''`, check `wiz_is_any_active_member`, and read `private.jp_postal_master`.

Execution grants:

- `authenticated`: true
- `anon`: false
- `service_role`: false
- recorded grantees: `{authenticated,postgres}`

Direct private-table access for `authenticated`, `anon`, and `service_role` was false for both read and write.

#### 5.5 Step 4 window-film diagnosis

The five failing Step 4 tests use an obsolete fixture in `Step4Estimate.binding.test.tsx`:

- fixture `filmTypes` does not provide `installationCoefficientBp`;
- fixture `windowFilmSettings` is absent.

The runtime readiness contract requires both. Production runtime construction already supplies:

- `installationCoefficientBp` in `wizard-runtime-config.ts`;
- `windowFilmSettings: catalog.windowFilmV1` in `wizard-runtime-config.ts`.

The expected settings shape is defined in `window-film-v1-contract.ts`:

- `contractVersion: "1.0"`;
- `revision: number`;
- `areas`: all seven canonical area codes, each with `priceYen`, `durationMinutes`, and `isActive`;
- `packages` and `options`: `WindowFilmCustomItem[]`.

Prior fixed-HEAD/base reproduction:

- Step 4 binding test: `39/44` passed, five failed;
- whole changed-test set: `468/473` passed, five failed.

These baseline failures establish provenance only; they are not a waiver. The likely minimal repair is test-fixture-only. Production source must remain unchanged unless the diagnosis demonstrates a separate source defect from the supplied files.

#### 5.6 Dependency evidence

Pinned versions at fixed HEAD:

- `next`: `15.5.19`
- `sharp`: `0.34.5`
- `unpdf`: `1.8.1`

For the two named critical Next.js advisories `GHSA-p293-qw3h-jr36` and `GHSA-2xp9-vwfh-vxw4`, the affected range is below `15.5.24`; the minimum patched version for those two advisories is `15.5.24`.

A fresh exact-lock read-only `npm audit --omit=dev --json` reported the dependency-node aggregation:

- critical: `1`
- high: `96`
- moderate: `2`
- total: `99`
- `fixAvailable: false` for the Next.js audit item

`sharp@0.34.5` has separate high-severity advisories with patched thresholds including `0.35.0` and `0.35.4`. `unpdf@1.8.1` was not itself identified by that evidence.

Do not repeat the false statement that sharp is already `0.35.4`. Diagnose the minimum Next.js critical repair separately from the broader dependency-hardening decision. Explain whether sharp should be included in the same later repair phase or deliberately deferred, and why.

#### 5.7 Existing successful evidence

- TypeScript typecheck: PASS
- production build: PASS, `53/53`
- focused OCR/postal/vehicle tests: PASS, `317/317`
- hosted harness: PASS, `304/304`
- `git diff --check`: PASS

PR #67 is cumulative and large: 114 changed files and 51 commits at the recorded review point. This is a reason to keep any later repair allowlist literal and minimal.

#### 5.8 Governance state

`GYEON_DA_PHASE_RESULTS.md` contains historical hold records including:

- `status: CHANGES_REQUIRED_GOVERNANCE_AND_ENVIRONMENT`
- `decision: PR67_FULL_CUMULATIVE_CHANGES_REQUIRED_KEEP_OPEN_DRAFT`
- older statements that Staging evidence was absent

History must not be deleted or rewritten. A later phase may append one clearly marked superseding record only after its evidence is actually true.

### 6. Required diagnosis A — migration-history reconciliation

Compare at least these strategies:

1. **Source rename/move:** align repository migration filenames to the two versions already recorded in Staging history.
2. **Staging history repair:** retain source-canonical versions and later repair Staging migration-history records.
3. **Explicit bridge/no-op or another bounded method:** only if it genuinely avoids duplicate application and preserves auditability.

For every strategy, state:

- exact source-file operations;
- exact Staging migration-history effects;
- whether SQL bodies would run again;
- future `supabase db push` behavior and duplicate-apply risk;
- effect on a Production environment where these postal migrations have not yet been applied;
- rollback and forensic audit implications;
- required owner approvals and separate execution gates;
- whether old-code compatibility remains covered;
- risk of locally misleading filenames, timestamps, or test assumptions.

Then choose exactly one recommended strategy. Give a step-by-step future execution plan, but do not execute it and do not present the plan as authorized.

If recommending a migration-history repair, explicitly label it a database write requiring a separate owner approval, a fresh identity preflight, a backup/freshness gate, and post-action read-only verification. Do not invent or rely on an unverified CLI syntax; instead list the semantic history changes and mark exact command syntax as a future preflight item.

If recommending source rename/move, identify the exact old and new paths and prove why future Production application remains correct. Distinguish Git file operations from database operations.

### 7. Required diagnosis B — dependency repair

Determine the smallest exact patch that removes exposure to the two named critical Next.js advisories while minimizing unrelated changes.

Return:

- exact proposed `package.json` version change;
- exact proposed lockfile-regeneration command and package-manager assumptions, as a future plan only;
- expected `package-lock.json` impact and how to reject unrelated churn;
- whether `next@15.5.24` is sufficient for the two named critical advisories;
- a separate decision on `sharp`, including the exact rationale for including or deferring it;
- the post-repair audit acceptance rule, distinguishing critical-zero from unresolved high/moderate debt;
- build, typecheck, and focused regression gates.

Do not broaden the phase into a general dependency upgrade.

### 8. Required diagnosis C — Step 4 fixture repair

Describe the exact minimal fixture changes required in `Step4Estimate.binding.test.tsx`:

- add the required `installationCoefficientBp` values to fixture film types;
- add a valid `windowFilmSettings` object with contract version `1.0`, a deterministic revision, all seven canonical area entries, and deterministic packages/options;
- keep values minimal and semantically adequate for the five affected tests;
- preserve production source unless a distinct defect is proved;
- avoid snapshot or expectation weakening merely to make tests pass.

Return the exact object shape and insertion location at a level sufficient for a later implementation agent, but do not output an edited file.

### 9. Required diagnosis D — governance supersession

Draft the fields of one append-only superseding record for `GYEON_DA_PHASE_RESULTS.md`.

It must:

- preserve all earlier records;
- identify the exact later repair phase and evidence;
- say that old “Staging evidence absent” claims are historical and superseded only after current proof;
- retain Draft/merge/deploy holds until all gates actually pass;
- avoid claiming migration reconciliation, dependency repair, or 473/473 success before those results exist.

Do not provide an instruction to delete or rewrite prior governance text.

### 10. Proposed later implementation boundaries

The diagnosis must return a literal implementation allowlist divided into independently authorized classes.

#### 10.1 Source-only candidates

Expected candidates, subject to the R2 diagnosis:

- `package.json`
- `package-lock.json`
- `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`
- `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
- exact migration source old/new path pairs chosen by the reconciliation strategy

#### 10.2 Database-history candidate

Any Staging migration-history repair is not a file edit and must be listed separately as a database mutation. It is forbidden until separately approved after a fresh preflight.

#### 10.3 Frozen by default

- all production application source, including `wizard-runtime-config.ts` and window-film pricing source;
- all other migrations;
- all OCR/postal CSV parser/import files already modified in the working tree;
- `ScreensPreview.tsx`;
- Production, Vercel, provider settings, secrets, and deployment state.

The proposed allowlist is an analytical output, not authorization.

### 11. Required future verification gates

Provide exact commands inferred from the supplied package scripts/configuration, but do not run them. The later implementation must not be accepted without, at minimum:

1. identity preflight: repo, branch, HEAD/parent, index, worktree, literal paths, and protected-file metadata;
2. Step 4 binding test: `44/44` passed;
3. whole changed-test set: `473/473` passed, with the exact test-file list and command recorded;
4. focused OCR/postal/vehicle suite: no regression from `317/317`;
5. hosted harness: no regression from `304/304` when that gate is in scope;
6. TypeScript typecheck: PASS;
7. production build: PASS, including all expected routes/pages;
8. `git diff --check`: PASS;
9. dependency audit: no remaining critical exposure from the two named Next.js advisories; report high/moderate debt separately;
10. migration consistency: source version identities and the authorized environment’s migration-history identities agree under the chosen strategy;
11. direct proof that the postal RPC/data/security invariants remain unchanged unless a separately authorized migration changes them;
12. exact changed-path, mode, blob/SHA, and protected-path no-change attestations.

Database-history verification may occur only after a separately authorized history mutation. Production must remain untouched.

### 12. Required result format

Return exactly one report beginning with:

`GDA_PR67_FINAL_MERGE_BLOCKER_R2_MIGRATION_HISTORY_AND_SOURCE_REPAIR_READ_ONLY_DIAGNOSIS_RESULT_V1`

Then include these headings in order:

1. `VERDICT`
2. `INPUT_IDENTITY`
3. `ZERO_ACTION_ATTESTATION`
4. `MIGRATION_HISTORY_FINDINGS`
5. `STRATEGY_COMPARISON`
6. `RECOMMENDED_MIGRATION_STRATEGY`
7. `DEPENDENCY_FINDINGS`
8. `STEP4_FIXTURE_FINDINGS`
9. `GOVERNANCE_SUPERSESSION_PLAN`
10. `PROPOSED_IMPLEMENTATION_ALLOWLIST`
11. `PROPOSED_VERIFICATION_COMMANDS_AND_GATES`
12. `RISKS_AND_STOP_CONDITIONS`
13. `OWNER_DECISIONS_REQUIRED`

Allowed verdicts:

- `READY_FOR_BOUNDED_REPAIR_AUTHORIZATION`
- `BLOCKED_NEEDS_MIGRATION_AUTHORITY_DECISION`
- `CHANGES_REQUIRED_DIRECTIVE`
- `BLOCKED_INPUT`

`ZERO_ACTION_ATTESTATION` must explicitly state:

- tools used: none;
- network access: none;
- repository/filesystem access by Claude: none beyond supplied plaintext;
- files changed: none;
- Git actions: none;
- Supabase/PostgreSQL/provider/Vercel actions: none;
- Staging reads/writes by Claude: none/none;
- Production contact: none;
- retries: none.

### 13. Stop rule

After returning the single result, stop. Do not ask to continue, do not implement, do not run tests, do not access any environment, and do not generate a second result. Codex will independently review the diagnosis and the owner will decide whether to authorize a bounded repair phase.
