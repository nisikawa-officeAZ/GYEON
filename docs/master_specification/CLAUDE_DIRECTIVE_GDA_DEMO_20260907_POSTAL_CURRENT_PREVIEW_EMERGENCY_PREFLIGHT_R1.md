# CLAUDE DIRECTIVE — GDA DEMO 20260907 POSTAL CURRENT PREVIEW EMERGENCY PREFLIGHT R1

## 0. Status and authority boundary

This document is an **uncommitted governance candidate** authored by MacBook
Codex for Owner review. Its presence does not authorize execution by itself.

If the Owner separately authorizes this directive, Claude Code may perform
exactly one tool-enabled, read-only preflight. That preflight may identify the
Supabase project currently configured for the fixed Vercel Preview and inspect
non-secret project, migration, table, function, and postal-batch metadata.

This directive does **not** authorize:

- any database or Supabase write;
- migration apply, repair, reset, link, branch, pause, restore, or project
  creation;
- Japan Post CSV download, validation, import, finalize, rollback, or promotion;
- Vercel environment-variable edit, redeploy, promote, alias change, or project
  mutation;
- source, test, dependency, lockfile, Git index, commit, push, PR, Ready, merge,
  release, Production, or provider mutation;
- reading or printing any API key, service-role key, access token, cookie,
  password, or complete environment-variable value; or
- retrying a failed or ambiguous environment contact.

The held clean-replacement phase
`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3K_R1` remains held and is not
cancelled or superseded. This emergency route exists only to determine whether
the **already working, authenticated Preview database** can safely receive one
later additive postal-only change under a separate Owner gate.

## 1. Fixed repository and deployment identity

```yaml
phase: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R1
mode: TOOL_ENABLED_READ_ONLY_ONE_TIME
repository: nisikawa-officeAZ/GYEON
pull_request: 67
pull_request_url: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state: OPEN
pull_request_draft: true
base: main
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
fixed_pre_governance_parent: b6db05f61d80b39963981b5594c44f3692f57946
fixed_pre_governance_parent_tree: 0d575a81fe2e4d338f55de19a5d64c03e6373b95
fixed_pre_governance_parent_parent: 1d8474f5c97b9e9e7b70114edb19d654849a6264
required_execution_head: DERIVED_SINGLE_DIRECT_CHILD_OF_FIXED_PRE_GOVERNANCE_PARENT
required_execution_delta: EXACT_THREE_GOVERNANCE_PATHS_ONLY
exact_governance_delta_paths:
  - docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R1.md
  - docs/master_specification/GYEON_DA_COMPLETION_PLAN.md
  - docs/master_specification/GYEON_DA_PHASE_RESULTS.md
vercel_team_slug: nisikawa-5024s-projects
vercel_project_name: dealeros
vercel_project_id: prj_aHtlx2Tsj21TWNDFbO20BN4C7J84
vercel_deployment_id: dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB
vercel_preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
vercel_target: preview
vercel_state: READY
clean_replacement_name: DealerOS-Dev-Clean-R5
clean_replacement_ref: nqvnjqcxgngqsqkbpdfi
production_ref_prohibited: dmvyaykhibmphrmekjbb
old_development_ref_read_only: fbieiotihlmpfzybowbt
formal_staging_ref_read_only: vhiuiwolnlvlwvoaingd
result_marker: GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_RESULT_V1
```

At execution time, derive the current governance HEAD and tree. Fail closed
before external access unless that HEAD is the single direct child of
`b6db05f61d80b39963981b5594c44f3692f57946`, the parent's tree is exactly
`0d575a81fe2e4d338f55de19a5d64c03e6373b95`, the committed delta from that
parent is exactly the three governance paths declared above, and PR #67's remote
head equals the derived current governance HEAD. Also fail closed if the
repository, branch, PR, deployment ID, alias, project name, or project ID
differs.

The worktree currently contains three unrelated, untracked postal diagnostic
documents. They are not part of this preflight and must remain untouched,
unstaged, unmodified, and uncommitted:

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_REDACTED_CAPTURE.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3K_R1_PREFLIGHT_IDENTITY_GATE_DIAGNOSIS.md`

## 2. Current independently observed facts

MacBook Codex observed the following through read-only checks on 2026-09-07:

1. At authoring time, PR #67 is OPEN, Draft, base `main`, and MERGEABLE at the
   fixed pre-governance parent above.
2. `DealerOS-Dev-Clean-R5` / `nqvnjqcxgngqsqkbpdfi` is `ACTIVE_HEALTHY`,
   region `ap-northeast-1`, PostgreSQL `17.6.1.166`.
3. The clean replacement currently reports zero migrations and zero
   `public`/`private` tables.
4. The repository contains 113 formal top-level migration SQL files plus the
   separate draft SQL tree.
5. The postal migration and import tooling exist, but no real Japan Post CSV is
   committed in the repository.
6. The fixed Preview is READY and authenticated use has been observed, but its
   exact Supabase project ref has not yet been independently proven.
7. Existing CR6 hosted-execution adapter identity is stale relative to the fixed
   HEAD and must not be invoked for this emergency route.

## 3. Literal repository read scope

Claude may read only these repository paths after a separate Owner execution
authorization:

1. `AGENTS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_R1.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/ENVIRONMENT_LEDGER.md`
6. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_ESTIMATE_WIZARD_HOTFIX_R1.md`
8. `supabase/migrations/20260901001246_jp_postal_master.sql`
9. `scripts/postal-master/import-japan-post.ts`
10. `src/lib/geo/jp-postal-master-actions.ts`
11. `src/lib/geo/jp-postal-master-contract.ts`
12. `src/lib/geo/postal-lookup.ts`

