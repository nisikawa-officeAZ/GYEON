# Claude Directive — GDA Estimate Managed-Service Offering R1 Production R1 Restore Readiness Read-Only Diagnosis

## 1. Result identity

Return exactly one result headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_RESTORE_READINESS_READ_ONLY_DIAGNOSIS_RESULT_V1`

Allowed verdicts:

- `READY_FOR_R1_EXECUTION_GOVERNANCE`
- `CHANGES_REQUIRED_R1_PLAN`
- `BLOCKED_EVIDENCE`

This directive historically authorized the completed R1-A4 diagnosis under
section 7.3. R1-A4 superseded the failed R1-A3 Bash/session-environment
launcher in section 7.2. Its transport passed, but its READY verdict is rejected
and corrected by the documentation-only R1-A5 contract in section 11. No new
invocation is currently authorized. This document authorizes no file outside
the exact governance allowlist, Git, PR, provider, Supabase project, database,
backup, runtime, or deployment mutation.

## 2. Repository identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#47`, expected `OPEN` / `Draft`
- Branch: `plan/estimate-managed-service-production-forward-bridge-r1`
- Accepted E2/result-record predecessor: commit
  `998d17de891ca5c8b339f18288b6fd4416281d14`, tree
  `edec294889a063dacf18b8ed0108d922dd0af2bc`
- MacBook Codex must supply the exact committed governance execution HEAD and
  tree containing this directive.
- MacBook Codex must supply a timestamped controller attestation for the
  repository identity, exact committed source hashes, clean worktree/index,
  upstream `0 0`, protected metadata, and that PR `#47` is `OPEN` / `Draft`.
  Claude must record all of these as controller-attested rather than
  independently verified; the R1-A4 no-tool invocation does not authorize
  remote-URL inspection, GitHub, shell, file, or network access.
- The committed delta from the predecessor to the execution HEAD must contain
  exactly the three governance paths recorded in the latest phase ledger.
- Required upstream ahead/behind at invocation: `0 0`

Stop with `BLOCKED_EVIDENCE` before substantive analysis if the serialized
controller attestation reports a mismatch in identity, ancestry, exact
three-path governance delta, upstream state, clean worktree/index, protected
metadata, source hashes, excerpt manifest, or input-bundle hash.

## 3. Controller-built bounded input bundle — exact order

R1-A4 replaces Claude file-tool reads with one controller-built, immutable,
bounded plaintext bundle supplied on standard input. The bundle must be built
from the exact committed execution HEAD, not the working-tree copies. It must
serialize the following twelve private Git paths in this exact order and label
every full-file or line-range excerpt with the path, committed mode/blob,
full-source SHA-256, selection, and excerpt SHA-256:

1. this directive — full file;
2. `AGENTS.md` — full file;
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` — lines 899–1147;
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md` — line 3296 through
   end of file;
5. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
   — full file;
6. `docs/master_specification/ENVIRONMENT_LEDGER.md` — lines 1–130;
7. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md` — lines 1–214
   and 361–407;
8. `supabase/migrations/20260830121816_estimate_managed_service_production_forward_bridge.sql`
   — lines 1–70, 390–430, 620–720, 840–880, and 950–980;
9. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/config.toml` — full
   file;
10. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/setup.sh` — lines
    1–90, 110–230, 300–380, and 400–533;
11. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/capture-evidence.sh`
    — lines 1–120, 200–270, and 310–444; and
12. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/cleanup.sh` — lines
    1–90, 230–390, and 440–529.

The controller must fail closed if any requested range exceeds the committed
file length, a path is absent, a source hash differs from its preflight
manifest, or the final bundle contains fewer or more than twelve path blocks.
The bundle must precede the path blocks with the timestamped section 2
attestation and end with a fixed end-of-bundle sentinel. After the file is
finalized, the controller computes its byte count and SHA-256 and supplies
those two values in a short launcher prompt envelope outside the bundle file.
The bundle must never contain its own final hash. Claude receives the prompt
envelope and the bundle stream but never the bundle pathname.

The controller may create one fresh mode-700 input directory outside the Git
worktree and exactly one mode-600 input-bundle file inside it. This input root
must be different from the section 7.1 output transport root. Claude may
receive the bundle only through standard input and must not receive its path.
After Claude exits, the controller must delete that exact input file and
directory and prove both absent. The required post-run status is
`POST_RUN_CONTROLLER_INPUT_BUNDLE_CLEANUP_REQUIRED` until that proof is
complete. No input bundle may be retained, committed, posted to GitHub, or
reused.

## 4. Literal source allowlist represented in the input bundle

The following are the only additional Git-tracked sources represented by
bounded excerpts in section 3:

1. `supabase/migrations/20260830121816_estimate_managed_service_production_forward_bridge.sql`
2. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/config.toml`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/setup.sh`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/capture-evidence.sh`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/cleanup.sh`

Claude must not use file tools or open any source directly. Do not include any
other source, migration, test, harness, configuration, generated artifact,
runtime evidence, environment file, credential store, shell history, or user
file in the bundle.

## 5. Protected metadata-only paths

For these four paths, pathname, mode, blob hash, and clean Git status are the
only permitted evidence. Never open, read, diff, copy, hash filesystem content,
or derive content from them.

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
   - expected mode/blob: `100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
2. `supabase/migrations/20260801110110_line_link_tokens.sql`
   - expected mode/blob: `100644 accd22345054cc44f89156fd78eaba6dfe4242a4`
3. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
   - expected mode/blob: `100644 32fda49583ae1217bc13711784ad8fa31744726c`
4. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
   - expected mode/blob: `100644 fe3c80f22fd80dcbfab076082473216dda582c14`

## 6. Active R1 target and fixed boundary

- Immediate target: Staging `DealerOS-Dev-Next`
- Exact project ref: `vhiuiwolnlvlwvoaingd`
- Region: `ap-northeast-1`
- Production ref `dmvyaykhibmphrmekjbb` is identity reference only. Fresh
  Production backup/PITR evidence belongs to R6, immediately before the
  Production change window.
- R1 authorizes no schema write, migration apply, migration-history repair,
  project creation, backup restore, rollback execution, or shared-environment
  fixture.

## 7. Controller-only command discovery

R1-A4 grants Claude no tools and no command execution. The controller may use
the following read-only local commands only to create and attest the input
bundle. Every Supabase CLI help command must set
`SUPABASE_TELEMETRY_DISABLED=1`.

Permitted categories:

- `pwd`
- `git rev-parse HEAD` and `git rev-parse HEAD^{tree}`
- `git status --porcelain`
- `git rev-list --left-right --count HEAD...@{upstream}`
- `git rev-list <predecessor>..HEAD` and its `--count` form
- `git diff-tree --no-commit-id --name-only -r <predecessor> HEAD` solely to
  prove the exact three-path governance delta
- `git ls-tree -r HEAD -- <four protected paths>` for protected metadata only
- SHA-256 of files in sections 3 and 4 only
- `command -v` for `age`, `gpg`, `openssl`, and `security`
- version/help output for detected encryption tools only
- `supabase --version`
- `supabase --help`
- `supabase projects list --help`
- `supabase backups --help`
- `supabase backups list --help`
- `supabase backups restore --help`
- `supabase db dump --help`

The help output is syntax evidence only. Do not execute `projects list`,
`backups list`, `backups restore`, `db dump`, `db query`, `link`, or any command
that contacts a project, database, provider, or network service.

The controller must serialize relevant command output, command text, and exit
code into the bundle. Claude must distinguish all such evidence as
controller-attested. A controller command denial or nonzero result is evidence
failure; do not request broader shell access or silently substitute another
command.

### 7.1 Controller-owned transport logging exception

To prevent result loss, MacBook Codex may create one fresh mode-700 directory
outside the Git worktree and exactly two mode-600 transport files within it:

- Claude JSON result;
- stderr capture.

Shell redirection into those two paths is controller-owned transport, not a
Claude file tool or repository mutation. Claude remains prohibited from every
file write. At invocation, MacBook Codex supplies the fresh transport root,
the two filenames, and their required modes as controller attestation. Claude
must report:

