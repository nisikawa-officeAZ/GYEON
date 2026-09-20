# R4Q-R12E — Remaining Seven Gate B Database Suites (Static Uncommitted Candidate)

## 1. Authority and pinning

| Field | Value |
|---|---|
| Status | `STATIC_UNCOMMITTED_R12E_R2_REPAIR_CANDIDATE_NOT_RUNTIME_PROOF` |
| Candidate date | 2026-08-15 |
| Repository / PR | `nisikawa-officeAZ/GYEON` / PR #2 |
| Pinned base HEAD | `2f0b56cdc3d66cbe4ce050cfa335678934fb1cb2` |
| Pinned candidate head | `0b694461e5ee735dd969703eb7f4dac4a5fadcad` |
| Pinned candidate tree | `d54a571583469f2017f660df072178fdcef9b8c6` |
| R12E-R2 repair allowlist | This file, `ENVIRONMENT_REMEDIATION_PLAN.md`, `ENVIRONMENT_LEDGER.md`, the grant/data suites, and `src/lib/release/readiness.ts` only |
| Database or test execution while repairing | None; the earlier R12F-R2 disposable failure is recorded in Section 8 |
| Git, staging, commit, push, Ready, merge, deploy | None; all remain separate owner gates |

This document is read-only design/inventory evidence. It records the exact
seven remaining `ENVIRONMENT_REMEDIATION_PLAN.md` Section 14.2 suite files
(`GRANT_RLS_ROLE_MATRIX` through `FROZEN_OPERATIONAL_MATRIX`), their static
plans and hashes, their actual bounded coverage, and their runtime-only gaps.
It does not connect to any Supabase project or local database, replay any
migration, execute any test, or authorize any environment operation.

## 2. Exact current 11-path candidate boundary

The candidate scope is bounded to exactly these eleven paths. R12E originally
created the ten database-suite/document paths; the owner-approved R12E-R2
repair added the one source path needed to remove a real obsolete RPC call.
No other repository path may be added, modified, staged, or committed:

```text
docs/master_specification/GATE_B_REMAINING_SEVEN_DB_SUITES.md
docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md
docs/master_specification/ENVIRONMENT_LEDGER.md
src/lib/release/readiness.ts
supabase/tests/grant_rls_role_matrix.test.sql
supabase/tests/data_api_matrix.test.sql
supabase/tests/storage_matrix.test.sql
supabase/tests/function_trigger_matrix.test.sql
supabase/tests/business_domain_matrix.test.sql
supabase/tests/concurrency_matrix.test.sql
supabase/tests/frozen_operational_matrix.test.sql
```

All eleven paths are candidate artifacts. The seven SQL files are new static
suite candidates, the three documentation paths record their contract and
ledger, and the one source path removes the discarded call to nonexistent
`public.version()`. Previously ratified catalog artifacts may be used as bounded
source-derived design inputs; protected identities remain metadata-only under
Section 3.

## 3. Protected metadata-only boundaries

Four protected identities remain metadata-only across every suite reviewed
here, per `ENVIRONMENT_REMEDIATION_PLAN.md` Section 13.1/14.6 and
`ENVIRONMENT_LEDGER.md` Section 14:

1. `supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql`
   (`FREEZE_DO_NOT_ENABLE_OR_COPY`; blob `4c7feafa37d40dc2a4a48e5f153e4ddf2d439430`)
2. `supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql`
   (`FREEZE_DO_NOT_ENABLE_OR_COPY`; blob `0c51088ab8a8e39777b943ea487d0108f442bfe6`)
3. `supabase/migrations/20260801110110_line_link_tokens.sql`
   (`prohibited/frozen`; mode `100644`, blob `accd22345054cc44f89156fd78eaba6dfe4242a4`)
4. `ScreensPreview.tsx` (content-protected; recorded in `CATALOG_MANIFEST.md`)

None of the seven suite files read, opened, copied, diffed, or hashed the
protected content of these four identities. Only recorded path, mode, blob,
and absent/disabled status were used where applicable
(`frozen_operational_matrix.test.sql`).

An earlier R12E attempt was aborted after prohibited protected-content access;
its zero-change incident evidence is recorded in PR #2 comment `5294569062`.
The present accepted-candidate attempt restarted from the pinned head and used
only the metadata boundary above.

## 4. Per-suite record

### 4.1 `grant_rls_role_matrix.test.sql` — `GRANT_RLS_ROLE_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(40)` |
| SHA-256 | `2269707f6cb083bfa03962bc96e89d9e2ba351c5cc9b8b7af6cfb37d349f9f1a` |