For `src/components/estimates/wizard/screens/ScreensPreview.tsx`, Claude may
inspect only pathname, Git state, mode, size, and SHA-256. It must not open,
read, diff, copy, stage, or modify the file. Expected metadata is:

```yaml
mode: -rw-r--r--
size: 31076
sha256: d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e
```

Expected postal-path SHA-256 values:

```yaml
supabase/migrations/20260901001246_jp_postal_master.sql: 76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d
scripts/postal-master/import-japan-post.ts: 46d0029e70fee826c6b06be5c182e85865805c0f4a2f67f11bc44be009af6ab6
src/lib/geo/jp-postal-master-actions.ts: 0b02e7aacf83330308be806f805117dc9ce3ab71a5f2df0ca0cd49ce9a458d5e
src/lib/geo/postal-lookup.ts: b512c06f27ddf6d63ec88605fd0406fd0a1cc3f40ab1b5fbefade0bffac7ddb9
```

Any mismatch is `BLOCKED_SOURCE_IDENTITY` and ends the run before environment
access.

## 4. Exact read-only preflight sequence

### A. Local identity gate

Verify, without changing the index or worktree:

- repository root and branch;
- current HEAD/tree derived at runtime, with exactly one parent equal to the
  fixed pre-governance parent and exactly the three governance paths in its
  committed delta;
- clean index and zero tracked worktree changes;
- PR number, state, Draft status, base, head branch, and head OID;
- Vercel deployment ID, alias, target `preview`, and READY state;
- the four postal-path hashes above;
- protected-path metadata only; and
- the directive, completion plan, and phase ledger are tracked at the derived
  current governance HEAD; and
- the exact three pre-existing untracked paths in section 1 are the only
  untracked paths.

Do not run the existing hosted-execution adapter. Do not create a burn record,
lock, evidence tree, linked worktree, or migration staging directory.

### B. Determine the current Preview project ref

Use Vercel read-only metadata for the fixed deployment and the Preview
environment scoped to the exact Git branch. Inspect only the value of
`NEXT_PUBLIC_SUPABASE_URL` and reduce it in memory to the 20-character project
ref. Do not print the URL or any environment-variable value.

The only permitted Vercel output is:

```json
{
  "deploymentId": "dpl_6TeZEdDpj1AAxL5V8XzJL84PkMtB",
  "gitBranch": "agent/gda-estimate-ocr-postal-clean-replacement-r1",
  "supabaseProjectRef": "<20-character-ref>",
  "supabaseUrlPresent": true,
  "publicClientKeyPresent": true,
  "serverKeyPresent": true
}
```

The two key fields are presence booleans only. Key values, lengths, prefixes,
suffixes, fingerprints, hashes, or ciphertext must not be emitted.

Do not use `vercel env pull`, `vercel env export`, `printenv`, `env`, shell
debug tracing, process dumps, or a command that prints the complete process
environment. Do not link or mutate the repository. If the exact single-variable
Vercel read cannot be completed without exporting other values, stop as
`BLOCKED_SAFE_BINDING_PROOF`.

Because a Vercel environment-variable change affects only later deployments,
project-level current configuration alone is insufficient. The proof must be
bound to the fixed deployment or corroborated by a read-only runtime request
whose network destination hostname contains the same ref.

### C. Target classification gate

Classify the redacted ref before any database read:

| Observed ref | Classification | Action |
|---|---|---|
| `dmvyaykhibmphrmekjbb` | `BLOCKED_PRODUCTION_REF` | Stop immediately; no database contact. |
| unknown/unlisted | `BLOCKED_UNKNOWN_TARGET` | Stop immediately; no database contact. |
| `nqvnjqcxgngqsqkbpdfi` | `CLEAN_REPLACEMENT_CANDIDATE` | Read-only metadata inspection only. |
| `fbieiotihlmpfzybowbt` | `OLD_DEVELOPMENT_PREVIEW_CANDIDATE` | Read-only metadata inspection only. |
| `vhiuiwolnlvlwvoaingd` | `FORMAL_STAGING_PREVIEW_CANDIDATE` | Read-only metadata inspection only. |

No classification authorizes later writing to that project.

### D. Supabase read-only metadata inspection

Against only the classified non-production ref, use current Supabase management
read APIs to record:

