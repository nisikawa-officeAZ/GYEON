# GDA Estimate Managed-Service Offering R1 Production Migration Remediation Plan

## 1. Authority and status

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R2_STAGING_READ_ONLY_PREFLIGHT_GOVERNANCE` |
| Status | `R2_STAGING_READ_ONLY_PREFLIGHT_DIRECTIVE_CANDIDATE_UNCOMMITTED_NOT_SENT` |
| Date | 2026-08-30 |
| Product owner | Office AZ |
| Technical authority | MacBook Codex |
| Implementation / executable verification | R2 read-only preflight by MacBook Claude only after separate Git delivery, private-transmission, provider-read, and database-read approval |
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
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R2_STAGING_READ_ONLY_PREFLIGHT.md`

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

### R1-A2 pre-invocation transport self-hash correction — 2026-08-30

- R1-A1 was committed and pushed at HEAD
  `93dcdcd691cda7079fecf0ab96e24f75a8388fc0`, tree
  `1e82c4bf02a84323d7857409e8e027fdd39a84db`, then published to PR #47 as
  instruction comment
  `https://github.com/nisikawa-officeAZ/GYEON/pull/47#issuecomment-5469075854`
  with status `PUBLISHED_NOT_INVOKED`.
- During the separately approved Claude preflight, MacBook Codex identified an
  impossible self-reference before process launch: the directive required
  Claude's answer to contain the final SHA-256 of the file that would contain
  that same answer. Writing the hash would change the file and its hash.
- Claude was not started, cost remained `$0`, and no private file was
  transmitted. The fresh empty transport directory was proved empty and
  removed exactly. Git, PR, provider, Supabase, database, runtime, Staging,
  Production, deployment, and rollback remained unchanged.
- R1-A2 separates evidence responsibility. Claude reports the expected
  two-file count/modes and literal status
  `POST_RUN_CONTROLLER_VERIFICATION_REQUIRED`; after process exit, MacBook
  Codex independently records exact file count, modes, byte counts, SHA-256,
  exit status, and stderr state.
- This correction grants no new read, shell, provider, database, runtime, or
  repository authority. A result is unacceptable unless the independent
  post-run transport verification passes with exactly two files and no secret
  material.

### R1-A3 Claude CLI Bash session-environment correction — 2026-08-30

- R1-A2 was committed and pushed at HEAD
  `9a1a819059872fffc5271b059aec6540b7d10867`, tree
  `d5d6271ae662c537318a5c02391b951928b40c59`, then published to PR #47 as
  instruction comment
  `https://github.com/nisikawa-officeAZ/GYEON/pull/47#issuecomment-5469125404`
  with status `PUBLISHED_NOT_INVOKED`.
- The owner explicitly approved the directive-authorized twelve-file Anthropic
  transmission and one R1-A2 diagnosis. The first launcher preflight stopped
  before any model invocation because the empty MCP configuration shape was
  invalid. Its result file remained zero bytes; stderr was 97 bytes with
  SHA-256
  `527402a1802b7997c67036cd7e8e596f497547ae44b649ce8a135201ebc6f59b`.
- A corrected launcher then reached Anthropic and exited successfully after
  `19,891 ms`, six turns, and cost `$0.0626758`, but returned no required result
  marker and no allowed verdict. MacBook Codex therefore rejected it as
  `BLOCKED_ENVIRONMENT_NOT_R1_READINESS`.
- Claude reported that every Bash attempt failed before the repository gate
  with
  `EPERM: operation not permitted, mkdir '/Users/atsushinishikawa/.claude/session-env/a0de36ce-e60d-4d33-9b0e-cd975353f1f6'`.
  Claude also reported no source-file read, no file edit, and no external
  service contact beyond the Anthropic model call. Web search/fetch remained
  zero.
