# Claude Directive — GDA Estimate Wizard Postal Master R5 CR6-R1 Hosted Replay Mechanism Correction

## 1. Directive identity

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION` |
| Directive | `GDA_POSTAL_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION_RESULT_V1` |
| Mode | One tool-disabled, read-only static mechanism diagnosis after separate Owner authorization |
| Repository | `nisikawa-officeAZ/GYEON` |
| Coordination PR | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Pre-directive baseline HEAD / tree | `0dd1f7691bbeefdc09035c87567abca27b2e3ebc` / `1255fc641fe180a7514b40a6bb65e3d6c3261e6a` |
| Target Supabase project | `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi` |
| Ratified replay set | 112 executable migrations; protected LINE migration is the sole exclusion |

This directive supersedes only the replay-mechanism analysis in
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT.md`.
It does not change the accepted project identity, migration manifest, protected
paths, CR3 evidence, CR5 lifecycle, or later CR7-CR11 gates.

This candidate authorizes documentation only. It does not authorize private-
file transmission, Claude invocation, harness or source implementation, tests,
Git stage/commit/push, Supabase or database access, SQL, migration replay,
provider or Vercel mutation, project binding, Ready conversion, merge, or
deployment.

## 2. Accepted CR6 result and Codex correction

The prior tool-disabled CR6 preflight returned:

- marker:
  `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT_RESULT_V1`;
- verdict: `BLOCKED_REPLAY_MECHANISM`;
- invocation HEAD/tree:
  `73a63e660808a337d61a2488b818ac5d2e7c69d7` /
  `20c2c2e0d6301d80773f15f202081e004ac1a618`; and
- result SHA-256:
  `29216399e7fb1351385921a0558521d9d90effdd40a99764987a8d4a76d560ed`.

MacBook Codex accepts the blocking verdict but corrects one rationale using
the official Supabase CLI `v2.116.0` source:

1. `migration up` builds its migration directory from
   `<workdir>/supabase/migrations`, obtains the pending set, and applies it in a
   sequential loop. An application error exits the effect and prevents later
   loop iterations. Stop-on-first-error is therefore source-proven for this
   exact version.
2. The CLI has no documented named-file exclusion flag. A protected migration
   can be guaranteed absent only by presenting an isolated workdir containing
   the exact permitted set.
3. Pipeline-incompatible SQL can run outside the migration transaction. A
   mid-file failure can therefore leave earlier statements committed without a
   migration-history row. Stopping is not equivalent to whole-replay
   atomicity.
4. The unresolved requirement is an accepted hosted-specific wrapper that
   constructs the isolated 112-file workdir before network contact, binds the
   one target, captures a credential-safe ledger, applies once, and quarantines
   any partial failure without retry or repair.

Official source identity used by Codex:

- release: Supabase CLI `v2.116.0`;
- tag object: `88a1f645050693664730a99e21c09d119e0df436`;
- commit: `997a1e69a4a83466964ed874d3a604c88a7b3866`;
- tree: `656e3836031e686f10cc6f6ca41e90724c8029d5`;
- migration-up handler:
  `apps/cli/src/legacy/commands/migration/up/up.handler.ts`; and
- migration-up side-effect contract:
  `apps/cli/src/legacy/commands/migration/up/SIDE_EFFECTS.md`.

If supplied source evidence differs from this identity, Claude must return
`BLOCKED_CLI_EVIDENCE`. It must not browse or refresh the evidence itself.

## 3. Objective

Perform one static diagnosis that returns the smallest exact implementation
contract for a hosted-replay harness. The proposed harness must make a future
CR6 execution reviewable without contacting any hosted system during this
diagnosis.

The result must decide whether a supported, non-interactive Supabase CLI
`v2.116.0` invocation can be safely wrapped. It must define exact proposed
files, responsibilities, offline tests, command argument arrays, evidence
artifacts, redaction, watchdog, and partial-failure behavior. It must not write
those files or run the command.

## 4. Fixed project and migration invariants

The following are closed decisions:

- organization: `officeAZ` / `ivlpkysdjbrkcozrvzwg`;
- project: `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi`;
- region: `ap-northeast-1`;
- PostgreSQL: `17.6.1.166`, engine `17`, channel `ga`;
- project state recorded by CR5: `ACTIVE_HEALTHY`;
- project creation timestamp:
  `2026-09-03T11:52:15.655049Z`;
- formal top-level migrations: `113`;
- replay set: `112`;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- other exclusions: `0`;
- provisioning disposition: `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`;
- partner onboarding: `DISABLED`;
- aggregate 112-file manifest SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- accepted CR3 migration-manifest SHA-256:
  `722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`;
