# CLAUDE DIRECTIVE — GDA DEMO 20260907 POSTAL CURRENT PREVIEW EMERGENCY PREFLIGHT R2B VERCEL CURL FAILURE CLASSIFICATION

## 0. Status and authority boundary

This document is an **uncommitted governance candidate** authored by MacBook
Codex after the Owner-authorized R2A run proved repository/deployment identity
but could not derive the fixed Preview's Supabase project ref. The deployment
snapshot contained no bound environment snapshot and the single predetermined
`vercel curl` fallback exited nonzero.

R2B classifies that one unresolved CLI failure. It does not repeat the R2A
binding scan, contact Supabase, inspect database state, repair application
source, or change Vercel configuration. R2B does not authorize execution by
itself.

After independent review, an exact three-document governance commit, normal
push, one non-triggering PR instruction, and separate Owner authorization,
MacBook Claude may execute one new R2B read-only diagnostic attempt.

This directive does **not** authorize:

- any application-source, migration, test, script, dependency, lockfile,
  environment-file, `.vercel`, credential, browser-profile, cookie-store,
  shell-history, or Claude-settings content access;
- `vercel link`, `vercel pull`, `vercel env pull`, `vercel env export`,
  `vercel env run`, `vercel deploy`, `vercel promote`, `vercel alias`,
  `vercel --yes`, `vercel curl --trace`, `--debug`, verbose curl output,
  protection-secret creation, or a user-supplied bypass secret;
- any Vercel, GitHub, Git, Supabase, database, Auth, Storage, migration,
  function, import, Staging, or Production mutation;
- any Supabase hostname, API, PostgreSQL, PostgREST, Auth, Storage, application
  API, customer row, vehicle row, estimate row, or postal row contact;
- printing, hashing, fingerprinting, persisting, or returning tokens, cookies,
  environment values, keys, passwords, protection-bypass values, raw stdout,
  raw stderr, response headers, complete URLs, HTML, JavaScript, request IDs,
  traces, or response samples; or
- retrying, widening, bypassing, or converting an unknown result into a guess.

## 1. Fixed identity and consumed R2A result

```yaml
phase: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2B_VERCEL_CURL_FAILURE_CLASSIFICATION
mode: TOOL_ENABLED_READ_ONLY_ONE_TIME_AFTER_SEPARATE_OWNER_AUTHORIZATION
repository: nisikawa-officeAZ/GYEON
pull_request: 67
pull_request_url: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state: OPEN
pull_request_draft: true
base: main
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_pre_governance_parent: df3320738883dd3e96fea3c68f67fa8eb897443a
fixed_pre_governance_parent_tree: 1453171087dea68a7430592f96cb8b48b3cba074
fixed_pre_governance_parent_parent: 9cb9fe342b365565f7e8a4e6707f9adbbc38c275
required_execution_head: DERIVED_SINGLE_DIRECT_CHILD_OF_FIXED_PRE_GOVERNANCE_PARENT
required_execution_delta: EXACT_THREE_GOVERNANCE_PATHS_ONLY
exact_governance_delta_paths:
  - docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2B_VERCEL_CURL_FAILURE_CLASSIFICATION.md
  - docs/master_specification/GYEON_DA_COMPLETION_PLAN.md
  - docs/master_specification/GYEON_DA_PHASE_RESULTS.md
claude_code_version: 2.1.226
vercel_cli_observed_version: 54.17.3
consumed_r2a_attempt_count: 1
consumed_r2a_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_SAFE_BINDING_RESULT_V2A
consumed_r2a_verdict: BLOCKED_SAFE_BINDING_PROOF
consumed_r2a_repository_identity: PASS
consumed_r2a_deployment_identity: PASS
consumed_r2a_permission_correction: PASS
consumed_r2a_binding_method: null
consumed_r2a_supabase_project_ref: null
consumed_r2a_unique_ref_count: 0
consumed_r2a_snapshot_bound_environment_present: false
consumed_r2a_vercel_curl_command_count: 1
consumed_r2a_vercel_curl_exit: NONZERO
consumed_r2a_failure_cause: UNCLASSIFIED
consumed_r2a_retries: 0
vercel_team_slug: nisikawa-5024s-projects
vercel_project_name: dealeros
vercel_project_id: prj_aHtlx2Tsj21TWNDFbO20BN4C7J84
vercel_deployment_id: dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB
vercel_preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
vercel_state: READY
vercel_deployment_expected_git_branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
vercel_deployment_expected_git_commit: b6db05f61d80b39963981b5594c44f3692f57946
production_ref_prohibited: dmvyaykhibmphrmekjbb
r2b_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_VERCEL_CURL_FAILURE_CLASSIFICATION_RESULT_V2B
```

