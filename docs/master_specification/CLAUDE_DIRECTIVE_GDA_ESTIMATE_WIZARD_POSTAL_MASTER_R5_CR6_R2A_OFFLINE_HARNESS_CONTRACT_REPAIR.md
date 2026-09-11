# Claude Directive — GDA Estimate Wizard Postal Master R5 CR6-R2A Offline Harness Contract Repair

## 1. Authority and phase ceiling

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2A_OFFLINE_HARNESS_CONTRACT_REPAIR` |
| Directive marker | `GDA_POSTAL_R5_CR6_R2A_OFFLINE_HARNESS_CONTRACT_REPAIR_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2A_OFFLINE_HARNESS_CONTRACT_REPAIR_RESULT_V1` |
| Repository | `nisikawa-officeAZ/GYEON` |
| Pull request | `#67`, OPEN/Draft, base `main` |
| Governance pre-authoring HEAD / tree | `00ba2dec6be946ad12b5446748b370d4510a6a90` / `798b762b5a3882c1245903a9c1b153cb2207e0e6` |
| Branch | `agent/gda-estimate-ocr-postal-clean-replacement-r1` |
| Fixed hosted target | `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi` |
| Current authorization | Documentation authoring only: this directive plus the three governance trackers in Section 13 |
| Future repair ceiling | Modify only the existing fourteen CR6-R2 harness/test files and run offline checks after a separate Owner authorization |

This directive records MacBook Codex's independent rejection of the first
CR6-R2 offline harness candidate and defines the smallest repair boundary. It
does not authorize Claude invocation, source/test edits, Supabase CLI use,
network access, Hosted Supabase or PostgreSQL access, migration replay, Git
stage/commit/push, PR mutation, Ready conversion, merge, deployment, cutover,
or retirement.

The current documentation candidate must be independently reviewed, committed,
and normally pushed before the Owner may separately authorize one repair
invocation against the delivered directive commit/tree.

## 2. Accepted CR6-R2 execution facts

The Owner separately authorized one offline Claude implementation at fixed
HEAD/tree `00ba2dec6be946ad12b5446748b370d4510a6a90` /
`798b762b5a3882c1245903a9c1b153cb2207e0e6`.

The first launch failed before API submission because an invalid empty MCP
configuration was supplied. It created no file and consumed no Claude API
credit. One corrected launch used an empty MCP server map, restricted offline
tools, and the exact authorized private input boundary. Claude created exactly
fourteen new files and returned:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2_HOSTED_REPLAY_HARNESS_OFFLINE_IMPLEMENTATION_RESULT_V1`

with verdict `BLOCKED_ENVIRONMENT`. Its only reported environment blocker was
the permission layer denying the fourteen required
`git diff --no-index --check` commands.

MacBook Codex then independently proved:

- all fourteen files parse with `node --check`;
- the exact seven-test `node --test` command passes `82/82`, zero failures;
- all fourteen no-index whitespace checks return expected exit `1` with zero
  output;
- `git diff --check` passes;
- exactly fourteen regular `100644` files exist under the authorized directory;
- no existing file, index entry, protected path, dependency, lockfile, migration,
  or application source changed; and
- no Supabase CLI, network, Hosted Supabase, DB, provider, Vercel, Auth, Storage,
  migration, stage, commit, push, Ready, merge, or deployment action occurred.

Those mechanical passes do not establish contract acceptance. MacBook Codex
found the seven defects in Section 4 and adjudicated the candidate
`CHANGES_REQUIRED`.

## 3. Frozen target, manifest, and protected metadata

The following accepted decisions remain unchanged:

- formal top-level migrations: `113`;
- future staged migrations: `112` in byte-sorted path order;
- sole exclusion:
  `supabase/migrations/20260801110110_line_link_tokens.sql`;
- aggregate 112-file manifest SHA-256:
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
- postal migration:
  `supabase/migrations/20260901001246_jp_postal_master.sql`;
- postal migration SHA-256:
  `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`;
- fixed project ref: `nqvnjqcxgngqsqkbpdfi`; and
- one hosted apply attempt with a single hard 30-minute overall deadline and
  no retry, repair, reset, deletion, or recreation.

Protected metadata remains:

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
   (`100644`, blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`);
2. `supabase/migrations/20260801110110_line_link_tokens.sql`
   (`100644`, blob `accd22345054cc44f89156fd78eaba6dfe4242a4`);
3. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
   (`100644`, blob `32fda49583ae1217bc13711784ad8fa31744726c`);
4. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
   (`100644`, blob `fe3c80f22fd80dcbfab076082473216dda582c14`).

Their contents must not be displayed, supplied, opened, read, diffed, copied,
transformed, modified, or newly hashed. The future repair receives metadata
only for these paths.

## 4. Rejected candidate defects and mandatory repairs

### R2A-01 — Exact manifest authority is not enforced

`preflight.mjs` calls `buildManifest()` but does not call
`verifyAggregateManifestHash()` or an equivalent fixed-identity verifier.
The candidate checks counts and selected identities but does not require the
complete accepted identity for every formal path. A syntactically valid
ordinary migration can replace a required migration while count remains 113.

Repair requirements:

1. Preflight must compare all 113 actual entries against one injected canonical
   accepted manifest metadata table. Each entry must match exact path, mode,
   and Git blob; every non-protected entry must also carry and match its accepted
   SHA-256.
2. Missing, extra, duplicate, substituted, nested, draft, seed, malformed, or
   reordered input must fail closed before command construction.
3. The LINE entry must match fixed mode/blob and be the sole exclusion.
4. The monthly-invoice entry must be validated only by fixed mode/blob and must
   never carry, calculate, or request a content SHA-256.
5. The configured accepted aggregate identity must equal the fixed
   `0d5414...d5bb` literal. The aggregate check must be wired into preflight;
   an exported but unused verifier is insufficient.
6. All hash and manifest authorities must be injected pure data/functions.
   No real Git, filesystem, migration content, or network access is permitted
   during tests.

### R2A-02 — Timeout does not stop the process

The current `Promise.race` returns a timeout result but does not abort,
terminate, or wait for the spawned child to exit. A real migration process
could continue changing the hosted database after the harness reports
quarantine.

Repair requirements:

1. The injected process contract must expose a cancellable handle or an
   injected abort signal/termination operation.
2. On deadline expiry, request termination and wait for confirmed process exit.
3. If termination or exit confirmation is uncertain, return
   `QUARANTINE_NO_RETRY`; never continue and never start another process.
4. Tests must prove that timeout calls termination exactly once and that no
   migration process remains logically running after the returned decision.

### R2A-03 — The 30-minute ceiling is duplicated

The list call and migration-up call each receive a new 1,800,000 ms timer,
allowing a sequence approaching 60 minutes.

Repair requirements:

1. One attempt-level deadline begins before the read-only list process.
2. List and migration-up share that deadline.
3. Migration-up receives only the remaining time.
4. When no positive time remains, migration-up is not spawned and the attempt
   is burned.

### R2A-04 — Sanitized child environment is not wired to spawn

`sanitizeEnvironment()` is tested in isolation, but command options contain
only `{ shell: false }`. The production adapter could therefore inherit the
full parent environment.

Repair requirements:

1. Build an explicit child `env` object from an injected environment source.
2. Reject `SUPABASE_PROJECT_ID`, `SUPABASE_DB_URL`, password-bearing variables,
   or every other environment authority forbidden by the CR6-R2 contract.
3. Pass only the accepted explicit environment object to both spawn calls;
   implicit parent-process inheritance is forbidden.
4. `validateExecutionOptions()` must require `shell: false` and the explicit
   sanitized `env` object.
5. Tests must prove forbidden parent values cannot reach either process.

### R2A-05 — Evidence adapter failures escape fail-closed handling

Volatile read, retention write/read, hashing, and deletion can reject or throw
outside the result contract.

Repair requirements:

1. Catch every injected adapter or hash exception.
2. Return `QUARANTINE_NO_RETRY` with a deterministic non-secret reason.
3. Do not delete any raw artifact until every retained redacted artifact has
   been written, read back, independently hash-verified, and secret-scanned.
4. A deletion failure must return quarantine and report raw-disposal state as
   uncertain; it must never claim finalization.

### R2A-06 — Retention identifiers permit unsafe or duplicate keys

`attemptId` and artifact names are only checked as non-empty strings. Path
separators, dot segments, and duplicate names can collide or escape a
filesystem-shaped retention namespace.

Repair requirements:

1. Accept only bounded identifiers matching a documented safe ASCII grammar.
2. Reject `/`, `\\`, `..`, empty segments, absolute paths, control characters,
   and duplicate artifact names or resulting retention keys.
