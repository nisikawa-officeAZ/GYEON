# Claude Directive — GDA Estimate Managed-Service Offering R1 Production R1 Restore Readiness Read-Only Diagnosis

## 1. Result identity

Return exactly one result headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_RESTORE_READINESS_READ_ONLY_DIAGNOSIS_RESULT_V1`

Allowed verdicts:

- `READY_FOR_R1_EXECUTION_GOVERNANCE`
- `CHANGES_REQUIRED_R1_PLAN`
- `BLOCKED_EVIDENCE`

This directive authorizes diagnosis only. The current invocation contract is
R1-A4 in section 7.3. It supersedes the failed R1-A3 Bash/session-environment
launcher in section 7.2. Except for the controller-owned input-bundle lifecycle
in section 3 and output transport logging in section 7.1, it authorizes no
file, Git, PR, provider, Supabase project, database, backup, runtime, or
deployment mutation.

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
