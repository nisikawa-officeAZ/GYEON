# Claude Directive — GDA Estimate Wizard Postal Master R2 Corrected Implementation

Directive ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R2_IMPLEMENTATION_V1`

Result ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R2_IMPLEMENTATION_RESULT_V1`

## 1. Status and authority

This is a non-executable governance candidate. It becomes executable only after all of these later gates complete: the three governance files are committed and normally pushed; the owner separately authorizes `supabase migration new jp_postal_master`; MacBook Codex binds the exact generated empty `MIGRATION_PATH`; and a later owner-approved dispatch supplies exact `DISPATCH_HEAD`, `DISPATCH_TREE`, and `MIGRATION_PATH`.

Then perform one bounded implementation and the listed local source tests only. Do not stage, commit, push, comment, download/import Japan Post data, start or access Supabase/database/Auth/Storage, access a provider/Preview/production environment, or mutate any external system.

Read completely, in order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. The latest relevant entries of `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. This directive
6. The newest non-superseded MacBook-Codex implementation dispatch on Draft PR #48

If identity, authority, migration allocation, status, protected metadata, or scope differs, return the applicable blocker without editing.

## 2. Identity and dispatch binding

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch/commit: `main` / `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Draft PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/48`, required `OPEN/Draft`
- Fixed source baseline commit/tree: `01781ace8ab4dd1d5d6888b9b3bb25f60dce0562` / `6e76febba0db66bb1fd8a302819109beb4d1fce6`

The later dispatch must supply exact `DISPATCH_HEAD`, `DISPATCH_TREE`, and `MIGRATION_PATH`. Prove:

1. The source baseline is an ancestor of `DISPATCH_HEAD`.
2. The committed source-baseline-to-dispatch delta is exactly the three R2 governance paths.
3. `MIGRATION_PATH` matches `supabase/migrations/<14 digits>_jp_postal_master.sql`, was created by the separately authorized `supabase migration new jp_postal_master`, is zero bytes before implementation, is untracked, and is the only untracked migration file.
4. Apart from that empty migration, the worktree and index are clean before implementation.

Any failure is `BLOCKED_CANDIDATE_DRIFT` or `BLOCKED_MIGRATION_ALLOCATION`. Never create, rename, or substitute another migration path.

## 3. Fixed business and data contract

- Source authority is the official Japan Post `utf_ken_all` UTF-8 one-record-per-line CSV with exactly 15 columns.
- The selected dataset contains town-address postal codes and excludes large-office individual postal codes. Do not add a large-office flag, source, table, download, or fallback.
- Preserve the exact official source columns: JIS municipality code, old postal code, seven-digit postal code, prefecture/municipality/town kana, prefecture/municipality/town kanji, flags 10–13, update flag, and change-reason code.
- Store derived normalized keys beside source values. Do not mutate or replace source fields.
- No runtime external lookup, AI inference, fuzzy matching, candidate ranking, general web search, or address transmission to a third party.
- Result vocabulary is exactly `FOUND`, `NOT_FOUND`, `AMBIGUOUS`, `INVALID_INPUT`, `MASTER_UNAVAILABLE`.
- Only `FOUND` may fill a blank target. Every other result leaves the current draft untouched and shows a short manual-entry notice. No candidate picker and no partial prefecture/municipality write.
- Existing nonblank operator values always win. An async result may apply only if the normalized source input still equals the request source and the target remains blank at response time.
- Lookup and OCR update Wizard draft only. Existing explicit save remains the only customer/estimate persistence boundary.
- Preserve customer/vehicle identity, one-scan OCR, vehicle 型式, manual grade, pricing, discounts, PPF/coating, routes, and exactly `SS/S/M/ML/L/LL/XL`.

## 4. Database and privilege contract

Create in `MIGRATION_PATH`:

1. `private.jp_postal_import_batches`: immutable source date/checksum/expected count, status, timestamps, validation/promotion/rollback evidence.
2. `private.jp_postal_master`: immutable rows keyed to an import batch, all 15 official source columns, normalized seven-digit postal code, normalized specific address key, fixed-length address-prefix head, and exact derived non-specific marker.
3. `private.jp_postal_active_batch`: one singleton pointer to the active validated/promoted batch.
4. Private helpers with `security definer` only when required and `set search_path = ''`.
5. Public RPCs for authenticated forward/reverse lookup and service-role-only begin/append/finalize/rollback import operations.

Required posture:

- Revoke schema/table/function defaults explicitly from `public`, `anon`, `authenticated`, and `service_role` before adding the minimum grants.
- No direct table access for browser roles. Lookup RPC EXECUTE is `authenticated` only and independently verifies a non-null actor with an active dealer membership, so direct PostgREST invocation cannot bypass the Server Action.
- Import RPC EXECUTE is `service_role` only. Import payload batches are bounded; invalid status, oversized payload, duplicate sequence, checksum replay conflict, wrong row count, invalid JIS/postal/flag values, or validation failure is fail-closed.
- No dynamic SQL, unqualified callable object, permissive search path, raw database error exposure, address logging, or service-role secret in client code.
- Master rows are versioned by immutable batch. Promotion and rollback atomically update only the singleton active pointer and batch status; they never rewrite/delete 120,000 accepted rows.
- Index forward lookup by `(batch_id, postal_code_norm)`. Index reverse prefilter by `(batch_id, address_prefix_head)` and then evaluate `starts_with(normalized_input, address_key)`, longest address key, and unique distinct postal code.

## 5. Official exceptional-record handling

- Derive `is_non_specific_town` only from the official town text forms `以下に掲載がない場合`, the municipality-specific `市区町村名の次に番地がくる場合`, and `市区町村名一円`. Test the exact parser rules; do not infer this flag from missing text.
- Non-specific records never produce reverse `FOUND`.
- Forward lookup returns `FOUND` only when the active rows reduce to one specific normalized address and official flag 13 does not indicate multiple towns. Non-specific, multiple address keys, or flag 13 returns `AMBIGUOUS` with no partial write.
- Reverse lookup returns `FOUND` only after the indexed head prefilter and longest exact prefix reduce to one distinct postal code and no winning row has official flag 10. Zero is `NOT_FOUND`; multiple postal codes, flag 10, or conflicting winning rows is `AMBIGUOUS`.
- Flags 11 and 12 are preserved and tested but do not independently fabricate or suppress a postal match. Building/lot text is an unmatched suffix after a specific town prefix; it is never stored in the master or used as a fuzzy key.

## 6. Import contract

- `scripts/postal-master/import-japan-post.ts` accepts only a local already-extracted CSV path, explicit source publication date, and expected SHA-256. It never downloads or unzips data.
- `src/lib/geo/jp-postal-master-csv.ts` is a pure dependency-free parser for the official BOM-less UTF-8, CRLF, one-record-per-line, quoted CSV. Require exactly 15 columns, preserve leading zeroes as strings, validate official binary/status/reason fields, and reject malformed quotes, embedded record breaks, BOM, duplicate source row identity, or invalid encoding.
- The CLI calculates SHA-256 before parsing and stops on mismatch. It calls service-role-only begin/append/finalize RPCs in deterministic bounded batches. `--rollback-batch <uuid>` calls only the rollback RPC and cannot be combined with import arguments.
- Output/logs are restricted to source date, checksum, batch id, counts, status, and stable error codes. Never print a source row or address.
- Replaying an already promoted identical checksum/date is an explicit no-write success; conflicting reuse fails.
- The implementation creates tooling only. Do not acquire real Japan Post data or connect to any database in this phase.

## 7. Wizard contract

- Add two optional typed invokers to `wizard-runtime-inputs.ts`, import the two Server Actions only in the server page, and thread props through `ProductionEstimateWizard` and `EstimateWizard` to Step 1. Client modules never import a Server Action or Supabase client.
- Postal-to-address fires only after a complete valid seven-digit value and a blank address target. OCR-address-to-postal fires once after the accepted single-scan OCR patch supplies a nonblank address and the postal target is blank.
- Use a pure `postal-master-apply.ts` planner to enforce normalization, source snapshot, target blankness, stale-response rejection, result vocabulary, and zero-write behavior for every non-`FOUND` state.
- Minimal inline loading/manual-entry text only. No modal, picker, route, layout, or unrelated UI change.
- Do not edit or reuse `src/lib/geo/postal-lookup.ts`; its legacy callers remain outside this phase.

## 8. Exact implementation write allowlist

Write only the dispatch-bound `MIGRATION_PATH` plus these exact 22 paths:

1. `src/lib/geo/jp-postal-master-contract.ts` (new)
2. `src/lib/geo/jp-postal-master-contract.test.ts` (new)
3. `src/lib/geo/jp-postal-master-actions.ts` (new)
4. `src/lib/geo/jp-postal-master-actions.test.ts` (new)
5. `src/lib/geo/jp-postal-master-csv.ts` (new)
6. `src/lib/geo/jp-postal-master-csv.test.ts` (new)
7. `scripts/postal-master/import-japan-post.ts` (new)
8. `scripts/postal-master/import-japan-post.test.ts` (new)
9. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
10. `src/app/estimates/new/page.tsx`
11. `src/components/estimates/wizard/production/ProductionEstimateWizard.tsx`
12. `src/components/estimates/wizard/EstimateWizard.tsx`
13. `src/components/estimates/wizard/steps/Step1Customer.tsx`
14. `src/components/estimates/wizard/steps/postal-master-apply.ts` (new)
15. `src/components/estimates/wizard/steps/postal-master-apply.test.ts` (new)
16. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
17. `src/lib/geo/jp-postal-master-migration-contract.test.ts` (new)
18. `supabase/tests/jp_postal_master_rpc.test.sql` (new)
19. `supabase/tests/data_api_matrix.test.sql`
20. `supabase/tests/grant_rls_role_matrix.test.sql`
21. `supabase/tests/catalog_manifest.test.sql`
22. `docs/master_specification/CATALOG_MANIFEST.md`

If another file is required, return `BLOCKED_IMPLEMENTATION_SCOPE` before editing it. No package/lockfile/dependency/config/environment/generated type/source, existing postal helper, OCR mapper, save, customer/vehicle migration, or protected path is allowed.

## 9. Required local verification — no database runtime

Run only:

1. `node --import tsx --test src/lib/geo/jp-postal-master-contract.test.ts`
2. `node --import tsx --test src/lib/geo/jp-postal-master-csv.test.ts`
3. `node --import tsx --test src/lib/geo/jp-postal-master-actions.test.ts`
4. `node --import tsx --test scripts/postal-master/import-japan-post.test.ts`
5. `node --import tsx --test src/components/estimates/wizard/steps/postal-master-apply.test.ts`
6. `node --import tsx --test src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
7. `node --import tsx --test src/lib/geo/jp-postal-master-migration-contract.test.ts`
8. `npm run typecheck`
9. `git diff --check -- <MIGRATION_PATH and exact 22 literal paths>`

