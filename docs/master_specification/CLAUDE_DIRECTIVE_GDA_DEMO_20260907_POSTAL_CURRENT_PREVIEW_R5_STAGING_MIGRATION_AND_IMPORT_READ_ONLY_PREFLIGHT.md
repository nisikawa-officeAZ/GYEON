# CLAUDE DIRECTIVE — GDA DEMO 2026-09-07 POSTAL CURRENT PREVIEW R5

## Staging migration and postal-master import read-only preflight

### 0. Status and authority

- Phase: `GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R5_STAGING_MIGRATION_AND_IMPORT_READ_ONLY_PREFLIGHT`
- Governance status: `EXACT_THREE_DOCUMENT_GOVERNANCE_CANDIDATE_UNSTAGED_UNCOMMITTED`
- Evidence collection owner: MacBook Codex, only after separate explicit Owner authorization.
- Diagnostic owner: Anthropic Claude Code, once and only after separate explicit Owner authorization and evidence collection.
- Independent acceptance owner: MacBook Codex.
- Result marker: `GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_STAGING_MIGRATION_AND_IMPORT_READ_ONLY_PREFLIGHT_RESULT_V5`
- This document authorizes nothing by itself.

The Owner has authorized only authoring and locally verifying exactly this
directive, `GYEON_DA_COMPLETION_PLAN.md`, and `GYEON_DA_PHASE_RESULTS.md`.
Stage, commit, push, PR mutation, provider access, Supabase/database access,
Claude invocation, private-file transmission, migration application, postal
data acquisition/import, source/test edits, deployment, Preview re-test,
Ready, merge, and Production contact remain unauthorized until their own
explicit gates.

### 1. R4 result disposition

R4 ran once with all Claude tools disabled and transmitted exactly the 25
allowed files plus non-secret aggregate evidence. Claude returned the required
marker with verdict `BLOCKED_PROVIDER_METADATA_ACCESS`. MacBook Codex accepts
the blocked provider classification but does not accept the result as a
complete or internally consistent PASS.

Independent corrections:

1. `component_forwards_both_invokers` is `true`, not `UNDETERMINED`. The page,
   wizard component, runtime contract, customer step, and both Server Actions
   form a visible static chain for the forward and reverse invokers.
2. Formal Staging has no migration `20260901001246`, lookup RPCs, execute
   grants, active-batch table, or postal-master table.
3. Because the tables are absent, row counts and probe results were not and
   cannot safely be queried. They are `UNDETERMINED`, not `ZERO` or `MISSING`.
4. No Vercel environment value was read. The attempted variable-name/scope
   check was refused by the execution safety gate and was not retried or
   bypassed.

R4 acceptance classification:
`CHANGES_REQUIRED_RESULT_CONSISTENCY_WITH_CONFIRMED_STAGING_SCHEMA_ABSENCE`.
No R4 rerun is required. R5 closes only the missing pre-application evidence.

### 2. Fixed identities

```yaml
repository: nisikawa-officeAZ/GYEON
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state_at_authoring: OPEN
pull_request_draft_at_authoring: true
base: main
fixed_pre_r5_head: 20032adce2dd007d053e1f37361e0f0d18c8e399
fixed_pre_r5_tree: f0f8fd7c201c792388c080ec718ec20cf6f57539
fixed_pre_r5_parent: afa39aafabd5f57966f474724a0e24009c864bba
preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
formal_staging_name: DealerOS-Dev-Next
formal_staging_ref: vhiuiwolnlvlwvoaingd
formal_staging_region: ap-northeast-1
production_name_prohibited: DealerOS-Prod
production_ref_prohibited: dmvyaykhibmphrmekjbb
```

The future preflight must stop as `BLOCKED_IDENTITY_MISMATCH` unless the
governance commit is a direct child of the fixed pre-R5 HEAD, changes exactly
the three governance paths listed in section 4, is normally pushed to the
fixed PR branch, the PR remains OPEN/Draft/base `main`, and all PR checks pass.

Any Production identity, unexpected Supabase ref, unresolved target, or
ambiguous provider project is an immediate stop. Never fall back to Production.

### 3. Objective and questions

R5 must answer, without changing any system:

1. Does the fixed Preview deployment belong to the intended Vercel project?
2. Are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` present
   in Preview scope? Values must never be opened, copied, downloaded, or
   emitted.
3. Does the public project-ref component used by that Preview equal exactly
   `vhiuiwolnlvlwvoaingd`?
4. Is formal Staging still the exact project name/ref/region above?
5. Is migration `20260901001246` still absent, with both lookup RPCs and both
   private tables absent?
6. Does the committed migration source have the fixed hash in section 6 and
   retain its fail-closed private-table, membership-check, revoke/grant, and
   versioned active-batch contract?
7. Does its required predecessor `public.wiz_is_any_active_member()` exist in
   formal Staging before any application?
8. Is the import program pinned to one immutable dataset identity consisting
   of source date, SHA-256, and expected row count, without downloading or
   importing data during R5?
9. Are the migration-application gate and postal-data-import gate explicitly
   separate, with a verification stop between them?
10. What exact later action is safe next: provider correction, migration apply,
    dataset preparation, or no-go?

### 4. Exact future transmission/read allowlist

No file may be sent to or opened by Claude outside this list. The protected
path in section 5 is metadata-only and is not part of this list.

1. `AGENTS.md`
2. `OPERATIONS_RULES.md`
3. `docs/master_specification/ENVIRONMENT_LEDGER.md`
4. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
5. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R4_STAGING_DATA_BINDING_READ_ONLY_DIAGNOSIS.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R5_STAGING_MIGRATION_AND_IMPORT_READ_ONLY_PREFLIGHT.md`
8. `supabase/migrations/20260901001246_jp_postal_master.sql`
9. `supabase/tests/jp_postal_master_rpc.test.sql`
10. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
11. `scripts/postal-master/import-japan-post.ts`
12. `scripts/postal-master/import-japan-post.test.ts`
13. `src/lib/supabase/server.ts`
14. `src/lib/geo/jp-postal-master-actions.ts`
15. `src/app/estimates/new/page.tsx`

Do not send OCR documents, screenshots, `.env*`, `.vercel`, credentials,
database dumps, CSV contents, browser storage, cookies, tokens, command
history, raw provider responses, or generated private evidence.

### 5. Protected path

`src/components/estimates/wizard/screens/ScreensPreview.tsx` must not be opened,
read, diffed, copied, transmitted, staged, or modified. Only these fixed
metadata values may be checked and reported:

```yaml
mode: -rw-r--r--
size: 31076
sha256: d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e
```

### 6. Fixed source hashes

```yaml
migration_sql: 76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d
rpc_test_sql: c77fe474dd038b0de04d9e038c3191003a230f27884a6834ec85635fa1e153cd
import_program: 46d0029e70fee826c6b06be5c182e85865805c0f4a2f67f11bc44be009af6ab6
import_test: 1cc766e86b4d828e5c81fabb8808c373981d9e639ae9407290391515f42168cd
migration_contract_test: 6685578850c2f0d4078e2a78aa9563d3e6b389908242c8184cde02bdad92ca60
supabase_server: 6786460f23b68b33b496e289e7de35bc10de518e8f5cf8e85b8adb79731d1c85
postal_actions: 0b02e7aacf83330308be806f805117dc9ce3ab71a5f2df0ca0cd49ce9a458d5e
estimate_page: 9e2ee5f47eed8421856a9d7f645f8052ae47a02adac294b998ca48f148128621
```

Any mismatch is `BLOCKED_SOURCE_HASH_MISMATCH`. Do not normalize, regenerate,
or repair source during R5.

### 7. Future evidence-collection boundary

This section defines a maximum future scope. It is not current execution
authority.

#### 7.1 Provider evidence

After separate authorization, MacBook Codex may inspect the authenticated
Vercel UI manually and return only these booleans/classes to Claude:

- fixed project and deployment match;
- each of the two required variable names present in Preview scope;
- public project-ref component equals formal Staging;
- zero values opened or emitted;
- zero provider writes.

Do not use `vercel env pull`, read values, create tokens or bypasses, relink a
project, redeploy, promote, change domains, or retry a refused CLI path. If the
manual UI cannot prove the facts without opening a value, return
`BLOCKED_PROVIDER_METADATA_ACCESS`.

#### 7.2 Formal Staging evidence

After separate authorization, MacBook Codex may use the existing Supabase
connector against exact project `vhiuiwolnlvlwvoaingd` to return only:

- project identity booleans and health class;
- target migration present/absent;
- lookup RPC and private-table present/absent booleans;
- predecessor membership function present/absent boolean;
- no row counts when the master tables are absent;
- no row contents, UUIDs, addresses, user/auth data, secrets, or raw errors.

Only constant/select catalog queries are allowed. No migration, DDL, DML,
GRANT/REVOKE, RPC import, function execution that can mutate, test rows,
backup/restore, branch action, or Production contact is permitted.

