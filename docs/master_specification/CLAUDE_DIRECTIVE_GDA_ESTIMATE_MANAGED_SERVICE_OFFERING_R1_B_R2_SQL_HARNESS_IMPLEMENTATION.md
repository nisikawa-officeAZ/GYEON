# Claude Directive — GDA Estimate Managed Service Offering R1-B-R2 SQL and Harness Implementation

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_SQL_HARNESS_IMPLEMENTATION_RESULT_V1`

## Phase and authority

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-B-R2`
- Mode: one bounded uncommitted implementation candidate plus static checks only
- Responsible implementation agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This directive does not authorize execution by itself. MacBook Codex may invoke it only after the owner separately approves external transmission of the exact private read set and nine-path editing. It never authorizes database startup, disposable runtime execution, Git delivery, PR mutation, Ready, merge, shared/production application, or deployment.

## Invocation identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#44`, which must remain `OPEN/Draft`
- Branch: `plan/estimate-managed-service-offering-enforcement-r1`
- Accepted predecessor: commit `7a6d622b5e08072b954012d969e8e79ddc38129b`, tree `553f4d2f794a555bfbba32339aea86e22c6fbaca`
- MacBook Codex must supply the exact committed governance execution HEAD and tree containing this directive.
- The committed delta from the predecessor to that execution HEAD must contain exactly:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R2_SQL_HARNESS_IMPLEMENTATION.md`
- Worktree and index must be clean before implementation.

If identity, ancestry, exact governance delta, PR state, branch, clean state, or protected metadata fails, return `BLOCKED_BASE_MISMATCH` without changing files.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest managed-service entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_DIRECT_RPC_SQL_READ_ONLY_DIAGNOSIS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R1_HARNESS_REFERENCE_READ_ONLY_DIAGNOSIS.md`
6. This directive

Then state the active phase, exact read set, exact nine-path write allowlist, protected paths, static-check boundary, and stop boundary.

## Literal implementation/reference read set

Only the mandatory documents above and these existing implementation/reference paths may be opened or searched:

1. `supabase/migrations/20260728150348_dealer_service_offerings.sql`
2. `supabase/migrations/20260825151059_persist_existing_vehicle_confirmed_body_size.sql`
3. `supabase/tests/estimate_wizard_atomic_save.test.sql`
4. `package.json`
5. `scripts/e2e/gyeon-order-v3-c5c/config.toml`
6. `scripts/e2e/gyeon-order-v3-c5c/setup.sh`
7. `scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql`
8. `scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
9. `scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
10. `scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql`
11. `scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql`
12. `scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh`
13. `scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`

Do not open another source, migration, test, harness, configuration, dependency, or generated path. If one additional existing path is indispensable, return `BLOCKED_SCOPE_REQUIRES_ONE_PATH` with that exact path and stop without edits.

## Literal write allowlist — exactly nine paths

1. `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql` (new)
2. `supabase/tests/estimate_wizard_atomic_save.test.sql`
3. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/config.toml` (new)
4. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/setup.sh` (new)
5. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/offering-guard.test.sql` (new)
6. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/real-auth.mjs` (new)
7. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/concurrency.mjs` (new)
8. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/capture-evidence.sh` (new)
9. `scripts/e2e/gda-estimate-managed-service-offering-r1-b/cleanup.sh` (new)

Do not modify a historical migration. Do not change application TypeScript, UI, pricing, OCR, size, rank, coupon, DTO, package, lockfile, Supabase root configuration, or generated evidence.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` → `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` → `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` → `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` → `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Frozen SQL contract

