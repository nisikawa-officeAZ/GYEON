# GDA Estimate Managed-Service Offering R1 Production Migration Remediation Plan

## 1. Authority and status

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_RESTORE_READINESS_GOVERNANCE` |
| Status | `R1_A1_DIAGNOSIS_GOVERNANCE_CORRECTION_CANDIDATE_UNCOMMITTED` |
| Date | 2026-08-30 |
| Product owner | Office AZ |
| Technical authority | MacBook Codex |
| Implementation / executable verification | R1 diagnosis by MacBook Claude only after separate private-transmission approval |
| Staging | `DealerOS-Dev-Next` / `vhiuiwolnlvlwvoaingd` / `ap-northeast-1` |
| Production | `DealerOS-Prod` / `dmvyaykhibmphrmekjbb` / `ap-northeast-1` |
| Former direct target / read-only reference | `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql` |
| Former direct-target file SHA-256 | `9319203d67ce42d8f54998b3db0e4af6c0f45ada36c7b20b7c51c047cbfcd499` |
| Former direct-target function body SHA-256 | `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6` |
| PR / merged source | PR #44 / squash commit `a0ab427c666b4197969e918a715e0d120e96f71d` |
| Evidence level before this plan | `E2_LOCAL_DISPOSABLE_DB` |
| R0 verdict | `CHANGES_REQUIRED_FORWARD_BRIDGE` |
| R0 Production writes | `0` |

This R1 diagnosis-governance authoring gate authorizes only the three
governance paths below. It does not authorize source, migration, test, or
harness implementation, SQL execution, database writes, migration-history
repair, Staging or Production application, fixture creation, Auth operations,
Git stage/commit/push, branch or PR mutation, private external transmission,
Claude implementation execution, deployment, or rollback execution.

**Literal write allowlist for this governance-authoring gate — exactly three
paths:**

1. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_RESTORE_READINESS_READ_ONLY_DIAGNOSIS.md`

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

### FB-G1 diagnosis and E1 evidence-packaging result — 2026-08-30

- Coordination PR: PR #47, `OPEN` / `Draft`, exact three committed governance
  paths, HEAD `f919ece7d6a9a40dab14767469083333465b88b1`.
- Claude returned
  `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS_RESULT_V1`
  with verdict `BLOCKED_EVIDENCE` and cost `$2.9321622`.
- Claude had no tools and made zero file, Git, database, Supabase, provider,
  Preview, or Production mutation.
- The original `SHA256SUMS.txt` did not list the allowlisted
  `live.functiondef.canonical.sql`; it listed the differently named
  `live.functiondef.sql` with SHA-256
  `97df618c8988b471970c2a5a0c07230230b1a8aedb1bad31e29a46ea003ae862`.
- The canonical function-definition artifact remained
  `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a`.
  The mismatch was evidence packaging, not a newly accepted SQL conclusion.
- Under a separate owner-approved local-only repair, MacBook Codex preserved
  the original mode-700 R0 evidence root and created the mode-700 sibling root
  `/private/tmp/gda-r0-fb-g1.tnMnGJ`.
- The sibling root contains exactly ten mode-600 files: the nine private
  allowlisted evidence artifacts plus `SHA256SUMS.txt`. Its manifest lists the
  nine artifacts, verifies `9/9 PASS`, and has SHA-256
  `ffffc7e7a8578ddc33d411c0701a29dceb41eff31c4c3445510cb9f404e66a28`.
- `cmp` proved all nine copied artifacts byte-identical to the preserved
  originals. No Git, PR, Claude, database, Supabase, migration, history,
  provider, Preview, or Production action occurred during the repair.
- The blocked diagnosis is not implementation acceptance. Claude's preliminary
  target-body observation remains non-authoritative until a fresh bounded
  diagnosis passes the repaired evidence gate and MacBook Codex independently
  accepts it.

### FB-G1 accepted read-only diagnosis — 2026-08-30

- Coordination PR #47 remained `OPEN` / `Draft` with exact HEAD
  `5ba7877e8829f88fa6abac10fc377b86cfdc3c99`, tree
  `4b2b29379b9d1a00ec2b5bf3ed0c28d528b0d97c`, and three committed governance
  paths.
- After Claude Code OAuth recovery, the owner explicitly approved transmission
  of the exact private governance, Git-tracked, and repaired-evidence
  allowlists for one fresh read-only diagnosis.
- Claude returned
  `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS_RESULT_V1`
  with verdict `READY_FOR_FORWARD_BRIDGE_IMPLEMENTATION_GOVERNANCE`.
- Claude used only `Read`, `Grep`, and `Glob`, incurred cost `$1.8495765`, had
  zero permission denials, and made zero file, Git, PR, database, Supabase,
  provider, Preview, Production, or deployment mutation.
- MacBook Codex independently accepted the result after confirming the clean
  branch, exact HEAD/tree, protected blobs, repaired private manifest
  `9/9 PASS`, canonical hashes, unchanged `217 + 39 = 256` test authorities,
  and the accepted R1-B harness's phase-specific hard-coded identity.
