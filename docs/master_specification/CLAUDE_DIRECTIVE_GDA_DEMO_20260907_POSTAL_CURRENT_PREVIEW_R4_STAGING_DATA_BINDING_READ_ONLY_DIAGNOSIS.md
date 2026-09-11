# CLAUDE DIRECTIVE — GDA DEMO 2026-09-07 POSTAL CURRENT PREVIEW R4

## Staging data-binding read-only diagnosis

### 0. Status and authority

- Phase: `GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R4_STAGING_DATA_BINDING_READ_ONLY_DIAGNOSIS`
- Governance status: `EXACT_THREE_DOCUMENT_GOVERNANCE_CANDIDATE_UNSTAGED_UNCOMMITTED`
- Diagnosis owner: Anthropic Claude Code, once and only after a separate explicit Owner authorization.
- Independent acceptance owner: MacBook Codex.
- Result marker: `GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_STAGING_DATA_BINDING_READ_ONLY_DIAGNOSIS_RESULT_V4`
- This document authorizes nothing by itself.

The Owner has authorized only authoring and locally verifying exactly this
directive, `GYEON_DA_COMPLETION_PLAN.md`, and `GYEON_DA_PHASE_RESULTS.md`.
Stage, commit, push, PR mutation, Claude invocation, private-file transmission,
Vercel/provider access, Supabase/database access, migration, import, source or
test modification, deployment, Ready, merge, and Production contact remain
unauthorized until their own explicit gates.

### 1. Accepted R3 evidence

R3 used the fixed Preview alias in the Owner's authenticated browser session.
It performed two independent unsaved tests and created no customer, estimate,
database row, provider mutation, Git change, or Codex screenshot.

- Test A — Owner-triggered vehicle-registration OCR: customer-name reflection
  was visibly present, but postal code remained empty. Other personal and
  vehicle values are not reproduced in this repository record.
- Test B — public non-personal postal code entered into a clean manual form:
  after waiting longer than the UI's 400 ms debounce and moving focus away,
  postal input remained present, address stayed empty, and the explicit
  postal-lookup-unavailable/manual-entry notice became visible.
- R3 verdict: `CHANGES_REQUIRED_BOTH_DIRECTIONS`.

This proves a current Preview functional failure in both directions. It does
not prove which of the following is responsible: missing invoker binding,
wrong Preview project binding, absent migration, missing active import batch,
empty/incomplete master rows, RPC authorization failure, or UI trigger/state
logic. R4 exists to distinguish those causes before any repair.

### 2. Fixed identities

```yaml
repository: nisikawa-officeAZ/GYEON
branch: agent/gda-estimate-ocr-postal-clean-replacement-r1
pull_request: https://github.com/nisikawa-officeAZ/GYEON/pull/67
pull_request_state_at_authoring: OPEN
pull_request_draft_at_authoring: true
base: main
fixed_pre_r4_head: afa39aafabd5f57966f474724a0e24009c864bba
fixed_pre_r4_tree: 7eeab86664a8a13d7c7260cf34a7763e59b58089
fixed_pre_r4_parent: 4ae384037dd724b1a6cf797226343f087cddc564
preview_alias: dealeros-git-agent-gda-estimate-0307f5-nisikawa-5024s-projects.vercel.app
formal_staging_name: DealerOS-Dev-Next
formal_staging_ref: vhiuiwolnlvlwvoaingd
formal_staging_region: ap-northeast-1
production_name_prohibited: DealerOS-Prod
production_ref_prohibited: dmvyaykhibmphrmekjbb
```

The future diagnosis must stop as `BLOCKED_IDENTITY_MISMATCH` unless the
governance commit is a direct child of the fixed pre-R4 HEAD, changes exactly
the three governance paths listed in section 4, is normally pushed to the fixed
PR branch, the PR remains OPEN/Draft/base `main`, both PR checks pass, and the
formal Preview/Staging identities match exactly.

Any discovery of the Production name/ref, an unexpected Supabase ref, or an
unresolved target is a stop condition. Never fall back to Production.

### 3. Diagnosis questions

R4 must answer all of these without making a change:

1. Does the authenticated Estimate Wizard route bind both postal invokers to
   the expected Server Actions?
2. Do both UI directions trigger, and do non-`FOUND` results deliberately
   collapse to the visible unavailable/manual-entry behavior?
3. Does the Preview deployment have the two required public Supabase variable
   names in Preview scope, without reading or emitting either value?
4. Does the public URL's project-ref component resolve to the exact formal
   Staging ref, when inspected only through an already-public client URL or a
   provider-returned redacted ref?