R2A's phrase "consistent with SSO" is an inference, not accepted root-cause
evidence. R2B must not report `SSO`, `VERCEL_AUTHENTICATION`, or
`DEPLOYMENT_PROTECTION` unless the bounded classifier matches a predeclared
safe signature. An unmatched result is `UNKNOWN_REDACTED`, never a best guess.

The deployment API returned `target: null` while the independently verified
deployment was a READY Preview with the fixed Preview alias and Git identity.
R2B records those as separate facts and must not reinterpret `null` as a
Production target.

## 2. Official CLI basis

The installed Vercel CLI `54.17.3` reports:

- `vercel curl path [options]`;
- `--deployment <ID|URL>` targets one deployment;
- `--cwd <DIR>` selects the command working directory;
- `--scope` selects the account scope;
- `--non-interactive` disables interactive prompting; and
- `--yes` may link when linking is required.

Vercel's current official `vercel curl` documentation says the command is beta,
uses the system `curl`, automatically handles Deployment Protection bypass,
and may first find a linked project before it obtains a protection-bypass
token. The same documentation lists separate troubleshooting outcomes for no
deployment, a failure to obtain a protection-bypass token, and an invalid or
inaccessible deployment ID:
`https://vercel.com/docs/cli/curl`.

Vercel Authentication can protect Preview deployments:
`https://vercel.com/docs/deployment-protection`.

Therefore a nonzero `vercel curl` exit alone does not prove SSO, a missing
Supabase binding, or an application failure. R2B classifies only the CLI failure
boundary and stops.

The Supabase 2026 Data API and table-exposure changes do not affect R2B because
R2B makes zero Supabase or database requests.

## 3. Exact future transmission and repository scope

After separate execution authorization, transmit exactly these three files
through stdin:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2A_BASH_PERMISSION_CORRECTION.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2B_VERCEL_CURL_FAILURE_CLASSIFICATION.md`

Do not retransmit R1, R2, the completion plan, phase results, the twelve R1
private source files, application source, migrations, tests, environment files,
or the three unrelated untracked diagnostic directives. R2B is self-contained
so the transmission stays minimal.

Claude may use read-only Git/GitHub metadata commands only for section 4A. For
`src/components/estimates/wizard/screens/ScreensPreview.tsx`, only pathname,
Git state, mode, size, and SHA-256 may be inspected. Its contents must not be
opened, read, diffed, copied, or transmitted. Expected metadata remains:

```yaml
mode: -rw-r--r--
size: 31076
sha256: d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e
```

At execution time the three pre-existing untracked postal diagnostic
directives must be the only untracked files and must remain untouched.

## 4. Exact one-time diagnostic sequence

### A. Permission and identity gate

The invocation wrapper must include exactly these controls:

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

The first tool call must be one Bash call for the read-only local identity gate.
If Bash is denied, unavailable, or prompts, return `BLOCKED_BASH_PERMISSION`
and stop without retry or permission change.

Before any Vercel request, verify:

- the current HEAD is the single direct child of
  `df3320738883dd3e96fea3c68f67fa8eb897443a`;
- its committed delta is exactly the three governance paths in section 1;
- index and tracked worktree are clean;
- only the three pre-existing unrelated untracked paths exist;
- PR #67 is OPEN/Draft, base `main`, correct branch, and its remote head equals
  the current HEAD; and
- protected-path metadata matches section 3 without content access.

Any mismatch returns `BLOCKED_LOCAL_IDENTITY` and stops.

### B. Local CLI contract gate

Run only `vercel --version` and `vercel curl --help`, capture both locally, and
reduce them to:

- CLI version equals `54.17.3`;
- `curl` is present;
- `--deployment`, `--cwd`, `--scope`, and `--non-interactive` are supported;
- `--trace`, `--debug`, and `--yes` are not used.

If the expected command contract differs, return
`CHANGES_REQUIRED_CLI_CONTRACT_DRIFT` and stop before provider contact.

### C. Repo-external bounded classifier

Create one fresh mode-0700 directory under `/private/tmp` with `mktemp -d`.
The repository and its parents must not receive any new file. Run exactly one
`vercel curl` process, exactly once, from the temporary directory:

```text
vercel curl /login?next=%2F \
  --deployment dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB \
  --scope nisikawa-5024s-projects \
  --non-interactive \
  --cwd <fresh-mode-0700-temp-dir>
