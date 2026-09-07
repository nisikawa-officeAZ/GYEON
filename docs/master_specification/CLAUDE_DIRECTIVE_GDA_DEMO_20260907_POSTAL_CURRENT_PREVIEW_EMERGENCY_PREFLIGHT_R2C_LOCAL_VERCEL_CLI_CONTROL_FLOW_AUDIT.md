# CLAUDE DIRECTIVE — GDA DEMO 20260907 POSTAL CURRENT PREVIEW EMERGENCY PREFLIGHT R2C LOCAL VERCEL CLI CONTROL FLOW AUDIT

## 0. Status and authority boundary

This document is an **uncommitted governance candidate** authored by MacBook
Codex after the Owner-authorized R2B failure classifier returned
`CHANGES_REQUIRED_UNKNOWN_FAILURE` for one `vercel curl` process with exit code
`1` and category `UNKNOWN_REDACTED`.

R2C performs a local static audit of the installed Vercel CLI `54.17.3` only.
It determines which control-flow branch the exact R2B command enters, why an
unlinked repository-external temporary directory can produce exit code `1`,
and why the R2B classifier did not recognize the result. It does not rerun
`vercel curl`, contact Vercel, derive a Supabase ref, or change any system.

This document does not authorize execution by itself. After independent
review, an exact three-document governance commit, normal push, one
non-triggering PR instruction, and separate Owner authorization, MacBook
Claude may execute one R2C local-only static audit.

This directive does **not** authorize:

- any network-capable GitHub, Vercel, Supabase, database, browser, MCP, DNS,
  HTTP, TLS, socket, curl, wget, API, deployment, application-endpoint, Staging,
  or Production request;
- any `vercel` CLI process, including `vercel curl`, `vercel api`, `vercel link`,
  `vercel pull`, `vercel env`, `vercel deploy`, `vercel inspect`, `vercel list`,
  `vercel whoami`, `vercel project`, `vercel logs`, `vercel traces`, direct
  `curl`, or any command that may contact a provider;
- reading Vercel credentials, global config, `.vercel`, environment values,
  browser profiles, cookies, shell history, Claude settings, tokens, keys,
  secrets, passwords, protection-bypass values, or prior raw R2B output;
- application source, migration, test, dependency, lockfile, customer, vehicle,
  estimate, OCR, address, postal, or database-row access;
- any edit, formatting rewrite, dependency install, Git stage, commit, push,
  PR comment, Ready conversion, merge, deployment, migration, import, or retry;
  or
- treating a future full-URL command as authorized merely because static code
  inspection identifies it as a candidate alternative.

## 1. Fixed repository identity and consumed R2B result

```yaml
phase: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2C_LOCAL_VERCEL_CLI_CONTROL_FLOW_AUDIT
mode: LOCAL_STATIC_READ_ONLY_ONE_TIME_AFTER_SEPARATE_OWNER_AUTHORIZATION
repository: nisikawa-officeAZ/GYEON
pull_request: 67
pull_request_url: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state: OPEN
pull_request_draft: true
base: main
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_pre_governance_parent: 60ec89a8cd9ce5bfc8321fa2ea6755081b9df3ef
fixed_pre_governance_parent_tree: fd6c2f1b3e77ec21e59ea54389c06e4da21a4dac
fixed_pre_governance_parent_parent: df3320738883dd3e96fea3c68f67fa8eb897443a
required_execution_head: DERIVED_SINGLE_DIRECT_CHILD_OF_FIXED_PRE_GOVERNANCE_PARENT
required_execution_delta: EXACT_THREE_GOVERNANCE_PATHS_ONLY
exact_governance_delta_paths:
  - docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2C_LOCAL_VERCEL_CLI_CONTROL_FLOW_AUDIT.md
  - docs/master_specification/GYEON_DA_COMPLETION_PLAN.md
  - docs/master_specification/GYEON_DA_PHASE_RESULTS.md
claude_code_version: 2.1.226
vercel_cli_version: 54.17.3
r2b_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_VERCEL_CURL_FAILURE_CLASSIFICATION_RESULT_V2B
r2b_verdict: CHANGES_REQUIRED_UNKNOWN_FAILURE
r2b_vercel_curl_process_count: 1
r2b_exit_code: 1
r2b_category: UNKNOWN_REDACTED
r2b_timed_out: false
r2b_output_limit_exceeded: false
r2b_raw_stdout_emitted_or_persisted: false
r2b_raw_stderr_emitted_or_persisted: false
r2b_secrets_emitted: false
r2b_vercel_mutations_or_deployments: 0
r2b_supabase_or_database_contacts: 0
r2b_git_mutations: 0
r2b_retries: 0
r2c_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_LOCAL_VERCEL_CLI_CONTROL_FLOW_RESULT_V2C
```

