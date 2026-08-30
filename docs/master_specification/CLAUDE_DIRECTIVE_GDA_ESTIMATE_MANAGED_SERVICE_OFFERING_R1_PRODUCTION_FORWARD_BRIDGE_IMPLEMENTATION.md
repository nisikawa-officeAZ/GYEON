# Claude Directive — GDA Estimate Managed-Service Offering R1 Production Forward-Bridge Implementation

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_IMPLEMENTATION_RESULT_V1`

## Phase and authority

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-PRODUCTION-FB-I1`
- Mode: one bounded uncommitted forward-bridge and sibling-harness candidate,
  followed by static verification only
- Responsible implementation agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This directive does not authorize execution by itself. MacBook Codex may invoke
it only after the owner separately approves external transmission of the exact
private read set and the implementation write boundary. It never authorizes a
database start, SQL or pgTAP execution, Git delivery, PR mutation, Ready,
merge, Staging or Production access, migration-history action, or deployment.

## Invocation identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#47`, which must remain `OPEN/Draft`
- Branch: `plan/estimate-managed-service-production-forward-bridge-r1`
- Accepted diagnosis predecessor: commit
  `5ba7877e8829f88fa6abac10fc377b86cfdc3c99`, tree
  `4b2b29379b9d1a00ec2b5bf3ed0c28d528b0d97c`
- MacBook Codex must supply the exact committed governance execution HEAD and
  tree containing this directive.
- The committed delta from the predecessor to that execution HEAD must contain
  exactly:
  1. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_IMPLEMENTATION.md`
- Worktree and index must be clean before implementation.

If identity, ancestry, exact governance delta, PR state, branch, clean state,
protected metadata, or private evidence fails, return `BLOCKED_BASE_MISMATCH`
or `BLOCKED_EVIDENCE` as applicable and make no change.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest managed-service entries in
   `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS.md`
6. This directive

Then state the active phase, exact read set, private evidence boundary,
dynamic migration-path contract, exact seven-path sibling-harness write
allowlist, protected paths, static-only boundary, and stop boundary.

## Literal Git-tracked implementation/reference read set

Only the mandatory documents above and the following existing paths may be
opened or searched:

1. `supabase/migrations/20260825151059_persist_existing_vehicle_confirmed_body_size.sql`
2. `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql`
3. `supabase/tests/estimate_wizard_atomic_save.test.sql`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/config.toml`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh`
6. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql`
7. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/real-auth.mjs`
8. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/concurrency.mjs`
9. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/capture-evidence.sh`
10. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/cleanup.sh`

Do not open any other source, migration, SQL test, harness, configuration,
dependency, lockfile, or generated path. If one exact additional existing path
is indispensable, return `BLOCKED_SCOPE_REQUIRES_ONE_PATH` with that one path
and stop without edits.

## Private evidence read allowlist

MacBook Codex must supply one existing owner-approved mode-700 evidence root
outside Git and verify its manifest before Claude reads any file. Only these
mode-600 files may be read:

1. `live.functiondef.canonical.sql`
2. `live.minus-one-newline.sql`
3. `predecessor.prosrc.sql`
4. `target.prosrc.sql`
5. `predecessor-live.diff`
6. `predecessor-target.diff`
7. `dependencies.json`
8. `migration-list.txt`
9. `r0-semantic-result.json`
10. `SHA256SUMS.txt`

Required identities:

- manifest SHA-256:
  `ffffc7e7a8578ddc33d411c0701a29dceb41eff31c4c3445510cb9f404e66a28`
- live function definition SHA-256:
  `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a`
- live canonical `prosrc` SHA-256:
  `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136`
- predecessor canonical `prosrc` SHA-256:
  `cc38e8ec48076ffaf2652c5729732b2485d9b603189083ee55a51acfb3d27959`
- accepted target canonical `prosrc` SHA-256:
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`

Do not quote full private function contents in the result, logs, Git, or PR.
Return hashes, redacted line ranges, classifications, and literal paths only.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
  → blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
  → blob `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
  → blob `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
  → blob `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Write boundary

### Dynamic migration-path contract — exactly one generated path

1. Run `supabase migration new --help`; do not guess CLI behavior.
2. Run exactly one local file-generation command:
   `supabase migration new estimate_managed_service_production_forward_bridge`.
3. Capture the one CLI-generated basename and full repository-relative path.
4. Require that it matches exactly
   `supabase/migrations/<14_DIGIT_CLI_TIMESTAMP>_estimate_managed_service_production_forward_bridge.sql`.
