# Claude Directive — GDA Estimate Wizard OCR Unified R1 Implementation

Directive ID: `GDA_ESTIMATE_WIZARD_OCR_UNIFIED_R1_IMPLEMENTATION_V1`

## 1. Authority and activation

This committed directive defines the next bounded implementation gate for phase `GDA-2A-OCR-R1`.
Its creation, commit, and push do **not** authorize execution. Claude Code may edit source or run the
listed tests only after MacBook Codex supplies a later owner-approved instruction whose phase,
branch, base, execution HEAD/tree, directive ID, exact write allowlist, and test commands match this
document.

Even after that activation, this directive does not authorize source commit/push, PR Ready, merge,
Preview, deployment, production mutation, database/Supabase/provider access, or any unrelated work.

Required bootstrap reads, in order:

1. `AGENTS.md` — complete
2. `CLAUDE.md` — complete
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` — complete
4. Latest entries of `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`, including
   `GDA-2A-OCR-R1-A`
5. Read-only diagnosis directive — complete
6. This directive — complete
7. The newest non-superseded MacBook-Codex instruction on Draft PR #40

If any identity, authority, or path differs, stop with `BLOCKED_BASE_OR_GOVERNANCE` and make no
change.

## 2. Repository identity

- Repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Fixed original base commit: `48de96bbf5518be3fd7fd8a3964dfd7975716165`
- Fixed original base tree: `e25590d276237f643e9b1408e6c47d192388de07`
- Candidate branch: `agent/estimate-wizard-ocr-unified-r1`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/40`
- Governance execution HEAD/tree: supplied by MacBook Codex after this exact three-document
  governance commit is normally pushed
- Required delta before implementation: governance documents only; no source/test delta

## 3. Accepted defect and outcome

One reviewed Step-1 vehicle-registration OCR result currently applies customer data only. Vehicle
fields are discarded, and Step 2 can populate them only through a second OCR apply. The completed
repair must make one reviewed OCR result sufficient to populate both customer and vehicle draft
fields and the transient 3M recommendation before Step 2, without changing persistence authority.

The accepted diagnosis is recorded at
`https://github.com/nisikawa-officeAZ/GYEON/pull/40#issuecomment-5462738620`.

## 4. Exact source and test write allowlist

Only these eight paths may change:

1. `src/components/estimates/wizard/EstimateWizard.tsx`
2. `src/components/estimates/wizard/steps/Step1Customer.tsx`
3. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
4. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts` — new
5. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts` — new
6. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx` — new
7. `src/components/estimates/wizard/validity/wizard-step-validity.ts` — stale comment only; no
   logic change
8. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts` — stale wording only; no
   assertion or fixture-value change

Do not edit a ninth path. If a ninth path is essential, stop with `BLOCKED_WRITE_SCOPE` and report
the exact path and reason.

## 5. Required implementation

### 5.1 Shared pure vehicle OCR patch core

Create one pure, typed vehicle patch core in the allowed new module. It may import the canonical OCR
result type but must have no React, server action, fetch, database, Supabase, Storage, Auth, clock,
randomness, generated ID, or side effect.

It may emit only these vehicle draft fields:

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
- non-blank `license_plate_region`, `license_plate_class`, `license_plate_kana`, and
  `license_plate_number`, joined with one space in that order -> `plateNumber`

For every scalar and plate fragment:

1. Ignore non-string values.
2. Use `trim()` to determine whether the text is blank.
3. Omit empty and whitespace-only values entirely; never emit an empty key.
4. Apply the trimmed reviewed text consistently with the existing customer OCR core.
5. Perform no NFKC folding, aliasing, fallback mapping, inference, or other normalization.

The output type must make `existingId`, `suggestedSize`, and `confirmedSize` impossible to emit.
Do not reuse `src/lib/ocr/vehicle-mapper.ts`; it targets a different form contract.

### 5.2 One atomic Step-1 apply

Keep `buildWizardCustomerOcrPatch` as the only customer mapper. On one Step-1 OCR apply:

1. Build the customer patch with that existing core.
2. Build the vehicle patch with the new shared core.
3. Call `api.updateStore` exactly once with one combined top-level patch containing the non-empty
   customer and vehicle patches.
4. Do not call the current `setC` helper and then a second vehicle update; sequential calls are
   forbidden because `updateStore` is closed over one render draft.
5. Missing OCR values must preserve every operator-entered field.
6. Do not change existing-customer selection, duplicate advisory, registration mode, or identity.

### 5.3 One shared 3M recommendation path

Thread an optional `onSizeEstimate` callback from `EstimateWizard.tsx` to Step 1, using the same
host-owned `bodySizeEstimate` state already supplied to Step 2. Step 1 must call the existing
`estimateBodySizeFromVehicleRegistrationOcr` after the reviewed OCR apply.

- Use exactly `SS / S / M / ML / L / LL / XL`.
- `XXL` is forbidden.
- Preserve existing thresholds and unit conversion.
- Blue remains the recommendation and amber remains adjacent sizes.
- Never write or change `confirmedSize`.
- Keep the new Step-1 callback optional so out-of-scope and protected callers remain compatible.

### 5.4 Step-2 rescan and wording