- The deterministic bridge contract is live authority plus exactly three
  accepted insertions: canonical-seven `bodySizeKey` validation, atomic
  existing-vehicle `body_size` persistence, and C.9a managed-service offering
  enforcement. The resulting canonical body must equal SHA-256
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`.
- No existing pgTAP file is eligible for modification. The future implementation
  creates one CLI-generated forward-only migration and one seven-file sibling
  harness, then stops before runtime execution.

### R1-A1 restore-readiness diagnosis stop and governance correction — 2026-08-30

- The committed R1-G1 governance execution identity was HEAD
  `3dfaeb1a6d785da19523ea3b1f0871c26fc70880`, tree
  `a8ed1b4e874f9a585bad9df7c1438624c288844f`, with upstream `0 0` and exactly
  the three governance paths authorized by this plan.
- Under explicit owner approval, one nonpersistent MacBook Claude diagnosis
  returned marker
  `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_RESTORE_READINESS_READ_ONLY_DIAGNOSIS_RESULT_V1`
  with verdict `BLOCKED_EVIDENCE`.
- The run cost `$0.2297618`, completed successfully at the process boundary,
  used zero web search/fetch, and made zero Git, PR, provider, Supabase,
  database, runtime, deployment, or rollback mutation.
- MacBook Codex independently accepted the verdict as a valid fail-closed stop,
  not as R1 execution readiness. HEAD, tree, clean status, upstream `0 0`, exact
  three-path delta, protected blobs, and `git diff --check` were independently
  confirmed after the run.
- Four governance defects caused or would repeat the block:
  1. the invocation command matcher denied the otherwise-authorized literal
     upstream-ref check;
  2. the directive required an exact three-path delta but did not permit
     `git diff-tree` or an equivalent path-enumeration command;
  3. the directive's first-read order placed the directive after authorities
     even though it must be bootstrap-read to learn that order; and
  4. the absolute no-file rule did not distinguish Claude writes from the two
     controller-owned transport logs required to prevent result loss.
- R1-A1 corrects only those four defects. It also makes repository identity and
  PR state explicitly timestamped MacBook Codex attestations so Claude never
  inspects a remote URL or contacts GitHub. It does not broaden provider,
  database, source, migration, harness, credential, runtime, or
  shared-environment scope.
- The private controller result is retained outside Git as mode `600`; only its
  redacted SHA-256
  `841e6d05f61ce769185929594445dbf90bc9a94d85ba7374e9cec41b6f167119`
  is recorded here.

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

### FB-G1-E1 — Evidence-package correction and blocked-result recording

**Mode:** Completed local-only evidence packaging and committed/pushed
two-document blocked-result record. Retained as historical evidence.

The original private evidence root is immutable. The corrected sibling root is
the only eligible evidence input for a later diagnosis retry and must first
pass its exact mode, ten-file allowlist, manifest SHA-256, and `9/9` verification
again. A retry requires a separate private-transmission and Claude-execution
approval and must remain tool-disabled, session-nonpersistent, cost-bounded,
and read-only.

Those former stop boundaries were enforced at the E1 gate. Later, separately
authorized actions delivered the E1 record, posted its PR result, transmitted
the corrected allowlists, and ran the accepted FB-G1 retry. E1 itself never
authorized SQL/test/harness implementation, Supabase or database access,
migration/history mutation, Ready, merge, or deployment.

### FB-I1 — Forward-bridge implementation and E2 acceptance

**Current mode:** static implementation and fresh local disposable E2 are
accepted. The bridge source and sibling harness are committed and pushed on
PR #47, which remains `OPEN` / `Draft`. Shared-environment work remains
unauthorized.

The committed implementation directive required MacBook Claude, after a
separate external-transmission and eight-path implementation approval, to:

1. discover the current Supabase CLI contract with `--help`;
2. generate exactly one migration using
   `supabase migration new estimate_managed_service_production_forward_bridge`;
3. construct that migration deterministically from the captured live function
   and the three accepted insertion blocks;
4. require the canonical candidate body SHA-256 exactly
   `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`;
5. leave the two historical migrations and existing `217 + 39` test files
   immutable;
6. create only the seven new
   `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/` sibling-harness
   files; and
7. run static checks only, then stop with an uncommitted eight-path candidate.

Disposable PostgreSQL 17, unchanged `256/256` pgTAP, real Auth/PostgREST,
direct RPC, true separate-connection concurrency, metadata/ACL, cleanup, and
evidence-integrity execution were completed under the separately authorized
FB-I1-E2 gate recorded below.

### FB-I1-E2 accepted local disposable result — 2026-08-30

- Accepted source HEAD/tree: `f15c5862043a0ebb853b3bac3f5c37ccbddf025a` /
  `5a901d9a4f0c69186cf730213bdef778f0ea78f6`.
- Accepted fresh suffix: `20260830T130013Z-e2a001`; the exact runtime directory
  was removed after evidence copy and independent retained-hash verification.
- PostgreSQL `17.6`; all 112 eligible migrations applied. The protected LINE
  migration remained excluded and unopened.
- pgTAP passed `256/256`: canonical atomic-save `217/217` and sibling offering
  guard `39/39`.
- Real local Auth/PostgREST assertions passed `6/6`; genuine separate-connection
  concurrency assertions passed `13/13`, with distinct backend PIDs for every
  controlled interleaving.
- The generated bridge applied successfully in the disposable runtime. Its
  extracted function body SHA-256 remained
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`;
  `SECURITY INVOKER`, the pinned search path, and service-role-only EXECUTE were
  preserved.
