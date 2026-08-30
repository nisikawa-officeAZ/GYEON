# Claude Directive — GDA Estimate Managed Service Offering R1-B-R1 Harness Reference Read-only Diagnosis

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R1_HARNESS_REFERENCE_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-B-R1`
- Mode: one bounded read-only follow-up diagnosis only
- Responsible diagnosis agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

The prior Phase-B diagnosis is accepted as `ACCEPTED_WITH_FOLLOW_UP_REQUIRED`: the active RPC has no independent `dealer_service_offerings` guard, but the exact PostgreSQL 17 direct-RPC harness structure and the offering-change concurrency contract remain unresolved. This invocation may resolve only those two technical questions. It must not implement, test, start a database, contact a provider, mutate Git, or redesign product behavior.

## Invocation identity

MacBook Codex must supply the exact committed governance execution HEAD and tree containing this directive.

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#44`, which must remain `OPEN/Draft`
- Branch: `plan/estimate-managed-service-offering-enforcement-r1`
- Accepted predecessor: commit `70f13f465b7cc05462a34b61bc6a5d3b61080da1`, tree `355edb957d59aa91c1e81274e72b4370285e6acb`
- The committed delta from that predecessor to the supplied execution HEAD must contain exactly:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_R1_HARNESS_REFERENCE_READ_ONLY_DIAGNOSIS.md`
- Worktree and index must be clean before diagnosis.

If identity, ancestry, exact delta, PR state, branch, or clean state fails, return `BLOCKED_BASE_MISMATCH` and stop.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest managed-service entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_B_DIRECT_RPC_SQL_READ_ONLY_DIAGNOSIS.md`
5. This directive

Then state the active phase, literal read allowlist, protected paths, prohibitions, and stop boundary.

## Literal follow-up read allowlist

Only these implementation/reference paths may be opened or searched:

### Existing accepted PostgreSQL 17 direct-RPC harness reference — nine paths

1. `scripts/e2e/gyeon-order-v3-c5c/setup.sh`
2. `scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`
3. `scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh`
4. `scripts/e2e/gyeon-order-v3-c5c/config.toml`
5. `scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
6. `scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
7. `scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql`
8. `scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql`
9. `scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql`

### Minimum SQL/race references — four paths

10. `supabase/migrations/20260728150348_dealer_service_offerings.sql`
11. `supabase/migrations/20260825151059_persist_existing_vehicle_confirmed_body_size.sql`
12. `supabase/tests/estimate_wizard_atomic_save.test.sql`
13. `package.json`

Do not open any other implementation, migration, test, harness, configuration, or generated file. If one exact additional path is indispensable, return one bounded follow-up read request and stop rather than broadening the read set.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` → `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` → `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` → `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` → `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Frozen accepted findings

1. Verdict remains `CHANGES_REQUIRED_SQL_AND_TESTS`.
2. The active RPC is `public.save_estimate_from_wizard(uuid, uuid, jsonb)`, `SECURITY INVOKER`, server-only `service_role` EXECUTE.
3. The RPC currently performs zero `dealer_service_offerings` lookups; all five managed families can bypass the offering contract through a direct service-role RPC caller.
4. The accepted Phase-A TypeScript guard remains frozen and unchanged.
5. The five managed families remain `window_film`, `ppf`, `maintenance`, `room_cleaning`, and `car_wash`; `coating` and `other` remain outside this contract.
6. Missing or `enabled = false` means OFF. Another tenant's row never authorizes the caller.
7. Historical migrations are immutable; any later SQL repair is one new forward-only migration.
8. A disabled-family rejection must leave zero customer, vehicle, estimate, item, number, idempotency, revision, or related mutation.
9. No UI, pricing, OCR, size, rank, coupon, or business-rule redesign is permitted.

## Questions to answer

Answer every question with file-and-line evidence:

1. Which exact C5-C files establish PostgreSQL 17, fresh unique runtime naming, loopback-only endpoints, real auth claims, direct REST/RPC calls, separate-connection concurrency, raw SQL evidence, cleanup, hash manifest, and burn-on-failure behavior?
2. Which parts can be copied structurally and which are GYEON-order-specific and must not be reused for Estimate Wizard?
3. Define the smallest new dedicated harness path set under `scripts/e2e/gda-estimate-managed-service-offering-r1-b/`. List exact filenames and one responsibility per file; do not create them.
4. Define the later fresh-runtime command sequence, prerequisite/version checks, evidence directory contract, unique suffix rule, timeout rule, cleanup rule, and non-zero exit behavior. Do not run commands.
5. Define the real claim/role matrix and direct-RPC cases for five families absent/false/true, mixed families, coating/other unaffected, cross-tenant isolation, stale revision, idempotent replay, and zero-write rejection.
6. Resolve the prior report's inconsistency between placing the SQL guard after C.7 and stating that the offering read should occur after the C.9 advisory lock. Prove whether the existing advisory lock serializes offering-setting updates; do not assume that it does.
7. Under the active PostgreSQL transaction/isolation behavior, identify the exact authoritative instant at which offering state is evaluated. Determine whether one RPC statement snapshot is sufficient or whether row locking, an advisory-lock contract shared by setting writes, stronger isolation, or another mechanism is required.
8. Explain the missing-row race: when absence means OFF, what prevents a concurrent insert/enable from creating an ambiguous decision? State whether this is acceptable statement-time semantics or requires an explicit serialization rule.
9. Specify the smallest genuine separate-connection race test, or prove with exact PostgreSQL behavior why no such test is necessary. A hedged answer is not acceptable.
10. Return the exact later implementation gates and literal write allowlists for: forward-only migration plus pgTAP, harness files, fresh disposable execution, result recording, Git delivery, Ready/merge, and any shared or production application.
11. Confirm no owner business decision is required and no mutation occurred.

## Allowed commands

Read-only only:

- `git status --short --branch`
- `git rev-parse HEAD HEAD^{tree}`
- `git merge-base --is-ancestor <accepted-predecessor> HEAD`
- `git diff --name-only <accepted-predecessor>...HEAD`
- `git ls-tree HEAD -- <protected-path>`
- `sed`, `rg`, `wc`, and `shasum`/`sha256sum` restricted to mandatory documents and literal allowlists

Do not run tests, typecheck, build, package commands, application runtime, Docker, Colima, Supabase CLI, PostgreSQL, SQL, Auth, PostgREST, browser, network, provider, Preview, or production commands.

## Prohibitions and stop boundary

- Do not modify, create, delete, rename, format, stage, commit, push, stash, restore, clean, or reset any file.
- Do not spawn a subagent or use browser/network tools.
- Do not mutate a PR/comment, mark Ready, merge, deploy, or access a shared environment.
- Do not expose secrets, real tokens, raw customer data, or protected file contents.
- Stop after one result report.

## Required result schema

Return:

1. `verdict`: `READY_FOR_SQL_AND_HARNESS_IMPLEMENTATION_GOVERNANCE`, `FOLLOW_UP_READ_REQUIRED`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, HEAD/tree, predecessor ancestry, exact committed governance delta, supplied PR state, and clean-state result.
3. Nine-path C5-C harness architecture table with reusable versus forbidden parts.
4. Exact proposed Estimate Wizard harness path allowlist and responsibilities.
5. Exact PG17 fresh-runtime, auth, RPC, concurrency, evidence, hash, cleanup, timeout, and burn contract.
6. Exact resolved SQL guard position and offering-change concurrency contract, including missing-row semantics.
7. Exact direct-RPC/pgTAP/race cases and later gated execution sequence.
8. Protected metadata-only verification and explicit zero-mutation confirmation.
9. Owner decision required: `NONE` or one exact question.

Stop. Do not implement or execute the SQL/harness phase.