```

Do not add curl flags, `--yes`, `--trace`, `--debug`, `--protection-bypass`, a
token argument, or an environment override. Do not invoke `vercel api`, direct
`curl`, a browser, MCP, or a second command as a fallback.

A bounded parent process must capture stdout and stderr directly in memory,
enforce a 30-second timeout and a combined 1-MiB limit, and never forward raw
bytes to terminal, Claude context, disk, or the result. It may inspect only
lowercased text needed for the ordered category table below. The parent must
record exit code, timeout/limit booleans, and category, then discard both
buffers. It must not parse HTML, JavaScript, URLs, request IDs, headers,
cookies, tokens, or application content.

| Priority | Safe signature meaning | Category |
|---|---|---|
| 1 | linking is required, project is not linked, or project metadata is missing | `LINK_REQUIRED` |
| 2 | failed to obtain/generate a deployment protection bypass token | `PROTECTION_BYPASS_TOKEN_UNAVAILABLE` |
| 3 | Vercel login, authentication, authorization, or valid account access is required | `VERCEL_AUTH_REQUIRED_OR_DENIED` |
| 4 | fixed deployment was not found, deleted, mismatched, or inaccessible | `DEPLOYMENT_NOT_FOUND_OR_INACCESSIBLE` |
| 5 | CLI option, argument, command usage, or system `curl` is invalid/unavailable | `CLI_USAGE_OR_LOCAL_CURL_ERROR` |
| 6 | DNS, connection, TLS, timeout, or network failure | `NETWORK_OR_TIMEOUT` |
| 7 | process exits zero without raw emission | `REQUEST_SUCCEEDED_NO_BINDING_SCAN` |
| 8 | none of the above, output limit exceeded, or ambiguous signals | `UNKNOWN_REDACTED` |

The classifier may combine multiple matched phrases only to select the first
category in this fixed priority order. It must output no matched phrase. A zero
exit is not permission to inspect the body or resume the R2 scan; it maps only
to `REQUEST_SUCCEEDED_NO_BINDING_SCAN`.

Any `.vercel` creation, link prompt, interactive prompt, project mutation,
unexpected file outside the temporary directory, raw-output escape, or failure
to prove cleanup returns `BLOCKED_UNSAFE_DIAGNOSTIC_BOUNDARY`.

### D. Stop and next-gate mapping

| Category | R2B verdict | Next exact gate |
|---|---|---|
| `LINK_REQUIRED` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Author a separate decision between a bounded repo-external Vercel API method and a disposable non-repository link context; do not link now. |
| `PROTECTION_BYPASS_TOKEN_UNAVAILABLE` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Author a separate owner decision; do not request, create, paste, or expose a bypass secret now. |
| `VERCEL_AUTH_REQUIRED_OR_DENIED` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Re-establish Vercel CLI account authorization only in a separate owner-authorized phase. |
| `DEPLOYMENT_NOT_FOUND_OR_INACCESSIBLE` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Reconfirm immutable deployment identity/access in a separate read-only phase. |
| `CLI_USAGE_OR_LOCAL_CURL_ERROR` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Correct only the documented CLI invocation in a new governance phase. |
| `NETWORK_OR_TIMEOUT` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Stop; authorize a later single retry only after the external condition changes. |
| `REQUEST_SUCCEEDED_NO_BINDING_SCAN` | `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION` | Author a new one-time redacted runtime scan; do not scan in R2B. |
| `UNKNOWN_REDACTED` | `CHANGES_REQUIRED_UNKNOWN_FAILURE` | Stop for Owner/Codex review; no retry, secret request, or guess. |

R2B must make zero Supabase, database, application-endpoint, migration, import,
Production, or second Vercel command contacts after classification.

## 5. Required result

Return exactly one result beginning with:

```text
GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_VERCEL_CURL_FAILURE_CLASSIFICATION_RESULT_V2B
```

Allowed verdicts are:

- `PASS_FAILURE_CLASSIFIED_FOR_NEXT_BINDING_DECISION`
- `BLOCKED_BASH_PERMISSION`
- `BLOCKED_LOCAL_IDENTITY`
- `BLOCKED_UNSAFE_DIAGNOSTIC_BOUNDARY`
- `CHANGES_REQUIRED_CLI_CONTRACT_DRIFT`
- `CHANGES_REQUIRED_UNKNOWN_FAILURE`

Required schema:

```yaml
verdict: <allowed-verdict>
repository_identity:
  branch: <value>
  head: <value>
  tree: <value>
  governance_parent: <value>
  governance_delta_exact_three_paths: <true|false>
  pr_open: <true|false>
  pr_draft: <true|false>
