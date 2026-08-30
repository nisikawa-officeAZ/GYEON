# Claude Directive — GDA Estimate Managed-Service Offering R1 Production Forward-Bridge Read-only Diagnosis

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-PRODUCTION-FB-G1`
- Mode: one bounded read-only forward-bridge diagnosis only
- Responsible diagnosis agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This invocation must determine the smallest new forward-only migration and
verification phase that safely advances the observed Production function to the
accepted managed-service offering contract without rewriting any historical
migration or applying any SQL. It is a diagnosis, not an implementation gate.

## Why this phase exists

MacBook Codex completed Production R0 with zero writes and returned:

`CHANGES_REQUIRED_FORWARD_BRIDGE`

The live `public.save_estimate_from_wizard(uuid,uuid,jsonb)` function is not
semantically equivalent to the expected predecessor migration. Relative to
`20260825151059_persist_existing_vehicle_confirmed_body_size.sql`, the live body
lacks both:

1. supplied `vehicle.bodySizeKey` type and canonical-seven validation; and
2. the atomic existing-vehicle `vehicles.body_size` persistence block.

The already merged target migration contains those predecessor changes plus the
accepted C.9a managed-service offering guard. It therefore must not be applied
directly to Production under the old assumption that C.9a is its only semantic
delta.

## Invocation identity

MacBook Codex must supply the exact committed governance execution HEAD/tree
and one OPEN/Draft coordination PR containing this directive.

- Repository: `nisikawa-officeAZ/GYEON`
- Required branch at invocation:
  `plan/estimate-managed-service-production-forward-bridge-r1`
- Governance base commit: `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Governance base tree: `fda91137ce537f5a6f60f82d229b6aa1ac6c13e6`
- PR #46 is historical and MERGED; it is not the coordination PR for this
  diagnosis.