Static checks (sections 01-20): exact/bounded live-catalog comparisons
against `CATALOG_MANIFEST.md` canonical counts — 82 RLS-enabled public base
relations, 190 policies (173 public + 17 storage), 463 relation ACL grants,
and full-row equality for the 24-row function EXECUTE ACL set on
`authenticated`/`service_role`, plus an `anon` zero-privilege guard across
relations, functions, and policy role membership. The intentional
RLS-on/no-policy set is exactly the eight service-role-only tables recorded by
the source migrations; it is a fail-closed client posture, not missing policy
coverage.

Sections 21-40: a two-tenant actor matrix (active owner, active
manager, active staff, inactive/suspended member, foreign-dealer member,
no-member caller, anon, and `service_role` fixture-only) against the
`dealer-branding` Storage object policy set, using deterministic UUID
fixtures for two dealers. Direct SQL proves SELECT/INSERT/UPDATE and
cross-tenant filtering. The platform `storage.protect_delete()` guard rejects
direct SQL DELETE by design, so the suite proves the guard and the exact DELETE
policy identity; positive DELETE remains real Storage API evidence.

Runtime-only gap: sections 21-40 simulate caller identity via
`request.jwt.claim.sub`/`request.jwt.claims` and a local Postgres role
switch evaluated inside one transaction. This is a SQL/RLS claim simulation
only — it is not evidence of a real Supabase Auth token, a real
PostgREST/Storage request-scope boundary, or any HTTP-layer behavior. A
later runtime gate must additionally prove the same matrix with real local
Auth tokens against a live disposable stack.

### 4.2 `data_api_matrix.test.sql` — `DATA_API_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(20)` |
| SHA-256 | `251f307f7365e8fe39b667a4d1d08bcf3e2064b7e67adf2e327b316d2a82cd80` |

Static checks: embeds the full literal source inventory (80 `.from(...)` +
18 `.rpc(...)` = 98 rows) extracted from `src` after removing the obsolete
discarded `public.version()` call, classifies every literal
exactly once as `CLIENT_EXPOSED`, `SERVER_ONLY`, `FEATURE_GATED_ABSENT`, or
`NO_LONGER_ACTIVE` with zero unclassified rows, proves no missing/extra
literal against the fixed embedded inventory, distinguishes the `documents`
and `pdf` Storage buckets from public relations, proves catalog presence for
non-protected `CLIENT_EXPOSED`/`SERVER_ONLY` objects, bounds the exact six
protected-excluded table/RPC literals without reading protected content,
proves the `FEATURE_GATED_ABSENT`
set is deterministic (without asserting catalog absence, since
application-layer gating does not imply schema absence), and proves
least-privilege grant posture (no stray `anon` grant on non-exposed objects;
every `CLIENT_EXPOSED` object reachable by `anon` or `authenticated` using
its exact source-required `SELECT` or `INSERT` privilege).

Runtime-only gap: every check is `information_schema`/`pg_proc`/`pg_class`/
`has_table_privilege`/`has_function_privilege`/RLS-flag catalog inspection.
None of it issues a real PostgREST HTTP request with a real anon/
authenticated JWT, and anon OpenAPI schema enumeration is explicitly not
treated as exposure proof. A later disposable runtime gate with real local
tokens against a running PostgREST/Auth stack is required to prove each
`CLIENT_EXPOSED` path is actually reachable and each other class is actually
blocked.

### 4.3 `storage_matrix.test.sql` — `STORAGE_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(59)` |
| SHA-256 | `ee25e39f5bf82177b4a8daaa976c9df9dedc275eb92d478a5fe29f60239ab7ce` |

Static checks: exact canonical five-bucket configuration; an independent
shadow-table policy catalog proving no missing/extra/duplicate
`storage.objects` policy row and the INSERT+SELECT+UPDATE upsert
requirement; per-bucket matrices for `documents` (upsert, no-delete),
`work-order-files` and `vehicle-registration-documents` (tenant isolation),
`dealer-branding` (public delivery plus full member CRUD), `gyeon-resources`
(global read, dealer-write denial, admin CRUD); and inactive/no-member/
anonymous fail-closed coverage.

Runtime-only gap: all assertions run inside one pgTAP session using
`set_config`/`set local role` caller simulation, which proves RLS/SQL
authorization logic only. It is not proof of real Auth token issuance or
real PostgREST/Storage API request-scope/HTTP enforcement. A later runtime
gate must prove the same matrix end-to-end with real local Auth tokens and
real Storage API requests for two tenants.

