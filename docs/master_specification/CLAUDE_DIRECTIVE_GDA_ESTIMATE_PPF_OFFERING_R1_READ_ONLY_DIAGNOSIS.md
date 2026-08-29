# Claude Directive — GDA Estimate PPF Offering R1 Read-Only Diagnosis

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Governing phase

- Phase: `GDA-ESTIMATE-PPF-OFFERING-R1`
- Mode: read-only diagnosis only
- Responsible implementation agent after a later gate: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This directive does not authorize implementation. It maps the exact current PPF authority and returns the smallest safe later implementation phases.

## Fixed source base and invocation-time execution identity

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/estimate-ppf-offering-r1`
- Fixed source-base commit: `81fd36bf5c73cb84b872deaf4ab3211a634fbe1f`
- Fixed source-base tree: `0fc2f7877ab846ac7d9700986ee0f68d4e88f4b0`
- At invocation, MacBook Codex must supply the exact accepted governance execution HEAD and tree containing this directive.
- The fixed source base must be an ancestor of the supplied execution HEAD.
- The committed delta from the fixed source base to the supplied execution HEAD must contain exactly these three governance paths:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
- The worktree and index must be clean, with no untracked files, before and after diagnosis.

If the branch, supplied execution HEAD/tree, ancestry, exact three-path committed delta, or clean state does not match, stop with `BLOCKED_BASE_MISMATCH` and make no further inspection. Do not require the checked-out execution HEAD to equal the older fixed source-base commit.

## Mandatory first reads

Read completely, in this order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

Then state the active phase, authorization boundary, literal read allowlist, protected paths, and responsible agent before continuing.

## Literal read allowlist

Only these paths may be opened or searched after the mandatory governance reads:

1. `src/app/estimates/new/page.tsx`
2. `src/lib/estimates/service-categories.ts`
3. `src/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer.ts`
4. `src/lib/wizard-catalog/wizard-runtime-config.ts`
5. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
6. `src/components/estimates/wizard/EstimateWizard.tsx`
7. `src/components/estimates/wizard/useEstimateWizard.ts`
8. `src/components/estimates/wizard/steps/Step3Category.tsx`
9. `src/components/estimates/wizard/steps/Step4Estimate.tsx`
10. `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`
11. `src/components/estimates/wizard/steps/step4-bindings.ts`
12. `src/components/estimates/wizard/screens/Step4Estimate.tsx`
13. `src/components/estimates/wizard/screens/PpfSelector.tsx`
14. `src/components/estimates/wizard/screens/PpfInstallationMethodSelector.tsx`
15. `src/components/estimates/wizard/screens/PpfPartialPartsSelector.tsx`
16. `src/components/estimates/wizard/screens/ppf-config.ts`
17. `src/components/estimates/wizard/draft/wizard-draft-types.ts`
18. `src/components/estimates/wizard/draft/wizard-draft-state.ts`
19. `src/components/estimates/wizard/validity/wizard-step-validity.ts`
20. `src/components/estimates/wizard/validity/wizard-step-validity.test.ts`
21. `src/components/estimates/wizard/pricing/wizard-pricing-input-adapter-config.ts`
22. `src/components/estimates/wizard/pricing/ppf-r1-wizard-pricing.test.ts`
23. `src/components/estimates/wizard/integration/estimateToWizardDraft.ts`
24. `src/components/estimates/wizard/save/wizard-save-intent-validation.ts`
25. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
26. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts`
27. `src/components/estimates/wizard/save/save-estimate-from-wizard-intent-action.ts`
28. `src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts`
29. `src/components/estimates/wizard/save/estimate-save-mapper-from-config.test.ts`
30. `src/components/estimates/wizard/save/estimate-persistence-payload.ts`
31. `src/components/estimates/wizard/production/ProductionEstimateWizard.test.tsx`
32. `supabase/migrations/20260825151059_persist_existing_vehicle_confirmed_body_size.sql`

The three mandatory governance reads above are additional read authority only for session bootstrap. Do not search the repository broadly and do not open callers, siblings, older migrations, generated files, or tests outside this list.