- The rejected result JSON was 2,908 bytes with SHA-256
  `97ffe429ef5647c44f21d2f9146b7af48b9e73b5ec8e8da73f42558cbd809cfd`;
  stderr was empty with SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  MacBook Codex independently confirmed clean Git state, upstream `0 0`, the
  exact execution HEAD/tree, unchanged protected blobs, and `git diff --check`.
- R1-A3 authorizes no broad `.claude` write. For one invocation, MacBook Codex
  supplies a fresh fixed `--session-id`, proves its exact
  `/Users/atsushinishikawa/.claude/session-env/<uuid>` path absent, creates only
  that mode-700 path, grants write access only there, and never reads or
  transmits its contents. After Claude exits, Codex inspects metadata only,
  deletes that exact UUID path, and proves zero residue. A failed UUID is never
  reused.
- The separate result/stderr transport contract remains exactly two mode-600
  files in one fresh mode-700 root. Session-environment runtime infrastructure
  is never retained evidence and never expands repository, credential,
  provider, database, migration, harness, or deployment authority.

### R1-A4 bounded one-turn input correction — 2026-08-30

- R1-A3 governance was committed and normally pushed at HEAD
  `8aa869fb8cb69b2182110422018e6d1d6e18beeb`, tree
  `c1b8b36b7f7385731dbbf5c39e065a333ff9dc6c`, and published without automatic
  invocation at
  `https://github.com/nisikawa-officeAZ/GYEON/pull/47#issuecomment-5469200225`.
- The separately approved R1-A3 Claude run used fresh UUID
  `1F671B17-87D1-4330-A6CF-5983F04626C5`. Exact-path session-environment
  initialization succeeded, Claude ran for `201716 ms` and `33` turns, then
  stopped at `error_max_budget_usd` after `$2.1149743`. It returned neither the
  required marker nor an allowed verdict and is classified
  `BLOCKED_BUDGET_NOT_R1_READINESS`.
- The rejected JSON transport was 1,577 bytes with SHA-256
  `f6f96154e2c5de8bc65febd44e4d65e4580bc7edb3656cdf25913af7d53948af`;
  stderr was empty with SHA-256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
  Permission denials and web search/fetch calls were zero. No formal diagnosis
  was accepted.
- MacBook Codex inspected the exact UUID path as empty metadata-only runtime
  infrastructure, removed only that path, and proved it absent. Git remained
  clean, upstream remained `0 0`, execution HEAD/tree remained unchanged, and
  all four protected blobs remained exact.
- Raising the model budget alone is rejected. R1-A4 preserves the exact twelve
  private-path contract but replaces repeated tool-driven reads with one
  controller-built mode-600 bounded excerpt bundle from committed HEAD. The
  bundle is supplied on standard input to a one-turn `--tools ""` invocation,
  then deleted exactly with absence proof.
- The finalized input bundle does not contain its own hash. MacBook Codex
  computes its final byte count and SHA-256 after closing it and supplies those
  values in a short external launcher prompt envelope, preventing another
  self-reference defect.
- The input bundle and the two-file output transport use separate fresh
  mode-700 roots. Any range/hash/count mismatch, tool use, session-environment
  creation, budget stop, missing marker/verdict, retained input bundle, or extra
  output file rejects the run. Budget stays capped at `$2.00` and effort is
  reduced to `medium`.

### R1-A5 Codex correction of the R1-A4 READY verdict — 2026-08-30

- R1-A4 ran against committed HEAD
  `735278778107a7b28e1d6d25313da387388093dd`, tree
  `56fe9c00b38aa3f28379d921fef616adff8cb122`, from the non-triggering
  instruction at
  `https://github.com/nisikawa-officeAZ/GYEON/pull/47#issuecomment-5469291428`.
- The controller-built input contained exactly 12 path blocks, 273,162 bytes,
  SHA-256
  `3d347c3371f77816f1f121070418e7537395012c0c4165d9a4a70a1f1517c8e2`.
  After the run, its exact root was removed and proved absent.