### 4.4 `function_trigger_matrix.test.sql` — `FUNCTION_TRIGGER_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(19)` |
| SHA-256 | `23da5f34cfc93412dea056fcaee7732038ec4c5f63958b1a26702cc6456a166f` |

Static checks: reuses only the already-ratified `catalog_manifest.test.sql`
row sets — `expected_function` (64 rows), `expected_trigger` (59 rows), and
`expected_function_execute_acl` (24 rows) — with no new expected data
fabricated. Proves exact function/trigger/EXECUTE-ACL counts, no missing/
extra/duplicate identity, and pinned `search_path` plus least-privilege
EXECUTE posture for accepted security-definer functions.
`normalized_definition` is excluded from the NO_MISSING/NO_UNEXPECTED
comparison for the same header-only/mixed-qualification reason already
recorded against `catalog_manifest.test.sql` (R12C_FT_BLOCKER.md); all other
fields remain exact.

Runtime-only gap: caller/owner behavior, transaction rollback, and audit
effects are documented contracts this static file cannot itself execute
proof for beyond the bounded deterministic catalog checks shown; live
execution is the disposable runtime gate's responsibility.

### 4.5 `business_domain_matrix.test.sql` — `BUSINESS_DOMAIN_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(30)` |
| SHA-256 | `fa17f0369bead04f8612a46c4c8660c4107ea8d54e937c9de02647bbcfb3a13c` |

Static checks: reuses only the 82 accepted relation identities already
ratified in `catalog_manifest.test.sql` (`expected_relation`), classifies
them into nine business-domain groups, and declares four probe rows per
domain (positive, negative fail-closed, lifecycle/immutability,
cross-tenant/audit) — 36 probe rows total. Only `catalog_existence` probes
with `is_executable_now = TRUE` are bounded, deterministic `pg_catalog`
reads executable now.

Runtime-only gap: every `runtime_behavior` probe (real Auth/session
behavior, external service or OCR provider calls, queue delivery/retry,
separate-connection concurrency, live transactional/lifecycle/immutability
behavior) is explicitly labeled `requires_runtime_gate = TRUE` and
`is_executable_now = FALSE`. This file documents a contract, not a proof;
execution remains the separate disposable runtime gate.

### 4.6 `concurrency_matrix.test.sql` — `CONCURRENCY_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(32)` |
| SHA-256 | `0ff5d845a0cb14c332e70b1a4f315035293ad1fc6c0f2ebd7906dd9fd17b2423` |

Static checks: proves the collision-family inventory is complete against
`ENVIRONMENT_REMEDIATION_PLAN.md` Section 14.2 item 7 and the accepted
catalog (no missing/extra family), that every family is classified exactly
once (no duplicate, unclassified, or collapsed winner/loser contract), and
that every callable/table identity a family cites actually exists in the
accepted catalog (matching `catalog_manifest.test.sql` identities).

Runtime-only gap and required protocol: a single pgTAP file executes as one
backend inside one transaction and cannot originate two separate PostgreSQL
connections or demonstrate genuine separate-process/separate-connection
collision behavior. Every row in this file therefore carries
`runtime_status = 'NOT_EXECUTED'`. The disposable runtime gate must instead
prove each family via an external two-`psql`-client orchestration protocol:
two independent libpq connections (their own backend PIDs) prepare
identical fixture rows for the family's collision key, release the
collision-triggering statement as close to simultaneously as the OS
scheduler allows, and each side records its own result/sqlstate/timestamp;
both backend PIDs are cross-checked against `pg_stat_activity` mid-run to
prove `pid_1 <> pid_2`. No in-database extension (`dblink`, `pg_background`,
or similar) performs the second connection; the harness is a plain OS-level
process orchestrator.

The reproducible candidate orchestrator is
`supabase/tests/runtime/concurrency_matrix.mjs` (SHA-256
`b7602b2254a1c57299cfb0b6eaf4c93796098ee265779e4deb0e233e1ed073ed`).
It is not pgTAP and is not included in `plan(222)`. It requires an explicit
disposable-local confirmation, refuses non-loopback database hosts, creates a
one-use fixture namespace, starts two independent OS `psql` processes per
family, proves both backend PIDs through a third connection, captures both
results/SQLSTATEs/timestamps, and evaluates one post-collision invariant. Any
failure exits non-zero; the harness contains no retry path.

### 4.7 `frozen_operational_matrix.test.sql` — `FROZEN_OPERATIONAL_MATRIX`

| Field | Value |
|---|---|
| Plan | `plan(22)` |
| SHA-256 | `fcb25f4b8e07821477ce8140747f1188e9870b2f2b7e00fd276c1636f8c7670b` |

