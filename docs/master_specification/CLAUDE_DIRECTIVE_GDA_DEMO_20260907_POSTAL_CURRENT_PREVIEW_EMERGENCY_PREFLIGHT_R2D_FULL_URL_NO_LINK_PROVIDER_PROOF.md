# CLAUDE DIRECTIVE — GDA DEMO 20260907 POSTAL CURRENT PREVIEW EMERGENCY PREFLIGHT R2D FULL-URL NO-LINK PROVIDER PROOF

## 0. Status and authority boundary

R2C returned
`GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_LOCAL_VERCEL_CLI_CONTROL_FLOW_RESULT_V2C`
with verdict `PASS_LOCAL_CAUSE_LINK_CONFIRMATION_REQUIRED`. MacBook Codex
independently accepted that result: R2B used a relative-path `vercel curl`
from an unlinked temporary directory, entered the local project-link branch,
and stopped at `confirmation_required` before any Preview request.

MacBook Codex also found an additional safety boundary while authoring R2D.
Vercel CLI `54.17.3` routes a full URL away from the local-link branch, but its
`getFullUrlAndToken` path calls `getOrCreateDeploymentProtectionToken` when it
resolves the project. If no automation-bypass token exists, that function may
create one. Therefore a Vercel CLI full-URL execution is **not** compatible
with the required zero-provider-mutation boundary and is prohibited in R2D.

This document authorizes nothing by itself. After this exact three-document
governance candidate is independently verified, committed, normally pushed,
published in one non-triggering PR instruction, and separately authorized by
the Owner, MacBook Claude may execute one unauthenticated direct GET whose
only purpose is to prove DNS/TLS/HTTP reachability of the fixed Preview alias.

This directive does **not** authorize:

- execution during governance authoring, staging, commit, push, or PR comment;
- any `vercel` CLI process, Vercel API, project link, `.vercel` creation,
  protection-bypass retrieval or creation, token, secret, deployment,
  promotion, alias change, environment-variable read/mutation, trace, debug,
  or retry;
- browser, MCP, Supabase CLI/MCP/API, database, migration, postal import, RPC,
  Storage, Auth, customer, vehicle, estimate, OCR, address, or postal-row
  contact;
- cookie, authorization header, browser profile, shell history, Claude
  setting, credential file, application source, migration, or test read;
- response-body or response-header capture, redirect following, raw stdout or
  stderr emission, or query/body/header data beyond the fixed public route;
- file edit, dependency change, test, stage, commit, push, PR mutation, Ready,
  merge, deployment, Production contact, or a second network request; or
- treating provider reachability as proof that the login page, postal lookup,
  OCR mapping, Supabase binding, migration, or database data is correct.

## 1. Fixed repository and Preview identity

```yaml
repository: nisikawa-officeAZ/GYEON
root: /Users/atsushinishikawa/Documents/Codex/2026-08-09/files-mentioned-by-the-user-dealeros/work/dealeros-pr67-cr6-recovery-v2
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state_at_authoring: OPEN
pull_request_draft_at_authoring: true
pull_request_base: main
fixed_pre_governance_parent: d2b57727fae5e7094b252070ed71c3c6816ad95d
fixed_pre_governance_parent_tree: 75e6007f3604aff3e0b047cd68843430277384ad
fixed_pre_governance_parent_parent: 60ec89a8cd9ce5bfc8321fa2ea6755081b9df3ef
upstream_ahead_behind_before_authoring: "0 0"
vercel_check_at_authoring: SUCCESS
vercel_preview_comments_check_at_authoring: SUCCESS
preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
request_scheme: https
request_route: /login?next=%2F
request_method: GET
r2c_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_LOCAL_VERCEL_CLI_CONTROL_FLOW_RESULT_V2C
r2c_verdict: PASS_LOCAL_CAUSE_LINK_CONFIRMATION_REQUIRED
r2d_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_FULL_URL_NO_LINK_PROVIDER_PROOF_RESULT_V2D
```

The fixed alias and route contain no secret, customer data, workspace ID,
postal code, or application record identifier. R2D proves only that the
Preview hostname returns an HTTP response through a direct, unauthenticated
full-URL GET. It does not bypass Deployment Protection and does not prove that
the application route or postal feature executed.

## 2. Current official and local-command basis