5. That generated file becomes the only migration write path for this attempt.
   Do not rename it, create another migration, or write any other path under
   `supabase/migrations/`.

### Literal sibling-harness write allowlist — exactly seven paths

1. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/config.toml`
2. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/setup.sh`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/offering-guard.test.sql`
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/real-auth.mjs`
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/concurrency.mjs`
6. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/capture-evidence.sh`
7. `scripts/e2e/gda-estimate-managed-service-offering-r1-fb/cleanup.sh`

The complete write set is exactly the one generated migration plus these seven
literal harness paths. Do not modify either historical migration, either
existing pgTAP file, the accepted R1-B harness, any application source, UI,
pricing, OCR, size, rank, coupon, DTO, package, lockfile, Supabase root
configuration, or generated evidence.

## Frozen forward-bridge SQL contract

1. Start from `live.functiondef.canonical.sql` as the sole function-definition
   authority. Do not start from either historical migration.
2. Construct the candidate deterministically. Match every insertion anchor
   exactly once; fail closed on zero or multiple matches. Do not freehand copy,
   broadly regenerate, reformat, rename variables, reorder validation, or
   perform unrelated cleanup.
3. Insert verbatim the predecessor's supplied `vehicle.bodySizeKey` type and
   canonical-seven validation block at its original C.6 position, immediately
   before the existing-vehicle mode validation.
4. Insert verbatim the predecessor's guarded existing-vehicle
   `vehicles.body_size` persistence block at its original C.10 position inside
   the same atomic subtransaction and before the new-vehicle branch.
5. Insert verbatim the target's C.9a set-based five-family offering guard after
   exact replay/conflict handling and before the first C.10 write. Preserve the
   two target comment-only edits required for exact accepted body parity.
6. The mapping remains exact: `window -> window_film`, `ppf -> ppf`,
   `maintenance -> maintenance`, `roomclean -> room_cleaning`, and
   `carwash -> car_wash`. Missing or non-true rows deny with exactly
   `VALIDATION_ERROR: service-not-offered`; `coating`, `other`, `interior`, and
   `glass` remain unaffected.
7. Preserve every other live statement and behavior, including signature,
   return type, owner, implicit/default `SECURITY INVOKER`, pinned
   `search_path`, language, volatility, parallel mode, complete ACL,
   service-role-only execution, tenant, actor, revision, pricing,
   idempotency, numbering, customer, vehicle, estimate, item, replay,
   conflict, exception, and rollback contracts.
8. Add no schema/table object, backfill, data correction, grant, revoke,
   migration-history repair, or unrelated SQL.
9. Extract the constructed canonical body with a deterministic bounded static
   method and require SHA-256 exactly
   `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`.
   Also require byte equality with `target.prosrc.sql`. Any mismatch returns
   `BLOCKED_STATIC_VERIFICATION`; do not patch the same attempt.
10. The migration must contain only the exact `CREATE OR REPLACE FUNCTION`
    replacement needed for this bridge. Historical migration files remain
    immutable and ineligible for direct Staging or Production apply.

## Existing test authority — read-only

Do not edit either test file:

- `supabase/tests/estimate_wizard_atomic_save.test.sql` — plan `217`
- `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql`
  — plan `39`

The future disposable gate must rerun them unchanged as `256/256`. This
implementation phase performs only static inspection and copies the 39-case
offering test byte-for-byte into the sibling harness. Do not execute SQL,
pgTAP, Auth, RPC, or concurrency here.

## Sibling harness implementation contract

Create the seven allowlisted sibling files by structurally adapting the
accepted R1-B harness without mutating it.

- `config.toml`: PostgreSQL major 17, distinct local ports/placeholders,
  loopback URLs, no hosted link, no seed, and unnecessary services disabled
  where practical.
- `setup.sh`: new `FB`-scoped confirmation literal, environment names, project
  identifier, ports and result identifiers; invocation-supplied expected
  HEAD/tree; clean/upstream/generated-migration-hash/private-evidence-hash/
  protected-metadata gates; runtime outside the worktree and `/private/tmp`;
  offline-only container mount probe; loopback-only local Supabase startup;
  exact migration attribution; exclude only the protected LINE migration from
  full local replay; no retry or repair of a burned suffix.
- `offering-guard.test.sql`: byte-identical copy of the accepted R1-B 39-case
  test, kept local to the sibling harness.
