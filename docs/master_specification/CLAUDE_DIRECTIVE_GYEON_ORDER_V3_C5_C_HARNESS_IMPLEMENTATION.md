# Claude Directive — GYEON Order V3 C5-C Harness Implementation

## Directive identity

- Directive ID: `GYEON_ORDER_V3_C5_C_HARNESS_IMPLEMENTATION_V1`
- Phase: `GYEON_ORDER_V3_C5_C_R4_HARNESS_IMPLEMENTATION_GOVERNANCE`
- Mode: `IMPLEMENT_UNCOMMITTED_HARNESS_CANDIDATE_AND_STATIC_VERIFY`
- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/gyeon-order-v3-c5-external-authority-design`
- R2 source commit: `3403918d0166c30c44abb95bad1c8a7335877cab`
- R2 source tree: `1d1617a49bc1dd1e4b21515fec4940c3fdc4f827`
- SQL SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- RPC contract test SHA-256: `dbc7be4c08195c944eb00a0c28dc839736340b7c0df3e31ad617bdfa957a4159`
- Migration contract test SHA-256: `c071ba016e10419f4412bdc93c4c34c43130dffbe25d228d51533646672ab5c5`
- Accepted diagnosis: `GYEON_ORDER_V3_C5_C_R2_READ_ONLY_HARNESS_DIAGNOSIS_RESULT_V1`
- Accepted diagnosis verdict: `READY_FOR_HARNESS_IMPLEMENTATION`
- Diagnosis execution HEAD: `960835a58a01ff249dcc0e99c72b5542b003042e`
- Diagnosis execution tree: `2b09af16fafa1e2b5ba0c6da30f507dced0fb0b1`
- Required implementation HEAD/tree: the later accepted governance commit containing this directive; the invocation must state both exact values
- Coordination PR: `#36` — must remain OPEN/Draft

This committed directive is a future implementation contract only. It does not itself authorize external transmission, execution, file changes, tests, Git mutation, database access, or Supabase operations. Start only after a later explicit owner authorization and an invocation that states the exact accepted implementation HEAD/tree. Stop if branch, HEAD, tree, source hashes, plan identity, instruction identity, PR state, or worktree/index state differs.

## Required first reads

Read completely before editing:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest four `GYEON-ORDER-V3-C5-*` entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-plan.md`
5. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-plan.md`
6. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-result.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_C_R2_READ_ONLY_HARNESS_DIAGNOSIS.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_GYEON_ORDER_V3_C5_B_R2_INVENTORY_EVIDENCE_AND_PAYMENT_CONTRACT_SNAPSHOT_REPAIR.md`

## Literal source and reference read scope

After the required reads, inspect only these source/test/reference paths:

- `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
- `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`
- `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
- `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`
- `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
- `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`
- `scripts/e2e/gyeon-order-v3-c4/config.toml`
- `scripts/e2e/gyeon-order-v3-c4/setup.sh`
- `scripts/e2e/gyeon-order-v3-c4/schema-rls.test.sql`
- `scripts/e2e/gyeon-order-v3-c4/business-contract.test.sql`
- `scripts/e2e/gyeon-order-v3-c4/real-auth.mjs`
- `scripts/e2e/gyeon-order-v3-c4/concurrency.mjs`
- `scripts/e2e/gyeon-order-v3-c4/capture-evidence.sh`
- `scripts/e2e/gyeon-order-v3-c4/cleanup.sh`

Do not broaden the read scope. If another content path is essential, stop with `BLOCKED_ALLOWLIST`, identify the exact path and reason, and make no changes.

## Literal write allowlist — exactly nine new paths

Create exactly these paths and edit no other path:

1. `scripts/e2e/gyeon-order-v3-c5c/config.toml`
2. `scripts/e2e/gyeon-order-v3-c5c/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql`
4. `scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql`
5. `scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql`
6. `scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
7. `scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
8. `scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh`
9. `scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`

Expected modes:

- `setup.sh`, `capture-evidence.sh`, and `cleanup.sh`: `100755`
- the other six paths: `100644`

Do not create a result document, runtime directory, evidence directory, generated SQL, log, snapshot, fixture file, package file, or temporary file in the repository. The later disposable-execution result document is a separate gate.

## Protected paths

These paths are metadata-only. Never open, read, print, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, Git blob, and Git status may be reported.

## C4 reuse boundary

- `config.toml`, `setup.sh`, `capture-evidence.sh`: copy their safety and orchestration patterns, then bind them to C5-C.
- `concurrency.mjs` and `cleanup.sh`: reuse their process/observer and exact-path guard structures, then extend/retarget them.
- `schema-rls.test.sql`, `business-contract.test.sql`, and the RPC-call portion of `real-auth.mjs`: the C4 content is `SUPERSEDED_PROHIBITED`. It refers to removed objects such as `gyeon_order_payment_evidence`, `owner_submit_gyeon_order_v3_rpc`, and `edit_gyeon_order_v3_before_warehouse_rpc`. Reuse test idioms only; do not copy stale names or counts.
- Do not modify any C4 file. It is accepted historical evidence.

