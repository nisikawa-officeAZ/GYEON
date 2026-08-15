# DealerOS Environment Ledger

## 1. Authority

| Field | Value |
|---|---|
| Status | Canonical and binding |
| Owner decision | 2026-08-12 |
| Evidence phase | PR #2 Gate B-R4B product/Storage repair contract candidate |
| Applies to | GYEON / DealerOS Supabase environments |

This document is the canonical environment identity ledger. When an older
runbook, checklist, comment, or manual uses a conflicting environment name or
project role, this ledger wins. Historical evidence is not rewritten; the
conflict must be recorded and resolved before an operation is authorized.

## 2. Canonical environment identities

| Role | Supabase project name | Project ref | Region | Operation policy |
|---|---|---|---|---|
| Development | `DealerOS-Dev` | `fbieiotihlmpfzybowbt` | `ap-northeast-2` | Development only. Gate B-R3 selects clean replacement as the remediation candidate. Keep this project read-only until an accepted cutover; no project creation, data copy, migration apply, or retirement without its separate explicit gate. |
| Staging | `DealerOS-Dev-Next` | `vhiuiwolnlvlwvoaingd` | `ap-northeast-1` | **Formal staging from 2026-08-12.** The legacy project name remains unchanged. Read or write access, linking, migration apply, test data creation, reset, and deployment each require the applicable explicit gate. |
| Production | `DealerOS-Prod` | `dmvyaykhibmphrmekjbb` | `ap-northeast-1` | Protected production. No link, write, migration apply, reset, or deployment without a production-specific owner gate and release evidence. |

Supabase preview branches, including PR-specific branches, are preview
environments. They are not staging and cannot satisfy a staging acceptance
gate.

## 3. Gate B-R1 read-only baseline

Observed on 2026-08-12 without schema or data changes:

| Check | Development | Staging | Production |
|---|---:|---:|---:|
| Recorded migrations | 2 | 100 | 88 |
| PR #2 executable migration versions recorded | 0 / 59 | 58 / 59 | 46 / 59 |
| Missing PR #2 version of special concern | 59 versions | `20260801110110_line_link_tokens` | 13 versions, including `20260801110110_line_link_tokens` |

Additional findings:

- Development contains schema markers that its two-row migration ledger does
  not explain. It must be treated as ledger-drifted, not reproducible.
- Staging and Production share 88 recorded migration versions. Their stored SQL
  statement fingerprints matched for all 88 common versions.
- The `line_link_tokens` marker was absent from all three inspected live
  environments.
- The dealer-facing policies from migration 064 use `owner_user_id` in all
  three environments.
- `public.pg_version()` was absent in Development. In Staging and Production it
  was `SECURITY DEFINER`, had a pinned `search_path`, and was not executable by
  PUBLIC at inspection time. This live state does not waive source-level Gate C
  hardening.

These values are an observed baseline, not authorization to synchronize the
environments.

## 4. Binding operating rules

1. Resolve a target by both role and exact project ref before any connection.
2. A project name, local link, preview branch, or Vercel environment is never
   sufficient proof of the target role.
3. Read-only audit does not authorize linking, writes, migration repair,
   migration apply, test fixtures, reset, branch merge, or deployment.
4. Migration audit, repair, runtime verification, commit, push, staging apply,
   production apply, and deployment remain separate gates.
5. Never repair a migration ledger by inserting history rows unless the exact
   schema and stored statements were independently reconciled and the owner
   explicitly approved that repair.
6. Never promote Staging evidence to Production evidence. Production requires
   its own preflight, apply approval, and post-apply verification.
7. Secrets, passwords, service-role keys, and connection strings must not be
   recorded in Git or PR comments.

## 5. Known conflicting historical documents

- `docs/STAGING_SETUP.md` is a setup template. Its create/link/apply examples do
  not override this ledger and do not authorize an operation.
- `docs/MANUAL_APPLY_082_083.md` historically labels
  `fbieiotihlmpfzybowbt` as Production. That label is incorrect under this
  ledger; the ref is Development.
- `OPERATIONS_RULES.md` defines the current CLI safety boundary and references
  this ledger for exact environment identities.

## 6. Gate B-R1A evidence completion

The expanded read-only reconciliation is recorded in PR #2 comments:

1. [Git and migration-source baseline](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260388451)
2. [Three-environment comparison](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260389298)
3. [Complete result and exact missing sets](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260390169)

The evidence refined, but did not change, the binding baseline:

- Development: all inspected root objects/functions remain unresolved as
  partial or out-of-band. No history repair is justified.
- Staging: all non-frozen PR #2 migration candidates are recorded. The only
  absent PR #2 executable version is the frozen LINE migration.
- Production: 13 PR #2 versions are absent. Ten are active-path release
  prerequisites, two are deferred behind the disabled GYEON onboarding feature
  gate, and one remains frozen.