- Claude completed one no-tool turn in 51,277 ms for `$0.8820647`; the
  9,787-byte result SHA-256 was
  `970805499f833e8315bc34bcb747d620e5253cd09c135b5f6110bf7e94da352a`;
  stderr was empty. The session-environment child count (`291`) and pathname
  set SHA-256
  `b6fff36d94516937ebddbcec412047daaf1cb3c146978e133bc054bf317ef308`
  were unchanged before and after the run.
- Transport, cleanup, marker, one-turn, cost, no-tool, protected-metadata, and
  zero-mutation mechanics pass. Claude reported
  `READY_FOR_R1_EXECUTION_GOVERNANCE`, but MacBook Codex rejects that verdict
  and records `CHANGES_REQUIRED_R1_PLAN` for four content defects:
  1. the five-minute authority response named roles but did not provide a
     minute-by-minute decision procedure;
  2. the exact Management API backup endpoint and accepted response fields
     were omitted;
  3. timeouts and future command allowlists remained approximate; and
  4. `gpg-agent` was incorrectly reported unavailable.
- R1-A5 fixes those defects without performing R1: the directive now contains
  an exact 300-second role sequence; exact Staging project and backup provider
  reads; exact function-capture command class supported by Supabase CLI
  `2.116.0`; exact statement, lock, command, encryption, local-runtime, cleanup,
  and decision deadlines; and exact retry/stop rules.
- Official provider reads are limited to exact project ref
  `vhiuiwolnlvlwvoaingd`, CLI `projects list` and `backups list`, or Management
  API `GET /v1/projects/{ref}` and
  `GET /v1/projects/{ref}/database/backups`. The undocumented health-service
  enum is not guessed; project `status` is the bounded status proof until a
  separately authorized exact health-query contract exists.
- Local discovery confirms `/opt/homebrew/bin/gpg`,
  `/opt/homebrew/bin/gpg-agent`, `/opt/homebrew/bin/openssl`,
  `/usr/bin/security`, and `/bin/rm`; `age` and `shred` are absent. The selected
  artifact cipher is OpenSSL `3.6.3` AES-256-CBC with PBKDF2, fresh salt, and
  at least 310,000 iterations. `/bin/rm` is recorded only as unlink cleanup;
  no APFS/SSD secure-overwrite claim is made.
- R1-A5 is documentation-only. The retained two-file Claude output root remains
  private evidence. It is not deleted, transmitted, or treated as authority to
  run provider reads, database capture, restore, rollback, or shared writes.

### R1-C1 provider/backup pass and capture-command stop — 2026-08-30

- Exact Staging identity passed read-only verification:
  `DealerOS-Dev-Next` / `vhiuiwolnlvlwvoaingd` / `ap-northeast-1` /
  `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.147`, engine `17`, release channel `ga`.
- Backup listing passed: `walg_enabled=true`, `pitr_enabled=false`, seven
  physical backups, all `COMPLETED`. Latest listed backup ID `1517480443` was
  inserted at `2026-08-29T17:06:22.382Z`. `physical_backup_data` was empty.
  This proves listing and recency only; it does not prove a successful restore
  or point-in-time recovery.
- The owner then authorized R1-C1 read-only function capture plus encrypted
  Git-external storage. The first attempt used the R1-A5 literal command class
  without `--linked`. CLI `2.116.0` returned
  `LegacyDbQueryMutuallyExclusiveFlagsError`: `--project-ref` applies only with
  `--linked`.
- The parser stopped before a database query or function-body capture. No
  ciphertext was created, and no Staging write occurred. The 198-byte error
  JSON SHA-256 is
  `d40dd920a87a9775bcbec99574229e776509ae6555d0a53dcea697303ed0cfa2`;
  stderr was empty. Burned suffix `DJ4eiW` is not reusable.
- The unused encryption secret and its exact root were deleted and proved
  absent. The mode-700 failure root
  `/private/tmp/gda-r1-c1-evidence.DJ4eiW` remains private evidence containing
  only the mode-600 read-only SQL, error JSON, and empty stderr. It grants no
  retry or shared-environment authority.
