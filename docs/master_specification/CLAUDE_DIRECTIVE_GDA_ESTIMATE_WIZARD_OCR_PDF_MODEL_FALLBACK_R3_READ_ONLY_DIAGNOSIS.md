# Claude Directive — GDA Estimate Wizard OCR PDF Model Fallback R3 Read-Only Diagnosis

## 1. Status and authority

- Directive ID: `GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R3_READ_ONLY_DIAGNOSIS_V2`
- Result ID: `GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R3_READ_ONLY_DIAGNOSIS_RESULT_V2`
- Status: R3-G2 governance correction candidate; not executable until this correction is committed, normally pushed, and a later owner-approved dispatch fixes the exact dispatch HEAD and tree outside this file.
- Product authority: Office AZ / owner.
- Specification and independent acceptance: MacBook Codex.
- Diagnosis agent after a later separate gate: Anthropic Claude Code.
- Diagnosis only. Implementation and executable verification are not authorized.

PR #48 comment `5478848763` preceded this Git governance and named the wrong protected path. Its `eyes` reaction is not a result. Do not treat that invocation, or any later unbound response to it, as implementation authority. A corrected dispatch must reference the committed version of this directive.

## 2. Fixed source baseline and dispatch binding

- Repository: `nisikawa-officeAZ/GYEON`
- PR: `#48`, required `OPEN/Draft`
- Base: `main` at `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Source baseline commit: `3d75d3156b3c11f5968a8126ca7b620b30f32882`
- Source baseline tree: `90011cf90b07e7488963e393a23b4a69da9f690e`

The later owner-approved dispatch must state exact `DISPATCH_HEAD` and `DISPATCH_TREE` values. The checked-out HEAD and tree must equal those values, the source baseline commit must be an ancestor of `DISPATCH_HEAD`, and every path changed from the source baseline through `DISPATCH_HEAD` must be one of these governance paths only:

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R3_READ_ONLY_DIAGNOSIS.md`

This directive intentionally does not contain its own commit hash. If the dispatch omits the exact HEAD/tree, any identity differs, ancestry fails, or another path changed after the source baseline, stop with `BLOCKED_CANDIDATE_DRIFT`. Do not guess, fetch a replacement branch, or broaden scope.

## 3. Required first reads

Read these Git authorities completely before diagnosis:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. Latest relevant entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. This directive

## 4. Owner-observed sanitized evidence

Two independent Preview uploads on the fixed candidate returned nonblank maker and chassis evidence but an empty AI `model`, leaving the Wizard 型式 blank. The digital PDF text layer contains a distinct printed value `型式 ６ＢＡ－ＪＧ３`.

This sanitized observation is the complete runtime evidence. Do not request, open, copy, transmit, reproduce, or store the real PDF, customer identity, address, registration number, chassis number, or any other personal data.

## 5. Literal read allowlist

Beyond the required first reads, read only these existing paths:

1. `package.json`
2. `package-lock.json`
3. `src/lib/ai/ocr-config.ts`
4. `src/lib/vehicle-registration/actions.ts`
5. `src/lib/vehicle-registration/ocr.ts`
6. `src/lib/vehicle-registration/ocr-dimensions-contract.test.ts`
7. `src/lib/vehicle-registration/ocr-quality.ts`
8. `src/lib/vehicle-registration/vehicle-normalize.ts`
9. `src/lib/vehicle-registration/vehicle-registration-types.ts`
10. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts`
11. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts`

If another path is essential, stop with `BLOCKED_READ_SCOPE` and report the exact path and reason. Do not read it.

## 6. Protected and frozen scope

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` is pathname/mode/blob/status metadata only. Never open, read, diff, copy, hash from working-tree contents, transmit, stage, or modify it.
- `supabase/migrations/20260801110110_line_link_tokens.sql` is metadata only.
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` is metadata only.
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` is metadata only.
- Every path outside the required first reads and the literal read allowlist is frozen.

## 7. Diagnosis questions

1. Prove the exact call chain from PDF input to server action, provider request, JSON `model`, sanitizer, review selection, Wizard mapper, and `vehicleCode`.
2. Explain why prompt wording cannot guarantee that a printed 型式 reaches the AI result.
3. Determine whether the fixed repository already contains a server-compatible PDF text-layer extraction dependency or deterministic fallback. Source presence is not permission to add or upgrade a package.
4. Recommend the smallest server-only, zero-per-request-fee fallback for digital PDFs that extracts only the value explicitly associated with the printed `型式` label.
5. Confirm or correct this precedence: explicit digital-PDF text-layer 型式 > nonblank AI `model` > omitted/manual.
6. Define fail-closed behavior for missing, ambiguous, malformed, conflicting, scanned/image-only, encrypted, oversized, timed-out, or parser-failed input. No failure may erase operator-entered values.
7. Prove that `原動機の型式`, `型式指定番号`, and `類別区分番号` cannot be substituted for `型式`.
8. Keep images and scanned PDFs on the existing AI path. Grade remains manual. Vehicle name remains manual unless the certificate itself supplies a distinct nonblank name.
9. Identify the exact smallest future implementation allowlist and exact focused tests, including fixture-free pure parser cases for full-width `６ＢＡ－ＪＧ３` and hostile neighboring labels.
10. Assess Next.js 15, Vercel Node runtime, package size, cold-start, license, privacy, and cost implications. Do not install or contact anything.

If the fallback requires a new dependency, provider, API, dataset, secret, environment variable, database, migration, license commitment, or nonzero per-request fee, return `OWNER_DECISION_REQUIRED_PDF_TEXT_EXTRACTION_AUTHORITY`. Do not present it as implementation-ready.

## 8. Absolute prohibitions

- No file edit, creation, deletion, rename, formatting, or generated artifact.
- No test, typecheck, build, lint, dev server, browser, OCR upload, package install, or dependency resolution.
- No database, Supabase, Storage, provider, external network, Vercel, Preview, production, secret, or environment access.
- No Git stage, commit, push, branch, rebase, amend, force-push, Ready, merge, deployment, or PR metadata/comment action.
- No real PDF or personal-data access or transmission.
- No subagent and no second invocation.

## 9. Required result

Return one report to MacBook Codex with:

1. `RESULT_ID`: `GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R3_READ_ONLY_DIAGNOSIS_RESULT_V2`
2. `VERDICT`: `IMPLEMENTATION_READY`, `OWNER_DECISION_REQUIRED_PDF_TEXT_EXTRACTION_AUTHORITY`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, or `BLOCKED_READ_SCOPE`
3. Exact PR/branch/dispatch HEAD/tree, source-baseline ancestry, and governance-only delta proof
4. Proven call chain with file and line evidence
5. Root cause
6. Existing dependency/fallback finding
7. Recommended deterministic fallback and precedence
8. Fail-closed and distinct-field contract
9. Exact future implementation allowlist
10. Exact future focused test commands and cases
11. Runtime/package/license/privacy/cost assessment
12. Protected and unrelated scope proof
13. Explicit confirmation that zero files, Git state, DB/provider/deployment state, and personal data were changed or accessed

Stop after the report. Codex must independently accept the result before any implementation governance is authored.
