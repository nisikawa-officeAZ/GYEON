# Claude Directive — GDA Estimate Wizard Postal Master R5 CR1 Current Migration Manifest Reconciliation

## 1. Directive identity

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION` |
| Directive | `GDA_POSTAL_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION_DIRECTIVE_V1` |
| Required result marker | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION_RESULT_V1` |
| Mode | One tool-disabled, read-only diagnosis after separate Owner authorization |
| Repository | `nisikawa-officeAZ/GYEON` |
| Coordination PR | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67) |
| Fixed predecessor HEAD / tree | `4e3aa471ed776ccd360cd6405ccdc850fced5aaa` / `e7cadd5903ab29143e55a03ccb4a71cffe8bdfe1` |
| Execution HEAD / tree | Supplied by MacBook Codex after this governance candidate is committed and normally pushed |

This directive authorizes no action by itself. Claude may run once only after
the Owner separately approves the exact private-file transmission and one
tool-disabled read-only diagnosis against the delivered execution identity.

## 2. Objective

Return one evidence-backed recommendation for the exact current clean-
replacement Development migration manifest. Resolve the conflict between:

- the accepted R5 disposable replay, which staged 112 of the current 113
  top-level migration SQL files and excluded only the protected LINE migration;
  and
- the historical B-R3 manifest, which existed at a 101-file source state,
  executed 98 paths, and excluded both GYEON provisioning migrations plus the
  protected LINE migration.

Also determine whether the historical `gyeon_products` active-member SELECT
policy and canonical five-bucket prerequisites are already closed by the
current forward migration and focused test, or still require a new source
repair before the next disposable acceptance.

This is a manifest and prerequisite diagnosis. It is not a migration design,
SQL repair, runtime test, Supabase preflight, or project-creation task.

## 3. Fixed business and environment decisions

1. Clean replacement Development is the selected remediation. In-place
   migration-history relabeling is rejected.
2. The old Development project `fbieiotihlmpfzybowbt` remains read-only until
   an accepted cutover. Do not contact it during this diagnosis.
3. The replacement region is owner-ratified as `ap-northeast-1`.
4. GYEON partner onboarding remains disabled. No diagnosis may authorize its
   activation, import, invitation, claim, or profile-completion workflow.
5. The LINE migration remains protected and excluded. Its contents are never
   transmitted, opened, read, diffed, copied, hashed by Claude, or executed.
6. The closed monthly-invoice finance track remains closed.
7. Current R5 evidence is `E2_LOCAL_DISPOSABLE_DB`; it is not hosted,
   Development, Staging, Production, or provider evidence.

## 4. Exact private read allowlist

