# Claude Directive — GDA Estimate Wizard Postal Master R1 Read-only Diagnosis

Directive ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R1_READ_ONLY_DIAGNOSIS_V1`

Result ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## 1. Status and authority

This file is a non-executable governance candidate until it is committed, normally pushed, and a later owner-approved PR dispatch supplies exact `DISPATCH_HEAD` and `DISPATCH_TREE`. Then perform one bounded read-only diagnosis only. Do not edit, create, delete, rename, format, stage, commit, push, comment, test, build, run the application, download or import postal data, connect to Supabase/database/Auth/Storage/provider/Preview/production, or mutate any external system.

Read completely, in order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. The latest relevant entries of `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. This directive
6. The newest non-superseded MacBook-Codex dispatch comment on Draft PR #48

If authority, identity, ancestry, delta, or scope differs, return the applicable blocker and stop.

## 2. Exact identity and dispatch gate

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch/commit: `main` / `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Dedicated branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Draft PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/48`, required `OPEN/Draft`
- Fixed source baseline commit: `ee243fa982cd9520ff0607ea2caeb78797fdb6de`
- Fixed source baseline tree: `9f8f5b1be1724e570826289e872efae3ca21c400`

The later dispatch must provide exact `DISPATCH_HEAD` and `DISPATCH_TREE`. Prove that the source baseline is an ancestor of `DISPATCH_HEAD` and that its entire delta is exactly these three paths:

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R1_READ_ONLY_DIAGNOSIS.md`

Missing binding, ancestry failure, PR drift, or any other changed path is `BLOCKED_CANDIDATE_DRIFT`.

## 3. Owner-ratified data authority

Treat these decisions as fixed, not as recommendations:

- Postal/address source of truth is the official Japan Post nationwide UTF-8 postal-code CSV.
- Records live in a dedicated internal database master, never in customer rows.
- Both postal-code-to-address and OCR-address-to-postal resolution use the same versioned master.
- Runtime requests do not call a third-party postal/address service and do not transmit customer addresses externally.
- AI, fuzzy matching, general web search, and fabricated completion are prohibited.
- Automatic completion occurs only for a deterministic authoritative result that resolves to one unique postal code. Zero matches, multiple postal codes, malformed input, unavailable master, timeout, or error is manual/fail-closed.
- A controlled administrator/import process records source date, import batch/version, checksum, and rollback evidence. Request-time download or silent refresh is prohibited.
- Existing nonblank operator input is not overwritten automatically. OCR and lookup update Wizard draft only; explicit Wizard save remains the persistence boundary.

Do not reopen the authority decision. Diagnose the narrowest secure implementation contract.

## 4. Literal read scope

Read only the bootstrap/governance files above and these paths:

1. `package.json`
2. `docs/estimate-wizard-ui-spec.json`
3. `src/app/estimates/new/page.tsx`
4. `src/components/estimates/wizard/production/ProductionEstimateWizard.tsx`
5. `src/components/estimates/wizard/EstimateWizard.tsx`
6. `src/components/estimates/wizard/useEstimateWizard.ts`
7. `src/components/estimates/wizard/wizard-types.ts`
8. `src/components/estimates/wizard/steps/Step1Customer.tsx`
9. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
10. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
11. `src/lib/ocr/wizard-customer-ocr-apply-core.ts`
12. `src/lib/ocr/wizard-customer-ocr-apply-core.test.ts`
13. `src/lib/ocr/customer-mapper.ts`
14. `src/lib/geo/postal-lookup.ts`
15. `src/components/customers/CustomerForm.tsx`
16. `src/components/settings/CompanySettingsForm.tsx`
17. `src/lib/supabase/server.ts`
18. `src/lib/customers/search-dealer-customers-action.ts`
19. `src/lib/numbering/get-next-document-number.ts`
20. `src/lib/products/import-gyeon-products-csv.ts`
21. `src/lib/products/import-gyeon-products-csv.test.ts`
22. `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
23. `supabase/tests/grant_rls_role_matrix.test.sql`
24. `supabase/tests/data_api_matrix.test.sql`
25. `supabase/tests/estimate_wizard_atomic_save.test.sql`

For migration path 22, read only the schema creation, relevant privilege/RLS/function patterns, and comments necessary to compare an internal-master design; do not treat the GYEON ordering business logic as reusable postal authority. If another path is essential, return `BLOCKED_READ_SCOPE` with the exact path and reason. Do not broaden scope yourself.

## 5. Required diagnosis

Return evidence-backed answers for all of the following:

1. Trace the current postal field and address field through the canonical Estimate Wizard. Prove why `src/lib/geo/postal-lookup.ts` does or does not run there, and identify the exact forward-lookup wiring gap.
2. Identify the narrowest authenticated server seam for browser-to-database lookup. No client-side `service_role`, direct unrestricted master-table access, anonymous access, or customer-address logging is allowed.
3. Recommend and justify either a non-exposed `private` schema or an equivalently fail-closed design. State every table/function privilege, RLS/Data API implication, search path, and caller role. New public-table exposure behavior must not be assumed.
4. Specify the exact master schema: stable row identity; normalized seven-digit postal code; prefecture, municipality, town/area and their kana/original forms needed from the official file; normalized comparison key; Japan Post special/split-area flags that affect ambiguity; source publication date; import batch/version; source checksum; imported timestamp; keys, checks, uniqueness, and indexes.
5. Define forward lookup and reverse lookup separately. Reverse normalization may use Unicode NFKC, supported hyphen normalization, and whitespace normalization only when its behavior is deterministic and tested.
6. Define the exact reverse-selection algorithm. At minimum, evaluate longest authoritative address-prefix matching and reduce the winning candidates to distinct postal codes. Auto-fill only when the winning set contains exactly one postal code; otherwise return an explicit no-match or ambiguous result without guessing.
7. Prove how building numbers, lot numbers, `以下に掲載がない場合`, multiple towns sharing one postal code, one town having multiple postal codes, and Japan Post split-area records are handled without false completion.
8. Specify the result type for `FOUND`, `NOT_FOUND`, `AMBIGUOUS`, `INVALID_INPUT`, and `MASTER_UNAVAILABLE`, including what may be shown to the operator and what must never overwrite existing input.
9. Specify controlled dataset lifecycle: official-source acquisition outside request handling, checksum verification, UTF-8 parse, staging/bulk load, validation counts, atomic promotion, version retention/rollback, idempotent rerun, update cadence, and recovery from partial import. Diagnose only; do not download/import data.
10. Specify minimal UI behavior for postal editing, OCR-address application, loading, no match, ambiguous match, and errors. No route or visual redesign is allowed.
11. Specify exact future source/migration/import/test allowlists and exact commands for pure normalization tests, server-action tests, migration/source-contract tests, pgTAP, isolated disposable DB verification, typecheck, and `git diff --check`.
12. Separate future gates explicitly: implementation candidate; local executable verification; literal stage/commit; push; disposable migration application and data import; hosted environment application/import; authenticated Preview; Ready; merge; production deployment.

## 6. Frozen and protected scope

- Do not change customer/vehicle identity, OCR provider behavior, one-scan apply, vehicle 型式, grade-manual policy, estimate persistence, pricing, discounts, PPF, coating, PDF, LINE, auth, tenant, routes, or UI design.
- Preserve exactly `SS/S/M/ML/L/LL/XL`; no eighth size or threshold change.
- No database write from OCR or lookup before explicit Wizard save.
- No real certificate PDF, customer name/address, personal data, downloaded Japan Post archive, generated postal dataset, secrets, or environment values may enter the diagnosis report, Git, fixtures, logs, or evidence.
- Never open/read/diff/copy `src/components/estimates/wizard/screens/ScreensPreview.tsx`; metadata only. Treat `supabase/migrations/20260801110110_line_link_tokens.sql`, `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`, and `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` as metadata-only.

## 7. Prohibited actions

No edits or file creation; no tests/typecheck/build/lint/dev server/browser/OCR upload; no network or Japan Post download; no database/Supabase/Auth/Storage/provider/Vercel/Preview/production access; no dependency/config/secret change; no Git or GitHub mutation; no stage/commit/push/Ready/merge/deploy; no retry after a blocker.

## 8. Required result

Return identifier `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R1_READ_ONLY_DIAGNOSIS_RESULT_V1` with exactly:

1. `VERDICT`: `IMPLEMENTATION_GOVERNANCE_READY`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, `BLOCKED_READ_SCOPE`, or `OWNER_DECISION_REQUIRED_IMPORT_OR_SCHEMA`
2. `IDENTITY_ANCESTRY_AND_SCOPE_PROOF`
3. `CURRENT_WIZARD_POSTAL_CALL_CHAIN_AND_ROOT_CAUSE`
4. `SERVER_AUTH_AND_DATA_API_BOUNDARY`
5. `MASTER_SCHEMA_KEYS_CONSTRAINTS_INDEXES_AND_PRIVILEGES`
6. `FORWARD_LOOKUP_CONTRACT`
7. `REVERSE_NORMALIZATION_MATCHING_AND_AMBIGUITY_CONTRACT`
8. `JAPAN_POST_SPECIAL_RECORD_HANDLING`
9. `IMPORT_VERSION_CHECKSUM_ATOMIC_PROMOTION_AND_ROLLBACK`
10. `UI_DRAFT_OVERWRITE_AND_PERSISTENCE_BOUNDARY`
11. `EXACT_FUTURE_IMPLEMENTATION_ALLOWLIST`
12. `EXACT_FUTURE_TEST_AND_DISPOSABLE_DB_PLAN`
13. `PROTECTED_AND_FROZEN_SCOPE_PROOF`
14. `SEPARATE_DELIVERY_AND_ENVIRONMENT_GATES`
15. `REMAINING_RISKS_OR_OWNER_DECISION`

Stop after the report. Do not implement.
