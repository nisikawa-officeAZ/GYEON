# DealerOS Environment Remediation Plan

## 1. Authority and current status

| Field | Value |
|---|---|
| Phase | `R4Q-R5R_SELF_REFERENCE_SAFE_METADATA_SEMANTICS_REPAIR` |
| Status | `SELF_REFERENCE_SAFE_METADATA_CONTRACT_DEFINED` |
| Owner approval | 2026-08-12 |
| Repository / PR | `nisikawa-officeAZ/GYEON` / PR #2 |
| Branch | `fix/approval-center-delete-access-cut` |
| Candidate base HEAD | `8c126e4539b8880ca507d2e1e2a411e358f7ba18` |
| Candidate base tree | `0a29580d8c578f7db04eb1f2a85463c29e2edbcd` |
| Owner ruling | [PR #2 comment 5260802893](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260802893) |
| Literal manifest evidence | [PR #2 comment 5261032333](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261032333) |
| Broader verification evidence | [PR #2 comment 5261394747](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261394747) |
| R3F push evidence | [PR #2 comment 5261545745](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261545745) |
| R4A repair-design evidence | [PR #2 comment 5261626098](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261626098) |
| R4 runtime evidence | [PR #2 comment 5266388044](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266388044) |
| R4 push evidence | [PR #2 comment 5266433315](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266433315) |
| Pre-ledger integration-gate evidence | [PR #2 comment 5266506008](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266506008) |
| R4Q-R2 candidate evidence | [PR #2 comment 5266558243](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266558243) |
| R4Q-R3 acceptance evidence | [PR #2 comment 5266584471](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266584471) |
| R4Q-R4 local commit evidence | [PR #2 comment 5266605336](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266605336) |
| R4Q-R5 push/self-reference evidence | [PR #2 comment 5266630838](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5266630838) |
| Documentation allowlist | This file and `ENVIRONMENT_LEDGER.md` only |

This document defines how to decide and verify future environment remediation.
It does **not** authorize a database connection, migration apply, migration
history repair, reset, seed, test data, deployment, merge, or production
operation. Audit, design, implementation, runtime verification, commit, push,
Staging apply, Production apply, Ready, merge, and deployment remain separate
owner gates.

## 2. Evidence baseline

The binding environment identities remain those in `ENVIRONMENT_LEDGER.md`.
Gate B-R1A read-only evidence is recorded in PR #2:

1. [Part 1 — Git and migration-source baseline](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260388451)
2. [Part 2 — environment comparison](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260389298)
3. [Part 3 — complete ruling and exact missing sets](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260390169)

Observed baseline, not operation authority:

| Environment | Recorded migrations | PR #2 executable versions | Decision |
|---|---:|---:|---|
| Development | 2 | 0 / 59 | Ledger-drifted and not reproducible; no in-place repair assumption |
| Staging | 100 | 58 / 59 | Preserve; only the frozen LINE migration is absent |
| Production | 88 | 46 / 59 | Preserve; 13-version subset requires controlled disposition |

The 52 inspected Development relations and seven inspected functions had no
complete metadata match to either Staging or Production. Every inspected
Development object therefore remains `UNRESOLVED_PARTIAL_OR_OUT_OF_BAND`.
Object presence and source references are not proof that a migration ran.

## 3. Binding safety rules

1. Resolve every target by both canonical role and exact project ref.
2. Never use a saved local link, project name, preview branch, or Vercel target
   as environment proof.
3. Do not insert, delete, or relabel `supabase_migrations.schema_migrations`
   rows from filename or object-presence evidence.
4. Do not run a bulk `supabase db push` while the pending set contains the
   frozen `20260801110110_line_link_tokens` migration.
5. Staging evidence never substitutes for Production preflight or acceptance.
6. A failed disposable run burns that run identifier and its evidence. Repair
   and retry use a new run under a new explicit gate.
7. Secrets, connection strings, service-role keys, auth rows, and customer data
   are never copied into Git or PR comments.
8. Protected/frozen migration content is not opened, copied, diffed, or used as
   an apply input. Only path, Git blob, and recorded/absent state may be checked.

Supabase documents migration history separately from Git and states that
`migration repair` changes only the history table. It is therefore a write and
is never an automatic fix. See the official
[Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
documentation. Backup availability and retention vary by plan; a future gate
must verify the actual restore point instead of assuming one exists. See
[Database backups](https://supabase.com/features/database-backups) and
[Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## 4. Classification vocabulary

| Classification | Meaning |
|---|---|
| `required_before_release` | The current active application or security boundary depends on it. The relevant code path must not be released/activated against an environment where it is absent. |
| `intentionally_deferred` | Source may ship only while its explicit fail-closed feature gate remains disabled. Apply and feature activation require later independent gates. |
| `prohibited/frozen` | No content access, apply, history repair, feature enablement, or derived implementation is allowed until the owner explicitly changes the frozen decision. |

## 5. Production 13-version disposition

### 5.1 Release classification and dependency order

The first ten migrations are `required_before_release` because current estimate
wizard, customer duplicate detection, service-offering, or RLS behavior calls
the objects they define or relies on the security narrowing they perform.
Shipping those active paths while their database contract is absent is a
fail-open or runtime-failure release.

The GYEON provisioning pair is deferred only because every entry point is
protected by the server-only, exact-string gate
`GYEON_PARTNER_ONBOARDING_ENABLED === "true"`. That gate must remain unset or
false until both migrations pass their later gate.

| Order | Migration version | Classification | Required dependency / release reason |
|---:|---|---|---|
| 1 | `110_store_pricing_configuration` | `required_before_release` | Foundation for dealer pricing, PPF/coating rules, configuration attribution, and the current wizard authoring/runtime readers. Depends on the accepted wizard catalog/lifecycle helpers and existing estimate tables. |
| 2 | `20260726090000_extend_estimate_wizard_snapshot_metadata` | `required_before_release` | Replaces `save_estimate_from_wizard` so the current DTO's `configurationRevision` participates in fingerprinting and persistence. Depends on order 1. |
| 3 | `20260726110000_fix_dpca_revision_trigger_transition_tables` | `required_before_release` | Repairs the order-1 statement triggers; without it adjustment writes abort because transition table `chg` is unavailable. Depends on order 1 and the shared invalidation function. |
| 4 | `20260726120000_secure_dpca_write_rpcs` | `required_before_release` | Current authoring actions call the two RPCs. Keeps writes behind `wiz_can_configure` instead of raw authenticated DML. Depends on orders 1 and 3. |
| 5 | `20260727033223_persist_wizard_customer_canonical_columns` | `required_before_release` | Current save flow must dual-write canonical customer fields used by search/labels. Replaces the order-2 save function; no table backfill. |
| 6 | `20260727081104_drop_legacy_own_rls_policies` | `required_before_release` | Removes 16 superseded permissive RLS OR-branches, including legacy DELETE branches without owner/manager role checks. Depends on the existing SaaS replacement policies. |
| 7 | `20260727112326_add_customer_match_keys` | `required_before_release` | Current duplicate-check action queries the three generated columns directly. Adds stored generated columns and indexes. Pairs operationally with order 5. |
| 8 | `20260728150348_dealer_service_offerings` | `required_before_release` | Current settings and wizard runtime read/write `dealer_service_offerings`. Performs compatibility backfill, policy/rank widening, and bounded revision invalidation. Depends on accepted catalog, rank, lifecycle, and authorization helpers. |
| 9 | `20260729103000_review_gate_drops_family_completeness` | `required_before_release` | Aligns review confirmation with the order-8 service-offering model. Depends on order 8 and the existing review lifecycle. |
| 10 | `20260731054835_harden_line_message_logs_active_members` | `required_before_release` | Security-only narrowing: inactive members must not retain LINE log reads. It does not enable LINE or depend on link tokens. Depends on the existing log table and SELECT-only grant boundary. |
| 11 | `20260731115631_gyeon_dealer_provisioning` | `intentionally_deferred` | Required immediately before GYEON partner onboarding activation, not before a release that keeps the server-only feature gate disabled. Creates the provisioning ledger and service-role-only RPC boundary. |
| 12 | `20260801000649_gyeon_provisioning_pin_function_search_path` | `intentionally_deferred` | Mandatory security companion to order 11; the two must be applied and accepted as one activation package. |
| 13 | `20260801110110_line_link_tokens` | `prohibited/frozen` | Frozen LINE token/LIFF work. Content access and apply remain prohibited. Git metadata only: mode `100644`, blob `accd22345054cc44f89156fd78eaba6dfe4242a4`. |

No `intentionally_deferred` item may silently become required by changing an
environment variable. Enabling partner onboarding before orders 11–12 pass is
a release blocker, not a runtime experiment.

### 5.2 Source integrity manifest

Before a future execution gate, all non-frozen source hashes must match:

| Migration | SHA-256 |
|---|---|
| `110_store_pricing_configuration.sql` | `8ae0a1a1121e02a80b979042ed58ec4efa864783488762599c45712150d5c40d` |
| `20260726090000_extend_estimate_wizard_snapshot_metadata.sql` | `a6404dcd37b2fef14543fd31d418969810b25ebca3d61d06eff1e73ce1d11b91` |
| `20260726110000_fix_dpca_revision_trigger_transition_tables.sql` | `58f238c1df09f9e633ce9da411b474c5ec8f9c22ec8e0a5bb14e7f265663b0b6` |
| `20260726120000_secure_dpca_write_rpcs.sql` | `98fd69a7933314da8ae0c806c1cffdc5d4df0b27f8ae8a57abff8143dcff49a4` |
| `20260727033223_persist_wizard_customer_canonical_columns.sql` | `0cd14ff10e4358d67e898e567c33cd72836d2376c854031a56d3d25b2aec6fdf` |
| `20260727081104_drop_legacy_own_rls_policies.sql` | `a25cf16e70af3f6b3e5e68bd7a63423dade707ef2ea282f5561e4492999972f7` |
| `20260727112326_add_customer_match_keys.sql` | `8eb12bedf1f37f052ad419126bb47766156333846f52c23b4bec81caba1b438e` |
| `20260728150348_dealer_service_offerings.sql` | `7419b1b89775346badfa854e9894f54fc4731feaf7bd5a52ba2743735d723bc2` |
| `20260729103000_review_gate_drops_family_completeness.sql` | `4d73b8526545014d87fc02f2ece43e2af0271ffe32165a63ecae46ab1f98ec56` |
| `20260731054835_harden_line_message_logs_active_members.sql` | `330558862946a8ac27b97f34cdc4a4affc0fdd24c7b445ffe4dc3e8e31394cba` |
| `20260731115631_gyeon_dealer_provisioning.sql` | `4de3a1d1961f980df115abe03270e2b245bcce1bac8fba0c28eeffc457a5ed96` |
| `20260801000649_gyeon_provisioning_pin_function_search_path.sql` | `85e2de717d9c77a4ba24c5a27717a467eeae3a3d42d286d4742f14e4c01d14c8` |

Hash equality proves source identity only. It does not prove a live apply.

## 6. Per-migration risk and recovery contract

| Migration(s) | Primary risk | Mandatory future preflight | Mandatory post-apply evidence | Recovery boundary |
|---|---|---|---|---|
| 1 | `ALTER TABLE`, new checks, indexes, RLS, triggers, and function replacement can lock catalog/estimate tables; existing rows may violate new checks. | Exact object/column/constraint/policy/function manifest; invalid-row counts; table sizes; lock budget; disposable full replay. | Column/constraint definitions, RLS/ACL, trigger definitions, RPC signature, configuration revision behavior, focused pgTAP/app tests. | Capture exact prior function/ACL/policy definitions. Prefer forward repair. Never drop columns/table after traffic without a new destructive gate. |
| 2 and 5 | Replacing the atomic save function can break authorization, idempotency, numbering, or canonical customer persistence. | Exact prior `pg_get_functiondef`, owner, ACL, `proconfig`; disposable save/replay/concurrency suite. | Request-scope actor proof, exact replay = zero writes, conflict = zero writes, numbering, canonical customer columns, revision fingerprint. | Restore the captured prior function only under a separate rollback gate; leave additive columns intact. |
| 3 and 4 | Trigger recreation briefly locks the adjustment table; RPC/grant drift could broaden writes or double-bump revisions. | Trigger/function/ACL/policy manifest; active-session/lock check; disposable insert/update/archive tests. | Transition table works, one revision bump per real mutation, no authenticated raw DML, forged dealer fails closed. | Forward repair the trigger/RPC/ACL. Reinstalling the defective trigger is last-resort diagnosis only. |
| 6 | Removing permissive policies narrows access and may expose an undocumented legacy caller. | Capture all policies/commands/roles/expressions on four tables and prove replacement coverage for SELECT/INSERT/UPDATE/DELETE. | Owner/manager/member/foreign-tenant request-scope matrix; DELETE role checks; no missing command coverage. | Restore exact captured policies only if a verified legitimate caller regresses; do not invent a wider policy. |
| 7 | Stored generated columns compute for every customer and non-concurrent indexes can create long table locks/I/O. | Row count, relation size, invalid text/normalization probes, lock/statement timeout plan, disposable timing using production-scale synthetic volume. | Column generation expressions, index validity, exact-match query plans, duplicate fixtures, existing customer row count unchanged. | Before app release and only with explicit approval, indexes/derived columns can be dropped; after use, prefer forward repair because columns are derived but callers depend on them. |
| 8 | Compatibility backfill and policy/rank updates mutate data; revision bumps can invalidate reviewed catalogs; table/index/trigger DDL can lock. | Snapshot affected dealers, offerings, rank-policy arrays, rank rows, lifecycle revisions, and catalog counts; calculate exact expected backfill/bump set; full disposable replay. | Exact five-family vocabulary, tenant/RLS matrix, expected backfill set, no unintended PPF opt-in, exact revision deltas, all rank/global counts, current wizard runtime tests. | Keep feature fail-closed. Use a forward corrective migration from captured manifests; do not bulk-delete offerings or reverse revisions manually. |
| 9 | Function replacement can reopen a global review block or weaken auth/lock order. | Capture prior function/ACL/proconfig; prove order-8 objects exist and global catalog counts meet contract. | Owner/manager authorization, malformed/global failures, enabled-but-incomplete family remains reviewable, lock order/concurrency. | Restore exact prior function only to diagnose; normal recovery is a forward function migration. |
| 10 | Policy replacement narrows log reads and could surface inactive-status assumptions. | Capture old/new policy and table grants; verify service-role-only DML remains. | Active member can read own dealer; inactive/foreign member cannot; authenticated cannot write; server log write still works. | Forward policy repair from captured definition; never restore inactive-member access as a convenience fix. |
| 11 and 12 | New service-role-only table/RPCs touch `auth.users`, dealer ownership, memberships, imports, and search-path security. | Feature gate proven disabled; exact table/RPC/grant manifest; no conflicting dealer/provisioning identities; disposable claim/import/profile concurrency tests. | Zero anon/authenticated table path; exact column grant on `auth.users`; winner-gated idempotency; confirmed identity; pinned empty search paths; audit completeness. | Keep feature gate disabled. Prefer forward repair. Drop only if zero provisioning rows and a separate destructive gate approves it. |
| 13 | Frozen security/external-integration scope. | None while frozen. | None while frozen. | No operation. |

## 7. Shared backup, apply, and stop conditions

### 7.1 Restore-point gate

Before any future Staging or Production write:

1. Verify the exact project ref and plan-specific backup capability in the
   Supabase dashboard/API; do not infer it from the project tier name.
2. Record a fresh recoverable point and its UTC timestamp outside Git. For
   Production, PITR must be confirmed active and current, or the operation
   stops for a cost/risk decision by the owner.
3. Produce an encrypted logical schema/data backup for the affected tables when
   the platform backup does not provide independently downloadable logical
   evidence. Never commit the dump.
4. Prove the restore procedure in a separate disposable project before the
   Production gate. A backup that has never been restored is not acceptance
   evidence.

### 7.2 Execution-mechanism gate

The standard pending set includes the frozen migration, and historical version
`110` is absent despite later versions being recorded. Therefore no bulk push
is authorized. A later
`PR2-GATE-B-PROD-EXECUTION_MECHANISM_DECISION` must choose
and prove exactly one of these approaches:

- exact-file controlled execution plus separately approved history
  reconciliation after schema/statement proof;
- a new forward-only, reviewed remediation migration that reproduces only the
  approved effects; or
- rebuild/cutover to a reproducible project.

None is selected by this document. Each changes a different risk boundary and
requires its own exact path allowlist, disposable replay, and owner approval.
`migration repair` is never bundled implicitly with SQL execution.

### 7.3 Universal fail-closed conditions

Stop without same-run repair or retry if any of the following occurs:

- project role/ref, Git HEAD, migration hash, or missing-version set differs;
- the frozen migration appears in an execution plan or its content is opened;
- backup/PITR or restore evidence is missing;
- preflight object/data counts differ from the accepted manifest;
- an unexpected lock, timeout, policy, grant, function owner, search path,
  invalid index/constraint, or user-data mutation appears;
- a test executes zero assertions, uses one connection for a concurrency claim,
  or substitutes source assertions for request-scope authorization;
- cleanup cannot prove the disposable environment is gone; or
- the operation would require Production access without the exact Production
  gate.

## 8. Development remediation selection

Gate B-R3 read-only selection evidence is recorded in
[PR #2](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260655658).
It used Git/source metadata only: no Supabase/DB connection, user/business-row
read, secret read, project creation, file edit, test, apply, or history repair.

Development cannot be made reproducible by copying the 59 filenames into its
migration history. Gate B-R3 therefore selects D1 as the binding remediation
candidate for later separately approved execution.

### 8.1 D1 — clean replacement Development project: selected

Create a new isolated Development project in a later explicit gate. Before any
cutover, prove an exact non-frozen Git migration manifest in a fresh disposable
environment, build the replacement from that manifest, and import only an
owner-approved retained-data subset. Keep the current Development project
read-only as a comparison and rollback source until new-environment acceptance
is complete.

This is the only candidate that does not turn the current unexplained
schema/history drift into the new baseline. A platform "restore to a new
project" clone is a database-only copy and therefore also copies the source
database's current schema and data. It may be considered only as a separately
approved forensic/data-extraction aid, not as the clean target baseline.

### 8.2 D2 — side-by-side forward reconciliation: fallback only

Build a disposable Git reference, compare every relation/function/policy/
grant/trigger to existing Development, and author bounded forward corrections
for the exact delta. This becomes eligible only if a later retention audit
proves that Development contains non-recreatable identities or business data
whose safe extraction into the clean schema is impractical. It carries the
highest residual-drift and analysis risk.

### 8.3 D3 — in-place history relabel: rejected

Do not mark versions as applied or relabel migration history unless every live
statement/object, policy, grant, and data effect is independently proven
equivalent to the exact migration. The B-R1A evidence disproves that
prerequisite. No current gate may reopen D3.

### 8.4 Source-only dependency inventory

The Gate B-R3 static inventory found 80 unique active table/query references,
19 unique RPC references, and 30 environment-variable names. The retention
surface spans:

- identity/tenant and Auth user relationships;
- customer, vehicle, estimate, invoice, work-order, completion-report, and PDF
  data;
- pricing/catalog/settings/lifecycle configuration;
- product orders, inventory, logistics, and finance/monthly statements;
- documents, vehicle-registration OCR, and Storage objects;
- audit, notifications, queues, usage logs, staging/UAT evidence; and
- GYEON admin, news, resources, provisioning, and frozen LINE behavior.

The canonical replacement Storage authority contains exactly `documents`,
`work-order-files`, `vehicle-registration-documents`, `dealer-branding`, and
`gyeon-resources`. Completion-report PDFs use `documents`; the older
`completion-reports` bucket reference is stale and must not be reproduced. The
Git candidate has no `supabase/functions` directory; dashboard-created
functions, if any, remain unverified. Application cron entry points cover trial
downgrades, maintenance reminders, and LINE queue processing.

Active source references to LINE link-token behavior do not change its frozen
status. The protected migration remains metadata-only and outside every read,
copy, replay, or execution allowlist.

### 8.5 Default retention and regeneration matrix

| Class | Default disposition |
|---|---|
| `KEEP_IF_EXPLICITLY_JUSTIFIED` | Only active Development Auth identities required for replacement acceptance, their dealer/member/staff/admin relationships, owner-identified irreplaceable transactional examples, and Storage objects referenced by retained rows. |
| `REGENERATE_FROM_GIT_OR_CONFIG` | Schema, functions, RLS/policies, grants, migration history, Storage buckets/policies, and accepted fixtures. The migration ledger is generated by the proved replay; the drifted ledger is not imported. |
| `DISCARD_BY_DEFAULT` | Staging/UAT verification rows, audit/activity history, notifications, queue/log rows, OCR temporary state, failed jobs, AI usage logs, and trial/billing test artifacts. Any exception needs an exact row-domain decision without recording row contents in Git. |
| `FREEZE_DO_NOT_ENABLE_OR_COPY` | LINE secrets/link-token migration and GYEON partner onboarding. `GYEON_PARTNER_ONBOARDING_ENABLED` remains disabled/unset. |
| `ROTATE_OR_RECONFIGURE_SEPARATELY` | Supabase URLs/keys, service-role key, Auth redirect/provider/SMTP settings, Vercel variables, `CRON_SECRET`, OCR/OpenAI key, AI encryption secret, news-email provider, Realtime settings, extensions, webhooks, and read replicas. Secret values are never recorded in Git. |

No default `DISCARD_BY_DEFAULT` decision authorizes deletion from the current
Development project. It only defines what will not be copied unless the owner
later approves an exception.

### 8.6 Owner-approved replacement cost boundary

The replacement Development project may be created only in a later explicit
project-creation gate and only under all of these limits:

- Micro compute only;
- a maximum life of 31 days;
- no paid add-ons; and
- stop before project creation if the Supabase dashboard estimate is more than
  USD 12 before tax, selects a compute size above Micro, or includes an add-on.

The current approximate Micro compute figure is planning evidence only, not an
invoice or permission to create a project. Compute is billed hourly and is not
covered by the Spend Cap, so the later project-creation gate must capture the
dashboard estimate before creation and define the shutdown/retirement date.

### 8.7 Platform-specific rebuild controls

Current Supabase guidance requires these explicit controls:

1. [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
   is beta, paid-plan/physical-backup dependent, incurs a separate project
   cost, and does not copy Storage objects/settings, Edge Functions, Auth
   settings/API keys, Realtime settings, extensions/settings, or replicas.
2. A dashboard restore can recreate database metadata while leaving the actual
   Storage S3 files absent. See
   [Restore Dashboard backup](https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore).
3. CLI migration history preservation is a separate operation, and custom
   `auth`/`storage` changes need separate reconciliation. See
   [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
4. New projects may not expose new `public` tables to Data/GraphQL APIs by
   default. The later acceptance manifest must prove Data API exposure,
   required role grants, and RLS independently.
5. Supabase now ignores explicit extension version clauses. Disposable and
   replacement proofs must record the actual installed extension versions and
   must not claim reproducibility from a requested version string alone.

### 8.8 Required later Development gates

The serial order is binding; each item needs a new explicit owner approval:

1. `COMPLETED`: minimal data-retention and replacement-project cost boundary;
2. `COMPLETED_DESIGN`: the literal 98-path migration/replay and two-path pgTAP
   manifest in Section 13, with the three frozen/deferred paths excluded;
3. `COMPLETED_DESIGN`: the broader database-verification contract in Section
   14 for RLS, grants, Storage, functions/triggers, Data API, concurrency, and
   business surfaces not covered by the two existing pgTAP files;
4. separately approved prerequisite repair candidates for the role-only
   `gyeon_products` SELECT policy and the canonical five-bucket configuration;
5. separately approved implementation of the broader database test/evidence
   suites with fixed non-zero assertion plans;
6. fresh disposable full replay and executable acceptance;
7. replacement-project creation and non-secret configuration, subject to the
   Micro / 31-day / no-add-on / USD-12-before-tax stop rule;
8. read-only old-Development export inventory and transformation manifest;
9. separately approved retained-data and Storage import;
10. old/new schema, authorization, data-count, Storage, Auth, cron, and app
   acceptance; and
11. cutover with rollback proof, followed only later by an independent old-
   Development retirement decision.

No Development reset, replacement project, data export/copy/import, secret
rotation, history repair, cutover, or retirement is authorized by Gate B-R3B.

## 9. Staging plan

Staging already records all twelve non-frozen Production-gap migrations and is
missing only the frozen LINE migration. Therefore its remediation disposition
is `PRESERVE_NO_APPLY`.

A future read-only Staging acceptance gate must:

1. re-verify the exact ref `vhiuiwolnlvlwvoaingd`, 100-row baseline, and 58/59
   PR #2 version result;
2. confirm the frozen migration remains absent without opening its content;
3. run the focused request-scope/RLS, save/idempotency, service-offering,
   duplicate-match, log-policy, and onboarding-gate-disabled probes;
4. prove no migration apply/history repair occurred; and
5. return PASS/CHANGES_REQUIRED before any Production preflight.

Staging tests may reveal defects but do not authorize same-run SQL repair.

## 10. Production plan

Production remediation is staged, serial, and separately approved:

1. `B-PROD-P0_READ_ONLY_PREFLIGHT`: exact ref, backups/PITR, migration ledger,
   object/data/ACL manifests, lock/size estimates, source hashes.
2. `B-PROD-P1_EXECUTION_MECHANISM`: choose and disposable-prove the exact method
   that cannot include order 13.
3. `B-PROD-P2_PRICING_FOUNDATION_1_TO_4`: apply/verify the pricing foundation,
   snapshot revision, trigger repair, and secure RPCs under one explicit gate.
4. `B-PROD-P3_CUSTOMER_AND_RLS_5_TO_7`: apply/verify canonical persistence,
   legacy-policy removal, and generated match keys under a new explicit gate.
5. `B-PROD-P4_SERVICE_OFFERINGS_8_TO_9`: apply/verify the data-mutating
   service-offering model and review function under a new explicit gate.
6. `B-PROD-P5_LINE_LOG_POLICY_10`: apply/verify only the independent log-read
   policy hardening; this gate does not enable LINE.
7. `B-PROD-P6_POST_APPLY_ACCEPTANCE`: independent read-only schema, data-count,
   request-scope authorization, app, and migration-ledger evidence.
8. `B-PROD-P7_ONBOARDING_DEFERRED`: only when the owner decides to activate
   GYEON onboarding; apply orders 11–12 together, verify, then separately enable
   the server flag.
9. Order 13 remains outside every gate while frozen.

Each numbered apply gate requires a fresh owner approval. Acceptance of one
gate never pre-approves the next.

Application deployment, Ready, merge, and feature-flag activation are not part
of these database gates.

## 11. Exact future source allowlists

### Required active-path package (orders 1–10)

```text
supabase/migrations/110_store_pricing_configuration.sql
supabase/migrations/20260726090000_extend_estimate_wizard_snapshot_metadata.sql
supabase/migrations/20260726110000_fix_dpca_revision_trigger_transition_tables.sql
supabase/migrations/20260726120000_secure_dpca_write_rpcs.sql
supabase/migrations/20260727033223_persist_wizard_customer_canonical_columns.sql
supabase/migrations/20260727081104_drop_legacy_own_rls_policies.sql
supabase/migrations/20260727112326_add_customer_match_keys.sql
supabase/migrations/20260728150348_dealer_service_offerings.sql
supabase/migrations/20260729103000_review_gate_drops_family_completeness.sql
supabase/migrations/20260731054835_harden_line_message_logs_active_members.sql
```

### Deferred onboarding activation package (orders 11–12)

```text
supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql
supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql
```

These are **read/apply candidate inputs**, not edit authorization. Any repair,
new migration, test change, or execution manifest needs a newly stated literal
allowlist. The frozen path is never added to an executable allowlist.

## 12. Gate B-R3B completion record

B-R3B was completed and pushed as commit
`96c0d5cb34f60396242ea89ae0cf4d0aac92f59e` with tree
`aa544700b66971473f5c7127289bfffd76b8b024`; remote verification is recorded
in [PR #2 comment 5260968029](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260968029).

The accepted B-R3B boundary was:

- the diff is exactly this file plus `ENVIRONMENT_LEDGER.md`;
- `git diff --check` passes;
- no Supabase/DB connection, migration apply/repair, test, Ready, merge, or
  deployment occurred; and
- document candidate, commit, and push remained separate owner gates.

## 13. Gate B-R3C/R3D literal Development replay and test manifest

### 13.1 Pinned authority and classification

The read-only manifest evidence is
[PR #2 comment 5261032333](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261032333),
pinned to HEAD `96c0d5cb34f60396242ea89ae0cf4d0aac92f59e` and tree
`aa544700b66971473f5c7127289bfffd76b8b024`.

The pinned Git tree contains 101 tracked migration SQL paths. A future clean
Development replay may materialize exactly 98 of them, all mode `100644`. The
following three paths are excluded from every replacement-Development replay:

1. `supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql`
   (`FREEZE_DO_NOT_ENABLE_OR_COPY`; blob
   `4c7feafa37d40dc2a4a48e5f153e4ddf2d439430`);
2. `supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql`
   (same frozen/deferred onboarding package; blob
   `0c51088ab8a8e39777b943ea487d0108f442bfe6`); and
3. `supabase/migrations/20260801110110_line_link_tokens.sql`
   (`FREEZE_DO_NOT_ENABLE_OR_COPY`; metadata-only mode `100644`, blob
   `accd22345054cc44f89156fd78eaba6dfe4242a4`). Its content must not be
   opened, read, copied, diffed, or hashed.

Excluding only the protected LINE path would incorrectly activate the two
owner-frozen GYEON onboarding migrations. The executable count is therefore
98, not 100.

### 13.2 Canonical 98-path executable manifest

The canonical manifest consists of the following LC_ALL=C ordered lines in the
form `<sha256><two spaces><repository-relative path><newline>`. Its combined
SHA-256 is
`174f7caac201e5a14a6625cb64908c88e86c63f0926c13a0ba09f228275e1ce8`.

```text
7cebf9c6d43563286992fee148ac8e8e2411548234d374777a9d3bec5d738580  supabase/migrations/000_shared_functions.sql
1594360f2a27a8aa82c225314d6136c1dfc2c77e573080df2f82431c98ed5a5a  supabase/migrations/001_create_core_tables.sql
6edfe649e303d16201720461c2afbd12f6a944bab4cfffefbc5ac63321bf881e  supabase/migrations/002_enable_rls.sql
066d95620713aaf7e92ef818381aabf45b8403d3508bad79db29a013d6d723a2  supabase/migrations/003_create_dealers_and_members.sql
76e56f5ed6f261e41f2550a712c96fccb6b6145276754d28135970e08c16d5ca  supabase/migrations/004_enable_saas_rls.sql
6d502495abe96c922c0265056feb7a488e6bc1b0f196e500bd8afde364ddbb93  supabase/migrations/035_update_customers_schema.sql
04fcbc81767d3db273c65bc80e4fb4b1a963769987bb05cf2290a6001214cf7d  supabase/migrations/036_update_vehicles_schema.sql
ca1058b5b602ae8d3eb98e9ad59e8365dd34c0eef2a2821467142c0147ecf88c  supabase/migrations/037_rebuild_estimate_core.sql
f4538d6511854f2c1435be7bb851367fb92868c3e00a1f1803c997d60d1deb1a  supabase/migrations/038_create_work_orders.sql
33080f064a3e6250b7f5c70ec57b77576bad846dbacfadc4fe7816e0cfc844fe  supabase/migrations/039_create_work_order_files.sql
96bde6e47601b811342d55046ae38884457c16a34f00d54552cb4bc85d182f67  supabase/migrations/040_create_completion_reports.sql
a12577cac45df67497e9b30e3276d4c3c3af33f2fb1c147f711cd22027bcd776  supabase/migrations/041_create_invoices.sql
6ae5f0253ff5bb0ef8354a7ee1537f037e760520492ca15ae06ba2d2a0d7dc69  supabase/migrations/042_create_payments.sql
79dfb7a988f804f8a50101e1c34538feb164a304fa52dbc891ca8e6238910917  supabase/migrations/043_create_line_customers.sql
6407ec1e77b02036af1572cd8367eb03884182c51a6f605cff090452672807ef  supabase/migrations/044_create_line_message_logs.sql
950cdadb56994010a539b4bc4b7dff23729bd16d5df9fa0660c2d7156b71b149  supabase/migrations/045_create_maintenance_reminders.sql
e1e9185d1f26afd5e3bf976d2c4b76ca68163502ca067c7907cfcd0c2c3ff509  supabase/migrations/046_create_document_sequences.sql
f7941bf2ad2104bd36891c39ace756127871b57fd4568c1512919b39e63828b7  supabase/migrations/047_create_gyeon_products.sql
0803d73cf66d7d1257fd1f6b570df24c2de32ba30ee4523cea3c02dc27677582  supabase/migrations/048_create_product_orders.sql
ecb12ead409d7969632166e66aca750cab49ea611586939dacd2902110e47a0e  supabase/migrations/049_add_plan_to_dealers.sql
12e9ae30de68b0a94f1442da0361e401ff25552ea4c5789e8def46d7b62a6359  supabase/migrations/050_create_staff_roles.sql
0665ee660cd1a0ddbbc7c9f757e930ec8f0eaf55181bbaf07ac7f5cda196f69a  supabase/migrations/051_create_admin_tables.sql
9d79be5a5bf02e9de4cc234e34c84c43422964d1ace38b93488c90cae2e399bb  supabase/migrations/052_create_reservations.sql
66af0c564452cafbe40e77bc80651bb007b217aa5030d58709466572ed7bc094  supabase/migrations/053_create_document_files.sql
587d4ff5de6934b3542e56398f5d59c62830253ecf65bbf503a2f2e68145271c  supabase/migrations/054_notification_activity_timeline.sql
b9f4d0a8da3dd270e5b84cd5e05db1e6fc9d766ac019ed4c7977fa8a3da86d83  supabase/migrations/055_audit_logs.sql
f9d665c0fb01cda25626e6ba8991e8b5bbd48b3abdede1f7c3bdc3ac4e183432  supabase/migrations/058_subscription_license_management.sql
9d17056d69e53e651298e48c90bc442065e95f40992883ba091c2a2398a8c61d  supabase/migrations/059_dealer_onboarding.sql
9ff7815948a05e59132e493117811163df45365ba3594beb42bb6e11352c6f96  supabase/migrations/062_staging_verification.sql
976188336cc88034ece3b24738ff76edf90db2b524878541973012ba92c19ddb  supabase/migrations/063_uat_management.sql
5e39914403f41ba5d913bb5d0793c080ecfda65f719c3c10bad75b1aa18c0b00  supabase/migrations/064_billing_management.sql
6fa1391cba5b19dc6aec06a20aaf8d45f0866450f318eacc02a4d2a95ec83b5e  supabase/migrations/066_company_settings.sql
17000ff97d0e577a40662edf36d7297975e4eae5a168d872b71e5fb282ab07f5  supabase/migrations/067_vehicle_registration_ocr.sql
622f8ea0dc49abc54e949e6503a9c5c9d1c0e3ca21eb1dc185c34b6bab9c54e6  supabase/migrations/068_ocr_sessions.sql
67909398f81326b8b774c26a0ada45ee1e75bc1417fb2aa7aedff56a51e0d740  supabase/migrations/069_inventory_counting.sql
eefaf34281eb286f0b96acce38d6a2f947c8129faf114df90e4345762782d412  supabase/migrations/070_dealer_settings_canonical.sql
5029fc254f8aeb08da129d65523c0fa0c6115b2bacff6a7f05bd8fad8eddc469  supabase/migrations/071_dealer_approval_flow.sql
7788870a16a6d1ab4cdddd1478c7047b57a4bd7f2e7fb7e288bdf50ea3b86969  supabase/migrations/072_inventory_receiving_movements.sql
05e1d7c7f76ff3e2918023837084707fdee86c9ef75572cfc197bdf57ddfb297  supabase/migrations/073_detailer_core_missing_fields.sql
751c56234aa31be495ec073da900f691127e709cdc149bd903d9a37f2239cfaf  supabase/migrations/074_dealer_trial_fields.sql
bed88b48f198d8d9c11eda9c694f1d12a4656aab93f02477d647c41d9362aae0  supabase/migrations/075_admin_roles_expansion.sql
2f48a78cedcd46a2ac62df26350e3f0860caffe7049a68c61343c765f8f6e3dc  supabase/migrations/076_dealer_lifecycle.sql
c99a5c3350a8ceb1638a023daa5008e8316414ebb0a212a695649ae0bb13bfb3  supabase/migrations/077_logistics_foundation.sql
a6761254dcb7ddfbc78a319e1a59ee05eb8bbf118a94e4154637bbbc8ef61e51  supabase/migrations/078_stocktaking.sql
509b8332bc95ae377081944aac4bb8e90c925943a980f67e683f17bab4646d7a  supabase/migrations/079_warehouse_daily_ops.sql
a2b701875eb2f7a124c4372f2cbcb315fa85a0915e5788b955c5026c02e20127  supabase/migrations/080_subscription_status_pending.sql
88b977a305ac1a858f992503179ec9df653e7109713bac6a314d56d707ffe3b1  supabase/migrations/081_dealer_branding_bank_postal.sql
8ce34556ef69f1985e34f5eb5572317ce580d0578b6fc0b202fe40065fd1350c  supabase/migrations/082_gyeon_news_center.sql
b3b5ecc88a21677b8d6ba646f3118d796527145e3e1fe5af49aa99f110925f49  supabase/migrations/083_gyeon_resource_center.sql
e3cf32d80752fde2b4d069cc20d54e19834a7913df341790eca956f8e4760650  supabase/migrations/084_stamp_kind.sql
22ee19bdf0f2705a6fb0b4d19775f88fcbe2da807d7f85eaf0084bd1efac22b1  supabase/migrations/085_point_card_foundation.sql
a0bfed35b35acfd6297743ecace19e8cf5ef3a686a292af0ac3ec86a63891301  supabase/migrations/086_customer_app_foundation.sql
b53acc880d95a0ac8de2387cd188d83e8b17aa1325e24192e08522223bd57c68  supabase/migrations/087_point_transaction_meta.sql
761a26339b8bd7fa7851b46da0f4212db2bdf1033c1d36f3f0361f6419317b68  supabase/migrations/088_dealer_soft_delete.sql
aacc572b9d5acb746f3899a0b001f099a0ec96e3ae94a83289a82963e5f7a216  supabase/migrations/089_news_distribution.sql
f3b81c415e9b107164e2305bd74002187eba502edf7064a80d8f46e17ab26882  supabase/migrations/090_news_newsletter_category.sql
8a411ae1e606d0b43887b905afe0e21b30e9acd5002ccb5ca746f87dcd114803  supabase/migrations/091_dealer_rank_normalization.sql
74265904976c6720ff05f1ed09f4a321ab234254abc6c6991823b76b241709e5  supabase/migrations/092_work_bays.sql
05a0537596a38057c1be148292a25bdf8a09b019d011a0d5509cf868d7f70094  supabase/migrations/093_estimate_category_expand.sql
e0152b579a0162ac62438706f8bc35475573b1d7cecbc00e509925c1e08b65e4  supabase/migrations/094_gyeon_ai_settings.sql
81f8b58aa5a67f9ad9411f64d4f1b29ede70a6503d01dec9f83eb7625b444743  supabase/migrations/095_gyeon_ai_usage_log.sql
f027ea43abba6a9553d3d46a10d469f2b1cd6a921cd37d9ade5b9b94e3019271  supabase/migrations/096_dev_diagnostics.sql
f4db1d863aac7148fae8b761d8558fe4aae74d7cabc0fa3465a1fcd336585514  supabase/migrations/097_add_ppf_installer_rank.sql
6228ad6c979a75a893926d003bee605578beb00df30c790f9d345e68248e58a2  supabase/migrations/098_vehicles_first_registration.sql
2cdc81d40021d0043cec900013fbf5114dcc3e4cf3dcc3e68b54b3d563d9740d  supabase/migrations/099_estimate_workflow_status.sql
87c8638aa9ae1ce1e7efa660bd39d982aee9cf45ea4a161f2587f4213d18777b  supabase/migrations/100_customer_business_billing_fields.sql
e0826bcabc24dccaeec1e385f6fae4efeb3311af0a3f017045cec43e6a125fd7  supabase/migrations/101_customer_accounts_receivable_allowed.sql
5965bdc9158978e1fabd632c3383709a8b91adea93ed27cc5f2c2ac597e55058  supabase/migrations/102_estimate_wizard_atomic_save.sql
76e20f358beb82e94ded316d0f4bccfc68aa2820893a2fcd14312da28dc422b8  supabase/migrations/103_wizard_catalog_schema.sql
73058c926f954a1ccf3c53b190d600d45499e7b59c2f8992e5ad1013e90dff90  supabase/migrations/104_least_privilege_grants.sql
1aeeea0cc1215755c45cdee377ff32d513bbcc755d4e764d08ee44774788c1cf  supabase/migrations/105_seed_global_wizard_catalog.sql
ffaf52213667e07093cd88eb445eb54d1ce936fd3ef5365c83807edfe769fc8c  supabase/migrations/106_dealer_wizard_catalog.sql
212b1e4bbefb6cb9e8e0f0cbc3345fbcd5e2acdd24a4e296c600bd9e87c7ad07  supabase/migrations/107_wizard_catalog_lifecycle_read_grant.sql
71119ff4db00ec198ad595c658514e1aa0d2c8b1c32150342a744446232abfa2  supabase/migrations/108_secure_wizard_catalog_authoring.sql
061fd12ba7d1801dc9b6567d9ba764a676c12766068a6e871b4d5fb9a52a3059  supabase/migrations/109_wizard_catalog_review_history.sql
8ae0a1a1121e02a80b979042ed58ec4efa864783488762599c45712150d5c40d  supabase/migrations/110_store_pricing_configuration.sql
a91628b88eddcbb11577fdaa57169fa113020f8867695afeeb7ed43a1843e0b5  supabase/migrations/20260719122621_estimate_wizard_atomic_save_hardening.sql
ff8096b3568edd01aa65447980abde750fc559c88d5f290dfcebba910ce88f81  supabase/migrations/20260720024724_estimate_wizard_atomic_numbering.sql
984443393a95c22d894e18c0bff58a777a3acf0e7b5d3a9f1453c07d047c7898  supabase/migrations/20260724050252_estimate_shares.sql
aa5faad04acbbe710616558c083ff95d9e69976514562123f1934ea36797e5f1  supabase/migrations/20260725012819_explicit_policy_with_checks.sql
1faaf29b4fcbf8080b6ce859da6ce5a1334b8022d4db292ea90adfb4c8e5c161  supabase/migrations/20260725081403_security_advisor_hardening.sql
370fdfe54822c022b691949b6b5396dc1e6b4fa9c67ba8e3626a2cfa849661ee  supabase/migrations/20260725101130_documents_storage_setup.sql
a6404dcd37b2fef14543fd31d418969810b25ebca3d61d06eff1e73ce1d11b91  supabase/migrations/20260726090000_extend_estimate_wizard_snapshot_metadata.sql
58f238c1df09f9e633ce9da411b474c5ec8f9c22ec8e0a5bb14e7f265663b0b6  supabase/migrations/20260726110000_fix_dpca_revision_trigger_transition_tables.sql
98fd69a7933314da8ae0c806c1cffdc5d4df0b27f8ae8a57abff8143dcff49a4  supabase/migrations/20260726120000_secure_dpca_write_rpcs.sql
0cd14ff10e4358d67e898e567c33cd72836d2376c854031a56d3d25b2aec6fdf  supabase/migrations/20260727033223_persist_wizard_customer_canonical_columns.sql
a25cf16e70af3f6b3e5e68bd7a63423dade707ef2ea282f5561e4492999972f7  supabase/migrations/20260727081104_drop_legacy_own_rls_policies.sql
8eb12bedf1f37f052ad419126bb47766156333846f52c23b4bec81caba1b438e  supabase/migrations/20260727112326_add_customer_match_keys.sql
7419b1b89775346badfa854e9894f54fc4731feaf7bd5a52ba2743735d723bc2  supabase/migrations/20260728150348_dealer_service_offerings.sql
4d73b8526545014d87fc02f2ece43e2af0271ffe32165a63ecae46ab1f98ec56  supabase/migrations/20260729103000_review_gate_drops_family_completeness.sql
330558862946a8ac27b97f34cdc4a4affc0fdd24c7b445ffe4dc3e8e31394cba  supabase/migrations/20260731054835_harden_line_message_logs_active_members.sql
df9824e5e685119a2d2f21ece814a48e1b8e48da5e6c59189403e56a3e2a204b  supabase/migrations/20260801132658_invoice_issued_immutability.sql
62105b970237105249e90f8226f1988eafacdc672ce321b5c07d65655c343118  supabase/migrations/20260802030025_documents_storage_fail_closed_authorization.sql
940963d010d3603d246ce9b78507c54305bc5c00190c05f1c9fc094b2be7f236  supabase/migrations/20260804233104_invoice_delivery_date.sql
0f192f448da161580cc2da5072dac1a1923a0c4a9f31284be5abf0c5a3a02d73  supabase/migrations/20260805231712_monthly_statement_foundation.sql
0dfbe7ae78b0fabc1e8ae61d20c83b4314d9a1c68e8b438bc1685f6a82a27263  supabase/migrations/20260806134812_payment_allocations_receipts_adjustments.sql
9b09dbfd94ddffa9750e10d81d6c91879638a439c21b60f81827e1b535f482bc  supabase/migrations/20260806234404_create_monthly_statement_draft_rpc.sql
1f0f0f491e0e083c8163cb309b3846c035629c6930e83b180dc2e9ffdab86255  supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
```

### 13.3 Canonical pgTAP manifest and coverage boundary

The only two tracked pgTAP database tests at the pinned tree are:

```text
e3d29fba808e2c617fed3663157d8a7990d533f12e1e6d92327bbfca31321d5f  supabase/tests/estimate_wizard_atomic_save.test.sql
9630ddfef22f21236f49a5f7c612703b136bc50144fe75a9a80f92a9c6ab568e  supabase/tests/estimate_wizard_dml_integrity.test.sql
```

The canonical two-test manifest SHA-256 is
`7ac67877505101120128492b08534f9c4282d29006f00ed64fa661fa799f5f6a`.
Their declared plans are 165 and 50. A later accepted run must report exactly
`Files=2`, `Tests=215`, every assertion successful, and `Result: PASS`.

These suites prove estimate-wizard atomic save/numbering and direct-DML/RLS
protections only. They do not prove whole-system RLS, grants, Storage,
functions, triggers, Data API exposure, or business behavior for all 98
migrations. Replay success plus these 215 assertions is therefore not full
replacement-Development acceptance. The broader verification contract in
Section 8.8 must be ratified before runtime acceptance can be claimed.

### 13.4 Future disposable runtime contract

No runtime is authorized by B-R3C or B-R3D. A later separately approved gate
must satisfy every condition below:

1. create a fresh unique disposable directory outside every Git worktree;
2. run `supabase init` there, then materialize only the exact 98 migration paths
   and two test paths from the pinned Git commit;
3. never copy the source checkout's ignored `supabase/.temp/` state; its
   existence may be checked as metadata, but its contents are not replay input;
4. use local-only commands without `--linked`, a project ref, remote URL/key/
   token, `--db-url`, seed, or any shared/Staging/Production target;
5. use the inspected CLI version `2.108.0` unless a later preflight ratifies a
   new version; initialize/start, then run one local `db reset --no-seed`;
6. require the local migration list to contain exactly the 98 ordered entries
   and none of the three excluded paths before running tests;
7. run the two accepted pgTAP files exactly once only after replay succeeds;
8. record the actual PostgreSQL and extension versions. The 98-path scan found
   no explicit extension-version clause, and requested versions are not proof
   of installed versions;
9. fail closed on any error, burn the disposable suffix and evidence, perform
   no same-run repair or retry, and use a new explicit gate for correction; and
10. stop with `--no-backup`, then independently prove that target containers
    and volumes were removed.

### 13.5 Gate B-R3D completion rule and stop

B-R3D is a two-document, uncommitted candidate only. Completion requires:

- the diff is exactly this file plus `ENVIRONMENT_LEDGER.md`;
- the candidate base remains HEAD
  `96c0d5cb34f60396242ea89ae0cf4d0aac92f59e` / tree
  `aa544700b66971473f5c7127289bfffd76b8b024` with an empty index;
- the 98-path and two-test manifest hashes independently match this section;
- `git diff --check` passes;
- the three excluded paths remain unchanged and the protected LINE content is
  not accessed; and
- no Supabase/DB/project connection, migration replay/apply/repair/reset/seed,
  test, stage, commit, push, Ready, merge, or deployment occurs.

After independent acceptance, the next operation is a separate two-path
documentation commit gate. Runtime verification remains closed.

## 14. Gate B-R3E/R3F broader database-verification contract

### 14.1 Pinned authority and purpose

The read-only contract evidence is
[PR #2 comment 5261394747](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261394747),
pinned to HEAD `99b2859cda6256bc402f0918bba5ef29b6db1306` and tree
`d5caae0515d02d957ed0fadad29f6479434a3098`.

The 98-path replay and two-file/215-assertion pgTAP values are the historical
pre-R4 baseline. After the accepted R4 forward migration and focused suite,
the current baseline is 99 executable migrations and three pgTAP files with
293 planned assertions. These are mandatory, but they are not whole-system
acceptance. The following contract closes the uncovered
database-object, authorization, Storage, Data API, function/trigger,
business-behavior, concurrency, and out-of-band configuration surfaces. Static
source counts are diagnostic only; the disposable database catalog is the
acceptance authority because migrations can replace, drop, or recreate the
same named object.

### 14.2 Required evidence suites

The broader acceptance package must implement and execute these eight serial
suites. Each executable suite must declare a fixed, non-zero assertion plan.

1. `CATALOG_MANIFEST`: actual PostgreSQL and extension versions; schemas;
   relations; columns; data types; defaults; nullability; constraints; indexes;
   foreign keys; owners; ACLs; RLS flags and policies; triggers; and every final
   function signature, owner, `prosecdef`, `proconfig`, and grant.
2. `GRANT_RLS_ROLE_MATRIX`: `anon`, `authenticated`, `service_role`, active
   owner/manager/staff, inactive member, foreign-dealer member, and no-member
   actors. It must prove positive and negative CRUD behavior with real local
   Auth tokens for two tenants. `service_role` is server-only and is never used
   as dealer-facing authorization proof.
3. `DATA_API_MATRIX`: classify all 80 recorded table/query references and all
   19 RPC references as `CLIENT_EXPOSED`, `SERVER_ONLY`,
   `FEATURE_GATED_ABSENT`, or `NO_LONGER_ACTIVE`. Zero references may remain
   unclassified. Intended table and RPC behavior must be proved through real
   local request paths; anon OpenAPI schema enumeration is not exposure proof.
4. `STORAGE_MATRIX`: exact bucket existence/configuration, `storage.objects`
   policies, generated path ownership, cross-tenant and inactive-member denial,
   and the required upload/read/update/delete behavior. Any upsert path requires
   INSERT, SELECT, and UPDATE authorization.
5. `FUNCTION_TRIGGER_MATRIX`: every final callable and trigger definition,
   least-privilege EXECUTE grants, accepted caller/owner behavior, transaction
   rollback, audit effects, and pinned `search_path` for every accepted
   security-definer function. No unjustified PUBLIC EXECUTE is allowed.
6. `BUSINESS_DOMAIN_MATRIX`: tenant/Auth; customer/vehicle;
   estimate/catalog/pricing; invoice/payment/monthly statements/PDF pointers;
   work orders/completion/files; product orders/inventory/logistics;
   reservations/reminders/queues; admin/audit/staging/UAT/AI usage; and
   news/resources/branding/OCR.
7. `CONCURRENCY_MATRIX`: genuine separate-process and separate-connection proof
   for atomic/idempotent saves, numbering, payments/allocations, monthly
   statements, catalog review, queues, and every other collision-sensitive
   write identified by the catalog/business inventory.
8. `FROZEN_OPERATIONAL_MATRIX`: the three excluded migrations remain absent;
   their functions and features remain disabled and fail closed; cron secrets
   fail closed; actual extension versions are recorded; and every dashboard-
   created function or configuration item is either proved absent or explicitly
   declared in the environment authority.

### 14.3 Canonical Storage authority

Replacement Development must contain exactly these five application buckets:

| Bucket | Canonical purpose | Acceptance boundary |
|---|---|---|
| `documents` | Dealer documents and generated completion-report PDFs | Private; request-scope tenant authorization required |
| `work-order-files` | Work-order attachments | Private; dealer/path ownership and operation-specific authorization required |
| `vehicle-registration-documents` | Vehicle-registration source documents | Private; authenticated tenant-scoped access only |
| `dealer-branding` | Dealer branding images | Public object reads only where explicitly intended; dealer-folder writes remain authorized |
| `gyeon-resources` | GYEON resource files | Private; accepted authenticated/admin access matrix required |

`completion-reports` is not a separate bucket. It must be absent from the
replacement catalog and configuration. Historical comments or setup text that
name it do not override this table. Bucket configuration and policies are
regenerated from an accepted migration/configuration package; they are not
copied from drifted Development.

### 14.4 Mandatory authorization repair before runtime acceptance

The surviving `gyeon_products` SELECT policy uses a role-only authenticated
predicate and does not enforce the stated active-dealer-membership boundary.
Role-only authentication is not tenant or business authorization. A separate
explicitly approved forward migration must replace that policy without editing
historical migration files. Its focused regression suite must prove:

- an active authorized dealer member can read the intended product rows;
- inactive, no-member, and anonymous actors cannot read them; an active member
  of any dealer may read the shared global product master;
- no broader table or RPC grant is introduced; and
- the policy uses an explicit target role plus the accepted membership/owner
  predicate, rather than `auth.role()` or a role-only rule.

The forward migration candidate, focused tests, implementation verification,
commit, push, and disposable runtime remain separate gates. Until accepted,
broader runtime acceptance is blocked.

### 14.5 Platform controls and fail-closed acceptance

The contract follows current Supabase behavior:

- [Data API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api)
  are separate layers. Every intended object needs explicit least-privilege
  grants and an independently verified RLS/function boundary.
- New `public` objects cannot rely on automatic Data/GraphQL exposure. The
  expected grants must be represented in Git and proved from the final catalog.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
  is operation-specific; upsert requires INSERT plus SELECT and UPDATE.
- anon access to the Data API root no longer exposes the OpenAPI schema and is
  not an exposure test. Use catalog evidence and real table/RPC requests.
- requested extension-version clauses are not installed-version proof. Record
  the actual disposable and replacement versions.

A disposable runtime is accepted only when all of these conditions hold in
order:

1. the exact 99 migrations replay successfully and the local ledger contains
   exactly those 99 ordered entries;
2. the exact current three pgTAP files run once, report `Files=3`, `Tests=293`,
   every assertion successful, and `Result: PASS`;
3. every broader suite has a fixed non-zero plan and passes without skip,
   notests, or unclassified evidence;
4. the actual catalog has zero unexpected or missing objects against the
   separately ratified expected manifest;
5. there is zero runtime public `CREATE`, zero unexpected `anon` privilege,
   RLS on every exposed relation, ownership plus `WITH CHECK` for authorized
   UPDATE, and no unjustified PUBLIC EXECUTE;
6. real two-tenant requests prove no cross-tenant disclosure or mutation;
7. every one of the 80 table/query and 19 RPC references is classified and its
   intended Data API behavior is proved;
8. the Storage catalog contains exactly the five buckets in Section 14.3,
   `completion-reports` is absent, and every required operation matrix passes;
9. every security-definer function has an accepted owner, pinned `search_path`,
   explicit caller checks where required, and least-privilege ACL;
10. every separate-connection concurrency proof passes without retry; and
11. any failure burns the disposable suffix, stops the run without same-run
    repair, and cleanup proves zero remaining run containers and volumes.

### 14.6 Frozen and out-of-band boundary

The exact three excluded migrations remain those in Section 13.1. The protected
LINE migration stays metadata-only; its content is never a test-design or
runtime input. The deferred onboarding functions must be absent after the
current 99-path replay, and `GYEON_PARTNER_ONBOARDING_ENABLED` must remain unset
or false so all related entry points fail closed. References to 98 paths are
historical only.

There is no tracked `supabase/functions` directory at the pinned tree. A future
replacement gate must prove that no dashboard-only Edge Function or database
function is silently required, or add an explicitly reviewed declaration and
reproducible configuration package under a separate gate. Current Development,
Staging, Production, preview, LINE, external providers, and protected content
are outside the disposable runtime boundary.

### 14.7 Gate B-R3F completion record

The exact two-document R3F candidate was accepted, committed, and pushed as
commit `684dc3263afe4943658a889e0e8232f415bba0e4`, tree
`60e0dcdc618e840b0d90ab248c8dde67e0cd7a58`. Remote verification is
recorded in [PR #2 comment 5261545745](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261545745).
That documentation delivery did not authorize policy/config implementation,
broader-suite implementation, a disposable runtime, or any environment
operation.

## 15. Gate B-R4A/R4B product and Storage repair contract

### 15.1 Pinned authority and split repair tracks

R4A read-only evidence is
[PR #2 comment 5261626098](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5261626098),
pinned to HEAD `684dc3263afe4943658a889e0e8232f415bba0e4` and tree
`60e0dcdc618e840b0d90ab248c8dde67e0cd7a58`.

The repair is split into independent tracks:

1. `DATABASE_CONFIGURATION`: forward `gyeon_products` SELECT-policy repair,
   canonical five-bucket configuration/policy package, and one focused pgTAP
   suite; and
2. `APPLICATION_SOURCE`: admin-only product import, vehicle-registration
   archive authorization/result handling, and private work-order-file delivery
   and deletion semantics.

No source mismatch may be repaired by widening authenticated table or Storage
privileges. The tracks require separate literal allowlists and separate owner
approval.

### 15.2 `gyeon_products` policy and grant contract

The table is a global shared GYEON product master with no `dealer_id`. The
forward migration must:

- leave `047_create_gyeon_products.sql` unchanged;
- drop the exact historical role-only SELECT policy and create exactly one
  replacement `FOR SELECT TO authenticated` policy;
- require `(select auth.uid()) is not null` and an active `dealer_members` row
  for the caller;
- allow active members of different dealers to read the same shared rows;
- deny invited, inactive, suspended, removed, no-member, and anonymous actors;
- retain authenticated SELECT only, service-role CRUD, and no PUBLIC/anon
  table privilege; and
- use no `auth.role()`, owner-only fallback, SECURITY DEFINER helper, or
  `wiz_is_any_active_member` dependency.

Focused tests must also prove authenticated INSERT, UPDATE, and DELETE remain
denied. Product CSV import is not authority for broader grants: its current
request-scoped client and missing admin gate are a separate source defect.

### 15.3 Canonical bucket configuration

The accepted tracked configuration package regenerates exactly this catalog:

| Bucket | Public | Source-derived ceiling | Accepted content boundary |
|---|---:|---:|---|
| `documents` | No | 50 MiB | PDF documents, including completion reports |
| `work-order-files` | No | 20 MiB | current image/PDF/MP4/QuickTime surfaces |
| `vehicle-registration-documents` | No | 20 MiB | post-preprocessing image bytes and PDF |
| `dealer-branding` | Yes | 5 MiB | canonical PNG logo/stamp output |
| `gyeon-resources` | No | 100 MiB | admin-managed resource MIME |

Any Storage MIME restriction must accept the bytes the server actually uploads
after preprocessing; an old setup document is not evidence of runtime bytes.
`completion-reports` must be absent. If that bucket exists, the forward package
raises before changing any bucket or policy. It does not delete or move objects.

The operation matrix already fixed by source and accepted contracts is:

- `documents`: tenant-scoped SELECT/INSERT/UPDATE; no authenticated DELETE;
- `dealer-branding`: intended public object delivery plus active dealer-folder
  SELECT/INSERT/UPDATE/DELETE; upsert requires SELECT, INSERT, and UPDATE; and
- `gyeon-resources`: active-member/admin reads, admin-only writes, and ordinary
  dealer writes denied.

The final authenticated DELETE matrices for `work-order-files` and
`vehicle-registration-documents` remain blocked on Section 15.4. A database
policy must not grant a direct Storage client more power than the accepted
server action.

### 15.4 Application-source blockers

1. `src/lib/products/import-gyeon-products-csv.ts` claims service-role behavior
   but uses the request-scoped SSR client. The dealer-facing
   `src/app/products/ProductsClient.tsx` exposes the import without an admin
   gate. The later source repair uses accepted admin authorization and a
   server-only admin client; authenticated product writes stay denied.
2. `archiveVehicleRegistration()` calls a user-scoped copy/remove path while
   historical setup prohibits DELETE, and it marks the database row archived
   without requiring the Storage archive result to succeed. The later repair
   must define the required staff capability, fail on Storage failure, and then
   bind the minimum Storage operation set.
3. `work-order-files` is private, but `uploadWorkOrderFile()` can persist
   `is_public=true` and call `getPublicUrl()`. Its upload-failure cleanup and
   explicit delete path also require an authorization rule consistent with the
   server-side delete capability. The later repair preserves private delivery;
   it does not make the bucket public.

These are security and behavior decisions, not configuration typos. No R4C or
R4D database-only phase may edit the listed source files.

### 15.5 Focused SQL acceptance

The accepted focused suite has a fixed, non-zero plan and proves all of the
following with real local Auth tokens for at least two tenants:

- exactly one surviving product SELECT policy with the target, predicate, and
  table ACL from Section 15.2;
- exactly five bucket IDs and exact public/private/configuration values;
- `completion-reports` absent and a pre-mutation failure when it is present;
- exact policy names, commands, target roles, `USING`, and `WITH CHECK`;
- positive own-tenant and negative cross-tenant, inactive, no-member, and
  anonymous Storage operations;
- SELECT+INSERT+UPDATE for every accepted upsert path;
- zero unexpected PUBLIC/anon writes; and
- `Files=1`, `Tests>0`, every assertion successful, no skip, and no `NOTESTS`.

Service-role success or `SET ROLE` simulation does not substitute for
dealer-facing authorization. The disposable replay/runtime and
separate-connection checks were executed under later independent gates; their
accepted bounded results are recorded in Section 15.6 and do not close the
broader Section 14 contract.

### 15.6 R4 completion record and remaining source boundary

The R4B two-document contract was accepted before implementation. Its literal
documentation allowlist was:

1. `docs/master_specification/ENVIRONMENT_LEDGER.md`
2. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md`

The bounded database/configuration track was subsequently implemented,
verified, committed, and pushed as commit
`67ac2eb5aedc5ac8e95481db4164f7a62a3f104c`, tree
`aad9e8bdb5dad18128c418038075c0fb03c4b82a`. The accepted migration SHA-256 is
`fc71129b5e74bcf9cd1a0751ef58d34f85e6e50459b563bdee610b95e55620a2`; the
accepted focused pgTAP SHA-256 is
`4f489765328c6980bbc4dcd6894ad6a935d6afb3513368b75b85ee962ec90f39`.

The disposable runtime replayed 99/99 executable migrations, then passed the
focused suite with `Files=1`, `Tests=78`, real two-tenant Auth/Storage proof
with 56 passing cases, and genuine separate-process/separate-connection
concurrency with 12 passing cases. Cleanup was verified. No shared, linked,
preview, Staging, or Production environment was modified.

This acceptance closes only the bounded R4 database/configuration subset. The
three application-source blockers in Section 15.4 remain pending under a
separate allowlist, and the complete three-file/293-assertion baseline plus all
eight suites in Section 14 remain required. Shared-environment apply, Ready,
merge, and deployment remain separate owner gates.

## 16. PR #2 integration release sequence and live-metadata authority

PR #2 is intentionally the v1.0 integration release vehicle. The immutable
pre-ledger audit snapshot was HEAD
`67ac2eb5aedc5ac8e95481db4164f7a62a3f104c`, 319 commits ahead of and 0 behind
`main`, 2,297 changed paths, and +180,980 / -5,359 lines. Commit
`8c126e4539b8880ca507d2e1e2a411e358f7ba18` delivered that first ledger
snapshot and necessarily advanced the PR, demonstrating why versioned
documents must not call an embedded SHA their own live head.

The PR header and GitHub API are authoritative for the live head, topology,
and scope. The mutable external PR-body authority block may record a timestamped
live snapshot and must be refreshed after a metadata push. This document stores
immutable audit baselines, evidence links, and release rulings only. The
intentional integration scope remains not merge-ready.

The mandatory release sequence is:

1. complete the self-reference-safe metadata repair: versioned documents keep
   immutable audit baselines while the external PR body records live head and
   scope, without altering source, tests, or migrations;
2. rerun incremental Gate A repository-hygiene review from accepted commit
   `2da69c7261a8e884ee1626c1e397b50bb387f88c` through the current head;
3. complete Gate B's eight suites, current 99/3/293 baseline, and the three
   application-source blockers in Section 15.4;
4. complete Gate C current-head security/destructive review, including real
   request-scope authorization, hard-delete/access-cut behavior, admin
   lifecycle, RLS/RPC boundaries, and `096_dev_diagnostics.sql`;
5. complete Gate D current-head typecheck, build, and end-to-end proof;
6. complete Gate E reviewer, protection/ruleset, product-owner, rollback,
   deployment, and post-deploy controls; and
7. only after PR #2 integration, retarget or otherwise re-resolve deferred
   GYEON Draft PR #8 and fully reverify it against the integrated baseline.

PR #2's displayed Ready state is not an accepted release gate. No step in this
metadata-repair phase authorizes tests, a database/Supabase connection, stage,
commit, push, Ready-state change, merge, shared-environment apply, or deploy.
