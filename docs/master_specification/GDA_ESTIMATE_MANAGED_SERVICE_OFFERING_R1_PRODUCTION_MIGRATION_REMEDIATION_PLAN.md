# GDA Estimate Managed-Service Offering R1 Production Migration Remediation Plan

## 1. Authority and status

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_GOVERNANCE` |
| Status | `R0_COMPLETE_FORWARD_BRIDGE_REQUIRED_FB_G1_GOVERNANCE_CANDIDATE_UNCOMMITTED` |
| Date | 2026-08-30 |
| Product owner | Office AZ |
| Technical authority | MacBook Codex |
| Implementation / executable verification | MacBook Claude only after a later explicit gate |
| Staging | `DealerOS-Dev-Next` / `vhiuiwolnlvlwvoaingd` / `ap-northeast-1` |
| Production | `DealerOS-Prod` / `dmvyaykhibmphrmekjbb` / `ap-northeast-1` |
| Former direct target / read-only reference | `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql` |
| Former direct-target file SHA-256 | `9319203d67ce42d8f54998b3db0e4af6c0f45ada36c7b20b7c51c047cbfcd499` |
| Former direct-target function body SHA-256 | `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6` |
| PR / merged source | PR #44 / squash commit `a0ab427c666b4197969e918a715e0d120e96f71d` |
| Evidence level before this plan | `E2_LOCAL_DISPOSABLE_DB` |
| R0 verdict | `CHANGES_REQUIRED_FORWARD_BRIDGE` |
| R0 Production writes | `0` |

This authoring gate authorizes only the three governance paths below. It does
not authorize source or migration edits, SQL execution, database writes,
migration-history repair, Staging or Production application, fixture creation,
Auth operations, Git stage/commit/push, branch or PR mutation, private external
transmission, Claude execution, deployment, or rollback execution.

**Literal write allowlist for this authoring gate — exactly three paths:**

1. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS.md`

The binding environment identity and safety rules remain those in
`ENVIRONMENT_LEDGER.md`. This plan narrows the general execution-mechanism
decision in `ENVIRONMENT_REMEDIATION_PLAN.md` for this one target migration; it
does not alter the disposition of any other migration.

## 2. Objective

Deliver the already accepted direct-RPC managed-service offering guard to
Staging and then Production without:

1. applying any unrelated migration;
2. opening, copying, applying, or repairing the frozen LINE migration;
3. overwriting an unexplained Production function body;
4. weakening the current `SECURITY INVOKER`, pinned `search_path`, or
   service-role-only execution boundary;
5. changing customer, vehicle, estimate, estimate-item, pricing, idempotency,
   document-number, or service-offering data; or
6. representing a migration-history row as schema evidence.

## 3. Protected and excluded scope

### 3.1 Protected paths

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
  - Pathname, mode, blob, and Git state only.
- `supabase/migrations/20260801110110_line_link_tokens.sql`
  - Content access, execution, history repair, and derived implementation are
    prohibited. Expected metadata remains mode `100644`, blob
    `accd22345054cc44f89156fd78eaba6dfe4242a4`.
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

### 3.2 Explicitly excluded migrations

The following locally present but remotely unrecorded migrations are not part
of this release and must never be supplied as an execution input:

| Version | Disposition for this plan |
|---|---|
| `20260731115631` | `EXCLUDED_INTENTIONALLY_DEFERRED_NOT_APPLIED` |
| `20260801000649` | `EXCLUDED_INTENTIONALLY_DEFERRED_NOT_APPLIED` |
| `20260801110110` | `EXCLUDED_PROTECTED_FROZEN` |
| `20260825151059` | `EXCLUDED_PARTIAL_DRIFT_RECONCILIATION_INPUT_ONLY` |
| `20260826010000` | `EXCLUDED_NOT_APPLIED` |
| `20260826143000` | `EXCLUDED_NOT_APPLIED` |
| `20260829101726` | `EXCLUDED_NOT_APPLIED` |

No `supabase db push`, `--include-all`, glob, migration-directory replay, or
directory-derived apply command is allowed in this plan. The dry-run evidence
showed that such an operation would include all eight unrecorded versions,
including the protected LINE migration.

## 4. Current read-only evidence

