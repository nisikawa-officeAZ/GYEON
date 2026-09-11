# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3B Git Acquisition and Delegation Correction

## 1. Status, authority, and supersession

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3B_GIT_ACQUISITION_AND_DELEGATION_CORRECTION
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3B_GIT_ACQUISITION_AND_DELEGATION_CORRECTION_DIRECTIVE_V1
status: GOVERNANCE_ONLY_NOT_AUTHORIZED_FOR_DIAGNOSIS_IMPLEMENTATION_OR_EXECUTION
date: 2026-09-05
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_predecessor_head: d1e634ceb22c194ba2703aa6043e0306dff50ccd
fixed_predecessor_tree: 14962186fa1aac848d19b66f4a5920489fa2b69d
base: main
pull_request_state_before_authoring: OPEN
pull_request_draft_before_authoring: true
hosted_target_project_ref: nqvnjqcxgngqsqkbpdfi
production_target_contact: PROHIBITED
supersedes: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3A_CANONICAL_MANIFEST_SERIALIZATION_CORRECTION_DIRECTIVE_V1
rediagnosis_instruction: https://github.com/nisikawa-officeAZ/GYEON/pull/67#issuecomment-5534178181
codex_acceptance: https://github.com/nisikawa-officeAZ/GYEON/pull/67#issuecomment-5553913054
```

This directive fully supersedes CR6-R3A. It retains the exact aggregate byte
contract and the two-file future implementation allowlist, while closing four
remaining directive defects: exact Git object acquisition, the public-to-core
delegation boundary, protected monthly-invoice digest provenance, and bounded
CLI-discovery evidence retention.

Authoring this document does not authorize private-file transmission, Claude
invocation, source changes, executable tests, Git or Supabase CLI execution,
network, Hosted Supabase or database/provider access, migration replay,
evidence upload, Git stage/commit/push, PR mutation, Ready conversion, merge,
deployment, cutover, or retirement.

## 2. Accepted diagnosis and reason for correction

The one-time CR6-R3A tool-disabled diagnosis returned
`CHANGES_REQUIRED_DIRECTIVE`. MacBook Codex independently accepted that result.
No adapter implementation may begin until all four findings are corrected:

1. the Git commands, byte framing, object validation, and failure limits used
   to acquire canonical authority were not exact;
2. the directive prohibited caller-supplied authority but did not explain how
   the new adapter may internally satisfy the existing frozen
   `runPreflight(input, adapters)` dependency-injection boundary;
3. the protected monthly-invoice SHA-256 literal lacked its precise attestation
   provenance inside the authorized diagnosis payload; and
4. CLI help output was described as volatile and hashed, but retention,
   truncation, prompt, encoding, and compatibility rules were incomplete.

## 3. Objective and future modes

Define the smallest safe two-file offline execution adapter around the accepted
fourteen-file CR6 harness. The future adapter may expose only:

1. `preflight-only`: local read-only checks only. It must never start migration
   application or contact any hosted target; and
2. `execute-once`: present in source but not run during implementation. A later
   Owner approval must quote the accepted adapter commit/tree, fixed project
   ref, unused attempt id, exact commands, and evidence destination.

Any ambiguity, prompt, mismatch, timeout, signal, non-zero exit, malformed or
excessive output, unsupported CLI, redaction failure, hash failure, or cleanup
uncertainty returns a fail-closed verdict. After an execution attempt is burned,
the terminal verdict is `QUARANTINE_NO_RETRY`.

## 4. Immutable accepted inputs

The existing fourteen files under
`scripts/e2e/gda-estimate-postal-master-r5-cr6/` remain unchanged read-only
dependencies. The SHA-256 of their byte-sorted `sha256sum` output lines is:

`4e4dac8a8d6c667c586fee010ef7a9909c665333547c74f0ac7b37ccf44f2395`

Fixed migration identity:

- formal top-level migration count: `113`;
- staged migration count: `112`;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- accepted staged aggregate SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- protected monthly-invoice content SHA-256 literal:
  `1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255`.

Protected metadata-only paths remain:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

Agents must not open, read, diff, display, copy to a prompt, stage, or modify
protected contents. A later separately approved execution may stream the fixed
monthly-invoice Git blob directly into an isolated workdir without displaying,
logging, retaining, or transmitting its SQL text. The protected LINE blob is
never requested, materialized, or applied.

## 5. Protected monthly-invoice digest provenance

The literal monthly-invoice digest in Section 4 is not a newly inferred value.
Its attestation source is exactly:

- document:
  `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md`;
- source document blob at the fixed predecessor HEAD:
  `5f7a39b287a7484b5d2fa8490bf8780bbf5a8f8f`;
- source section: `13.2 Canonical 98-path executable manifest`;
- pinned authority:
  `https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261032333`;
- pinned authority HEAD:
  `96c0d5cb34f60396242ea89ae0cf4d0aac92f59e`;
- pinned authority tree:
  `aa544700b66971473f5c7127289bfffd76b8b024`;
- attested serialization:
  `<sha256><two ASCII spaces><repository-relative path><LF>`; and
- attested row:
  `1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255  supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`.

The future adapter pins that digest as an immutable literal. It must additionally
verify the protected monthly path, mode, and Git blob identity from metadata.
Neither diagnosis nor implementation may read or re-hash the protected SQL.
The remediation-plan document need not be added to the future eighteen-file
Claude payload because this section carries the complete attestation needed to
review the dependency.

## 6. Exact aggregate serialization contract

Compute the aggregate from exactly 112 rows in repository-relative path byte
order. Each row is exactly:

```text
<64 lowercase hexadecimal content SHA-256><two ASCII spaces 0x20><repository-relative path encoded as UTF-8><LF 0x0A>
```

Rules:

1. no header, footer, count, quotes, escaping, JSON, BOM, CR, or blank line;
2. exactly two ASCII spaces between digest and path;
3. exactly one LF after every row, including the final row;
4. paths begin with `supabase/migrations/` and are sorted using
   `Buffer.compare(Buffer.from(pathA), Buffer.from(pathB))` equivalent order;
5. the protected LINE path contributes no row;
6. the protected monthly row uses only the attested Section 5 digest literal;
7. all other rows use SHA-256 of the exact fixed-Git blob bytes; and
8. apply SHA-256 once to the complete concatenated row bytes and require the
   fixed aggregate from Section 4.

Alternate serialization is invalid. The R5 runtime manifest digest
`722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`
uses another serialization and must not be substituted.

## 7. Public input and internal delegation contract

The production adapter public entrypoint accepts exactly this object shape and
no extra keys:

```text
{ mode, attemptId, confirmation, repoRoot, runtimeRoot, evidenceRoot }
```

- `mode` is exactly `preflight-only` or `execute-once`;
- `confirmation` is absent/null for `preflight-only` and must equal the exact
  literal `EXECUTE_GDA_POSTAL_R5_CR6_ONCE` for `execute-once`;
- `attemptId` matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` and is unused;
- all three roots are absolute, traversal-free, symlink-safe, mutually
  disjoint, at most 4,096 UTF-8 bytes, and satisfy their frozen ownership/mode
  contracts; and