- R1-C1-A1 corrects the command to
  `SUPABASE_TELEMETRY_DISABLED=1 supabase db query --linked --project-ref vhiuiwolnlvlwvoaingd --file <exact-mode-600-read-only-sql-file> --output-format json`.
  The CLI-required `--linked` flag does not authorize `supabase link`.
  `supabase/.temp/project-ref` must be absent before and after the future
  command, and its presence is a terminal stop.
- A retry requires a fresh suffix, fresh evidence and secret roots, exact
  pre/post absence checks, one 30-second attempt, and separate owner approval.
  R1-C1-A1 changes only the exact three governance documents and performs no
  retry.

### R1-C1 encrypted capture and R1-C2 disposable restore pass — 2026-08-30

- The owner-authorized fresh R1-C1 retry used suffix `I7kjNs`, the corrected
  `--linked` plus exact-ref command, and one read-only query. It returned the
  exact Staging function once with exit `0`; `supabase/.temp/project-ref`
  remained absent.
- The captured old body/definition SHA-256 values are
  `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136` /
  `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a`.
  Ciphertext SHA-256 is
  `7222922b30d80139967750c2a9fbb91e8aff22ae1dc2bb6e253bc75be642cb4c`;
  decrypt-and-compare passed and the plaintext was unlinked and proved absent.
- The capture evidence root remains mode `700` outside Git at
  `/private/tmp/gda-r1-c1-evidence.I7kjNs`; its `SHA256SUMS.txt` SHA-256 is
  `52602a3d00fbc73cb0627e99542f25f19703a42b1716df617eeb9f2a47ec63d3`.
  The mode-700 secret root remains separate and no secret is recorded here.
