# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3 Hosted Execution Adapter

## 1. Status and authority

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER_DIRECTIVE_V1
status: GOVERNANCE_ONLY_NOT_AUTHORIZED_FOR_IMPLEMENTATION_OR_EXECUTION
date: 2026-09-04
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
accepted_head: 8026931afc005a2583ddaa46ecc7a61894786933
accepted_tree: 18c11148b16dc42c9511f0eee1f773fa2a0c3c5e
base: main
pull_request_state: OPEN
pull_request_draft: true
hosted_target_project_ref: nqvnjqcxgngqsqkbpdfi
production_target_contact: PROHIBITED
```

This document defines a future, separately authorized offline implementation
candidate. Authoring or delivering this directive does not authorize Claude
invocation, source changes, executable tests, Supabase CLI execution, network,
Hosted Supabase or database access, migration replay, evidence upload, Git
stage/commit/push, PR mutation, Ready conversion, merge, deployment, cutover,
or retirement.

## 2. Objective

Implement the smallest reviewed execution boundary that can inject real local
Git, filesystem, process, timer, hashing, and evidence adapters into the
accepted fourteen-file CR6 offline harness. The adapter must support two
explicit modes:

1. `preflight-only`: local and read-only checks only; it must not start
   `supabase migration up` or contact a hosted project; and
2. `execute-once`: available in source but never run during implementation.
   A later Owner approval must quote the exact accepted adapter commit/tree,
   project ref, attempt id, commands, and evidence destination before this mode
   may contact the fixed replacement project.

The adapter is not permission to repair migrations or retry a failed hosted
attempt. Any ambiguity, prompt, mismatch, timeout, signal, non-zero exit,
redaction failure, hash failure, or incomplete cleanup returns
`QUARANTINE_NO_RETRY` and burns the exact `project_ref + attempt_id` pair.

## 3. Immutable accepted inputs

The existing fourteen files under
`scripts/e2e/gda-estimate-postal-master-r5-cr6/` are read-only implementation
dependencies. Their accepted combined SHA-256 of sorted `sha256sum` lines is:

`4e4dac8a8d6c667c586fee010ef7a9909c665333547c74f0ac7b37ccf44f2395`

The formal migration contract remains exactly 113 entries, of which the
protected LINE migration is excluded and exactly 112 are staged for the
replacement project. The accepted aggregate manifest SHA-256 remains:

`0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`

The following paths remain metadata-only protected and must not be opened,
read, diffed, displayed, copied to a prompt, or modified:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

The later hosted phase may materialize the monthly-invoice migration only by
its fixed Git blob into the isolated workdir. The protected LINE migration is
never materialized or applied in this phase.

## 4. Future implementation allowlist

A later explicit Owner authorization may create exactly these two files and no
others:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

No existing source, test, migration, configuration, lockfile, package file, or
governance document may be modified by that implementation invocation.

## 5. Required adapter contract

### 5.1 No implicit execution

- Importing the module performs no filesystem, Git, process, environment,
  network, Supabase, or database action.
- `preflight-only` and `execute-once` are explicit mutually exclusive modes.
- `execute-once` requires a literal confirmation argument and an unused safe
  attempt id; missing or malformed values fail before any process spawn.
- The accepted HEAD, tree, branch, PR identity, target project ref, migration
  counts, protected metadata, and aggregate hash are literals, not caller
  defaults derived from current state.

### 5.2 CLI discovery before command construction

Before accepting the adapter candidate, run only local help/version discovery:

- `supabase --version`
- `supabase migration list --help`
- `supabase migration up --help`

Record the exact CLI version and hashes of the help output. If the installed CLI
does not support every literal argument currently produced by
`replay-command-core.mjs`, return
`CHANGES_REQUIRED_CLI_COMPATIBILITY`; do not silently remove, replace, or guess
flags. A governance-authoring-time local `supabase --version` probe did not
return a version because the CLI could not write its local telemetry temporary
file (`EPERM`). That failed probe is not CLI compatibility evidence and must not
be reused as a pass. The implementation phase must not run a linked command.

### 5.3 Real adapters

- Use `node:child_process` only inside the new adapter and only with
  `spawn`/`execFile`, argument arrays, `shell: false`, and the already sanitized
  child environment.
- Never build or execute shell strings. Never accept `--db-url`, passwords,
  production refs, arbitrary project refs, or caller-supplied executable names.
- Capture stdout and stderr as volatile raw artifacts without printing secret
  values to the terminal.
- Detect interactive prompts, target mismatch, remote-ledger mismatch, signals,
  and last-started migration conservatively. Unknown output is quarantine.
- The read-only migration-list process must complete and prove the expected
  empty replacement-project ledger before the single migration-up process can
  start.
- `migration up` is spawned at most once. There is no retry, repair, reset,
  include-all, direct DB URL, or manual continuation path.
- The existing shared 1,800,000 ms attempt ceiling covers both processes.

### 5.4 Isolated workdir and manifest

- Create one fresh absolute runtime directory outside the Git worktree, with
  directory mode `0700`; reject symlinks, traversal, reused paths, and a stale
  `supabase/.temp/project-ref`.
- Materialize only the exact accepted staged migration set from the fixed Git
  identity. Do not read protected migration content from the worktree.
- Build the actual manifest and the canonical manifest through independently
  testable paths, and require the fixed aggregate hash before producing a plan.
- Never modify the repository, index, commits, branch, PR, project settings, or
  migration history source files.

### 5.5 Burn ledger and evidence

- Persist the attempt key as burned before the first real process spawn. Both
  success and failure remain burned permanently.
- Store the burn ledger and retained evidence outside the repository in one
  explicit Owner-approved directory. Directory mode is `0700`; retained files
  are `0600`.
- Run `finalizeEvidence` for every raw artifact. Redact before retention, scan
  the retained read-back, verify SHA-256 after read-back, then delete raw data.
- Never retain access tokens, database URLs, passwords, authorization headers,
  connection strings, environment dumps, or unredacted CLI output.
- Evidence must include fixed identity, mode, attempt id, process spawn count,
  start/end timestamps, exit/signal/timeout classification, migration ledger
  before/after, redacted hashes, cleanup outcome, and final decision.

## 6. Mandatory offline tests

The new test must use fake Git, filesystem, process, clock, timer, environment,
hashing, volatile-storage, retention-storage, deletion, and event adapters. It
must prove at least:

1. import has zero side effects;
2. `preflight-only` can never spawn migration-up or contact a hosted target;
3. missing confirmation, wrong HEAD/tree/branch/PR/project ref, dirty state,
   upstream divergence, bad protected metadata, wrong counts/hash, symlink or
   reused workdir, stale project ref, and burned attempt all fail before spawn;
4. only the fixed sanitized environment reaches both child processes;
5. list precedes up, the expected empty ledger is mandatory, and up is spawned
   at most once;
6. prompt, mismatch, timeout, signal, non-zero exit, redaction/hash/read-back/
   deletion uncertainty all quarantine without retry;
7. the attempt is durably burned before spawn and cannot be reused after either
   success or failure;
8. raw secret-shaped fixtures never reach retained evidence or console output;
9. valid exact fixtures complete once and produce deterministic redacted
   evidence hashes; and
10. the existing seven test files still pass unchanged.

## 7. Future implementation verification commands

The later implementation instruction must quote literal commands that cover:

- `node --check` for the two new files and the existing fourteen files;
- one `node --test` invocation covering the new adapter test plus the existing
  seven test files;
- `git diff --check`;
- exact changed-path and file-mode checks;
- the accepted fourteen-file combined SHA-256;
- protected-path metadata only; and
- clean index and unchanged upstream state.

No test command may contact Supabase, a database, GitHub, Vercel, or another
external service.

## 8. Result contract

The later implementation result must use exactly one marker:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER_IMPLEMENTATION_RESULT_V1`

Allowed verdicts:

- `READY_FOR_CODEX_OFFLINE_ACCEPTANCE`
- `CHANGES_REQUIRED_SOURCE`
- `CHANGES_REQUIRED_CLI_COMPATIBILITY`
- `BLOCKED_ENVIRONMENT`

The result must report exact identity, changed paths, file modes and hashes,
CLI discovery evidence, test counts, diff checks, protected metadata, Git
state, and explicit declarations that no linked command, Hosted Supabase,
database, provider, deployment, stage, commit, push, Ready, or merge action
occurred.

## 9. Stop rule

Stop after producing and testing the uncommitted two-file offline candidate.
Do not stage, commit, push, post to GitHub, run `preflight-only` against a linked
target, run `execute-once`, or contact the fixed hosted project. Every later
boundary requires a separate Owner authorization and independent Codex audit.