- unknown keys fail closed.

The caller must not supply or override a project ref, expected HEAD/tree,
migration list, canonical manifest, actual manifest, aggregate literal,
monthly digest, hash function, Git/Supabase executable, argv, environment,
workdir derivation, timeout, output limit, process adapter, filesystem adapter,
clock, timer, burn ledger, or evidence sink.

This restriction applies at the new production/public boundary. It does not
forbid the accepted existing pure core from retaining its internal injected
test adapters or constant-return test fixtures.

The production adapter itself must compute and pin the following before calling
the existing frozen core exactly once:

1. fixed branch, project ref, counts, exclusion, protected metadata, monthly
   attestation, expected aggregate, and the separately accepted CR6-R3B
   governance parent HEAD/tree named by the later implementation authorization;
2. the current implementation commit/tree, derived through Git only after
   proving it has that fixed governance parent and changes exactly the two
   Section 11 implementation paths; those validated current identities become
   `expectedHead` and `expectedTree` for the frozen core without accepting or
   self-asserting them from the caller;
3. `canonicalManifest` derived through the Git acquisition contract in Section
   8, plus `rawMigrationEntries` built from independently inspected actual
   workdir entries and only the protected LINE metadata-only exclusion row;
4. a fresh isolated workdir derived under `runtimeRoot` and independently
   inspected actual migration entries;
5. a concrete `hashAggregate` closure implemented with `node:crypto`, accepting
   only the internally derived staged table and applying Section 6; and
