# Claude Directive — GDA Estimate Managed Service Offering R1-B-R2-A1 Harness Correction

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_A1_HARNESS_CORRECTION_RESULT_V1`

## Phase and authority

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-B-R2-A1`
- Mode: one bounded correction of the retained uncommitted B-R2 candidate plus static checks only
- Responsible correction agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This directive does not authorize execution by itself. MacBook Codex may invoke it only after the owner separately approves external transmission of the exact private read set and correction of the exact five paths below. It never authorizes database startup, disposable execution, Git delivery, PR mutation, Ready, merge, shared/production application, or deployment.

## Why B-R2 is returned

The B-R2 Claude run returned `CANDIDATE_READY_FOR_CODEX_REVIEW`, and MacBook Codex independently accepted the new migration's C.9/C.9a/C.10 ordering, one-query family mapping, stable error, replay/conflict precedence, and static syntax. The source candidate is nevertheless `CHANGES_REQUIRED_HARNESS_ONLY` because its acceptance harness does not yet prove the contract it claims to prove.

The migration is frozen in A1. Do not redesign or rewrite the accepted SQL guard.

## Invocation identity and retained dirty baseline

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#44`, which must remain `OPEN/Draft`
- Branch: `plan/estimate-managed-service-offering-enforcement-r1`
- B-R2 governance commit: `c4c3b9825c5596e0c7d2b0728c25881d9b550952`
- B-R2 governance tree: `b7d78864048a874c231fb02ea186a242fa088a5a`
- MacBook Codex must supply the exact later governance execution HEAD/tree containing this A1 directive.
- The committed delta from `c4c3b9825c5596e0c7d2b0728c25881d9b550952` to that governance HEAD must contain exactly the completion plan, append-only phase ledger, and this new A1 directive.
- The index must be clean.
- The initial worktree must be dirty in exactly the nine retained B-R2 candidate paths below, with no tenth changed/untracked path.

Retained B-R2 candidate SHA-256 baseline:

1. `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql` — `9319203d67ce42d8f54998b3db0e4af6c0f45ada36c7b20b7c51c047cbfcd499`
2. `supabase/tests/estimate_wizard_atomic_save.test.sql` — `5c85aef563241bd5b1e82d618131ef3b756f2d85a170e57d00b0f157c25d30b5`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/config.toml` — `5644922a3fbcf798abb54d9c57ca61a6574952c5a5b1be04ed872e26ee1b371c`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh` — `39665cb674e4f8efb6ca1fef31f3aee3e8e6350b71514f293d883a5302915d65`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql` — `6b9ea95438d1954fd616bac336188668994a2432ba86668c695d7bb8e8094cc0`
6. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/real-auth.mjs` — `448966fe0c7ed7f6558fef8cc478bc93d504b1a70c46b3c65ecdb93310959ecf`
7. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/concurrency.mjs` — `05fe3a9a5dd8fa5006ab1219e04b9ac05ce937a5406d6281a4923f0098c80e59`
8. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/capture-evidence.sh` — `747a81fa7f43b67f9aa5e97e3f5eb79e2dbc573a95d00f09a712a890753fbdf3`
9. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/cleanup.sh` — `79550f085b81d0ff7d06329685bca0413fabdcd6d27910848c512b52066cdb84`

If the branch, PR state, supplied governance HEAD/tree, index cleanliness, exact nine-path dirty set, any baseline hash, or protected metadata fails, return `BLOCKED_BASE_MISMATCH` without changing files.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest managed-service entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_SQL_HARNESS_IMPLEMENTATION.md`
5. This directive

Then state the active phase, exact read set, exact five-path correction allowlist, four frozen candidate paths, protected paths, static-only boundary, and stop boundary.

## Literal correction/reference read set

Only the mandatory documents above and these existing paths may be opened or searched:

1. All nine retained B-R2 candidate paths listed in the baseline above
2. `supabase/migrations/20260728150348_dealer_service_offerings.sql`
3. `supabase/migrations/108_secure_wizard_catalog_authoring.sql`
4. `supabase/migrations/20260825151059_persist_existing_vehicle_confirmed_body_size.sql`
5. `package.json`

Do not open another source, migration, test, harness, configuration, dependency, generated, or protected-content path. If one additional existing path is indispensable, return `BLOCKED_SCOPE_REQUIRES_ONE_PATH` with that exact path and stop without edits.

## Literal correction write allowlist — exactly five existing paths

1. `supabase/tests/estimate_wizard_atomic_save.test.sql`
2. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/concurrency.mjs`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/capture-evidence.sh`