- Claude-tool mutations are false;
- controller transport artifact count is expected to be exactly two;
- directory mode is expected `700` and both file modes are expected `600`;
- final artifact hashes are `POST_RUN_CONTROLLER_VERIFICATION_REQUIRED`.

Claude must not attempt to inspect, read, hash, or self-hash the transport
files. A result file cannot contain its own final SHA-256 without changing that
hash.

After Claude exits, MacBook Codex independently verifies exactly two files,
their final modes, byte counts, SHA-256 values, process exit status, and empty
or captured stderr. Those post-run values form a separate controller evidence
record and are not fields Claude can know while generating the result. The
transport files must contain no credentials, environment values, database
rows, or protected-path content; retain or remove them only under the
controller's explicit cleanup decision.

### 7.2 Exact ephemeral Claude CLI Bash session-environment exception

Historical R1-A3 contract only. It is superseded and prohibited for the R1-A4
invocation because Claude receives `--tools ""` and must not invoke Bash. Do not
create, grant, inspect, or delete any R1-A4 session-environment UUID path. If a
new session-environment path is created during R1-A4, reject the result as
`BLOCKED_EVIDENCE`, clean it only under a separately verified exact-path
controller decision, and burn that invocation.

The prior UUID and its lifecycle are recorded in the phase ledger only. They
are not inputs, evidence artifacts, or reusable authority for R1-A4. The
section 7.1 output transport remains exactly two files and no
session-environment artifact may be counted with it.

### 7.3 R1-A4 one-turn no-tool diagnosis contract

The exact R1-A4 launcher contract is:

- one fresh invocation, no reused session ID or failed runtime;
- the section 3 mode-600 input bundle supplied on standard input, with its
  final byte count and SHA-256 supplied only in the external launcher prompt
  envelope;
- `--print`, `--input-format text`, and `--output-format json`;
- `--tools ""`, `--no-session-persistence`, `--safe-mode`,
  `--disable-slash-commands`, and `--no-chrome`;
- no MCP server, file tool, Bash tool, web tool, background task, or subagent;
- reasoning effort `medium` and maximum model budget `$2.00`;
- one final response only, no exploratory tool turns; and
- concise output, no source reproduction, with a target ceiling of 6,000
  words.

Claude must analyze only the serialized bundle. It must not ask to read more
files, repeat source excerpts, or treat omitted portions as inspected. Any
claim about repository, PR, CLI syntax, protected metadata, or file integrity
must be labelled controller-attested. Any conclusion requiring omitted source
content must be listed as an unresolved evidence requirement rather than
inferred.

The `$2.00` limit is a hard stop, not acceptance evidence. If the process exits
for budget, timeout, missing marker, missing verdict, tool access, extra
transport artifacts, or session-environment creation, classify the run as
failed and do not raise the budget without a new governance decision.

## 8. Required diagnosis

### 8.1 Backup and recovery-point proof

Return the exact later read-only commands and expected evidence fields needed
to prove:

- the exact Staging project identity and health;
- whether daily physical backups or PITR is active;
- earliest and latest recoverable UTC timestamps where applicable;
- the latest completed recoverable point;
- backup identifiers/statuses without exposing credentials; and
- whether CLI output alone is sufficient or a bounded Management API GET is
  required.

Do not use a project tier name as proof. Do not invoke restore. Distinguish a
listed backup from a successfully restored backup.

### 8.2 Encrypted rollback artifact

Define exact later read-only SQL for
`public.save_estimate_from_wizard(uuid,uuid,jsonb)` that captures:

- `pg_get_functiondef` and canonical `prosrc`;
- owner, language, volatility, parallel mode, and `SECURITY INVOKER` identity;
- complete ACL and `search_path`; and
- exact signature.

Select an encryption approach only from locally detected tools. The decryption
secret must be stored separately from the encrypted artifact, never printed,
never passed in process arguments if avoidable, and never committed. Define
mode-700 evidence roots, mode-600 artifacts, SHA-256 before/after encryption,
redacted manifest fields, and cleanup.

### 8.3 PostgreSQL 17 disposable restore proof

Define the smallest fresh local-only proof that:

1. uses PostgreSQL 17;
2. starts from a fresh unique runtime outside the worktree and
   `/private/tmp`;