6. internally owned process, filesystem, clock, timer, burn-ledger, redaction,
   retention, and evidence adapters.

It may then internally call the frozen `runPreflight(input, adapters)` by
passing those internally derived values into the dependency-injection fields
that `preflight.mjs` and `manifest-core.mjs` already require. This is an internal
delegation detail, not caller authority. No caller value may flow into those
authority fields except the validated location/operation fields explicitly
allowed above. The existing pull-request adapter receives only the internally
pinned PR #67 OPEN/Draft/base-main record from the later accepted authorization;
it performs no network lookup and cannot be caller-overridden.

## 8. Exact Git acquisition and byte-parsing contract

### 8.1 Executable, spawning, and fixed argv

Use the literal executable `/usr/bin/git` only, with `spawn` or `execFile`,
argument arrays, `shell: false`, a fixed sanitized environment, no stdin except
the exact `cat-file --batch` request, and the limits below. Ordinary Git
metadata commands have a `30,000` ms timeout, `1,048,576`-byte stdout ceiling,
and `65,536`-byte stderr ceiling. `cat-file --batch` has a `120,000` ms timeout,
`16,777,216`-byte per-object ceiling, `268,435,456`-byte aggregate object-data
ceiling, and `65,536`-byte stderr ceiling. Do not resolve Git from `PATH`, invoke
a shell, interpolate command text, or accept executable/argv/environment from
the caller.

Run only these exact argv arrays:

```text
["rev-parse", "--show-toplevel"]
["rev-parse", "--verify", "HEAD^{commit}"]
["rev-parse", "--verify", "HEAD^{tree}"]
["symbolic-ref", "--quiet", "--short", "HEAD"]
["status", "--porcelain=v1", "--untracked-files=all"]
["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]
["rev-list", "--parents", "-n", "1", "HEAD"]
["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "HEAD^", "HEAD"]
["ls-tree", "-rz", "--full-tree", FIXED_HEAD, "--", "supabase/migrations"]
["cat-file", "--batch"]
```

Every command runs with `cwd` equal to the validated `repoRoot`. Require exact
repository root, fixed branch, empty status output, ahead/behind `0 0`, exactly
one fixed accepted governance parent, and an exact two-path implementation diff.
After those checks, pin the current derived HEAD/tree internally for the core.
Reject detached HEAD, merge commit, missing/wrong parent, missing upstream,
substitution, prompt, signal, timeout, non-zero exit, excessive output,
unexpected stderr, or malformed data.

### 8.2 `ls-tree` parsing

Parse stdout as bytes, not newline-delimited text. Each NUL-delimited record is:

```text
<mode> SP <type> SP <40-lowercase-hex object id> TAB <repository-relative path> NUL
```

Require exactly 113 unique top-level `.sql` paths under
`supabase/migrations/`, mode `100644`, type `blob`, no nested paths, no control
bytes, no invalid UTF-8, canonical byte order, no duplicate, missing, or extra
record, and exact protected mode/blob identities. Reject all other output.

### 8.3 `cat-file --batch` request and response

Use two distinct bounded `cat-file --batch` transactions with the same exact
argv. The canonical-hash transaction requests exactly the 111 ordinary staged
blob object ids, one lowercase 40-hex id followed by LF, in canonical path
order. It must not request either protected blob. In a later separately approved
`execute-once` materialization transaction, request exactly the 112 staged blob
ids in canonical path order, including the protected monthly-invoice blob and
excluding the protected LINE blob. The monthly bytes flow directly from parsed
batch framing to its isolated file and are never exposed as text, displayed,
logged, hashed, retained, or transmitted.

Parse each response as bytes:

```text
<requested object id> SP blob SP <decimal byte size> LF
<exact byte-size object bytes> LF
```

Require matching id, type `blob`, bounded non-negative decimal size, the exact
transaction-specific number and order of responses, a single framing LF after
each object, no trailing bytes, and all Section 8.1 ceilings. The canonical-hash
transaction computes each ordinary content SHA-256 in memory, then discards its
raw bytes. The materialization transaction writes ordinary and monthly bytes
directly to fresh isolated files with exclusive creation and required modes.
Never display, log, retain outside the isolated materialization, or transmit
object contents. A missing/malformed/type/count/order/size/framing mismatch
fails closed before plan creation or linked process use.