## Required implementation by path

### 1. `config.toml`

- Define a C5-C-only local project template with no linked/hosted project reference.
- Bind all exposed hosts to loopback only.
- Use the repository-pinned local Supabase conventions and PostgreSQL 17 runtime contract from the plan.
- Store no token, password, service key, anon key, provider payload, or real project identifier.
- Make the project ID/suffix injectable and fail closed when it does not match the runtime suffix.

### 2. `setup.sh`

- Require an unused `gyeon-order-v3-c5c.<timestamp-random6>` suffix under `/Users/atsushinishikawa/Documents/Codex/runtime/`, outside the Git worktree and outside `/private/tmp`.
- Reject non-loopback DB/API hosts, `supabase.co`, `supabase.in`, `pooler.supabase`, remote links, missing confirmation literal, source HEAD/tree/hash drift, and reused/burned suffixes before startup.
- Perform the mount probe before database startup when this script is later executed.
- Copy only the minimum runtime inputs defined by the plan; never copy application UI or protected contents.
- Replay formal migrations in order while explicitly excluding the protected LINE migration without opening its contents.
- Derive exactly one runtime SQL copy from the R2 guarded SQL by changing exactly one terminal `ROLLBACK` to `COMMIT`, prove no other byte difference, then apply it once when later executed.
- Wire the three pgTAP files and later Auth/concurrency/evidence capture stages without executing them during this implementation phase.
- Any failure must stop, mark the suffix/evidence as burned, and never repair/retry that suffix.

### 3. `schema-rls.test.sql`

- Use exact pgTAP plan/count assertions with no skip, todo, or `NOTESTS` path.
- Assert all R2 tables, columns, constraints, indexes, function signatures, owners, security modes, and `search_path = ''` contracts.
- Assert RLS on every exposed public table and explicit revoke-before-grant behavior.
- Prove anon has no table authority; authenticated has no direct authority/evidence/prepared/snapshot/outbox/task writes; tenant reads remain dealer-bound.
- Prove every `SECURITY DEFINER` function has exact execute grants and no default `PUBLIC` execute.
- Reject `auth.role()`, `user_metadata`, `raw_user_meta_data`, unqualified dynamic SQL, browser-controlled commercial authority, and provider/network calls.

### 4. `qualification-evidence.test.sql`

- Cover all qualification authority states, exact single classification version, snapshot exact replay, and conflicting-input immutability.
- Cover all four evidence purposes and exact dealer/order/version/fingerprint/amount/currency/provider/state/expiry/consumption bindings.
- Prove provider-event uniqueness, replay behavior, mismatch codes, expiry, ambiguity, failure/unknown states, and one-time consumption.
- Prove no default/rank/history/browser fallback and keep `shop_to_detailer` success fail-closed while its history authority is absent.

### 5. `prepare-finalize-warehouse.test.sql`

- Cover owner-submit and pre-warehouse-edit prepare/finalize success and hostile branches.
- Prove deterministic `prepared operation -> order -> evidence` lock/validation/consumption semantics and original-state preservation.
- Prove amount-changing card edit replaces both card-authority fields and amount-preserving edit preserves both.
- Prove durable exactly-once `void_new_card_authorization` intent after unusable new authorization, including credit activation before finalize.
- Prove the frozen payment-contract snapshot, no retroactive standard-payment conversion, exact credit terms version release, and missing snapshot denial.
- Prove exact bank match and exact non-backorder inventory-reservation evidence lock/consume-before-task behavior; backorder must not consume unrelated reservation evidence.
- Prove exactly-one warehouse release task and accept/cancel order/task version behavior.

### 6. `real-auth.mjs`

- Use real local GoTrue-issued tokens and PostgREST requests; no SQL-only claim simulation may substitute for authorization proof.
- Cover exactly: Dealer A owner, manager, staff, readonly, suspended; Dealer B owner; no membership; expired ordering membership.
- Prove owner-only submit/edit/cancel, staff/manager draft-review limits, tenant isolation, direct-table denial, and rejection of forged commercial/RPC fields.
- Never persist complete tokens, passwords, keys, headers, cookies, or secrets; record only redacted principal identifiers, status, count, and error code.
- Reject any non-loopback URL before sending a request.

### 7. `concurrency.mjs`

- Run each later race with two independent OS `psql` processes plus a third observer connection.
- Save distinct backend PIDs and prove both contenders were concurrently active.
- Implement exactly the ten races in plan section C5C-7, including both credit-activation races and inventory evidence consumption.
- Record canonical winner/loser, SQLSTATE, invariant counts, preserved original state, and timeout/deadlock classification.
- Treat same PID, sequential execution, missing observer, timeout, `UNKNOWN`, deadlock, duplicate authority/task/intent, or orphan consumption as failure.