3. replays only eligible repository migrations while excluding the protected
   LINE migration;
4. restores the decrypted captured Staging function definition;
5. verifies exact function definition/body, owner, security mode, search path,
   language, volatility, parallel mode, ACL, and signature;
6. proves the restored function can be replaced back to the accepted bridge
   body without changing unrelated objects;
7. records raw evidence plus a manifest, independently verifies retained
   hashes, proves zero fixture residue, stops containers, and removes the exact
   runtime; and
8. burns any failed suffix without repair or reuse.

State whether the existing FB harness can be reused without editing or whether
a future literal new-path allowlist is required. Do not design a shared or
hosted restore test.

### 8.4 Five-minute decision and authority contract

Return a five-minute rollback decision sequence with separate roles for:

- operator;
- verifier;
- stop authority; and
- rollback authority.

Do not invent human names. Identify every unresolved owner decision. Conditional
rollback execution requires a separate explicit pre-authorization and an exact
hash-bound artifact; R1 diagnosis does not grant it.

### 8.5 Future execution contract

Return literal future read/write allowlists, exact command classes, evidence
schema, timeouts, stop conditions, cleanup, cost boundary, and the precise next
owner approval question. Separate:

1. provider/backup read-only verification;
2. encrypted Staging function capture;
3. local disposable restore proof;
4. result recording and Git delivery; and
5. conditional rollback pre-authorization.

## 9. Absolute prohibitions

- No Claude tool of any kind. No file edit, creation, deletion, chmod, stage,
  commit, push, PR mutation, branch mutation, stash, restore, reset, or
  cleanup. The only file lifecycle exceptions are the controller-owned
  single-file input bundle in section 3 and two-file output transport in
  section 7.1; neither grants repository, credential, session-environment, or
  general `.claude` write authority.
- No private evidence transmission beyond the approved read allowlist.
- No credential, token, password, JWT, connection string, environment file,
  shell history, Keychain secret, or dashboard-session read.
- No provider/Supabase project listing, backup listing, database query, dump,
  link, restore, project creation, migration apply, history repair, or fixture.
- No PostgreSQL, Supabase, Docker, Colima, Auth, PostgREST, RPC, concurrency,
  test, typecheck, build, browser, deployment, Staging write, Production action,
  or rollback execution.
- No web search or fetch. Use only the Git-tracked authorities and local help
  output.
- No subagent and no persistent session.
- Do not mark PR #47 Ready, merge, or deploy.

## 10. Required result schema

Return:

1. result identity and one allowed verdict;
2. controller-attested repository/PR/HEAD/tree/upstream, protected metadata,
   source/excerpt manifest, and input-bundle hash evidence;
3. exact twelve path blocks and selections represented in the bundle, plus
   exact controller commands and exit codes; do not claim direct file or shell
   access;
4. Staging-only target-scope decision and Production deferral confirmation;
5. exact later backup/recovery-point proof contract;
6. exact encrypted rollback-artifact contract;
7. exact PostgreSQL 17 disposable restore-proof contract;
8. exact five-minute roles/decision procedure and unresolved owner decisions;
9. literal future allowlists, evidence schema, stop/cleanup/cost boundaries;
10. mutation matrix proving every prohibited class remained false, plus the
    controller-attested expected output transport count/modes, the literal
    output hash status `POST_RUN_CONTROLLER_VERIFICATION_REQUIRED`, no
    session-environment path, and the literal input cleanup status
    `POST_RUN_CONTROLLER_INPUT_BUNDLE_CLEANUP_REQUIRED`; and
11. the single precise next owner-approval question.

Stop after returning the result. Do not perform any future execution step.

MacBook Codex must append its separate post-run output transport verification,
input-bundle deletion/absence proof, and zero session-environment creation
proof before accepting any verdict. No Claude verdict is accepted from an
unverified or extra-file transport directory, retained input bundle, any new
session-environment path, missing marker/verdict, budget stop, or tool use.

## 11. R1-A5 Codex acceptance corrections

