# CLAUDE DIRECTIVE — GDA PR #67 FINAL MERGE BLOCKER R1 READ-ONLY DIAGNOSIS

Directive marker: `GDA_PR67_FINAL_MERGE_BLOCKER_R1_READ_ONLY_DIAGNOSIS_DIRECTIVE_V1`

Required result marker: `GDA_PR67_FINAL_MERGE_BLOCKER_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## 1. Authority and stop boundary

The owner authorizes **one tool-disabled, read-only diagnosis only** after separately approving the
private-source transmission and the invocation. Authoring this directive by itself does not grant
that later authority.

This directive does **not** authorize:

- editing any repository file;
- installing, updating, removing, or resolving dependencies;
- running tests, builds, package-manager commands, network commands, or provider CLIs;
- contacting GitHub, Supabase, PostgreSQL, Vercel, npm, or any external service;
- reading secrets, environment-variable values, browser storage, credentials, or runtime tokens;
- staging, committing, pushing, commenting, changing Draft/Ready state, merging, or deploying;
- modifying or reading the contents of
  `src/components/estimates/wizard/screens/ScreensPreview.tsx`.

Claude must reason only from the exact text supplied in the approved private bundle. It must not use
tools, browse, request more repository content, or retry. Stop immediately after returning the one
result block required by section 8.

## 2. Frozen repository identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#67`
- Branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`
- Base branch: `main`
- Base commit: `bde532f8266560311b1168dea7a6599763c7ad24`
- Fixed HEAD: `948403d0ecb23c612231132730fa459335cd85b3`
- Fixed tree: `214a5eb09abb098529ba420dc50e00b287304815`
- Fixed immediate parent: `f5a4438573a97dd0ad1c7d9ac4f86f1ad676cc61`

The diagnosis must fail as `BLOCKED_INPUT` if the supplied bundle identifies any different HEAD,
tree, parent, base, repository, or PR.

## 3. Known independent Codex evidence

Treat these as audit inputs to verify for internal consistency, not as permission to infer PASS:

1. PR #67 is OPEN, Ready (not Draft), targets `main`, and was mergeable/clean at the audited HEAD.
2. Vercel reported a passing deployment for deployment id
   `6LWdQ5m7ReWtfykgWugkRt9QBV9o`.
3. Fresh exact-HEAD checks reported:
   - TypeScript typecheck: PASS;
   - production build: PASS, 53/53 pages;
   - focused OCR/postal/vehicle tests: 317/317 PASS;
   - hosted postal harness tests: 304/304 PASS;
   - changed test corpus: 468/473 PASS.
4. The five failures are all window-film assertions in
   `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`. The same five failures
   reproduce at the PR base (39/44 in that file). Baseline reproduction is evidence of provenance,
   **not** permission to waive a release blocker.
5. Fresh production dependency audit reported 13 vulnerabilities: 1 critical, 7 high, 5 moderate.
   `next` is directly pinned at `15.5.19`; the audit suggested a non-major update to `15.5.25`.
   The critical Next.js advisories reported were:
   - `GHSA-p293-qw3h-jr36`;
   - `GHSA-2xp9-vwfh-vxw4`.
   `unpdf@1.8.1`, added in the PR, was not reported as the advisory source. `sharp` is currently
   declared as `^0.34.5`; do not repeat a stale claim that it is `0.35.4` without evidence.
6. Canonical phase results still contain a stale HOLD narrative, including:
   - `status: CHANGES_REQUIRED_GOVERNANCE_AND_ENVIRONMENT`;
   - `decision: PR67_FULL_CUMULATIVE_CHANGES_REQUIRED_KEEP_OPEN_DRAFT`;
   - older claims that the postal migration/RPC were absent in Staging.
   Those statements conflict with the current Ready state and later runtime evidence, but they must
   not be silently deleted or rewritten without a traceable supersession record.
7. `src/components/estimates/wizard/screens/ScreensPreview.tsx` was independently verified by
   metadata only as mode `100644`, size `31076`, SHA-256
   `d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e`. Its contents are outside
   this diagnosis and all later work unless the owner grants a separate exception.

## 4. Exact private read allowlist

Only the complete contents of the directive itself and the following 21 fixed-HEAD files may be
supplied to Claude. No directory listing, neighboring file, Git object, environment file, generated
artifact, or secret may be added.

| Path | Mode | Fixed-HEAD blob |
|---|---:|---|
| `AGENTS.md` | `100644` | `2a3306fd572c0050b63a45ed7e7b673c534c6359` |
| `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` | `100644` | `cc036ace8f3a7717c10e589770fa904d8d27eafa` |
| `docs/master_specification/GYEON_DA_PHASE_RESULTS.md` | `100644` | `f4ff9e20145c9e1f58252d5d67bfc95e961bb139` |
| `package.json` | `100644` | `7734d0b1da145ca4496411482ded7641034d9d0c` |
| `package-lock.json` | `100644` | `52c3cb65b5949c35cd9b550b7768e30f0c79827e` |
| `next.config.ts` | `100644` | `e453611aa30e6409e93e87165221ae927bf133a5` |
| `src/lib/estimates/service-categories.ts` | `100644` | `42c8d99f05a8a75b0248d95caadc67a0ff28a656` |
| `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts` | `100644` | `87086392cc85ab70e6d90f809a3eda47a360820c` |
| `src/components/estimates/wizard/screens/step-types.ts` | `100644` | `7398905d842fc49255d3a652cd84f902fef035e0` |
| `src/components/estimates/wizard/screens/Step4Estimate.tsx` | `100644` | `2d0990c346828ad6fa312bcb4c9e83288a501099` |
| `src/components/estimates/wizard/screens/WindowFilmSelector.tsx` | `100644` | `d4d01f3efb2d880deebc6b0bf54d717afc6ee69c` |
| `src/components/estimates/wizard/screens/window-film-v1-suggested-price.ts` | `100644` | `f70004192e4408864693a846ecf1cbef960ca880` |
| `src/components/estimates/wizard/steps/Step4Estimate.tsx` | `100644` | `a4287e89a6fa44951f323a4b7463233c3482d2d1` |
| `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx` | `100644` | `6cd579ed26ed675a8863b82b72a9bfb008cd5f29` |
| `src/components/estimates/wizard/steps/step4-bindings.ts` | `100644` | `b169c59756d2cb49a3819ac45a594fd435745912` |
| `src/lib/wizard-catalog/wizard-runtime-config.ts` | `100644` | `3008a86ebcb9e040f212e69f6fbbd8facf3d3438` |
| `src/lib/wizard-catalog/wizard-runtime-config.test.ts` | `100644` | `0bbc1aa45935601764a46e0c7679788f19eb5c29` |
| `supabase/migrations/20260901001246_jp_postal_master.sql` | `100644` | `65d2dd2096c29bceaf0060ffaf0f7b77117f0ede` |
| `supabase/tests/jp_postal_master_rpc.test.sql` | `100644` | `81894d341dde80eb5bfda418629ae932aaa5cd93` |
| `src/lib/geo/jp-postal-master-actions.ts` | `100644` | `9b17270a5ef96e0f6d1227ddeef315181f4b5042` |
| `src/components/estimates/wizard/steps/postal-master-apply.ts` | `100644` | `6f844d37a8f1e4b383a89863f057a32b3d880761` |

The bundle builder must obtain these versions from the fixed HEAD rather than from the dirty working
tree. The directive file must be separately SHA-256 hashed and that hash reported to Claude.

## 5. Diagnosis A — dependency release blocker

Determine the smallest safe, reviewable dependency correction that removes the two reported
critical Next.js advisories without broad dependency churn.

Required conclusions:

1. State whether `next@15.5.25` is the minimum acceptable patched version supported by the supplied
   evidence. If the bundle cannot prove this, say exactly what fresh **read-only** evidence a later
   bounded preflight must obtain; do not guess.
2. Identify the exact expected edits to `package.json` and `package-lock.json`, including whether
   any transitive `@next/*` entries necessarily change.
3. Separate critical-release remediation from unrelated moderate/high debt. Do not expand this phase
   merely to make the audit count zero.
4. State whether `sharp@^0.34.5` needs any change in this blocker phase. Do not repeat the previously
   stale `0.35.4` statement.
5. Propose exact later verification commands, including production-only audit, clean install or
   lockfile integrity, typecheck, build, focused tests, and `git diff --check`.

No package installation, lockfile generation, registry request, or advisory lookup is permitted in
this diagnosis.

## 6. Diagnosis B — five window-film failures

Diagnose the exact cause of these five failing contracts:

1. category `window` renders its controlled selector section;
2. `shop` rank can use both PPF and window film after explicit opt-in;
3. opted-in but incomplete window film locks only that family;
4. opted-in and configured window film is usable by every rank;
5. every managed family is hidden only by its own OFF switch and is shown when ON/configured.

Required analysis:

- Trace the supplied `SC` fixture through `Step4Estimate`, `serviceFamilyForCategory`,
  `isWindowFilmV1RuntimeReady`, and `WindowFilmSelector`.
- Explain why the window-film marker is absent while the other managed-family assertions pass.
- Distinguish an obsolete test fixture from a real production defect. A test-only fix is allowed as
  a recommendation only if the production contract is already correct and the supplied source
  proves it.
- If production code is defective, name the smallest exact source and test files that need changes.
- If the tests are defective, name the smallest exact test delta and explain why it preserves the
  runtime fail-closed contract.
- Do not waive the failures merely because they also exist at the base commit.
- Propose one exact focused command that must reach 44/44, then the complete changed-test command
  that must reach 473/473, followed by typecheck/build/diff-check gates.

## 7. Diagnosis C — governance and Staging evidence reconciliation

Produce a minimal append-only reconciliation plan for the stale canonical HOLD statements.

Required conclusions:

1. Identify the exact records in `GYEON_DA_PHASE_RESULTS.md` and, only if actually inconsistent,
   `GYEON_DA_COMPLETION_PLAN.md` that need an explicit superseding record. Do not erase historical
   evidence.
2. Define the new supersession marker, the prior marker(s) it supersedes, the fixed HEAD/tree it
   accepts, and the evidence URLs/identifiers that must be cited.
3. Distinguish source/build evidence from live Staging evidence. A Vercel PASS cannot prove that a
   Supabase migration, RPC grant, table population, or authenticated lookup exists in Staging.
4. From the supplied SQL, verify only static intent: private schema, RLS, explicit grants/revokes,
   authenticated lookup RPC, service-role import boundary, and fixed `search_path`. Do not claim
   runtime application from source alone.
5. If the bundle lacks exact live evidence proving current Staging migration/RPC/data state, return
   `BLOCKED_NEEDS_READ_ONLY_STAGING_EVIDENCE` and list the smallest separate read-only checks needed.
   Do not contact Staging during this diagnosis.

## 8. Required result format

Return exactly one result headed by:

`GDA_PR67_FINAL_MERGE_BLOCKER_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

It must contain:

```yaml
phase: GDA_PR67_FINAL_MERGE_BLOCKER_R1_READ_ONLY_DIAGNOSIS
verdict: READY_FOR_BOUNDED_REPAIR_AUTHORIZATION | BLOCKED_NEEDS_READ_ONLY_STAGING_EVIDENCE | CHANGES_REQUIRED_DIRECTIVE | BLOCKED_INPUT
repository: nisikawa-officeAZ/GYEON
pr: 67
base: bde532f8266560311b1168dea7a6599763c7ad24
head: 948403d0ecb23c612231132730fa459335cd85b3
tree: 214a5eb09abb098529ba420dc50e00b287304815
parent: f5a4438573a97dd0ad1c7d9ac4f86f1ad676cc61
tools_used: false
network_used: false
files_modified: false
commands_run: false
external_services_contacted: false
```

Then provide, in this order:

1. `INPUT_IDENTITY` — directive SHA-256 plus all supplied path/mode/blob identities;
2. `DEPENDENCY_DIAGNOSIS` — exact blocker, minimal proposed delta, deferred debt, and gates;
3. `WINDOW_FILM_DIAGNOSIS` — exact root cause, production-vs-test classification, minimal proposed
   delta, and gates;
4. `GOVERNANCE_RECONCILIATION` — append-only supersession plan and evidence still required;
5. `PROPOSED_EDIT_ALLOWLIST` — literal paths only, grouped by dependency, window-film, and
   governance. This is a proposal, not authorization;
6. `PROTECTED_AND_DIRTY_WORK_ATTESTATION` — confirm that `ScreensPreview.tsx` content was not
   supplied/read and that no dirty/unrelated file was used;
7. `ZERO_ACTION_ATTESTATION` — confirm no tool, command, edit, test, network, provider, GitHub, DB,
   stage, commit, push, Ready, merge, or deployment action occurred.

## 9. Acceptance rule

- `READY_FOR_BOUNDED_REPAIR_AUTHORIZATION` requires a concrete, internally consistent diagnosis of
  all three blockers and a literal minimal proposed edit allowlist.
- `BLOCKED_NEEDS_READ_ONLY_STAGING_EVIDENCE` is required when the source diagnosis is complete but
  live Staging migration/RPC/data claims cannot be proven from the supplied bundle.
- `CHANGES_REQUIRED_DIRECTIVE` is required when this directive or its bundle is contradictory or
  insufficient before any later repair.
- `BLOCKED_INPUT` is required for identity mismatch, missing/truncated file, wrong blob, extra file,
  or absent directive hash.

No diagnosis result authorizes implementation. Codex must independently review the result. Any
implementation, test execution, stage, commit, push, GitHub comment, Ready transition, merge, or
deployment requires a separate owner authorization and a new bounded directive.
