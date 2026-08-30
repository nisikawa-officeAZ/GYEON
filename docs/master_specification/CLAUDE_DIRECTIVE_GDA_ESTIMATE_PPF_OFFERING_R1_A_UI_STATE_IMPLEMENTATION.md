# Claude Directive — GDA Estimate PPF Offering R1-A UI/State Implementation

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_PPF_OFFERING_R1_A_UI_STATE_IMPLEMENTATION_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-PPF-OFFERING-R1-A`
- Mode: bounded UI/state implementation and focused tests only
- Responsible implementation agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This phase does not authorize server-save enforcement, SQL/RPC changes, database access, Preview or production changes, PR mutation, Ready, merge, or deployment.

## Invocation identity

At invocation, MacBook Codex must supply the exact accepted governance execution HEAD and tree containing this directive.

- Branch must be `agent/estimate-ppf-offering-r1`.
- Fixed source base must remain `81fd36bf5c73cb84b872deaf4ab3211a634fbe1f` with tree `0fc2f7877ab846ac7d9700986ee0f68d4e88f4b0`.
- Governance parent must include `d1a4cd29ac611e4cf42002a7c51a49239423808d` as an ancestor.
- The worktree and index must be clean before implementation.
- If any identity or clean-state condition fails, stop with `BLOCKED_BASE_MISMATCH` and change nothing.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. Latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
5. This directive

Then state the phase, exact write allowlist, protected paths, frozen behavior, commands, and stop boundary before editing.

## Literal implementation write allowlist

Only these five paths may be created or modified:

1. `src/components/estimates/wizard/EstimateWizard.tsx`
2. `src/components/estimates/wizard/steps/Step3Category.tsx`
3. `src/components/estimates/wizard/steps/Step3Category.test.tsx` (new)
4. `src/components/estimates/wizard/steps/Step4Estimate.tsx`
5. `src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`

No other path may change. Do not edit governance documents during implementation.

## Additional read authority

In addition to the mandatory governance reads, only these existing source paths may be opened or searched:

1. the four existing write-allowlist paths
2. `src/components/estimates/wizard/ui.tsx`
3. `src/components/estimates/wizard/screens/PpfSelector.tsx`
4. `src/components/estimates/wizard/screens/PpfInstallationMethodSelector.tsx`
5. `src/components/estimates/wizard/screens/PpfPartialPartsSelector.tsx`
6. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
7. `src/components/estimates/wizard/bridge/ew-ui1-controller.ts`
8. `src/components/estimates/wizard/bridge/ew-ui1-to-draft.ts`
9. `src/components/estimates/wizard/draft/wizard-draft-types.ts`
10. `src/components/estimates/wizard/draft/wizard-draft-state.ts`
11. `src/components/estimates/wizard/wizard-types.ts`
12. `src/lib/estimates/service-categories.ts`

The new Step-3 test has no pre-existing content to read. Do not search the repository broadly or open callers, siblings, tests, generated files, or migrations outside this list.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs:

- `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `32fda49583ae1217bc13711784ad8fa31744726c`
- `fe3c80f22fd80dcbfab076082473216dda582c14`

Verify only pathname, mode, blob, and Git state.

## Frozen behavior

### Step 3 main PPF control

1. `EstimateWizard` passes the existing server-resolved `screenConfig.serviceOfferings.ppf` authority into Step 3. Do not add another settings read or fallback.
2. When `ppf === true`, the existing PPF control is enabled and selectable.
3. When `ppf === false`, the PPF control remains in the existing seven-category grid but is disabled and visually gray.
4. Show this exact reason near the disabled PPF control: `店舗設定でPPFが「提供しない」に設定されています。`
5. Clicking or invoking the disabled PPF path must emit no `api.updateStore` call. A stale selected PPF id may not render as an active blue selection while the current authoritative offering is off.
6. All six other category controls retain their current selection, order, labels, layout, and behavior.

### Step 4 attached partial PPF

1. When coating is selected, main PPF is not selected, PPF is offered, and PPF prerequisites are complete, show one compact action labelled exactly `部分PPFを追加` within the existing coating section.
2. Activating it must make exactly one canonical `api.updateStore` call whose patch:
   - preserves the existing selected-category order;
   - appends the existing `ppf` category only when absent;
   - sets the existing `services.ppf.installationMethod` to `partial`;
   - leaves every unrelated service configuration untouched.