- postal migration:
  `supabase/migrations/20260901001246_jp_postal_master.sql`; and
- postal migration SHA-256:
  `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`.

Claude must not reopen or optimize these decisions.

## 5. Protected-path boundary

The protected paths remain:

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
2. `supabase/migrations/20260801110110_line_link_tokens.sql`
3. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
4. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Claude may receive only pathname, mode, Git blob identity, and clean-state
metadata for them. Their fixed blobs are:

- `ScreensPreview.tsx`:
  `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`;
- LINE migration:
  `accd22345054cc44f89156fd78eaba6dfe4242a4`;
- monthly-invoice migration:
  `32fda49583ae1217bc13711784ad8fa31744726c`;
- monthly-invoice boundary test:
  `fe3c80f22fd80dcbfab076082473216dda582c14`.

The future harness may mechanically materialize the accepted monthly-invoice
migration from the fixed Git tree because it is part of the ratified replay.
Neither Claude nor an operator may display, inspect, diff, print, transform,
or newly hash its contents. The LINE migration must never be materialized into
the isolated replay workdir.

## 6. Required future harness contract

The diagnosis must define a harness satisfying every requirement below.

### 6.1 Offline preparation before network contact

- Create a unique unused runtime directory outside the repository and every
  protected root.
- Freeze the actual execution HEAD/tree and reject a dirty index/worktree or
  non-zero upstream divergence.
- Read the top-level migration path inventory from the fixed Git tree, not from
  an operator-maintained ad hoc list.
- Require exactly 113 formal paths, exclude exactly the LINE path, and stage
  exactly 112 migrations in byte-sorted order.
- Verify the accepted non-protected hashes, protected Git blob identities,
  both manifest identities, postal migration identity, and absence of nested,
  draft, seed, or unexpected SQL files.
- Copy only the minimum non-secret configuration required by the proved CLI
  mechanism.
- Finish all manifest and exclusion checks before any token lookup, project
  lookup, link, DNS request, or database connection.

### 6.2 One target and one apply

- Use an argument array, never shell interpolation, for the exact CLI command.
- Bind only project ref `nqvnjqcxgngqsqkbpdfi`; do not trust a pre-existing
  `.temp/project-ref`, environment default, URL, or branch name.
- Use the isolated runtime as the CLI `--workdir`.
- Present only the staged 112-file migration directory.
- Do not use `supabase db push`, `--include-all`, migration-history repair,
  restore, seed, retry, or continuation.
- Permit exactly one migration-up process and enforce a hard maximum duration
  of 30 minutes.
- On non-zero exit, timeout, signal, target mismatch, or evidence failure,
  stop without a second apply attempt.

The diagnosis must prove the exact non-interactive command and argument order
from the supplied CLI help and source. If a password prompt or undocumented
interactive step cannot be eliminated without exposing a credential, return
`BLOCKED_MECHANISM`.

### 6.3 Evidence without credential retention

- Capture process start/end time, PID, tool version, target ref, fixed
  HEAD/tree, runtime suffix, command name, and redacted argument names.
- Record each `Applying migration <file>` event, its order, process exit, and
  the post-run hosted ledger result.
- Keep raw stdout/stderr only in the volatile runtime until a redacted copy is
  produced.
- Redact access tokens, passwords, JWTs, API keys, database URLs, connection
  strings, authorization headers, and query parameters before retention.
- Run a fail-closed secret scan over every retained artifact.
- Hash the retained evidence set and verify hashes after cleanup copying.
- Never persist environment values or a command line containing secret values.

### 6.4 Partial-failure quarantine

Because a pipeline-incompatible statement may have committed before the
history row is written, any failed or timed-out apply must:

- mark the unique attempt as burned;
- record the last migration-start event and last confirmed remote history row;
- perform only the pre-authorized read-only incident queries;
- prohibit retry, resume, repair, rollback SQL, history insertion, `db reset`,
  project deletion/recreation, or manual completion;
- mark the hosted project `QUARANTINED_PENDING_OWNER_DECISION`; and
- stop CR6 with an incident report and retained secret-clean evidence.

Deletion, recreation, or another attempt requires a new Owner decision and a
new project or explicitly accepted recovery plan. The harness must contain no
automatic recovery branch.

### 6.5 Success boundary

After a zero exit, the harness must still require the full read-only CR6 hosted
acceptance plan: exact 112-row history/order parity, object and policy/grant
parity, current Data API exposure, extension versions, real request-scope
Auth/RLS, required separate-connection concurrency, postal RPC behavior
without real Japan Post CSV, zero unexpected external-capable objects, zero
retained business data, synthetic cleanup, secret-clean evidence, and final
project health.