### 8.4 Independent actual authority

Canonical Git evidence must not be reused as actual evidence. Independently
enumerate and `lstat` the fresh isolated workdir, requiring exactly 112 regular
mode-`100644` top-level migration files with no symlinks, hard-link ambiguity,
special files, nesting, duplicate, missing, or extra path. For each ordinary
file, derive:

- Git blob SHA-1 from `SHA1("blob " + byteLength + NUL + exactBytes)` and require
  the fixed canonical blob identity; and
- content SHA-256 from the same exact bytes.

For the protected monthly file, use only the fixed object id and validated batch
header from the materialization transaction as its actual blob identity; do not
open or hash the resulting file. Keep `sha256: null` in both canonical and
actual tables, and substitute only the Section 5 attested digest inside the
internal aggregate serializer. Add the protected LINE metadata-only row from
the fixed canonical entry to `rawMigrationEntries` without materializing it.
Never materialize the protected LINE file.

## 9. Exact Supabase CLI discovery and evidence boundary

Use the literal resolved executable
`/opt/homebrew/Cellar/supabase/2.116.0/bin/supabase` only. Require it to be a
regular non-symlink executable and record its SHA-256. The existing core's
literal executable token `supabase` must be recognized and internally mapped to
this fixed absolute executable only after its argv passes the frozen core
validation. `/opt/homebrew/bin/supabase` may be checked only to prove that its
single symlink target resolves to that same fixed file; it is never spawned.
If any identity check fails, return `BLOCKED_ENVIRONMENT`; do not search `PATH`
or accept a replacement. During implementation verification, run only these
local no-network argv arrays:

```text
["--version"]
["migration", "list", "--help"]
["migration", "up", "--help"]
```

Each command uses `shell: false`, no stdin, a fixed sanitized environment,
`10,000` ms timeout, `2,097,152`-byte stdout ceiling, and `262,144`-byte stderr
ceiling. Raw stdout/stderr exist only
in volatile memory and must never be printed, logged, written to disk, retained,
uploaded, or included in Claude/GitHub output.

The redacted result records, for every discovery command:

- exact argv identifier and executable identity;
- exit code, signal, timeout flag, prompt-detected flag, and truncation flag;
- byte count and SHA-256 of exact raw stdout;
- byte count and SHA-256 of exact raw stderr; and
- parsed exact CLI version for the version command.

Reject non-zero exit, signal, timeout, prompt-like output, excessive output,
truncation, invalid UTF-8 where text parsing is required, unexpected stderr,
missing version, or unsupported required tokens. Compatibility is judged
against the frozen replay argv from `replay-command-core.mjs`:

```text
["migration", "list", "--linked", "--project-ref", FIXED_PROJECT_REF,
 "--workdir", FIXED_ISOLATED_WORKDIR, "--output-format", "json"]
["migration", "up", "--linked", "--project-ref", FIXED_PROJECT_REF,
 "--workdir", FIXED_ISOLATED_WORKDIR, "--yes", "--output-format", "json"]
```

The help text must prove support for every required flag. No unstated baseline
help hash is an authority. Discovery hashes are retained only as evidence of
what was inspected. Unsupported or ambiguous syntax returns
`CHANGES_REQUIRED_CLI_COMPATIBILITY`; do not guess, rewrite commands, run a
linked command, or contact a hosted target.

## 10. Remaining process, isolation, burn, and evidence contract

- Import has zero filesystem, Git, process, environment, network, Supabase, or
  database side effects.
- Use one fresh mode-`0700` runtime directory outside the worktree; reject
  symlink, traversal, reuse, collision, and stale `supabase/.temp/project-ref`.
- `preflight-only` cannot construct or spawn migration-up.
- Before any real linked process, persist the fixed project-ref/attempt-id pair
  as burned. Success and failure remain burned permanently.
- A read-only migration-list process must prove an empty remote ledger before
  the one permitted migration-up process can start.
- Migration-up is spawned at most once. No retry, repair, reset, include-all,
  direct DB URL, manual continuation, or production-ref branch exists.
- The shared `1,800,000` ms attempt ceiling covers all linked processes.
- Retained evidence and burn ledger require a later Owner-approved external
  mode-`0700` directory and mode-`0600` files.
