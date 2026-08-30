# Claude Directive — GDA Estimate Managed Service Offering R1-A Server Save Implementation

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_A_SERVER_SAVE_IMPLEMENTATION_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-MANAGED-SERVICE-OFFERING-R1-A`
- Mode: bounded server-save implementation and focused verification only
- Responsible implementation agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This phase generalizes the existing authoritative PPF-only save guard to all five dealer-managed service families. It does not authorize UI changes, SQL/RPC/migration work, database access, Git delivery, PR mutation, Preview or production actions, Ready, merge, or deployment.

## Invocation identity

At invocation, MacBook Codex must supply the exact accepted governance execution HEAD and tree containing this directive.

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#44`, which must remain `OPEN/Draft`.
- Branch must be `plan/estimate-managed-service-offering-enforcement-r1`.
- Governance predecessor must be commit `387d8993d542a001ff2c9f2e54ff275789591f9d` with tree `035cf5f2b2884635e3834e6026720558e71f48db`.
- Fixed source base must remain commit `7aca4e7dfcebb4bd71cb8d1d2db0dbda71644110` with tree `bde678a017a875b46df56bfe0c054670c61128ec`.
- Both must be ancestors of the supplied governance execution HEAD.
- The committed delta from the governance predecessor to the supplied execution HEAD must contain exactly these three governance paths:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_A_SERVER_SAVE_IMPLEMENTATION.md`
- The worktree and index must be clean before implementation.

If identity, ancestry, exact-delta, PR state, or clean-state verification fails, return `BLOCKED_BASE_MISMATCH` and change nothing.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_MANAGED_SERVICE_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_B_SERVER_SAVE_ENFORCEMENT.md`
6. This directive

Then state the active phase, exact write allowlist, protected paths, frozen behavior, allowed commands, and stop boundary before editing.

## Literal implementation write allowlist

Only these two existing paths may be modified:

1. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
2. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts`

No file may be created, deleted, renamed, formatted, staged, or modified outside this list. Do not edit governance documents during implementation.

## Additional read authority

In addition to the mandatory governance reads, only these paths may be opened or searched:

1. the two implementation write-allowlist paths
2. `src/lib/estimates/service-categories.ts`
3. `src/components/estimates/wizard/draft/wizard-draft-types.ts`
4. `src/components/estimates/wizard/draft/wizard-draft-state.ts`
5. `src/components/estimates/wizard/save/wizard-save-intent-types.ts`
6. `src/components/estimates/wizard/save/wizard-save-observability.ts`
7. `src/components/estimates/wizard/save/wizard-save-observability.test.ts`
8. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
9. `src/lib/wizard-catalog/wizard-runtime-config.ts`

Do not search the repository broadly and do not open callers, UI files, migrations, SQL tests, generated artifacts, or siblings outside this list.

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

## Frozen server behavior

1. The current dealer-bound `runtime.screenConfig.serviceOfferings` is the sole server save authority for all five managed families.
2. Use the existing exported `SERVICE_FAMILIES` and `SERVICE_FAMILY_CATEGORY` mapping. Do not create a second family-to-category table or re-spell category ids in a parallel mapping.
3. Preserve current ordering through validation, actor resolution, runtime load, tenant identity, and exact revision validation.
4. After the revision guard and before server pricing, reject the entire save with the existing stable `service-not-offered` result when any disabled managed family carries intent.
5. A selected canonical category is intent. A non-default value in its canonical configuration section is also intent even when the category is absent.
6. A structurally required configuration section that exactly matches the canonical initial draft is not intent.
7. Never silently remove, rewrite, normalize away, or partially save disabled-family intent.
8. Reuse the existing sanitized observability contract unchanged: one `service-offering` / `VALIDATION_ERROR` / `info` event with resolved dealer id and no family, draft, customer, vehicle, price, raw value, stack, or free text.
9. `coating` and `other` are unmanaged by this contract and remain unchanged.
10. Preserve PPF full and partial flows and the exact nine-signal PPF behavior.
11. Preserve stale-revision and tenant-mismatch precedence over service-offering rejection.
12. Do not change UI, pricing, mapping, DTO validation, persistence wiring, SQL/RPC, migrations, OCR, seven-size body classification, rank, coupons, idempotency, or tenant boundaries.

## Exact intent signals

### `window_film` / category `window` / section `windowFilm`

Intent exists when the category is selected or any of the following is true:

- `selectedAreaIds.length > 0`
- `filmTypeId !== null`
- `unitPriceInput !== ""`
- `(selectedPackageCode ?? null) !== null`
- `(selectedOptionIds?.length ?? 0) > 0`
- `Object.keys(optionQuantities ?? {}).length > 0`

### `ppf` / category `ppf` / section `ppf`

Keep the existing `isPpfBearingDraft` nine-signal behavior exactly. It may delegate to or be called by the generalized predicate, but its observable result must not change.

### `maintenance` / category `maintenance` / section `bodyMaintenance`

Intent exists when the category is selected, `menuId !== null`, or `unitPriceInput !== ""`.

### `room_cleaning` / category `roomclean` / section `roomCleaning`

Intent exists when the category is selected, `selectedMenuIds.length > 0`, or `Object.keys(unitPricesByMenu).length > 0`.

### `car_wash` / category `carwash` / section `carWash`

Intent exists when the category is selected, `menuId !== null`, or `unitPriceInput !== ""`.

## Required implementation shape

- Add one small pure family-aware predicate in `wizard-save-intent-orchestrator.ts`; do not create another file.
- Import the existing family list and family-to-category mapping from `@/lib/estimates/service-categories`.
- The predicate may use one exhaustive switch on the family only to inspect the correct draft configuration section. It must not duplicate the family-to-category mapping.
- Keep `isPpfBearingDraft` exported and behaviorally compatible for existing direct tests.
- At the existing step-7b position, detect whether any family with `serviceOfferings[family] === false` carries intent. On the first match, emit the existing sanitized report and return `service-not-offered`.
- Do not return or report the matched family and do not mutate the draft.
- Do not modify types or observability modules because the existing failure and mapping are already family-agnostic.

## Required focused tests

In `wizard-save-intent-orchestrator.test.ts`, prove at minimum:

1. All five families off plus canonical-default sections and no managed categories proceeds through the existing downstream sequence.
2. For each family, a selected canonical category while off returns exactly `service-not-offered` before pricing, mapping, DTO validation, or persistence.
3. Every non-default field signal listed above is independently rejected while its family is off, including optional/missing-compatible window-film fields.
4. Each family offered preserves its selected and configured path to the existing downstream sequence.
5. One disabled family is rejected even when other selected families are offered.
6. PPF's existing nine-signal matrix remains unchanged and passes.
7. `coating` and `other` are never blocked by this guard.
8. Stale revision and tenant mismatch still take precedence.
9. Rejection reports exactly one existing sanitized `service-not-offered` event and exposes no family or raw detail.
10. A throwing reporter cannot alter the typed rejection.
11. No existing assertion is removed or weakened.

## Allowed verification commands

Run each at most once:

1. `node --import tsx --test src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts src/components/estimates/wizard/save/wizard-save-observability.test.ts`
2. `npm run typecheck`
3. `git diff --check`
4. read-only Git identity/status/diff-name/stat commands
5. protected-path `git ls-tree HEAD -- <path>` metadata checks

Do not install packages or create/symlink dependencies. If committed dependencies are unusable, report `VERIFICATION_BLOCKED_DEPENDENCIES` and leave verification to MacBook Codex; do not convert an environment blocker into a source change.

Do not run build, browser, E2E, application runtime, database, Supabase, SQL, Docker, Colima, Vercel, provider, network, or package-install commands.

## Git and stop boundary

- Do not stage, commit, push, create or modify a PR/comment, mark Ready, merge, deploy, restore, stash, clean, reset, or delete anything.
- Do not touch pre-existing unrelated changes. If the worktree is not clean at start, stop.
- At completion, the unstaged diff must contain exactly the two implementation paths, with no other changed or untracked path.
- Phase B direct-RPC/SQL enforcement remains mandatory and separately governed. Phase A does not claim bypass-proof persistence by itself and must not be merged independently.

## Required result schema

Return:

1. `verdict`: `PASS`, `FAIL`, `VERIFICATION_BLOCKED_DEPENDENCIES`, or `BLOCKED_BASE_MISMATCH`.
2. Exact PR state, branch, full start/end HEAD/tree, ancestry results, exact governance delta, and clean start state.
3. Exact changed/untracked paths and confirmation they are exactly the two-path implementation allowlist.
4. Concise explanation of the family predicate, canonical-default handling, guard ordering, and stable failure reuse.
5. Focused test command and exact pass/fail/skip counts.
6. Typecheck command and result, or exact dependency blocker.
7. `git diff --check` result.
8. Protected metadata-only blob verification.
9. Explicit confirmation that UI, pricing, mapping, DTO, persistence wiring, RPC, SQL, migration, DB, provider, Preview, and production were not changed or contacted.
10. Owner decision required: `NONE` or one exact question.

Stop after returning the report. Do not deliver Git changes.