The CSV tests must use small synthetic non-personal rows covering all 15 fields, leading-zero postal codes, quoted comma/escaped quote, malformed/BOM/record-break rejection, all flags, non-specific forms, duplicate identity, checksum mismatch, batch limits, no row/address logging, and rollback exclusivity. Migration source tests must prove exact privileges, active-member lookup guard, service-role import boundary, search path, pointer promotion/rollback, indexes, size limits, and no direct table grants. Wizard tests must prove one OCR applies customer+vehicle, a unique reverse result fills blank postal, unique forward fills blank address, operator values survive, stale/ambiguous/not-found/error never write, and exactly seven 3M sizes remain unchanged.

Do not run pgTAP, Supabase CLI DB commands, a database, Auth/PostgREST, the import CLI against data, build/dev/browser/Preview, or any network/provider command. `supabase/tests/jp_postal_master_rpc.test.sql` and updated catalog matrices are source candidates for a later disposable DB gate only.

## 10. Protected and prohibited scope

- Never open/read/diff/copy/stage/modify `src/components/estimates/wizard/screens/ScreensPreview.tsx`; metadata only.
- Treat `supabase/migrations/20260801110110_line_link_tokens.sql`, `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`, and `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` as metadata-only.
- No real certificate PDF, customer/address data, official CSV/archive, generated master rows, secrets, or environment values in Git, fixtures, logs, prompts, output, or evidence.
- No edits outside the 23-path allowlist; no dependency install; no stage/commit/push/comment/Ready/merge/deploy; no DB/Supabase/Auth/Storage/provider/Preview/production contact; no destructive cleanup or retry after a blocker.

