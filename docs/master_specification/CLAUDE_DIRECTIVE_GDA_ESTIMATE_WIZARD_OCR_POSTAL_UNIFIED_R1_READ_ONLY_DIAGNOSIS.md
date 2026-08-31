# Claude Directive — GDA Estimate Wizard OCR + Postal Unified R1 Read-only Diagnosis

Directive ID: `GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_READ_ONLY_DIAGNOSIS_V1`

## 1. Authority

Perform one bounded read-only diagnosis only. Do not edit, create, delete, rename, format, stage,
commit, push, comment, test, build, run the application, access a provider, or mutate any external
system. Implementation is a later gate after MacBook Codex accepts this report.

Read completely, in order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. The latest entries of `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. This directive
6. The newest non-superseded MacBook-Codex instruction on the existing OCR coordination Draft PR

If identity or authority differs, return `BLOCKED_BASE_OR_GOVERNANCE` and stop.

## 2. Exact identity

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Fixed base commit/HEAD: `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Fixed base tree: `fda91137ce537f5a6f60f82d229b6aa1ac6c13e6`
- Dedicated local branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Existing OCR coordination Draft PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/40`
- Reference-only prior source commit: `db7ce44b8af20cd48e64ba79492419cec03c94b2`

PR #40 is coordination/reference evidence only for this diagnosis. Do not edit its branch or post a
result. PR #47 is completely outside this phase.

## 3. Four owner-confirmed outcomes to diagnose

1. One reviewed Step-1 vehicle-registration OCR result must populate both customer and vehicle
   drafts atomically; no second scan on Step 2.
2. Estimate Wizard postal code must fill address.
3. OCR-derived address must fill postal code when an exact authoritative result exists.
4. Focused tests must prove customer + vehicle + postal/address and preserve existing 3M
   `SS/S/M/ML/L/LL/XL` behavior.

The archived accepted UI specification explicitly says OCR fills all fields and postal/address are
bidirectional. Diagnose the current production call chain and return the narrowest safe repair.

## 4. Literal read scope

Read only the bootstrap files plus these paths:

1. `docs/estimate-wizard/archive/ver2.0/specification/GenSpark_Request_EstimateWizard_Ver2.0.md`
2. `src/app/estimates/new/page.tsx`
3. `src/components/estimates/wizard/production/ProductionEstimateWizard.tsx`
4. `src/components/estimates/wizard/EstimateWizard.tsx`
5. `src/components/estimates/wizard/OcrEntry.tsx`
6. `src/components/estimates/wizard/useEstimateWizard.ts`
7. `src/components/estimates/wizard/wizard-types.ts`
8. `src/components/estimates/wizard/steps/Step1Customer.tsx`
9. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
10. `src/components/estimates/wizard/steps/existing-entity-selection.ts`
11. `src/components/estimates/wizard/steps/existing-entity-selection.test.tsx`
12. `src/components/estimates/wizard/bridge/ew-ui1-controller.ts`
13. `src/components/estimates/wizard/bridge/ew-ui1-controller.test.ts`
14. `src/components/estimates/wizard/validity/wizard-step-validity.ts`
15. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts`
16. `src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts`
17. `src/components/estimates/wizard/save/estimate-save-validation.ts`
18. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx` if present
19. `src/lib/ocr/wizard-customer-ocr-apply-core.ts`
20. `src/lib/ocr/wizard-customer-ocr-apply-core.test.ts`
21. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts` if present
22. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts` if present
23. `src/lib/ocr/customer-mapper.ts`
24. `src/lib/ocr/vehicle-mapper.ts`
25. `src/lib/vehicle-registration/vehicle-registration-types.ts`
26. `src/lib/vehicles/body-size-estimate.ts`
27. `src/lib/vehicles/body-size-estimate.test.ts`
28. `src/lib/geo/postal-lookup.ts`
29. `src/components/customers/CustomerForm.tsx`
30. `src/components/settings/CompanySettingsForm.tsx`
31. `src/lib/estimate-wizard/ew-ui1-to-draft.ts`

You may inspect the exact prior commit versions of only the eight source/test paths named by commit
`db7ce44b...` using read-only Git commands. Do not inspect its full branch diff or unrelated paths.
If another read path is essential, return `BLOCKED_READ_SCOPE` with the exact path and reason.

## 5. Required diagnosis

Prove or refute:

- current Step 1 applies only customer OCR fields and drops vehicle fields;
- current Step 2 requires a separate OCR apply for vehicle fields;
- one combined store update is required to avoid stale closure/state loss;
- the prior reference commit's shared vehicle mapper and single-scan design can be ported safely to
  current main without importing unrelated history;
- forward postal lookup exists and why the canonical Estimate Wizard does not invoke it;
- whether OCR output contains postal data directly, can only extract `〒NNN-NNNN` when present, or
  requires address-to-postal resolution;
- whether an approved, current, deterministic address-to-postal authority already exists in the
  repository;
- whether reverse lookup can return zero, one, or multiple candidates and the exact fail-safe UI
  behavior for each;
- no OCR-side persistence is required and explicit save remains the only persistence boundary;
- 3M thresholds, recommendation colors, operator correction, and seven-size keys remain unchanged.

Do not assume that a postal-to-address API supports reverse lookup. Do not select or recommend a new
external provider as if approved. If the repository has no approved reverse authority, return
`OWNER_DECISION_REQUIRED_REVERSE_LOOKUP_AUTHORITY` and list the exact decision needed.

## 6. Provisional future implementation boundary — not authorized

Return the narrowest exact allowlist. The expected ceiling is the prior eight OCR paths plus only the
minimum postal/address helper, Step-1 wiring, and focused tests. No dependency, lockfile, environment,
config, API route, database, migration, generated dataset, or provider file is pre-authorized.

## 7. Frozen and protected scope

- No UI redesign, route change, customer/vehicle identity change, pricing, discount, PPF, coating,
  PDF, LINE, auth, tenant, save-RPC, database, or provider mutation.
- Empty/whitespace/no-result/ambiguous/error values never erase operator input or fabricate data.
- Exactly seven sizes `SS/S/M/ML/L/LL/XL`; no `XXL`, threshold change, or automatic
  `confirmedSize` mutation.
- Never open/read/diff/copy `src/components/estimates/wizard/screens/ScreensPreview.tsx`; metadata
  only. Treat the protected LINE migration, monthly-invoice migration, and monthly-invoice boundary
  test as metadata-only.

## 8. Prohibited actions

No edits; no tests/typecheck/build/lint/dev server/browser/OCR upload; no database/Supabase/Auth/
Storage/HTTP/provider/Vercel/Preview/production access; no dependency/config/secret change; no Git or
GitHub mutation; no stage/commit/push/Ready/merge/deploy.

## 9. Required result

Return identifier
`GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_READ_ONLY_DIAGNOSIS_RESULT_V1` with exactly:

1. `VERDICT`: `READY_FOR_IMPLEMENTATION`, `OWNER_DECISION_REQUIRED_REVERSE_LOOKUP_AUTHORITY`,
   `CHANGES_REQUIRED_GOVERNANCE`, `BLOCKED_BASE_OR_GOVERNANCE`, or `BLOCKED_READ_SCOPE`
2. `BASE_AND_SCOPE_PROOF`
3. `CURRENT_CALL_CHAIN_AND_ROOT_CAUSES`
4. `PRIOR_REFERENCE_PORTABILITY`
5. `CUSTOMER_AND_VEHICLE_ATOMIC_APPLY_CONTRACT`
6. `POSTAL_TO_ADDRESS_CONTRACT`
7. `OCR_ADDRESS_TO_POSTAL_AUTHORITY_AND_AMBIGUITY_CONTRACT`
8. `THREE_M_AND_SEVEN_SIZE_PROOF`
9. `PERSISTENCE_AND_SIDE_EFFECT_BOUNDARY`
10. `EXACT_FUTURE_IMPLEMENTATION_ALLOWLIST`
11. `EXACT_FUTURE_TEST_COMMANDS_AND_ASSERTIONS`
12. `PROTECTED_AND_FROZEN_SCOPE_PROOF`
13. `REMAINING_RISKS_OR_OWNER_DECISION`

Stop after the report. Do not implement.
