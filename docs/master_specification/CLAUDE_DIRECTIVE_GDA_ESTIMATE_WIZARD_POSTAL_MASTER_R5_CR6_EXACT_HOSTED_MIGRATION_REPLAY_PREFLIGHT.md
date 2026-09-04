# Claude Directive — GDA Estimate Wizard Postal Master R5 CR6 Exact Hosted Migration Replay Preflight

## 1. Directive identity

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT` |
| Directive | `GDA_POSTAL_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT_RESULT_V1` |
| Mode | One tool-disabled, read-only static preflight after separate Owner authorization |
| Repository | `nisikawa-officeAZ/GYEON` |
| Coordination PR | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Pre-directive baseline HEAD / tree | `87d5be6eac50e3bac12ba8af09b1293ce1fdf827` / `c5a8ac8fdbd73e7f746fb889339ac5acc16f011e` |
| Target Supabase project | `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi` |
| Target organization | `officeAZ` / `ivlpkysdjbrkcozrvzwg` |
| Target region | `ap-northeast-1` |
| Target database engine | PostgreSQL `17` (`17.6.1.166`, `ga`) |
| Ratified replay set | 112 executable migrations; protected LINE migration is the sole exclusion |

This candidate authorizes no private-file transmission, Claude invocation,
command, test, Git mutation, project or provider mutation, database connection,
SQL, migration application, data transfer, secret access, Vercel change,
deployment, Ready conversion, or merge. Each later action requires a separate
Owner gate.

## 2. Objective

Perform one static preflight that determines whether a later, separately
authorized CR6 execution can apply the exact Owner-ratified migration set to
the exact empty replacement project and then prove schema-only hosted
acceptance.

The preflight must produce an exact, reviewable execution contract. It must not
connect to Supabase, PostgreSQL, the provider, Vercel, Development, Staging, or
Production. It must not stage migrations, retrieve credentials, or execute the
proposed contract.

## 3. Fixed project identity

The only possible CR6 target is:

- project name: `DealerOS-Dev-Clean-R5`;
- project ref: `nqvnjqcxgngqsqkbpdfi`;
- organization name: `officeAZ`;
- organization ID: `ivlpkysdjbrkcozrvzwg`;
- region: `ap-northeast-1`;
- database engine: PostgreSQL `17`;
- database version: `17.6.1.166`;
- release channel: `ga`;
- provider state recorded by CR5: `ACTIVE_HEALTHY`; and
- provider creation timestamp: `2026-09-03T11:52:15.655049Z`.

Any mismatch is `BLOCKED_TARGET_IDENTITY`. Do not select, create, repair,
restore, clone, pause, or alter another project. Do not infer identity from a
local link file, environment variable, URL, branch name, or CLI default.

## 4. Immutable migration contract

The CR1 decision is final for CR6:

1. The formal top-level migration inventory contains exactly `113` unique SQL
   files.
2. The executable replay set contains exactly `112` files.
3. The sole replay exclusion is
   `supabase/migrations/20260801110110_line_link_tokens.sql`.
4. Other exclusions are `0`.
5. Both provisioning migrations remain included as inert infrastructure under
   `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`.
6. GYEON partner onboarding remains disabled. Schema presence is not feature
   activation authority.
7. The postal migration
   `supabase/migrations/20260901001246_jp_postal_master.sql` must occur exactly
   once in the replay set and exactly once in the resulting hosted migration
   ledger.

The ratified 112-file aggregate SHA-256 is
`0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`.
The accepted CR3 retained `migration-manifest.txt` SHA-256 is
`722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`.
The two values use different serialization formats but bind the same 112-file
set. The target postal migration SHA-256 is
`76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`.

CR6 must not reopen the manifest decision, add an exclusion, apply a nested or
draft SQL file, insert a seed, repair migration history, or use an
unconstrained bulk `supabase db push`.

## 5. Protected-path boundary

The protected paths remain:

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
2. `supabase/migrations/20260801110110_line_link_tokens.sql`
3. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
4. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

The preflight may receive only pathname, Git mode, Git blob identity, and clean
state for these paths. It must not receive, open, read, diff, copy, print, or
hash their content. The known protected Git blobs are:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`;
- protected LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`;
- closed monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`;
- closed monthly-invoice boundary test: `fe3c80f22fd80dcbfab076082473216dda582c14`.

