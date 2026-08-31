# Claude Directive — GDA Estimate Wizard OCR + Postal Unified R1 A: Single-scan Implementation

Directive ID: `GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_A_SINGLE_SCAN_IMPLEMENTATION_V1`

## 1. Active authority

MacBook Codex accepted only the diagnosis findings for atomic single-scan customer/vehicle draft
application and unchanged 3M seven-size behavior. Claude may implement and test that exact A scope
now. The diagnosis claim that extracting an already printed postal code satisfies address-to-postal
reverse lookup is rejected; no postal/address source or test change is authorized in A.

Stage, commit, push, PR mutation, Ready, merge, deployment, dependency change, provider access,
database/Supabase access, and production action are prohibited.

Read completely, in order:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. Latest `docs/master_specification/GYEON_DA_PHASE_RESULTS.md` entries for this phase
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_READ_ONLY_DIAGNOSIS.md`
6. This directive
7. The newest non-superseded MacBook-Codex implementation instruction on Draft PR #40

If branch, base, scope, or authority differs, return `BLOCKED_BASE_OR_GOVERNANCE` without edits.

## 2. Exact identity

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Fixed execution HEAD: `501ede8c06b0c397a47996f9dfe0833f8779376c`
- Fixed execution tree: `fda91137ce537f5a6f60f82d229b6aa1ac6c13e6`
- Reference-only prior commit: `db7ce44b8af20cd48e64ba79492419cec03c94b2`
- Coordination PR only: `https://github.com/nisikawa-officeAZ/GYEON/pull/40`

The worktree may contain only the four uncommitted governance paths recorded for this phase before
implementation. Do not edit those governance paths during implementation.

## 3. Exact source/test write allowlist

Only these eight paths may change:

1. `src/components/estimates/wizard/EstimateWizard.tsx`
2. `src/components/estimates/wizard/steps/Step1Customer.tsx`
3. `src/components/estimates/wizard/steps/Step2Vehicle.tsx`
4. `src/lib/ocr/wizard-vehicle-ocr-apply-core.ts` — new
5. `src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts` — new
6. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx` — new
7. `src/components/estimates/wizard/validity/wizard-step-validity.ts` — stale comment only
8. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts` — stale wording only

Do not edit a ninth path. Do not edit postal/address helpers or tests in A. If another path is
essential, stop with `BLOCKED_WRITE_SCOPE` and report it without changing it.

## 4. Required implementation

### 4.1 Shared pure vehicle mapper

Create one pure typed core that can emit only:

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
- nonblank plate region/class/kana/number joined with one space in official order -> `plateNumber`

Ignore non-string, empty, and whitespace-only values. Trim accepted reviewed text. Never emit
`existingId`, `suggestedSize`, or `confirmedSize`. No React, network, provider, database, clock,
randomness, generated ID, or side effect.

### 4.2 One atomic Step-1 apply

Keep `buildWizardCustomerOcrPatch` as the sole customer mapper. From one reviewed Step-1 OCR result:

1. build the customer patch;
2. build the vehicle patch;
3. call `api.updateStore` exactly once with one combined customer/vehicle patch;
4. do not call `setC` followed by another update;
5. preserve every operator value when OCR input is absent/blank;
6. update only the existing transient 3M recommendation through an optional callback.

### 4.3 Step 2 and 3M

Keep Step-2 OCR as an optional correction/rescan and reuse the same vehicle mapper. Preserve current
3M thresholds, unit conversion, blue recommendation, amber adjacent sizes, and exactly
`SS/S/M/ML/L/LL/XL`. Never write `confirmedSize`. Correct only the stale vehicle-name hint/comments
already bounded by the eight paths; no layout redesign.

## 5. Frozen behavior

OCR changes wizard memory only. Explicit save remains the sole persistence boundary. Do not change
customer/vehicle selection, duplicate advisory, identity, registration mode, pricing, discount,
save, PPF, coating, PDF, LINE, auth, tenant, route, postal/address behavior, or external services.

## 6. Exact focused verification

The execution worktree has no local `node_modules`. MacBook Codex independently verified that its
`package-lock.json` and `/Users/atsushinishikawa/dealeros/package-lock.json` both have SHA-256
`423d295f85d537b12c375aabb8e5fef336c77139a756b19c02a4ba1719f20866`, and that the shared loader
exists. Use that read-only loader by absolute path. Do not install, link, copy, or change dependencies.

Run exactly:

```text
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/ocr/wizard-customer-ocr-apply-core.test.ts
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/vehicles/body-size-estimate.test.ts
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/components/estimates/wizard/bridge/ew-ui1-controller.test.ts
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/components/estimates/wizard/validity/wizard-step-validity.test.ts
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/components/estimates/wizard/steps/existing-entity-selection.test.tsx
git diff --check -- src/components/estimates/wizard/EstimateWizard.tsx src/components/estimates/wizard/steps/Step1Customer.tsx src/components/estimates/wizard/steps/Step2Vehicle.tsx src/lib/ocr/wizard-vehicle-ocr-apply-core.ts src/lib/ocr/wizard-vehicle-ocr-apply-core.test.ts src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx src/components/estimates/wizard/validity/wizard-step-validity.ts src/components/estimates/wizard/validity/wizard-step-validity.test.ts
```

Tests must prove all approved mappings, exact plate order, blank preservation, exactly one combined
Step-1 update, shared mapper use, same 3M result, seven sizes/no `XXL`, no `confirmedSize` mutation,
no persistence/side effect, unchanged validity, and unchanged existing-entity behavior.

If dependencies are unavailable, return `BLOCKED_ENVIRONMENT`; do not install or change them.

## 7. Protected and prohibited scope

Never open/read/diff/copy/stage/modify `src/components/estimates/wizard/screens/ScreensPreview.tsx`.
Keep the protected LINE migration, monthly-invoice migration, and monthly-invoice boundary test
metadata-only. Do not touch PR #47. No database, Supabase, Storage, Auth, HTTP, provider, browser,
OCR upload, Vercel, Preview, production, dependency, lockfile, config, environment, generated artifact,
stage, commit, push, PR comment, Ready, merge, or deploy action.

## 8. Required result

Return identifier `GDA_ESTIMATE_WIZARD_OCR_POSTAL_UNIFIED_R1_A_SINGLE_SCAN_IMPLEMENTATION_RESULT_V1`
with exactly:

1. `VERDICT`
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

Allowed verdicts: `READY_FOR_CODEX_REVIEW`, `CHANGES_REQUIRED`, `BLOCKED_BASE_OR_GOVERNANCE`,
`BLOCKED_WRITE_SCOPE`, or `BLOCKED_ENVIRONMENT`.

Leave all source/test changes unstaged and uncommitted. Stop after the report.
