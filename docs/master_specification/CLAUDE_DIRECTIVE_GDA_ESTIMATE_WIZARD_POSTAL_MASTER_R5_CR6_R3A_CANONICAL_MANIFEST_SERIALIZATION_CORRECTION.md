# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3A Canonical Manifest Serialization Correction

## 1. Status, authority, and supersession

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3A_CANONICAL_MANIFEST_SERIALIZATION_CORRECTION
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3A_CANONICAL_MANIFEST_SERIALIZATION_CORRECTION_DIRECTIVE_V1
status: GOVERNANCE_ONLY_NOT_AUTHORIZED_FOR_DIAGNOSIS_IMPLEMENTATION_OR_EXECUTION
date: 2026-09-04
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_predecessor_head: 7d148084d5799109b5d92f5d9f7b8a14e1dd58ba
fixed_predecessor_tree: 3dfea1c7ece8c3faaaaef44ff07c5a80a4e66a19
base: main
pull_request_state_before_authoring: OPEN
pull_request_draft_before_authoring: true
hosted_target_project_ref: nqvnjqcxgngqsqkbpdfi
production_target_contact: PROHIBITED
supersedes: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER_DIRECTIVE_V1
superseded_diagnosis_instruction: https://github.com/nisikawa-officeAZ/GYEON/pull/67#issuecomment-5534021615
codex_rejection: https://github.com/nisikawa-officeAZ/GYEON/pull/67#issuecomment-5534115420
```

This directive fully supersedes CR6-R3. CR6-R3's objective, two-file future
implementation allowlist, hosted target, process boundary, quarantine policy,
evidence boundary, prohibitions, and stop rule remain in force only as restated
here. The corrected fields are the canonical/actual authority split, exact
aggregate serialization, protected monthly-invoice row treatment, concrete
hash implementation, hostile tests, and result contract.

Authoring this document does not authorize private-file transmission, Claude
invocation, source changes, executable tests, Supabase CLI execution, network,
Hosted Supabase or database access, migration replay, evidence upload, Git
stage/commit/push, PR mutation, Ready conversion, merge, deployment, cutover,
or retirement.

## 2. Reason for correction

Claude's one-time CR6-R3 read-only diagnosis reported
`READY_FOR_TWO_FILE_OFFLINE_IMPLEMENTATION`, while also identifying that the
authorized eighteen-file input did not state the byte serialization used to
produce the fixed aggregate hash. MacBook Codex rejected readiness as
`CHANGES_REQUIRED_DIRECTIVE`.

The existing core delegates aggregate computation to
`options.hashAggregate(staged)` and accepts any function returning the fixed
literal. Existing tests intentionally use constant-return substitutes. Without
a fixed byte contract and a concrete trusted implementation, the aggregate
gate is not evidence that paths and content were hashed.

## 3. Objective

Define the smallest corrected contract for a future two-file offline execution
adapter. The adapter may expose two explicit modes:

1. `preflight-only`: local read-only checks only; it must never start migration
   application or contact a hosted target; and
2. `execute-once`: present in source but never run during implementation. A
   later Owner approval must quote the exact accepted adapter commit/tree,
   project ref, attempt id, commands, and evidence destination before use.

Any ambiguity, prompt, mismatch, timeout, signal, non-zero exit, redaction
failure, hash failure, or incomplete cleanup returns `QUARANTINE_NO_RETRY` and
burns the exact `project_ref + attempt_id` pair.

## 4. Immutable accepted inputs

The existing fourteen files under
`scripts/e2e/gda-estimate-postal-master-r5-cr6/` remain read-only dependencies.
Their accepted combined SHA-256 of byte-sorted `sha256sum` output lines is:

`4e4dac8a8d6c667c586fee010ef7a9909c665333547c74f0ac7b37ccf44f2395`

The fixed migration identity is:

- formal top-level migration count: `113`;
- staged migration count: `112`;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- accepted staged aggregate SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- protected monthly-invoice row content SHA-256, previously attested and used
  only as a literal serialization value:
  `1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255`.

The following paths remain protected. Agents must not open, read, diff,
display, copy to a prompt, stage, or modify their contents:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

A later separately authorized hosted phase may stream the fixed monthly-invoice
Git blob into the isolated replay workdir without displaying, logging,
retaining, or transmitting its SQL text. The protected LINE blob is never
materialized or applied in this phase family.

## 5. Exact aggregate serialization contract

The aggregate must be computed from exactly 112 rows in repository-relative
path byte order. For each staged entry, append exactly:

```text
<64 lowercase hexadecimal content SHA-256><two ASCII spaces 0x20><repository-relative path encoded as UTF-8><LF 0x0A>
```

The aggregate input has all of these properties:

1. no header, footer, count, quotes, escaping, JSON, BOM, CR, or blank line;
2. exactly two ASCII spaces between the digest and path;
3. exactly one LF after every row, including the final row;
4. paths are the canonical repository-relative paths beginning
   `supabase/migrations/`;
5. row order is `Buffer.compare(Buffer.from(pathA), Buffer.from(pathB))`
   equivalent byte order;
6. the protected LINE path contributes no row;
7. the protected monthly-invoice row uses the fixed attested content digest
   `1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255`
   without reading its source content; and
8. every other row uses the SHA-256 of the exact materialized file bytes.

Apply SHA-256 once to the complete concatenated byte sequence. The result must
equal the fixed aggregate literal. A local governance-time reproduction at the
fixed predecessor identity produced 113 formal paths, 112 staged rows, a final
LF, and exact digest
`0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`
without reading either protected migration's content.

Alternate serialization is invalid even if it describes the same file set.
The retained R5 runtime manifest digest
`722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`
uses another serialization and must not be substituted.

## 6. Independent authority and concrete hashing contract

The future production adapter must not accept `canonicalManifest`,
`hashAggregate`, an expected aggregate, a migration list, a project ref, or an
executable name from an external caller.

It must use two separately testable derivation paths:

1. **Canonical authority:** obtain path, mode, and blob metadata only from the
   fixed Git commit/tree. Reject wrong identity, count, order, duplicate,
   missing, extra, wrong-mode, or wrong-blob evidence. The protected LINE and
   monthly-invoice canonical entries retain `sha256: null`; ordinary canonical
   content hashes are derived from fixed Git blobs, not from the isolated
   workdir.
2. **Actual authority:** enumerate the fresh isolated workdir independently,
   verify the exact 112 paths, modes, and blob identities, and derive ordinary
   content SHA-256 values from those materialized bytes. The monthly-invoice
   entry remains metadata-only and uses its fixed attested digest only inside
   the concrete aggregate serializer. No actual entry is copied from the
   canonical table.

The trusted aggregate function must be implemented in the new adapter with
`node:crypto` SHA-256 and the exact Section 5 byte contract. The production
entrypoint must pin this concrete function when calling the existing core. A
constant-return function, caller-supplied function, precomputed return value,
or a function that hashes only count, paths, Git blobs, or JSON is prohibited.

The aggregate comparison supplements, and does not replace, the existing
canonical table comparison. Path reordering, mode/blob drift, missing/extra
entries, and protected-content substitution must be rejected before any plan
or process spawn even where those fields are not part of the aggregate bytes.

## 7. Future implementation allowlist

A later explicit Owner authorization may create exactly these two files:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

No existing source, test, migration, configuration, lockfile, package file, or
governance document may be changed by that implementation invocation.

## 8. Remaining adapter contract

### 8.1 No implicit execution and CLI discovery

- Import has zero filesystem, Git, process, environment, network, Supabase, or
  database side effects.
- `preflight-only` and `execute-once` are explicit and mutually exclusive.
- `execute-once` requires a literal confirmation and unused safe attempt id.
- Run only local `supabase --version`, `supabase migration list --help`, and
  `supabase migration up --help` compatibility discovery during implementation.
- Record the exact version and help-output hashes. Unsupported flags return
  `CHANGES_REQUIRED_CLI_COMPATIBILITY`; do not guess or rewrite commands.
- Do not run a linked command or contact a hosted target during implementation.

### 8.2 Real process and isolated workdir boundary

- Use `node:child_process` only inside the new adapter, only with
  `spawn`/`execFile`, argument arrays, `shell: false`, and the fixed sanitized
  environment.
- Never accept database URLs, passwords, production refs, arbitrary project
  refs, shell text, or caller-supplied executable names.
- Use one fresh absolute runtime directory outside the worktree at mode `0700`;
  reject symlinks, traversal, reuse, and stale `supabase/.temp/project-ref`.
- Capture stdout/stderr as volatile raw artifacts without printing secrets.
- A completed read-only migration list must prove the expected empty remote
  ledger before the single migration-up process can start.
- Migration up is spawned at most once. No retry, repair, reset, include-all,
  direct DB URL, or manual continuation exists.
- The shared `1,800,000` ms attempt ceiling covers both processes.

### 8.3 Burn ledger and evidence

- Persist the attempt key as burned before the first real process spawn;
  success and failure remain burned permanently.
- Burn ledger and retained evidence live only in one later Owner-approved
  directory outside the repository, with directory mode `0700` and file mode
  `0600`.
- Finalize every artifact: redact, retain, read back, scan, verify SHA-256, then
  delete raw data. Any uncertainty quarantines without retry.
- Never retain credentials, URLs, authorization headers, environment dumps, or
  unredacted CLI output.

## 9. Mandatory offline hostile tests

All tests use fake Git, filesystem, process, clock, timer, environment,
volatile-storage, retention-storage, deletion, event, and CLI adapters. They
must prove at least:

1. import has zero side effects;
2. the concrete serializer reproduces the fixed digest only for the exact 112
   rows and does not call a caller-supplied hasher;
3. single-space separators, missing final LF, CRLF, JSON, header/footer, and
   alternate order do not reproduce the accepted digest;
4. one substituted path, missing/extra row, ordinary content-hash drift,
   protected monthly digest drift, wrong mode, or wrong blob is rejected;
5. reversed or swapped actual/canonical authority input is rejected rather
   than silently normalized into acceptance;
6. a fake constant-return aggregate adapter cannot enter the production plan;
7. canonical and actual builders use separate fake evidence sources, and
   changing only either side fails closed;
8. `preflight-only` can never spawn migration-up or contact a hosted target;
9. wrong identity/project ref, dirty state, upstream divergence, unsafe
   workdir, prompt, timeout, signal, process error, ledger mismatch,
   redaction/hash/read-back/deletion uncertainty, and burned attempt all fail
   closed without retry;
10. a valid exact fixture completes once and yields deterministic redacted
    evidence; and
11. all existing seven CR6 test files continue to pass unchanged.

## 10. Future read-only re-diagnosis contract

After this governance candidate is independently verified, committed, and
normally pushed, a new superseding GitHub comment must authorize at most one
tool-disabled read-only Claude diagnosis. Its repository read scope is exactly:

1. `AGENTS.md`;
2. this CR6-R3A directive;
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`;
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`; and
5. the existing fourteen CR6 harness files.

Protected paths remain metadata-only. The diagnosis may not edit, test, use
network, run Git/Supabase/DB/provider commands, or mutate any system.

Required marker:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3A_READ_ONLY_DIAGNOSIS_RESULT_V1`