Vercel's official 2026-05-15 changelog confirms that `vercel curl` accepts
full URLs while relative paths are for linked projects:
`https://vercel.com/changelog/use-native-curl-syntax-with-vercel-cli`.

Vercel's official CLI documentation states that `vercel curl` can retrieve or
generate a Deployment Protection bypass token. R2D therefore does not use the
Vercel CLI:
`https://vercel.com/docs/cli/curl`.

MacBook Codex independently confirmed from installed Vercel CLI `54.17.3`
that `getFullUrlAndToken` may call `getOrCreateDeploymentProtectionToken`,
which calls `createDeploymentProtectionToken` when the project has no
existing automation-bypass token. This is the reason for the direct system
curl design and the absolute prohibition on any Vercel CLI process.

The only permitted network executable is fixed as:

```yaml
path: /usr/bin/curl
mode: -rwxr-xr-x
size: 551152
sha256: b636262803922ee1dd0fbf614818473ffa53c811e44fd3278c2270d3af4759d3
version: 8.7.1
tls_backend: SecureTransport
```

Before the request, verify this identity using local metadata and SHA-256
only. Do not execute `curl --version`; the single permitted curl GET is the
only curl process in R2D.

The Supabase breaking-change review performed at authoring found no item that
changes this unauthenticated Vercel-hostname GET. R2D runs no direct Supabase
or database command and cannot observe or make claims about any server-side
activity behind the Preview response.

## 3. Exact future transmission and repository scope

After separate execution authorization, transmit exactly these three files
through stdin:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2C_LOCAL_VERCEL_CLI_CONTROL_FLOW_AUDIT.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2D_FULL_URL_NO_LINK_PROVIDER_PROOF.md`

Do not transmit R1, R2, R2A, R2B, the completion plan, phase results,
application source, migrations, tests, or the three unrelated untracked
postal diagnostic files.

Claude may use read-only Git metadata, local file metadata/hash commands, and
one bounded repository-external temporary directory. For
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

## 4. Exact one-request proof

### A. Permission and local identity gate

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

Before any network request, verify that:

1. current HEAD is the single direct child of
   `d2b57727fae5e7094b252070ed71c3c6816ad95d`;
2. that commit changes exactly the three governance paths: this directive,
   `GYEON_DA_COMPLETION_PLAN.md`, and `GYEON_DA_PHASE_RESULTS.md`;
3. local HEAD equals upstream, the index and tracked worktree are clean, and
   only the three preserved unrelated untracked files exist;
4. protected metadata matches section 3;
5. `/usr/bin/curl` matches section 2; and
6. no `.vercel` path exists in the repository or fresh temporary directory.

Any mismatch returns `BLOCKED_LOCAL_IDENTITY` or
`BLOCKED_LOCAL_CURL_ARTIFACT_DRIFT` before network contact.

### B. Temporary and output-safety gate

Create one fresh directory with `mktemp -d` outside the repository. Set mode
`700`. Create at most two capture files inside it, stdout and stderr, each mode
`600`. They may exist only for the duration of the one command and must be
deleted with the directory before the result is returned.

Do not print, transmit, persist outside that directory, or quote raw stdout or
stderr. Reject the result as `BLOCKED_OUTPUT_SAFETY` if either capture exceeds
`1048576` bytes. Parse stdout only as an exact three-digit HTTP status. Search
stderr only for the safe network categories in section 4D. Never search for
or print token-like values.

### C. The only permitted network command

From the fresh temporary directory, run exactly one direct curl process:

```text
/usr/bin/curl --request GET --silent --show-error --output /dev/null --write-out %{http_code} --connect-timeout 10 --max-time 30 https://dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app/login?next=%2F
```

The wrapper must quote the full URL and the `%{http_code}` format token when
executing it. The displayed contract omits shell quotes only to avoid
presenting copy-paste shell syntax as authority.

Required constraints:

- curl process count: exactly one;
- network request count: exactly one;
- method: GET;
- full URL: exact fixed alias and route above;
- cookies and authorization headers: absent;
- Vercel CLI, API, protection bypass, and project-link action: absent;
- redirects followed: false;
- request or response body saved: false;
- response headers saved: false;
- output reduced to the three-digit HTTP status after safe validation;
- timeout: 30 seconds; connect timeout: 10 seconds; retry: zero; and
- no provider mutation, direct Supabase/DB command, or Production hostname.

### D. Fail-closed classification

Classify without emitting raw output:

| Result | Verdict |
|---|---|
| Exit `0`, stdout is exactly one HTTP status in `200..399` | `PASS_FULL_URL_PROVIDER_REACHABLE` |
| Exit `0`, HTTP `401` or `403` | `BLOCKED_PREVIEW_PROTECTION_PROVIDER_REACHABLE` |
| Exit `0`, HTTP `404` | `CHANGES_REQUIRED_PREVIEW_ALIAS_OR_ROUTE_NOT_FOUND` |
| Exit `0`, HTTP `500..599` | `CHANGES_REQUIRED_PREVIEW_SERVER_ERROR` |
| timeout, DNS, TLS, or connection failure | `BLOCKED_NETWORK_OR_TLS` |
| capture exceeds the size limit or safe reduction is impossible | `BLOCKED_OUTPUT_SAFETY` |
| Any other nonzero or unclassified result | `CHANGES_REQUIRED_UNKNOWN_REDACTED` |

Both the PASS and the protection-blocked verdict prove DNS/TLS/HTTP provider
reachability. Only the PASS proves a public success-or-redirect response. No
R2D verdict proves authenticated application execution, postal lookup,
database state, or Supabase binding.

## 5. Required result

Return exactly one result beginning with:

```text
GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_FULL_URL_NO_LINK_PROVIDER_PROOF_RESULT_V2D
```

Allowed verdicts are:

- `PASS_FULL_URL_PROVIDER_REACHABLE`
- `BLOCKED_BASH_PERMISSION`
- `BLOCKED_LOCAL_IDENTITY`
- `BLOCKED_LOCAL_CURL_ARTIFACT_DRIFT`
- `BLOCKED_OUTPUT_SAFETY`
- `BLOCKED_PREVIEW_PROTECTION_PROVIDER_REACHABLE`
- `BLOCKED_NETWORK_OR_TLS`
- `CHANGES_REQUIRED_PREVIEW_ALIAS_OR_ROUTE_NOT_FOUND`
- `CHANGES_REQUIRED_PREVIEW_SERVER_ERROR`
- `CHANGES_REQUIRED_UNKNOWN_REDACTED`

Required schema:

```yaml
verdict: <allowed-verdict>
repository_identity:
  branch: <value>
  head: <value>
  tree: <value>
  governance_parent: <value>
  governance_delta_exact_three_paths: <true|false>
  head_equals_upstream: <true|false>
  protected_metadata_match: <true|false>