permission_contract:
  tools_bash: true
  allowed_tools_bash: true
  permission_mode: dontAsk
  permission_bypass_used: false
  bash_first_call_executed: <true|false>
local_cli_contract:
  version: <value>
  curl_command_present: <true|false>
  deployment_flag_present: <true|false>
  cwd_flag_present: <true|false>
  scope_flag_present: <true|false>
  non_interactive_flag_present: <true|false>
diagnostic:
  vercel_curl_process_count: <0|1>
  fixed_deployment_id_used: <true|false>
  fixed_scope_used: <true|false>
  exit_code: <integer|null>
  timed_out: <true|false>
  output_limit_exceeded: <true|false>
  category: <LINK_REQUIRED|PROTECTION_BYPASS_TOKEN_UNAVAILABLE|VERCEL_AUTH_REQUIRED_OR_DENIED|DEPLOYMENT_NOT_FOUND_OR_INACCESSIBLE|CLI_USAGE_OR_LOCAL_CURL_ERROR|NETWORK_OR_TIMEOUT|REQUEST_SUCCEEDED_NO_BINDING_SCAN|UNKNOWN_REDACTED|null>
  raw_stdout_emitted_or_persisted: false
  raw_stderr_emitted_or_persisted: false
  secrets_emitted: false
temporary_execution:
  repo_external: <true|false>
  unexpected_link_or_project_metadata: <true|false>
  cleaned: <true|false>
prohibited_actions:
  vercel_api_or_second_vercel_command_contacts: 0
  vercel_mutations_or_deployments: 0
  bypass_secret_requests_or_uses: 0
  supabase_or_database_contacts: 0
  database_writes: 0
  migration_applies: 0
  imports_or_promotions: 0
  git_mutations: 0
  production_contacts: 0
  retries: 0
next_exact_gate: <single concise recommendation>
```

## 6. Stop condition

After the single V2B result, stop. Do not repeat R2A, derive a Supabase ref,
inspect runtime assets, request a protection secret, link a project, contact
Supabase or a database, edit, test, stage, commit, push, comment, apply a
migration, import postal data, change Vercel, redeploy, convert the PR to Ready,
merge, or contact Production.