R2B used a relative path with `--deployment`, `--scope`, `--non-interactive`,
and `--cwd` pointing to a fresh unlinked mode-0700 temporary directory. It did
not use `--yes`. Its classifier included link/auth/protection/deployment/usage/
network signatures but did not include the CLI's structured
`confirmation_required` / `requires confirmation` outcome.

## 2. Exact installed CLI artifacts

R2C may read only the following four Homebrew-installed Vercel CLI artifacts,
and only after their mode, size, and SHA-256 match exactly:

```yaml
artifacts:
  - path: /opt/homebrew/Cellar/vercel/54.17.3/libexec/lib/node_modules/vercel/package.json
    mode: -rw-r--r--
    size: 6621
    sha256: fb448f67d81f0f919914d1dd022cc03d728d3cff20c8942477828a7de5ab417c
  - path: /opt/homebrew/Cellar/vercel/54.17.3/libexec/lib/node_modules/vercel/dist/commands-bulk.js
    mode: -rw-r--r--
    size: 1815233
    sha256: a96b4eec9833cd96162d099a492902804ba135e927247c09296abd50d71e6f64
  - path: /opt/homebrew/Cellar/vercel/54.17.3/libexec/lib/node_modules/vercel/dist/chunks/chunk-QMMMXYOY.js
    mode: -rw-r--r--
    size: 2804
    sha256: 823ad77096fa1eb47ca423eb3c966a24897a3bdb170d6a18b9462a6a8bc79427
  - path: /opt/homebrew/Cellar/vercel/54.17.3/libexec/lib/node_modules/vercel/dist/chunks/chunk-FMBDRMTZ.js
    mode: -rw-r--r--
    size: 49750
    sha256: 4d388040cdf9719e328aad297cf63d9a301857a53ef54bf11e98aee28ad964ed
```

`commands-bulk.js` may be searched only for these local function/marker names
and only matching bounded surrounding lines may be read:

- `parseCurlLikeArgs`
- `getFullUrlAndToken`
- `getDeploymentUrlAndToken`
- `runCurl`
- `ensureLink`
- `This command requires a linked project`
- `No deployment found for ID`
- `Failed to get deployment protection bypass token`

`chunk-QMMMXYOY.js` may be read in full because it is the 2,804-byte local
`ensureLink` implementation. `chunk-FMBDRMTZ.js` may be searched only for
`setupAndLink`, `HEADLESS`, and `Confirmation required`, and only bounded
surrounding lines may be read. No source map, other package, global Vercel
configuration, cache, telemetry store, credential file, or filesystem path may
be opened.

## 3. Exact future transmission and repository scope