local_curl_identity:
  path: </usr/bin/curl|null>
  version: <8.7.1|null>
  mode_size_sha256_match: <true|false>
provider_proof:
  curl_process_count: <0|1>
  network_request_count: <0|1>
  full_url_used: <true|false>
  method: <GET|null>
  route: </login?next=%2F|null>
  exit_code: <integer|null>
  http_status_class: <2xx|3xx|4xx|5xx|null>
  redirects_followed: false
  cookies_or_authorization_headers_used: false
  response_body_saved: false
  response_headers_saved: false
  raw_stdout_or_stderr_emitted: false
  temp_directory_repo_external: <true|false>
  temp_directory_cleaned: <true|false>
boundaries:
  vercel_cli_or_api_processes: 0
  protection_bypass_read_or_created: false
  provider_mutations: 0
  direct_supabase_or_database_commands: 0
  server_side_supabase_activity_observed_or_claimed: false
  application_or_migration_source_read: false
  credential_or_secret_files_read: false
  files_written_outside_ephemeral_temp: 0
  git_mutations: 0
  retries: 0
proof_meaning: <PROVIDER_REACHABILITY_ONLY_NOT_APPLICATION_POSTAL_OR_BINDING_PROOF>
next_exact_gate: <single concise recommendation>
```

Report only the HTTP status class, never the raw status line, body, headers,
URL query expansion, cookie, provider response text, IP address, or TLS detail.

## 6. Stop condition

After the single V2D result, delete the temporary directory and stop. Do not
run Vercel CLI/API, another curl, browser request, authenticated route, postal
lookup, Supabase/DB command, migration, import, edit, test, stage, commit,
push, PR comment, deploy, Ready, merge, or Production contact.