R1-A4 transport and invocation mechanics passed, but its reported verdict
`READY_FOR_R1_EXECUTION_GOVERNANCE` is not accepted. MacBook Codex classifies
the diagnosis content as `CHANGES_REQUIRED_R1_PLAN`. This section supersedes
the incomplete portions of that result. It is a documentation-only correction
and grants no provider, Supabase, database, backup, restore, runtime, Git, PR,
Staging, Production, or rollback action.

### 11.1 R1-A4 evidence disposition

- Committed execution HEAD:
  `735278778107a7b28e1d6d25313da387388093dd`; tree:
  `56fe9c00b38aa3f28379d921fef616adff8cb122`.
- Published non-triggering instruction:
  `https://github.com/nisikawa-officeAZ/GYEON/pull/47#issuecomment-5469291428`.
- Input bundle: 12 exact path blocks, 273,162 bytes, SHA-256
  `3d347c3371f77816f1f121070418e7537395012c0c4165d9a4a70a1f1517c8e2`;
  the exact input root was deleted and proved absent after the run.
- Claude completed one no-tool turn in 51,277 ms for `$0.8820647`. The result
  transport was 9,787 bytes with SHA-256
  `970805499f833e8315bc34bcb747d620e5253cd09c135b5f6110bf7e94da352a`;
  stderr was empty. The required marker occurred exactly once.
- The session-environment pathname set remained unchanged: child count `291`
  and pathname-set SHA-256
  `b6fff36d94516937ebddbcec412047daaf1cb3c146978e133bc054bf317ef308`
  before and after the run.
- No repository, protected blob, Git, PR, provider, database, runtime, or
  deployment mutation occurred. The two-file output root remains private
  evidence and is not a reusable action authority.

### 11.2 Exact five-minute decision procedure

The owner must map four distinct people or accountable roles before R1
execution. No human name is inferred. Stop Authority and Rollback Authority
must remain separate unless the owner explicitly approves a named exception.

| Deadline | Accountable role | Required action |
|---|---|---|
| `T+00:00` | Operator | Freeze the R1 action; record exact target ref, observed failure, execution HEAD, artifact hash, and last successful boundary. Run nothing further. |
| `T+00:30` | Verifier | Independently compare target ref, HEAD/tree, artifact hash, protected metadata, and preflight evidence with the accepted manifest. |
| `T+01:30` | Operator | Provide only the already-authorized bounded read-only outputs; do not gather new data outside the manifest. |
| `T+02:30` | Verifier | Return `PASS_EXACT_MANIFEST` or `FAIL_STOP` against the literal rollback triggers. Any uncertainty is `FAIL_STOP`. |
| `T+03:00` | Stop Authority | Choose only `CONTINUE_STOPPED` or `ESCALATE_ROLLBACK_REVIEW`; silence means `CONTINUE_STOPPED`. |
| `T+03:30` | Rollback Authority | Verify separate pre-authorization, exact target ref, exact ciphertext/plaintext hashes, role separation, and communication readiness. Any missing item is `DENY`. |
| `T+04:30` | Rollback Authority | Issue a recorded `APPROVE_EXACT_HASH` or `DENY`. Approval must bind the exact artifact hash and one target ref. |
| `T+05:00` | Operator | If and only if the exact approval exists, stop and wait for the separately authorized rollback-execution gate. Otherwise remain stopped. Do not execute rollback in this decision window. |

The entire decision window is exactly 300 seconds. It decides whether to seek
the separately authorized rollback-execution gate; it never executes rollback.

### 11.3 Exact provider identity and backup proof contract

The later provider read-only gate may use only these exact command classes for
Staging ref `vhiuiwolnlvlwvoaingd`:

```text
SUPABASE_TELEMETRY_DISABLED=1 supabase projects list --output-format json
SUPABASE_TELEMETRY_DISABLED=1 supabase backups list --project-ref vhiuiwolnlvlwvoaingd --output-format json
```

If CLI output is insufficient, the only Management API fallbacks are:

```text
GET https://api.supabase.com/v1/projects/vhiuiwolnlvlwvoaingd
GET https://api.supabase.com/v1/projects/vhiuiwolnlvlwvoaingd/database/backups
```