Keep Step 2 OCR as an explicit correction/rescan route, but replace its inline vehicle mapping with
the same shared core. Preserve one vehicle store update and the existing 3M callback. Change the
vehicle-name hint only enough to say that OCR may prefill it when present and the operator must
confirm or edit it. It remains required for navigation.

Correct only the stale comments/wording in the two validity paths. Do not change validity logic,
assertions, or fixture values.

## 6. Persistence and frozen contracts

- OCR apply updates in-memory wizard draft state only.
- No customer, vehicle, estimate, OCR record, file, or DB write before explicit save.
- No generated ID.
- No change to save mapper, validation, pricing, discounts, PDF, PPF, coating, LINE, routes,
  authentication, tenant boundaries, duplicate rules, or existing-entity identity.
- No UI redesign. Keep current layout, buttons, colors, and responsive behavior except the exact
  corrected hint text and the already-existing recommendation display.

## 7. Required tests

Implement focused tests inside the allowed test paths, then run exactly:

```text
node --import tsx --test src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts
node --import tsx --test src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx
node --import tsx --test src/lib/ocr/wizard-customer-ocr-apply-core.test.ts
node --import tsx --test src/lib/vehicles/body-size-estimate.test.ts
node --import tsx --test src/components/estimates/wizard/bridge/ew-ui1-controller.test.ts
node --import tsx --test src/components/estimates/wizard/validity/wizard-step-validity.test.ts
node --import tsx --test src/components/estimates/wizard/steps/existing-entity-selection.test.tsx
git diff --check -- src/components/estimates/wizard/EstimateWizard.tsx src/components/estimates/wizard/steps/Step1Customer.tsx src/components/estimates/wizard/steps/Step2Vehicle.tsx src/lib/ocr/wizard-vehicle-ocr-apply-core.ts src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx src/components/estimates/wizard/validity/wizard-step-validity.ts src/components/estimates/wizard/validity/wizard-step-validity.test.ts
if rg -n '[[:blank:]]+$' src/lib/ocr/wizard-vehicle-ocr-apply-core.ts src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx; then exit 1; fi
if rg -n 'XXL' src/components/estimates/wizard/EstimateWizard.tsx src/components/estimates/wizard/steps/Step1Customer.tsx src/components/estimates/wizard/steps/Step2Vehicle.tsx src/lib/ocr/wizard-vehicle-ocr-apply-core.ts src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx src/components/estimates/wizard/validity/wizard-step-validity.ts src/components/estimates/wizard/validity/wizard-step-validity.test.ts; then exit 1; fi
```

The new tests must prove:

- every approved vehicle field and exact plate order;
- empty and whitespace-only OCR values emit no key and preserve operator-entered text;
- one Step-1 OCR apply calls `updateStore` exactly once with customer and vehicle patches;
- the existing customer mapper remains the source of customer fields;
- Step 1 and Step 2 import and use the same vehicle mapper;
- Step-1 dimensions produce the same existing 3M recommendation;
- no OCR patch contains or changes `confirmedSize`;
- exactly seven size keys and no `XXL`;
- no persistence or external side effect is introduced;
- validity behavior and existing-entity behavior remain unchanged.

If the mounted integration test cannot be implemented within the six functional paths without
adding a dependency or changing production exports merely for testing, stop with
`BLOCKED_TEST_SEAM`; do not weaken the test.

## 8. Protected and prohibited scope

- Never open, read, diff, copy, stage, or modify
  `src/components/estimates/wizard/screens/ScreensPreview.tsx`; metadata only.
- Do not open protected LINE/monthly-invoice contents; metadata only.
- No dependency, lockfile, config, migration, environment, or generated artifact change.
- No database, Supabase, Storage, Auth, provider, HTTP, browser, OCR upload, Vercel, Preview, or
  production access.
- No formatting outside the eight paths.
- No stage, commit, push, fetch, pull, PR comment, Ready, merge, or deployment.
- Do not modify this directive or any governance document during implementation.

## 9. Required result

Return one report with identifier
`GDA_ESTIMATE_WIZARD_OCR_UNIFIED_R1_IMPLEMENTATION_RESULT_V1` and exactly these sections:

1. `VERDICT`: `READY_FOR_CODEX_REVIEW`, `CHANGES_REQUIRED`, `BLOCKED_BASE_OR_GOVERNANCE`,
   `BLOCKED_WRITE_SCOPE`, `BLOCKED_TEST_SEAM`, or `BLOCKED_ENVIRONMENT`
2. `BASE_AND_AUTHORITY_PROOF`
3. `EXACT_CHANGED_PATHS`
4. `IMPLEMENTATION_SUMMARY`
5. `ATOMIC_SINGLE_SCAN_PROOF`
6. `FIELD_AND_BLANK_HANDLING_PROOF`
7. `THREE_M_AND_SEVEN_SIZE_PROOF`
8. `PERSISTENCE_AND_FROZEN_SCOPE_PROOF`
9. `TEST_RESULTS`
10. `GIT_DIFF_CHECK`
11. `PROTECTED_PATH_METADATA`
12. `REMAINING_RISKS`

Stop after the report. Leave the implementation unstaged and uncommitted for MacBook Codex review.
