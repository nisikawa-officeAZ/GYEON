# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3J-R2 List-Only Redacted Capture

## 1. Status and authority

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_REDACTED_CAPTURE
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_REDACTED_CAPTURE_DIRECTIVE_V1
status: GOVERNANCE_INSTRUCTION_CANDIDATE_ONLY_NOT_AUTHORIZED_FOR_IMPLEMENTATION_OR_CAPTURE
date: 2026-09-06
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_head: 637930601d698e4622a0c9331b3ec086717ed7af
fixed_tree: 10b0c6a84fe5244aae40614fd4509e10bc6366e4
fixed_parent: dfd59f95466408783730d46fdd58a5f8a107ca62
base: main
upstream_ahead_behind_before_authoring: "0 0"
fixed_target_project_ref: nqvnjqcxgngqsqkbpdfi
fixed_target_name: DealerOS-Dev-Clean-R5
fixed_target_region: ap-northeast-1
fixed_cli_version: 2.116.0
fixed_cli_sha256: 42a9fe8b8a266bc0fbde804c08efb75cc0653480e91ba3f20fba1c3c27a7b49a
production_target_contact: PROHIBITED
prior_burned_attempt_id: r3j-20260906-01
future_capture_id: r3j-r2-capture-20260906-01
```

The Owner authorized authoring this one instruction file only. This document
does not authorize Claude invocation, private-file transmission, a temporary
worktree, source or test changes, tests, a Supabase command, hosted access,
database access, migration application, local evidence writes, stage, commit,
push, PR mutation, Ready conversion, merge, deployment, cutover, project
recreation, deletion, or cleanup.

Every later gate requires a separate explicit Owner authorization. The prior
`execute-once` authorization is consumed. Attempt `r3j-20260906-01` remains
permanently burned and must never be reused, renamed, repaired, removed, or
aged out.

## 2. Active boundary and responsibility

- Product Owner: Office AZ / User.
- Technical authority and independent acceptance: MacBook Codex.
- Future bounded implementation and offline tests: MacBook Claude, only after
  a separate authorization.
- Future one-time hosted read-only capture: MacBook Codex, only after Claude's
  candidate passes independent review and the Owner separately authorizes the
  exact capture.
- Studio, Book inventory, Android, production, provider, deployment, and
  unrelated DealerOS work are outside this phase.

The current authoring allowlist is exactly this path:

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_REDACTED_CAPTURE.md`

No other file may be created, edited, staged, committed, pushed, or deleted by
this authoring phase.

## 3. Governing conflict disclosure

Root `AGENTS.md`, `GYEON_DA_COMPLETION_PLAN.md`, and
`GYEON_DA_PHASE_RESULTS.md` currently record CR6 only through R3F. They do not
record the later R3G through R3J implementation, delivery, preflight, or failed
hosted attempt. Report this exact condition as:

```text
GOVERNANCE_LEDGER_NOT_SYNCHRONIZED
```

Do not silently reconcile or modify those files in this phase. Explicit current
Owner authorization for this single instruction file takes precedence, but it
does not make the stale plan or ledger current.

To avoid the prior R3J-R1 Section 5/6 contradiction, a later Claude invocation
must receive every required first-read file inside one literal authorized read
allowlist. No first-read requirement may be satisfied by inference or by a
summary in another document.

## 4. Accepted prior diagnosis

