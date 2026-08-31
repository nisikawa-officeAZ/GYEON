# GDA_ESTIMATE_WIZARD_OCR_VEHICLE_MASTER_RESOLUTION_R1_READ_ONLY_DIAGNOSIS

Result marker: `GDA_ESTIMATE_WIZARD_OCR_VEHICLE_MASTER_RESOLUTION_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Authority and objective

Perform one bounded read-only diagnosis. Determine the exact contract needed to resolve reviewed Japanese vehicle-registration evidence into a vehicle name and grade. Generative AI is not the source of truth. It may normalize labels and rank candidates returned by an authoritative current vehicle master only.

Repository/worktree:

- branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- fixed HEAD: `501ede8c06b0c397a47996f9dfe0833f8779376c`
- fixed tree: `fda91137ce537f5a6f60f82d229b6aa1ac6c13e6`
- existing accepted eight-path single-scan candidate: dirty, unstaged, uncommitted, frozen against mutation

## Mandatory first reads

Read these files completely in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. the latest GDA-2A OCR entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. this directive

Then state the active phase, fixed base, frozen dirty candidate, read scope, protected paths, prohibitions, and responsibility boundary before diagnosis.

## Literal content read scope

Only these paths may be opened for content:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_VEHICLE_MASTER_RESOLUTION_R1_READ_ONLY_DIAGNOSIS.md`
5. `docs/VEHICLE_REGISTRATION_OCR.md`
6. `docs/master_specification/04_Database_Architecture.md`
7. `docs/master_specification/07_Feature_Specifications.md`
8. `docs/master_specification/09_PHASE_STATUS.md`
9. `src/lib/vehicle-registration/vehicle-registration-types.ts`
10. `src/lib/vehicle-registration/ocr.ts`
11. `src/lib/vehicle-registration/vehicle-normalize.ts`
12. `src/lib/vehicle-registration/ocr-quality.ts`
13. `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx`
14. `src/components/estimates/wizard/OcrEntry.tsx`
15. `src/lib/ocr/vehicle-mapper.ts`
16. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts`
17. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
18. `src/components/estimates/wizard/wizard-types.ts`
19. `src/components/estimates/wizard/draft/wizard-draft-types.ts`
20. `src/components/estimates/wizard/save/estimate-save-dto.ts`
21. `src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts`
22. `src/components/estimates/wizard/save/estimate-save-validation.ts`
23. `supabase/migrations/001_create_core_tables.sql`
24. `supabase/migrations/036_update_vehicles_schema.sql`
25. `supabase/migrations/102_estimate_wizard_atomic_save.sql`

All other content is out of scope. Repository-wide searches may return path names and matching line numbers only; do not open additional content without a superseding Codex instruction.

## Protected metadata-only paths

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

For these paths, inspect only path, mode, blob hash, and Git status. Never open, read, diff, copy, stage, or modify their content.

## Required diagnosis

1. Distinguish and trace all four concepts: `型式`, `型式指定番号`, four-digit `類別区分番号`, and three-digit registration-plate `分類番号`. Identify any current field collision or misleading name/comment.
2. Prove what the current OCR prompt requests, what the sanitizer retains, what the operator reviews, and what the wizard and save path consume.
3. State whether `類別区分番号` exists end-to-end today. Do not infer it from the plate classification number.
4. State whether the repository contains a current, licensed, authoritative vehicle master/resolver. Identify source evidence or return `OWNER_DECISION_REQUIRED_VEHICLE_MASTER_AUTHORITY`.
5. Define a fail-closed proposed resolver input/output contract with `EXACT_MATCH`, `MULTIPLE_CANDIDATES`, `NO_MATCH`, `INSUFFICIENT_EVIDENCE`, and `PROVIDER_UNAVAILABLE`.
6. Explain how operator-entered vehicle name/grade remain intact, when human confirmation is required, and which values may be persisted only after explicit save.
7. Return the smallest future write allowlist and focused test files. Separately identify any new migration, provider/API, data-license, secret/config, privacy, and per-request cost decision.
8. Identify conflicts between the current OCR documentation and executable source.

## Prohibitions

- No file creation, edit, formatting, deletion, rename, stage, commit, push, PR mutation, Ready, merge, or deployment.
- No executable tests, package manager, install, dependency/config/environment change, generated artifact, or build.
- No database, Supabase, Docker, Colima, Auth, Storage, provider, browser, web search/fetch, API, or production access.
- No source inference that treats AI knowledge or a public search result as the vehicle authority.
- Do not repair anything and do not broaden the read scope.

## Required result

Return exactly one report headed by the result marker. Include:

- verdict: `READY_FOR_OWNER_DATA_AUTHORITY_DECISION`, `READY_FOR_BOUNDED_IMPLEMENTATION_WITH_EXISTING_AUTHORITY`, or `BLOCKED_SCOPE_CONFLICT`
- repository identity and frozen-dirty-candidate proof
- field-semantics table and exact current gaps
- current end-to-end call chain
- authoritative-data finding
- proposed fail-closed resolver contract
- persistence/migration/provider/license/security/cost decisions
- smallest literal future write allowlist
- exact focused test plan
- protected-path and zero-mutation proof

If no approved current vehicle master/resolver exists, the report must include `OWNER_DECISION_REQUIRED_VEHICLE_MASTER_AUTHORITY` and must not label the phase implementation-ready.