- The owner then authorized fresh suffix `20260830T150757Z-a23e1a` for R1-C2.
  PostgreSQL `17.6` replayed all `112` eligible migrations, excluded the one
  protected LINE migration, restored and exactly verified the encrypted old
  function, and then restored accepted bridge body SHA-256
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`.
- The unrelated catalog fingerprint remained
  `1a28975fc6638456fceec60be6baade181fa8e1bc07b02fdb09788e20f32c985`
  across both replacements. Fixture residue, matching containers, and matching
  volumes were all zero.
- The exact runtime was removed. Retained evidence lives outside Git at
  `/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-r1-restore-evidence/gda-estimate-offering-r1-restore.20260830T150757Z-a23e1a`.
  Its `manifest.json` / `SHA256SUMS.txt` SHA-256 values are
  `f277d06059a7f4751d4f270f2886ec7e469ef0c90b9765f46a99cb1b6388bb8c` /
  `a5228d0b0a9c9a8e8ee0b616cd1eff60c98d7f10c25cdd248d26f7b5ebdd3a13`.
- Technical verdict candidate:
  `ACCEPT_R1_C1_ENCRYPTED_CAPTURE_AND_R1_C2_LOCAL_DISPOSABLE_RESTORE_PASS_CUSTODY_PENDING`.
  R1 is not durable rollback readiness because the only ciphertext and its
  separate secret currently remain under `/private/tmp`, which may be cleared
  by reboot or OS cleanup. A separate R1-C2A durable-custody gate must copy and
  hash-verify the ciphertext into persistent Git-external storage, protect the
  secret in a different durable location, prove decrypt-and-compare without
  plaintext retention, and decide transient cleanup before conditional
  rollback approval, R2, or any shared write.

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
mark version `20260830121816` as applied in the Staging migration ledger.

Version `20260830160000` is the superseded former direct target. It remains
`EXCLUDED_SUPERSEDED_DIRECT_APPLY_PROHIBITED_NOT_RECORDED` and must not be
executed or marked applied by this release.

The history command must name exactly one version and exact Staging ref. It may
not include earlier missing versions. Immediately after repair, re-run the
migration list and prove:

- `20260830121816` is recorded;
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
`20260830121816` applied for exact Production ref. Reconcile the post-repair
ledger and prove no other history row changed. Version `20260830160000`
remains superseded, directly ineligible, and unrecorded. The seven other
excluded versions remain absent and retain their classifications.

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
- history repair would touch any version other than `20260830121816`.

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

R1-C1 encrypted capture, R1-C2 PostgreSQL 17 disposable restoration, and
R1-C2A local persistent custody now pass as a documentation candidate. The
burned `DJ4eiW` failure remains immutable evidence and is not erased by the
later successful suffixes.

R1-C2A copied the accepted ciphertext into the mode-700 Git-external root
`/Users/atsushinishikawa/Documents/Codex/runtime/gda-estimate-offering-r1-rollback-custody/ciphertext.20260830T152354Z-I7kjNs`
and placed the secret in the different mode-700 protected root
`/Users/atsushinishikawa/Documents/Codex/secure/gda-estimate-offering-r1-rollback-secrets/secret.20260830T152354Z-I7kjNs`.
The ciphertext retained SHA-256
`7222922b30d80139967750c2a9fbb91e8aff22ae1dc2bb6e253bc75be642cb4c`.
Stream-only decrypt-and-compare produced the accepted plaintext SHA-256
`33096a6f5fc295071b8bb06d6ebcf293febd187f25aa04bb8adc9ba19e15edda`
without creating or retaining a plaintext file. The secret-free custody
manifest SHA-256 is
`388c48ad91e6093f1a7dfcbe880d7733a6dbd1a407bf811f0d3c6c1cbc762d39`.

The original `/private/tmp` ciphertext and secret remain present; cleanup is a
separate decision. Actual reboot-survival, off-device backup, and Keychain or
hardware-backed secret custody are not proven. This does not invalidate the
local persistent-custody result, but it prevents any claim of device-loss
disaster recovery.

Verify the exact three-document delta, custody paths, modes and hashes,
stream-only decrypt result, transient-source retention, protected metadata,
clean index, and `git diff --check`. Then request separate exact-path
stage/local-commit authorization. Normal push and PR result publication remain
separate.

The R1-C3 conditional rollback pre-authorization instrument is now authored as
a documentation candidate at
`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_CONDITIONAL_ROLLBACK_PREAUTHORIZATION.md`.
It binds only the accepted bridge implementation commit/tree, exact Staging
ref, function signature, migration hash, old/target body hashes, rollback
ciphertext hash, decrypted capture hash, and custody-manifest hash recorded in
that instrument.

The instrument remains intentionally `DRAFT_NOT_ACTIVE`, but its four
accountable assignments are now complete: Operator `MacBook Claude Code`,
Verifier `MacBook Codex`, Stop Authority `西川 篤志 / Owner`, and Rollback
Authority `倉庫担当者 小尾野`. Stop Authority and Rollback Authority remain
different human identities; Operator and Verifier remain separate technical
agents. Silence, timeout, ambiguity, stale evidence, target/hash drift, or an
unavailable role means `DENY_AND_REMAIN_STOPPED`.

Verify the exact three-path candidate, all bound identities and hashes,
inactive status, trigger exclusions, five-minute sequence, protected metadata,
clean index, and `git diff --check`. Then request separate exact-path
stage/local-commit authorization. Normal push, PR publication, activation,
rollback execution, R2 Staging preflight, schema/history write, Ready, merge,
deployment, and every Production action remain separate.

The owner has now explicitly activated exact R1-C3 instrument SHA-256
`9e23067a7b6c9a3b8b7b8c0eab489ffb9db710b23fca402c53ee944829459237`
at commit `3418a377c6bdacf3d00ee38867248de9ec40219b` for exact Staging ref
`vhiuiwolnlvlwvoaingd` only. The immutable instrument itself is not edited;
the decision is bound in the separate
`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_ACTIVATION_RECORD.md`.

Operational use remains blocked until the exact activation-record,
remediation-plan, and result-ledger paths are committed together, normally
pushed to PR `#47`, and independently verified at the remote HEAD. Verify the
exact instrument commit/tree/blob/SHA-256, target ref, four assignments,
decision limits, protected metadata, clean index, and `git diff --check`, then
request separate exact-path stage/local-commit authorization.