5. Is migration version `20260901001246` present in formal Staging migration
   history?
6. Do the forward/reverse RPC signatures exist and does `authenticated` have
   execute privilege?
7. Is the singleton active-batch pointer non-null?
8. Is the active batch in a promoted/usable state and does it have at least one
   master row?
9. Is the selected public, non-personal probe postal code present in the active
   batch with one usable address result?
10. Which single boundary first explains both R3 failures, or are multiple
    independent defects proven?

Source presence or unit-test assertions alone cannot prove questions 3–9.
Likewise, database rows alone cannot prove the route/invoker call chain.

### 4. Exact future transmission/read allowlist

No file may be sent to or opened by Claude outside this list. The protected
path in section 5 remains metadata-only and is not part of this list.

1. `AGENTS.md`
2. `OPERATIONS_RULES.md`
3. `docs/master_specification/ENVIRONMENT_LEDGER.md`
4. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
5. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
6. `docs/master_specification/CODEX_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R3_AUTHENTICATED_BROWSER_POSTAL_AUTOFILL_VERIFICATION.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_R4_STAGING_DATA_BINDING_READ_ONLY_DIAGNOSIS.md`
8. `src/app/estimates/new/page.tsx`
9. `src/components/estimates/wizard/EstimateWizard.tsx`
10. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
11. `src/components/estimates/wizard/steps/Step1Customer.tsx`
12. `src/components/estimates/wizard/steps/postal-master-apply.ts`
13. `src/components/estimates/wizard/steps/postal-master-apply.test.ts`
14. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
15. `src/lib/geo/jp-postal-master-actions.ts`
16. `src/lib/geo/jp-postal-master-actions.test.ts`
17. `src/lib/geo/jp-postal-master-contract.ts`
18. `src/lib/geo/jp-postal-master-contract.test.ts`
19. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
20. `src/lib/supabase/server.ts`
21. `src/lib/supabase/preview-cookie-boundary.test.ts`
22. `supabase/migrations/20260901001246_jp_postal_master.sql`
23. `supabase/tests/jp_postal_master_rpc.test.sql`
24. `scripts/postal-master/import-japan-post.ts`
25. `scripts/postal-master/import-japan-post.test.ts`

Do not send OCR documents, screenshots, `.env*`, `.vercel`, credential files,
database dumps, logs, browser storage, cookies, tokens, command histories, raw
provider responses, or generated evidence from earlier private runs.

### 5. Protected path

`src/components/estimates/wizard/screens/ScreensPreview.tsx` must not be opened,
read, diffed, copied, transmitted, staged, or modified. Only these fixed
metadata values may be checked and reported:

```yaml
mode: -rw-r--r--
size: 31076
sha256: d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e
```

### 6. Future read-only operational allowance

This section defines the maximum future diagnostic scope; it is not current
execution authority. A separate Owner authorization must explicitly approve
transmission of the 25 allowed files and one read-only diagnostic touching the
formal Staging/provider metadata described here.

#### 6.1 Vercel/provider metadata

Allowed only after that authorization:

- Confirm the fixed Preview deployment and PR HEAD.
- Read variable **names and target scopes only** for
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Confirm whether each name exists in Preview scope.
- Confirm only the public Supabase project ref component; never emit the full
  URL, key, value, token, account metadata, or unrelated variable name.

Prohibited: `vercel link`, linking/configuration changes, env value reads,
downloads, pulls, token creation, bypass creation, redeploy, promotion, domain
changes, project changes, retry after an identity failure, or any provider
write.

#### 6.2 Formal Staging database metadata

Allowed only against exact ref `vhiuiwolnlvlwvoaingd`, using a pre-existing
read-only-capable connection supplied through the approved execution
environment. Do not read or print the connection string. Run no transaction
that can write, no function that is volatile or mutating, and no RPC import.

Return only booleans, stable classifications, and aggregate counts for:

- migration version `20260901001246` present;
- `to_regprocedure` existence for forward and reverse lookup signatures;
- `has_function_privilege` for role `authenticated` on those signatures;
- singleton active-batch row present and its `batch_id is not null` boolean;
- active batch status classification only;
- total master row count and active-batch row count;
- public probe code row presence and distinct usable-address count.

Never emit UUIDs, row contents, addresses, imported CSV data, customer data,
auth data, users, memberships, secrets, keys, SQL definitions returned from the
server, logs, or query errors. Collapse errors to one of the stable blocked or
failure classes in section 8.

