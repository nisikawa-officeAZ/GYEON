# CLAUDE DIRECTIVE — GDA DEMO 20260907 POSTAL CURRENT PREVIEW EMERGENCY PREFLIGHT R2 SAFE BINDING

## 0. Status and authority boundary

This document is an **uncommitted governance candidate** authored by MacBook
Codex after the Owner-authorized R1 read-only preflight stopped correctly at
`BLOCKED_SAFE_BINDING_PROOF`.

This document does not authorize execution by itself. After this governance
candidate is independently reviewed, committed, normally pushed, and the Owner
separately authorizes one execution, MacBook Claude may perform exactly one
tool-enabled, read-only Vercel binding proof.

R2 supersedes R1 only for the unresolved Preview-to-Supabase binding step. It
does not repeat R1's successful local/source identity checks and does not
contact Supabase or any database.

This directive does **not** authorize:

- any source, test, dependency, lockfile, Git index, commit, push, PR, Ready,
  merge, release, or deployment mutation;
- any Vercel project, environment-variable, alias, protection, deployment, or
  configuration mutation;
- any Supabase, database, Auth, Storage, migration, SQL, function, import,
  provider, staging, or Production contact;
- `vercel link`, `vercel pull`, `vercel env pull`, `vercel env export`,
  `vercel env run`, redeploy, promote, or any non-GET Vercel API method;
- printing, hashing, fingerprinting, persisting, or returning an access token,
  environment value, URL value, public client key, server key, secret, cookie,
  password, protection-bypass value, or raw provider response;
- customer, vehicle, estimate, OCR, address, or row-data access; or
- retrying a failed or ambiguous provider request.

## 1. Fixed identity and R1 evidence

```yaml
phase: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2_SAFE_BINDING
mode: TOOL_ENABLED_READ_ONLY_ONE_TIME_AFTER_SEPARATE_OWNER_AUTHORIZATION
repository: nisikawa-officeAZ/GYEON
pull_request: 67
pull_request_url: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state: OPEN
pull_request_draft: true
base: main
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_pre_governance_parent: a16ba231e91bfa0049b8e38d87577d565be086f9
fixed_pre_governance_parent_tree: f08bd7df246c7b6ff999b5c79a6bdfbe6c7a2d3e
fixed_pre_governance_parent_parent: b6db05f61d80b39963981b5594c44f3692f57946
required_execution_head: DERIVED_SINGLE_DIRECT_CHILD_OF_FIXED_PRE_GOVERNANCE_PARENT
required_execution_delta: EXACT_THREE_GOVERNANCE_PATHS_ONLY
exact_governance_delta_paths:
  - docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2_SAFE_BINDING.md
  - docs/master_specification/GYEON_DA_COMPLETION_PLAN.md
  - docs/master_specification/GYEON_DA_PHASE_RESULTS.md
vercel_cli_observed_version: 54.17.3
vercel_team_slug: nisikawa-5024s-projects
vercel_project_name: dealeros
vercel_project_id: prj_aHtlx2Tsj21TWNDFbO20BN4C7J84
vercel_deployment_id: dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB
vercel_preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
vercel_target: preview
vercel_state: READY
vercel_deployment_expected_git_branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
vercel_deployment_expected_git_commit: b6db05f61d80b39963981b5594c44f3692f57946
production_ref_prohibited: dmvyaykhibmphrmekjbb
clean_replacement_ref: nqvnjqcxgngqsqkbpdfi
old_development_ref_read_only: fbieiotihlmpfzybowbt
formal_staging_ref_read_only: vhiuiwolnlvlwvoaingd
r1_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_RESULT_V1
r1_verdict: BLOCKED_SAFE_BINDING_PROOF
r2_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_SAFE_BINDING_RESULT_V2
```

The R1 run proved the branch, fixed HEAD/tree/parent, exact three-path R1
governance delta, OPEN/Draft PR identity, protected metadata, postal source
hashes, clean index, and exact three unrelated untracked files. It performed
zero database writes, migration applies, imports, Vercel mutations, Git
mutations, Production contacts, retries, or secret emissions.

R1 stopped because a normal runtime request reached Vercel SSO protection and
the available Claude Vercel MCP connection required authentication. R2 must not
repeat those failed requests. It instead uses Vercel CLI `vercel api` or
`vercel curl --deployment`, which use the already authenticated local Vercel
CLI context without exposing its token.