3. Validate every descriptor before the first storage read or write.
4. Add hostile traversal, collision, duplicate, and control-character tests.

### R2A-07 — Invalid secret-scan input is reported clean

`scanForSecrets()` returns `{ clean: true }` for non-string input, and its test
asserts that contradictory behavior.

Repair requirements:

1. Non-string, missing, or otherwise unscannable input must fail closed with
   `clean: false` and a deterministic input error.
2. The paired test name and assertions must agree with fail-closed semantics.
3. Evidence finalization must treat any invalid scan result as quarantine.

### R2A-08 — Preflight target and adapter failures are not fail-closed

Preflight returns an arbitrary `input.projectRef` in the plan without directly
validating the fixed target. Git and filesystem adapter exceptions reject the
promise instead of returning a preflight failure.

Repair requirements:

1. Validate project ref `nqvnjqcxgngqsqkbpdfi` inside preflight before a
   successful plan can be returned.
2. Catch every Git/filesystem/path/clock/hash adapter exception and return
   `{ ok: false }` with deterministic non-secret errors.
3. Tests must prove wrong target and injected adapter rejection never produce
   a plan, construct a command, or spawn a process.

## 5. Exact repair write allowlist

A later separately authorized CR6-R2A repair may modify only these fourteen
existing files and may create no new source/test path:

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

No dependency, lockfile, migration, application source, fixture, snapshot,
governance document, generated artifact, or protected path may change during
the repair invocation.

## 6. Frozen pre-repair file identities

The future repair invocation must begin only if all fourteen candidate files
are regular `100644` files with these SHA-256 identities:

| Path suffix | SHA-256 |
|---|---|
| `manifest-core.mjs` | `df038ef3d230759fcfb49f636e723e894b6b36b09ad31e9cceab9b5f74ed10a8` |
| `manifest-core.test.mjs` | `573b8aafa54e8f4a5a7a9e06c9526af2bafb2d71f7868d775eb86338e49772ba` |
| `replay-command-core.mjs` | `f1624c919cb3a55ae1490e724874c33927923878e2cc600b537b9601296a5635` |
| `replay-command-core.test.mjs` | `206ac0631cd662c803216b38bde1e4da757ddb8498586be9d12741c54e3f2639` |
| `redaction-core.mjs` | `debfe16da781277415521d2f26f6b7475461638277ada177f7a32b49a893cfb0` |
| `redaction-core.test.mjs` | `f237e1a82a63230ed534393c0355de73b05189f333aed66142f33be967925789` |
| `quarantine-core.mjs` | `5c63cfe874546a838d0b0a46003f0e77b61d9c30f5745bdcdd1440d72262ca2d` |
| `quarantine-core.test.mjs` | `444b8f261d7db061c7b12c78cdcca423bf0739885a8edc81bdccd364cc442307` |
| `preflight.mjs` | `872044f53bfa315ae6b509aa581ce5ed8f95ec7913dbe9182e3dca4a2d952458` |
| `preflight.test.mjs` | `66393895f4eb0b2e25a2ef40b3098977efe9cef163986a5da9d060cf468a88c2` |
| `apply-once.mjs` | `ce666da78be9d5b47e69aa2727486f1ae116b8a523c3a582bbad31f874aca688` |
| `apply-once.test.mjs` | `2d4347f52355c88df6652e7baea4da08f9c3c8bfda0f1747e2b7f1b57f8420b9` |
| `finalize-evidence.mjs` | `031b80a92bcdfd21627f0a0cc22ef38160921f11503bebd11032a778ac2954fb` |
| `finalize-evidence.test.mjs` | `726402678434285aa876d8e46daf68e609bd915557ef8ac4ba0bbc232d8b3697` |

Any mismatch returns `BLOCKED_INPUT` before editing or testing. Because these
files are currently untracked, the later repair authorization must quote the
delivered CR6-R2A directive commit/tree and these fourteen exact pre-repair
hashes; Git HEAD alone is not their identity.

## 7. Exact future repair read boundary

After separate Owner authorization, Claude may receive exactly nineteen
repository files:

Control file — one:

1. this committed CR6-R2A directive.