Static checks: the three excluded/frozen migration versions are absent from
migration history when a migration-history catalog exists; frozen GYEON
provisioning table/functions remain absent; frozen LINE link-token
table/function remain absent; the gated object surface stays absent
regardless of the `GYEON_PARTNER_ONBOARDING_ENABLED` value (SQL cannot read
process env, so this asserts no live database side effect that would only
be reachable if the gate were open). None of the three protected migrations'
content is read, opened, copied, diffed, or used as test-design input; only
their recorded version strings and the disabled/absent status of associated
objects/gates are asserted.

Runtime-only gap: assertions covering Vercel project environment variables
and Supabase dashboard configuration state are explicitly recorded as
`NOT_EXECUTED` rather than claimed PASS — SQL run inside Postgres cannot
observe process env or dashboard state. Closing them requires later
HTTP/dashboard evidence collected outside this suite.

## 5. Combined total

| Suite | Plan |
|---|---:|
| `GRANT_RLS_ROLE_MATRIX` | 40 |
| `DATA_API_MATRIX` | 20 |
| `STORAGE_MATRIX` | 59 |
| `FUNCTION_TRIGGER_MATRIX` | 19 |
| `BUSINESS_DOMAIN_MATRIX` | 30 |
| `CONCURRENCY_MATRIX` | 32 |
| `FROZEN_OPERATIONAL_MATRIX` | 22 |
| **Total** | **222** |

This total (`plan222`) is separate from and does not replace the
independent `CATALOG_MANIFEST` static candidate (`plan76`,
`supabase/tests/catalog_manifest.test.sql`), which remains its own R12C
artifact under `CATALOG_MANIFEST.md`.

## 6. Concurrency two-psql protocol and current evidence status

R12F-R4 executed the eight SQL files once in a fresh disposable runtime after
R12F-R3's environment-only analytics/Colima startup failure. The
single-session `concurrency_matrix.test.sql` file itself passed, but this is
only its static inventory contract; R12F-R4 stopped before Stage 3 because the
grant/RLS file had five test-contract failures. Genuine separate-process/
separate-connection collision behavior therefore remains `NOT_EXECUTED`.

Real proof still requires the external two-`psql`-client orchestration
protocol described in Section 4.6: two different backend PIDs, independently
recorded results, and no in-database helper pretending to be a second client.

R12F-R5 subsequently passed the exact 100-version replay, all eight pgTAP
files (`Files=8`, `Tests=298`, `Result=PASS`), and 56 real local Auth-issued
JWT/PostgREST/Storage API assertions. Before the external concurrency stage,
source/runtime-contract comparison found that the queue family required
`status IN ('sent','sending')` although the exact catalog permits
`scheduled|processing|sent|failed|cancelled`. A correct claim transitions to
`processing`; `sending` cannot be persisted. R12F-R5 therefore stopped
fail-closed with concurrency `NOT_RUN`, burned suffix `r12f-r5.UjmwCs`, and
proved cleanup at zero matching containers and volumes.

R12E-R4 corrects only that impossible queue literal and adds the reproducible
seven-family external harness described above. The queue invariant is now
exactly `status IN ('processing','sent')`; its winner must transition
`scheduled` to `processing`, and its loser must affect zero rows. No runtime
execution is claimed by R12E-R4.

## 7. Evidence still required before Gate B closes

None of the seven suites in this candidate constitutes, by itself or
combined, any of the following, all of which remain required:

- a real Supabase/Auth connection or a real issued anon/authenticated JWT;
- a real PostgREST request-scope proof of exposure or denial;
- a real Storage API request-scope proof of upload/read/update/delete;
- real OCR provider request/response evidence;
- real LINE webhook/link-token integration evidence (the protected LINE
  migration remains frozen and out of scope regardless);
- real cron execution/secret fail-closed evidence;
- real dealer-owner dashboard behavior evidence; and
- a fully passing disposable-runtime package. R12F-R5 replayed the exact 100
  migrations, passed all eight pgTAP files (`Files=8`, `Tests=298`) and passed
  56 real Auth/PostgREST/Storage assertions. The seven-family external
  separate-connection stage remains `NOT_RUN` because the run stopped before
  the R12E-R4 queue-contract correction and reproducible harness existed.

## 8. R12F-R2 failure and R12E-R2 repair record

The fresh disposable suffix/project `r12f-r2.vOvvhI` / `r12fr2vovvhi` is
burned. Its exact 100-migration replay passed. The eight-file pgTAP invocation
then passed six files and failed two:

- `grant_rls_role_matrix.test.sql` referenced `x.rolname` although role name
  is exposed by `x_role`; the parser stopped after assertion 16;