At execution time, fail closed before provider access unless the current HEAD
is the single direct child of the fixed pre-governance parent, its committed
delta is exactly the three paths above, PR #67's remote head equals that HEAD,
and the branch, project, deployment, alias, READY state, and Preview target all
match this section.

The repository execution HEAD and the fixed deployment Git commit are
intentionally different identities. The execution HEAD must be the future R2
governance child described above. The immutable Preview was fixed before the R1
governance commit and must report Git commit
`b6db05f61d80b39963981b5594c44f3692f57946`. Never compare the deployment Git
commit to the current R2 execution HEAD.

## 2. Literal repository read scope

After separate execution authorization, Claude may read only:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R1.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2_SAFE_BINDING.md`
4. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
5. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

No application source, migration, script, test, environment file, `.vercel`
file, Claude settings file, browser profile, cookie store, shell history, or
credential store may be opened by Claude.

For `src/components/estimates/wizard/screens/ScreensPreview.tsx`, only pathname,
Git state, mode, size, and SHA-256 may be inspected. Its contents must not be
opened, read, diffed, copied, or transmitted. Expected metadata remains:

```yaml
mode: -rw-r--r--
size: 31076
sha256: d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e
```

The exact three pre-existing untracked postal diagnostic directives named in
R1 must remain untouched, unstaged, unmodified, and uncommitted. At execution
time they must be the only untracked paths.

## 3. Official provider basis

The implementation of this one-time proof must follow the current official
Vercel interfaces observed on 2026-09-07:

- `GET /v13/deployments/{idOrUrl}` returns deployment identity and, for an
  authenticated owner, may include private deployment fields including the
  deployment environment snapshot:
  `https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url`
- `vercel api` performs authenticated Vercel API requests without requiring a
  repository link.
- `vercel curl --deployment <ID>` performs a GET against one exact deployment
  with automatic deployment-protection handling:
  `vercel curl --help` from Vercel CLI `54.17.3`.
- Vercel environment changes affect only later deployments, so current
  project-level environment configuration alone cannot prove the environment
  embedded in this fixed deployment:
  `https://vercel.com/docs/environment-variables`

The Supabase 2026 Data API/OpenAPI hardening and table-exposure changes do not
alter this R2 because R2 performs no Supabase or database request.

## 4. Exact one-time binding sequence

### A. Local and remote identity gate

Using read-only Git/GitHub commands only, verify:

- repository root, branch, current HEAD/tree/single parent;
- exact three-path committed governance delta from the fixed parent;
- clean index and zero tracked worktree changes;
- exactly the three pre-existing untracked paths;
- PR #67 is OPEN/Draft, base `main`, correct branch, and its head OID equals the
  derived current HEAD;
- the protected-path metadata only; and
- Vercel deployment ID, project ID/name, alias, READY state, Preview target,
  Git branch `agent/gda-estimate-ocr-postal-clean-replacement-r1`, and fixed
  deployment Git commit `b6db05f61d80b39963981b5594c44f3692f57946`.

Any mismatch returns `BLOCKED_LOCAL_OR_DEPLOYMENT_IDENTITY` and stops before
the binding request.

### B. Repo-external execution context

Create one fresh mode-0700 temporary directory under `/private/tmp` using
`mktemp -d`. Run every Vercel command with that directory as `--cwd`. Do not
use `--yes`. If Vercel attempts to link, initialize, create `.vercel`, request
interactive confirmation, or write project metadata, return
`BLOCKED_UNEXPECTED_LINK_OR_LOCAL_WRITE` and stop.

Only a fixed, public-safe result file may be written inside this temporary
directory. Raw Vercel responses, headers, HTML, JavaScript, environment values,
tokens, cookies, and URLs must remain in process memory and must never be
written to disk, terminal, Claude context, logs, evidence, debug output, or the
result. Remove the temporary directory after the single result has been
constructed. Failure to prove cleanup is a blocker.

### C. Primary immutable deployment-snapshot proof

Execute exactly one authenticated GET through `vercel api` for the fixed
deployment:

`GET /v13/deployments/dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB?withGitRepoInfo=true`

The command must not use `--debug`, `--verbose`, response headers, shell tracing,
or direct terminal output. A bounded local parser process must capture stdout
directly, parse JSON in memory, and discard every field except:

- deployment ID, project ID/name, target, READY state, Git repository/branch/
  commit identity;
- presence booleans for `NEXT_PUBLIC_SUPABASE_URL`; either exact public-client
  key name `NEXT_PUBLIC_SUPABASE_ANON_KEY` or
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; and either exact server-key name
  `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`, without inspecting or
  returning any key value; and