The bearer token must be supplied only in an `Authorization` header from a
separate secret source. It must never appear in a command argument, output,
manifest, Git diff, or PR comment. Accept the project identity response only if
`ref`, `name`, `region`, `status`, and database version/engine/release-channel
fields are present and match the canonical ledger. Accept backup evidence only
if `region`, `walg_enabled`, `pitr_enabled`, every backup `id`,
`is_physical_backup`, `status`, and `inserted_at`, plus the earliest/latest
physical recovery-point timestamps when returned, are captured and redacted.

The service-health endpoint is not placed on the executable allowlist because
the locally available official reference does not expose the accepted
`services` enum values. Project `status` is the bounded provider-status proof.
A future health-endpoint call requires a new exact query contract after the
enum is independently confirmed; it must not be guessed.

Official references:

- `https://supabase.com/docs/reference/api/v1-list-all-backups`
- `https://supabase.com/docs/guides/platform/backups`
- `https://supabase.com/docs/reference/api/getting-started`

### 11.4 Exact live-function capture contract

Supabase CLI `2.116.0` locally confirms support for `supabase db query`. The
R1-C1 parser stop proved that explicit `--project-ref` is accepted only when
paired with `--linked`. The corrected later capture gate may therefore use
only:

```text
SUPABASE_TELEMETRY_DISABLED=1 supabase db query --linked --project-ref vhiuiwolnlvlwvoaingd --file <exact-mode-600-read-only-sql-file> --output-format json
```

The SQL file must be inside a fresh mode-700 evidence root outside Git. It must
set `statement_timeout = '15000ms'` and `lock_timeout = '3000ms'`, perform only
catalog/function-definition reads for the exact signature
`public.save_estimate_from_wizard(uuid,uuid,jsonb)`, and contain no DDL, DML,
transactional write, helper creation, or credential. The command has one
attempt and a 30-second controller wall-clock deadline.

`--linked` is only the CLI target-selection mode required by this command. It
does not authorize `supabase link` and must not create or rely on
`supabase/.temp/project-ref`. Before and after the command, the controller must
prove that exact path absent. If it exists at either boundary, stop without
reading it, do not run the query, and require a new governance decision.

### 11.5 Exact encryption, timeout, and cleanup contract

Local discovery is corrected as follows:

- present: `/opt/homebrew/bin/gpg`, `/opt/homebrew/bin/gpg-agent`,
  `/opt/homebrew/bin/openssl`, `/usr/bin/security`, and `/bin/rm`;
- absent: `age` and `shred`;
- selected encryption implementation: OpenSSL `3.6.3`, AES-256-CBC with
  PBKDF2, a fresh salt, and at least 310,000 iterations.

The passphrase is obtained from a separate secret source and passed on standard
input; it is never stored in Git, printed, logged, or placed in process
arguments. The plaintext capture exists only as a mode-600 file in a fresh
mode-700 encrypted-at-rest evidence root. After ciphertext creation, plaintext
and ciphertext SHA-256 verification, and a successful decrypt-and-compare
check, delete the exact plaintext with `/bin/rm` and prove it absent. Do not
claim secure overwrite: APFS and SSD behavior makes `/bin/rm` an unlink, not a
cryptographic erasure guarantee. The safety control is encrypted storage plus
the shortest possible plaintext lifetime.

Literal deadlines and retries:

| Class | Deadline | Retry rule |
|---|---:|---|
| Each provider CLI/API read | 30 seconds | At most one retry for HTTP 429 or 5xx only; no retry for 401, 403, identity mismatch, or response-shape mismatch |
| Whole provider/backup gate | 120 seconds | Stop when exhausted |
| Live-function SQL capture | 30 seconds; SQL statement 15 seconds; lock 3 seconds | One attempt only |
| Encryption or decrypt-compare | 60 seconds each | One attempt only |
| Hash verification | 30 seconds | One attempt only |
| Fresh local PostgreSQL 17 setup | 900 seconds | Failed suffix is burned |
| Local restore and verification | 300 seconds | No same-runtime repair or retry |
| Local cleanup and zero-residue proof | 300 seconds | Cleanup failure is terminal |
| Whole local disposable gate | 1,800 seconds | Stop when exhausted |
| Rollback authority decision | 300 seconds | No implied approval at timeout |