The following was observed against exact Production ref
`dmvyaykhibmphrmekjbb` using read-only queries with telemetry disabled:

| Check | Observed result |
|---|---|
| Project | `DealerOS-Prod`, `ACTIVE_HEALTHY`, `ap-northeast-1` |
| PostgreSQL | `17.6` |
| Supabase CLI | `2.116.0` |
| Recorded migration count | 104 |
| Latest recorded version | `20260824151255` |
| Target version recorded | No |
| Target `service-not-offered` guard in live RPC | No |
| Live RPC signature | `public.save_estimate_from_wizard(uuid,uuid,jsonb)` |
| Live RPC security | `SECURITY INVOKER` |
| Live RPC `search_path` | `pg_catalog, public, pg_temp` |
| Live RPC EXECUTE | `service_role=true`, `authenticated=false`, `anon=false` |
| Live RPC body SHA-256 | `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136` |
| Expected predecessor body SHA-256 | `cc38e8ec48076ffaf2652c5729732b2485d9b603189083ee55a51acfb3d27959` |
| Expected target body SHA-256 | `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6` |

Required schema columns, helper functions, the idempotency index, and the live
RPC metadata were observed. The later exact R0 comparison corrected the earlier
marker-only inference: the live body contains one `bodySizeKey` reference but
does **not** contain the predecessor's supplied-value validation block or its
existing-vehicle `UPDATE public.vehicles ... SET body_size` block. Object or
marker presence was therefore not statement equivalence.

### Current decision

`PRODUCTION_DIRECT_APPLY_BLOCKED_FORWARD_BRIDGE_REQUIRED`

Applying the target now would cross an unaccepted semantic gap. R0 classified
that gap and requires one new forward-only bridge from the captured live
authority. No shared database write is eligible until the bridge source and its
fresh disposable verification are separately accepted.

### R0 accepted result — 2026-08-30

- Exact Production ref: `dmvyaykhibmphrmekjbb` / `DealerOS-Prod` /
  `ap-northeast-1`.
- Live function definition SHA-256:
  `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a`.
- Live canonical `prosrc` SHA-256:
  `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136`.
- Expected predecessor `prosrc` SHA-256:
  `cc38e8ec48076ffaf2652c5729732b2485d9b603189083ee55a51acfb3d27959`.