Prohibited: migration apply/repair, import begin/append/finalize/rollback,
INSERT, UPDATE, DELETE, TRUNCATE, DDL, GRANT, REVOKE, function invocation that
can mutate, test-row creation, project linking, backup/restore, branch creation,
edge-function invocation, or Production contact.

### 7. Required analysis order

1. Identity gate and exact 25-path manifest gate.
2. Protected metadata gate.
3. Static route → component → invoker → Server Action → RPC map.
4. Preview variable-name/scope and public ref binding gate.
5. Formal Staging migration/RPC/privilege gate.
6. Active-batch/master-data/probe-presence gate.
7. Root-cause classification and minimum later repair boundary.
8. Confirm zero files changed, zero Git mutations, zero provider/DB writes, zero
   Production contacts, and exactly one diagnostic invocation.

Do not run tests in R4. Existing tests may be read as contract evidence only.
Executable tests belong to a later repair-verification gate.

### 8. Allowed verdicts

- `PASS_ROOT_CAUSE_PREVIEW_REF_MISMATCH`
- `PASS_ROOT_CAUSE_PREVIEW_ENV_NAME_OR_SCOPE_MISSING`
- `PASS_ROOT_CAUSE_STAGING_MIGRATION_ABSENT`
- `PASS_ROOT_CAUSE_STAGING_RPC_OR_GRANT_MISSING`
- `PASS_ROOT_CAUSE_STAGING_ACTIVE_BATCH_MISSING`
- `PASS_ROOT_CAUSE_STAGING_MASTER_ROWS_EMPTY`
- `PASS_ROOT_CAUSE_STAGING_PROBE_ROW_MISSING_OR_AMBIGUOUS`
- `PASS_ROOT_CAUSE_SERVER_ACTION_OR_INVOKER_BINDING_DEFECT`
- `PASS_ROOT_CAUSE_UI_TRIGGER_OR_STATE_DEFECT`
- `PASS_MULTIPLE_ROOT_CAUSES`
- `CHANGES_REQUIRED_INSUFFICIENT_EVIDENCE`
- `BLOCKED_IDENTITY_MISMATCH`
- `BLOCKED_MISSING_READ_ONLY_CREDENTIAL`
- `BLOCKED_PROVIDER_METADATA_ACCESS`
- `BLOCKED_STAGING_READ_ONLY_ACCESS`
- `BLOCKED_SCOPE_OR_PRIVACY_BOUNDARY`

No PASS is allowed unless the first causal boundary is positively identified
with both static and applicable environment evidence. A likely cause is not a
PASS.

### 9. Required result format

The first line must be exactly:

`GDA_DEMO_20260907_POSTAL_CURRENT_PREVIEW_STAGING_DATA_BINDING_READ_ONLY_DIAGNOSIS_RESULT_V4`

Then emit one YAML block containing only:

```yaml
verdict: <one allowed verdict>
identity:
  repository_branch_head_tree_match: true | false
  pr_open_draft_base_main: true | false
  checks_pass: true | false
  preview_alias_match: true | false
  formal_staging_ref_match: true | false | UNDETERMINED
  production_contacted: false
static_binding:
  page_binds_both_invokers: true | false | UNDETERMINED
  component_forwards_both_invokers: true | false | UNDETERMINED
  ui_triggers_both_directions: true | false | UNDETERMINED
  actions_call_expected_rpcs: true | false | UNDETERMINED
preview_config:
  required_variable_names_present_in_preview_scope: true | false | UNDETERMINED
  variable_values_read_or_emitted: false
staging:
  migration_present: true | false | UNDETERMINED
  forward_rpc_present: true | false | UNDETERMINED
  reverse_rpc_present: true | false | UNDETERMINED
  authenticated_execute_grants_present: true | false | UNDETERMINED
  active_batch_present: true | false | UNDETERMINED
  active_batch_usable: true | false | UNDETERMINED
  master_row_count_class: ZERO | NONZERO | UNDETERMINED
  active_batch_row_count_class: ZERO | NONZERO | UNDETERMINED
  public_probe_result_class: UNIQUE_USABLE | MISSING | AMBIGUOUS | UNDETERMINED
root_cause:
  first_failed_boundary: <stable class only>
  minimum_later_repair_scope: <path or environment class only>
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

No prose, raw command output, exact environment values, SQL output, personal
data, or secret may follow the YAML block.

### 10. Stop boundary

R4 ends with diagnosis only. Claude must not repair any source, test, migration,
data, environment variable, provider configuration, or deployment. MacBook
Codex independently reviews the returned evidence and defines a separate,
minimal R5 repair or environment-correction phase. Commit, push, database
change, import, Preview re-test, Ready, merge, and Production remain separate
Owner gates.
