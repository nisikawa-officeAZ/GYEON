# DealerOS Environment Remediation Plan

## 1. Authority and current status

| Field | Value |
|---|---|
| Phase | `PR2-GATE-B-R3B_DOCUMENT_CANDIDATE` |
| Status | `DOCUMENT_CANDIDATE_UNCOMMITTED` |
| Owner approval | 2026-08-12 |
| Repository / PR | `nisikawa-officeAZ/GYEON` / PR #2 |
| Branch | `fix/approval-center-delete-access-cut` |
| Candidate base HEAD | `3f3a085feee987a9024375e11c06644f3b990fde` |
| Candidate base tree | `f3417b03c098799e211d6b321e64a33bfcf51228` |
| Owner ruling | [PR #2 comment 5260802893](https://github.com/nisikawa-officeAZ/GYEON/pull/2#issuecomment-5260802893) |
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

Storage surfaces include `documents`, `dealer-branding`, `gyeon-resources`,
`work-order-files`, `completion-reports`, and the vehicle-registration bucket
selected by `STORAGE_BUCKET`. The Git candidate has no `supabase/functions`
directory; dashboard-created functions, if any, remain unverified. Application
cron entry points cover trial downgrades, maintenance reminders, and LINE queue
processing.

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
2. literal migration/replay/test manifest with the frozen path excluded;
3. fresh disposable full replay and executable acceptance;
4. replacement-project creation and non-secret configuration, subject to the
   Micro / 31-day / no-add-on / USD-12-before-tax stop rule;
5. read-only old-Development export inventory and transformation manifest;
6. separately approved retained-data and Storage import;
7. old/new schema, authorization, data-count, Storage, Auth, cron, and app
   acceptance; and
8. cutover with rollback proof, followed only later by an independent old-
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

## 12. Gate B-R3B completion rule

B-R3B is complete only when:

- the diff is exactly this file plus `ENVIRONMENT_LEDGER.md`;
- HEAD/tree and index remain unchanged/empty;
- `git diff --check` passes;
- no Supabase/DB connection, migration apply/repair, test, stage, commit, push,
  Ready, merge, or deployment occurred; and
- Codex independently accepts the document candidate before any commit gate.