- Database lint had zero error-level findings and four warning-only findings.
  Three query-plan captures remained index-backed.
- Cleanup proved zero rows for every named dealer, actor, offering, lifecycle,
  sequence, customer, vehicle, estimate, and estimate-item fixture.
- Evidence integrity passed with 16 final artifacts, 15 manifest-listed hashes,
  zero mismatches, and manifest SHA-256
  `60b4cc6344ebacacbd3da36465ba9098c392f42b0aab27793bb29fa96f85ef23`.
  Retained evidence is outside Git at
  `/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-fb-evidence/gda-estimate-offering-fb.20260830T130013Z-e2a001`.
- Secret scanning was clean. Supabase stop, evidence copy, retained-hash
  verification, and exact runtime removal all returned zero; project-container
  residue was zero.
- Evidence class is `E2_LOCAL_DISPOSABLE_DB`. No hosted Supabase project,
  shared/Staging/Production database, provider, Preview, or production system
  was contacted. No migration was applied outside the fresh disposable runtime.
- Verdict: `ACCEPT_DISPOSABLE_DB_PASS_E2_LOCAL`.

FB-I1 now has an accepted source body hash and fresh E2 evidence, so R1 is
eligible only after a new explicit owner authorization. Every reference below
to the apply artifact means the accepted bridge migration, not
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

### R1-G1 — Restore-readiness read-only diagnosis governance

**Current mode:** exact-three-document governance authoring only. R1-G1 does
not access Supabase projects, backups, databases, provider APIs, or private
runtime evidence.

The immediate R1 target is Staging `DealerOS-Dev-Next` /
`vhiuiwolnlvlwvoaingd`. Production restore/PITR evidence is intentionally
deferred to the fresh Production change-window preflight in R6 because an R1
Production timestamp would be stale before Production application.

The later diagnosis must return:

1. the exact read-only Supabase CLI or Management API commands that prove the
   Staging project identity, backup type, available recovery range, and latest
   recoverable UTC point without invoking restore;
2. the exact read-only SQL and evidence contract for capturing the current
   Staging `save_estimate_from_wizard(uuid,uuid,jsonb)` definition, owner,
   security mode, search path, language, volatility, parallel mode, and ACL;
3. a secure encryption method selected only after detecting available local
   tools, with the decryption secret stored separately from the encrypted
   rollback artifact and never printed or committed;
4. a fresh PostgreSQL 17 disposable restoration proof that changes no shared
   environment and leaves an independently verified evidence manifest;
5. a five-minute decision procedure separating operator, verifier, stop
   authority, and rollback authority; and
6. the exact later execution allowlists, commands, stop conditions, retained
   evidence, cleanup contract, and conditional rollback approval question.

The diagnosis may inspect only its literal Git read allowlist and protected
metadata. It may run Git metadata commands and local `supabase --help`
discovery with telemetry disabled. It may not list provider projects or
backups, query a database, capture live SQL, create or restore a project, start
a disposable runtime, read credentials, modify files, stage, commit, push,
post a PR result, mark Ready, merge, apply a migration, repair history, deploy,
or execute rollback.

**R1-G1 governance exit:** MacBook Codex verifies the exact three-document
candidate, protected metadata, clean index, and `git diff --check`, then asks
for separate exact-path stage/local-commit authorization. Normal push, PR
instruction publication, private transmission, Claude diagnosis, provider
read-only verification, encrypted capture, disposable restore proof, and every
write remain separate gates.

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

R0 remains complete with `CHANGES_REQUIRED_FORWARD_BRIDGE`; the initial
`BLOCKED_EVIDENCE` result remains recorded; the corrected sibling package
passed verification; and the fresh FB-G1 diagnosis is independently accepted
as `READY_FOR_FORWARD_BRIDGE_IMPLEMENTATION_GOVERNANCE`.

FB-I1-E2 is accepted as `E2_LOCAL_DISPOSABLE_DB`. The first R1 diagnosis
stopped validly as `BLOCKED_EVIDENCE`; it is not R1 readiness acceptance. The
current gate is exact-three-document R1-A1 diagnosis-governance correction
authoring only.

Verify the corrected bootstrap/read order, controller-attested PR boundary,
literal Git metadata commands, exact three-path proof command, two-file
transport-log exception, protected metadata, clean index, and
`git diff --check`. Then request separate exact-path stage/local commit
authorization. Normal push, revised PR instruction publication, renewed
private transmission, another Claude diagnosis, provider read-only
verification, encrypted rollback capture, disposable restore proof,
conditional rollback approval, Ready, merge, migration application, history
repair, Staging/Production write, deployment, and rollback execution remain
separate and unauthorized.
