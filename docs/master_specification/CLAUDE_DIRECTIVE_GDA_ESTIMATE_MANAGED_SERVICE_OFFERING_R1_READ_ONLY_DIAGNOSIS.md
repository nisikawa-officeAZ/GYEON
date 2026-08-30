# Claude Directive — GDA Estimate Managed Service Offering R1 Read-only Diagnosis

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1`
- Mode: one bounded read-only diagnosis only
- Responsible diagnosis agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This invocation must diagnose the remaining authoritative save and direct-persistence gaps for all dealer-managed Estimate Wizard service families. It must not edit files, run tests, mutate Git, access a database or provider, or redesign the accepted UI.

## Invocation identity

MacBook Codex must supply the exact committed governance execution HEAD and tree containing this directive.

- Repository: `nisikawa-officeAZ/GYEON`
- Branch must be `plan/estimate-managed-service-offering-enforcement-r1`.
- Fixed source base must be commit `7aca4e7dfcebb4bd71cb8d1d2db0dbda71644110` with tree `bde678a017a875b46df56bfe0c054670c61128ec`.
- The fixed source base must be an ancestor of the supplied governance execution HEAD.
- The committed delta from the fixed source base to the supplied governance execution HEAD must contain exactly these three paths:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
- The worktree and index must be clean before diagnosis.

If identity, ancestry, exact-delta, or clean-state verification fails, return `BLOCKED_BASE_MISMATCH` and stop.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_B_SERVER_SAVE_ENFORCEMENT.md`
6. This directive

Then state the active phase, exact read allowlist, protected paths, fixed behavior, prohibitions, and stop boundary before diagnosis.

## Literal source read allowlist

Only the following source paths may be opened or searched:

1. `src/lib/estimates/service-categories.ts`
2. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
3. `src/lib/wizard-catalog/wizard-runtime-config.ts`
4. `src/components/estimates/wizard/draft/wizard-draft-types.ts`
5. `src/components/estimates/wizard/draft/wizard-draft-state.ts`
6. `src/components/estimates/wizard/EstimateWizard.tsx`
7. `src/components/estimates/wizard/steps/Step3Category.tsx`
8. `src/components/estimates/wizard/steps/Step3Category.test.tsx`
9. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
10. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts`
11. `src/components/estimates/wizard/save/wizard-save-intent-types.ts`
12. `src/components/estimates/wizard/save/wizard-save-observability.ts`
13. `src/components/estimates/wizard/save/wizard-save-observability.test.ts`
14. `src/components/estimates/wizard/save/save-estimate-from-wizard-intent-action.ts`
15. `src/components/estimates/wizard/save/wizard-save-intent-validation.ts`
16. `src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts`
17. `src/components/estimates/wizard/save/estimate-persistence-payload.ts`
18. `src/components/estimates/wizard/save/save-estimate-from-wizard-action.ts`
19. `src/components/estimates/wizard/save/save-estimate-from-wizard-action.test.ts`
20. `supabase/migrations/102_estimate_wizard_atomic_save.sql`
21. `supabase/migrations/20260719122621_estimate_wizard_atomic_save_hardening.sql`
22. `supabase/migrations/20260720024724_estimate_wizard_atomic_numbering.sql`

If a referenced direct-save or superseding migration path cannot be determined from these files and Git pathname metadata, report the missing path as a diagnosis blocker. Do not broaden the read set yourself.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs at the fixed source base:

- `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `32fda49583ae1217bc13711784ad8fa31744726c`
- `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Frozen product contract

1. The managed service families are exactly `window_film`, `ppf`, `maintenance`, `room_cleaning`, and `car_wash`.
2. Use the existing canonical family-to-category mapping. Do not re-spell it in a second switch or table.
3. `coating` and `other` are outside this offering-switch contract and must remain unaffected.
4. PR #43 Step-3 behavior is accepted and frozen: every control has equal height; an unavailable managed service is visible, gray, disabled, unselected, and explained with its store-setting reason.
5. The current dealer-bound `runtime.screenConfig.serviceOfferings` is the sole server save authority. Never trust a client flag, disabled control, rank, or catalog inference.
6. Preserve actor resolution, tenant identity, and stale-revision precedence. Offering rejection comes after those checks and before server pricing, mapping, DTO validation, or persistence.
7. Return the existing stable public failure `service-not-offered` for every unavailable managed family. Do not create family-specific public failures unless a separately approved contract requires them.
8. A selected canonical category is intent. Any non-default value in the corresponding structurally required configuration section is also intent, even without the category.
9. A configuration section that exactly matches the canonical initial draft is not intent merely because the section exists.
10. Never silently remove or normalize hostile/stale unavailable-service state. Reject the whole save.
11. Preserve the existing sanitized event mapping: stage `service-offering`, code `VALIDATION_ERROR`, severity `info`, resolved dealer id, and no raw/customer/vehicle/pricing/draft details.
12. Preserve PPF full and partial behavior and all accepted pricing, OCR, seven-size, rank, coupon, DTO, idempotency, and tenant contracts.
13. Server-action enforcement and direct RPC/SQL enforcement are separate gates. Do not claim bypass resistance from the orchestrator alone.

## Required diagnosis questions

Answer each with file-and-line evidence:

1. For each of the five managed families, what exact canonical category and draft configuration section represent intent?
2. For `window_film`, enumerate whether each of `selectedAreaIds`, `filmTypeId`, `unitPriceInput`, `selectedPackageCode`, `selectedOptionIds`, and `optionQuantities` differs from the canonical default and therefore must count as intent.
3. For `maintenance`, determine whether either `menuId` or `unitPriceInput` is non-default intent.
4. For `car_wash`, determine whether either `menuId` or `unitPriceInput` is non-default intent.
5. For `room_cleaning`, determine whether either `selectedMenuIds` or `unitPricesByMenu` is non-default intent.
6. Confirm the existing nine-signal PPF predicate remains correct and can be generalized without changing accepted PPF behavior.
7. Identify the smallest pure predicate shape that consumes the canonical draft plus the authoritative offering map, imports the existing mapping authority, and avoids a second family/category table.
8. Confirm the exact guard position and precedence for malformed intent, actor failure, runtime failure, tenant mismatch, stale revision, service not offered, pricing, mapping, DTO validation, and persistence.
9. Identify the smallest later server-save implementation write allowlist and focused test command. Prefer existing `service-not-offered` and observability code when no change is required.
10. Trace every production-capable path that can bypass `runWizardSaveIntent`, including direct action/RPC callers, and identify the smallest separate Phase-C SQL/RPC write allowlist.
11. Identify the exact forward-only migration and disposable-database test/harness path needed to prove tenant-owned enforcement for direct RPC callers. If the exact existing harness is outside the read allowlist, return one bounded follow-up read request rather than guessing.
12. Confirm that no UI redesign, settings mutation, price change, data backfill, or owner business decision is required.

## Allowed commands

Read-only only:

- `git status --short --branch`
- `git rev-parse HEAD HEAD^{tree}`
- `git merge-base --is-ancestor <fixed-base> HEAD`
- `git diff --name-only <fixed-base>...HEAD`
- `git ls-tree HEAD -- <protected-path>`
- `sed`, `rg`, `wc`, and `sha256sum`/`shasum` limited to the mandatory documents and literal source read allowlist

Do not run tests, typecheck, build, application runtime, browser, Docker, Colima, Supabase, SQL, database, network, provider, package manager, or package-install commands.

## Prohibitions and stop boundary

- Do not modify, create, delete, rename, format, stage, commit, push, stash, restore, clean, or reset any file.
- Do not create or mutate a PR/comment, mark Ready, merge, deploy, or access Preview/production.
- Do not contact Supabase, Auth, Vercel, GitHub APIs, or any other external service.
- Do not expose secrets or private file contents outside the one explicitly authorized diagnosis transmission.
- Stop immediately after returning the one report.

## Required result schema

Return:

1. `verdict`: `PASS_NO_CHANGE_REQUIRED`, `CHANGES_REQUIRED_SERVER_ONLY`, `CHANGES_REQUIRED_SERVER_AND_SQL`, `BLOCKED_READ_SCOPE`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, full HEAD/tree, fixed-base ancestry, exact committed governance delta, and clean-state result.
3. A five-row table: family, canonical category, configuration section, exact non-default intent signals, and current enforcement status.
4. Exact guard order and evidence for the current PPF-only gap.
5. Exact smallest later server-save write allowlist and focused test command, with no implementation.
6. Exact smallest later direct-RPC/SQL write allowlist and disposable-database verification command, or one bounded follow-up read request if literal paths cannot be proved.
7. Confirmation that the accepted Step-3 UI, PPF full/partial behavior, coating/other behavior, pricing, OCR, seven-size, rank, coupon, DTO, idempotency, and tenant contracts need no redesign.
8. Protected-path metadata-only verification.
9. Explicit confirmation that no file, test, Git, database, Supabase, provider, Preview, or production mutation occurred.
10. Owner decision required: `NONE` or one exact question.

Stop after the report. Do not implement repairs.