1. Replace `public.save_estimate_from_wizard(uuid, uuid, jsonb)` in one new forward-only migration. Preserve the active signature, return shape, `SECURITY INVOKER`, search path, service-role-only EXECUTE boundary, C.1-C.11 validation and writes, exception behavior, numbering, fingerprint, idempotency, and unrelated categories.
2. C.7 remains the sole service-line validation pass. C.8 remains the canonical fingerprint. C.9 remains the same-`(dealer,key)` advisory lock plus replay/conflict authority.
3. Insert one C.9a offering guard only after C.9 has returned an exact replay or raised a materially different same-key `DUPLICATE_SUBMISSION`, and before the first C.10 write.
4. Exact replay keeps its zero-write success even if an offering is later OFF. Same key plus a different fingerprint keeps `DUPLICATE_SUBMISSION` precedence. Only a genuinely new save reads current offering state.
5. Derive distinct required managed families from the C.7-validated `services[].category` values and evaluate all required families in one set-based SQL statement against `public.dealer_service_offerings` for `p_dealer_id`.
6. Mapping is exact: `window -> window_film`, `ppf -> ppf`, `maintenance -> maintenance`, `roomclean -> room_cleaning`, `carwash -> car_wash`. `coating`, `other`, and other existing unmanaged categories are unaffected.
7. Missing row and `enabled IS NOT TRUE` both mean OFF. Another dealer's row never authorizes the caller. Client offering flags, UI state, rank, catalog existence, and service-role bypass are not authority.
8. If any required family is OFF, raise exactly the stable sanitized failure `VALIDATION_ERROR: service-not-offered` before C.10. Do not disclose the family, dealer data, customer, vehicle, pricing, draft, configuration, SQLSTATE, constraint, or raw SQL error.
9. Rejection leaves zero customer, vehicle, estimate, estimate-item, document-number, revision, idempotency, or related mutation.
10. The single guard statement's start snapshot is authoritative under PostgreSQL `READ COMMITTED`. Do not issue one query per line/family. Do not add `FOR UPDATE`, a table lock, stronger isolation, or a new shared advisory-lock contract.
11. A concurrent enable committed after the guard snapshot does not authorize the current save. A concurrent disable committed after the guard snapshot does not retroactively invalidate a save that passed the snapshot. The existing idempotency advisory lock does not serialize offering writes.
12. Phase A TypeScript remains frozen. Do not move the SQL guard before C.9 to imitate its pre-RPC behavior; preserving direct-RPC replay semantics is mandatory.

## pgTAP requirements

Extend `supabase/tests/estimate_wizard_atomic_save.test.sql` without deleting or weakening existing assertions. Add focused cases that prove:

1. The five exact category-family mappings are pinned.
2. For each managed family, missing row rejects, `enabled=false` rejects, and `enabled=true` permits a genuinely new direct RPC save.
3. A mixed payload rejects when any one required managed family is OFF and writes nothing.
4. `coating`, `other`, and existing unmanaged categories remain unchanged.
5. Another dealer's enabled row cannot authorize the caller's dealer.
6. Exact replay returns the original success after the relevant offering is disabled, with zero writes.
7. Same key plus a materially different payload remains `DUPLICATE_SUBMISSION` even when its managed family is now OFF.
8. Disabled-family rejection does not allocate a document number or change customer, vehicle, estimate, item, lifecycle revision, or idempotency state.
9. Existing stale-revision, tenant, role, amount, item, rollback, and replay tests remain intact.

Update the pgTAP plan exactly. Do not mark the separate-connection races as pgTAP-passed.

## Dedicated harness requirements

Create exactly the seven allowlisted harness files. Structurally reuse, but do not copy GYEON-order domain fixtures or assertions from, C5-C.

- `config.toml`: PostgreSQL major version 17; unique local ports; loopback URLs; no seed; no hosted link; disabled unnecessary services where practical.
- `setup.sh`: explicit disposable-confirm literal; invocation-supplied expected HEAD/tree; clean/upstream/source-hash/protected-metadata gates; fresh suffix `YYYYMMDDTHHMMSSZ-xxxxxx`; runtime outside worktree and `/private/tmp`; offline-only container mount probe; loopback-only local Supabase startup; exact migration/test/harness copy; migration attribution; no retry or repair of a burned suffix.
- `offering-guard.test.sql`: local fixtures and direct SQL/pgTAP offering cases only; no GYEON-order tables or assertions.
- `real-auth.mjs`: create local GoTrue users, obtain real local tokens, use PostgREST, and prove the service-role RPC plus dealer/actor validation without logging tokens, passwords, service keys, or raw customer data.
- `concurrency.mjs`: use separate OS `psql` processes and a third observer with bounded timeouts; record backend PIDs and lock/wait evidence; no same-connection simulation.
- `capture-evidence.sh`: run the already-started attempt once, capture versions, identity, migrations, TAP, real-auth, RPC, concurrency, row counts, query/lock evidence, secret scan, command ledger, and non-zero failures. It must not finalize success before cleanup.
- `cleanup.sh`: tear down fixtures/runtime once, prove zero residual test rows and stopped project, create manifest and summaries with SHA-256, preserve failure evidence, and never rerun or repair the suffix.

