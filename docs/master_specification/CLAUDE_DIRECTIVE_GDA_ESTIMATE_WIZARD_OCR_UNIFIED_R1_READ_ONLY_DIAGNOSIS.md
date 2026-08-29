# Claude Directive — GDA Estimate Wizard OCR Unified R1 Read-only Diagnosis

Directive ID: `GDA_ESTIMATE_WIZARD_OCR_UNIFIED_R1_READ_ONLY_DIAGNOSIS_V1`

## 1. Authority and phase

This directive authorizes one bounded **read-only diagnosis only** for phase
`GDA-2A-OCR-R1`. It does not authorize source, test, document, dependency, Git, GitHub, database,
Supabase, provider, environment, Preview, Ready, merge, deployment, or production mutation.

Required bootstrap reads, in order:

1. `AGENTS.md` — complete
2. `CLAUDE.md` — complete
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` — complete
4. Latest entries of `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`, including this phase
5. This directive — complete
6. The newest non-superseded MacBook-Codex instruction on the coordination Draft PR, whose phase,
   branch, base commit, and base tree must match this directive

If any identity or boundary differs, return `BLOCKED_BASE_OR_GOVERNANCE` without further inspection.

## 2. Exact repository identity

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Required fixed base commit: `48de96bbf5518be3fd7fd8a3964dfd7975716165`
- Required fixed base tree: `e25590d276237f643e9b1408e6c47d192388de07`
- Coordination branch: `agent/estimate-wizard-ocr-unified-r1`
- Execution HEAD/tree: supplied by MacBook Codex in the Draft-PR instruction after the exact
  three-document governance commit is pushed
- Required committed delta from base to execution HEAD: exactly the three governance paths in §6

## 3. Confirmed symptom and required diagnosis

The product owner observed that one Step-1 vehicle-registration OCR scan reflects customer data but
does not populate vehicle data on Step 2. Determine whether the source proves this exact defect and
return an implementation-ready correction boundary without editing anything.

Prove or refute all of the following:

1. Step 1 receives one reviewed `VehicleRegistrationOcrResult` but applies only the existing customer
   OCR patch, dropping vehicle fields before Step 2.
2. Step 2 contains vehicle-field and 3M mapping that runs only after its own second OCR apply event.
3. The wizard host owns transient 3M recommendation state, and one Step-1 apply currently has no
   path to update both the canonical customer/vehicle draft and that recommendation.
4. Sequential `api.updateStore(...)` calls in one event can be unsafe because the hook callback is
   closed over one draft; determine whether one combined canonical patch is required.
5. The Step-2 vehicle-name hint conflicts with the OCR result contract and current mapper.
6. The existing save mapper persists the reflected new-vehicle draft only after explicit save and
   does not require any OCR-side DB write.

## 4. Literal read scope

Read only these paths plus the five bootstrap/governance documents named in §1:

1. `src/app/estimates/new/page.tsx`
2. `src/components/estimates/wizard/production/ProductionEstimateWizard.tsx`
3. `src/components/estimates/wizard/EstimateWizard.tsx`
4. `src/components/estimates/wizard/OcrEntry.tsx`
5. `src/components/estimates/wizard/useEstimateWizard.ts`
6. `src/components/estimates/wizard/wizard-types.ts`
7. `src/components/estimates/wizard/steps/Step1Customer.tsx`
8. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
9. `src/components/estimates/wizard/steps/existing-entity-selection.ts`
10. `src/components/estimates/wizard/steps/existing-entity-selection.test.tsx`
11. `src/components/estimates/wizard/bridge/ew-ui1-controller.ts`
12. `src/components/estimates/wizard/bridge/ew-ui1-controller.test.ts`
13. `src/components/estimates/wizard/validity/wizard-step-validity.ts`
14. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts`
15. `src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts`
16. `src/components/estimates/wizard/save/estimate-save-validation.ts`
17. `src/lib/ocr/wizard-customer-ocr-apply-core.ts`
18. `src/lib/ocr/wizard-customer-ocr-apply-core.test.ts`
19. `src/lib/ocr/vehicle-mapper.ts`
20. `src/lib/vehicle-registration/vehicle-registration-types.ts`
21. `src/lib/vehicles/body-size-estimate.ts`
22. `src/lib/vehicles/body-size-estimate.test.ts`

Do not follow an import, caller, test, or reference outside this list. If one additional read path is
essential, return `BLOCKED_READ_SCOPE` with the exact path and reason; do not open it.

