# Claude Directive — GDA Estimate Wizard Release R1 Read-only Diagnosis

## Authority

Perform one bounded read-only diagnosis against:

```text
repository: nisikawa-officeAZ/GYEON
branch: fix/estimate-wizard-release-r1
commit: 949f51b82cda9f2f21162237f1e8759037bc8bff
```

Do not edit, create, delete, format, test, build, install, stage, commit, push, mutate a PR,
access Supabase, Storage, Vercel, or production data.

## Owner-approved defects

1. Estimate Wizard Step 5 exposes only none/amount/percent and leaves coupon selection behind a
   stale Phase 2 notice. The visible coupon entry must be restored immediately to the right of
   `値引きなし`, while configured coupon selection remains governed by the authoritative catalog.
2. Settings has no operator-facing `クーポン設定 / COUPON SETTINGS` entry under
   `店舗運営 / STORE OPERATIONS`, although the coupon authoring editor already exists.
3. Step 7 `保存` and `保存してPDFを開く` controls inherit unreadable dark text. Only explicit
   text contrast may change; save ordering, idempotency, routing, and PDF behavior are frozen.

## Protected paths

Treat these as metadata-only. Do not open, read, diff, copy, stage, or modify them:

```text
src/components/estimates/wizard/screens/ScreensPreview.tsx
supabase/migrations/20260801110110_line_link_tokens.sql
supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## Read allowlist

Read only:

```text
src/components/estimates/wizard/EstimateWizard.tsx
src/components/estimates/wizard/steps/Step5Discount.tsx
src/components/estimates/wizard/screens/Step5Discount.tsx
src/components/estimates/wizard/screens/DiscountModeSelector.tsx
src/components/estimates/wizard/screens/CouponSelector.tsx
src/components/estimates/wizard/screens/step-types.ts
src/components/estimates/wizard/useEstimateWizard.ts
src/components/estimates/wizard/wizard-types.ts
src/components/estimates/wizard/save/WizardSavePanel.tsx
src/components/estimates/wizard/production/EstimateWizardContainer.tsx
src/components/settings/SettingsCenterHub.tsx
src/app/settings/estimate-wizard/EstimateWizardSettingsClient.tsx
src/app/settings/estimate-wizard/panel-config.ts
src/app/settings/estimate-wizard/[panel]/page.tsx
src/lib/wizard-catalog/estimate-wizard-settings-core.ts
src/lib/navigation/gda-pricing-settings-ui.test.ts
src/components/estimates/wizard/production/ProductionEstimateWizard.test.tsx
```

## Questions

1. Confirm the exact stale Step 5 mount and the smallest adapter that can consume
   `screenConfig.coupons` without duplicating pricing or persistence logic.
2. Confirm how configured coupon selection, active/expired state, and combinability already flow
   through canonical draft, pricing, and save boundaries.
3. Confirm the smallest settings route that exposes the existing coupon editor from Store
   Operations without relocating or duplicating its server actions.
4. Confirm that adding explicit light text classes to the two fresh-save controls changes no
   behavior, state, routing, or idempotency.
5. Return an exact minimal implementation and test allowlist. No patch.

## Required result

```text
MARKER=GDA_ESTIMATE_WIZARD_RELEASE_R1_READ_ONLY_DIAGNOSIS_RESULT_V1
HEAD=<exact commit>
WORKTREE_STATUS=<exact pre-existing paths>
STEP5_COUPON_GAP=<exact cause>
COUPON_RUNTIME_AND_SAVE_BOUNDARY=<PASS or exact defect>
COUPON_SETTINGS_ROUTE_GAP=<exact cause>
SAVE_BUTTON_CONTRAST_GAP=<exact cause>
MINIMAL_IMPLEMENTATION_ALLOWLIST=<literal paths>
MINIMAL_TEST_ALLOWLIST=<literal paths>
SOURCE_OR_RUNTIME_MUTATION=NONE
FINAL_VERDICT=<READY_FOR_IMPLEMENTATION_GOVERNANCE or CHANGES_REQUIRED_GOVERNANCE>
```

Stop after the report.
