# Claude Directive — GDA Estimate Wizard OCR / Postal Clean Replacement R1

`GDA_ESTIMATE_WIZARD_OCR_POSTAL_CLEAN_REPLACEMENT_R1_IMPLEMENTATION_INSTRUCTION_V1`

## 1. Status and authority

- Phase: `GDA_ESTIMATE_WIZARD_OCR_POSTAL_CLEAN_REPLACEMENT_R1_GOVERNANCE`
- Current status: `LOCAL_GOVERNANCE_CANDIDATE_UNSTAGED_UNCOMMITTED`
- Product authority: Office AZ / Owner
- Specification and independent acceptance: MacBook Codex
- Future bounded implementation agent: MacBook Anthropic Claude Code
- Current authorization: create and locally verify exactly this directive, `GYEON_DA_COMPLETION_PLAN.md`, and `GYEON_DA_PHASE_RESULTS.md`.

This document does **not** authorize private-source transmission, Claude invocation, source edits, tests, database access, migration application, stage, commit, push, PR mutation, Ready conversion, merge, Preview, staging, production, provider access, or deployment. Each later action requires a separate explicit Owner gate.

## 2. Fixed identities

### Clean target base

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Exact base commit: `42617a4142814f17188ef8b537da0b48ae11e4d2`
- Exact base tree: `704660393c4c1f3b7a8df831d7c3d085331b9670`
- Proposed implementation branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`

### Technical source snapshot

- Historical source PR: `#48`
- Historical branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Exact source commit: `1b170827fd373cbbbc1044906fee6f65da8e310f`
- Exact source tree: `03eadeddfd0b5838a4502de0678334eb0925a74a`
- Merge base: `49a1dc4c396e50d5869f372a399c9ca1c10bc300`
- At diagnosis, PR #48 was 33 commits ahead and 31 commits behind current `main`; its 69-path delta was therefore unsuitable for direct merge or broad cherry-pick.

The source commit/tree above is a content reference only. It is not permission to modify PR #48, merge it, rebase it, or rerun its historical phases.

## 3. Accepted diagnosis and correction strategy

MacBook Codex classified PR #48 as `CHANGES_REQUIRED` for delivery, despite useful technical source being present:

1. The newest fixture repair commit correctly changes the malformed old-postal-code fixture from `99999,,0000007` to `99999,000,0000007`.
2. The required fresh result marker `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R4_FIXTURE_REPAIR_RESULT_V1` is absent.
3. No fresh never-used disposable suffix proves the corrected importer reaches phase-two `25/25`.
4. PR #48 carries 19 historical governance files that must not be replayed over current governance.
5. Current `main` and PR #48 overlap only in `GYEON_DA_COMPLETION_PLAN.md` and `GYEON_DA_PHASE_RESULTS.md`; no technical-source path overlaps were found.

The approved future correction is therefore a **clean replacement**, not history integration:

- start a new clean branch at the exact current-main commit/tree;
- materialize the exact final PR #48 technical state for the 50 paths in section 4 only;
- do not cherry-pick the 33 historical commits;
- do not merge or rebase the PR #48 branch;
- do not copy any of the 19 excluded historical governance paths in section 5;
- make no design or source inference beyond the exact PR #48 final technical blobs;
- stop if any listed source blob is unavailable or cannot be proven identical.

## 4. Future implementation allowlist — exactly 50 paths

Only a later separately authorized Claude implementation may create or replace these exact paths:

1. `docs/master_specification/CATALOG_MANIFEST.md`
2. `docs/master_specification/GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DISPOSABLE_DB_VERIFICATION_PLAN.md`
3. `package-lock.json`
4. `package.json`
5. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
6. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`
7. `scripts/e2e/gda-estimate-postal-master-r5/config.toml`
8. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`
9. `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs`
10. `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql`
11. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
12. `scripts/postal-master/import-japan-post.test.ts`
13. `scripts/postal-master/import-japan-post.ts`
14. `src/app/estimates/new/page.tsx`
15. `src/components/estimates/wizard/EstimateWizard.tsx`
16. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
17. `src/components/estimates/wizard/production/ProductionEstimateWizard.tsx`
18. `src/components/estimates/wizard/steps/Step1Customer.tsx`
19. `src/components/estimates/wizard/steps/Step2Vehicle.test.tsx`
20. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
21. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
22. `src/components/estimates/wizard/steps/postal-master-apply.test.ts`
23. `src/components/estimates/wizard/steps/postal-master-apply.ts`
24. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts`
25. `src/components/estimates/wizard/validity/wizard-step-validity.ts`
26. `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx`
27. `src/components/vehicle-registration/VehicleRegistrationUpload.tsx`
28. `src/lib/ai/ocr-config.ts`
29. `src/lib/geo/jp-postal-master-actions.test.ts`
30. `src/lib/geo/jp-postal-master-actions.ts`
31. `src/lib/geo/jp-postal-master-contract.test.ts`
32. `src/lib/geo/jp-postal-master-contract.ts`
33. `src/lib/geo/jp-postal-master-csv.test.ts`
34. `src/lib/geo/jp-postal-master-csv.ts`
35. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
36. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts`
37. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts`
38. `src/lib/vehicle-registration/ocr-customer-mapping.test.ts`
39. `src/lib/vehicle-registration/ocr-customer-mapping.ts`
40. `src/lib/vehicle-registration/ocr-dimensions-contract.test.ts`
41. `src/lib/vehicle-registration/ocr-test-cases.ts`
42. `src/lib/vehicle-registration/ocr.ts`
43. `src/lib/vehicle-registration/pdf-model-text-extractor.test.ts`
44. `src/lib/vehicle-registration/pdf-model-text-extractor.ts`
45. `src/lib/vehicle-registration/vehicle-normalize.ts`
46. `supabase/migrations/20260901001246_jp_postal_master.sql`
47. `supabase/tests/catalog_manifest.test.sql`
48. `supabase/tests/data_api_matrix.test.sql`
49. `supabase/tests/grant_rls_role_matrix.test.sql`
50. `supabase/tests/jp_postal_master_rpc.test.sql`

No wildcard, directory-wide copy, formatter sweep, generated-file sweep, rename, or adjacent cleanup is allowed.

## 5. Explicitly excluded PR #48 governance paths — exactly 19 paths

The following historical records are not implementation source and must not be copied, replaced, staged, or committed in the clean replacement:

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_CHASSIS_UI_R6_IMPLEMENTATION.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_CUSTOMER_MARKER_POSTAL_R7_READ_ONLY_DIAGNOSIS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_MANUAL_MODEL_GRADE_R1_IMPLEMENTATION.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R3_READ_ONLY_DIAGNOSIS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4_IMPLEMENTATION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_IMPLEMENTATION.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_READ_ONLY_DIAGNOSIS.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_VEHICLE_MASTER_RESOLUTION_R1_READ_ONLY_DIAGNOSIS.md`
9. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R1_READ_ONLY_DIAGNOSIS.md`
10. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R2_IMPLEMENTATION.md`
11. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R3_READ_ONLY_REPAIR_DIAGNOSIS.md`
12. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R4_IMPLEMENTATION.md`
13. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_HARNESS_IMPLEMENTATION.md`
14. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R2_PGTAP_PLAN_REPAIR.md`
15. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R3_HARNESS_HASH_SYNC.md`
16. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_R4_FIXTURE_REPAIR.md`
17. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_VEHICLE_REGISTRATION_OCR_GRADE_MANUAL_ONLY_R1_IMPLEMENTATION.md`
18. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
19. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

The two current governance files are maintained only by MacBook Codex through the active clean-replacement phase and are never sourced from PR #48.

## 6. Required product behavior

The future candidate must preserve the exact accepted behavior represented by the 50-path source snapshot:

1. One confirmed OCR review applies customer and vehicle values through one combined store update, so the user does not need a second OCR pass.
2. Customer mapping accepts usable owner/user names and addresses, including supported marker and directional phrases.
3. Redaction markers such as `***` are ignored and never treated as real customer data. The system does not attempt to decode or reconstruct masked text.
4. OCR `maker` fills manufacturer.
5. The certificate's printed `型式` fills the application's `vehicleCode` field after NFKC normalization.
6. Chassis number fills the application's chassis/VIN field and remains visible in the review/apply flow.
7. Grade stays blank for manual input. No AI grade inference or slow external lookup is introduced.
8. Car model name uses the OCR `vehicle_name` value only. If the certificate/OCR returns only a maker name, model name may remain blank; this phase does not infer a model from 型式 and does not add a paid or external vehicle master.
9. The PDF positioned-text fallback extracts a bare printed 型式 locally, without an external provider.
10. Postal-code-to-address and OCR-address-to-postal planners remain fail closed and never overwrite user data from ambiguous or missing results.
11. Postal auto-fill becomes operational only after the new migration and the official Japan Post master data have been applied and imported in a separately authorized environment gate.

## 7. Protected paths

These paths are metadata-only throughout governance, implementation, review, testing, and Git delivery:

1. `src/components/estimates/wizard/screens/ScreensPreview.tsx` — expected `100644 c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
2. `src/components/ScreensPreview.tsx` — expected `ABSENT`
3. `supabase/migrations/20260801110110_line_link_tokens.sql` — expected `100644 accd22345054cc44f89156fd78eaba6dfe4242a4`
4. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — expected `100644 32fda49583ae1217bc13711784ad8fa31744726c`
5. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — expected `100644 fe3c80f22fd80dcbfab076082473216dda582c14`