### 8. `capture-evidence.sh`

- Produce exactly the 19 evidence artifacts listed in plan section 8; the earlier diagnosis wording of 17 files was a counting error and is superseded by the canonical 19-item list.
- Record every command, exit code, exact pgTAP plan/count, versions, hashes, schema fingerprint, separate backend PIDs, raw assertion outputs, cleanup result, and repository/protected metadata.
- Run secret scanning before any later result can be accepted.
- `summary.json` and `summary.md` may summarize but never override raw failures.
- Do not create evidence during this implementation/static-verification phase.

### 9. `cleanup.sh`

- Delete fixtures in exact reverse dependency order and verify zero remaining rows through a third connection.
- Stop only the exact local project ID and delete only the validated exact runtime path.
- Reject blank paths, variables resolving outside the C5-C runtime root, globs, parents, `/`, `$HOME`, `~`, repository roots, and reused/burned suffixes.
- Cleanup failure is an overall C5-C failure; preserve raw evidence and never promote the attempt to PASS.

## Static verification authorized for the later implementation execution

Run each command once after creating the nine-path candidate. These commands do not start Supabase, Docker, Colima, PostgreSQL, Auth, PostgREST, or the harness:

1. `bash -n scripts/e2e/gyeon-order-v3-c5c/setup.sh scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`
2. `node --check scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
3. `node --check scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
4. Run the following untracked-aware whitespace check. For a clean new file, `git diff --no-index` returns status `1` with empty `--check` output; any other status or any output is failure:

   ```bash
   for path in \
     scripts/e2e/gyeon-order-v3-c5c/config.toml \
     scripts/e2e/gyeon-order-v3-c5c/setup.sh \
     scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql \
     scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql \
     scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql \
     scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs \
     scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs \
     scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh \
     scripts/e2e/gyeon-order-v3-c5c/cleanup.sh
   do
     check_output="$(git diff --no-index --check /dev/null "$path" 2>&1)"
     check_status=$?
     if [ "$check_status" -ne 1 ] || [ -n "$check_output" ]; then
       printf '%s\n' "$check_output"
       exit 1
     fi
   done
   ```

5. Run `rg -n 'gyeon_order_payment_evidence|owner_submit_gyeon_order_v3_rpc|edit_gyeon_order_v3_before_warehouse_rpc' scripts/e2e/gyeon-order-v3-c5c` once. Exit `1` with zero output is PASS; any match is failure.

Do not run source-contract tests, pgTAP, setup, evidence capture, cleanup, Supabase CLI, Docker, Colima, psql, Auth, PostgREST, query plans, advisors, migrations, SQL, or any database command in this phase.

## Prohibitions

- No path outside the exact nine-path write allowlist.
- No source migration/test change, C4 change, plan/result/directive change, package/dependency/lockfile or existing repository-config change, UI change, provider adapter, Office AZ inventory implementation, or result document. The one new allowlisted `config.toml` is permitted.
- No Git add, commit, push, checkout, branch, stash, restore, clean, PR comment, Ready conversion, merge, tag, deploy, or release.
- No database/Supabase/Docker/Colima/psql/Auth/PostgREST execution, SQL application, migration derivation/application, provider call, webhook, email, LINE, Vercel, hosted project, or network access.
- No protected-content access.
- No secret inspection or persistence.
- No retry loop. If a static command fails twice for the same reason, stop and report it; do not broaden scope.

## Required result

Return `GYEON_ORDER_V3_C5_C_HARNESS_IMPLEMENTATION_RESULT_V1` with:

1. `verdict`: exactly one of `PASS_HARNESS_CANDIDATE`, `CHANGES_REQUIRED`, or `BLOCKED_ALLOWLIST`;
2. confirmed starting/ending branch, HEAD, tree, worktree/index state, R2 hashes, and PR OPEN/Draft input;
3. exact nine changed paths and modes;
4. concise implementation summary for each path;
5. pgTAP plan/count map encoded by the three SQL files, without executing it;
6. real-Auth principal/operation matrix encoded by `real-auth.mjs`, without executing it;
7. ten-race/PID/observer matrix encoded by `concurrency.mjs`, without executing it;
8. exact 19-artifact evidence manifest and cleanup dependency order encoded by the shell scripts;
9. exact static commands, exit codes, and any failures;
10. per-path SHA-256;
11. stale C4 identifier search result;
12. protected metadata-only confirmation;
13. explicit confirmation of zero database/Supabase/Docker/Colima/Auth/PostgREST/provider/network/Git/PR actions.

Return only to the invoking Codex session. Do not post the result to GitHub and do not persist a report file.