- Finalize evidence by redact, retain, read back, scan, verify SHA-256, and only
  then delete raw data. Credentials, URLs, headers, environment dumps, and
  unredacted CLI output must never be retained.

## 11. Future implementation allowlist

A later explicit Owner authorization may create exactly:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

No existing source, test, migration, configuration, lockfile, package file, or
governance document may change in that implementation invocation.

## 12. Mandatory offline hostile tests

All tests use fake Git, filesystem, process, clock, timer, environment,
volatile-storage, retention-storage, deletion, event, and CLI adapters. Prove:

1. import has zero side effects and exact public input rejects unknown or
   caller-supplied authority fields;
2. every fixed Git argv is exact, uses `/usr/bin/git`, `shell: false`, correct
   cwd/environment, exact numeric output limits/timeout, one accepted parent,
   and the exact two-path implementation diff;
3. malformed NUL framing, mode/type/object/path/count/order/UTF-8 drift and
   duplicate/missing/extra `ls-tree` records fail closed;
4. malformed `cat-file --batch` id/type/size/framing/count/order, oversized
   content, trailing bytes, a protected request in the 111-object transaction,
   and any non-exact 112-object materialization request fail closed;
5. canonical Git and actual isolated evidence are independently derived, and
   swapping or changing only one side fails;
6. actual path/mode/blob/content drift, symlink, special file, nested path,
   hard-link ambiguity, missing/extra file, and protected substitution fail;
7. the concrete serializer reproduces the fixed digest only for exact rows;
   single space, CRLF, missing final LF, JSON, reorder, constant return, or
   caller hasher cannot pass;
8. the adapter internally pins all authority and calls the frozen core once;
   existing core-only test injection remains available only to tests;
9. CLI discovery raw streams are never retained or printed, while hashes,
   counts, status, signal, prompt, truncation, and version are recorded;
10. unsupported flags, invalid UTF-8, excessive output, prompt, timeout, signal,
    non-zero exit, unexpected stderr, or alternate executable fails closed;
11. `preflight-only` never spawns a linked command; unsafe roots, wrong fixed
    identity, dirty/diverged Git, burned attempt, ledger mismatch, and evidence
    finalization uncertainty fail without retry;
12. one exact fake `execute-once` fixture performs at most one migration-up and
    yields deterministic redacted evidence; and
13. all existing seven CR6 test files pass unchanged.

## 13. Future read-only re-diagnosis contract

After this three-document candidate is independently verified, locally
committed, and normally pushed under separate approvals, one superseding
tool-disabled read-only Claude diagnosis may be proposed. Exact read scope:

1. `AGENTS.md`;
2. this CR6-R3B directive;
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`;
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`; and
5. the existing fourteen CR6 harness files.

Protected paths remain metadata-only. The diagnosis may not edit, test, use
network, execute Git/Supabase/DB/provider commands, or mutate any system.

Required marker:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3B_READ_ONLY_DIAGNOSIS_RESULT_V1`

Allowed verdicts:

- `READY_FOR_TWO_FILE_OFFLINE_IMPLEMENTATION`
- `CHANGES_REQUIRED_DIRECTIVE`
- `BLOCKED_INPUT`

Codex must independently accept the diagnosis before implementation starts.

## 14. Future implementation result and offline verification

Implementation result marker:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER_IMPLEMENTATION_RESULT_V1`

Allowed verdicts:

- `READY_FOR_CODEX_OFFLINE_ACCEPTANCE`
- `CHANGES_REQUIRED_SOURCE`
- `CHANGES_REQUIRED_CLI_COMPATIBILITY`
- `BLOCKED_ENVIRONMENT`

Verification must include `node --check` for all sixteen harness/adapter files,
one `node --test` invocation covering the new test and existing seven tests,
`git diff --check`, exact two-path/mode checks, unchanged fourteen-file combined
hash, protected metadata-only checks, clean index, and unchanged upstream state.
No verification command may contact Supabase, a database, GitHub, Vercel, or
another external service.

## 15. Stop rule

Stop after authoring and independently checking this exact three-document
governance candidate. Do not stage, commit, push, invoke Claude, transmit
private files, run executable tests, create adapter files, execute Git or
Supabase CLI for the future implementation, contact the hosted project, replay
migrations, upload evidence, mutate the PR, mark Ready, merge, deploy, cut over,
or retire anything. Each later boundary requires separate Owner authorization.
