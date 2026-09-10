# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3J-R1 List Stderr Compatibility Diagnosis

## 1. Status, authority, and exact boundary

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS_DIRECTIVE_V1
status: GOVERNANCE_INSTRUCTION_CANDIDATE_ONLY_NOT_AUTHORIZED_FOR_CLAUDE_OR_EXECUTION
date: 2026-09-06
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
diagnosed_head: 637930601d698e4622a0c9331b3ec086717ed7af
diagnosed_tree: 10b0c6a84fe5244aae40614fd4509e10bc6366e4
diagnosed_parent: dfd59f95466408783730d46fdd58a5f8a107ca62
base: main
upstream_ahead_behind_before_authoring: "0 0"
hosted_target_project_ref: nqvnjqcxgngqsqkbpdfi
hosted_target_name: DealerOS-Dev-Clean-R5
hosted_target_region: ap-northeast-1
production_target_contact: PROHIBITED
burned_attempt_id: r3j-20260906-01
```

The Owner authorized creation of this diagnosis instruction candidate only.
This does not authorize Claude invocation, private-file transmission, source or
test changes, another Supabase command, another hosted read, database access,
migration application, stage, commit, push, PR mutation, Ready conversion,
merge, deployment, cutover, project recreation, or deletion.

The prior `execute-once` authorization has been consumed. Attempt
`r3j-20260906-01` is permanently burned and must never be reused, repaired,
deleted, renamed, or aged out.

## 2. Authoritative observed event

MacBook Codex invoked the accepted public entrypoint once with the exact fixed
target and confirmation token. The adapter stopped fail-closed with:

```json
{
  "ok": false,
  "decision": "QUARANTINE_NO_RETRY",
  "mode": "execute-once",
  "projectRef": "nqvnjqcxgngqsqkbpdfi",
  "head": "637930601d698e4622a0c9331b3ec086717ed7af",
  "tree": "10b0c6a84fe5244aae40614fd4509e10bc6366e4",
  "applyResult": {
    "ok": false,
    "decision": "QUARANTINE_NO_RETRY",
    "reason": "ledger_mismatch"
  }
}
```

Only the read-only `migration list` stage was launched. The `migration up`
stage was not constructed or launched after the mismatch, so none of the 112
staged migrations was applied by this attempt.

Retained evidence identity:

| Field | Exact value |
| --- | --- |
| Path | `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/runtime/gda-estimate-postal-master-r5-cr6/r3j-evidence/retained/execution-ff8a2084ee5d65f33f17003541b9623c.json` |
| Mode | `0600` |
| SHA-256 | `36e4308296aabd619476054428deb68da28591455929b6f57ef42d2ce42f9849` |
| Marker | `GDA_ESTIMATE_POSTAL_MASTER_R5_CR6_EXECUTION_METADATA_V1` |
| Logical calls | `1` |
| Logical stages | `list` |
| Real OS launches | `1` |
| Prompt detected | `false` |
| Truncated | `false` |
| Target mismatch | `false` |
| Ledger mismatch | `true` |
| Spawn failed | `false` |
| Lock after finalization | released / absent |
| Isolated runtime after finalization | securely deleted / absent |

The durable burn record exists with mode `0600`. The active lock is absent.
The Git worktree remained clean immediately after the attempt and upstream was
`0 0` before this instruction candidate was authored.

## 3. Independently proved mismatch boundary

The captured list stdout is not the defect. MacBook Codex independently rebuilt
the exact expected JSON from repository path metadata without reading protected
SQL content:

| Field | Expected | Observed | Result |
| --- | --- | --- | --- |
| Migration rows | `112` | `112` | exact |
| stdout bytes | `5611` | `5611` | exact |
| stdout SHA-256 | `acdda8ba92034bf319ecb99cda225c9a10778c7d784ff370b4889871660e1d75` | `acdda8ba92034bf319ecb99cda225c9a10778c7d784ff370b4889871660e1d75` | exact |
| Expected remote value | empty string for every row | exact expected JSON hash | exact |

The only proved incompatibility is stderr:

| Field | Expected by source | Observed |
| --- | --- | --- |
| stderr bytes | `33` | `60` |
| stderr SHA-256 | `4a936fcd93f5974680b404e77d9a346a2fb99f7cef2ec72a11e6e01120c4eadd` | `b9977cb727ae28f6dfc5ee83a4ca928c7a9f42b11c4757f73dd5a17e85681a5f` |

The raw stderr was intentionally deleted after redacted evidence finalization.
Its additional 27 bytes are therefore unknown. Do not guess their text or
classify them as benign from byte count alone.

## 4. Codex adjudication

```text
CHANGES_REQUIRED_DIAGNOSIS
```

The current source converts any successful-list stderr other than exactly
`Connecting to remote database...\n` into the same `ledgerMismatch` result used
for actual remote-history drift. This conflates transport/progress-output drift
with database migration-ledger drift and produced a safe but false quarantine
after stdout proved the exact empty-remote 112-row result.

This adjudication does not authorize weakening the parser. Empty stdout, extra
remote versions, unexpected JSON, prompts, truncation, target drift, non-zero
exit, signal, or unknown output must continue to fail closed.

## 5. Required first reads for a future Claude diagnosis

A later, separately authorized Claude diagnosis must read these files first and
follow the newest non-superseded instruction matching the fixed diagnosis
identity:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. the latest accepted and pending entries in
   `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. this directive