- `real-auth.mjs`: preserve the accepted real local GoTrue/PostgREST/direct-RPC
  proof while using unique `FB` environment names and never logging tokens,
  passwords, service keys, URLs containing secrets, or customer data.
- `concurrency.mjs`: preserve the two deterministic separate-OS-process
  interleavings and third-observer evidence; use unique `FB` identifiers and
  bounded timeouts; no one-connection simulation.
- `capture-evidence.sh`: run one already-started fresh attempt, capture source
  identity, exact generated migration/body hashes, versions, replay outcome,
  unchanged `217 + 39` TAP, real Auth/PostgREST, direct RPC, concurrency,
  metadata/ACL, row counts, advisors/query plans, secret scan, command ledger,
  cleanup status, and all non-zero failures. Do not finalize success before
  cleanup.
- `cleanup.sh`: tear down fixtures/runtime once, prove named zero residual test
  rows and stopped project, finalize manifest and summaries last, preserve
  failure evidence, and never rerun or repair a burned suffix.

The sibling implementation must not copy GYEON-order domain fixtures or
assertions and must not edit the accepted R1-B source or evidence.

## Allowed commands

Before editing:

- `git status --short --branch`
- `git rev-parse HEAD HEAD^{tree}`
- `git merge-base --is-ancestor <accepted-predecessor> HEAD`
- `git diff --name-only <accepted-predecessor>...HEAD`
- `git ls-tree HEAD -- <protected-path>`
- `shasum`, `cmp`, `diff`, `sed`, `rg`, and `wc` limited to the mandatory
  documents, literal Git read set, private evidence allowlist, and later write
  set
- `supabase --version`
- `supabase migration new --help`
- exactly one
  `supabase migration new estimate_managed_service_production_forward_bridge`

After editing, static verification only:

- `bash -n` separately for the three new shell files
- `node --check` separately for the two new MJS files
- `cmp` proving the sibling offering test equals the accepted R1-B file
- bounded `rg`, `sed`, `diff`, `wc`, and `shasum` checks restricted to the read
  and write sets
- deterministic candidate-body extraction and exact accepted SHA-256 check
- `git diff --check`
- `git status --short --branch`
- `git diff --name-only`
- `git diff --stat`
- `git ls-tree HEAD -- <protected-path>`

Do not run `supabase start`, `supabase db`, SQL, pgTAP, tests, typecheck, build,
package-manager commands, Docker, Colima, PostgreSQL, Auth, PostgREST, RPC,
browser, network, provider, Preview, Staging, Production, migration-history,
or deployment commands.

## Prohibitions and stop boundary

- Do not modify outside the one generated migration and seven literal sibling
  harness paths.
- Do not create a second migration, edit a historical migration, or edit the
  existing `217` or `39` assertion files.
- Do not stage, commit, push, stash, restore, clean, reset, create or mutate a
  PR/comment, mark Ready, merge, apply SQL, repair history, or deploy.
- Do not access a hosted/shared/Production database or any external provider.
- Do not spawn subagents or use web/browser tools.
- Do not expose secrets, private function contents, or protected contents.
- Stop with the uncommitted eight-path candidate and one result report.

## Required result schema

Return:

1. `verdict`: `CANDIDATE_READY_FOR_CODEX_REVIEW`,
   `BLOCKED_BASE_MISMATCH`, `BLOCKED_EVIDENCE`,
   `BLOCKED_SCOPE_REQUIRES_ONE_PATH`, or `BLOCKED_STATIC_VERIFICATION`.
2. Branch, supplied HEAD/tree, predecessor ancestry, exact governance delta,
   PR state, initial clean state, evidence manifest, and protected metadata.
3. Exact CLI-generated migration path and confirmation that exactly one
   migration was created.
4. Exact changed paths and explicit confirmation that every other path is
   unchanged.
5. Deterministic construction anchors, inserted blocks, ordering, exact body
   hash, metadata/ACL preservation, replay/conflict precedence, and zero-write
   failure contract.
6. Seven-file sibling-harness responsibility table and byte-equality result for
   the 39-case offering test.
7. Confirmation that existing `217 + 39 = 256` test authorities were not
   modified or executed.
8. Static command results, `git diff --check`, and exact eight-path status.
9. Explicit confirmation: no database/runtime/test execution, no Git mutation,
   no PR/provider/shared-environment action, and no secret/private/protected
   content exposure.
10. Owner decision required: `NONE` or one exact question.

Stop. Do not execute the disposable harness or deliver the candidate.