Existing governance/support files — four:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2_HOSTED_REPLAY_HARNESS_OFFLINE_IMPLEMENTATION.md`

Candidate source/test files — fourteen:

- exactly the fourteen paths in Section 5.

The arithmetic is `1 + 4 + 14 = 19`. No other repository file, protected
content, migration content, environment file, secret, customer/business data,
provider log, or retained runtime evidence may be opened or transmitted.

## 8. Required offline verification

The future repair must run and report:

1. `node --check` on all fourteen exact `.mjs` files;
2. one `node --test` command naming the exact seven paired test files;
3. `git diff --check`;
4. fourteen literal
   `git diff --no-index --check /dev/null <path>` checks, accepting only exit
   `1` with zero output for a clean new file;
5. exact path/mode/SHA-256 comparison proving only the fourteen files changed
   relative to Section 6; and
6. metadata-only confirmation that all four protected blobs remain unchanged.

All original 82 tests must remain passing and new hostile regression tests must
cover every R2A repair. No minimum final test count is invented; the reported
count must equal the actual Node test result with zero fail, skip, todo, or
cancelled tests.

No real process, Supabase binary, DNS, network, Hosted Supabase, DB, provider,
Vercel, Auth, Storage, migration, Docker, Colima, package installation,
generated artifact, or external service is permitted.

## 9. Required result

The future Claude result must begin with:

`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R2A_OFFLINE_HARNESS_CONTRACT_REPAIR_RESULT_V1`

Allowed verdicts:

```text
PASS_OFFLINE_CANDIDATE_READY_FOR_CODEX_REAUDIT
CHANGES_REQUIRED
BLOCKED_INPUT
BLOCKED_ENVIRONMENT
```

The result must report:

- invocation directive commit/tree and actual branch/PR/upstream parity;
- exact nineteen-file read payload and fourteen-file write allowlist;
- pre-repair and post-repair mode/SHA-256 for every candidate path;
- one repair statement and one named hostile test for every R2A finding;
- literal commands, exit codes, pass/fail/skip/todo/cancel counts;
- exact changed paths and protected metadata confirmation;
- confirmation of zero real Supabase CLI or migration process, network,
  Hosted Supabase, DB, provider, Vercel, Auth, Storage, or migration action;
  offline Node verification processes must be reported separately; and
- confirmation that stage, commit, push, PR mutation, Ready, merge, deployment,
  cutover, and retirement did not occur.

The maximum successful next gate is independent MacBook Codex re-audit of the
unstaged fourteen-file candidate. A passing Claude result never authorizes Git
delivery or Hosted execution.

## 10. Prohibitions

The future repair must not:

- invoke `supabase` in any form, including `--version` or `--help`;
- start a real child process or access `process.env` directly in tests;
- weaken fixed target, 113/112 manifest, sole exclusion, aggregate identity,
  protected metadata, one-attempt, termination, or quarantine requirements;
- replace fail-closed behavior with logging, warning, retry, or operator choice;
- create a fifteenth source/test file;
- use Git add, commit, push, stash, restore, reset, clean, checkout, branch
  mutation, PR comment/state mutation, Ready, merge, or deployment; or
- contact or mutate Supabase, PostgreSQL, provider, Vercel, DNS, Auth, Storage,
  or any external service.

If a required repair or test cannot be completed inside this boundary, return
`BLOCKED_ENVIRONMENT` or `CHANGES_REQUIRED`; do not broaden scope.

## 11. Responsibility

- Owner: authorizes this documentation candidate and any later repair or Git
  delivery gate separately.
- MacBook Codex: owns this adjudication, literal-scope control, and independent
  re-audit.
- MacBook Claude: may perform one bounded repair only after separate Owner
  authorization quoting the delivered directive commit/tree.
- Studio and Android: no implementation role in this phase.

## 12. Next gates

Serial order:

1. independently audit this exact four-document governance candidate;
2. separately authorize literal-path stage and local commit;
3. separately authorize normal push to PR #67;
4. separately authorize one exact nineteen-file Claude repair invocation;
5. MacBook Codex independently re-audits the unstaged fourteen-file candidate;
6. only after acceptance, separately decide Git delivery; and
7. Hosted preflight/replay remains a later independent Owner gate.

## 13. Current documentation authoring allowlist

The current Owner authorization permits exactly these four documentation
paths:

1. this new directive;
2. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`;
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`; and
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`.

No other path may be modified by this authoring phase. The existing fourteen
untracked CR6-R2 candidate files must remain byte-identical to Section 6.
Stage, commit, push, Claude repair, executable tests, Supabase/DB/provider/
Vercel access, hosted preflight/replay, Ready, merge, deployment, cutover, and
retirement require later separate authorization.