## 7. Gate B-R2W remediation-design candidate

| Field | Value |
|---|---|
| Status | `ACCEPTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `b892efa30d65581bc5b6768e2b6f89d2bf11d28f` |
| Candidate base tree | `7999b4b39f5f5e4c4c7e0b3f4a63301e3ac52968` |
| Plan | `ENVIRONMENT_REMEDIATION_PLAN.md` |
| Database writes | None |
| Migration/history changes | None |

The candidate disposition is:

| Environment | Remediation disposition | Current stop |
|---|---|---|
| Development | B-R2W deferred selection between replacement Development and side-by-side reconciliation. Gate B-R3 evidence below supersedes that deferral by selecting clean replacement; in-place history relabel remains rejected. | Follow Section 8 after the B-R3A candidate is accepted and committed. |
| Staging | `PRESERVE_NO_APPLY`; run a future read-only focused acceptance only. The frozen LINE exception stays absent. | Separate Staging read-only gate required. |
| Production | Ten `required_before_release`, two `intentionally_deferred`, one `prohibited/frozen`. Bulk push is prohibited because it can include the frozen path. | Separate execution-mechanism decision, backup/PITR gate, Staging acceptance, and Production-specific owner approvals required. |

The exact classification, dependencies, source hashes, risk controls, restore
requirements, future gate order, and literal source allowlists were accepted
and pushed in commit `4e5f365ca8bd30ce1173ab7284e0ef2bff39d1a1`.
No environment operation is authorized by that documentation commit.

## 8. Gate B-R3A Development remediation selection

| Field | Value |
|---|---|
| Status | `ACCEPTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `4e5f365ca8bd30ce1173ab7284e0ef2bff39d1a1` |
| Candidate base tree | `e50e518a17adff1e29883255ac326cb6bb1f25e5` |
| Read-only selection evidence | [PR #2 comment 5260655658](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260655658) |
| Accepted commit | `3f3a085feee987a9024375e11c06644f3b990fde` |
| Accepted tree | `f3417b03c098799e211d6b321e64a33bfcf51228` |
| Push evidence | [PR #2 comment 5260763567](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260763567) |
| Database/project operations | None |
| Documentation allowlist | `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md` |

Binding candidate ruling:

- Select a clean replacement Development project built from a disposable-
  proved, non-frozen Git migration manifest.
- Keep current Development read-only until old/new acceptance and cutover are
  accepted. A later default-discard classification does not authorize deletion
  from this project.
- Import only an owner-approved retained-data and Storage subset. Regenerate
  schema, policies, grants, migration history, buckets/policies, keys, and
  configuration rather than copying the drifted baseline.
- Treat side-by-side forward reconciliation as fallback only when a retention
  audit proves non-recreatable identities or business data cannot be safely
  migrated.
- Keep in-place migration-history relabel rejected.
- Keep frozen LINE work and disabled GYEON partner onboarding outside the
  rebuild, data-copy, and activation scope.

The two-document candidate was accepted and pushed in commit
`3f3a085feee987a9024375e11c06644f3b990fde`. That documentation commit did not
authorize project creation, Supabase or DB connection, data export/import,
migration replay/apply, test, secret rotation, cutover, or old-project
retirement.

## 9. Gate B-R3B retained-data and cost ruling

| Field | Value |
|---|---|
| Status | `ACCEPTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `3f3a085feee987a9024375e11c06644f3b990fde` |
| Candidate base tree | `f3417b03c098799e211d6b321e64a33bfcf51228` |
| Read-only recommendation | [PR #2 comment 5260786955](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260786955) |
| Owner ruling | [PR #2 comment 5260802893](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260802893) |
| Accepted commit | `96c0d5cb34f60396242ea89ae0cf4d0aac92f59e` |
| Accepted tree | `aa544700b66971473f5c7127289bfffd76b8b024` |
| Push evidence | [PR #2 comment 5260968029](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260968029) |
| Database/project operations | None |
| Documentation allowlist | `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md` |

Binding owner ruling:

- `KEEP_IF_EXPLICITLY_JUSTIFIED`: only active Development Auth identities
  required for replacement acceptance, their dealer/member/staff/admin
  relationships, owner-identified irreplaceable transactional examples, and
  Storage objects referenced by retained rows.
- `REGENERATE_FROM_GIT_OR_CONFIG`: schema, functions, RLS/policies, grants,
  migration history, buckets/policies, and accepted canonical fixtures.
- `DISCARD_BY_DEFAULT`: do not import Staging/UAT evidence, logs, queues,
  notifications, OCR temporary state, failed jobs, AI usage, or trial/billing
  artifacts. This classification does not authorize deletion from current
  Development.
- `FREEZE_DO_NOT_ENABLE_OR_COPY`: LINE link-token and GYEON partner onboarding.
- `ROTATE_OR_RECONFIGURE_SEPARATELY`: secrets, URLs, keys, Auth/SMTP/Vercel
  variables, `CRON_SECRET`, provider settings, Realtime, extensions, webhooks,
  and replicas. Secret values must not be recorded in Git.

A later replacement Development project is limited to Micro compute, a maximum
of 31 days, and no paid add-ons. Stop before project creation if the Supabase
dashboard estimate is more than USD 12 before tax, selects a size above Micro,
or includes an add-on. The approximate Micro monthly amount is planning only,
not invoice proof or project-creation authority.

The two-document ruling was accepted and pushed in commit
`96c0d5cb34f60396242ea89ae0cf4d0aac92f59e`. The following Gate B-R3C
read-only investigation completed the literal migration/replay/test-manifest
design. Neither the R3B documentation commit nor the R3C investigation
authorized a Supabase/DB/project connection, user/business/Auth/Storage/
billing/secret read, migration replay or apply, history repair, reset, seed,
test, Ready, merge, or deployment.

## 10. Gate B-R3C/R3D literal replay and test manifest

| Field | Value |
|---|---|
| Status | `ACCEPTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `96c0d5cb34f60396242ea89ae0cf4d0aac92f59e` |
| Candidate base tree | `aa544700b66971473f5c7127289bfffd76b8b024` |
| Read-only manifest evidence | [PR #2 comment 5261032333](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261032333) |
| Accepted commit | `99b2859cda6256bc402f0918bba5ef29b6db1306` |
| Accepted tree | `d5caae0515d02d957ed0fadad29f6479434a3098` |
| Push evidence | [PR #2 comment 5261328283](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261328283) |
| Tracked migration SQL files | 101 |
| Executable Development replay paths | 98 |
| Excluded paths | 3 |
| Executable manifest SHA-256 | `174f7caac201e5a14a6625cb64908c88e86c63f0926c13a0ba09f228275e1ce8` |
| Tracked pgTAP files | 2 |
| Planned pgTAP assertions | 215 |
| Test manifest SHA-256 | `7ac67877505101120128492b08534f9c4282d29006f00ed64fa661fa799f5f6a` |
| Database/project operations | None |
| Documentation allowlist | `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md` |

The executable migration manifest excludes exactly these three owner-frozen
paths:

1. `supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql`
2. `supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql`
3. `supabase/migrations/20260801110110_line_link_tokens.sql`

The first two paths remain deferred GYEON partner-onboarding work. The third
is the protected LINE path; its content remains inaccessible and only its
mode/blob metadata may be inspected. Excluding only that protected path would
wrongly activate the two deferred onboarding migrations, so the executable
count is 98 rather than 100.

The two tracked pgTAP files plan 165 and 50 assertions respectively. They test
estimate-wizard atomic save/numbering and direct DML/RLS integrity, but they do
not constitute whole-system proof for every object produced by the 98
migrations. A later runtime gate must therefore add broader database-object,
RLS, grant, Storage, function, Data API, and business-behavior verification.

The canonical literal paths, per-path hashes, exclusions, future disposable
runtime order, and fail-closed conditions are recorded in
`ENVIRONMENT_REMEDIATION_PLAN.md`. The two-document candidate was accepted and
pushed in commit `99b2859cda6256bc402f0918bba5ef29b6db1306`. That commit did not
authorize a Supabase/DB/project connection, migration replay/apply/reset, seed,
history repair, test, typecheck, build, Ready, merge, or deployment.

## 11. Gate B-R3E/R3F broader database-verification contract

| Field | Value |
|---|---|
| Status | `ACCEPTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `99b2859cda6256bc402f0918bba5ef29b6db1306` |
| Candidate base tree | `d5caae0515d02d957ed0fadad29f6479434a3098` |
| Read-only contract evidence | [PR #2 comment 5261394747](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261394747) |
| Accepted commit | `684dc3263afe4943658a889e0e8232f415bba0e4` |
| Accepted tree | `60e0dcdc618e840b0d90ab248c8dde67e0cd7a58` |
| Push evidence | [PR #2 comment 5261545745](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261545745) |
| Pre-R4 historical replay baseline | 98 executable migrations; exactly 3 excluded paths |
| Pre-R4 historical pgTAP baseline | 2 files; 215 planned assertions |
| Current replay baseline after R4 | 99 executable migrations; exactly 3 excluded paths |
| Current pgTAP baseline after R4 | 3 files; 293 planned assertions |
| Static application inventory | 80 table/query references; 19 RPC references; 30 environment-variable names |
| Database/project operations | None |
| Documentation allowlist | `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md` |

The replacement-Development contract is broader than migration replay and the
three current pgTAP suites. The two estimate-wizard suites total 215 planned
assertions; the focused GYEON product/Storage suite adds 78, for a current
total of 293. It requires independently verified
catalog, grants/RLS, Data API, Storage, function/trigger, business-domain,
concurrency, and frozen/operational evidence. Every application table/query and
RPC reference must have an explicit exposure classification, and authorization
proof must use real local Auth tokens for at least two tenants rather than only
session-role simulation.

The canonical replacement Storage authority is exactly five buckets:

1. `documents`
2. `work-order-files`
3. `vehicle-registration-documents`
4. `dealer-branding`
5. `gyeon-resources`

`completion-reports` is not a separate active bucket. Completion-report PDFs
use `documents`; older references to a `completion-reports` bucket are stale
and must not be reproduced in replacement Development.

Static source inspection also found that the surviving `gyeon_products` SELECT
policy is role-only and does not enforce the stated active-dealer-membership
boundary. A separately approved forward migration and focused authorization
tests are prerequisites to runtime acceptance. Do not edit historical
migrations to hide this difference.

The detailed serial suites, fail-closed acceptance rules, protected exclusions,
and next repair/document/runtime gates are binding in
`ENVIRONMENT_REMEDIATION_PLAN.md`. The two-document R3F contract was accepted
and pushed in commit `684dc3263afe4943658a889e0e8232f415bba0e4`. That
documentation commit did not authorize a source, test, or migration edit;
protected-content access; Supabase/DB/project connection; replay/apply/reset;
test; Ready; merge; or deployment.

## 12. Gate B-R4A/R4B product and Storage repair contract

| Field | Value |
|---|---|
| Status | `R4_IMPLEMENTED_RUNTIME_ACCEPTED_COMMITTED_AND_PUSHED` |
| Candidate date | 2026-08-12 |
| Candidate base HEAD | `684dc3263afe4943658a889e0e8232f415bba0e4` |
| Candidate base tree | `60e0dcdc618e840b0d90ab248c8dde67e0cd7a58` |
| Read-only design evidence | [PR #2 comment 5261626098](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261626098) |
| Accepted commit | `67ac2eb5aedc5ac8e95481db4164f7a62a3f104c` |
| Accepted tree | `aad9e8bdb5dad18128c418038075c0fb03c4b82a` |
| Runtime evidence | [PR #2 comment 5266388044](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266388044) |
| Commit evidence | [PR #2 comment 5266403615](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266403615) |
| Push evidence | [PR #2 comment 5266433315](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266433315) |
| Migration SHA-256 | `fc71129b5e74bcf9cd1a0751ef58d34f85e6e50459b563bdee610b95e55620a2` |
| Focused pgTAP SHA-256 | `4f489765328c6980bbc4dcd6894ad6a935d6afb3513368b75b85ee962ec90f39` |
| Runtime result | 99/99 replay; focused pgTAP `Files=1`, `Tests=78`, PASS; real Auth/Storage 56 PASS; separate-process/connection concurrency 12 PASS |
| Documentation allowlist | `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md` |

The accepted R4B forward-repair contract was:

- `gyeon_products` remains one global shared product master. An active member
  of any dealer may read the shared rows; inactive, invited, suspended,
  removed, no-member, and anonymous actors may not. The replacement policy
  uses an explicit `TO authenticated` target plus a non-null caller and active
  `dealer_members` predicate. The historical role-only policy is replaced by a
  forward migration; historical migration `047_create_gyeon_products.sql` is
  never edited. Authenticated remains SELECT-only, service-role remains CRUD,
  and no owner fallback, `auth.role()`, SECURITY DEFINER helper, or broader
  grant is introduced.
- the replacement Storage catalog contains exactly `documents`,
  `work-order-files`, `vehicle-registration-documents`, `dealer-branding`, and
  `gyeon-resources`. `completion-reports` is absent and its presence causes a
  pre-mutation stop; the repair never silently deletes a bucket or objects.
- the tracked migration/configuration package, focused pgTAP suite,
  disposable replay, real two-tenant Auth proof, commit, push, replacement
  apply, Ready, merge, and deployment remain separate gates.

The R4A audit also found three application-source authorization mismatches that
must not be papered over with wider database or Storage grants:

1. product CSV import claims service-role behavior but uses a request-scoped
   client and is exposed on the dealer-facing product page without an admin
   gate; authenticated product writes remain prohibited;
2. vehicle-registration archive copies and removes an object through a
   user-scoped client while the setup contract prohibits DELETE, and the caller
   marks the database row archived without checking the Storage result; and
3. work-order files are canonical private objects, but the upload path can
   persist `is_public=true` and call `getPublicUrl()` while cleanup and explicit
   deletion require a separately authorized DELETE boundary.

The database/configuration repair and these source repairs stay in independent
literal allowlists. The historical R4C gate generated exactly one empty forward
migration pathname with the slug `gyeon_products_storage_authority`, and the
later bounded implementation used only that generated migration and
`supabase/tests/gyeon_products_storage_authority.test.sql`. Their final accepted
hashes and runtime evidence are recorded below.

The bounded R4 database/configuration repair was implemented, verified in a
fresh disposable runtime, committed, and pushed at the accepted commit above.
The successful run replayed all 99 executable migrations, executed the focused
78-assertion pgTAP suite, proved 56 real Auth/Storage cases, and proved 12
genuine separate-process/separate-connection concurrency cases. Cleanup was
verified and no shared, linked, preview, Staging, or Production environment was
modified.

R4 acceptance is a bounded Gate B subset, not whole-system Gate B acceptance.
The three application-source blockers above remain unresolved, and the eight
broader suites in Section 11 remain required. Ready display state, merge,
shared-environment apply, and deployment are not authorized by R4 acceptance.

## 13. PR #2 integration gate ledger

| Field | Immutable audit value or authority rule |
|---|---|
| Ledger date | 2026-08-12 |
| Base / merge-base | `main` at `2f0b56cdc3d66cbe4ce050cfa335678934fb1cb2` |
| Pre-ledger audited head | `67ac2eb5aedc5ac8e95481db4164f7a62a3f104c` |
| Pre-ledger audited tree | `aad9e8bdb5dad18128c418038075c0fb03c4b82a` |
| Pre-ledger audited topology | 319 commits ahead, 0 behind; one merge commit |
| Pre-ledger audited PR scope | 2,297 paths; +180,980 / -5,359 |
| Gate review evidence | [PR #2 comment 5266506008](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266506008) |
| Prior ledger delivery commit | `8c126e4539b8880ca507d2e1e2a411e358f7ba18`; [delivery evidence](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266605336) |
| Self-reference finding | [PR #2 comment 5266630838](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266630838) |
| Live head/scope authority | PR #2 header and GitHub API, corroborated by the latest post-push result comment |
| Integration status | `NOT_MERGE_READY` |

The embedded Git values above are an immutable pre-delivery audit snapshot,
not a claim that this versioned document can identify its own carrying commit.
A Git document cannot safely contain its own live commit SHA because committing
that value changes the SHA. The external PR body and GitHub API are therefore
the live head/scope authority and must be refreshed after a metadata push.

The release-gate ruling is:

- **Gate A — repository hygiene:** accepted at commit
  `2da69c7261a8e884ee1626c1e397b50bb387f88c`. At the pre-ledger audited
  snapshot, nine later commits and seven changed paths existed. Incremental
  Gate A reconciliation remains required through the live PR head; its exact
  live counts must be obtained from Git rather than frozen into this document.
- **Gate B — database contract:** the R4 product/Storage subset is accepted.
  The current baseline is 99 executable migrations, exactly three excluded
  migrations, and three pgTAP files with 293 planned assertions. The remaining
  catalog, grants/RLS, Data API, Storage, function/trigger, business-domain,
  concurrency, and frozen/operational suites, plus the application-source
  blockers in Section 12, remain incomplete.
- **Gate C — security and destructive behavior:** not accepted. Request-scope
  auth cookies, hard-delete/access-cut behavior, admin lifecycle, RLS/RPC
  boundaries, and the public SECURITY DEFINER surface in
  `096_dev_diagnostics.sql` require current-head review.
- **Gate D — executable application proof:** not accepted. No reproducible
  current-head typecheck, build, and end-to-end acceptance package exists.
  Supabase Preview passing does not substitute for this gate.
- **Gate E — release controls:** not accepted. `main` has no effective branch
  protection/ruleset, PR #2 has no final review/requested reviewer evidence,
  and product-owner, rollback, deploy, and post-deploy acceptance are absent.

PR #2 remains the intentional v1.0 integration release vehicle; the accepted
R4 subset is not extracted or cherry-picked separately. GYEON Draft PR #8
remains deferred at its historical PR #2 base. After PR #2 is integrated, PR
#8 must be retargeted or otherwise re-resolved against the integrated baseline
and fully reverified before its own release gates can proceed.

## 14. R4Q-R12B/R12C catalog-manifest ledger

| Field | Immutable value |
|---|---|
| R12B acceptance | [PR #2 comment 5283279059](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5283279059) |
| Pinned base / head / tree | `2f0b56cdc3d66cbe4ce050cfa335678934fb1cb2` / `4a5c896b32ef0b5708f89f6a63c29d07e92d34ac` / `f24f5c173cdbb532314343cbefa01e0811fcb93a` |
| Executable manifest | 99 path-ordered mode/type/blob/path rows |
| Manifest SHA-256 | `06701e35b85d94dd5b4ce2d51a3726493cb983fca821da94e463fc637ad21a4e` |
| Canonical ledger | 45 artifacts; combined SHA-256 `84deba630d63466debddae965a998fecde4cb486cfb2d73680b82b875a689f15` |
| Coverage | 2,807 source-analysis rows; 2,764 runtime expected-present rows |
| Candidate suite | `supabase/tests/catalog_manifest.test.sql`; exactly 76 assertions |
| Candidate status | Uncommitted and unexecuted |

The three excluded migrations remain content-protected and absent from the
99-path executable set. `ScreensPreview.tsx` also remains content-protected.
Their metadata identities are recorded in `CATALOG_MANIFEST.md`.

The R12C suite is design evidence only. It did not connect to any Supabase
project or local database and did not replay migrations or execute pgTAP. It
must not be used to revise the live Development/Staging/Production facts in
Sections 2–3. A later runtime result may append evidence; it may not silently
replace this pinned source contract.

Current release impact: the catalog-manifest static candidate exists, but PR #2
remains `NOT_MERGE_READY`. `GRANT_RLS_ROLE_MATRIX`, `DATA_API_MATRIX`, broader
runtime behavior, real Auth request-scope proof, remaining Gate B suites, and
Gates C–E are still open. No environment operation is authorized.

## 15. R4Q-R12E remaining seven Gate B DB-suite ledger

| Field | Immutable value |
|---|---|
| Candidate date | 2026-08-15 |
| Status | `STATIC_UNCOMMITTED_CANDIDATE_NOT_RUNTIME_PROOF` |
| Pinned base / head / tree | `2f0b56cdc3d66cbe4ce050cfa335678934fb1cb2` / `0b694461e5ee735dd969703eb7f4dac4a5fadcad` / `d54a571583469f2017f660df072178fdcef9b8c6` |
| Contract | `GATE_B_REMAINING_SEVEN_DB_SUITES.md` |

| Suite | File | Plan | SHA-256 |
|---|---|---:|---|
| `GRANT_RLS_ROLE_MATRIX` | `supabase/tests/grant_rls_role_matrix.test.sql` | 40 | `ca776dafddd187b4d00b6ee460ea2786017135ef596c8c60d2246f2cf1914e81` |
| `DATA_API_MATRIX` | `supabase/tests/data_api_matrix.test.sql` | 20 | `aba6bbea9e86a9d180870f4adb747c5558ab500ca49a429bcf535c4038bfba6b` |
| `STORAGE_MATRIX` | `supabase/tests/storage_matrix.test.sql` | 59 | `3bf55b5ca00b7450e51b9cee922b51c1ff16bd8c3be2bf1670b8c1fd8fcb96d5` |
| `FUNCTION_TRIGGER_MATRIX` | `supabase/tests/function_trigger_matrix.test.sql` | 19 | `23da5f34cfc93412dea056fcaee7732038ec4c5f63958b1a26702cc6456a166f` |
| `BUSINESS_DOMAIN_MATRIX` | `supabase/tests/business_domain_matrix.test.sql` | 30 | `fa17f0369bead04f8612a46c4c8660c4107ea8d54e937c9de02647bbcfb3a13c` |
| `CONCURRENCY_MATRIX` | `supabase/tests/concurrency_matrix.test.sql` | 32 | `f159921f50fe316e7101baba699a8193eec2a5105e2b623e5077fc5200daeeb2` |
| `FROZEN_OPERATIONAL_MATRIX` | `supabase/tests/frozen_operational_matrix.test.sql` | 22 | `fcb25f4b8e07821477ce8140747f1188e9870b2f2b7e00fd276c1636f8c7670b` |
| **Total** | | **222** | |

This candidate is separate from, and does not replace or close, the R12B/R12C
catalog-manifest ledger in Section 14 (`plan76`). No assertion across the seven
suites was executed while producing this candidate; `CONCURRENCY_MATRIX` in
particular can only be proven with a real two-`psql`-client
separate-connection protocol run inside a later disposable runtime, never from
a single pgTAP transaction. No
Supabase/DB/Auth/Storage/LINE connection, migration replay/apply, test
execution, stage, commit, push, Ready-state change, merge, or deployment
occurred in producing this candidate.

The preceding R12E attempt's protected-content access was aborted with zero
changes and remains disclosed in PR #2 comment `5294569062`. This accepted
candidate attempt restarted at the pinned head and used the protected
identities as metadata-only inputs.

Current release impact: this seven-suite static candidate does not itself
close Gate B. `GRANT_RLS_ROLE_MATRIX`, `DATA_API_MATRIX`, `STORAGE_MATRIX`,
`FUNCTION_TRIGGER_MATRIX`, `BUSINESS_DOMAIN_MATRIX`, `CONCURRENCY_MATRIX`, and
`FROZEN_OPERATIONAL_MATRIX` remain design/inventory evidence only until a
separately authorized fresh disposable-runtime execution/repair gate proves
them against a live local stack, including real Auth/PostgREST/Storage/OCR/
LINE/cron/dashboard evidence still required per
`GATE_B_REMAINING_SEVEN_DB_SUITES.md` Section 7. That runtime gate is not
automatically authorized by this ledger entry. PR #2 remains `NOT_MERGE_READY`
and Gates C–E remain open.

## 16. R4Q-R12F-R2 failure and R12E-R2 six-path repair ledger

| Field | Immutable value |
|---|---|
| Date | 2026-08-15 |
| Pinned head / tree | `0b694461e5ee735dd969703eb7f4dac4a5fadcad` / `d54a571583469f2017f660df072178fdcef9b8c6` |
| Runtime suffix / project | `r12f-r2.vOvvhI` / `r12fr2vovvhi` (burned) |
| Replay | Exact current 100 migrations; PASS |
| pgTAP | `Files=8`, `Tests=274`, `Result: FAIL`; six files PASS, two files FAIL |
| Stage 3 | NOT_RUN |
| Cleanup | Matching containers `0`; matching volumes `0` |
| Repair status | `STATIC_UNCOMMITTED_R12E_R2_REPAIR_CANDIDATE_NOT_RUNTIME_PROOF` |
| Current candidate boundary | Exactly 11 paths; index empty; no commit or push |

R12F-R2 failed closed. `grant_rls_role_matrix.test.sql` stopped after
assertion 16 because the policy-role diagnostic referenced `x.rolname`
instead of `x_role.rolname`. `data_api_matrix.test.sql` ran 20 assertions and
failed 11, 14, 16, and 19. Real Auth/PostgREST/Storage and genuine two-
connection concurrency were not run, and the failed disposable runtime was
fully stopped and removed without retry.

The owner then approved exactly six repair paths:

1. `supabase/tests/grant_rls_role_matrix.test.sql`
2. `supabase/tests/data_api_matrix.test.sql`
3. `src/lib/release/readiness.ts`
4. `docs/master_specification/GATE_B_REMAINING_SEVEN_DB_SUITES.md`
5. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md`
6. `docs/master_specification/ENVIRONMENT_LEDGER.md`

The repair removes the discarded call to nonexistent `public.version()`, so
the current exact source inventory is 80 distinct `.from(...)` literals plus
18 distinct `.rpc(...)` literals (98 total). It distinguishes Storage buckets
from public relations, bounds the exact six protected-excluded literals,
classifies the future dealer AI tables as feature-gated, models INSERT-only
client paths by their actual required privilege, and keeps admin/service-role
paths server-only. Protected migration and `ScreensPreview.tsx` contents were
not read.

| Artifact | Plan | SHA-256 after R12E-R2 |
|---|---:|---|
| `grant_rls_role_matrix.test.sql` | 40 | `f48f6ca7873434d420149a2ff6481c4a10eb94cf37a36fc98f98ac6f250d809c` |
| `data_api_matrix.test.sql` | 20 | `251f307f7365e8fe39b667a4d1d08bcf3e2064b7e67adf2e327b316d2a82cd80` |
| `storage_matrix.test.sql` | 59 | `ee25e39f5bf82177b4a8daaa976c9df9dedc275eb92d478a5fe29f60239ab7ce` |
| `function_trigger_matrix.test.sql` | 19 | `23da5f34cfc93412dea056fcaee7732038ec4c5f63958b1a26702cc6456a166f` |
| `business_domain_matrix.test.sql` | 30 | `fa17f0369bead04f8612a46c4c8660c4107ea8d54e937c9de02647bbcfb3a13c` |
| `concurrency_matrix.test.sql` | 32 | `6584c9b2010fd6c7485ad3c42f8bd77c582cc1230fac7dbf262e3fed06b7b322` |
| `frozen_operational_matrix.test.sql` | 22 | `fcb25f4b8e07821477ce8140747f1188e9870b2f2b7e00fd276c1636f8c7670b` |
| `src/lib/release/readiness.ts` | n/a | `d411f40a64eb52b5b8d0b08344ea439066a5bfeba769571808c208d5acd15181` |

The seven-suite total remains `plan(222)` and the full eight-file target
remains `plan(298)`. This entry is static repair evidence only. No DB or test
execution, stage, commit, push, Ready transition, merge, apply, or deployment
is authorized or claimed by R12E-R2.

## 17. R4Q-R12F-R3/R4 runtime failures and R12E-R3 four-path repair ledger

| Field | Immutable value |
|---|---|
| Date | 2026-08-15 |
| Pinned head / tree | `0b694461e5ee735dd969703eb7f4dac4a5fadcad` / `d54a571583469f2017f660df072178fdcef9b8c6` |
| R12F-R3 suffix / project | `r12f-r3.H0dTWK` / `r12fr3h0dtwk` (burned) |
| R12F-R3 result | 100 applications logged; stack startup failed on analytics Vector/Colima socket; pgTAP NOT_RUN |
| R12F-R4 suffix / project | `r12f-r4.yjgGlc` / `r12fr4yjgglc` (burned) |
| R12F-R4 replay | Exact 100 versions; expected/actual ordered SHA-256 `1ad956827b7ec8f24d9a6d2006dc519b7db9117b8b01a78847634c6884629a8e` |
| R12F-R4 pgTAP | `Files=8`, `Tests=298`, `Result: FAIL`; seven files PASS; grant/RLS assertions 19, 24, 25, 27, 37 failed |
| Stage 3 | NOT_RUN |
| Cleanup | Both runs: matching containers `0`; matching volumes `0` |
| Repair status | `STATIC_UNCOMMITTED_R12E_R3_FOUR_PATH_REPAIR_CANDIDATE_NOT_RUNTIME_PROOF` |

The exact four modified paths are:

1. `supabase/tests/grant_rls_role_matrix.test.sql`
2. `docs/master_specification/GATE_B_REMAINING_SEVEN_DB_SUITES.md`
3. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md`
4. `docs/master_specification/ENVIRONMENT_LEDGER.md`

The grant/RLS test remains `plan(40)`. Assertion 19 now proves exact full-set
equality for the eight intentional service-role-only RLS-on/no-policy tables.
Assertion 24 proves that platform direct-SQL Storage DELETE is rejected and
leaves positive DELETE to real Storage API evidence. Assertions 25 and 27
prove own visibility plus zero foreign visibility without a brittle cumulative
fixture count. Assertion 37 proves anon visibility is zero while assertion 38
continues to prove anon INSERT raises. The resulting test SHA-256 is
`2269707f6cb083bfa03962bc96e89d9e2ba351c5cc9b8b7af6cfb37d349f9f1a`.

No migration, grant, RLS policy, application source, dependency, or config is
changed. Protected contents were not accessed. No runtime retry, stage,
commit, push, Ready transition, merge, apply, or deployment is authorized or
claimed by R12E-R3.

## 18. R4Q-R12F-R5 runtime stop and R12E-R4 five-path repair ledger

| Field | Immutable value |
|---|---|
| Date | 2026-08-15 |
| Pinned head / tree | `0b694461e5ee735dd969703eb7f4dac4a5fadcad` / `d54a571583469f2017f660df072178fdcef9b8c6` |
| Runtime suffix / project | `r12f-r5.UjmwCs` / `r12fr5ujmwcs` (burned) |
| Replay | Exact 100-version ledger; expected/actual SHA-256 `1ad956827b7ec8f24d9a6d2006dc519b7db9117b8b01a78847634c6884629a8e` |
| pgTAP | `Files=8`, `Tests=298`, `Result=PASS` |
| Real request-scope proof | local Auth-issued JWT + PostgREST + Storage API `56/56 PASS` |
| External seven-family concurrency | `NOT_RUN` |
| Cleanup | matching containers `0`; matching volumes `0` |
| Result comment | PR #2 comment `5299362040` |
| Repair status | `STATIC_UNCOMMITTED_R12E_R4_FIVE_PATH_REPAIR_CANDIDATE_NOT_RUNTIME_PROOF` |

R12F-R5 stopped before external concurrency because the queue-family contract
expected `sending`, a value excluded by the exact
`line_notification_queue_status_check`. The accepted lifecycle is
`scheduled -> processing -> sent|failed|cancelled`. No same-run correction or
retry occurred.

The exact R12E-R4 repair paths are:

1. `supabase/tests/concurrency_matrix.test.sql` (modify);
2. `supabase/tests/runtime/concurrency_matrix.mjs` (add);
3. `docs/master_specification/GATE_B_REMAINING_SEVEN_DB_SUITES.md` (modify);
4. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md` (modify); and
5. `docs/master_specification/ENVIRONMENT_LEDGER.md` (modify).

| Artifact | Static contract | SHA-256 after R12E-R4 |
|---|---:|---|
| `concurrency_matrix.test.sql` | `plan(32)` | `0ff5d845a0cb14c332e70b1a4f315035293ad1fc6c0f2ebd7906dd9fd17b2423` |
| `runtime/concurrency_matrix.mjs` | 7 families / 2 `psql` clients / 1 attempt / 0 retries | `b7602b2254a1c57299cfb0b6eaf4c93796098ee265779e4deb0e233e1ed073ed` |

The SQL candidate now uses exact catalog-valid `processing|sent` queue
invariants. The external candidate is loopback-only, requires explicit
disposable confirmation, proves distinct backend PIDs through a third
connection, records both results/SQLSTATEs/timestamps, and checks all seven
post-collision invariants. It has no retry path.

R12E-R4 performs only static syntax/scope/hash verification. It makes no
runtime-PASS claim and authorizes no DB/Supabase/Auth/Storage/LINE connection,
migration replay/apply, test execution, stage, commit, push, Ready transition,
merge, or deployment. The candidate remains uncommitted and PR #2 remains
`NOT_MERGE_READY`.
