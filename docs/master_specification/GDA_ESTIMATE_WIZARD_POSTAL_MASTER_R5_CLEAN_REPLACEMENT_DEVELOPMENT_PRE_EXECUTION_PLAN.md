# GDA Estimate Wizard Postal Master R5 — Clean Replacement Development Pre-execution Plan

## 1. Status and purpose

| Field | Value |
|---|---|
| Phase | `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION` |
| Marker | `GDA_POSTAL_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN_V1` |
| Status | `CR6_R1_READY_RESULT_REJECTED_CR6_R1A_GOVERNANCE_CANDIDATE` |
| Date | 2026-09-03 |
| Repository | `nisikawa-officeAZ/GYEON` |
| Branch | `agent/gda-estimate-ocr-postal-clean-replacement-r1` |
| Planning HEAD / tree | `297ad4b23731a273c134c1ef0f00aff832aedc57` / `35d572270f84134f8254e1377ccbd198fc67841d` |
| Pull request | [PR #67](https://github.com/nisikawa-officeAZ/GYEON/pull/67), OPEN/Draft at planning preflight |

This document defines the serial gates required to replace the drifted
Development Supabase project with a clean project built from an accepted Git
migration manifest. It is an execution plan only. It does not create a
project, apply SQL, export or import data, change a provider, change Vercel,
rotate a secret, cut over an application, retire the old project, stage,
commit, or push Git changes.

## 2. Binding facts

1. Current Development is `DealerOS-Dev`, ref `fbieiotihlmpfzybowbt`, region
   `ap-northeast-2`, PostgreSQL `17.6`, and must remain read-only.
2. Its remote migration ledger contains only `000` and `001`, while the live
   schema contains later objects and partial later changes. The accepted
   classification is
   `MANUAL_APPLY_PARTIAL_APPLY_AND_UNRECORDED_LEDGER_MIXED_SCHEMA_DRIFT`.
3. Direct application of
   `supabase/migrations/20260901001246_jp_postal_master.sql` is unsafe because
   its required `public.wiz_is_any_active_member()` dependency and the target
   postal objects are absent.
4. Gate B-R3A already selected a clean replacement Development project and
   rejected in-place migration-history relabeling. Side-by-side forward
   reconciliation is fallback only.
5. R5 accepted a loopback-only PostgreSQL 17 disposable run at source commit
   `1ea1b5f2e3970184610721f261607b5e3f64656c`; aggregate retained-evidence
   SHA-256 is
   `92af4ed809cd42476810a00786b0c6d7d86888186f23fc761fde2c9f5c2cff31`.
   The postal migration SHA-256 remains
   `76748b5cae4fc1ba34c4257cb64bc9732da0e316d4c5727bab2ef170141a1f2d`.
6. R5 proved local disposable behavior only. It did not prove a hosted
   replacement, retained-data import, real Japan Post CSV import, cutover, or
   production behavior.

## 3. Blocking manifest contradiction

The old Gate B-R3C/R3D manifest was measured when Git contained 101 migration
files. It selected 98 executable paths and excluded exactly:

1. `supabase/migrations/20260731115631_gyeon_dealer_provisioning.sql`
2. `supabase/migrations/20260801000649_gyeon_provisioning_pin_function_search_path.sql`
3. `supabase/migrations/20260801110110_line_link_tokens.sql`

The current planning HEAD contains 113 top-level formal migration SQL files.
The accepted R5 harness staged 112 and excluded only the protected LINE
migration. Its retained `migration-manifest.txt` contains 112 `staged` rows,
one `excluded_protected` row, and SHA-256
`722b59ffe2b2252e826783b125df2ac1b4d2468d46743c01da0e726fe2543326`.

Two current source-manifest candidates therefore exist:

| Candidate | Executable paths | Exclusions | Current aggregate SHA-256 |
|---|---:|---:|---|
| R5-equivalent | 112 | LINE only | `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb` |
| Old B-R3 policy carried forward | 110 | provisioning pair plus LINE | `6421db3345c185a72fb14cc255a32d47f0e62e5b92c888a352d0a4a1da18249b` |

The aggregate values above are planning measurements produced from sorted
`SHA-256 path` rows at the planning HEAD; they are not authorization to replay
either candidate. A new literal manifest decision is mandatory. Project
creation and hosted replay are blocked until that decision is documented,
independently verified, committed, and normally pushed.

The LINE migration remains metadata-only. Its content must not be opened,
read, diffed, copied, staged, or executed. GYEON partner onboarding remains
disabled unless a separate owner-approved phase explicitly changes that
business decision.

## 4. Region and project identity decision

The Owner ratified `ap-northeast-1` on 2026-09-03 as the replacement
Development region. The current environments are split:

- current Development: `ap-northeast-2`;
- Staging and Production: `ap-northeast-1`.

Decision: use `ap-northeast-1` for the clean replacement so Development,
Staging, and Production use the same Japan region. Supabase projects are bound
to their selected infrastructure region; changing region later requires a new
project and another migration. Any project-creation request with a different
region must stop and return to the Owner as a plan change.

The organization, exact project name, database password handling, and shutdown
date must be fixed in the later project-creation instruction. No identifier or
secret may be guessed. No secret value may be written to Git or command output.

## 5. Data disposition

| Class | Binding disposition |
|---|---|
| Keep only after explicit row-domain approval | Required active Auth identities; their dealer/member/staff/admin relationships; owner-identified irreplaceable transaction examples; Storage objects referenced by retained rows. |
| Regenerate | Schema, functions, RLS, grants, migration history, accepted fixtures, Storage buckets and policies, and non-secret configuration. |
| Do not import by default | Staging/UAT evidence, audit/activity rows, notifications, queues/logs, OCR temporary state, failed jobs, AI usage, and trial/billing test artifacts. |
| Freeze; do not enable or copy | LINE link-token behavior and GYEON partner onboarding. |
| Reconfigure or rotate separately | Supabase URLs and keys, service credentials, Auth/SMTP, Vercel variables, cron/OCR/OpenAI/news-provider settings, Realtime, extensions, webhooks, and replicas. |

The default-discard classification does not authorize deletion from the old
Development project. No real customer or vehicle data is written into Git
evidence. Retained-data decisions use counts, identifiers where indispensable,
and redacted transformation rules.

## 6. Serial execution gates

Each gate below requires its own explicit owner authorization and its own
result record. A PASS in one gate does not authorize the next.

### CR0 — Plan acceptance

- Verify that this plan changes documentation only.
- Preserve the owner-ratified replacement region `ap-northeast-1`.
- Stage, commit, and push this plan only after separate approvals.
- Exit: accepted immutable planning identity; no Supabase or DB write.

### CR1 — Current literal manifest reconciliation

- Freeze a new execution HEAD/tree.
- Enumerate every current top-level formal migration with path, mode, blob, and
  SHA-256 for non-protected paths. Record pathname, mode, blob, and clean state
  only for the protected LINE migration without reading its content.
- Reconcile the R5 one-exclusion replay with the old B-R3 three-exclusion
  policy.
- Decide whether the two provisioning migrations are executed while the
  onboarding feature remains disabled, or excluded from the replacement.
- Recheck the historical `gyeon_products` SELECT-policy and five-bucket
  prerequisite findings against current Git; stale findings must not be
  carried forward without current proof.
- Publish a Claude-targeted read-only directive before the independent
  manifest diagnosis. No runtime or source write occurs in CR1.
- Exit: one literal non-frozen manifest, one exclusion list, one combined hash,
  and zero unresolved dependency or policy contradiction.

### CR2 — Prerequisite source repairs, only if CR1 requires them

- Author separate exact-path repair gates.
- Keep diagnosis, repair, verification, commit, and push separate.
- Do not edit historical migrations. Any database correction is forward-only.
- Exit: all required source repairs accepted and delivered, or a recorded
  `NOT_REQUIRED` decision with evidence.

### CR3 — Fresh disposable full-chain acceptance

- Use one fresh loopback-only PostgreSQL 17/Supabase runtime outside the
  repository and all protected roots.
- Replay the exact CR1 manifest through the intended CLI-native path.
- Run fixed non-zero plans for migration ledger, schema/RLS/grants, Storage
  metadata, functions/triggers, Data API exposure, real request-scope Auth,
  concurrency, business surfaces, and the R5 postal/import-resume contract.
- Prove the postal version appears exactly once in the disposable migration
  ledger.
- Fail/burn the suffix on any replay, assertion, evidence, secret-scan, cleanup,
  or teardown failure. Do not repair a failed runtime into acceptance.
- Exit: retained hash-bound evidence and exact runtime removal.

### CR4 — Hosted project cost and creation preflight

- Ask the owner to select the exact Supabase organization.
- Retrieve the current project cost through the Supabase cost interface and
  present it to the owner.
- Require a fresh explicit cost confirmation.
- Hard limits: Micro compute only; maximum life 31 days; no paid add-ons; stop
  if estimated cost exceeds USD 12 before tax, compute exceeds Micro, or any
  add-on appears.
- Record the exact planned creation time, automatic review date, and mandatory
  pause/retirement date.
- Exit: cost confirmation ID and owner-ratified organization, name, region, and
  shutdown date. Still no project exists.

### CR5 — Empty replacement-project creation

- Create exactly one project using only the CR4 identities.
- Make no database restore from the old Development project. A restore would
  copy the drifted schema and defeat the clean-baseline decision.
- Record new project ref, region, PostgreSQL version, compute tier, status, and
  creation timestamp without printing credentials.
- Apply only separately approved non-secret baseline configuration.
- Exit: empty isolated replacement project. No application migration, retained
  data, Storage object, secret, Vercel variable, or cutover.

### CR6 — Exact hosted migration replay

- Apply only the immutable CR1 manifest, in order, using the separately proved
  mechanism.
- Do not run an unconstrained bulk `db push`.
- Prove migration ledger count/path parity, object definitions, policies,
  grants, triggers, functions, Data API exposure, extension versions, and zero
  unexpected external-capable jobs or hooks.
- Keep partner onboarding disabled and LINE frozen.
- Exit: schema-only hosted acceptance with no retained business data.

### CR7 — Old-Development export inventory and transformation manifest

- Query the old Development project read-only.
- Record table-domain counts, required Auth relationship counts, Storage object
  inventory, and transformation rules without recording secrets or customer
  payloads in Git.
- Obtain row-domain owner decisions for every `KEEP_IF_EXPLICITLY_JUSTIFIED`
  exception.
- Exit: approved export/import manifest. No copy yet.

### CR8 — Retained data, Auth, and Storage import

- Import only the CR7-approved subset under a separate write gate.
- Preserve referential identity and one-tenant boundaries.
- Treat Auth migration and new-project JWT/key behavior as a separate login
  contract; do not silently reuse JWT secrets.
- Recreate Storage buckets/policies first, then copy only approved objects and
  verify object hashes plus metadata parity.
- Exit: exact imported counts, zero unauthorized domain rows, and rollback
  evidence.

### CR9 — Configuration and real postal dataset

- Reconfigure/rotate each secret and provider independently; secrets remain
  outside Git and logs.
- Recreate Auth redirect/provider/SMTP, Realtime, extension, Webhook, cron, and
  Vercel configuration only through literal approved manifests.
- Import the real Japan Post CSV only after the schema and import contract are
  accepted. This is separate from migration apply and requires resumable,
  duplicate-safe, non-ASCII-safe evidence.
- Exit: non-secret configuration parity, secret-presence checks without value
  disclosure, and accepted postal dataset counts.

### CR10 — Old/new acceptance and application cutover

- Compare schema, ledger, RLS/grants, Auth, retained row counts, Storage,
  functions, cron, and application-critical RPCs.
- Run authenticated request-scope Estimate Wizard OCR/postal smoke against the
  replacement without mutating Production.
- Cut over Development Vercel variables only under a separate owner-approved
  gate after a rollback target and operator are named.
- Exit: accepted Development application smoke and documented rollback timer.

### CR11 — Stabilization and old-project retirement decision

- Keep old Development unchanged and read-only during the observation window.
- Monitor errors, Auth/login behavior, OCR, postal lookup, Storage, and critical
  RPCs without enabling production changes.
- Retirement or deletion of the old project requires a later independent
  destructive-action decision after backup and rollback expiry. It is never an
  automatic consequence of cutover.

## 7. Acceptance evidence required at every executable gate

- Exact repository HEAD/tree, branch, clean index/worktree, and upstream
  ahead/behind.
- Literal allowlist, actual changed paths, modes, blobs, per-path SHA-256, and
  combined manifest hash.
- Protected-path metadata only; no protected content access.
- Exact command/test plans, counts, exit codes, raw evidence paths, and secret
  scan.
- Explicit flags for Git, database, Supabase, Auth, Storage, provider, Vercel,
  Staging, Production, merge, and deployment contact.
- Burned attempt identities and reason; no suffix reuse.
- Rollback boundary and next separately authorized gate.

## 8. Protected paths

The following remain protected throughout this plan:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

`ScreensPreview.tsx` and the LINE migration are pathname/mode/blob/Git-state
metadata only. This plan does not reopen the closed monthly-invoice finance
track.

## 9. Responsibility

- Owner: region, organization, cost, retention exceptions, cutover, and
  retirement decisions.
- MacBook Codex: plan governance, exact-scope preflight, independent evidence
  acceptance, and next-gate control.
- MacBook Claude: only separately authorized read-only diagnosis, bounded
  source repair, and executable verification under a committed literal
  directive.
- Supabase: project/platform operations only after cost confirmation and exact
  owner authorization.
- Studio and Android: no implementation role in this replacement phase.

## 10. Current stop condition

CR1 is Owner-ratified, `CR2_NOT_REQUIRED`, CR3 passed, CR4 passed, and CR5
created exactly one empty replacement project. The prior CR6 static preflight
correctly returned `BLOCKED_REPLAY_MECHANISM`. No hosted migration has been
applied.

CR6-R1 was delivered and two separately authorized tool-disabled diagnoses
were completed. The first stopped at `BLOCKED_CLI_EVIDENCE`. The corrected
invocation received the missing CLI evidence and returned
`READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION`, but MacBook
Codex rejected that result as `CHANGES_REQUIRED` because the reported file
count did not match its path list, a required test file was outside that list,
test ownership was incomplete, and one help-derived claim lacked supplied
evidence.

The current allowed action is CR6-R1A documentation correction only. It fixes
the future implementation allowlist at fourteen new files with seven exact
runtime/test pairs and adds the missing `migration list --help` evidence. No
CR6-R2 implementation is authorized.

The empty project remains fixed as `DealerOS-Dev-Clean-R5` /
`nqvnjqcxgngqsqkbpdfi` in `ap-northeast-1`. No database connection, link,
migration, retry, repair, data transfer, real Japan Post CSV import, Vercel
binding, cutover, Ready conversion, merge, or deployment is authorized.

## 11. Official platform references checked for this plan

- [Change Project Region](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z)
- [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Restore Dashboard backup](https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore)
- [Migrating Auth Users Between Supabase Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

These references support the region immutability, clean-project-versus-clone
distinction, manual reconfiguration requirements, Storage object separation,
and Auth/JWT cutover risks. They do not authorize any platform action.

## 12. CR0 delivery and CR1 governance handoff (historical)

CR0 was committed as `4e3aa471ed776ccd360cd6405ccdc850fced5aaa`,
tree `e7cadd5903ab29143e55a03ccb4a71cffe8bdfe1`, and normally pushed to
PR #67. The branch was synchronized `0 0`; PR #67 remained OPEN/Draft and
MERGEABLE; Vercel and Vercel Preview Comments both passed. No platform or
database action occurred.

At that checkpoint, the next governance candidate added
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR1_CURRENT_MIGRATION_MANIFEST_RECONCILIATION.md`
and updates this plan, the completion plan, and the append-only phase ledger.
It defined a one-time, tool-disabled, twelve-file read-only diagnosis. That
candidate did not authorize private-file transmission or Claude execution.

## 13. CR1 Owner ratification and CR3 preflight governance

The Owner formally ratified the CR1 manifest decision on 2026-09-03:

- exactly 113 unique top-level formal migration SQL files exist at the
  ratification source identity;
- exactly 112 migrations form the executable clean-replacement manifest;
- `supabase/migrations/20260801110110_line_link_tokens.sql` is the sole
  exclusion;
- both provisioning migrations remain included as inert schema under
  `INCLUDE_SCHEMA_KEEP_FEATURE_DISABLED`;
- GYEON partner onboarding remains disabled;
- the accepted product-policy and canonical five-bucket forward repair is
  closed;
- the ratified 112-file aggregate SHA-256 is
  `0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb`;
  and
- `CR2_NOT_REQUIRED`.

The manifest contradiction recorded earlier in this plan is therefore closed.
The next governance phase is
`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT`.
Its directive is
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT.md`.
The original directive candidate intended a later one-time, tool-disabled,
read-only static review of thirteen exact private supporting paths plus a
Codex-supplied non-secret metadata attestation. CR3-R1 below corrects its
ambiguous omission of the directive itself from the invocation input count.
The review must decide whether the accepted seven-file R5 harness may be reused
unchanged or requires the smallest literal repair before one separately
authorized fresh disposable CR3 attempt.

This governance candidate is limited to exactly four documentation paths:

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT.md`
2. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CLEAN_REPLACEMENT_DEVELOPMENT_PRE_EXECUTION_PLAN.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

No private-file transmission, Claude invocation, test, runtime, Supabase/DB/
provider action, project creation, migration replay/application, data transfer,
real postal import, configuration, cutover, retirement, Git stage/commit/push,
PR mutation, Ready, merge, or deployment is authorized by this candidate.

## 14. CR3-R1 invocation-boundary correction

The Owner authorized one documentation-only correction after the send-time
preflight found that the original directive said Claude could receive exactly
thirteen files while omitting the directive itself from that count. The
corrected contract is literal:

- one committed CR3-R1 directive is the governing control input;
- thirteen exact private supporting files are the supporting-input allowlist;
- the total repository-file payload is exactly fourteen files; and
- zero additional repository files may be sent or opened.

The corrected directive marker is
`GDA_POSTAL_R5_CR3_R1_FRESH_DISPOSABLE_PREFLIGHT_DIRECTIVE_V1`. The required
Claude result marker remains
`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR3_FRESH_DISPOSABLE_PREFLIGHT_RESULT_V1`.
No manifest, source, harness, test, database, region, or business decision
changed.

The CR3-R1 correction remains limited to the same exact four documentation
paths listed in section 13. It authorizes no stage, commit, push, private-file
transmission, Claude invocation, test, runtime, Supabase/DB/provider action,
project creation, migration replay/application, data transfer, real postal
import, configuration, cutover, retirement, PR mutation, Ready, merge, or
deployment.

## 15. CR3 acceptance through CR5 creation

The accepted fresh CR3 attempt used suffix
`20260903T114441Z-6698d3`, replayed the exact 112-file manifest in both local
lanes, passed postal pgTAP `75/75`, runtime-contract pgTAP `20/20`, real
Auth/PostgREST `9/9`, import interruption/resume `3/3` plus `25/25`, and left
zero suffix-matching runtime resources. It did not contact a hosted project.

CR4 fixed organization `officeAZ`, project name `DealerOS-Dev-Clean-R5`,
region `ap-northeast-1`, default Micro, no paid add-ons, and the accepted USD
10 monthly cost. CR5 then created exactly one empty project with ref
`nqvnjqcxgngqsqkbpdfi`. Provider state was `ACTIVE_HEALTHY`, PostgreSQL was
`17.6.1.166`, and no database connection or migration application occurred.

The conservative lifecycle clock uses provider creation time
`2026-09-03T11:52:15.655049Z`. Automatic review is
`2026-09-27 20:52:15 JST`; the mandatory pause or retirement decision deadline
is `2026-10-04 20:52:15 JST`. Neither pause nor deletion is authorized.

## 16. CR6 blocked result and CR6-R1 governance

The tool-disabled CR6 preflight at HEAD/tree
`73a63e660808a337d61a2488b818ac5d2e7c69d7` /
`20c2c2e0d6301d80773f15f202081e004ac1a618` returned
`BLOCKED_REPLAY_MECHANISM`. MacBook Codex accepted the stop and independently
verified Supabase CLI `v2.116.0` source.

The source proves sequential stop after a migration error, but it also records
that pipeline-incompatible statements may execute outside the migration
transaction and may remain committed without a history row after a mid-file
failure. The CLI exposes no named-file exclusion flag. CR6 therefore remains
blocked until a hosted-specific wrapper proves exact isolated staging,
one-target/one-attempt execution, credential-safe evidence, a 30-minute
watchdog, and fail-closed project quarantine without retry or repair.

The governing CR6-R1 directive is
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1_HOSTED_REPLAY_MECHANISM_CORRECTION.md`.
Its documentation write allowlist is exactly:

1. that new directive;
2. this clean-replacement plan;
3. `GYEON_DA_COMPLETION_PLAN.md`; and
4. `GYEON_DA_PHASE_RESULTS.md`.

This candidate authorizes no private-file transmission, Claude invocation,
harness implementation, tests, Git stage/commit/push, Supabase/DB/provider
access, project binding, migration replay, data transfer, real postal import,
Vercel change, Ready conversion, merge, or deployment.

## 17. CR6-R1 diagnostic adjudication and CR6-R1A correction

CR6-R1 was committed as
`a848e73d6561a1a2da3f02ec9b3fd30d7e7c84a8`, tree
`f898b490b9f9c155e4e16cbd5343f29bf918a327`, and normally pushed to PR #67.
PR #67 remained OPEN/Draft, base `main`, and MERGEABLE; both Vercel checks
passed.

The first authorized CR6-R1 static diagnosis returned
`BLOCKED_CLI_EVIDENCE`. A second authorized invocation received Supabase CLI
`2.116.0` version/help evidence plus the two fixed official source files and
returned `READY_FOR_CR6_R2_HOSTED_HARNESS_IMPLEMENTATION_AUTHORIZATION`.
MacBook Codex did not accept that READY result because:

1. the report declared nine implementation files but listed eleven;
2. it required `finalize-evidence.test.mjs` outside its own allowlist;
3. it did not assign an exact test owner to every orchestration module;
4. it relied on `migration list --help` without receiving that transcript; and
5. its closing evidence attestation conflated the repository-file boundary
   with the separately supplied public-source evidence.

The governing correction is
`CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R1A_RESULT_CONSISTENCY_CORRECTION.md`.
It fixes exactly fourteen future implementation files, seven runtime/test
pairs, eighteen mandatory offline requirements, both CLI argument arrays, and
a nine-repository-file correction-diagnosis input boundary. CR6-R1A remains
documentation-only and cannot authorize hosted execution.