After separate execution authorization, transmit exactly these three files
through stdin:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2B_VERCEL_CURL_FAILURE_CLASSIFICATION.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2C_LOCAL_VERCEL_CLI_CONTROL_FLOW_AUDIT.md`

Do not transmit R1, R2, R2A, the completion plan, phase results, application
source, migrations, tests, or the three unrelated untracked diagnostic files.

Claude may use read-only Git metadata commands for section 4A and local file
metadata/search/bounded-read commands for sections 4B through 4D. For
`src/components/estimates/wizard/screens/ScreensPreview.tsx`, only pathname,
Git state, mode, size, and SHA-256 may be inspected. Its contents must remain
unopened. Expected metadata remains:

```yaml
mode: -rw-r--r--
size: 31076
sha256: d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e
```

At execution time the three pre-existing untracked postal diagnostic
directives must be the only untracked files and must remain untouched.

## 4. Exact local-only audit

### A. Permission, repository, and network-zero gate

The future wrapper must retain:

```text
--safe-mode
--no-chrome
--no-session-persistence
--permission-mode dontAsk
--tools Bash
--allowedTools Bash
--autocompact 1M
--output-format text
```

Before CLI artifact access, verify the current HEAD is the single direct child
of `60ec89a8cd9ce5bfc8321fa2ea6755081b9df3ef`, its committed delta is exactly
the three paths in section 1, index and tracked worktree are clean, only the
three preserved unrelated untracked files exist, and protected metadata
matches section 3. Do not query GitHub; the PR identity must be taken only from
the committed R2C governance input. Any mismatch returns
`BLOCKED_LOCAL_IDENTITY`.

No command containing a hostname, URL, deployment ID, project ID, team slug,
network client, Vercel provider subcommand, Supabase command, database command,
or socket operation may execute. No `vercel` CLI process may execute; version
and command behavior must be derived only from the fixed local artifacts.

### B. Installed artifact identity gate

Verify all four artifacts from section 2 by exact literal path, regular-file
mode, size, and SHA-256. Verify `package.json` reports package `vercel` version
`54.17.3`. Any mismatch returns `BLOCKED_LOCAL_CLI_ARTIFACT_DRIFT` without
opening artifact contents beyond the package name/version fields.

### C. Static control-flow proof

Using only the bounded reads in section 2, answer these deterministic
questions:

1. Does `runCurl` route a full URL to `getFullUrlAndToken` but a relative path
   to `getDeploymentUrlAndToken`?
2. Does the relative-path function call `ensureLink` before it resolves the
   `--deployment` value?
3. Does it then require `getLinkedProject(...).status === "linked"` even when
   `--deployment` is present?
4. Does `ensureLink` call `setupAndLink` when the selected `--cwd` is unlinked?
5. Can non-interactive setup without auto-confirmation return `HEADLESS`, which
   `ensureLink` renders as structured reason `confirmation_required` with a
   message that the command requires confirmation and suggests `--yes`?
6. Did the R2B classifier omit both `confirmation_required` and
   `requires confirmation` from its safe signature table?
7. Does the full-URL branch avoid `getDeploymentUrlAndToken` and its local-link
   precondition? Record this only as a static candidate; do not execute it.

If questions 1 through 6 are all true, the accepted local root cause is:

```text
UNLINKED_TEMP_CWD_TRIGGERED_CLI_CONFIRMATION_REQUIRED_BEFORE_DEPLOYMENT_REQUEST
```

This proves a local CLI orchestration failure, not Vercel SSO, deployment
protection, Supabase binding, or application failure. Question 7 may identify a
future command-shape candidate, but R2C does not authorize provider validation.

### D. Fail-closed classification

| Static result | R2C verdict |
|---|---|
| Questions 1 through 6 are all true | `PASS_LOCAL_CAUSE_LINK_CONFIRMATION_REQUIRED` |
| Required artifact identity differs | `BLOCKED_LOCAL_CLI_ARTIFACT_DRIFT` |
| Repository or protected metadata differs | `BLOCKED_LOCAL_IDENTITY` |
| Any network/provider command or prohibited content access occurs | `BLOCKED_SCOPE_VIOLATION` |
| Control flow does not prove one deterministic cause | `CHANGES_REQUIRED_STATIC_CONTROL_FLOW_MISMATCH` |

Do not use `--yes` as a correction. It authorizes setup/link behavior and is
outside R2C. If the PASS verdict is reached, the next phase may author a
separate full-URL, no-link, redacted provider proof candidate; that future
phase requires its own governance and Owner authorization.

## 5. Required result

Return exactly one result beginning with:

```text
GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_LOCAL_VERCEL_CLI_CONTROL_FLOW_RESULT_V2C
```

Allowed verdicts are:

- `PASS_LOCAL_CAUSE_LINK_CONFIRMATION_REQUIRED`
- `BLOCKED_BASH_PERMISSION`
- `BLOCKED_LOCAL_IDENTITY`
- `BLOCKED_LOCAL_CLI_ARTIFACT_DRIFT`
- `BLOCKED_SCOPE_VIOLATION`
- `CHANGES_REQUIRED_STATIC_CONTROL_FLOW_MISMATCH`

Required schema:

```yaml
verdict: <allowed-verdict>
repository_identity:
  branch: <value>
  head: <value>
  tree: <value>
  governance_parent: <value>
  governance_delta_exact_three_paths: <true|false>
  protected_metadata_match: <true|false>
local_cli_identity:
  version: <value>
  exact_artifact_count: <integer>
  all_modes_sizes_hashes_match: <true|false>
static_control_flow:
  relative_path_routes_to_linked_project_branch: <true|false>
  ensure_link_precedes_deployment_resolution: <true|false>
  deployment_flag_bypasses_link_requirement: <true|false>
  unlinked_cwd_calls_setup_and_link: <true|false>
  noninteractive_without_yes_can_return_headless: <true|false>
  headless_maps_to_confirmation_required: <true|false>
  r2b_classifier_covered_confirmation_required: <true|false>
  full_url_branch_avoids_relative_path_link_gate: <true|false>
  root_cause: <UNLINKED_TEMP_CWD_TRIGGERED_CLI_CONFIRMATION_REQUIRED_BEFORE_DEPLOYMENT_REQUEST|null>
boundaries:
  network_or_provider_commands: 0
  vercel_curl_runtime_requests: 0
  supabase_or_database_contacts: 0
  raw_prior_r2b_output_read: false
  credential_or_secret_files_read: false
  application_or_migration_source_read: false
  files_written: 0
  git_mutations: 0
  retries: 0
next_exact_gate: <single concise recommendation>
```

For `deployment_flag_bypasses_link_requirement`, the expected PASS value is
`false`. For `r2b_classifier_covered_confirmation_required`, the expected PASS
value is also `false`.

## 6. Stop condition

After the single V2C result, stop. Do not run a provider command, test a full
URL, use `--yes`, create `.vercel`, link a project, request or use a bypass
secret, contact Supabase or a database, derive a project ref, edit, test,
stage, commit, push, comment, deploy, convert the PR to Ready, merge, or contact
Production.