### 11.6 R1-A5 decision and next gate

The accepted result is
`R1_A4_TRANSPORT_PASS_CONTENT_CHANGES_REQUIRED_R1_PLAN`. R1 execution is not
ready. The only current authority is authoring and verifying these exact three
governance-document corrections. Stage, local commit, normal push, revised PR
instruction, private retransmission, Claude rerun, provider read, database
capture, encrypted artifact creation, disposable restore, rollback approval or
execution, Ready, merge, history repair, Staging/Production write, and
deployment each remain separate and unauthorized.

## 12. R1-C1-A1 capture-command correction

The first owner-approved R1-C1 attempt used the incomplete R1-A5 command class
without `--linked`. Supabase CLI stopped locally with
`LegacyDbQueryMutuallyExclusiveFlagsError` before a database query or function
capture occurred. This is a command-contract failure, not a Staging database
failure.

### 12.1 Burned attempt evidence

- Execution HEAD remained
  `574f121cc847a98b475c538da41bec1543c25dce`; upstream remained `0 0`.
- Burned suffix: `DJ4eiW`; it must never be reused.
- Retained private failure root:
  `/private/tmp/gda-r1-c1-evidence.DJ4eiW`, mode `700`.
- Read-only SQL: 1,212 bytes, mode `600`, SHA-256
  `41bca71643c96dc1de22493304714466edaf534f8988fea04bcc59ac4ddf45a3`.
- Error JSON: 198 bytes, mode `600`, SHA-256
  `d40dd920a87a9775bcbec99574229e776509ae6555d0a53dcea697303ed0cfa2`.
- Stderr: 0 bytes, mode `600`, SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- No function definition or body was captured. No encryption artifact was
  created. The unused secret and exact secret root
  `/private/tmp/gda-r1-c1-secret.ZAipsZ` were deleted and proved absent.
- `supabase/.temp/project-ref` was absent before correction authoring. Git and
  all four protected blobs remained unchanged.

### 12.2 Fresh retry preconditions

A future retry requires a separate owner authorization and all of the
following:

1. a fresh unused suffix, fresh mode-700 evidence root, and separate fresh
   mode-700 secret root;
2. the corrected literal command from section 11.4 with both `--linked` and
   exact `--project-ref vhiuiwolnlvlwvoaingd`;
3. `supabase/.temp/project-ref` absent before and after the command, with no
   `supabase link` invocation;
4. the exact same mode-600 read-only SQL body or a separately hash-accepted
   replacement;
5. one attempt, 30-second controller deadline, no same-suffix repair or retry;
6. zero function/body output to terminal, Git, PR, or conversation; and
7. encryption, decrypt-and-compare, plaintext unlink, hash, and absence proof
   only after a successful exact-one-row capture.

R1-C1-A1 authoring does not authorize the fresh retry, stage, commit, push, PR
comment, private transmission, Claude invocation, provider listing, database
query, encryption, restore, rollback, Ready, merge, history repair,
Staging/Production write, or deployment.

## 13. R1-C1 successful capture and R1-C2 local restore result

After the R1-C1-A1 correction was committed and normally pushed, the owner
separately authorized one fresh R1-C1 retry and then one local disposable
restore proof. These execution results supersede only the stale future-action
language in section 12.2; the burned `DJ4eiW` attempt remains immutable
failure evidence.

### 13.1 R1-C1 fresh encrypted capture

- Execution HEAD/tree remained
  `c8dd6ca259a8402d1537e1d509fbe39a88751199` /
  `e014e8bd978858085df0680d246bfda8fed2af49`; upstream remained `0 0` and
  the worktree/index remained clean.
- Fresh suffix `I7kjNs` used the corrected section 11.4 command exactly once.
  The query exited `0` and returned exactly one
  `public.save_estimate_from_wizard(uuid,uuid,jsonb)` candidate.
- The captured object was PostgreSQL `plpgsql`, owner `postgres`, volatility
  `v`, parallel mode `u`, `SECURITY INVOKER`, pinned
  `search_path=pg_catalog, public, pg_temp`, and explicit EXECUTE only for
  `postgres` and `service_role`.