- the value of `NEXT_PUBLIC_SUPABASE_URL` only long enough to validate the
  exact form `https://<20 lowercase alphanumeric characters>.supabase.co` and
  reduce it to the 20-character ref.

No complete URL or other value may cross the parser boundary. If the response
shape does not bind an environment snapshot to the fixed deployment, do not
use current project environment configuration as a substitute; continue only
to the predetermined fallback in section D.

### D. Predetermined deployment-bound runtime fallback

This is not a retry of section C. It is the only allowed fallback proof channel.
Use `vercel curl --deployment dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB` for GET-only
requests. The same bounded parser must capture all response bodies in memory.

1. Fetch `/login?next=%2F` once.
2. Parse only same-origin Next.js JavaScript asset paths from that response.
3. Fetch each unique asset at most once, in byte-sorted path order, with a hard
   maximum of 128 assets and 32 MiB total response bytes.
4. Search only for hostnames matching
   `<20 lowercase alphanumeric characters>.supabase.co`.
5. Emit no HTML, JavaScript, asset path, cookie, header, URL, or response sample.

Exactly one unique ref is required. Zero refs returns
`BLOCKED_SAFE_BINDING_PROOF`; more than one returns
`CHANGES_REQUIRED_MULTIPLE_DEPLOYMENT_BINDINGS`. Any link prompt, auth failure,
non-GET behavior, size/count limit, malformed response, or ambiguous redirect
fails closed without retry.

### E. Target classification gate

Classify the single redacted ref before any Supabase or database contact:

| Ref | Classification | R2 verdict |
|---|---|---|
| `dmvyaykhibmphrmekjbb` | `PRODUCTION` | `BLOCKED_PRODUCTION_REF` |
| `nqvnjqcxgngqsqkbpdfi` | `CLEAN_REPLACEMENT` | `PASS_TO_R3_TARGETED_SUPABASE_READ_ONLY_PREFLIGHT` |
| `fbieiotihlmpfzybowbt` | `OLD_DEVELOPMENT` | `PASS_TO_R3_TARGETED_SUPABASE_READ_ONLY_PREFLIGHT` |
| `vhiuiwolnlvlwvoaingd` | `FORMAL_STAGING` | `PASS_TO_R3_TARGETED_SUPABASE_READ_ONLY_PREFLIGHT` |
| any other value | `UNKNOWN` | `BLOCKED_UNKNOWN_TARGET` |

Stop immediately after classification. R2 must not contact the derived
Supabase hostname, Supabase management APIs, PostgreSQL, PostgREST, Auth,
Storage, or any application endpoint.

## 5. Required result

Return exactly one result beginning with:

```text
GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_SAFE_BINDING_RESULT_V2
```

Use exactly one verdict from section 4E or these binding blockers:

- `BLOCKED_LOCAL_OR_DEPLOYMENT_IDENTITY`
- `BLOCKED_UNEXPECTED_LINK_OR_LOCAL_WRITE`
- `BLOCKED_VERCEL_AUTH`
- `BLOCKED_SAFE_BINDING_PROOF`
- `CHANGES_REQUIRED_MULTIPLE_DEPLOYMENT_BINDINGS`

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
deployment_identity:
  id: <value>
  project_id: <value>
  alias: <value>
  ready: <true|false>
  preview: <true|false>
  git_branch_match: <true|false>
  git_commit_match: <true|false>
binding_proof:
  method: <DEPLOYMENT_SNAPSHOT|DEPLOYMENT_RUNTIME_ASSET_SCAN|null>
  supabase_project_ref: <20-character-ref-or-null>
  classification: <PRODUCTION|CLEAN_REPLACEMENT|OLD_DEVELOPMENT|FORMAL_STAGING|UNKNOWN|null>
  supabase_url_present: <true|false|null>
  public_client_key_present: <true|false|null>
  server_key_present: <true|false|null>
  unique_ref_count: <integer-or-null>
  secrets_emitted: false
temporary_execution:
  repo_external: <true|false>
  raw_response_persisted: false
  unexpected_link_or_project_metadata: <true|false>
  cleaned: <true|false>
prohibited_actions:
  vercel_mutations_or_deployments: 0
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

After the one result, stop. Do not perform the R3 Supabase inspection, repair,
edit, test, stage, commit, push, PR comment, migration apply, postal data import,
Vercel change, redeploy, Ready conversion, merge, or follow-up Claude request.