The plan and phase ledger currently stop at CR6-R3F and do not yet record the
later R3G through R3J events. Claude must report this as
`GOVERNANCE_LEDGER_NOT_SYNCHRONIZED`; it must not invent, rewrite, or silently
reconcile missing entries.

## 6. Exact future private read allowlist

A later explicit Owner authorization may transmit and let Claude read exactly
these seven repository files plus the one retained metadata evidence file:

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS.md`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
3. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`
4. `scripts/e2e/gda-estimate-postal-master-r5-cr6/replay-command-core.mjs`
5. `scripts/e2e/gda-estimate-postal-master-r5-cr6/replay-command-core.test.mjs`
6. `scripts/e2e/gda-estimate-postal-master-r5-cr6/apply-once.mjs`
7. `scripts/e2e/gda-estimate-postal-master-r5-cr6/apply-once.test.mjs`
8. `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/runtime/gda-estimate-postal-master-r5-cr6/r3j-evidence/retained/execution-ff8a2084ee5d65f33f17003541b9623c.json`

Current repository-file SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `hosted-execution-adapter.mjs` | `40bf1c93b832c889c83cbf68ea7db917e7eca4bfa884f41f1bea932c607622f0` |
| `hosted-execution-adapter.test.mjs` | `6c24070d25fd56cf4301b59eb9d6a15d14c833b6b90958ef7575213aac3e9429` |
| `replay-command-core.mjs` | `0b6adcfd28b22344333e399fa77df6520a8ab163a08360920dfca909ed866903` |
| `replay-command-core.test.mjs` | `b80efc89099bbde287d9f622c1e7945c5f1a017322e85b9b150b30cb09e6afe3` |
| `apply-once.mjs` | `6d0b57efe6184e638a845b6c8586657b8f8a0567cdd4c3e7c0861b2faf9da309` |
| `apply-once.test.mjs` | `76294b9890daead78bfb2ef3ec358523ead5a5f1ea71f2a8baaac3a5ee4f83dc` |

No other repository, local, environment, CLI binary, credential store, log,
raw stdout/stderr, migration body, database object, or provider record is in
scope.

## 7. Protected metadata-only paths

The following identities may be verified with `git ls-tree` metadata only.
Their contents must not be opened, read, diffed, displayed, copied, transmitted,
staged, or modified:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