Allowed verdicts:

- `READY_FOR_TWO_FILE_OFFLINE_IMPLEMENTATION`
- `CHANGES_REQUIRED_DIRECTIVE`
- `BLOCKED_INPUT`

Codex must independently accept the diagnosis before implementation starts.

## 11. Future implementation result and verification

The implementation result marker remains:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3_HOSTED_EXECUTION_ADAPTER_IMPLEMENTATION_RESULT_V1`

Allowed verdicts remain:

- `READY_FOR_CODEX_OFFLINE_ACCEPTANCE`
- `CHANGES_REQUIRED_SOURCE`
- `CHANGES_REQUIRED_CLI_COMPATIBILITY`
- `BLOCKED_ENVIRONMENT`

Verification must include `node --check` for all sixteen files, one `node
--test` invocation covering the new test and existing seven tests,
`git diff --check`, exact two-path/mode checks, unchanged fourteen-file combined
hash, protected metadata-only checks, clean index, and unchanged upstream state.
No verification command may contact Supabase, a database, GitHub, Vercel, or
another external service.

## 12. Stop rule

Stop after authoring and independently checking this three-document governance
candidate. Do not stage, commit, push, invoke Claude, run executable tests,
create either implementation file, run Supabase CLI, contact the hosted
project, replay migrations, upload evidence, mutate the PR, mark Ready, merge,
deploy, cut over, or retire anything. Every later boundary requires its own
explicit authorization.