Claude may receive and read exactly these twelve files and no others:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/ENVIRONMENT_LEDGER.md`
5. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md`
6. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
7. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DISPOSABLE_DB_VERIFICATION_PLAN.md`
8. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
9. `supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql`
10. `supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql`
11. `supabase/migrations/20260812091313_gyeon_products_storage_authority.sql`
12. `supabase/tests/gyeon_products_storage_authority.test.sql`

Direct dependencies outside this list must be reported by exact path as
`BLOCKED_INPUT`; they must not be opened or inferred. A requested expansion
requires a new committed directive and separate Owner approval.

## 5. Codex-supplied metadata attestation

MacBook Codex supplies a non-secret attestation with the later invocation:

- exact execution HEAD/tree and upstream ahead/behind;
- clean index/worktree;
- PR #67 OPEN/Draft, base `main`, and exact remote HEAD;
- all 113 top-level formal migration pathnames in byte-sorted order;
- mode, Git blob, and SHA-256 for every non-protected migration;
- pathname, mode, Git blob, and clean state only for the protected LINE
  migration;
- R5 retained manifest count/hash and accepted aggregate evidence hash;
- current one-exclusion and three-exclusion aggregate manifest hashes; and
- protected-path pathname/mode/blob/Git-state metadata only.

Claude must not recalculate the protected LINE content hash. It must verify
that the attestation is internally complete and classify any missing or
duplicate path as `BLOCKED_INPUT`.

## 6. Required diagnosis questions

### CR1-A — Current manifest completeness

1. Does the metadata attestation contain exactly 113 unique top-level formal
   migration paths in deterministic order?
2. Does the proposed selected manifest contain every required non-frozen
   dependency exactly once and exclude the protected LINE path exactly once?
3. Are `DRAFT_DO_NOT_APPLY`, seeds, tests, archived SQL, generated runtime SQL,
   and directories below `supabase/migrations/` absent from the executable
   manifest?
4. Does the postal target remain exactly
   `20260901001246_jp_postal_master.sql` with SHA-256
   `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`?

### CR1-B — Provisioning-pair disposition

Determine one of these exact dispositions and justify it from the allowlisted
source and accepted R5 evidence:

- `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`: both provisioning migrations stay
  in the executable manifest as inert server-only schema/RPC infrastructure,
  while activation/configuration/import remains prohibited; or
- `EXCLUDE_BOTH`: both provisioning migrations remain outside the manifest,
  and all dependent functions/objects must be proved absent after replay.

Never include only the search-path migration without its prerequisite
provisioning migration. Never treat schema presence as authority to enable the
feature. If neither disposition is provable from the allowlist, return
`BLOCKED_INPUT` with the minimum exact additional path list.

### CR1-C — Product policy and Storage prerequisite

Determine whether
`20260812091313_gyeon_products_storage_authority.sql` plus
`gyeon_products_storage_authority.test.sql` already closes the historical
forward-repair requirement at the current source identity.

The result must separately state:

- active-member product-read policy status;
- authenticated write-denial status;
- service-role CRUD boundary status;
- exact five-bucket configuration status;
- `completion-reports` fail-closed/absence status;
- operation-specific Storage policy coverage; and
- whether any remaining source prerequisite blocks CR3.

Do not reopen an accepted repair merely because older sections still describe
it as future work. Do not mark it closed solely because a migration file
exists; use the accepted ledger/runtime evidence and focused test contract.

### CR1-D — Exact recommendation

Return exactly one recommended current manifest with:

- executable path count;
- exact exclusion path list;
- aggregate manifest hash supplied by Codex;
- the provisioning disposition;
- postal dependency status;
- product/Storage prerequisite status;
- any remaining exact source blocker; and
- the minimum next CR2 or CR3 gate.

If source repair is required, name the smallest literal proposed path set but
do not design or edit the repair in this phase. If no repair is required,
state `CR2_NOT_REQUIRED` and recommend CR3 fresh disposable governance only.

## 7. Mandatory result format

Return one Markdown report with this exact top-level structure:

```text
GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION_RESULT_V1
verdict: <one allowed verdict>
execution_identity:
scope_and_protected_path_evidence:
113_path_attestation:
r5_vs_b_r3_reconciliation:
provisioning_pair_disposition:
product_policy_and_storage_prerequisite:
recommended_manifest:
remaining_blockers:
next_gate:
prohibited_action_attestation:
```

Allowed verdicts:

- `READY_FOR_CR1_MANIFEST_RATIFICATION`
- `CHANGES_REQUIRED_GOVERNANCE`
- `CHANGES_REQUIRED_SOURCE`
- `BLOCKED_INPUT`

`PASS`, `READY_FOR_PROJECT_CREATION`, and any hosted-apply verdict are invalid.
CR1 cannot authorize project creation.

## 8. Prohibited actions

Claude must not:

- write, edit, format, create, delete, rename, stage, commit, push, or mutate a
  PR;
- run tests, typecheck, build, package installation, Supabase CLI, PostgreSQL,
  Docker, Colima, Auth, PostgREST, browser, Vercel, or provider commands;
- use network, web search, GitHub API, Supabase Management API, or external
  services;
- connect to Development, Staging, Production, or any disposable runtime;
- inspect `.env*`, secrets, keys, tokens, credentials, user/customer/vehicle
  rows, Auth identities, or Storage objects;
- open any file outside the exact twelve-file allowlist; or
- open/read/diff/copy/hash the contents of
  `src/components/estimates/wizard/screens/ScreensPreview.tsx` or
  `supabase/migrations/20260801110110_line_link_tokens.sql`.

## 9. Stop conditions

Stop and return `BLOCKED_INPUT` if the execution identity, PR identity,
113-path attestation, required allowlisted file, source hash, or protected-path
metadata is missing or mismatched. Stop and return
`CHANGES_REQUIRED_GOVERNANCE` if the directive asks for contradictory
dispositions. Stop and return `CHANGES_REQUIRED_SOURCE` only when an exact
current source defect is proved from the allowed inputs.

## 10. Responsibility and exit

MacBook Claude owns this one bounded diagnosis only. MacBook Codex independently
checks the report against Git metadata and the retained R5 evidence. The Owner
decides the final manifest disposition. CR2 source repair or CR3 disposable
governance begins only after the result is accepted and separately authorized.
Project creation remains blocked through CR1.