Activation permits only the 300-second decision procedure. It does not
authorize provider/database access, rollback execution, R2 Staging preflight,
schema/history write, Ready, merge, deployment, or any Production action.

The activation-record commit was normally pushed to PR `#47` as remote HEAD
`02fca03c18441d7ae1a91a98d92e08410e27bc50` and independently verified with
PR state OPEN/Draft, base `main`, local/upstream divergence `0/0`, and a clean
worktree/index. The exact instrument SHA-256
`9e23067a7b6c9a3b8b7b8c0eab489ffb9db710b23fca402c53ee944829459237`
and activation-record SHA-256
`69b5dd9f2c5ab287de32446b9fe7e52e7c893a6d424af63a74ea61be323973dd`
remain bound to exact Staging ref `vhiuiwolnlvlwvoaingd` only.

The owner has accepted operational use of that exact instrument under the
existing five-minute decision contract. The separate acceptance is recorded
in
`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R1_C3_OPERATIONAL_USE_ACCEPTANCE.md`.
It is not operationally effective until that new record, this plan update, and
the append-only result entry are committed together, normally pushed, and
verified at the PR remote HEAD.

This operational-use acceptance still does not authorize R2 Staging preflight,
provider/database access, Staging apply, decryption, rollback execution,
history repair, transient deletion, Ready, merge, deployment, or any Production
action. The next technical gate remains a separately authorized R2 Staging
read-only preflight after the acceptance-record Git delivery is complete.

## 11. R2 Staging read-only preflight governance

The R1-C3 operational-use acceptance record was committed and normally pushed
to PR `#47` at remote HEAD
`301dc99366f7a7634e80f7f260a099863ee86ef7`. PR `#47` remained OPEN/Draft
against `main`, local/upstream divergence was `0/0`, and the worktree/index
were clean. R1 is therefore accepted for its exact Staging-only 300-second
decision procedure; no rollback trigger or execution authority exists now.

Before authoring R2, MacBook Codex found and reported a migration-history
identity contradiction: R3 executes the exact Forward Bridge file/version
`20260830121816`, while the former R5/R9 text named superseded version
`20260830160000`. The owner explicitly approved correction. R5/R9 now record
only the exact executed Forward Bridge version `20260830121816`.
`20260830160000` remains
`EXCLUDED_SUPERSEDED_DIRECT_APPLY_PROHIBITED_NOT_RECORDED`.

The R2 directive is
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_R2_STAGING_READ_ONLY_PREFLIGHT.md`.
Its later execution is limited to exact Staging identity/backup reads, one
hash-and-metadata-only read-only SQL query, migration-ledger reconciliation,
dependency and aggregate lock/activity checks, and Git-external secret-free
evidence capture. It returns no function body or customer data.

This authoring gate changes exactly the remediation plan, append-only result
ledger, and new R2 directive. It does not transmit private repository content,
invoke Claude, create evidence, access Supabase/provider/database, link a
project, run SQL, generate an R3 execution artifact, change migration history,
stage, commit, push, mutate PR `#47`, mark Ready, merge, deploy, or perform any
Staging/Production write.

Verify the exact three-document candidate, corrected R5/R9 version identity,
directive allowlists, accepted hashes, protected metadata, clean index, and
`git diff --check`. Then request separate exact-path stage/local-commit
authorization. Normal push, PR instruction publication, private transmission,
Claude execution, provider/database read-only access, R3, rollback execution,
history repair, Ready, merge, deployment, and every Production action remain
separate gates.