## 5. Frozen behavior to preserve

- One reviewed OCR result must be sufficient to reflect customer and vehicle draft data.
- Use the existing authoritative customer OCR mapping; do not reimplement owner/user selection.
- Apply only non-blank vehicle values; absent/blank values leave existing draft text unchanged.
- Expected vehicle mapping under diagnosis:
  - `maker -> maker`
  - `vehicle_name -> model`
  - `grade -> grade`
  - `model -> vehicleCode`
  - `displacement -> displacement`
  - `chassis_number -> vin`
  - `first_registration_date -> firstRegYearMonth`
  - `registration_date -> registrationDate`
  - `inspection_expiry_date -> inspectionExpiry`
  - `color -> color`
  - non-blank plate fragments joined in official display order -> `plateNumber`
- OCR dimensions use the existing estimator and exactly seven sizes: `SS, S, M, ML, L, LL, XL`.
  `XXL`, fallback conversion, aliases, and threshold redesign are forbidden.
- Recommended size remains presentation evidence only: blue recommendation, amber adjacent sizes,
  and no automatic write/change to `confirmedSize`.
- Step-2 OCR may remain as explicit rescan/correction but must reuse one typed mapper.
- One OCR apply should use one canonical combined state patch if the source confirms the stale-closure
  risk; no sequential-write workaround.
- No automatic customer/vehicle/estimate/OCR persistence and no generated IDs.
- Existing identity selection, duplicate advisory, tenant/auth, pricing, discount, save, PDF, PPF,
  coating, LINE, and route behavior remain unchanged.

## 6. Governance write set already delivered by MacBook Codex

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_UNIFIED_R1_READ_ONLY_DIAGNOSIS.md`

The diagnosis must make no further change to these or any other paths.

## 7. Provisional future implementation boundary — not authorized

Evaluate whether each path is necessary, and return the narrowest exact allowlist:

1. `src/components/estimates/wizard/EstimateWizard.tsx`
2. `src/components/estimates/wizard/steps/Step1Customer.tsx`
3. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
4. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts` (new only if needed)
5. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts` (new only if needed)
6. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx` (new only if needed)
7. `src/components/estimates/wizard/steps/existing-entity-selection.test.tsx`
8. `src/components/estimates/wizard/validity/wizard-step-validity.ts` (stale comments only)
9. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts` (fixture wording only)

If this list cannot implement and prove the repair, return the exact additional path and reason. Do
not infer authorization to edit it.

## 8. Prohibited actions

- No file edit/create/delete/rename/format.
- No test, typecheck, build, lint, dev server, browser, OCR upload, or runtime command.
- No stage, commit, push, fetch, pull, branch/worktree mutation, PR comment, Ready, merge, or deploy.
- No database, Supabase, Storage, Auth, HTTP, provider, external AI, Vercel, or production access.
- No dependency install/change and no lockfile/config/environment mutation.
- No content access to `src/components/estimates/wizard/screens/ScreensPreview.tsx`; metadata only.
- No content access to the protected LINE migration, monthly-invoice migration, or monthly-invoice
  boundary test; metadata only.
- No inspection of unrelated dirty worktrees or unrelated PRs.

## 9. Required result

Return one report with identifier
`GDA_ESTIMATE_WIZARD_OCR_UNIFIED_R1_READ_ONLY_DIAGNOSIS_RESULT_V1` and exactly these sections:

1. `VERDICT`: `READY_FOR_IMPLEMENTATION`, `CHANGES_REQUIRED_GOVERNANCE`,
   `BLOCKED_BASE_OR_GOVERNANCE`, or `BLOCKED_READ_SCOPE`
2. `BASE_AND_SCOPE_PROOF`
3. `ROOT_CAUSE`
4. `CURRENT_CALL_CHAIN`
5. `REQUIRED_SINGLE_SCAN_CALL_CHAIN`
6. `FIELD_MAPPING_LEDGER`
7. `THREE_M_AND_SEVEN_SIZE_PROOF`
8. `PERSISTENCE_AND_SIDE_EFFECT_BOUNDARY`
9. `EXACT_FUTURE_IMPLEMENTATION_ALLOWLIST`
10. `EXACT_FUTURE_TEST_COMMANDS_AND_ASSERTIONS`
11. `PROTECTED_AND_FROZEN_SCOPE_PROOF`
12. `REMAINING_RISKS`

Stop after returning the report. Do not implement or run tests.