## Protected paths

The following remain metadata-only. Do not open, read, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs at the fixed source base:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- monthly-invoice test: `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state for these four paths.

## Frozen owner behavior

Treat the following as decided. Do not redesign or reopen these decisions:

1. When PPF is offered, the main PPF control is selectable.
2. When PPF is offered, partial PPF is available as an attached option even when coating is the only main category selected. The operator must not be forced to select the main PPF category merely to add partial PPF.
3. When PPF is not offered, the main PPF control remains visible, disabled, and gray.
4. The disabled control shows a plain-language reason that the store setting disables PPF. Do not hide it as the default design.
5. When PPF is not offered, independent PPF, attached partial PPF, PPF pricing, stale draft values, manipulated client payloads, and persisted PPF lines are rejected or removed under one server-owned contract.
6. PPF availability is dealer-owned and server-resolved. Shop rank does not replace the offering switch.
7. Existing seven-size, unset-versus-zero, PPF price-table, installation-coefficient, vehicle-coefficient, PPF-plus-coating reduction, tenant/RLS, atomic-save, and idempotency contracts remain unchanged unless one exact conflict is demonstrated.
8. The approved visual language is preserved. This phase fixes authority and behavior; it does not redesign the Estimate Wizard.

## MacBook Codex source observations to verify

These are bounded observations, not a substitute for Claude's diagnosis. Confirm or correct each with file and line references:

- Step 3 owns a static category list and receives no authoritative service-offering map, so its PPF control can be selected independently of the dealer setting.
- Step 4 filters opted-out managed families out of `visibleCategories`, so an opted-out PPF control disappears instead of rendering the approved disabled-gray state.
- The current Step-4 binding test explicitly asserts that every managed family is absent when off.
- The pricing adapter activates PPF from draft selection/configuration and does not receive the offering map directly.
- The authoritative save orchestrator reloads the current dealer-bound runtime but does not use `runtime.screenConfig.serviceOfferings.ppf` to reject PPF-bearing draft state before pricing, mapping, and persistence.
- The latest atomic-save SQL accepts PPF-category service lines but does not read `dealer_service_offerings` itself.
- Existing-estimate hydration maps persisted PPF item categories into Screen 3 but cannot reconstruct structured Screen-4 configuration.

## Required diagnosis

1. Trace the exact authority chain from `dealer_service_offerings.ppf` through the dealer-bound runtime into Step 3 and Step 4.
2. Explain why selecting PPF currently may not produce an operator-visible PPF section, and identify every current hide, filter, lock, validity, or active-section rule involved.
3. Map full PPF and attached partial PPF separately. State exactly how coating-only plus partial PPF should be represented in canonical draft state, pricing identity, review output, save DTO, RPC payload, and persisted estimate lines without inventing a second PPF business model.
4. Map every stale-state route:
   - offering switches from on to off while a wizard tab is already open;
   - a saved or browser-restored draft still contains PPF category/configuration;
   - an existing estimate contains PPF lines;
   - a manipulated save intent adds PPF category/configuration or a PPF-priced line;
   - the configuration revision changes between render and save.
5. Identify the earliest client-side normalization point and the mandatory server-side authorization point. Client cleanup is usability only and must never be the authority.
6. Determine whether the existing atomic-save RPC also needs a dealer-offering check to prevent bypass through another server caller. If yes, specify a forward-only migration phase; if no, prove which existing server boundary is the sole reachable writer and why it is sufficient.
7. Preserve all frozen contracts, especially:
   - PPF offered and configured is usable by every authorized rank;
   - PPF not offered is visible but disabled at selection, never silently selectable;
   - partial PPF is reachable from coating-only selection when offered;
   - incomplete PPF master/configuration remains distinct from dealer opt-out;
   - no fabricated or fallback price;
   - unset and explicit zero remain distinct;
   - server repricing and exact revision checks remain authoritative;
   - tenant, role, RLS, idempotency, and atomic persistence remain fail closed.
8. Produce the smallest ordered implementation plan. Split UI/state, server authorization, and SQL migration only when their authorization or verification boundaries genuinely differ. Give an exact literal write allowlist for each later phase; do not supply a broad directory.
9. Specify exact focused test commands and required cases for each later phase, but do not run them.
10. State whether any owner business decision remains. Use `NONE` unless the frozen behavior cannot be implemented without one exact unresolved choice.

## Minimum required regression cases

The report must assign each case to an exact proposed test path:

1. PPF offered: Step-3 PPF control is enabled and selectable.
2. PPF not offered: Step-3 PPF control is visible, disabled, gray, and shows the approved reason.
3. PPF offered: selecting the main PPF category exposes full and partial choices.
4. PPF offered: coating-only selection still exposes and prices attached partial PPF.
5. PPF not offered: neither main PPF nor attached partial PPF can alter canonical draft state.
6. PPF switches off after selection: stale PPF category/configuration cannot price or save.
7. Manipulated client intent containing PPF while off is rejected before persistence.
8. A stale configuration revision is rejected before persistence.
9. PPF offered but prerequisites or prices are missing: the existing setup/price failure remains distinct from opt-out.
10. PPF off affects no coating, window-film, maintenance, wash, room-cleaning, other-work, or store-option selection.
11. PPF offered preserves current R1 price, coefficient, vehicle-coefficient, partial-parts, and PPF-plus-coating reduction calculations.
12. If SQL enforcement is required, direct RPC input containing PPF while the dealer offering is off fails atomically with zero estimate/item mutation; the on case still succeeds.

## Allowed commands

Only read-only metadata and content inspection inside the literal scope:

- `git branch --show-current`
- `git rev-parse HEAD HEAD^{tree}` and the supplied/fixed commits or trees
- `git merge-base --is-ancestor <fixed-base> HEAD`
- `git diff --name-only <fixed-base>...HEAD`
- `git status --short --branch`
- `git ls-files -s -- <protected-path>`
- `sed`, `rg`, `wc`, and `sha256sum`/`shasum` limited to the mandatory governance reads and literal read allowlist

Do not use `git diff` on protected content. Do not use any command that writes a cache, generated file, dependency, index entry, or runtime artifact.

## Prohibitions

- No file edit, creation, deletion, rename, formatting, or generated artifact.
- No test, typecheck, build, script, package manager, application runtime, or browser command.
- No database, Supabase, Auth, Storage, Docker, Colima, Vercel, HTTP, provider, or external-service access.
- No branch, worktree, index, commit, push, PR comment, Ready, merge, deployment, or cleanup mutation.
- No GitHub Claude invocation and no additional `@claude` comment.
- No protected-path content access.
- No implementation code, patch, migration, or UI redesign in the returned report.
- Do not mix the paused GYEON Order C5-D work, Office AZ inventory, SaaS, coupon, OCR, or unrelated Estimate Wizard defects into this phase.

## Required result schema

Return all of the following:

1. `verdict`: `READY_FOR_IMPLEMENTATION_GOVERNANCE`, `CHANGES_REQUIRED_GOVERNANCE`, `OWNER_DECISION_REQUIRED`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, supplied full execution HEAD/tree, fixed-base ancestry result, exact committed-delta paths, and before/after clean status.
3. Protected metadata-only verification with all four blob IDs.
4. Current authority call chain with file and line references: persistence/read, runtime, Step 3, Step 4, canonical draft, pricing, server save, RPC, and persisted lines.
5. Conflict ledger: current behavior versus every frozen owner behavior.
6. Full-PPF versus attached-partial-PPF state and identity model.
7. Stale-state and hostile-input threat table, including the exact current boundary that accepts or rejects each case.
8. Recommended smallest ordered implementation phases and exact literal write allowlist for each.
9. Exact focused test commands and the test-path assignment for all twelve minimum regression cases; do not run them.
10. Migration requirement: `REQUIRED` or `NOT_REQUIRED`, with evidence and rollback boundary.
11. Authenticated Preview acceptance sequence for a PPF-on dealer and a PPF-off dealer, without executing it.
12. Owner decision required: `NONE` or one exact question.

Stop after returning the report.