Success stops at schema-only hosted acceptance. It does not authorize CR7,
real data, Auth or Storage import, Vercel binding, cutover, Ready conversion,
merge, or deployment.

## 7. Exact read boundary for a later Claude invocation

After separate Owner authorization, one tool-disabled invocation may receive
this directive as the sole control input plus exactly these fourteen
non-protected repository supporting files:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT.md`
6. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_ACCEPTANCE.md`
7. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR5_EMPTY_REPLACEMENT_PROJECT_CREATION.md`
8. `scripts/e2e/gda-estimate-postal-master-r5/config.toml`
9. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
10. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
11. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`
12. `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs`
13. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`
14. `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql`

The exact repository-file payload is therefore `1 + 14 = 15` files. No other
repository file may be transmitted or opened.

The invocation may additionally receive these non-repository evidence inputs:

- the exact prior CR6 Claude report, unmodified;
- the byte-sorted metadata-only 113-migration table used by CR6;
- a dated non-secret transcript of `supabase --version` and only the relevant
  current CLI `--help` commands;
- the exact official `v2.116.0` source files named in Section 2; and
- Codex's read-only source-audit note distinguishing sequential failure stop
  from whole-replay atomicity.

No protected content, secret, environment file, customer/business row, Auth or
Storage payload, old-Development data, or provider log may be supplied.

## 8. Required diagnosis findings

The report must:

1. confirm the actual invocation HEAD/tree, PR OPEN/Draft state, clean Git
   state, `0 0` upstream parity, fixed project identity, fixed manifest, and
   protected metadata;
2. reconcile the prior CR6 report with the official CLI source correction in
   Section 2;
3. state the exact supported non-interactive CLI command and argument array, or
   return a blocking verdict;
4. define the smallest exact future implementation allowlist, assigning one
   responsibility to each proposed file;
5. define offline unit/contract tests for 113/112/one-exclusion enforcement,
   byte order, dirty/drift rejection, target mismatch, command construction,
   no retry, timeout, redaction, secret-scan failure, partial failure,
   quarantine, cleanup, and retained-evidence hashing;
6. define which existing R5 harness modules may be reused unchanged and which
   must not be used for hosted execution;
7. define the exact later read-only prechecks and postchecks without executing
   them;
8. identify every credential source by variable name or mechanism only, never
   value, and prove it cannot enter retained output; and
9. return the minimum next gate. The maximum next gate is authorization to
   implement and run offline tests for the exact harness allowlist. It is never
   Hosted replay authorization.

## 9. Required result format

Return exactly one report beginning with:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION_RESULT_V1`

Then include every field below:

```text
verdict: READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION | CHANGES_REQUIRED | BLOCKED_INPUT | BLOCKED_CLI_EVIDENCE | BLOCKED_MECHANISM
execution_identity:
source_and_pr_state:
target_identity:
manifest_and_protected_metadata:
prior_cr6_reconciliation:
official_cli_source_findings:
exact_noninteractive_command:
isolated_workdir_and_exclusion_proof:
proposed_implementation_allowlist:
existing_harness_reuse_boundary:
offline_test_plan:
credential_and_redaction_contract:
watchdog_and_no_retry_contract:
partial_failure_quarantine_contract:
hosted_precheck_plan:
hosted_postcheck_plan:
success_stop_boundary:
minimum_next_gate:
prohibited_action_attestation:
```

`READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION` authorizes
nothing by itself. It means only that Codex may independently review the
static design and the Owner may later decide whether to authorize exact-file
harness implementation plus offline tests.

## 10. Prohibited actions

The diagnosis must not:

- use tools, network, shell, Git, filesystem, Supabase, PostgreSQL, provider,
  Vercel, browser, Auth, Storage, or external-service access;
- open any repository file outside Section 7;
- access protected contents or secrets;
- implement or modify a harness, source, test, dependency, or migration;
- run a test, command, container, database check, SQL, migration, import,
  export, restore, link, or deployment;
- create, change, pause, delete, recreate, or bind a project;
- retry, repair, resume, or invent a migration-history state;
- edit, create, delete, stage, commit, push, comment, mark Ready, merge, or
  deploy; or
- authorize CR6-R2 implementation, CR6 hosted execution, or any later phase.

The minimum next step after a conforming report is independent Codex review.
Every later implementation, offline verification, Git delivery, hosted
precheck, and hosted replay remains a separate Owner gate.