Do not open, read, diff, copy, transmit, stage, or modify protected content. Record only pathname, presence, mode, blob identity, and clean Git state.

## 8. Future implementation gate

After separate explicit Owner authorization, Claude must:

1. Read `AGENTS.md`, this completion plan, the latest ledger entry, and this directive first.
2. Prove the checked-out clean base commit/tree exactly matches section 2.
3. Prove index and worktree are clean before materializing source.
4. Confirm the exact 50-path allowlist and five protected metadata-only paths.
5. Obtain each allowed path from exact source commit `1b170827fd373cbbbc1044906fee6f65da8e310f` and make the target path byte-identical to that source blob.
6. Make no semantic edit beyond reproducing those exact final technical blobs.
7. Stop on any unavailable object, unexpected path, source/target ambiguity, conflict, or protected-path contact.
8. Return an uncommitted candidate. Claude must not stage, commit, push, create or mutate a PR, merge, or deploy.

Private source may be sent to Anthropic Claude Code only after the Owner explicitly authorizes the exact 50-file transmission and bounded edit/test action.

## 9. Independent source acceptance required before Git delivery

MacBook Codex must independently prove:

- exactly the 50 paths in section 4 are changed relative to the clean base;
- all 50 target blobs or SHA-256 values match the exact PR #48 source snapshot;
- none of the 19 excluded governance paths is imported from PR #48;
- all protected metadata remains unchanged;
- `git diff --check` passes;
- the focused source tests cover one combined customer/vehicle apply, customer markers/directional phrases, 型式 to `vehicleCode`, visible/applicable chassis number, grade absent/manual, positioned-PDF 型式 extraction, and postal planners/contracts/actions/CSV/importer;
- project typecheck and build pass, or a separately reviewed pre-existing environment-only blocker is reproduced without expanding scope.

Stage, local commit, normal push, Draft PR creation, Ready conversion, merge, and deployment remain separate explicit gates after acceptance.

## 10. Fresh disposable database acceptance required later

A source-only or historical test result is not enough. After source delivery and another explicit Owner authorization, one fresh never-used disposable suffix must prove all of the following:

- exact committed migration replay;
- postal pgTAP `75/75`;
- runtime pgTAP `20/20`;
- real local Auth/PostgREST `9/9`;
- importer phase one `3/3`;
- importer phase two `25/25`, including the corrected `99999,000,0000007` fixture;
- database lint and required evidence capture;
- cleanup, zero residue, runtime stop, secret scan, and retained SHA-256 evidence integrity.

Any failed suffix is burned and may not be repaired or reused into acceptance. No shared, staging, or production database may substitute for this disposable gate.

## 11. Authenticated Preview field acceptance required later

Only after source acceptance, Git delivery, migration/environment authorization, and a valid Preview deployment, verify with a genuine authenticated request/session:

- one OCR scan fills usable customer name and address;
- address-to-postal and postal-to-address work after the authoritative postal data exists;
- manufacturer is applied;
- printed 型式 is applied to `vehicleCode`;
- chassis number is applied;
- grade remains blank and manually editable;
- model name remains blank when OCR provides no value beyond manufacturer, and this is presented as a known limitation rather than a failure claim.

Do not claim E3 or production completion from local source, unit tests, or Vercel build checks alone.

## 12. Required future result

Claude's future result must use:

`GDA_ESTIMATE_WIZARD_OCR_POSTAL_CLEAN_REPLACEMENT_R1_IMPLEMENTATION_RESULT_V1`

and report:

- verdict: `CANDIDATE_READY_FOR_CODEX_REVIEW` or `BLOCKED`;
- exact base and source commit/tree identities;
- exact 50 changed paths and zero extra paths;
- per-path source blob and target SHA-256 evidence;
- protected metadata-only evidence;
- exact commands, counts, exit codes, and failures;
- index/worktree state;
- explicit flags for private transmission, DB, Supabase, provider, Preview, staging, production, deployment, stage, commit, push, PR mutation, Ready, and merge;
- known limitations and rollback boundary.

Stop after returning the result. Do not take the next gate automatically.