The harness source must be implementation-complete but must not be executed in this phase.

## Deterministic concurrency source contract

Implement source for exactly two controlled interleavings; do not accept an unconstrained race where either outcome is considered sufficient.

1. **Disable-before-snapshot:** commit `enabled=false`, build a payload with the current post-change configuration revision, then start a fresh direct RPC save. It must return `service-not-offered`; observer counts for customer, vehicle, estimate, item, document number, and idempotency must remain unchanged.
2. **Snapshot-before-disable:** begin with the family enabled. Hold the target estimate `document_sequences` row so the save can pass C.9a and block at the first C.10 number-allocation write. Prove the save backend is waiting there, commit the offering disable from a separate connection, release the number-row lock, and require the save to complete successfully from its earlier guard snapshot. Prove one complete estimate with all expected items and no partial/torn state.

If the active schema makes that exact deterministic lock point impossible without production test hooks, return `BLOCKED_SCOPE_REQUIRES_ONE_PATH` and stop. Never add a test-only branch or hook to the production RPC.

## Allowed static verification commands

After editing, run only:

- `bash -n` separately for the three new shell files
- `node --check` separately for `real-auth.mjs` and `concurrency.mjs`
- bounded `rg` checks restricted to the literal read/write sets for C.9/C.10 ordering, five mappings, missing/false semantics, result identifier, PostgreSQL 17, loopback guards, timeout, evidence, cleanup, and burn markers
- `git diff --check`
- `git status --short --branch`
- `git diff --name-only`
- `git diff --stat`
- `git ls-tree HEAD -- <protected-path>`

Do not run SQL, pgTAP, tests, typecheck, build, npm scripts, Supabase CLI, Docker, Colima, PostgreSQL, Auth, PostgREST, RPC, browser, network, provider, Preview, production, or deployment commands.

## Prohibitions and stop boundary

- Do not modify outside the nine paths.
- Do not stage, commit, push, stash, restore, clean, reset, create/mutate a PR or comment, mark Ready, merge, apply migrations, or deploy.
- Do not access a hosted/shared/production database or external provider.
- Do not spawn subagents or use web/browser tools.
- Do not expose secrets or protected contents.
- Stop with the uncommitted nine-path candidate and one result report.

## Required result schema

Return:

1. `verdict`: `CANDIDATE_READY_FOR_CODEX_REVIEW`, `BLOCKED_BASE_MISMATCH`, `BLOCKED_SCOPE_REQUIRES_ONE_PATH`, or `BLOCKED_STATIC_VERIFICATION`.
2. Branch, supplied HEAD/tree, predecessor ancestry, exact governance delta, PR state, initial clean state, and protected metadata result.
3. Exact changed paths and explicit confirmation that every other path is unchanged.
4. SQL guard position, one-query mapping, snapshot semantics, stable error, replay/conflict precedence, and zero-write contract.
5. pgTAP additions and exact planned assertion count.
6. Seven-file harness responsibility table and confirmation that no GYEON-order domain fixture/assertion was copied.
7. Two deterministic concurrency interleavings and their observer invariants.
8. Static command results and `git diff --check` result.
9. Explicit confirmation: no database/runtime/test execution, no Git mutation, no external/provider action, and no secret/protected-content exposure.
10. Owner decision required: `NONE` or one exact question.

Stop. Do not execute the disposable harness or deliver the candidate.
