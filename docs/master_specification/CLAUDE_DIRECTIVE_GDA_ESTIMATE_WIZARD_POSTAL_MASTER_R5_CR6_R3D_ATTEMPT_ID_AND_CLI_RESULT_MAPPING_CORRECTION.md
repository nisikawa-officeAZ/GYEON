# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3D Attempt ID and CLI Result Mapping Correction

## 1. Status, authority, and supersession

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3D_ATTEMPT_ID_AND_CLI_RESULT_MAPPING_CORRECTION
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3D_ATTEMPT_ID_AND_CLI_RESULT_MAPPING_CORRECTION_DIRECTIVE_V1
status: GOVERNANCE_ONLY_NOT_AUTHORIZED_FOR_DIAGNOSIS_IMPLEMENTATION_OR_EXECUTION
date: 2026-09-05
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_predecessor_head: c7e0fa7785e2c82cbe2457cc4ab5c0877ac1fd4c
fixed_predecessor_tree: 62237a98b0ade85d13cccfba8b8ca108b68a388f
base: main
pull_request_state_before_authoring: OPEN
pull_request_draft_before_authoring: true
hosted_target_project_ref: nqvnjqcxgngqsqkbpdfi
production_target_contact: PROHIBITED
supersedes: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3C_PROTECTED_METADATA_AND_PREFLIGHT_MATERIALIZATION_CORRECTION_DIRECTIVE_V1
claude_result_and_codex_acceptance: https://github.com/nisikawa-officeAZ/GYEON/pull/67#issuecomment-5554222300
supabase_cli_release: v2.116.0
supabase_cli_release_commit: 997a1e6
```

This directive fully supersedes CR6-R3C. It retains CR6-R3C's exact aggregate
byte contract, two-response Git metadata acquisition, protected monthly digest
provenance, both-mode isolated materialization, public-to-core delegation,
bounded CLI discovery, process quarantine, evidence, two-file allowlist, and
stop boundaries. It closes the two remaining defects: the public `attemptId`
grammar and the production mapping from real Supabase CLI output to the frozen
core's process-result fields.

Authoring this document does not authorize private-file transmission, Claude
invocation, implementation, executable tests, Git or Supabase CLI execution,
network or hosted access, migration replay, Git stage/commit/push, further PR
mutation, Ready conversion, merge, deployment, cutover, or retirement.

## 2. Accepted diagnosis and official source authority

The one-time CR6-R3C tool-disabled diagnosis returned
`CHANGES_REQUIRED_DIRECTIVE`. MacBook Codex independently accepted both
findings:

1. CR6-R3C allowed dot-bearing 64-character `attemptId` values, while frozen
   `quarantine-core.mjs` accepts no dot and permits 128 total characters; and
2. CR6-R3C did not define how real CLI bytes become `promptDetected`,
   `targetMismatch`, or `ledgerMismatch`, so exit code zero could not by itself
   prove the empty replacement ledger or exact application result.

The output contract below is pinned to the official Supabase CLI repository at
release commit `997a1e6` for `v2.116.0`, specifically:

- `apps/cli/src/legacy/commands/migration/list/list.handler.ts`;
- `apps/cli/src/legacy/commands/migration/list/list.format.ts`;
- `apps/cli/src/legacy/commands/migration/list/SIDE_EFFECTS.md`;
- `apps/cli/src/legacy/commands/migration/up/up.handler.ts`;
- `apps/cli/src/legacy/commands/migration/up/SIDE_EFFECTS.md`;
- `apps/cli/src/legacy/shared/legacy-migration-history.ts`;
- `apps/cli/src/legacy/shared/legacy-migration-timestamp.format.ts`;
- `apps/cli/src/shared/cli/global-flags.ts`;
- `apps/cli/src/shared/legacy/global-flags.ts`; and
- `apps/cli/src/shared/output/output.layer.ts`.

These sources establish `--project-ref`, `--workdir`, `--yes`, and
`--output-format json`, the JSON envelopes below, the stderr progress lines,
and non-interactive JSON-mode behavior. No live project or database contact was
used to derive this contract.

## 3. Objective and two explicit modes

Define the smallest safe two-file offline adapter around the accepted fourteen
CR6 files. The future public adapter exposes only:

1. `preflight-only`: locally materialize, inspect, and delete one fresh
   isolated 112-file tree. It never constructs or spawns a linked command,
   contacts hosted state, burns an attempt, or retains hosted evidence.
2. `execute-once`: present but not run during implementation. A later Owner
   approval must quote the accepted adapter commit/tree, fixed project ref,
   unused attempt id, exact commands, and evidence destination.

Ambiguity, unsupported CLI, prompt, malformed or excessive output, mismatch,
timeout, signal, non-zero exit, redaction failure, hash failure, or cleanup
uncertainty fails closed. Once a linked attempt is burned, success or failure
remains burned and the failure verdict is `QUARANTINE_NO_RETRY`.

## 4. Immutable repository and migration inputs

The fourteen existing files under
`scripts/e2e/gda-estimate-postal-master-r5-cr6/` remain unchanged read-only
dependencies. Their accepted SHA-256 of byte-sorted `sha256sum` lines is:

`4e4dac8a8d6c667c586fee010ef7a9909c665333547c74f0ac7b37ccf44f2395`

Fixed migration identity:

- formal top-level SQL count: `113`;
- staged count: `112`;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- staged aggregate SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- protected monthly content SHA-256 attestation:
  `1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255`.

Protected metadata-only identities:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

Never open, read, diff, display, prompt-copy, stage, or modify protected
contents. In either separately approved mode, the fixed monthly Git blob may be
streamed directly into the isolated workdir without displaying, logging,
retaining, transmitting, or re-hashing its SQL text. The protected LINE blob is
never requested, materialized, or applied.

The monthly digest attestation remains pinned to
`docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md` blob
`5f7a39b287a7484b5d2fa8490bf8780bbf5a8f8f`, section 13.2, authority
https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261032333,
HEAD `96c0d5cb34f60396242ea89ae0cf4d0aac92f59e`, tree
`aa544700b66971473f5c7127289bfffd76b8b024`, serialized as
`<sha256><two ASCII spaces><repository-relative path><LF>`.

## 5. Exact aggregate serialization

Build exactly 112 rows in UTF-8 repository-relative path byte order. Every row
is exactly:

```text
<64 lowercase hex content SHA-256><two ASCII spaces><path><LF>
```

There is no header, footer, count, quoting, JSON, BOM, CR, or blank line. Every
row, including the last, ends in one LF. The LINE path contributes no row. The
monthly row uses only the attested digest literal. The 111 ordinary rows hash
the exact Git blob bytes. Apply SHA-256 once to the concatenated rows and
require the Section 4 aggregate. The unrelated R5 runtime-manifest digest
`722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`
must never be substituted.

## 6. Public input, attempt identity, and internal authority

The production entrypoint accepts exactly:

```text
{ mode, attemptId, confirmation, repoRoot, runtimeRoot, evidenceRoot }
```

- `mode` is `preflight-only` or `execute-once` only;
- `confirmation` is absent/null for preflight and exactly
  `EXECUTE_GDA_POSTAL_R5_CR6_ONCE` for execute-once;
- `attemptId` matches the frozen core's exact literal
  `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$` and is unused;
- roots are absolute, traversal-free, symlink-safe, mutually disjoint, at most
  4,096 UTF-8 bytes, and satisfy frozen owner/mode rules; and
- unknown keys fail closed.

The caller cannot provide or override project ref, HEAD/tree, migrations,
manifests, aggregate, protected digest, executable, argv, environment, cwd,
hash function, timeouts, limits, process/filesystem adapters, clock, timer,
ledger, evidence sink, or result parsers.

After verifying one accepted governance parent and an exact two-path
implementation diff, the adapter derives the current implementation HEAD/tree,
pins all authority internally, constructs canonical and actual evidence, and
calls frozen `runPreflight(input, adapters)` exactly once. Existing dependency
injection remains test-only internal behavior, never public caller authority.

## 7. Exact Git acquisition and local materialization

Use `/usr/bin/git` only with argument arrays, `shell: false`, fixed sanitized
environment, validated repo cwd, bounded stdout/stderr, and no stdin except
`cat-file --batch`. Ordinary metadata commands use 30,000 ms, 1,048,576-byte
stdout, and 65,536-byte stderr limits. Batch uses 120,000 ms,
16,777,216 bytes per object, 268,435,456 aggregate bytes, and 65,536-byte
stderr limits.

Allowed argv only:

```text
["rev-parse", "--show-toplevel"]
["rev-parse", "--verify", "HEAD^{commit}"]
["rev-parse", "--verify", "HEAD^{tree}"]
["symbolic-ref", "--quiet", "--short", "HEAD"]
["status", "--porcelain=v1", "--untracked-files=all"]
["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]
["rev-list", "--parents", "-n", "1", "HEAD"]
["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "HEAD^", "HEAD"]
["ls-tree", "-z", FIXED_HEAD + ":supabase/migrations"]
["ls-tree", "-z", "--full-tree", FIXED_HEAD, "--", "src/components/estimates/wizard/screens/ScreensPreview.tsx", "src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts"]
["cat-file", "--batch"]
```

Require exact root, branch, clean status, upstream `0 0`, one fixed accepted
governance parent, and exact two-file implementation diff. Reject detached,
merge, missing parent/upstream, substitution, prompt, timeout, signal, non-zero,
stderr, excess, or malformed output.

Parse `ls-tree` as NUL-delimited bytes. The non-recursive migration-subtree
response has exactly 114 direct children: 113 filename-only `.sql` mode-100644
blobs and one mode-040000 tree `DRAFT_DO_NOT_APPLY` with object
`b6b9b1bd0cefedd0a08a40ef7c2c55c4fa5f4018`. No nested draft file may appear.
The external response has exactly the requested two mode-100644 protected
blobs in order. Validate counts, names, UTF-8, modes, types, object ids, order,
and all four protected identities before reconstructing migration paths.

Use one 111-ordinary-object batch for canonical content hashes and, in each
separately approved mode, one exact 112-object materialization batch including
monthly and excluding LINE. Parse exact batch id/type/decimal-size framing and
reject count/order/size/trailing drift. Stream monthly bytes directly to its
exclusive isolated file; never expose or hash them.

Independently enumerate/lstat exactly 112 regular mode-100644 isolated files.
For ordinary files derive Git blob SHA-1 and content SHA-256 from exact bytes.
For monthly, accept only its validated batch-header blob identity and null
content digest; substitute only the attested digest in the aggregate. Add LINE
as the metadata-only excluded row. Canonical and actual evidence are never
aliases and must compare exactly before plan creation.

## 8. Fixed Supabase executable and discovery

Use only `/opt/homebrew/Cellar/supabase/2.116.0/bin/supabase`, requiring regular,
non-symlink, executable identity and recorded SHA-256. The accepted core token
`supabase` maps internally to that file only. `/opt/homebrew/bin/supabase` may
only be checked as a single symlink resolving there and is never spawned.

Implementation verification may run only local no-network discovery:

```text
["--version"]
["migration", "list", "--help"]
["migration", "up", "--help"]
```

Use `shell:false`, closed stdin, fixed environment, 10,000 ms, 2,097,152-byte
stdout, and 262,144-byte stderr ceilings. Raw discovery bytes remain volatile
and unprinted; retain only argv id, executable identity, exit/signal/timeout,
prompt/truncation flags, byte counts, stream SHA-256 values, and parsed version.
Require version `2.116.0` and support for every fixed linked argv token. Any
unsupported or ambiguous CLI returns `CHANGES_REQUIRED_CLI_COMPATIBILITY`.

## 9. Real linked-process bytes and frozen result mapping

The production process adapter owns raw child bytes and creates the frozen
core's `exitInfo`; callers cannot supply either. Use the fixed executable,
`shell:false`, closed stdin, fixed sanitized environment, exact isolated cwd,
bounded streaming collectors, a shared 1,800,000 ms attempt deadline, and only:

```text
["migration", "list", "--linked", "--project-ref", FIXED_PROJECT_REF,
 "--workdir", FIXED_ISOLATED_WORKDIR, "--output-format", "json"]
["migration", "up", "--linked", "--project-ref", FIXED_PROJECT_REF,
 "--workdir", FIXED_ISOLATED_WORKDIR, "--yes", "--output-format", "json"]
```

### 9.1 Target mapping before spawn

The CLI success JSON contains no project ref. Therefore `targetMismatch` is
never inferred from JSON. Before either spawn, compare executable, argv token
positions, fixed project-ref token, resolved repo/workdir identities, cwd, and
sanitized environment against internal constants. Any difference sets
`targetMismatch:true`, returns quarantine, and does not spawn. Only an exact
match may spawn, and its later normalized exitInfo keeps
`targetMismatch:false`.

### 9.2 Prompt mapping

JSON mode is non-interactive and stdin is closed. The streaming scanner must
carry overlap across chunks and set `promptDetected:true` on an ASCII
case-insensitive match for any of: `enter your database password`,
`do you want to`, `[y/n]`, `[y/n]?`, `[y/n]:`, `[y/n] `, `password:`, or
`cannot prompt`. A JSON error envelope with `_tag:"Error"` and an error
message/detail containing `Cannot prompt` also sets it. The exact-success
parser below independently rejects every error envelope, unknown prompt form,
non-JSON output, timeout, or non-zero exit, so failure to classify a novel
prompt can never permit migration-up.

### 9.3 Exact migration-list success and `ledgerMismatch`

Require child exit code zero, no signal/timeout/truncation/prompt, stdout as
exactly one UTF-8 JSON object followed by one LF, and stderr exactly
`Connecting to remote database...` plus one LF. Reject BOM, CR, leading or
trailing bytes, duplicate JSON keys, unsafe numbers, or any other stderr.

After parsing, require exactly two top-level keys:

```json
{"migrations":[{"local":"<version>","remote":"","time":"<UTC>"}],"message":"Migrations listed"}
```

`migrations` must contain exactly 112 rows in canonical migration-version
order. Each row has exactly `local`, `remote`, and `time`; `local` equals the
numeric version derived from the corresponding canonical staged filename;
`remote` is exactly the empty string; and `time` is the version formatted as
`YYYY-MM-DD HH:MM:SS`, falling back to the literal version only when strict UTC
timestamp parsing fails, matching official `v2.116.0` behavior.

Any malformed envelope/key/type/value, missing/extra/duplicate/reordered local
version, non-empty remote value, unexpected time, or stream mismatch sets
`ledgerMismatch:true`. Frozen `apply-once.mjs` must then quarantine and must not
spawn migration-up. Only the exact 112-local/zero-remote table maps to
`ledgerMismatch:false` and list success.

### 9.4 Exact migration-up success

Migration-up is permitted only after the exact list result. Require exit zero,
no signal/timeout/truncation/prompt, and stdout as exactly one UTF-8 JSON object
plus LF with exactly:

```json
{"applied":["<absolute isolated migration path>"],"message":"Migrations applied"}
```

`applied` contains exactly the 112 canonical absolute isolated migration paths
in canonical migration-version order. Stderr contains exactly
`Connecting to remote database...` plus LF followed by exactly 112 lines
`Applying migration <basename>...` plus LF in the same order. Any envelope,
path, count, order, key, stream, or progress mismatch sets
`ledgerMismatch:true` for the frozen core's fail-closed exit mapping and yields
`QUARANTINE_NO_RETRY`, even when the child returned zero. Retain the actual
child code and stream hashes separately; never forge process evidence.

## 10. Isolation, burn, evidence, and no-retry boundary

- Import has zero filesystem, Git, process, environment, network, Supabase, or
  database effects.
- Use a fresh mode-0700 runtime outside the worktree; reject reuse, symlink,
  traversal, collision, nesting, or stale `supabase/.temp/project-ref`.
- Preflight performs only local materialization, independent inspection, and
  verified deletion; no linked argv may even be constructed.
- Before the first real linked spawn, durably burn the exact fixed
  project-ref/attempt-id pair. It remains burned on every outcome.
- List runs once; up runs at most once; no retry, repair, reset, include-all,
  DB URL, direct SQL, manual continuation, or production branch exists.
- Raw process bytes are volatile only. Retained evidence contains redacted
  status, hashes, counts, exact normalized mappings, and no credential, URL,
  header, environment dump, or raw output.
- Finalize by redact, retain, read back, rescan, verify SHA-256, then delete raw
  data. Any uncertainty quarantines without retry.

## 11. Future implementation allowlist

A later explicit Owner authorization may create exactly:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

No existing harness, source, test, migration, configuration, package,
lockfile, or governance document may change during implementation.

## 12. Mandatory offline hostile tests

All tests use fake Git, filesystem, process, clock, timer, ledger, deletion,
retention, and CLI adapters. Prove at minimum:

1. zero import effects and exact public shape;
2. dot-bearing, over-128, unsafe, or malformed attempt ids reject, while both
   1- and 128-character exact frozen-grammar values reach the frozen core;
3. every Git/CLI argv, executable, cwd, environment, timeout, and byte limit is
   exact and caller-unoverrideable;
4. both `ls-tree` responses, draft-tree exclusion, four protected identities,
   batch framing, 111/112 requests, aggregate serializer, and independent
   actual evidence fail closed on every drift;
5. both modes perform exact local materialization; preflight deletes locally
   without linked command construction, burn, hosted contact, or retention;
6. target mismatch is detected before spawn and cannot be spoofed by JSON;
7. prompt tokens split at every byte boundary, prompt error envelope, closed
   stdin, timeout, signal, non-zero, malformed JSON, duplicate keys, BOM, CR,
   trailing output, unexpected stderr, and excess bytes all quarantine;
8. list accepts only the exact 112 canonical local rows with every remote empty
   and exact time values; any remote row, count/order/key/value drift sets
   `ledgerMismatch` and proves migration-up was never spawned;
9. up accepts only exact 112 absolute applied paths and exact 113 stderr lines;
   any path/order/progress/envelope drift quarantines after at most one spawn;
10. raw streams are never printed or retained, while byte counts/hashes and
    normalized flags are deterministic and evidence finalization is verified;
11. one exact fake execute-once success runs one list and at most one up; and
12. all existing seven CR6 test files pass unchanged.

## 13. Future diagnosis and implementation results

After separate three-document commit and normal-push approvals, one
tool-disabled read-only diagnosis may receive exactly `AGENTS.md`, this
directive, completion plan, phase ledger, and the fourteen harness files: 18
files total. Protected paths remain metadata-only. No tools, edits, tests, Git,
Supabase, DB/provider, network, or mutations.

Required diagnosis marker:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3D_READ_ONLY_DIAGNOSIS_RESULT_V1`

Allowed verdicts:

- `READY_FOR_TWO_FILE_OFFLINE_IMPLEMENTATION`
- `CHANGES_REQUIRED_DIRECTIVE`
- `BLOCKED_INPUT`

Codex independently accepts the result before implementation. A later
implementation result uses marker
`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER_IMPLEMENTATION_RESULT_V1`
and may return only `READY_FOR_CODEX_OFFLINE_ACCEPTANCE`,
`CHANGES_REQUIRED_SOURCE`, `CHANGES_REQUIRED_CLI_COMPATIBILITY`, or
`BLOCKED_ENVIRONMENT`.

Offline implementation verification includes node syntax for all sixteen
files, one test run covering the new test plus existing seven tests, exact
two-path/mode checks, unchanged fourteen-file hash, protected metadata-only
checks, clean index/upstream, and `git diff --check`. It contacts no hosted
system.

## 14. Stop rule

Stop after authoring and independently checking this exact three-document
candidate. Do not stage, commit, push, invoke Claude, retransmit private files,
implement/test adapters, execute Git or Supabase CLI for implementation,
contact a hosted project/database/provider, replay migrations, upload evidence,
mark Ready, merge, deploy, cut over, or retire anything. Every later boundary
requires separate Owner authorization.