#### 7.3 Dataset readiness evidence

R5 may inspect only an Owner-designated local dataset candidate's filename,
byte size, source date, SHA-256, and expected row count. It must not transmit
the dataset or any row content to Claude. If no candidate has been designated,
return `NOT_PREPARED`; do not download one automatically.

### 8. Required analysis order

1. Identity and exact 15-path manifest gate.
2. Protected metadata and fixed source-hash gate.
3. Provider project, Preview variable-name/scope, and public-ref gate.
4. Formal Staging identity and current schema-absence reconfirmation.
5. Migration predecessor and static security-contract gate.
6. Dataset identity/readiness gate.
7. Separate later migration-apply and import-apply gates.
8. Confirm zero files changed, zero Git/provider/database writes, zero
   Production contacts, and exactly one Claude invocation.

Do not run tests in R5. Existing tests are read-only contract evidence. Do not
apply the migration, acquire/import the dataset, or re-test Preview.

### 9. Allowed verdicts

- `PASS_TO_R6_STAGING_MIGRATION_APPLY_GOVERNANCE`
- `CHANGES_REQUIRED_PREVIEW_BINDING_UNCONFIRMED`
- `CHANGES_REQUIRED_PREVIEW_BINDING_MISMATCH`
- `CHANGES_REQUIRED_MIGRATION_PREDECESSOR_MISSING`
- `CHANGES_REQUIRED_MIGRATION_SOURCE_OR_SECURITY_CONTRACT`
- `CHANGES_REQUIRED_DATASET_NOT_PREPARED`
- `CHANGES_REQUIRED_MULTIPLE`
- `BLOCKED_IDENTITY_MISMATCH`
- `BLOCKED_SOURCE_HASH_MISMATCH`
- `BLOCKED_PROVIDER_METADATA_ACCESS`
- `BLOCKED_STAGING_READ_ONLY_ACCESS`
- `BLOCKED_SCOPE_OR_PRIVACY_BOUNDARY`

`PASS_TO_R6_STAGING_MIGRATION_APPLY_GOVERNANCE` requires exact Preview→formal
Staging binding, target migration absence, predecessor presence, all fixed
hashes, and an explicit safe migration-only next gate. Dataset readiness is
reported separately and does not authorize import.

### 10. Required result format

The first line must be exactly:

`GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_STAGING_MIGRATION_AND_IMPORT_READ_ONLY_PREFLIGHT_RESULT_V5`

Then emit one YAML block containing only:

```yaml
verdict: <one allowed verdict>
identity:
  repository_branch_head_tree_match: true | false
  pr_open_draft_base_main: true | false
  checks_pass: true | false
  preview_alias_match: true | false
  formal_staging_identity_match: true | false | UNDETERMINED
  production_contacted: false
r4_correction:
  component_forwards_both_invokers: true
  absent_table_counts_and_probe_class: UNDETERMINED
provider:
  project_deployment_match: true | false | UNDETERMINED
  required_variable_names_present_in_preview_scope: true | false | UNDETERMINED
  public_ref_matches_formal_staging: true | false | UNDETERMINED
  values_read_or_emitted: false
staging:
  migration_present: true | false | UNDETERMINED
  forward_rpc_present: true | false | UNDETERMINED
  reverse_rpc_present: true | false | UNDETERMINED
  active_batch_table_present: true | false | UNDETERMINED
  master_table_present: true | false | UNDETERMINED
  predecessor_membership_function_present: true | false | UNDETERMINED
source:
  all_fixed_hashes_match: true | false
  migration_security_contract_match: true | false | UNDETERMINED
dataset:
  readiness: READY_METADATA_ONLY | NOT_PREPARED | BLOCKED
  content_read_or_transmitted: false
gates:
  migration_apply_separate: true | false
  import_apply_separate: true | false
  preview_retest_separate: true | false
safety:
  allowed_files_read_count: <integer>
  disallowed_files_read_count: 0
  pii_or_secret_emitted: false
  provider_writes: 0
  database_writes: 0
  git_mutations: 0
  files_changed: 0
  claude_invocation_count: 1
next: STOP_FOR_CODEX_AND_OWNER_DECISION
```

No prose, raw command output, secret, environment value, SQL output, dataset
content, or personal data may follow the YAML block.

### 11. Stop boundary

R5 ends with preflight only. R6 migration application, post-migration schema
verification, dataset preparation, postal import, post-import verification,
Preview retest, commit, push, Ready, merge, and Production remain separate
Owner gates.
