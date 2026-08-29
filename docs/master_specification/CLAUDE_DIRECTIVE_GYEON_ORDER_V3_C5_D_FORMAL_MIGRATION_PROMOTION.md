# Claude Directive — GYEON Order V3 C5-D Formal Migration Promotion

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_D_FORMAL_MIGRATION_PROMOTION_V1`
- Phase: `GYEON_ORDER_V3_C5_D_FORMAL_MIGRATION_PROMOTION`
- Mode: `BOUNDED_SOURCE_CANDIDATE`
- Repository: `nisikawa-officeAZ/GYEON`
- Required base branch: `main`
- Required base commit: `96a66c3fb5969718418da1ef4c75fe62407b48aa`
- Required base tree: `d8d6d3bdd5d809714896fe006d73910e175f130d`
- Proposed work branch: `agent/gyeon-order-v3-c5d-formal-migration-promotion`
- Predecessor result: `GYEON_ORDER_V3_C5_C_DISPOSABLE_DB_VERIFICATION_RESULT_V1`
- Predecessor verdict: `C5C_DISPOSABLE_DB_PASS`
- Evidence target: uncommitted E2 source candidate

This directive is governance only until the owner separately authorizes its transmission and execution. It does not authorize Claude invocation, file edits, tests, DB/Supabase access, Git delivery, PR mutation, environment application, provider connection, Ready, merge, or deployment.

## Required first reads

Read completely before any implementation:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest C5-C and C5-D entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-result.md`
5. `docs/integrations/gyeon-order/v3-c5d-formal-migration-promotion-plan.md`
6. `supabase/migrations/DRAFT_DO_NOT_APPLY/README.md`

## Preflight stop conditions

Stop with `BLOCKED_BASE_OR_SCOPE` before editing if any condition fails:

- checked-out base is not exact commit/tree above;
- index or worktree is not clean before the candidate begins;
- DRAFT SQL hash is not `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`;
- DRAFT terminal `rollback;` is not exactly one final SQL statement;
- an existing formal `*_gyeon_order_v3_contract.sql` already exists;
- any protected blob differs from the recorded values;
- another path is required.

## Literal read scope

After the required first reads, source content may be read only from:

- `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
- `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`
- `scripts/e2e/gyeon-order-v3-c5c/setup.sh` — read-only reference for the accepted terminal-guard transformation

Do not expand the read scope. If expansion is essential, return `BLOCKED_READ_SCOPE` with the exact path and reason.

## Exact future write allowlist

Only these four paths may change:

1. `supabase/migrations/<SUPABASE_CLI_GENERATED_TIMESTAMP>_gyeon_order_v3_contract.sql` — new
2. `supabase/migrations/DRAFT_DO_NOT_APPLY/README.md`
3. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
4. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

No other file may be created, modified, deleted, moved, formatted, staged, or copied.

## Migration creation contract

1. Run `supabase --help` and `supabase migration --help` first. Do not guess CLI behavior.
2. Create the empty formal file with `supabase migration new gyeon_order_v3_contract`.
3. Confirm the CLI produced one unused 14-digit timestamp later than every current formal migration.
4. Populate that file from the exact DRAFT bytes with only the controlled changes below.

### Allowed SQL-file changes

- Replace the initial source-only/DRAFT full-line comments with formal C5-D candidate comments.
- Replace the terminal accidental-execution full-line comments with forward-only/separate-application-gate comments.
- Replace the one final `rollback;` with `commit;`.

No other byte in executable SQL may change. Do not redesign, optimize, reorder, reformat, uppercase, lowercase, or regenerate SQL. Do not add a data backfill, seed, provider call, network call, adapter, view, table, column, constraint, index, policy, grant, revoke, trigger, function, RPC, or error code.

## Test contract

### Migration contract test

Update it so that:

- the DRAFT remains hash-bound, visibly guarded, and terminal-ROLLBACK;
- the exact generated formal path is the canonical executable migration;
- only the approved comment hunks and terminal guard differ;
- a deterministic expected-formal byte stream is derived from the DRAFT and exactly equals the formal file;
- after removing only full-line comments and promoting the DRAFT terminal guard, executable SQL is byte-for-byte equal;
- the formal file has one terminal COMMIT and no terminal ROLLBACK;
- exactly one formal `*_gyeon_order_v3_contract.sql` exists.

Do not use broad whitespace normalization as the parity authority. It can hide executable drift.

### RPC contract test

Point the canonical RPC contract assertions to the exact formal migration path. Do not weaken, delete, skip, or reduce any existing contract assertion. The DRAFT remains provenance only.

### DRAFT README

Keep every direct-execution prohibition for the DRAFT. Record that it is immutable C5-C provenance, and record the exact formal path/hash once generated. State that formal DB application remains a separate owner gate.

## Static verification only

No DB, Supabase local stack, Docker, Colima, psql, Auth, PostgREST, HTTP, provider, or network execution is allowed in this source-candidate gate.

Run exactly the focused tests:

```text
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts
```

Then run:

- `git diff --check` limited to the exact four write paths;
- exact changed-path allowlist verification including the generated timestamp path;
- SHA-256, byte count, and line count for DRAFT and formal migration;
- zero-match check for a second formal migration candidate;
- protected pathname/mode/blob/Git-state verification only.

## Protected paths

Metadata only. Never open, read, print, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` — expected blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` — expected blob `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — expected blob `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — expected blob `fe3c80f22fd80dcbfab076082473216dda582c14`

## Absolute prohibitions

- No DRAFT modification other than README; guarded SQL remains byte-identical.
- No existing formal migration modification.
- No C5-C harness modification or execution.
- No DB/Supabase/Docker/Colima/psql/Auth/PostgREST/provider connection.
- No Office AZ inventory implementation.
- No broad formatter, dependency action, build, full suite, Git add/commit/push, PR comment/mutation, Ready, merge, deployment, or environment apply.
- No repair outside the allowlist. Return a stop verdict instead.

## Required result

Return `GYEON_ORDER_V3_C5_D_FORMAL_MIGRATION_PROMOTION_RESULT_V1` with:

1. verdict: `PASS_FORMAL_MIGRATION_SOURCE_CANDIDATE`, `CHANGES_REQUIRED_SOURCE`, or `BLOCKED_BASE_OR_SCOPE`;
2. base branch/commit/tree and pre-edit clean state;
3. generated formal migration path and timestamp;
4. exact four changed paths;
5. DRAFT and formal SHA-256, bytes, and lines;
6. exact allowed-diff proof and executable-byte parity proof;
7. focused test count, exit code, and no skipped tests;
8. `git diff --check` result;
9. index state and confirmation that no Git delivery occurred;
10. protected metadata-only confirmation;
11. confirmation of zero DB/Supabase/Docker/Colima/Auth/PostgREST/provider/network/environment actions;
12. known limitations: formal disposable verification and populated upgrade verification are not yet run.

Return only to the invoking Codex session. Do not persist a result file and do not post to GitHub.