The protected LINE migration is both content-frozen and replay-excluded. The
closed monthly-invoice migration remains part of the ratified replay set, but
the preflight must reason from its fixed metadata and accepted CR3 evidence;
it must not inspect its contents. Any later replay mechanism must mechanically
consume immutable migration artifacts without exposing protected contents to
Claude or an operator.

## 6. Exact read boundary for a later preflight invocation

After separate Owner authorization, one tool-disabled Claude invocation may
receive exactly this directive plus the following non-protected repository
files and no others:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
5. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_R1_CODEX_NORMALIZED_RESULT.md`
6. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_ACCEPTANCE.md`
7. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR5_EMPTY_REPLACEMENT_PROJECT_CREATION.md`
8. `scripts/e2e/gda-estimate-postal-master-r5/config.toml`
9. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
10. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
11. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`
12. `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs`
13. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`
14. `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql`

It may also receive one byte-sorted metadata-only table for all 113 formal
top-level migration paths containing pathname, mode, Git blob, inclusion or
exclusion disposition, and previously attested SHA-256 where already permitted.
The table must substitute `PROTECTED_METADATA_ONLY_CLEAN` for protected-content
hashing and must not contain SQL text.

It may additionally receive one non-secret, dated transcript of current
official Supabase CLI help or official documentation covering only the proposed
replay commands and flags. The transcript must identify the CLI version and
source URL or exact help command. It is evidence input only; Claude must not
browse, execute, or refresh it during the tool-disabled preflight.

No secret, environment file, project password, access token, API key, database
URL, connection string, customer row, Auth payload, Storage payload, log
payload, or old-Development data may be supplied.

## 7. Required preflight findings

### CR6-P-A — Source, project, and manifest identity

Confirm from the supplied static evidence that:

- the actual invocation HEAD/tree is supplied explicitly, descends from the
  pre-directive baseline in Section 1, and differs from that baseline only by
  the committed CR6 directive and any separately accepted documentation-only
  correction commits;
- the repository index and worktree are clean and local/remote divergence is
  `0 0` at invocation time;
- PR #67 remains OPEN and Draft against `main`;
- the project identity matches Section 3;
- the 113-path inventory, 112-file replay set, one exclusion, order, manifest
  hashes, postal migration identity, provisioning disposition, and protected
  metadata all match Sections 4 and 5; and
- no later source, migration, dependency, configuration, or governance drift
  invalidates the CR3 proof.

Any mismatch must be reported literally and must block CR6 execution.

### CR6-P-B — Exact replay mechanism

Specify one current, supported, non-interactive mechanism that can later:

- target only project ref `nqvnjqcxgngqsqkbpdfi` after a separate identity
  proof;
- present exactly the 112 ratified migrations in byte-sorted order;
- omit the protected LINE migration and no other migration;
- avoid unconstrained bulk `db push`;
- avoid migration-history repair;
- stop on the first error without retry, continuation, or partial repair;
- emit a non-secret command ledger and per-migration result sufficient to
  prove order and completion; and
- permit post-replay validation without exposing credentials.

The preflight must not invent a CLI flag or rely on stale syntax. If the exact
mechanism cannot be proved from supplied, current, authoritative command
documentation, return `BLOCKED_REPLAY_MECHANISM`. A later execution phase must
perform its own read-only CLI/version discovery before any connection.

### CR6-P-C — Empty-target and external-capability gate

Define the read-only checks that a later separately authorized execution must
run before the first migration. They must prove:

- exact project, organization, region, PostgreSQL version, and healthy state;
- no application binding points to the replacement project;
- no retained customer or business data, Auth users, Storage objects, or
  imported Japan Post rows exist;
- no unexpected migration-ledger entry, user schema object, extension,
  database role, publication, replication slot, webhook, Vault secret,
  scheduled job, queue consumer, foreign-data wrapper, or external-capable
  hook exists;
- no active conflicting session, prepared transaction, or lock makes replay
  unsafe; and
- GYEON partner onboarding and every other external integration remain
  disabled.

If the clean baseline cannot be proved without destructive inspection or
secret disclosure, stop. Do not clean, reset, repair, or recreate the project.

### CR6-P-D — Hosted acceptance plan

Define a fixed non-zero post-replay assertion plan covering:

- migration-ledger count, version, and order parity with the exact 112-file
  manifest;
- schema objects, functions, triggers, constraints, indexes, policies, RLS,
  grants, ownership, and search paths;
- expected extension names and versions;
- Data API schema exposure and default privileges, including the current
  hosted-project defaults rather than assumptions from an older project;
- Storage bucket and policy metadata without any Storage object payload;
- real request-scope Auth/RLS behavior using isolated synthetic identities;
- separate-connection concurrency wherever the accepted contract requires it;
- postal schema and RPC behavior without importing the real Japan Post CSV;
- zero unexpected external-capable jobs, hooks, webhooks, functions, or
  outbound calls;
- zero retained business data; and
- evidence capture, redaction, hashing, cleanup of synthetic rows, and final
  project-health verification.

Source assertions alone cannot substitute for hosted SQL, Auth, RLS, Data API,
or concurrency evidence in the later execution phase.

### CR6-P-E — One-shot execution envelope

Define the minimum later Owner authorization as one exact, one-shot operation.
It must freeze:

- target project ref;
- source HEAD and tree;
- replay-set count, exclusion, order, and both manifest hashes;
- exact tool and version;
- exact non-secret command plan;
- exact pre- and post-check plans;
- evidence directory outside the repository and protected roots;
- a unique unused attempt identifier;
- maximum duration and no-retry rule; and
- cleanup and incident-report behavior after success or failure.

The future execution must end after schema-only hosted acceptance. It must not
continue into CR7 data inventory, CR8 import, application binding, Vercel
configuration, cutover, old-project retirement, Ready conversion, merge, or
deployment.

## 8. Mandatory stop conditions

Return a blocking verdict immediately if any of the following occurs:

- source HEAD/tree, PR state, Git cleanliness, or upstream parity differs;
- target name, ref, organization, region, PostgreSQL version, or health differs;
- the project is not demonstrably empty and isolated;
- migration inventory is not exactly 113, replay count is not exactly 112, or
  exclusion count is not exactly one;
- the excluded path is not exactly the protected LINE migration;
- manifest, postal-migration, or protected metadata differs;
- the exact replay mechanism or current command syntax is unproved;
- a bulk `db push`, migration-history repair, old-project restore, retry, or
  partial repair would be required;
- a credential or protected content would need to be exposed;
- a real Japan Post CSV or retained business/Auth/Storage payload would be
  required;
- an unexpected extension, role, publication, replication slot, scheduled job,
  queue, webhook, Vault secret, external hook, active lock, session, or prepared
  transaction exists;
- partner onboarding or another external integration is enabled;
- a protected path would be opened, read, diffed, copied for inspection,
  printed, modified, staged, or re-hashed; or
- any action outside this static preflight is requested.

Do not retry, repair, broaden scope, substitute another project, or downgrade a
stop condition to a warning.

## 9. Required result format

Return exactly one report beginning with:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT_RESULT_V1`