- project name, ref, organization, region, health, and PostgreSQL version;
- migration count and whether migration version `20260901001246` is present;
- whether these objects exist:
  - `private.jp_postal_import_batches`
  - `private.jp_postal_master`
  - `private.jp_postal_active_batch`
  - `public.jp_postal_master_lookup_forward(text)`
  - `public.jp_postal_master_lookup_reverse(text)`
- if and only if the three tables exist, read-only counts for import batches,
  promoted batches, master rows, and whether the active-batch pointer is non-null;
- whether the existing application baseline needed for the currently
  authenticated Preview remains present: `auth.users`, `public.dealers`, and a
  dealer membership/workspace relation; and
- Data API exposure metadata sufficient to confirm that the private tables are
  not exposed directly and only the intended lookup RPC surface is reachable.

Only literal `SELECT`, catalog inspection, Supabase `get_project`,
`list_migrations`, and `list_tables` operations are permitted. Do not use a SQL
batch containing a semicolon followed by another statement. Do not execute
functions that write, acquire application locks, import, finalize, rollback, or
change session/database state.

### E. Determine the later emergency route without executing it

Produce one of these recommendations:

1. `PASS_TO_AUTHOR_POSTAL_ONLY_APPLY_GATE`
   - fixed Preview ref is a permitted non-production project;
   - normal authenticated Preview baseline exists;
   - postal migration is absent;
   - no conflicting postal objects or migration-history drift exists; and
   - the later exact change can be limited to the single postal migration,
     separately supplied official Japan Post CSV, and a post-apply Preview
     verification.
2. `PASS_TO_AUTHOR_DATA_IMPORT_ONLY_GATE`
   - the exact postal migration and objects already exist;
   - official data is not promoted; and
   - only the separately authorized official data import and verification are
     missing.
3. `ALREADY_ACTIVE_VERIFY_ONLY`
   - migration, objects, promoted batch, active pointer, and non-zero official
     master rows already exist.
4. `BLOCKED_EMPTY_REPLACEMENT_NOT_DEMO_SAFE`
   - the Preview ref is the empty clean replacement and its ordinary Auth/dealer
     baseline is absent.
5. `CHANGES_REQUIRED_SCHEMA_OR_HISTORY_DRIFT`
   - partial/conflicting objects, unexpected migration history, ambiguous batch
     state, or unsafe API exposure exists.
6. One of the target/binding/source blockers defined above.

## 5. Later postal-only apply gate — explicitly not authorized here

If and only if this R1 result is independently accepted by MacBook Codex and the
Owner separately authorizes an R2 apply directive, the later change must remain
bounded to:

1. one exact target ref fixed from the accepted R1 evidence;
2. `supabase/migrations/20260901001246_jp_postal_master.sql` only when absent;
3. one official Japan Post CSV supplied outside Git, with publication date,
   byte count, row count, and SHA-256 fixed before import;
4. the existing `scripts/postal-master/import-japan-post.ts` import path;
5. no existing customer, vehicle, estimate, pricing, Auth, dealer, Storage,
   billing, LINE, or inventory data mutation;
6. no Production contact;
7. no retry after uncertain apply or import outcome; and
8. a separate authenticated Preview verification before any Ready or merge
   decision.

Environment-variable changes, if later required, must receive their own exact
target/value-presence gate and a separate redeployment authorization. They must
not be bundled silently into migration or data import.

## 6. Required result format

Return exactly one result beginning with:

```text
GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_EMERGENCY_PREFLIGHT_RESULT_V1
```

The result must contain:

```yaml
verdict: <one allowed verdict from section 4E>
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
  alias: <value>
  ready: <true|false>
  preview: <true|false>
binding_proof:
  method: <DEPLOYMENT_METADATA|RUNTIME_NETWORK|BOTH>
  supabase_project_ref: <20-character-ref-or-null>
  secrets_emitted: false
target_metadata:
  name: <value-or-null>
  ref: <value-or-null>
  region: <value-or-null>
  health: <value-or-null>
  postgres_version: <value-or-null>
migration_and_postal_state:
  migration_count: <integer-or-null>
  postal_migration_present: <true|false|null>
  required_objects_present: <true|false|null>
  import_batch_count: <integer-or-null>
  promoted_batch_count: <integer-or-null>
  master_row_count: <integer-or-null>
  active_batch_present: <true|false|null>
application_baseline:
  auth_users_present: <true|false|null>
  dealers_present: <true|false|null>
  workspace_membership_present: <true|false|null>
api_boundary:
  private_tables_directly_exposed: <true|false|null>
  authenticated_lookup_rpc_present: <true|false|null>
prohibited_actions:
  database_writes: 0
  migration_applies: 0
  imports_or_promotions: 0
  vercel_mutations_or_deployments: 0
  git_mutations: 0
  production_contacts: 0
  retries: 0
next_exact_gate: <single concise recommendation>
```

Do not include secrets, full environment values, customer data, user IDs,
addresses, OCR content, or row samples.

## 7. Stop condition

After emitting the single result, stop. Do not repair, edit, test, stage, commit,
push, comment on GitHub, apply a migration, import data, change Vercel, redeploy,
or ask Claude to continue automatically.
