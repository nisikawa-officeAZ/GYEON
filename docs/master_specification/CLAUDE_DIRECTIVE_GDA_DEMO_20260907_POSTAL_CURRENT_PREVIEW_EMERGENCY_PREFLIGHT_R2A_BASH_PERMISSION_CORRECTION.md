# CLAUDE DIRECTIVE — GDA DEMO 20260907 POSTAL CURRENT PREVIEW EMERGENCY PREFLIGHT R2A BASH PERMISSION CORRECTION

## 0. Status and authority boundary

This document is an **uncommitted governance candidate** authored by MacBook
Codex after the Owner-authorized R2 execution stopped before its first Bash
tool call because Bash was available but not permission-approved.

R2A corrects only the Claude Code CLI permission declaration. It does not
broaden the R2 repository scope, provider scope, data scope, target scope, or
allowed outcome. This document does not authorize execution by itself.

After independent review, an exact three-document governance commit, normal
push, one non-triggering PR instruction, and separate Owner authorization,
MacBook Claude may execute one new R2A read-only attempt.

This directive does **not** authorize:

- `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`,
  `--permission-mode bypassPermissions`, Auto mode, or any permission bypass;
- application-source, migration, test, script, environment-file, credential,
  browser-profile, cookie-store, shell-history, or Claude-settings content
  access;
- any source, dependency, lockfile, Git index, commit, push, PR, Ready, merge,
  deployment, alias, environment-variable, or provider mutation;
- any Supabase, database, Auth, Storage, PostgreSQL, PostgREST, migration, SQL,
  function, import, staging, or Production contact;
- printing, hashing, fingerprinting, persisting, or returning access tokens,
  environment values, complete URLs, public-client keys, server keys, cookies,
  passwords, protection-bypass values, or raw provider responses; or
- retrying a failed, denied, malformed, ambiguous, or incomplete execution.

## 1. Fixed identity and consumed R2 attempt

```yaml
phase: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2A_BASH_PERMISSION_CORRECTION
mode: TOOL_ENABLED_READ_ONLY_ONE_TIME_AFTER_SEPARATE_OWNER_AUTHORIZATION
repository: nisikawa-officeAZ/GYEON
pull_request: 67
pull_request_url: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state: OPEN
pull_request_draft: true
base: main
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_pre_governance_parent: 9cb9fe342b365565f7e8a4e6707f9adbbc38c275
fixed_pre_governance_parent_tree: 7613c88f0da6441d9737b7d03ae28ff1745c09eb
fixed_pre_governance_parent_parent: a16ba231e91bfa0049b8e38d87577d565be086f9
required_execution_head: DERIVED_SINGLE_DIRECT_CHILD_OF_FIXED_PRE_GOVERNANCE_PARENT
required_execution_delta: EXACT_THREE_GOVERNANCE_PATHS_ONLY
exact_governance_delta_paths:
  - docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2A_BASH_PERMISSION_CORRECTION.md
  - docs/master_specification/GYEON_DA_COMPLETION_PLAN.md
  - docs/master_specification/GYEON_DA_PHASE_RESULTS.md
claude_code_version: 2.1.226
claude_cli_auth_verified: true
consumed_r2_attempt_count: 1
consumed_r2_result_marker_present: false
consumed_r2_codex_verdict: CHANGES_REQUIRED_EXECUTION_PERMISSION
consumed_r2_bash_tool_calls: 0
consumed_r2_vercel_contacts: 0
consumed_r2_supabase_or_database_contacts: 0
consumed_r2_git_mutations: 0
consumed_r2_retries: 0
vercel_deployment_id: dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB
vercel_preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
vercel_project_id: prj_aHtlx2Tsj21TWNDFbO20BN4C7J84
vercel_deployment_expected_git_branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
vercel_deployment_expected_git_commit: b6db05f61d80b39963981b5594c44f3692f57946
production_ref_prohibited: dmvyaykhibmphrmekjbb
r2a_result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_SAFE_BINDING_RESULT_V2A
```

The consumed R2 attempt received all five authorized governance files, but its
first requested Bash operation was denied under `dontAsk`. Claude reported no
Bash execution, Git/provider/network access, local change, or retry. MacBook
Codex independently verified the repository remained at the fixed HEAD with a
clean index and only the three pre-existing unrelated untracked files.

## 2. Official CLI basis and exact correction

The installed Claude Code CLI `2.1.226` exposes two separate controls:

- `--tools Bash` restricts the available built-in tool set to Bash.
- `--allowedTools Bash` permits Bash to execute without an interactive
  permission prompt.

This separation is also defined by Anthropic's current CLI reference:
`https://code.claude.com/docs/en/cli-reference`.

