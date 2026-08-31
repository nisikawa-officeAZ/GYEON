# Claude Directive — GDA Estimate Wizard OCR PDF Model Fallback R4 Implementation

## 1. Status and authority

- Directive ID: `GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4_IMPLEMENTATION_V1`
- Result ID: `GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4_IMPLEMENTATION_RESULT_V1`
- Status: governance candidate; not executable until committed, normally pushed, and separately authorized by the owner with exact dispatch HEAD/tree.
- Product and dependency authority: Office AZ / owner.
- Specification and independent acceptance: MacBook Codex.
- Implementation agent after a later separate gate: Anthropic Claude Code.
- This directive does not authorize stage, commit, push, PR mutation, Preview, Ready, merge, deployment, database/provider access, or real-PDF transmission.

## 2. Fixed source baseline and dispatch binding

- Repository: `nisikawa-officeAZ/GYEON`
- PR: `#48`, required `OPEN/Draft`
- Base: `main` at `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Source baseline commit: `51c0d539a4cfa2741bc78170ca763c245de0c543`
- Source baseline tree: `7392a03e12d31eb102cb20983a679b8df5d8b8e6`

The later owner-approved dispatch must state exact `DISPATCH_HEAD` and `DISPATCH_TREE`. The checked-out values must match, the source baseline must be an ancestor of `DISPATCH_HEAD`, and only these three governance paths may differ between the source baseline and dispatch HEAD:

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4_IMPLEMENTATION.md`

This file intentionally does not contain its own commit hash. Missing dispatch binding, mismatch, ancestry failure, or another changed path requires `BLOCKED_CANDIDATE_DRIFT` and an immediate stop.

## 3. Required first reads

Read completely before action:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. Latest relevant entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. This directive

Then read only the implementation/read paths listed below. If another path is essential, stop with `BLOCKED_READ_SCOPE` and report it without reading it.

## 4. Owner-selected dependency

- Add exactly `"unpdf": "1.8.1"` using npm save-exact behavior.
- License: MIT.
- Runtime requirement: Node.js `>=22`; DealerOS Vercel project is configured for Node.js `24.x`.
- The bundled serverless PDF.js build is used locally inside the existing Node server action.
- `@napi-rs/canvas` is an optional peer and must not be installed because this phase performs text extraction only.
- Do not add `pdf-parse`, `pdfjs-dist`, another PDF package, a native renderer, an external API/provider, a secret, an environment variable, a database object, a migration, or Vercel configuration.

Official selection evidence:

- `https://www.npmjs.com/package/unpdf/v/1.8.1`
- `https://github.com/unjs/unpdf`

Do not contact those URLs during implementation. The dependency may be downloaded only by the separately authorized exact npm install command after candidate identity passes.

## 5. Literal read scope

Beyond the required first reads, read only:

1. `package.json`
2. `package-lock.json`
3. `src/lib/ai/ocr-config.ts`
4. `src/lib/vehicle-registration/actions.ts`
5. `src/lib/vehicle-registration/ocr.ts`
6. `src/lib/vehicle-registration/ocr-dimensions-contract.test.ts`
7. `src/lib/vehicle-registration/ocr-quality.ts`
8. `src/lib/vehicle-registration/vehicle-registration-types.ts`
9. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts`
10. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts`
11. `next.config.ts`

The two new extractor paths may be created and then read as part of the write scope below.

## 6. Exact write allowlist

Edit or create exactly these five paths and no others:

1. `package.json`
2. `package-lock.json`
3. `src/lib/vehicle-registration/pdf-model-text-extractor.ts` (new)
4. `src/lib/vehicle-registration/pdf-model-text-extractor.test.ts` (new)
5. `src/lib/vehicle-registration/ocr.ts`

Use the package manager only for the exact pinned dependency operation needed to update paths 1 and 2. `node_modules` is an untracked dependency workspace and must not be staged, copied into evidence, or reported as a source path.

## 7. Frozen implementation contract

