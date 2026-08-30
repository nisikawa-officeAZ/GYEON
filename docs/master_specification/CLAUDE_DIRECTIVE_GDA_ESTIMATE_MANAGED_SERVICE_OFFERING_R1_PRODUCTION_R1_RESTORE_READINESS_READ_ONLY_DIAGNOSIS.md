# Claude Directive — GDA Estimate Managed-Service Offering R1 Production R1 Restore Readiness Read-Only Diagnosis

## 1. Result identity

Return exactly one result headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_RESTORE_READINESS_READ_ONLY_DIAGNOSIS_RESULT_V1`

Allowed verdicts:

- `READY_FOR_R1_EXECUTION_GOVERNANCE`
- `CHANGES_REQUIRED_R1_PLAN`
- `BLOCKED_EVIDENCE`

This directive authorizes diagnosis only. Except for the exact
controller-owned transport logging in section 7.1, it authorizes no file, Git,
PR, provider, Supabase project, database, backup, runtime, or deployment
mutation.

## 2. Repository identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#47`, expected `OPEN` / `Draft`
- Branch: `plan/estimate-managed-service-production-forward-bridge-r1`
- Accepted E2/result-record predecessor: commit
  `998d17de891ca5c8b339f18288b6fd4416281d14`, tree
  `edec294889a063dacf18b8ed0108d922dd0af2bc`
- MacBook Codex must supply the exact committed governance execution HEAD and
  tree containing this directive.
- MacBook Codex must also supply a timestamped controller attestation for the
  repository identity and that PR `#47` is `OPEN` / `Draft`. Claude must record
  both as controller-attested rather than independently verified; this
  diagnosis does not authorize remote-URL inspection, GitHub, or network
  access.
- The committed delta from the predecessor to the execution HEAD must contain
  exactly the three governance paths recorded in the latest phase ledger.
- Required upstream ahead/behind at invocation: `0 0`

Stop with `BLOCKED_EVIDENCE` before content reads if identity, ancestry, exact
three-path governance delta, upstream state, or clean worktree/index differs.

## 3. Bootstrap and required first reads — exact order

Bootstrap exception: Claude may read this directive exactly once before the
identity gate solely to obtain its rules. Record that bootstrap read. It is not
the first substantive authority read and must not be repeated after the gate.

After all section 2 identity checks pass, read the following substantive
authorities in this exact order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. the latest accepted and pending entries in
   `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
5. `docs/master_specification/ENVIRONMENT_LEDGER.md`
6. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md`

## 4. Literal additional read allowlist

Read only these additional Git-tracked files:

1. `supabase/migrations/20260830121816_estimate_managed_service_production_forward_bridge.sql`
2. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/config.toml`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/setup.sh`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/capture-evidence.sh`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/cleanup.sh`

Do not open any other source, migration, test, harness, configuration, generated
artifact, runtime evidence, environment file, credential store, shell history,
or user file.

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

## 7. Permitted command discovery

Commands may be used only to prove repository identity, protected metadata,
and local CLI syntax. Every Supabase CLI command must set
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

The invoking controller must grant the command matcher for every exact command
above, including the literal `@{upstream}` ref and the exact `git diff-tree`
form. A tool-policy denial is evidence failure; do not request broader shell
access or silently substitute another command.

### 7.1 Controller-owned transport logging exception

To prevent result loss, MacBook Codex may create one fresh mode-700 directory
outside the Git worktree and exactly two mode-600 transport files within it:

- Claude JSON result;
- stderr capture.

Shell redirection into those two paths is controller-owned transport, not a
Claude file tool or repository mutation. Claude remains prohibited from every
file write. The result must separately report Claude-tool mutations as false
and controller transport artifacts as exactly two. The transport files must
contain no credentials, environment values, database rows, or protected-path
content; record their SHA-256 locally and retain or remove them only under the
controller's explicit cleanup decision.

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

- No Claude-tool file edit, creation, deletion, chmod, stage, commit, push, PR
  mutation, branch mutation, stash, restore, reset, or cleanup. The only file
  creation exception is the exact controller-owned transport logging contract
  in section 7.1; it grants no repository or evidence-content write.
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
2. repository/PR/HEAD/tree/upstream and protected metadata evidence;
3. exact files read and exact commands run with exit codes, distinguishing the
   controller-attested PR state from locally verified Git evidence;
4. Staging-only target-scope decision and Production deferral confirmation;
5. exact later backup/recovery-point proof contract;
6. exact encrypted rollback-artifact contract;
7. exact PostgreSQL 17 disposable restore-proof contract;
8. exact five-minute roles/decision procedure and unresolved owner decisions;
9. literal future allowlists, evidence schema, stop/cleanup/cost boundaries;
10. mutation matrix proving every prohibited class remained false, plus the
    exact count/mode/hash of controller-owned transport artifacts; and
11. the single precise next owner-approval question.

Stop after returning the result. Do not perform any future execution step.