The R2 wrapper supplied `--tools Bash` but omitted `--allowedTools Bash` while
using `--permission-mode dontAsk`. The denial was therefore an execution-wrapper
error, not a repository, Vercel, Supabase, or R2-contract failure.

The future R2A invocation must include all of these controls together:

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

No saved Claude setting, MCP configuration, plugin, Chrome integration,
resumed session, permission prompt, or bypass mode may be used. `Bash` is
permission-approved only for the literal R2 read-only sequence; it is not
general authorization for shell activity.

## 3. Exact future transmission and repository scope

After separate execution authorization, transmit exactly these six governance
files through stdin:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R1.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2_SAFE_BINDING.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R2A_BASH_PERMISSION_CORRECTION.md`
5. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
6. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

The twelve R1 private source files must not be retransmitted. Claude may not
open any other repository content. For
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

## 4. R2A execution contract

### A. Permission and identity gate

The first response must request exactly one Bash tool call for the read-only
local identity gate. If Bash is denied, unavailable, prompts, or returns a
permission error, return the required R2A marker with verdict
`BLOCKED_BASH_PERMISSION` and stop. Do not retry or change permission mode.

Before any Vercel request, verify:

- current HEAD is the single direct child of
  `9cb9fe342b365565f7e8a4e6707f9adbbc38c275`;
- the committed delta is exactly the three governance paths in section 1;
- index and tracked worktree are clean;
- only the three pre-existing unrelated untracked paths exist;
- PR #67 is OPEN/Draft, base `main`, correct branch, and remote head equals the
  derived R2A execution HEAD; and
- protected-path metadata matches section 3 without content access.

Any mismatch returns `BLOCKED_LOCAL_OR_DEPLOYMENT_IDENTITY` and stops.

### B. Inherited immutable-deployment proof

Execute sections 4B through 4E of the R2 directive literally and once. The
primary channel remains one authenticated owner GET for fixed deployment
`dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB`, with a bounded in-memory parser. The single
predetermined `vercel curl --deployment` runtime-asset scan remains the only
fallback and is not a retry.

The repository execution HEAD and fixed deployment Git commit remain distinct.
The deployment must identify commit
`b6db05f61d80b39963981b5594c44f3692f57946`; it must never be compared to the
R2A governance execution HEAD.

No raw response, complete URL, environment value, key, token, cookie, HTML,
JavaScript, or response sample may cross the parser boundary. Only the
20-character Supabase project ref, classification, safe booleans, counts, and
fixed public deployment identity may be returned.

Stop before any Supabase, database, application-endpoint, migration, or import
contact. The Supabase 2026 Data API exposure changes do not affect R2A because
R2A performs no Supabase request.

### C. Classification

| Ref | Classification | R2A verdict |
|---|---|---|
| `dmvyaykhibmphrmekjbb` | `PRODUCTION` | `BLOCKED_PRODUCTION_REF` |
| `nqvnjqcxgngqsqkbpdfi` | `CLEAN_REPLACEMENT` | `PASS_TO_R3_TARGETED_SUPABASE_READ_ONLY_PREFLIGHT` |
| `fbieiotihlmpfzybowbt` | `OLD_DEVELOPMENT` | `PASS_TO_R3_TARGETED_SUPABASE_READ_ONLY_PREFLIGHT` |
| `vhiuiwolnlvlwvoaingd` | `FORMAL_STAGING` | `PASS_TO_R3_TARGETED_SUPABASE_READ_ONLY_PREFLIGHT` |
| any other value | `UNKNOWN` | `BLOCKED_UNKNOWN_TARGET` |

## 5. Required result

Return exactly one result beginning with:

```text
GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_SAFE_BINDING_RESULT_V2A
```

Allowed verdicts are the five classification verdicts in section 4C plus:

- `BLOCKED_BASH_PERMISSION`
- `BLOCKED_LOCAL_OR_DEPLOYMENT_IDENTITY`
- `BLOCKED_UNEXPECTED_LINK_OR_LOCAL_WRITE`
- `BLOCKED_VERCEL_AUTH`
- `BLOCKED_SAFE_BINDING_PROOF`
- `CHANGES_REQUIRED_MULTIPLE_DEPLOYMENT_BINDINGS`

Use the complete R2 result schema, changing only the marker to V2A and adding:

```yaml
permission_correction:
  tools_bash: true
  allowed_tools_bash: true
  permission_mode: dontAsk
  permission_bypass_used: false
  bash_first_call_executed: <true|false>
```

All prohibited-action counts must remain zero.

## 6. Stop condition

After the single V2A result, stop. Do not retry, perform R3, contact Supabase or
a database, inspect rows, edit, test, stage, commit, push, comment, apply a
migration, import postal data, change Vercel, redeploy, convert the PR to Ready,
merge, or contact Production.
