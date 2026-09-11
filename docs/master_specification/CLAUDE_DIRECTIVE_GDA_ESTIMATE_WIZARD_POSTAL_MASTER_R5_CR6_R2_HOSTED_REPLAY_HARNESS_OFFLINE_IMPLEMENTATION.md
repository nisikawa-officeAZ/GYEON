# Claude Directive — GDA Estimate Wizard Postal Master R5 CR6-R2 Hosted Replay Harness Offline Implementation

## 1. Authority and phase ceiling

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2_HOSTED_REPLAY_HARNESS_OFFLINE_IMPLEMENTATION` |
| Directive marker | `GDA_POSTAL_R5_CR6_R2_HOSTED_REPLAY_HARNESS_OFFLINE_IMPLEMENTATION_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2_HOSTED_REPLAY_HARNESS_OFFLINE_IMPLEMENTATION_RESULT_V1` |
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | `#67`, OPEN/Draft, base `main` |
| Pre-authoring HEAD / tree | `bd59b08ae1268c6db3bbb5b44142066b90c2be70` / `03d5c4d58f79ea0b1dab75bd527c394acc2474ce` |
| Future implementation identity | Exact delivered directive commit/tree must be quoted in the later Owner authorization |
| Fixed target | `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi` |
| Implementation ceiling | Create exactly fourteen new harness/test files and run offline checks only |

This directive converts the accepted CR6-R1A static contract into an offline,
testable hosted-replay harness candidate. It does not authorize the harness to
contact Supabase, PostgreSQL, a provider, Vercel, Auth, Storage, DNS, or any
other network endpoint. It does not authorize migration replay or hosted
prechecks.

The current authoring phase may write only this directive and the three
governance trackers named in Section 12. A later Claude implementation requires
separate Owner authorization after this directive is committed and pushed.

## 2. Accepted predecessor gates

The following gates are binding:

1. CR6 returned `BLOCKED_REPLAY_MECHANISM`; the stop remains accepted.
2. CR6-R1 established the official Supabase CLI `2.116.0` failure semantics,
   isolated-workdir requirement, one-attempt limit, and quarantine rule.
3. CR6-R1A returned
   `READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION`.
4. MacBook Codex accepted CR6-R1A after verifying exactly fourteen future
   implementation paths, seven runtime/test pairs, eighteen mandatory offline
   requirements, two CLI argument arrays, and the nine-file diagnosis input
   boundary.
5. The phrase `tool-disabled` applies to the completed static diagnosis only.
   A later CR6-R2 implementation may use file-editing and exact offline-test
   tools within this directive, but no network or hosted tool.

No predecessor result itself authorizes this implementation. Only a separate
Owner approval after delivery of this directive may start the implementation.
That approval must quote the delivered directive commit and tree. If either
identity is absent or differs from the invocation checkout, the implementation
must return `BLOCKED_INPUT` before any file creation or test execution.

## 3. Frozen target, manifest, and protected metadata

### 3.1 Target

- organization: `officeAZ` / `ivlpkysdjbrkcozrvzwg`;
- project: `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi`;
- region: `ap-northeast-1`;
- PostgreSQL: `17.6.1.166`, engine `17`, channel `ga`;
- provider state recorded by CR5: `ACTIVE_HEALTHY`.

### 3.2 Manifest

- formal top-level migrations: `113`;
- future staged migrations: `112`;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- other exclusions: `0`;
- aggregate 112-file manifest SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- postal migration SHA-256:
  `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`.

### 3.3 Protected paths