- Captured canonical-body SHA-256 was
  `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136`;
  captured function-definition SHA-256 was
  `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a`.
- Plaintext capture SHA-256 was
  `33096a6f5fc295071b8bb06d6ebcf293febd187f25aa04bb8adc9ba19e15edda`.
  OpenSSL AES-256-CBC/PBKDF2 encryption and decrypt-and-compare passed;
  ciphertext SHA-256 was
  `7222922b30d80139967750c2a9fbb91e8aff22ae1dc2bb6e253bc75be642cb4c`.
  The exact plaintext was unlinked and proved absent.
- The mode-700 capture root is
  `/private/tmp/gda-r1-c1-evidence.I7kjNs`; its mode-600
  `SHA256SUMS.txt` SHA-256 is
  `52602a3d00fbc73cb0627e99542f25f19703a42b1716df617eeb9f2a47ec63d3`.
  The mode-700 secret root remains separate, contains one mode-600 secret,
  and no secret value or function body is recorded in Git.
- `supabase/.temp/project-ref` remained absent. No Staging write, provider
  write, Git write, restore, or rollback occurred in R1-C1.

### 13.2 R1-C2 PostgreSQL 17 disposable restore proof

- Fresh suffix `20260830T150757Z-a23e1a` used PostgreSQL `17.6` in a
  loopback-only runtime outside the worktree and `/private/tmp`.
- All `112` eligible migrations replayed successfully; the one protected LINE
  migration remained excluded and unopened. There were zero failed or
  not-reached migrations.
- The encrypted Staging definition was streamed directly into the local
  database without retaining a plaintext function-definition file. Exact
  definition/body hashes, signature, owner, language, volatility, parallel
  mode, `SECURITY INVOKER`, search path, ACL, strictness, leakproof state, and
  return contract all matched the R1-C1 capture.
- Reapplying the accepted forward-bridge migration restored body SHA-256
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`;
  before/after bridge metadata was byte-identical.
- The unrelated catalog fingerprint remained
  `1a28975fc6638456fceec60be6baade181fa8e1bc07b02fdb09788e20f32c985`
  before old-definition restore, after old-definition restore, and after
  bridge replacement. Fixture residue was zero.
- The retained mode-700 evidence root is
  `/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-r1-restore-evidence/gda-estimate-offering-r1-restore.20260830T150757Z-a23e1a`.
  Its `manifest.json` SHA-256 is
  `f277d06059a7f4751d4f270f2886ec7e469ef0c90b9765f46a99cb1b6388bb8c`
  and `SHA256SUMS.txt` SHA-256 is
  `a5228d0b0a9c9a8e8ee0b616cd1eff60c98d7f10c25cdd248d26f7b5ebdd3a13`;
  independent retained-hash verification passed.
- The exact disposable runtime was stopped and removed. Matching containers
  and volumes were both zero. Colima was already running and was not stopped
  by this gate.
- No hosted Supabase, shared Staging/Production database, provider, Git, PR,
  migration-history, Ready, merge, deployment, or shared rollback action was
  performed by R1-C2.

### 13.3 Result-record boundary

R1-C1 capture and R1-C2 local restoration are technically proven, but R1 is
not yet durable rollback readiness. The only encrypted function artifact and
its separately stored decryption secret currently remain under
`/private/tmp`. That location may be cleared by reboot or operating-system
cleanup. The durable retained R1-C2 evidence root proves the test result but
does not itself contain the encrypted rollback function or its secret.

Before conditional rollback pre-authorization, a separate R1-C2A owner gate
must copy the ciphertext into a durable mode-700 Git-external custody root,
place the decryption secret in a different durable protected location, verify
the copied ciphertext hash, decrypt-and-compare without retaining plaintext,
record custody metadata without secret values, and only then decide whether
the transient `/private/tmp` copies may be removed. R1-C2A file copy, secret
custody, verification, and transient deletion are not authorized by this
result-record candidate.

The owner authorized only this exact-three-document result-record candidate.
Stage, local commit, normal push, PR result publication, conditional rollback
pre-authorization or execution, R2 Staging preflight, schema/history write,
Ready, merge, deployment, and every Production action remain separate and
unauthorized.