The accepted tool-disabled, one-time diagnosis returned:

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS_RESULT_V1
BLOCKED_NEEDS_SEPARATE_READ_ONLY_CAPTURE
```

The following boundary is established:

1. Exactly one real `migration list` process launched.
2. `migration up` was never constructed or launched after the list rejection.
3. No migration was applied by attempt `r3j-20260906-01`.
4. List stdout matched the independently reconstructed canonical 112-row JSON:
   `5611` bytes and SHA-256
   `acdda8ba92034bf319ecb99cda225c9a10778c7d784ff370b4889871660e1d75`.
5. Expected stderr was `33` bytes with SHA-256
   `4a936fcd93f5974680b404e77d9a346a2fb99f7cef2ec72a11e6e01120c4eadd`.
6. Observed stderr was `60` bytes with SHA-256
   `b9977cb727ae28f6dfc5ee83a4ca928c7a9f42b11c4757f73dd5a17e85681a5f`.
7. The extra `27` bytes are unknowable from retained evidence because raw
   stderr was securely deleted after finalization.
8. Strict stderr equality therefore produced a safe but false
   `ledgerMismatch:true` classification despite exact stdout.

Retained evidence:

| Field | Exact value |
| --- | --- |
| Path | `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/runtime/gda-estimate-postal-master-r5-cr6/r3j-evidence/retained/execution-ff8a2084ee5d65f33f17003541b9623c.json` |
| Mode | `0600` |
| SHA-256 | `36e4308296aabd619476054428deb68da28591455929b6f57ef42d2ce42f9849` |

Do not guess the additional stderr text. Do not weaken stderr acceptance before
the exact public-safe line representation is captured.

## 5. Required first reads and exact future Claude read allowlist

A future separately authorized Claude implementation must receive and read
exactly these eleven repository files plus the one retained evidence file:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS.md`
5. this directive
6. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
7. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`
8. `scripts/e2e/gda-estimate-postal-master-r5-cr6/replay-command-core.mjs`
9. `scripts/e2e/gda-estimate-postal-master-r5-cr6/replay-command-core.test.mjs`
10. `scripts/e2e/gda-estimate-postal-master-r5-cr6/apply-once.mjs`
11. `scripts/e2e/gda-estimate-postal-master-r5-cr6/apply-once.test.mjs`
12. `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/runtime/gda-estimate-postal-master-r5-cr6/r3j-evidence/retained/execution-ff8a2084ee5d65f33f17003541b9623c.json`

No other repository, environment, CLI credential store, raw log, database,
provider record, migration body outside the fixed source set, or local file is
in Claude's read scope.

Current bounded source identities:

| Path | SHA-256 |
| --- | --- |
| `hosted-execution-adapter.mjs` | `40bf1c93b832c889c83cbf68ea7db917e7eca4bfa884f41f1bea932c607622f0` |
| `hosted-execution-adapter.test.mjs` | `6c24070d25fd56cf4301b59eb9d6a15d14c833b6b90958ef7575213aac3e9429` |
| `replay-command-core.mjs` | `0b6adcfd28b22344333e399fa77df6520a8ab163a08360920dfca909ed866903` |
| `replay-command-core.test.mjs` | `b80efc89099bbde287d9f622c1e7945c5f1a017322e85b9b150b30cb09e6afe3` |
| `apply-once.mjs` | `6d0b57efe6184e638a845b6c8586657b8f8a0567cdd4c3e7c0861b2faf9da309` |
| `apply-once.test.mjs` | `76294b9890daead78bfb2ef3ec358523ead5a5f1ea71f2a8baaac3a5ee4f83dc` |

## 6. Future detached-worktree implementation gate

The future diagnostic implementation must use a fresh detached worktree at
fixed HEAD `637930601d698e4622a0c9331b3ec086717ed7af`. It must not modify the
current PR #67 worktree or branch. The exact temporary implementation allowlist
inside that detached worktree is:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

The temporary candidate must add one structurally list-only diagnostic mode.
It must not be committed, pushed, copied into the PR worktree, or treated as
the final two-file stderr repair.

Required structural behavior:

1. Reuse the accepted preflight, Git identity, protected metadata,
   materialization, fixed manifest, fixed executable, target, workdir,
   sanitized environment, byte ceilings, timeout, prompt detection, and secure
   isolated-workdir cleanup contracts.
2. The diagnostic call graph must never invoke `applyOnce`,
   `buildMigrationUpArgv`, the durable burn ledger, or the active execution
   lock.
3. It may build only the exact argv returned by
   `buildMigrationListArgv(nqvnjqcxgngqsqkbpdfi, isolatedWorkdir)`.
4. The executable remains exactly
   `/opt/homebrew/Cellar/supabase/2.116.0/bin/supabase`; shell execution is
   prohibited and stdin must be closed.
5. Exactly one logical diagnostic call may produce at most one real OS launch.
   A failure, timeout, prompt, truncation, signal, non-zero exit, target drift,
   or sanitization failure stops with no retry.
6. No attempt ID accepted by the execute-once mode is created or reused. The
   capture identity is the fixed local-only
   `r3j-r2-capture-20260906-01`.
7. Before the real launch, atomically create one local-only consumed receipt
   under the separately approved capture evidence root with directory mode
   `0700` and file mode `0600`. An existing, partial, malformed, symlinked, or
   uncertain receipt means `CAPTURE_ALREADY_CONSUMED_NO_RETRY`.
8. The consumed receipt is not an execution burn-ledger record and must never
   be written under the accepted burn-ledger root.

## 7. Redaction-before-retention contract

Raw stdout and stderr may exist only in bounded process memory. They must never
be written to disk, terminal output, debug logs, exception messages, test
snapshots, Git, or a provider request.

Before producing any persistent or user-visible evidence, the diagnostic must:

1. Reject invalid UTF-8.
2. Split stderr into line records while preserving each line's exact byte
   length and terminator identity (`LF`, `CRLF`, or none).
3. Render control bytes and ANSI escapes as escaped hexadecimal tokens rather
   than allowing terminal interpretation.
4. Scan each line for URL/DSN syntax, `Bearer` values, JWT-like values,
   key/token/secret/password assignments, email addresses, IP/host-port values,
   UUIDs, and high-entropy base64/base64url/hex runs of 24 or more characters.
5. Replace every matched value with a fixed typed placeholder before retention.
6. Reject any residual line that still contains a forbidden credential,
   connection, URL, environment-value, or high-entropy pattern.
7. Retain exact escaped line text and escaped-byte hex only when no redaction
   occurred for that line. If any redaction occurred, retain only the sanitized
   text, original line byte count, original line SHA-256, terminator identity,
   and redaction categories; do not retain original byte hex.
8. Zero the raw stdout/stderr buffers in a `finally` path after the sanitized
   evidence object has been constructed.

The output must distinguish:

- `CAPTURED_EXACT_PUBLIC_SAFE_STDERR`
- `CAPTURED_WITH_REDACTIONS_NOT_EXACT`
- `CAPTURE_REJECTED_SECRET_SCAN`
- `CAPTURE_FAILED_NO_RETRY`
- `CAPTURE_ALREADY_CONSUMED_NO_RETRY`

Only `CAPTURED_EXACT_PUBLIC_SAFE_STDERR` can authorize a later exact stderr
grammar repair.

## 8. Evidence contract

The future capture may retain exactly one JSON evidence file, created
atomically with mode `0600`, containing only:

- marker and fixed capture identity;
- fixed HEAD/tree/parent;
- fixed target public ref, CLI version, executable SHA-256, and exact argv hash;
- logical call and real OS launch counts;
- exit code, signal, timeout, prompt, truncation, and spawn-failure flags;
- stdout byte count and SHA-256 only, never stdout text;
- sanitized stderr line records from Section 7;
- full raw stderr byte count and SHA-256 only;
- redaction categories and final capture classification;
- proof that `up`, burn-ledger, and active-lock code paths were unreachable;
- secure-cleanup status for isolated materialization;
- Git status, HEAD/tree, and upstream comparison after capture;
- zero migration-application, zero DB-write, and zero provider/deployment
  declarations.

The evidence writer must refuse unknown keys. It must not include environment
objects, access-token presence/value, HOME contents, CLI credential-store
contents, connection strings, headers, stack traces containing local secrets,
or raw process output.

## 9. Exact future offline verification gate

Before any hosted capture authorization, Claude must run only the exact focused
test file for the two-path temporary candidate and a two-path diff check. Tests
must prove at least:

1. diagnostic mode has one list launch and zero up launches;
2. `applyOnce`, burn ledger, and active lock remain unreachable;
3. second invocation with the same capture ID stops before spawn;
4. prompt, timeout, truncation, signal, non-zero exit, invalid UTF-8, spawn
   failure, and target drift all stop with no retry;
5. raw buffers are never passed to filesystem, console, error, or evidence
   adapters;
6. benign exact lines remain byte-exact after safe escaping;
7. URL, token, JWT, secret assignment, email, host-port, UUID, high-entropy,
   ANSI, CRLF, missing-final-LF, and mixed-control hostile fixtures are safely
   classified;
8. any redacted line cannot produce
   `CAPTURED_EXACT_PUBLIC_SAFE_STDERR`;
9. unknown evidence keys fail closed;
10. existing preflight-only and execute-once tests remain unchanged and pass;
11. the remaining four hashed source paths outside the two temporary paths
    remain unchanged;
12. no Git, Supabase, network, DB, provider, or deployment command is launched
    by offline tests.

Test count alone is never acceptance. Claude must return exact command, exit
code, test count, changed paths, per-path hashes, and protected metadata.

## 10. Protected metadata-only paths

These paths remain metadata-only and may be checked only with `git ls-tree`:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

Their contents must not be opened, read, diffed, displayed, copied,
transmitted, staged, or modified.

## 11. Explicitly prohibited actions

- Any capture or Claude invocation under this authoring authorization.
- Any `migration up`, `db push`, `migration repair`, `db reset`, SQL, database
  client, or mutating provider command.
- Any contact with production ref `dmvyaykhibmphrmekjbb` or Development ref
  `vhiuiwolnlvlwvoaingd`.
- Any second process launch, automatic retry, or reuse of a consumed capture ID.
- Any modification of the 113-entry formal manifest, 112-entry staged set,
  protected LINE exclusion, or aggregate SHA-256.
- Any arbitrary, prefix-only, substring-only, regex-wide, warning-ignoring, or
  zero-exit-only stderr acceptance rule.
- Any raw stderr retention or output before the redaction contract passes.
- Any source commit from the detached diagnostic worktree.
- Any stage, commit, push, PR comment, Ready, merge, deployment, project
  recreation, deletion, or cleanup without a separate exact authorization.

## 12. Future result contracts

### 12.1 Temporary implementation result

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_CAPTURE_IMPLEMENTATION_RESULT_V1
```