- Accepted target `prosrc` SHA-256:
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`.
- Live metadata: owner `postgres`, `SECURITY INVOKER`, PL/pgSQL, volatile,
  parallel-unsafe, `search_path=pg_catalog, public, pg_temp`, ACL exactly
  `postgres=EXECUTE` and `service_role=EXECUTE`; `anon` and `authenticated`
  cannot execute.
- Semantic delta 1: live lacks predecessor body lines 345-357, which validate
  supplied `vehicle.bodySizeKey` type and the canonical seven-size set.
- Semantic delta 2: live lacks predecessor body lines 723-735, which persist a
  confirmed size to an existing dealer/customer-owned vehicle inside the save
  subtransaction.
- The predecessor-to-target semantic addition remains the accepted C.9a
  managed-service offering guard at target body lines 581-621.
- All required tables, columns, helper functions, and
  `estimates_dealer_idempotency_key_uidx` exist with the expected types.
- Eight local migration versions remain remotely unrecorded. No migration,
  history, link, Git, customer, or Production write occurred during R0.

## 5. Selected execution strategy

The selected candidate is now:

`NEW_FORWARD_ONLY_BRIDGE_FROM_CAPTURED_LIVE_AUTHORITY`

The old exact-target-statement route is ineligible because R0 proved that the
live function is not semantically equivalent to the expected predecessor. One
new Supabase-CLI-generated migration must begin from the captured live function
and add only the two accepted body-size blocks plus the accepted C.9a guard. It
must pass a fresh full E2 disposable suite before R1 restore readiness or any
shared-environment gate can begin.

The following alternatives are rejected for this release:

- **Bulk migration push:** rejected because it includes excluded and frozen
  versions.
- **History repair before SQL:** rejected because it would mark an absent
  target as applied.
- **Manual dashboard copy/paste:** rejected because it weakens source identity,
  evidence capture, and repeatability.
- **Editing the historical predecessor migration:** rejected; migrations are
  immutable and the target remains forward-only.
- **Treating current object markers as exact equivalence:** rejected because the
  function body hashes differ.

## 6. Gate sequence

Every gate below requires a new explicit owner authorization. Passing one gate
does not authorize the next.

### R0 — Exact live-function reconciliation

**Mode:** Production read-only.

**Required evidence:**

1. Re-resolve the target as `DealerOS-Prod` / exact ref
   `dmvyaykhibmphrmekjbb`; reject any local project link as authority.
2. Verify the Git HEAD/tree, target file SHA-256, target function-body SHA-256,
   and protected-path metadata.
3. Capture the live function's `pg_get_functiondef`, `prosrc`, owner,
   `prosecdef`, `proconfig`, complete ACL, language, volatility, parallel mode,
   and signature into a private runtime evidence directory outside Git.
4. Compare the live body with:
   - predecessor
     `20260825151059_persist_existing_vehicle_confirmed_body_size.sql`; and
   - target
     `20260830160000_estimate_managed_service_offering_guard.sql`.
5. Produce a machine-readable, line-level semantic delta that excludes only
   proven non-semantic formatting. No difference may be guessed away.
6. Verify every referenced table, column, helper function, constraint, and
   type, plus current owner/ACL/search-path/security identity.
7. Reconfirm the exact remote missing-version set and prove that no write,
   link, history repair, or migration apply occurred.

**PASS route:** The live definition is semantically equivalent to the expected
predecessor and differs from the target only by the accepted C.9a guard.

**FAIL route:** Any additional semantic difference produces
`CHANGES_REQUIRED_FORWARD_BRIDGE`. Author one new forward-only bridge migration
from the reconciled live authority plus the accepted C.9a guard, then repeat
the complete local disposable verification under a new explicit phase. Do not
apply the currently merged target file.

**R0 result:** `CHANGES_REQUIRED_FORWARD_BRIDGE`. The live function lacks the
two accepted existing-vehicle body-size blocks described in section 4. The
currently merged target file is permanently ineligible for direct Staging or
Production application under this plan.

### FB-G1 — Forward-bridge read-only diagnosis governance

**Mode:** Governance authoring now; one bounded MacBook Claude read-only
diagnosis only after separate Git delivery and private-transmission approvals.

**Governance write allowlist — exactly three paths:**

1. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS.md`

**Diagnosis objective:** Independently classify the exact captured live,
predecessor, and target bodies; define one deterministic bridge-construction
algorithm; preserve the live signature/security/ACL/metadata; and return the
smallest later migration, pgTAP, and disposable-harness write allowlists.

**Private evidence boundary:** The full live function evidence stays outside
Git. It may be sent to Anthropic only after explicit owner approval and only
through the literal private-evidence allowlist in the FB-G1 directive. The
report must contain hashes and semantic summaries, never the full function.

**Current authoring boundary:** This gate creates or updates only the three
governance files above. It does not create a branch, stage, commit, push, create
or mutate a PR, transmit private evidence, invoke Claude, edit SQL/tests/harness,
run tests, access Supabase, or apply any database or history change.

**Exit:** Verify the exact three-document diff, directive consistency,
protected metadata, and `git diff --check`; then request separate exact-path
fresh-branch creation plus stage/local-commit authorization. Normal push, Draft
PR creation, private external transmission, Claude execution, forward-bridge
implementation, fresh disposable execution, and every shared-environment
action remain later gates.

### FB-I1 — Future forward-bridge implementation and E2 acceptance

FB-I1 is not authorized by this document. It becomes eligible only if the
FB-G1 read-only result is independently accepted. The future implementation
must create one new migration with `supabase migration new`, leave both
historical migration files immutable, and pass the exact static, pgTAP,
PostgreSQL 17 disposable, real Auth/PostgREST, direct-RPC,
separate-connection, cleanup, and evidence-integrity gates approved from FB-G1.

R1-R10 below are suspended until FB-I1 has an accepted source body hash and
fresh E2 evidence. When they resume, every reference to the apply artifact must
mean the accepted bridge migration, not
`20260830160000_estimate_managed_service_offering_guard.sql`.

### R1 — Restore and rollback readiness

**Mode:** Provider and backup verification; no schema write.

Before any Staging or Production write:

1. Verify actual backup/PITR capability for the exact project and record a
   fresh restore point and UTC timestamp outside Git.