- `data_api_matrix.test.sql` failed assertions 11, 14, 16, and 19 because it
  treated Storage buckets as relations, required protected-excluded objects
  to exist in the safe replay, classified future AI tables and service-role
  paths as live client paths, assumed SELECT for INSERT-only paths, and kept
  the discarded call to nonexistent `public.version()` in the source ledger.

There was no same-run repair or retry. Stage 3 did not run. Cleanup proved no
remaining run containers or volumes. The owner-approved R12E-R2 repair is
static and uncommitted: it corrects the grant alias, models the exact storage/
protected/feature/operation distinctions, removes the obsolete source call,
and updates this contract and the two environment records. It performs no DB
or test execution and makes no runtime-PASS claim.

## 9. R12F-R3/R4 failures and R12E-R3 repair record

R12F-R3 suffix/project `r12f-r3.H0dTWK` / `r12fr3h0dtwk` is burned. All 100
migration applications were logged, but the stack failed to finish starting
because the newly initialized local config enabled analytics and the Vector
container could not mount the Colima Docker socket. No pgTAP file ran. Cleanup
proved zero matching containers and volumes.

R12F-R4 suffix/project `r12f-r4.yjgGlc` / `r12fr4yjgglc` is also burned. Its
disposable config disabled analytics before first start. The stack started,
the exact 100 migration versions matched the expected ordered ledger, and the
exact eight files ran once. Seven files passed; `grant_rls_role_matrix.test.sql`
failed assertions 19, 24, 25, 27, and 37, yielding `Files=8`, `Tests=298`,
`Result: FAIL`. Stage 3 did not run and cleanup again proved zero matching
containers and volumes.

The R12E-R3 repair changes only this contract, the two environment records,
and `grant_rls_role_matrix.test.sql`. Assertion 19 now requires the exact eight
intentional service-role-only RLS-on/no-policy tables. Assertion 24 proves the
platform direct-SQL delete guard and keeps positive DELETE for the Storage API
gate. Assertions 25 and 27 require own visibility plus zero foreign visibility
without assuming a cumulative fixture count of one. Assertion 37 requires anon
visibility to be RLS-filtered to zero rows. `plan(40)` is unchanged. No grant,
RLS, policy, migration, or application source is weakened or modified.

## 10. What this candidate does not authorize

This repair candidate does not authorize: another Supabase/DB/Auth/Storage/
LINE connection; migration replay or apply; test execution; `git add`/stage;
commit; push; Ready-state change; merge; or deployment. It does not itself
close Gate B. The next gate is a
separately authorized fresh disposable-runtime execution/repair gate
(materializing the accepted migration manifest, running all ratified pgTAP
suites including these seven plus `catalog_manifest.test.sql`, and running
the external two-`psql` concurrency protocol) — that gate is not
automatically authorized by this document and requires its own explicit
owner approval.

## 11. R12F-R5 stop and R12E-R4 reproducible concurrency repair

| Field | Value |
|---|---|
| R12F-R5 suffix/project | `r12f-r5.UjmwCs` / `r12fr5ujmwcs` (burned) |
| Replay | Exact 100-version ordered ledger PASS |
| pgTAP | `Files=8`, `Tests=298`, `Result=PASS` |
| Real request scope | Auth-issued JWT + PostgREST + Storage API `56/56 PASS` |
| External seven-family concurrency | `NOT_RUN` |
| Stop reason | queue contract used impossible state `sending`; exact catalog state is `processing` |
| Cleanup | matching containers `0`; matching volumes `0` |
| R12E-R4 status | `STATIC_UNCOMMITTED_FIVE_PATH_REPAIR_CANDIDATE_NOT_RUNTIME_PROOF` |

The exact R12E-R4 allowlist is:

1. `supabase/tests/concurrency_matrix.test.sql` (modify);
2. `supabase/tests/runtime/concurrency_matrix.mjs` (add);
3. `docs/master_specification/GATE_B_REMAINING_SEVEN_DB_SUITES.md` (modify);
4. `docs/master_specification/ENVIRONMENT_REMEDIATION_PLAN.md` (modify); and
5. `docs/master_specification/ENVIRONMENT_LEDGER.md` (modify).

The SQL suite remains `plan(32)` and remains a structural single-session
inventory. The external harness is the only candidate allowed to make the
seven-family runtime claim, and only after a new explicit gate creates a fresh
disposable stack, replays the exact migration ledger, passes the exact eight
pgTAP files, then runs the harness once. R12E-R4 performs no DB connection,
replay, test, stage, commit, push, Ready transition, merge, apply, or deploy.