## Frozen candidate paths — must remain byte-identical

1. `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql`
2. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/config.toml`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/real-auth.mjs`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/cleanup.sh`

Every other repository path is also frozen. Do not add a tenth candidate path.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify contents. Require exact mode `100644`, exact blob, and clean Git status for each:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` → `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` → `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` → `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` → `fe3c80f22fd80dcbfab076082473216dda582c14`

## Required A1 corrections

### 1. Fail-closed setup identity gates

Correct `setup.sh` so it fails before creating a runtime unless all of the following are true:

- The invocation-supplied expected HEAD/tree match the checked-out committed governance HEAD/tree.
- The committed source-candidate paths at HEAD match the invocation-supplied accepted migration and pgTAP hashes.
- The upstream tracking ref exists and `git rev-list --left-right --count "@{u}...HEAD"` is exactly `0 0`; recording a non-zero result without failing is forbidden.
- Each protected path has exact mode `100644`, exact required blob, and no Git status entry. Merely writing metadata to evidence is insufficient.
- The worktree and index are clean at future runtime execution. A1 source correction itself remains uncommitted and is not run.

### 2. Execute both pgTAP authorities in the future runtime

The original B-R2 directive required exact migration/test/harness copy. Correct `setup.sh` and `capture-evidence.sh` so the future runtime copies and executes, as two independently strict TAP files:

1. the dedicated `offering-guard.test.sql`; and
2. the extended canonical `supabase/tests/estimate_wizard_atomic_save.test.sql`.

For each file independently:

- preserve its exact source hash in evidence;
- run it exactly once;
- require non-zero plan, exact plan/count equality, zero `not ok`, zero `SKIP`, zero `TODO`, zero `NOTESTS`, zero parse error, and zero process exit;
- retain clearly separated raw TAP and NDJSON assertion evidence;
- record each file's plan/count independently, plus a correctly derived aggregate if an aggregate is reported.

Do not claim the canonical extended test passed merely because its source hash was checked.

### 3. Complete pgTAP mutation and unmanaged-category proof

Correct both pgTAP files without deleting or weakening existing assertions:

- Pin every existing unmanaged category required by the active RPC, including at minimum `coating`, `other`, `interior`, and `glass`.
- Prove lifecycle-revision zero mutation for representative missing-row rejection, explicit `enabled=false` rejection, mixed-family rejection, and exact replay after disable.
- Preserve the existing customer, vehicle, estimate, item, document-number, and idempotency zero-write assertions; extend them where the current case is only partial.
- Keep the five exact managed mappings, missing/false/true behavior, cross-tenant denial, stable error, exact replay, and conflicting replay precedence.
- Update each TAP plan to its exact final assertion count only after the assertions are counted. Do not guess or reuse the current `211`/`33` values.

Lifecycle proof must use the server-owned `public.dealer_wizard_catalog_lifecycle.current_configuration_revision` value for the correct dealer. Offering changes may legitimately advance that revision; the zero-mutation comparison must snapshot the post-offering-change revision immediately before the save/replay under test and prove the RPC attempt itself does not advance it.

### 4. Deterministic disable-before-snapshot race

Correct race 1 in `concurrency.mjs`:

- Commit the disable first on its own backend.
- Read the current post-disable `dealer_wizard_catalog_lifecycle.current_configuration_revision` from a separate bounded query.
- Insert that exact revision into `metadata.configurationRevision` of the payload before the fresh save starts.
- Prove the save rejects with the exact sanitized `service-not-offered` failure.
- Prove zero mutation for customer, vehicle, estimate, item, document number, idempotency, and lifecycle revision, using the post-disable/pre-save state as the baseline.
- Preserve proof that the disable and save use distinct database backends.

A payload that omits the post-change revision does not satisfy this race contract.

### 5. Deterministic snapshot-before-disable wait proof

Correct race 2 in `concurrency.mjs`. Fixed sleeps are not synchronization proof. A `granted=false` relation lock on `document_sequences` is not a reliable PostgreSQL row-lock wait predicate.

Required source behavior:

- Start the holder and prove by bounded polling that its backend has acquired the target `document_sequences` row lock before starting the save.
- Start the save and capture its exact backend PID without waiting for the save to finish.
- Use a third observer and bounded polling to prove all of the following before committing the offering disable:
  - holder PID, save PID, and observer PID are distinct;
  - the save has `wait_event_type = 'Lock'`;
  - `pg_blocking_pids(save_pid)` contains the holder PID;
  - both holder and save have relation-lock evidence tied to `public.document_sequences`;
  - the save has not completed.
