# Claude Directive — GDA Estimate Wizard Postal Master R5 CR6-R1A Result Consistency Correction

## 1. Authority and stop boundary

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1A_RESULT_CONSISTENCY_CORRECTION` |
| Directive marker | `GDA_POSTAL_R5_CR6_R1A_RESULT_CONSISTENCY_CORRECTION_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1A_RESULT_CONSISTENCY_CORRECTION_RESULT_V1` |
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | `#67`, OPEN/Draft, base `main` |
| Pre-authoring HEAD / tree | `a848e73d6561a1a2da3f02ec9b3fd30d7e7c84a8` / `f898b490b9f9c155e4e16cbd5343f29bf918a327` |
| Target project | `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi` |
| Mode | Documentation-only correction; no implementation or runtime |

This directive corrects internal inconsistencies in the second tool-disabled
CR6-R1 diagnosis. It does not reopen the accepted CR6 stop, authorize a hosted
replay, or authorize implementation. CR6-R2 may begin only after this directive
is delivered and a separately authorized static diagnosis returns the exact
allowed READY verdict defined below.

No database, Supabase project, provider, Vercel project, protected path,
migration, source file, test, dependency, Git index, pull-request state, or
deployment may be changed under this phase.

## 2. Findings that remain accepted

The following findings are frozen and must not be re-litigated:

1. Supabase CLI version is `2.116.0`.
2. The CLI applies pending migrations sequentially and stops after a migration
   application error.
3. The CLI exposes no named migration-file exclusion flag.
4. Pipeline-incompatible statements may commit outside the final migration
   history-writing batch. Stop-on-error is not whole-replay atomicity.
5. The hosted wrapper must stage an isolated 112-file workdir before network
   contact and must never materialize the protected LINE migration.
6. Any failure, timeout, prompt, target mismatch, evidence failure, or possible
   partial application burns the attempt and quarantines the project without
   retry, repair, reset, deletion, recreation, rollback SQL, or manual history
   insertion.
7. The fixed hosted target is organization `officeAZ` /
   `ivlpkysdjbrkcozrvzwg`, project `DealerOS-Dev-Clean-R5` /
   `nqvnjqcxgngqsqkbpdfi`, region `ap-northeast-1`, PostgreSQL
   `17.6.1.166`.
8. The fixed manifest contains 113 formal top-level migration files, stages
   exactly 112, and excludes only
   `supabase/migrations/20260801110110_line_link_tokens.sql`.
9. The 112-file aggregate manifest SHA-256 remains
   `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`.
10. The postal migration SHA-256 remains
    `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`.

## 3. Rejected CR6-R1 diagnosis defects

The corrected CR6-R1 diagnosis returned
`READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION`, but MacBook
Codex rejected that verdict as `CHANGES_REQUIRED` for these exact reasons:

1. the report said its proposed implementation allowlist contained nine files
   while it actually enumerated eleven paths;
2. the test plan required `finalize-evidence.test.mjs`, but that path was not
   present in the proposed implementation allowlist;
3. the report did not give an unambiguous test owner for every side-effecting
   orchestration module, especially `apply-once.mjs`;
4. it described `supabase migration list` as help-proven although the supplied
   evidence pack did not contain `supabase migration list --help`; and
5. its closing attestation said no file outside the fifteen repository files
   was referenced even though the invocation deliberately received two public
   official source files as additional non-repository evidence.

No later report may silently repair these defects in prose. It must use the
literal count, paths, command arrays, evidence boundary, and test ownership in
this directive.

## 4. Accepted current CLI evidence

The following non-secret transcript was captured at
`2026-09-03T13:26:06Z` from Supabase CLI `2.116.0`:

### 4.1 `supabase migration up --help`

The migration-specific flags are exactly:

- `--include-all`
- `--db-url string`
- `--linked`
- `--local`
- `--project-ref string`

Relevant global flags include `--workdir string`, `--yes`, and
`--output-format choice`.

### 4.2 `supabase migration list --help`

The migration-list flags are exactly:

- `--db-url string`
- `--linked`
- `--local`
- `--project-ref string`
- `--password, -p string`

Relevant global flags include `--workdir string` and
`--output-format choice`.

The future harness must not pass a password on the command line. It must use
`SUPABASE_ACCESS_TOKEN` through the child-process environment. If either
read-only listing or later replay unexpectedly asks for a password or any
interactive input, the phase must stop. No operator or harness may answer the
prompt.

### 4.3 Official source identity

| Source | Fixed identity |
|---|---|
| CLI tag object | `88a1f645050693664730a99e21c09d119e0df436` |
| CLI commit | `997a1e69a4a83466964ed874d3a604c88a7b3866` |
| CLI tree | `656e3836031e686f10cc6f6ca41e90724c8029d5` |
| `up.handler.ts` SHA-256 | `cbcb77602cc0173d88a6d99bdcd1dfba5a8bac7df02c54d25becd9c4dff50f99` |
| `SIDE_EFFECTS.md` SHA-256 | `7ee7dda5c5e76a7899f844b5e7347f70164fbfbfe56c655490898abf67482470` |

The source paths are:

- `apps/cli/src/legacy/commands/migration/up/up.handler.ts`
- `apps/cli/src/legacy/commands/migration/up/SIDE_EFFECTS.md`

## 5. Exact future command arrays

The CR6-R2 implementation may encode but must not execute these arrays. CR6-R3
or a later separately authorized runtime phase is required for any network or
database use.

Read-only hosted ledger precheck:

```text
[
  "migration", "list",
  "--linked",
  "--project-ref", "nqvnjqcxgngqsqkbpdfi",
  "--workdir", "<absolute-isolated-runtime-workdir>",
  "--output-format", "json"
]
```

Single hosted migration application:

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

The executable is the pinned `supabase` CLI. Invocation must use an argument
array with `shell: false`. `--include-all`, `--db-url`, `link`, `db push`,
`migration repair`, `db reset`, seed commands, and any password argv are
forbidden.

## 6. Exact CR6-R2 implementation allowlist

The future implementation allowlist is exactly fourteen new files under
`scripts/e2e/gda-estimate-postal-master-r5-cr6/`. The count, spelling, and
one-to-one module/test pairing are fixed:

1. `manifest-core.mjs`
2. `manifest-core.test.mjs`
3. `replay-command-core.mjs`
4. `replay-command-core.test.mjs`
5. `redaction-core.mjs`
6. `redaction-core.test.mjs`
7. `quarantine-core.mjs`
8. `quarantine-core.test.mjs`
9. `preflight.mjs`
10. `preflight.test.mjs`
11. `apply-once.mjs`
12. `apply-once.test.mjs`
13. `finalize-evidence.mjs`
14. `finalize-evidence.test.mjs`

There is no fifteenth implementation file. No existing repository file may be
modified by CR6-R2. No dependency or lockfile change is allowed.

## 7. One-to-one responsibility and test ownership

| Runtime module | Sole responsibility | Required paired test |
|---|---|---|
| `manifest-core.mjs` | Pure 113-to-112 manifest construction, byte order, literal LINE exclusion, fixed hash/blob metadata rules | `manifest-core.test.mjs` |
| `replay-command-core.mjs` | Pure construction and validation of the two exact argv arrays and sanitized child environment | `replay-command-core.test.mjs` |
| `redaction-core.mjs` | Pure redaction and fail-closed secret-pattern scanning before retention | `redaction-core.test.mjs` |
| `quarantine-core.mjs` | Pure attempt state machine, burn/no-retry decisions, and governance quarantine record construction | `quarantine-core.test.mjs` |
| `preflight.mjs` | Offline-only Git/worktree/manifest/protected-metadata validation and isolated staging through injected I/O | `preflight.test.mjs` |
| `apply-once.mjs` | Injected child-process orchestration: one read-only list, at most one later apply, prompt rejection, 30-minute timeout, and signal handling | `apply-once.test.mjs` |
| `finalize-evidence.mjs` | Volatile raw-output handling, redaction, secret scan, retained hashes, raw disposal, and quarantine evidence finalization | `finalize-evidence.test.mjs` |

Every test must be offline and use injected fake process, filesystem, time, and
environment adapters. CR6-R2 tests must make zero DNS, network, Supabase,
PostgreSQL, Docker, Colima, provider, Vercel, Auth, or Storage contact.

## 8. Mandatory offline test matrix

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
8. the two exact argv arrays match Section 5 and are never joined into a shell
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

The implementation phase may run only `node --check`, exact `node --test`
commands for the seven paired tests, and `git diff --check`. It may not run any
`supabase` command, including `--help`, because the CLI evidence is already
frozen in this directive.

## 9. Corrected static-diagnosis input boundary

After separate Owner authorization, one tool-disabled, read-only invocation
may receive this directive as the sole control file plus exactly these eight
repository supporting files:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_EXACT_HOSTED_MIGRATION_REPLAY_PREFLIGHT.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION.md`
7. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_ACCEPTANCE.md`
8. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR5_EMPTY_REPLACEMENT_PROJECT_CREATION.md`

The repository payload is exactly `1 + 8 = 9` files. No harness source is
needed for this correction-only consistency review because Section 6 and
Section 7 are now authoritative.

The invocation may additionally receive only these non-repository evidence
inputs:

- dated `supabase --version`, `supabase --help`,
  `supabase migration up --help`, and `supabase migration list --help`
  transcripts;
- the two public official source files and their fixed hashes from Section 4;
  and
- a concise Codex adjudication note listing the five defects in Section 3.

The attestation must distinguish repository files from public evidence. It
must say that no other repository file was opened; it must not claim that the
public evidence was absent or unreferenced.

## 10. Required result

The future diagnosis must return exactly one report beginning with:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1A_RESULT_CONSISTENCY_CORRECTION_RESULT_V1`

It must include:

```text
verdict: READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION | CHANGES_REQUIRED | BLOCKED_INPUT | BLOCKED_CLI_EVIDENCE | BLOCKED_MECHANISM
```

The report must mechanically recount the fourteen implementation paths,
confirm all seven runtime/test pairs, confirm the eighteen test requirements,
confirm the two exact command arrays, and state the exact later execution
boundary.

The READY verdict means only that the Owner may separately authorize creation
of the fourteen new files and offline tests. It does not authorize the
implementation itself, any Git operation, any hosted precheck, any Supabase or
database contact, migration replay, CR7 or later work, Ready conversion,
merge, deployment, cutover, or project retirement.

## 11. Current documentation allowlist

This CR6-R1A authoring phase may change exactly four documentation paths:

1. this new directive;
2. `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`;
3. `GYEON_DA_COMPLETION_PLAN.md`; and
4. `GYEON_DA_PHASE_RESULTS.md`.

No other file may change. Stage, commit, push, Claude invocation, harness
implementation, tests, Supabase/DB/provider access, SQL, migration replay,
Vercel change, Ready, merge, deployment, cutover, or retirement requires a
later explicit Owner authorization.
