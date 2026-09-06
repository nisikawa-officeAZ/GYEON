# CLAUDE DIRECTIVE — GDA Estimate Wizard Postal Master R5 CR6-R3G Production Adapter Closure Correction

## 1. Status, authority, and exact boundary

```yaml
phase: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3G_PRODUCTION_ADAPTER_CLOSURE_CORRECTION
marker: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3G_PRODUCTION_ADAPTER_CLOSURE_CORRECTION_DIRECTIVE_V1
status: GOVERNANCE_INSTRUCTION_ONLY_NOT_AUTHORIZED_FOR_CLAUDE_OR_IMPLEMENTATION
date: 2026-09-06
repository: nisikawa-officeAZ/GYEON
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_governance_head: e2371101356ac275e9bf1569fb18f887ad94796b
fixed_governance_tree: c52212942d91fb31c423b49ef50536806bdd25ff
base: main
upstream_ahead_behind_before_authoring: "0 0"
hosted_target_project_ref: nqvnjqcxgngqsqkbpdfi
production_target_contact: PROHIBITED
supersedes_for_implementation_acceptance: GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3F_SYNTHETIC_EXIT_CLASSIFICATION_CORRECTION_DIRECTIVE_V1
```

The Owner authorized creation of this instruction file only. This authorization
does not permit editing either implementation candidate, editing any other
repository file, invoking Claude, retransmitting private files, running another
implementation or test pass, contacting GitHub/Supabase/a database/provider,
staging, committing, pushing, changing PR state, marking Ready, merging,
deploying, replaying migrations, or cleaning unrelated work.

CR6-R3G preserves every non-conflicting CR6-R3F migration, protected-content,
durable-ledger, synthetic-exit, no-retry, CLI, materialization, and two-file
scope rule. Where an implementation-acceptance statement conflicts, this
document governs.

## 2. Codex adjudication of the rejected R2 candidate

MacBook Codex independently inspected the R2 two-file candidate and assigns:

```text
CHANGES_REQUIRED_SOURCE
```

The exact eight-file offline test invocation returned `285/285` pass and zero
failures. That result is not acceptance because the public success tests replace
the production adapter factory with fake adapters, while the real production
path remains blocked or incomplete.

Rejected candidate identity:

| Path | State | SHA-256 |
| --- | --- | --- |
| `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs` | untracked candidate | `091070e681e282e3859504216fa5aa240e0953fd9976e77f4ec6d9bbf924f900` |
| `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs` | untracked candidate | `cb07e4ff40c31c0179bd02816042cda3da0009963779caabcbc39f3360af08b7` |

The index remained empty, upstream remained `0 0`, and no stage, commit, push,
hosted contact, database/provider action, or migration replay was accepted.

## 3. Exact objective

Correct only the six accepted production-closure defects:

1. the concrete canonical-manifest path always throws instead of returning the
   accepted independent 113-entry authority;
2. `preflight-only` calls `gh pr view`, contradicting its zero-hosted-contact
   contract;
3. an exported mutable factory setter lets an importing caller replace the
   supposedly non-overridable production adapters;
4. the public-success tests prove only the substituted fake factory, not the
   real public route;
5. the adapter source contains one literal NUL byte; and
6. the concrete evidence adapter starts with an empty artifact list and the
   real process/result path never populates mandatory retained evidence.

Do not redesign the frozen fourteen-file harness. Do not add a third source,
fixture, manifest, package, configuration, migration, or evidence file.

## 4. Future correction allowlist

A later, separate, explicit Owner authorization may edit exactly these two
currently untracked candidates:

1. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.mjs`
2. `scripts/e2e/gda-estimate-postal-master-r5-cr6/hosted-execution-adapter.test.mjs`

Every other path is read-only. Stage, commit, push, PR mutation, hosted access,
database/provider access, and deployment remain separate gates.

## 5. Immutable retained CR6-R3F inputs

- existing frozen harness files: exactly `14`;
- combined SHA-256 of byte-sorted `sha256sum` lines:
  `4e4dac8a8d6c667c586fee010ef7a9909c665333547c74f0ac7b37ccf44f2395`;
- formal top-level SQL count: `113`;
- staged SQL count: `112`;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- staged aggregate SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- protected monthly content attestation:
  `1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255`;
- fixed Supabase executable:
  `/opt/homebrew/Cellar/supabase/2.116.0/bin/supabase`;
- fixed hosted project ref: `nqvnjqcxgngqsqkbpdfi`;
- fixed burn-ledger root:
  `/Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/runtime/gda-estimate-postal-master-r5-cr6/burn-ledger-v1`.

Protected metadata-only identities remain exactly:

| Path | Mode | Blob |
| --- | --- | --- |
| `src/components/estimates/wizard/screens/ScreensPreview.tsx` | `100644` | `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f` |
| `supabase/migrations/20260801110110_line_link_tokens.sql` | `100644` | `accd22345054cc44f89156fd78eaba6dfe4242a4` |
| `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` | `100644` | `32fda49583ae1217bc13711784ad8fa31744726c` |
| `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` | `100644` | `fe3c80f22fd80dcbfab076082473216dda582c14` |

Never open, read, diff, display, prompt-copy, stage, or modify protected
contents. The protected LINE blob is never requested or materialized. The
monthly blob may be streamed only into the isolated tree under the retained
R3F metadata-only and attested-digest rules.

## 6. Correction 1 — concrete independent canonical authority

`getCanonicalManifest()` must be complete inside the production adapter. It
must never throw a deliberate "future layer" or "separately supplied data"
error, accept caller data, copy the current raw entry array, or derive both
canonical and actual evidence from the same observation.

Use two independent Git acquisition paths:

1. **Canonical authority:** use `/usr/bin/git` with argument arrays,
   `shell:false`, closed stdin except the exact batch request, fixed cwd,
   fixed sanitized environment, and byte/time ceilings to read path/mode/blob
   identity from the fixed governance commit
   `e2371101356ac275e9bf1569fb18f887ad94796b`. First prove its tree is exactly
   `c52212942d91fb31c423b49ef50536806bdd25ff`. Hash the 111 ordinary fixed
   blobs from that fixed commit; retain `sha256:null` for the protected LINE
   and monthly entries.
2. **Actual authority:** independently read the current accepted execution
   HEAD/tree and later inspect the separately materialized 112-file tree. It
   must not reuse, alias, or return the canonical array.

The canonical acquisition must validate the exact non-recursive `ls-tree -z`
shape: 113 top-level SQL blobs plus the fixed `DRAFT_DO_NOT_APPLY` tree. It
must reject framing errors, missing tab/NUL terminators, wrong type/mode/count,
duplicates, nesting, ordering drift, missing/extra paths, batch header drift,
short/extra bytes, wrong object ids, or aggregate mismatch.

If the fixed commit/tree cannot yield the exact canonical table, return a
fail-closed error. Do not substitute the current actual table, a constant hash
return, a stub, or a future dependency.

## 7. Correction 2 — preflight has zero hosted contact

The public `preflight-only` route must not invoke `gh`, GitHub APIs, network,
Supabase linked commands, databases, providers, Vercel, or any hosted target.
Remove `gh pr view` and every equivalent live-PR lookup from the concrete
adapter.

For offline source preflight, the required PR facts are pinned governance
literals only:

```text
number=67
base=main
state=OPEN
draft=true
branch=agent/gda-estimate-ocr-postal-clean-replacement-r1
```

The adapter may supply those internal literals to the frozen preflight shape,
but must label them as pinned authority rather than fresh GitHub evidence. A
separate later Owner-authorized execution gate must independently refresh live
PR state before any hosted execution. This offline adapter must never do so.

All `/usr/bin/git` calls use a literal minimal environment constructed inside
the module; do not pass through the caller's full environment, mutable PATH,
Git configuration variables, credential helpers, or network-capable Git
operations. No bare `gh`, `git`, `supabase`, or shell command name is allowed.

## 8. Corrections 3 and 4 — production authority cannot be replaced

The public entrypoint remains exactly:

```text
runHostedExecutionAdapter(rawInput)
```

It accepts no second argument and no adapter-bearing key. In addition:

- remove `__setProductionAdapterFactoryForTestsOnly` and
  `__resetProductionAdapterFactoryForTestsOnly` from all exports;
- remove mutable module-level `productionAdapterFactory` state;
- the public entrypoint must call one lexical, non-exported concrete factory
  directly;
- no global, environment variable, import hook, setter, callback, registry,
  symbol, or test flag may replace that concrete factory; and
- pure lower-level functions may retain dependency injection for hostile unit
  tests only when changing them cannot alter the public entrypoint's factory.

Do not claim a real public success during the uncommitted implementation
phase: its clean-HEAD/exact-parent gate is intentionally not satisfiable while
the two candidates are untracked. Unit tests must instead prove lower-level
success with fakes, public input rejection, absence of a production-factory
override surface, and that the public source route directly binds the lexical
concrete factory. A real public `preflight-only` success is a later,
post-commit, separately authorized local acceptance gate.

Passing tests by mutating the production factory is prohibited.

## 9. Correction 5 — source must be ordinary UTF-8 text

Both candidate files must contain zero NUL bytes, zero CR bytes, and no BOM.
The NUL delimiter in JavaScript source must be represented by an escaped source
literal such as `"\\0"`; an actual `0x00` byte in the source file is invalid.

Verification must report byte counts and prove:

```text
NUL count = 0
CR count = 0
BOM count = 0
```

The files must remain ordinary reviewable text to Git and standard search/diff
tools.

## 10. Correction 6 — mandatory evidence must be real and connected

`execute-once` must never treat an empty artifact list as successful evidence.
The production process/result path must populate at least one deterministic,
metadata-only evidence artifact before `finalizeEvidence()` and before lock
release.

The real process adapter may hold bounded child stdout/stderr bytes only in
volatile memory. It must never print or retain those raw streams. For every
logical stage/outcome it must expose only a canonical metadata summary to the
outer adapter, including the permitted R3F fields:

- stage and normalized child exit data;
- stdout/stderr byte counts and SHA-256 values;
- prompt/truncation/targetMismatch/ledgerMismatch flags;
- logical-call and real-OS-launch counts;
- burn-path identity hash and lock lifecycle;
- private subtype where permitted; and
- final verification result.

The summary must contain no raw stream text, credentials, URL, header,
environment dump, protected content, SQL, or burn-record content. Write the
summary as a mode-0600 volatile artifact below the validated `evidenceRoot`,
register its safe identifier in `rawArtifacts`, then use the frozen
`finalizeEvidence()` sequence: redact, retain, read back, rescan, verify
SHA-256, and delete the volatile summary. Only after that exact success may the
lock release begin.

Missing summary, zero artifacts, duplicate/unsafe artifact id, write/read/hash/
scan/delete uncertainty, raw-stream leakage, or an inconsistency between
process result and summary is `QUARANTINE_NO_RETRY`; the lock stays fail-closed
and the attempt stays burned.

Synthetic target/ledger outcomes also require their own metadata summary even
though they launch zero real processes. `preflight-only` retains no hosted
evidence and creates no evidence payload.

## 11. Mandatory offline correction tests

The future authorized correction may run only local, offline tests. In
addition to all retained CR6-R3F hostile cases, tests must prove:

1. the concrete canonical function returns an exact independent 113-entry
   table from the fixed commit/tree and never returns the actual array;
2. missing/wrong fixed commit/tree, wrong `ls-tree -z` structure, object batch
   drift, or aggregate drift fails closed;
3. no production or public preflight path contains or invokes `gh`, network,
   a linked Supabase command, or another hosted client;
4. public module exports contain no production-factory setter/resetter and a
   caller cannot replace the lexical production factory;
5. no public-success test uses adapter-factory substitution;
6. both source files have zero NUL, CR, and BOM bytes and remain text-diffable;
7. an empty `rawArtifacts` list fails execute-once before lock release;
8. real success, non-zero, signal, timeout, prompt, target mismatch, ledger
   mismatch, and evidence failure each produce consistent metadata-only
   evidence with correct logical/real launch counts;
9. fake secret-shaped child bytes do not occur in retained evidence;
10. volatile summary deletion and lock release occur only after retained
    read-back, secret rescan, and hash verification;
11. public preflight remains intentionally fail-closed before the later
    post-commit identity exists, rather than bypassing the clean/exact-parent
    contract; and
12. the complete existing seven-test suite remains unchanged and passing.

Required verification is one `node --check` pass for the two candidates and
the fourteen frozen files, followed by one `node --test` invocation naming the
new candidate test plus the existing seven test files. Also run exact
allowlist/mode checks, the frozen fourteen-file combined hash, protected
metadata-only checks, clean-index/upstream checks, and whitespace/text checks.
No command may contact a hosted system.

## 12. Result contract

Use exactly one result marker:

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3G_PRODUCTION_ADAPTER_CLOSURE_IMPLEMENTATION_RESULT_V1
```

Allowed verdicts:

- `READY_FOR_CODEX_OFFLINE_ACCEPTANCE`
- `CHANGES_REQUIRED_SOURCE`
- `BLOCKED_INPUT`
- `BLOCKED_ENVIRONMENT`

`READY_FOR_CODEX_OFFLINE_ACCEPTANCE` requires all six corrections, every
mandatory test, exact two-path scope, unchanged frozen fourteen-file hash,
unchanged protected metadata, empty index, upstream `0 0`, and explicit zero
hosted/Git-mutation declarations. Test count alone is never sufficient.

The result must report candidate SHA-256 values, byte/NUL/CR/BOM counts, exact
test command/count/exit code, exact exports, canonical-versus-actual source
separation, zero-hosted-contact proof, evidence artifact lifecycle proof,
`git diff --check`, and all prohibition flags.

## 13. Stop rule

This document stops at governance instruction authoring. Do not edit the two
candidate files now. Do not invoke Claude, retransmit private files, run the
future correction tests, stage, commit, push, mutate PR #67, contact Supabase
or any hosted target, replay migrations, upload evidence, mark Ready, merge,
deploy, cut over, or retire anything. Each later boundary requires separate
explicit Owner authorization.