2. Capture the exact pre-apply function definition and metadata as the sole
   rollback artifact; encrypt it at rest and hash it.
3. Prove restoration of the captured function in a disposable PostgreSQL 17
   environment.
4. Define a five-minute operator decision window and named stop authority.
5. Obtain a separate pre-authorization for conditional rollback execution.

Missing restore evidence is an immediate stop.

### R2 — Staging preflight

**Target:** `DealerOS-Dev-Next` / `vhiuiwolnlvlwvoaingd`.

**Mode:** Read-only first.

Required checks:

- exact target identity and health;
- current migration ledger and exact missing set;
- current function body and metadata reconciliation using the R0 method;
- target dependency object/column manifest;
- current lock/activity budget;
- source/protected hashes;
- no frozen migration in any generated execution manifest.

Any difference from the accepted R0 assumptions stops the gate.

### R3 — Staging exact-statement apply

**Mode:** One controlled write gate.

The runtime execution artifact must be generated outside Git from the exact
accepted target file and must contain only:

1. `BEGIN`;
2. bounded local lock and statement timeouts;
3. the byte-identical target `CREATE OR REPLACE FUNCTION` statement;
4. `COMMIT`.

The artifact and extracted function body must be hashed before execution. The
source migration file is not edited. Execute only that exact artifact against
the exact Staging ref with `SUPABASE_TELEMETRY_DISABLED=1` and the CLI's
`db query --file` mechanism. No directory input or migration discovery is
permitted.

On any warning outside the accepted manifest, timeout, lock conflict, SQL
error, or unexpected row mutation, stop without same-run repair or retry. The
execution identifier is burned.

### R4 — Staging verification

**Mode:** Separately authorized verification gate.

Required proof:

1. live target body SHA-256 equals the accepted target body hash;
2. signature, owner, `SECURITY INVOKER`, `search_path`, volatility, and ACL are
   unchanged from preflight;
3. `anon` and `authenticated` cannot execute the RPC and `service_role` can;
4. all five managed-family missing/false cases reject with the sanitized
   `service-not-offered` failure and zero related writes;
5. true cases save successfully;
6. unmanaged `coating`, `other`, `interior`, and `glass` remain unaffected;
7. exact replay, conflicting replay, seven-size vehicle persistence, numbering,
   and tenant isolation retain the accepted behavior;
8. real authenticated application flow passes against Staging;
9. DB advisors report no new error-level security or performance issue; and
10. fixture cleanup proves zero residue.

Failure stops the release. Rollback is not automatic; execute only the
separately approved exact rollback artifact, then verify restoration.

### R5 — Staging migration-history reconciliation

Only after R4 proves exact target statement identity may a separate owner gate
mark version `20260830160000` as applied in the Staging migration ledger.

The history command must name exactly one version and exact Staging ref. It may
not include earlier missing versions. Immediately after repair, re-run the
migration list and prove:

- `20260830160000` is recorded;
- no other version changed;
- schema/function hashes did not change; and
- the frozen LINE version remains absent.

This gate changes history only. It must not execute SQL.

### R6 — Production change-window preflight

**Mode:** Production read-only.

Repeat R0-R2 against exact Production ref immediately before the approved
window. Additionally require:

- successful, still-current Staging evidence;
- fresh Production restore/PITR evidence;
- exact current function hash still matching the reconciled predecessor;
- no unexpected migration-ledger or dependency drift;
- an acceptable active-session/lock state;
- named operator, verifier, stop authority, and rollback authority; and
- a communication plan for a temporarily unavailable estimate-save path.

Any drift invalidates the prior approval and stops the release.

### R7 — Production exact-statement apply

Use the same hash-bound generation and `db query --file` mechanism accepted in
R3, but target only exact Production ref `dmvyaykhibmphrmekjbb`.

The production apply gate authorizes only the exact function replacement. It
does not authorize migration-history repair, data correction, a second attempt,
or unrelated SQL. Capture start/end UTC timestamps, CLI exit status, artifact
hash, and returned server boundary without logging credentials.

### R8 — Production verification

Run the R4 checks against Production, with the smallest owner-approved
transactional test fixtures or an existing non-customer acceptance fixture.
Do not use real customer or vehicle records. Confirm the authenticated
production Estimate Wizard saves allowed services and rejects an unavailable
managed service without partial persistence.