## 11. Required result

Return `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R2_IMPLEMENTATION_RESULT_V1` with exactly:

1. `VERDICT`: `READY_FOR_CODEX_REVIEW`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, `BLOCKED_MIGRATION_ALLOCATION`, or `BLOCKED_IMPLEMENTATION_SCOPE`
2. `IDENTITY_MIGRATION_AND_SCOPE_PROOF`
3. `ACTUAL_CHANGED_PATHS_AND_HASHES`
4. `OFFICIAL_15_COLUMN_AND_EXCEPTION_CONTRACT`
5. `PRIVATE_SCHEMA_RPC_PRIVILEGE_AND_ACTIVE_BATCH_CONTRACT`
6. `IMPORT_CLI_CHECKSUM_BATCH_PROMOTION_ROLLBACK_CONTRACT`
7. `FORWARD_REVERSE_AMBIGUITY_AND_INDEX_CONTRACT`
8. `WIZARD_OCR_STALE_RESPONSE_AND_NO_OVERWRITE_CONTRACT`
9. `CATALOG_AND_GRANT_MATRIX_UPDATES`
10. `TEST_COMMANDS_COUNTS_AND_EXIT_CODES`
11. `TYPECHECK_AND_DIFF_CHECK`
12. `PROTECTED_FROZEN_AND_NO_EXTERNAL_ACTION_PROOF`
13. `REMAINING_RISKS`

Stop after the report. Leave the source candidate unstaged and uncommitted.