Allowed verdicts:

- `READY_FOR_CODEX_OFFLINE_REVIEW`
- `CHANGES_REQUIRED`
- `BLOCKED_INPUT`

### 12.2 Hosted capture result

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_REDACTED_CAPTURE_RESULT_V1
```

Allowed verdicts:

- `CAPTURED_EXACT_PUBLIC_SAFE_STDERR`
- `CAPTURED_WITH_REDACTIONS_NOT_EXACT`
- `CAPTURE_REJECTED_SECRET_SCAN`
- `CAPTURE_FAILED_NO_RETRY`
- `CAPTURE_ALREADY_CONSUMED_NO_RETRY`

No result authorizes the final adapter repair, commit, push, migration apply,
Ready, merge, deployment, or production action.

## 13. Stop rule and next gates

Stop after authoring and locally verifying this one instruction file. The
strict next sequence is:

1. separate Owner approval for the exact twelve-file Claude read/transmission
   scope, fresh detached worktree, two-file temporary implementation, and
   offline tests;
2. independent MacBook Codex review;
3. separate Owner approval for exactly one hosted read-only capture;
4. independent evidence review and stderr-line classification;
5. separate Owner approval for an exact two-file final repair on PR #67;
6. separate verification, commit, push, and any later migration gates.

Do not collapse or infer approval across these gates.