1. Dynamically load `unpdf` only for `application/pdf`. Image, HEIC, JPEG, PNG, and WebP behavior remains byte-for-byte outside necessary import/call wiring.
2. Start bounded local PDF text extraction concurrently with the existing OpenAI OCR request. Do not serialize it ahead of the provider call. Local parsing may consume at most 3 seconds and must not extend the normal path beyond that hard budget.
3. Run local extraction for every eligible digital PDF, not only when AI `model` is blank.
4. Precedence is exactly: unambiguous explicit PDF text-layer `型式` > nonblank sanitized AI `model` > omitted/manual.
5. Local parser eligibility is at most 5 MiB and 3 pages. Larger or page-excess PDFs skip local parsing and continue the existing AI flow.
6. Scanned/image-only, encrypted, malformed, ambiguous, conflicting, timed-out, parser-failed, or no-label PDFs return no local match. They must not fail or delay the existing AI result beyond the bounded budget.
7. Extract text only. Do not render pages or extract images. Disable PDF JavaScript evaluation, bound image allocation defensively, destroy/release loading task and document resources, and never log raw PDF text, model candidates, file bytes, or personal data.
8. Match only a bare printed `型式` label and its adjacent value. Never treat `原動機の型式`, `型式指定番号`, or `類別区分番号` as 型式. Multiple identical candidates may resolve once; multiple different candidates are ambiguous and return no local match.
9. Preserve the selected raw printed value for review. Do not NFKC-normalize inside the extractor or OCR sanitizer. The accepted Wizard mapper remains the only NFKC boundary before `vehicleCode`.
10. Empty or failed extraction never clears AI or operator-entered values. No vehicle-name or grade inference is added; grade and vehicle name remain manual under the accepted contract.
11. No real certificate PDF or personal data may be requested, opened, transmitted to Claude, written to Git, embedded in a fixture, logged, or stored in generated evidence.

## 8. Required implementation shape

- Put all byte limits, page limits, timeout handling, resource cleanup, text-item normalization, label discrimination, ambiguity handling, and precedence selection in `pdf-model-text-extractor.ts` as small testable functions.
- `ocr.ts` must only start the bounded PDF extraction promise, run the existing provider call, and apply the selected local result over sanitized AI `model` according to the frozen precedence.
- Do not change the public OCR result type, Wizard mapper, upload action, database persistence, UI, prompts, pricing, retry policy, or unrelated normalization.
- Keep package-lock integrity and prove the installed graph contains exactly `unpdf@1.8.1` with no `pdf-parse` and no newly installed `@napi-rs/canvas`.

## 9. Required tests

The new extractor test must use synthetic in-memory strings/bytes only and cover:

1. Bare `型式` with raw full-width `６ＢＡ－ＪＧ３`.
2. `原動機の型式` adjacent to a valid bare `型式`.
3. `型式指定番号` adjacent to a valid bare `型式`.
4. `類別区分番号` adjacent to a valid bare `型式`.
5. Same-value duplicate candidates accepted once.
6. Different duplicate candidates rejected as ambiguous.
7. Missing label and scanned/no-text behavior.
8. Encrypted, corrupt, oversized, page-excess, and timeout behavior.
9. Raw full-width preservation without NFKC.
10. Explicit local PDF value overriding a conflicting nonblank AI model.
11. AI model retained when local extraction has no match.
12. Both absent produces omission, never an empty overwrite.

Run only:

```bash
node --import tsx --test src/lib/vehicle-registration/pdf-model-text-extractor.test.ts src/lib/vehicle-registration/ocr-dimensions-contract.test.ts src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts
npm run typecheck
git diff --check
```

If the isolated worktree lacks dependencies, stop and report the exact environment blocker. Do not install or copy any dependency other than the owner-selected exact `unpdf@1.8.1` operation authorized by the later dispatch.

## 10. Protected and frozen scope

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` is pathname/mode/blob/status metadata only. Never open, read, diff, copy, hash from working-tree contents, transmit, stage, or modify it.
- `supabase/migrations/20260801110110_line_link_tokens.sql` is metadata only.
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` is metadata only.
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` is metadata only.
- Every path outside the required first reads, literal read scope, and exact write allowlist is frozen.

## 11. Absolute prohibitions

- No real PDF, personal-data, OCR upload, browser, OpenAI/provider, DB, Supabase, Storage, Preview, production, secret, or environment access.
- No source path outside the exact five-path write allowlist.
- No test beyond the three stated commands.
- No stage, commit, push, branch, rebase, amend, force-push, PR comment/metadata, Ready, merge, or deployment.
- No subagent and no second invocation.

## 12. Required result

Return one report to MacBook Codex with:

1. `RESULT_ID`: `GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4_IMPLEMENTATION_RESULT_V1`
2. `VERDICT`: `PASS`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, `BLOCKED_READ_SCOPE`, or `BLOCKED_ENVIRONMENT`
3. Exact PR/branch/dispatch HEAD/tree, source-baseline ancestry, and governance-only delta proof
4. Exact five changed paths and no others
5. Dependency/lock proof for `unpdf@1.8.1`, no `pdf-parse`, and no newly installed `@napi-rs/canvas`
6. Implementation summary proving concurrency, limits, cleanup, field discrimination, precedence, and no-erasure behavior
7. Test commands, counts, pass/fail, exit codes, and `git diff --check`
8. SHA-256 for all five changed source/package paths
9. Protected/unrelated scope and clean-index proof
10. Explicit confirmation that no real PDF/personal data, provider, DB/Supabase, Preview/production, Git delivery, PR mutation, or second invocation occurred

Stop after the report. Codex independently reviews the full five-path diff and reruns verification before any Git delivery gate.