3. After emitting the patch, open the existing `ppf` section. Reuse `PpfSelector`; create no second partial-PPF component, category, draft section, price path, line identity, or persistence shape.
4. When PPF is already selected, do not show the attached action; the existing PPF tab and full/partial flow remain authoritative.
5. When PPF is not offered, do not show or enable the attached action.
6. When PPF is offered but its global methods/parts/type-group prerequisites are incomplete, show the attached action disabled and show the existing administrator-directed setup reason. Do not mislabel this as dealer opt-out.
7. The action must not appear for a non-coating-only selection unless coating is among the selected categories.

### Scope boundary

- Do not change pricing, totals, review, save intent, persistence, RPC, SQL, migrations, settings UI, OCR, vehicle sizing, rank rules, or any non-PPF family.
- Do not add client storage, effects that rewrite a restored draft, fabricated configuration, or fallback prices.
- Phase A is presentation and canonical UI patching only. Server rejection of stale or hostile PPF state remains mandatory Phase B/C work.
- Preserve PC, Tablet, and Mobile layout. No redesign, new icon family, or unrelated wording change.

## Required implementation shape

Keep the smallest implementation consistent with the existing components:

- Extend `Step3Category` with one explicit PPF-offering input; do not pass the entire runtime object if a boolean is sufficient.
- Use the existing `SelectButton` disabled behavior and existing visual tokens. Add only the minimum gray override necessary to prevent a stale selected PPF id from appearing active.
- Keep the attached-partial patch constructor pure and directly testable. It may be exported from `Step4Estimate.tsx`; do not create another file.
- Do not make `PpfSelector`, the pricing adapter, or save mapper responsible for selecting the category.

## Required tests

### New `Step3Category.test.tsx`

Prove at minimum:

1. offered PPF renders enabled and selected state works;
2. offered PPF invokes exactly one category patch;
3. not-offered PPF remains rendered, is disabled/gray, and contains the exact Japanese reason;
4. not-offered PPF emits zero patches, including when a stale `ppf` id exists in the supplied store;
5. the other six controls remain enabled and preserve their current behavior.

### Updated `Step4Estimate.binding.test.tsx`

Prove at minimum:

1. coating-only + PPF offered/configured renders `部分PPFを追加`;
2. its pure action patch appends `ppf`, preserves existing category order, and sets only `services.ppf.installationMethod = "partial"`;
3. no duplicate `ppf` is introduced;
4. PPF off renders no attached action;
5. PPF already selected renders no attached action;
6. PPF offered but incomplete renders a disabled attached action plus the existing administrator reason;
7. selecting main PPF still exposes the existing full and partial installation methods;
8. every non-PPF family remains unaffected;
9. existing PPF R1 configuration bindings remain unchanged.

Do not weaken or delete an unrelated assertion to make the new behavior pass. Replace only the old PPF-specific hide expectation that conflicts with the frozen owner behavior; keep opt-out behavior for the other managed families unchanged.

## Allowed verification commands

Run only:

1. `node --import tsx --test src/components/estimates/wizard/steps/Step3Category.test.tsx src/components/estimates/wizard/steps/Step4Estimate.binding.test.tsx`
2. `npm run typecheck`
3. `git diff --check`
4. read-only Git identity/status/diff-name/stat commands
5. protected-path `git ls-files -s -- <path>` metadata checks

Do not run build, browser, E2E, application runtime, database, Supabase, Docker, Colima, Vercel, provider, network, or package-install commands.

## Git boundary

- Do not stage, commit, push, create or modify a PR, mark Ready, merge, deploy, restore, stash, clean, or delete anything.
- Do not touch pre-existing unrelated changes. If the worktree is not clean at start, stop.
- At completion, the unstaged diff must contain exactly the five-path allowlist subset actually required, with no other changed or untracked path.

## Required result schema

Return:

1. `verdict`: `PASS`, `FAIL`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, full start/end HEAD and tree, and clean start state.
3. Exact changed/untracked paths and explicit confirmation that they are within the five-path allowlist.
4. Concise implementation summary for Step 3 and attached partial PPF.
5. Focused test command and exact pass/fail counts.
6. Typecheck command and result.
7. `git diff --check` result.
8. Protected metadata-only blob verification.
9. Explicit confirmation: no pricing/save/RPC/SQL/DB/provider/Preview/production action.
10. Owner decision required: `NONE` or one exact question.

Stop after returning the report. Do not deliver Git changes.