## 8. Mandatory future diagnosis questions

The future read-only diagnosis must answer all of the following without running
tests, commands, or external tools:

1. Prove the exact call chain that maps a successful CLI exit plus stderr drift
   to `ledgerMismatch:true`.
2. Confirm whether the stdout hash proves every expected local version and an
   empty remote value in canonical order.
3. Distinguish remote migration-ledger mismatch from stderr-format mismatch in
   the proposed result taxonomy without changing the frozen core's recognized
   exitInfo fields.
4. Determine whether an exact safe correction can be specified from the
   authorized evidence alone.
5. If the extra 27 bytes cannot be identified exactly, return
   `BLOCKED_NEEDS_SEPARATE_READ_ONLY_CAPTURE`; do not guess.
6. If a later capture is required, define one bounded `migration list`-only
   diagnostic that retains a redacted, secret-scanned representation sufficient
   to classify each stderr line, never launches `migration up`, never creates a
   burn record, and never mutates hosted state.
7. Define the smallest future two-file implementation allowlist and exact
   hostile tests, but do not edit or run them.
8. Account for the next correction commit's identity: it must be a direct child
   of `637930601d698e4622a0c9331b3ec086717ed7af` changing exactly the two adapter
   paths. A governance document must not be committed onto PR #67 before that
   correction because doing so would invalidate the current direct-parent
   execution contract.

## 9. Prohibited remediation shortcuts

The diagnosis must reject all of these shortcuts:

- accept arbitrary stderr;
- accept every zero-exit list result regardless of stderr;
- substring-only acceptance of `Connecting to remote database...`;
- ignore warnings or unknown lines without exact classification;
- merge stdout and stderr before parsing;
- retain raw credentials, URLs, connection strings, headers, environment dumps,
  or unredacted process output;
- reuse or delete burned attempt `r3j-20260906-01`;
- launch `migration up`, `db push`, `migration repair`, `db reset`, SQL, or a
  direct database client;
- contact the production ref `dmvyaykhibmphrmekjbb` or Development ref
  `vhiuiwolnlvlwvoaingd`;
- change the 113-entry formal manifest, 112-entry staged set, protected LINE
  exclusion, or aggregate SHA-256;
- classify a test count alone as acceptance.

## 10. Result contract

Use exactly one marker:

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS_RESULT_V1
```

Allowed verdicts:

- `READY_FOR_EXACT_TWO_FILE_OFFLINE_REPAIR`
- `BLOCKED_NEEDS_SEPARATE_READ_ONLY_CAPTURE`
- `CHANGES_REQUIRED_DIRECTIVE`
- `BLOCKED_INPUT`

The result must report:

- exact diagnosed HEAD/tree/parent and all read-file hashes;
- the proven one-list/zero-up execution boundary;
- exact expected-versus-observed stdout and stderr byte/hash evidence;
- the precise source call chain and fault classification;
- whether the extra stderr content is knowable from the authorized inputs;
- a literal later read-only-capture contract if needed;
- a literal two-file repair allowlist and exact offline test list if ready;
- protected metadata-only identities;
- the governance-ledger synchronization gap; and
- explicit zero-edit, zero-test, zero-Git-mutation, zero-Supabase-contact,
  zero-database, zero-provider, zero-deployment declarations.

## 11. Future repair boundary

Only after MacBook Codex accepts the diagnosis and the Owner separately
authorizes implementation may Claude edit exactly:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

No implementation is authorized by this document. A later accepted repair does
not authorize stage, commit, push, Hosted execution, migration application,
Ready, merge, deployment, cutover, or another attempt.

## 12. Stop rule

Stop after returning the read-only diagnosis result. Do not run Claude under
this candidate, do not run a diagnostic command, do not reconnect to Supabase,
do not inspect raw provider output, do not edit source or tests, and do not
perform any Git or deployment mutation. Every later boundary requires separate
explicit Owner authorization.