- Only after that proof, commit the offering disable from another distinct backend, then release the holder lock.
- Require the save to complete successfully from its earlier enabled snapshot and prove exactly one complete estimate with every expected item, no partial/torn state, and the expected number allocation.
- Every poll has a monotonic deadline and bounded interval. Timeout, missing PID, ambiguous blocker, early completion, or incomplete lock evidence is a hard failure and burns the future suffix.

Do not use fixed `400ms`/`600ms` sleeps as the ordering authority. Do not require a non-granted relation lock as the proof.

### 6. Fail-closed secret scan

Correct `capture-evidence.sh` so the secret scan distinguishes all grep exits:

- `0`: possible secret match → fail and burn;
- `1`: no match → clean;
- any other status: scan error → fail and burn.

Never classify a grep error as `SECRET_SCAN_CLEAN`.

## Preserved SQL and business contract

- The frozen migration remains the accepted one-query C.9a guard after replay/conflict resolution and before C.10.
- Exact replay after later disable remains a zero-write success.
- Same key plus materially different payload remains `DUPLICATE_SUBMISSION` before current offering evaluation.
- Missing row and `enabled IS NOT TRUE` mean OFF for a genuinely new save.
- The guard statement's start snapshot remains authoritative under `READ COMMITTED`.
- No per-family queries, stronger isolation, new production lock, test-only production hook, application-source change, UI change, pricing change, or historical-migration edit is allowed.

## Allowed static verification commands

After editing, run only:

- `bash -n` separately for `setup.sh` and `capture-evidence.sh`
- `node --check` for `concurrency.mjs`
- bounded `rg` checks restricted to the literal read/write sets for upstream equality, protected hard gates, both TAP files, strict independent plans/counts, lifecycle revision, `interior`, `glass`, post-disable revision injection, `wait_event_type`, `pg_blocking_pids`, bounded polling, secret-scan exit handling, result identifier, and frozen hashes
- `git diff --check`
- untracked-aware `git diff --no-index --check /dev/null <path>` output checks for the five untracked/changed correction paths as applicable; exit `1` from a non-empty no-index diff is not itself a whitespace failure, but any emitted `--check` diagnostic is
- `git status --short --branch`
- `git diff --name-only`
- `git diff --stat`
- `git ls-tree HEAD -- <protected-path>`
- `shasum -a 256` for the exact nine candidate paths

Do not run SQL, pgTAP, tests, typecheck, build, npm scripts, Supabase CLI, Docker, Colima, PostgreSQL, Auth, PostgREST, RPC, browser, network, provider, Preview, production, or deployment commands.

## Prohibitions and stop boundary

- Do not modify outside the five correction paths.
- Do not modify the frozen migration or the other three frozen candidate paths.
- Do not stage, commit, push, stash, restore, clean, reset, create/mutate a PR or comment, mark Ready, merge, apply migrations, or deploy.
- Do not access a hosted/shared/production database or external provider.
- Do not spawn subagents or use web/browser tools.
- Do not expose secrets or protected contents.
- Stop with the corrected uncommitted nine-path candidate and one result report.

## Required result schema

Return:

1. `verdict`: `CORRECTED_CANDIDATE_READY_FOR_CODEX_REVIEW`, `BLOCKED_BASE_MISMATCH`, `BLOCKED_SCOPE_REQUIRES_ONE_PATH`, or `BLOCKED_STATIC_VERIFICATION`.
2. Branch, supplied governance HEAD/tree, B-R2 governance ancestry, PR state, initial exact dirty nine-path set, clean index, nine baseline hashes, and protected metadata result.
3. Exact five corrected paths and explicit confirmation that the migration, config, real-auth, cleanup, and every other path are byte-identical to the baseline/HEAD as applicable.
4. Setup hard gates: upstream exactly `0 0`, protected mode/blob/status hard failure, both TAP files copied, and both hashes pinned.
5. Both pgTAP files' exact final plan counts, new lifecycle assertions, and unmanaged categories pinned.
6. Race 1 post-disable revision injection and complete zero-mutation evidence contract.
7. Race 2 bounded holder/save/observer PID, blocker, wait-event, relation-lock, early-completion, and final-state source contract.
8. Secret-scan exit `0/1/other` handling.
9. Static command results and `git diff --check` result.
10. Explicit confirmation: no database/runtime/test execution, no Git mutation, no external/provider action, and no secret/protected-content exposure.
11. Owner decision required: `NONE` or one exact question.

Stop. Do not execute the disposable harness or deliver the candidate.