The following paths remain metadata-only and may not be opened, read, diffed,
displayed, copied to a prompt, or modified:

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
   (`100644`, blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`);
2. `supabase/migrations/20260801110110_line_link_tokens.sql`
   (`100644`, blob `accd22345054cc44f89156fd78eaba6dfe4242a4`);
3. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
   (`100644`, blob `32fda49583ae1217bc13711784ad8fa31744726c`);
4. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
   (`100644`, blob `fe3c80f22fd80dcbfab076082473216dda582c14`).

A later separately authorized hosted phase may mechanically materialize the
fixed monthly-invoice migration blob into an isolated replay workdir under the
CR6-R1A contract. CR6-R1A did not authorize that action, and CR6-R2 must not
materialize it because this phase never stages real migrations or runs the
production preflight.

## 4. Exact implementation write allowlist

The later CR6-R2 implementation may create exactly these fourteen new files
and may modify no existing repository file:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/manifest-core.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/manifest-core.test.mjs`
3. `scripts/e2e/gda-estimate-postal-master-r5-cr6/replay-command-core.mjs`
4. `scripts/e2e/gda-estimate-postal-master-r5-cr6/replay-command-core.test.mjs`
5. `scripts/e2e/gda-estimate-postal-master-r5-cr6/redaction-core.mjs`
6. `scripts/e2e/gda-estimate-postal-master-r5-cr6/redaction-core.test.mjs`
7. `scripts/e2e/gda-estimate-postal-master-r5-cr6/quarantine-core.mjs`
8. `scripts/e2e/gda-estimate-postal-master-r5-cr6/quarantine-core.test.mjs`
9. `scripts/e2e/gda-estimate-postal-master-r5-cr6/preflight.mjs`
10. `scripts/e2e/gda-estimate-postal-master-r5-cr6/preflight.test.mjs`
11. `scripts/e2e/gda-estimate-postal-master-r5-cr6/apply-once.mjs`
12. `scripts/e2e/gda-estimate-postal-master-r5-cr6/apply-once.test.mjs`
13. `scripts/e2e/gda-estimate-postal-master-r5-cr6/finalize-evidence.mjs`
14. `scripts/e2e/gda-estimate-postal-master-r5-cr6/finalize-evidence.test.mjs`

There is no fifteenth path. No package manifest, lockfile, migration, existing
harness file, governance document, application source, fixture, snapshot, or
generated artifact may be changed by the implementation invocation.

## 5. Module contracts

### 5.1 `manifest-core.mjs`

Pure functions only. Given injected metadata, it must construct and validate
the exact 113-to-112 manifest contract, byte-sort paths, exclude only the LINE
migration by literal path, reject all drift, and handle the monthly-invoice
migration through fixed Git blob identity only. It must never read files,
execute Git, hash protected content, or perform I/O directly.

### 5.2 `replay-command-core.mjs`

Pure functions only. It must validate the fixed project ref, absolute isolated
workdir, sanitized environment, and exact command arrays in Section 6. It must
return executable plus argv as separate values and require `shell: false`.

### 5.3 `redaction-core.mjs`

Pure functions only. It must redact and detect access tokens, JWT-shaped
values, Supabase secret/publishable keys, authorization headers, Postgres
connection strings, password arguments, password query parameters, and
equivalent configured secret patterns. A retained secret-pattern match must
fail closed.

### 5.4 `quarantine-core.mjs`

Pure deterministic state transitions only. It must classify non-zero exit,
timeout, signal, interactive prompt, target/ledger mismatch, redaction failure,
hash failure, and uncertain state as `QUARANTINE_NO_RETRY`. A burned
`project_ref + attempt_id` pair can never return to an executable state.

### 5.5 `preflight.mjs`

Exports an offline preflight function with injected Git, filesystem, path,
clock, and environment adapters. It must verify the delivered directive
HEAD/tree quoted in the later Owner authorization plus fixed branch/PR,
clean worktree and index, `0 0` upstream parity, protected metadata, unused
attempt identifier, canonical isolated location, no symlink escape, exact
manifest metadata, and no stale `.temp/project-ref` before returning a staged
plan.

It must not execute automatically when imported. CR6-R2 tests must inject an
in-memory filesystem and fake Git adapter; they must not materialize real
migration files.

### 5.6 `apply-once.mjs`

Exports a function with injected process, clock, timer, environment, and event
sinks. The production-shaped sequence is:

1. consume a previously accepted preflight plan;
2. execute exactly one read-only migration-list process;
3. reject any target/ledger mismatch or interactive prompt;
4. execute at most one migration-up process;
5. enforce a hard 30-minute ceiling and explicit signal handling; and
6. return a success or quarantine decision without retry.

It must not execute automatically when imported. CR6-R2 tests must use a fake
process adapter and must never call the real `supabase` binary.

### 5.7 `finalize-evidence.mjs`

Exports a function with injected volatile storage, retention storage, hashing,
and deletion adapters. It must redact before retention, scan the redacted copy,
verify retained hashes, and only then dispose of raw output. Any uncertain or
failed evidence step returns quarantine and preserves no secret-bearing
artifact.

It must not execute automatically when imported. CR6-R2 tests must use
in-memory adapters only.

## 6. Exact future command contracts

CR6-R2 may encode and test these values but may not execute them.

Read-only ledger precheck argv:

```text
[
  "migration", "list",
  "--linked",
  "--project-ref", "nqvnjqcxgngqsqkbpdfi",
  "--workdir", "<absolute-isolated-runtime-workdir>",
  "--output-format", "json"
]
```

Single migration application argv:

```text
[
  "migration", "up",
  "--linked",
  "--project-ref", "nqvnjqcxgngqsqkbpdfi",
  "--workdir", "<absolute-isolated-runtime-workdir>",
  "--yes",
  "--output-format", "json"
]
```

The executable name is `supabase`. `--include-all`, `--db-url`, `--local`,
`link`, `db push`, `migration repair`, `db reset`, seed commands, password
arguments, shell interpolation, and `shell: true` are forbidden.

## 7. Exact offline test ownership

| Test file | Must prove |
|---|---|
| `manifest-core.test.mjs` | 113/112/one-exclusion arithmetic, byte order, duplicates/missing/unexpected/nested/draft/seed rejection, fixed protected metadata |
| `replay-command-core.test.mjs` | Both exact argv arrays, fixed target, absolute-workdir validation, forbidden flags/env/password/shell rejection |
| `redaction-core.test.mjs` | Every configured fake-secret class is redacted and any surviving secret match fails closed |
| `quarantine-core.test.mjs` | Every failure class burns the attempt, no retry transition exists, uncertain state quarantines |
| `preflight.test.mjs` | Dirty/drift/divergence/protected mismatch, temp/excluded roots, reused suffix, symlink escape, stale project-ref, and zero-process-spawn rejection |
| `apply-once.test.mjs` | Read-only list precedes apply, apply spawn count is at most one, prompts fail, timeout is 1,800,000 ms, signals and mismatches quarantine |
| `finalize-evidence.test.mjs` | Raw data is never retained, redaction precedes write, secret scan and hashes fail closed, raw disposal follows verified retention |

The tests must cover all eighteen requirements frozen in CR6-R1A. One test may
cover multiple requirements, but every requirement must have at least one
named assertion and every runtime module must be imported by its paired test.

### 7.1 Mandatory eighteen-requirement matrix

The fourteen-file candidate is not acceptable unless its tests prove all of
the following:

1. exactly 113 formal migration paths are discovered;
2. exactly 112 paths are staged in byte order;
3. exactly the LINE migration is excluded and never opened or materialized;
4. nested, draft, seed, duplicate, missing, or unexpected SQL paths fail;
5. the monthly-invoice migration is handled only by fixed Git blob identity
   and is never displayed, inspected, diffed, transformed, or newly hashed;
6. dirty Git state, wrong HEAD/tree, upstream divergence, wrong PR/branch, or
   protected metadata drift fails before token or network access;
7. an excluded or temporary root, reused suffix, symlink escape, or existing
   `.temp/project-ref` fails before staging or command construction;
8. the two exact argv arrays match Section 6 and are never joined into a shell
   string;
9. `SUPABASE_PROJECT_ID`, `SUPABASE_DB_URL`, password argv, shell mode,
   `--include-all`, and every prohibited command are rejected;
10. no process is spawned during offline preflight tests;
11. `apply-once.mjs` performs one read-only list call before any possible apply
    and spawns the apply process at most once;
12. a password/interactive prompt, non-zero exit, signal, timeout, target
    mismatch, ledger mismatch, or evidence failure blocks or quarantines and
    never retries;
13. the 30-minute watchdog is deterministic under an injected clock;
14. fake access tokens, JWTs, secret keys, connection strings, passwords, and
    authorization headers never enter retained output;
15. a post-redaction secret-scan match fails closed;
16. partial progress records the last observed migration-start event without
    claiming that the file or manifest completed;
17. raw output is discarded only after a redacted copy is written and its hash
    is independently verified; and
18. a burned attempt identifier cannot be reused.

## 8. Allowed implementation tools and commands

After separate Owner authorization, the implementation invocation may use:

- file read tools for the exact Section 9 read allowlist;
- file create/edit tools for the exact fourteen Section 4 paths;
- read-only Git identity, status, diff-name, diff-stat, and protected-metadata
  commands;
- `node --check` against the fourteen new `.mjs` files;
- one `node --test` command naming exactly the seven `*.test.mjs` files;
- `git diff --check`; and
- `git diff --no-index --check /dev/null <new-path>` for each of the fourteen
  untracked files. Exit `1` with zero output is the expected clean-difference
  result; any output is a whitespace failure.

The invocation must not use:

- `supabase` in any form, including `--version` or `--help`;
- DNS, curl, browser, WebFetch, WebSearch, MCP, provider, or network tools;
- Docker, Colima, psql, SQL, Auth, Storage, Vercel, or deployment tools;
- package installation, dependency changes, code generation, formatting that
  touches files outside the fourteen-path allowlist;
- Git add, commit, push, stash, restore, reset, clean, checkout, branch
  mutation, PR comment/state changes, Ready, merge, or deployment.

If a required test cannot run without violating these limits, return
`BLOCKED_ENVIRONMENT`. Do not weaken, skip, or replace the test.

## 9. Exact implementation read boundary

After separate Owner authorization, Claude may receive this directive as the
sole control file plus exactly these twelve existing repository files:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1A_RESULT_CONSISTENCY_CORRECTION.md`
8. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_ACCEPTANCE.md`
9. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR5_EMPTY_REPLACEMENT_PROJECT_CREATION.md`
10. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
11. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
12. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`

The existing repository read payload is exactly `1 + 12 = 13` files. The
fourteen new implementation paths do not exist at invocation start and are the
only writable paths. No protected content, migration content, environment
file, secret, customer/business data, Auth/Storage payload, or provider log may
be supplied.

## 10. Required verification commands

The future implementation result must report the literal commands and exit
codes for:

1. `node --check` on all fourteen new `.mjs` paths;
2. `node --test` with exactly these seven test files:
   - `manifest-core.test.mjs`;
   - `replay-command-core.test.mjs`;
   - `redaction-core.test.mjs`;
   - `quarantine-core.test.mjs`;
   - `preflight.test.mjs`;
   - `apply-once.test.mjs`; and
   - `finalize-evidence.test.mjs`;
3. `git diff --check` plus fourteen literal
   `git diff --no-index --check /dev/null <new-path>` checks, each returning
   exit `1` with zero output;
4. an exact changed-path comparison proving only the fourteen new files; and
5. metadata-only confirmation that all four protected blob identities remain
   unchanged.

No generated coverage file, snapshot, cache, log, evidence directory, runtime
workdir, or test artifact may remain in the repository.

## 11. Required implementation result

The future Claude result must begin with:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2_HOSTED_REPLAY_HARNESS_OFFLINE_IMPLEMENTATION_RESULT_V1`

Allowed verdicts are:

```text
PASS_OFFLINE_CANDIDATE_READY_FOR_CODEX_AUDIT
CHANGES_REQUIRED
BLOCKED_INPUT
BLOCKED_ENVIRONMENT
```

The result must report:

- actual invocation HEAD/tree/branch/PR and upstream parity;
- exact read and write path counts;
- actual changed paths and file modes;
- one responsibility and one paired test for every runtime module;
- literal verification commands, test counts, and exit codes;
- confirmation that no real process, network, Supabase, DB, provider, Vercel,
  Auth, Storage, migration, or protected-content access occurred;
- confirmation that stage, commit, push, Ready, merge, and deployment did not
  occur; and
- the exact next gate.

The maximum successful next gate is independent MacBook Codex audit of the
unstaged fourteen-file candidate. Even a passing result does not authorize
stage, commit, push, Hosted precheck, Hosted replay, migration application,
CR7 or later work, Ready, merge, deployment, cutover, or retirement.

## 12. Current documentation authoring allowlist

This directive-authoring phase may change exactly four documentation paths:

1. this new directive;
2. `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`;
3. `GYEON_DA_COMPLETION_PLAN.md`; and
4. `GYEON_DA_PHASE_RESULTS.md`.

No other path may change. Stage, commit, push, private-file transmission,
Claude implementation invocation, source/test creation, test execution,
Supabase/DB/provider/Vercel access, hosted precheck, migration replay, Ready,
merge, deployment, cutover, or retirement requires a later explicit Owner
authorization.