Then include all fields below:

```text
verdict: READY_FOR_CR6_EXECUTION_AUTHORIZATION | CHANGES_REQUIRED | BLOCKED_INPUT | BLOCKED_TARGET_IDENTITY | BLOCKED_REPLAY_MECHANISM
execution_identity:
target_identity:
source_and_pr_state:
protected_path_metadata_only:
formal_migration_inventory:
ratified_replay_manifest:
line_exclusion_proof:
postal_migration_proof:
cr3_evidence_reuse_assessment:
exact_replay_mechanism:
current_cli_documentation_basis:
empty_target_precheck_plan:
external_capability_precheck_plan:
hosted_acceptance_assertion_plan:
evidence_and_redaction_plan:
one_shot_execution_envelope:
mandatory_stop_conditions:
minimum_next_gate:
prohibited_action_attestation:
```

`READY_FOR_CR6_EXECUTION_AUTHORIZATION` means only that Codex may independently
review the static plan and the Owner may later decide whether to authorize one
exact hosted replay. It is not execution authority.

## 10. Prohibited actions

The preflight must not:

- use tools, network, shell, Git, filesystem, Supabase, PostgreSQL, provider,
  Vercel, browser, Auth, Storage, or external-service access;
- request or receive any file outside Section 6;
- access protected contents or secrets;
- run tests, commands, containers, database checks, SQL, migrations, imports,
  exports, restores, or deployments;
- create, change, pause, delete, or bind a project;
- edit, create, delete, stage, commit, push, comment, mark Ready, merge, or
  deploy; or
- authorize CR6 execution or any later phase.

The minimum next step after a conforming result is independent Codex review.
Only a fresh explicit Owner decision may authorize a later one-shot CR6 hosted
migration replay.