- The base commit must be an ancestor of the supplied execution HEAD.
- The committed delta from the base to the supplied execution HEAD must contain
  exactly these three governance paths:
  1. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_FORWARD_BRIDGE_READ_ONLY_DIAGNOSIS.md`
- Worktree and index must be clean before diagnosis.

If branch, base, ancestry, exact delta, PR state, or clean state differs, return
`BLOCKED_BASE_MISMATCH` and stop.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest accepted and pending entries in
   `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_PRODUCTION_MIGRATION_REMEDIATION_PLAN.md`
5. This directive

Then state the active phase, governance base, literal read allowlists, private
evidence boundary, protected paths, prohibitions, and stop boundary.

## Git-tracked read allowlist

Only the following implementation/test paths may be opened or searched:

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

Do not open any other source, migration, SQL test, harness, generated file, or
configuration. If one exact additional path is indispensable, return
`BLOCKED_READ_SCOPE` with that one minimum path and stop.

## Private R0 evidence allowlist

The R0 evidence is private, outside Git, and may be transmitted to Anthropic
only after a separate explicit owner approval. At invocation, MacBook Codex
must supply one existing mode-700 evidence root and verify the manifest before
Claude reads any file.

Only these files may be read from that root:

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

Canonical identities:

- live function definition SHA-256:
  `b745a920543a1bba59333cbe80f139a8f8c03a3fad2bac78e6614b74d580603a`
- live `prosrc` SHA-256:
  `818e91850d669158a18908108e134117389948e56a42e0032dbfda7c6d882136`
- expected predecessor `prosrc` SHA-256:
  `cc38e8ec48076ffaf2652c5729732b2485d9b603189083ee55a51acfb3d27959`
- accepted target `prosrc` SHA-256:
  `df49de1e6b8cf9767f32730cabdce5134b865678c63ab2d2a5c011400a2db7a6`

The files contain private repository/database function evidence. Do not quote
their full contents in the report, a PR comment, logs, or Git. Return only
redacted hashes, line ranges, semantic classifications, and the proposed later
literal path contract.

If the evidence root is absent, its manifest fails, a canonical hash differs,
or any file outside this list would be needed, return `BLOCKED_EVIDENCE` and
stop. Do not query Production or reconstruct missing evidence.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs:

- `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `32fda49583ae1217bc13711784ad8fa31744726c`
- `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Frozen bridge contract

1. Historical migrations are immutable. Never edit or reissue the predecessor
   or the merged target migration.
2. The bridge must be one newly generated forward-only migration created later
   with `supabase migration new`; this diagnosis must not invent its timestamp.
3. The bridge source authority is the captured live Production function, not a
   guessed migration-history predecessor.
4. Preserve exactly the live signature, return type, owner, `SECURITY INVOKER`,
   `search_path`, language, volatility, parallel mode, complete ACL, and
   service-role-only execution boundary.
5. Preserve every live statement and behavior except the explicitly accepted
   additions below. No cleanup, formatting rewrite, variable rename, reordered
   validation, or unrelated refactor is allowed.
6. Add the canonical-seven `bodySizeKey` validation and the atomic
   existing-vehicle `body_size` persistence semantics proved by the predecessor.
7. Add only the accepted C.9a five-family offering guard from the target:
   `window -> window_film`, `ppf -> ppf`,
   `maintenance -> maintenance`, `roomclean -> room_cleaning`, and
   `carwash -> car_wash`.
8. Preserve C.9 exact replay and conflicting-replay precedence. Only a genuinely
   new save reaches C.9a; C.9a remains before the first C.10 write.
9. Missing or non-true offering rows deny with the stable sanitized
   `VALIDATION_ERROR: service-not-offered`; `coating`, `other`, `interior`, and
   `glass` remain unaffected.
10. Preserve tenant, actor, revision, pricing, idempotency, numbering, customer,
    vehicle, estimate, item, and zero-write rollback contracts.
11. Do not add table/schema objects, backfill rows, repair migration history, or
    touch any excluded migration.
12. Normal bulk `supabase db push`, `--include-all`, migration-directory replay,
    and historical migration repair remain prohibited.

## Required diagnosis questions

Answer every item with redacted file/line evidence:

1. Confirm the exact semantic delta between live, predecessor, and target and
   identify every live behavior that must remain byte/statement stable.
2. Define one deterministic construction method for the future bridge that
   starts from the captured live body and inserts only the two accepted feature
   blocks. Reject manual copy/paste and broad source regeneration.
3. Identify the exact insertion ranges and ordering for body-size validation,
   existing-vehicle persistence, and C.9a without changing replay, numbering,
   or atomic-write precedence.
4. Determine whether `CREATE OR REPLACE FUNCTION` preserves the observed owner
   and ACL in this exact path. Specify the later metadata assertions and any
   explicit REVOKE/GRANT needed only if preservation cannot be proven.
5. Define the smallest future source/test/harness write allowlist. The historical
   two migrations must remain read-only.
6. Define deterministic source parity checks proving that the future bridge is
   live authority plus only the three accepted semantic blocks.
7. Define focused pgTAP additions covering all prior offering cases plus
   existing-vehicle valid/invalid/blank `bodySizeKey`, atomic persistence,
   exact replay, conflicting replay, numbering, and zero-write failures.
8. Determine whether the existing seven-file disposable harness can be reused
   unchanged, requires bounded edits, or needs a new sibling harness. Give the
   exact literal paths and why.
9. Define a fresh PostgreSQL 17 disposable verification sequence that applies
   the current committed chain excluding the protected LINE migration, then the
   new bridge as the only candidate, and proves real Auth/PostgREST, direct RPC,
   separate-connection concurrency, cleanup, hashes, and burn-on-failure.
10. Define the later Staging and Production mechanism without authorizing it:
    exact statement artifact, function metadata verification, separate history
    reconciliation, backup/restore evidence, and stop/rollback gates.
11. Confirm that no product decision, UI change, pricing change, customer data
    read, backfill, historical migration edit, or Production query is required.

## Allowed commands

Read-only only:

- `git status --short --branch`
- `git rev-parse HEAD HEAD^{tree}`
- `git merge-base --is-ancestor <governance-base> HEAD`
- `git diff --name-only <governance-base>...HEAD`
- `git ls-tree HEAD -- <protected-path>`
- `sed`, `rg`, `wc`, `diff`, `cmp`, and `shasum` limited to the mandatory
  documents, Git-tracked allowlist, and private evidence allowlist
- `shasum -a 256 -c <private-evidence-root>/SHA256SUMS.txt`

Do not run tests, typecheck, build, package-manager commands, Supabase CLI,
PostgreSQL, SQL, Docker, Colima, Auth, PostgREST, browser, network, provider,
GitHub API, Vercel, or any application runtime.

## Prohibitions and stop boundary

- Do not modify, create, delete, rename, format, stage, commit, push, stash,
  restore, clean, reset, or chmod any repository or evidence file.
- Do not create or mutate a PR/comment, mark Ready, merge, deploy, apply SQL,
  repair migration history, link a Supabase project, or access any hosted DB.
- Do not expose private function contents, credentials, URLs, JWTs, keys,
  customer rows, or other secrets.
- Stop immediately after returning the one report.

## Required result schema

Return:

1. `verdict`: `READY_FOR_FORWARD_BRIDGE_IMPLEMENTATION_GOVERNANCE`,
   `CHANGES_REQUIRED_CONTRACT`, `BLOCKED_READ_SCOPE`,
   `BLOCKED_EVIDENCE`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, full HEAD/tree, governance-base ancestry, exact committed delta,
   supplied PR state, clean-state result, and private-manifest verification.
3. Redacted three-way semantic-delta table: live, predecessor, target.
4. Exact bridge-construction algorithm and insertion/order contract.
5. Exact metadata/ACL preservation and verification contract.
6. Smallest future migration/pgTAP/harness literal write allowlists.
7. Exact static checks, focused pgTAP assertions, fresh disposable runtime cases,
   separate-connection cases, evidence artifacts, cleanup, and burn rules.
8. Staging/Production gate sequence and rollback boundary without any apply
   command or authorization.
9. Protected-path metadata-only verification.
10. Explicit confirmation of zero file, Git, database, Supabase, provider,
    Preview, Production, or external-service mutation.
11. Owner decision required: `NONE` or one exact question.

Stop after the report. Do not author or implement the migration.