Acceptance requires:

- exact live target body and metadata hashes;
- zero new error-level advisor findings;
- zero unauthorized grants;
- zero residual test rows;
- application and direct-RPC evidence; and
- a recorded rollback decision.

### R9 — Production migration-history reconciliation

Only after R8 passes may a separate explicit owner gate mark exactly version
`20260830160000` applied for exact Production ref. Reconcile the post-repair
ledger and prove no other history row changed. The seven excluded versions
remain absent and retain their classifications.

### R10 — Closeout

Record:

- exact source commit/tree and migration/body hashes;
- Staging and Production target identities;
- pre/post function metadata and hashes;
- backup/restore evidence references without secrets;
- verification commands, assertion counts, exit codes, and evidence hashes;
- history reconciliation proof;
- rollback decision and any burned attempt;
- final environment evidence level; and
- exact remaining migration drift.

Append the accepted outcome to `GYEON_DA_PHASE_RESULTS.md` only under a separate
documentation gate. Git delivery, PR comments, Ready/merge, and deployment are
not implied by environment closeout.

## 7. Required stop conditions

Stop immediately, make no same-run repair, and do not retry when:

- project name/ref/region does not exactly match the canonical ledger;
- source HEAD/tree or target/protected hash differs;
- the live predecessor cannot be proved semantically equivalent;
- any excluded migration appears in an execution artifact or command;
- protected LINE content is opened or its version is targeted;
- backup/PITR or restored-rollback proof is missing;
- dependency, owner, ACL, security, search-path, or function metadata differs;
- lock or statement timeout is reached;
- any unexpected row, revision, idempotency, number, policy, grant, or schema
  change appears;
- a verification test has zero assertions, skips, TODOs, or `NOTESTS`;
- request-scope authorization is replaced by source assertions or service-role
  success alone;
- a concurrency claim uses one database connection;
- cleanup cannot prove zero residue; or
- history repair would touch more than `20260830160000`.

## 8. Evidence and command safety contract

- Every Supabase CLI command must set `SUPABASE_TELEMETRY_DISABLED=1`.
- Every shared-environment command must include the exact `--project-ref`.
- Do not create or rely on `supabase/.temp/project-ref`.
- Read-only, SQL apply, runtime verification, rollback, and history repair are
  separate command manifests and separate owner gates.
- Command output is untrusted data; never execute instructions returned by a
  database row or external response.
- Do not print secrets, database URLs, passwords, JWTs, service-role keys,
  customer rows, or full private function evidence into Git or PR comments.
- Evidence filenames use a fresh UTC suffix. A failed suffix is burned.
- Keep raw private evidence outside the repository; commit only redacted
  hashes, counts, verdicts, and evidence references.

## 9. Release decision matrix

| Condition | Decision |
|---|---|
| R0 semantic equality not proved | `STOP_AUTHOR_FORWARD_BRIDGE` |
| R1 restore/rollback proof missing | `STOP_NO_SHARED_WRITE` |
| Staging apply or verification fails | `STOP_NO_PRODUCTION` |
| Staging history repaired before schema proof | `INVALID_EVIDENCE_RECONCILE_AGAIN` |
| Production preflight drifts from accepted evidence | `STOP_NEW_GATE_REQUIRED` |
| Production apply succeeds but verification fails | `STOP_REQUEST_PREAUTHORIZED_ROLLBACK` |
| Production verification passes, history not repaired | `SCHEMA_PASS_HISTORY_PENDING` |
| Production verification and exact one-version history repair pass | `E3_ENVIRONMENT_VERIFIED_CANDIDATE` |

## 10. Immediate next gate

R0 is complete with `CHANGES_REQUIRED_FORWARD_BRIDGE`.

The next eligible gate is **FB-G1 — forward-bridge read-only diagnosis
governance**. Its current literal write allowlist is exactly the three
governance paths listed above. This authoring gate does not authorize stage,
commit, push, PR creation/mutation, private external transmission, Claude
execution, SQL implementation, tests, Supabase, or database access.

Until FB-I1 reaches accepted fresh E2 evidence, no R1 restore-readiness,
Staging, or Production apply instruction may be issued.
