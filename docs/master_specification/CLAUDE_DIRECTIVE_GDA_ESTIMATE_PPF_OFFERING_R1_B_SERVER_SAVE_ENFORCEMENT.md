# Claude Directive — GDA Estimate PPF Offering R1-B Server Save Enforcement

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_PPF_OFFERING_R1_B_SERVER_SAVE_ENFORCEMENT_RESULT_V1`

## Phase and authorization

- Phase: `GDA-ESTIMATE-PPF-OFFERING-R1-B`
- Mode: bounded server-save enforcement implementation and focused tests only
- Responsible implementation agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Product authority: Office AZ

This phase makes the existing authoritative save orchestrator reject PPF-bearing intent when the current dealer-owned PPF offering is off. It does not authorize SQL/RPC enforcement, database access, client draft rewriting, Preview or production changes, PR mutation, Ready, merge, or deployment.

## Invocation identity

At invocation, MacBook Codex must supply the exact accepted governance execution HEAD and tree containing this directive.

- Repository: `nisikawa-officeAZ/GYEON`
- Branch must be `agent/estimate-ppf-offering-r1`.
- Phase-A source predecessor must be commit `58d5b044117a33233eb4899550fb9e75a91b8c40` with tree `66b369a49efdd1536a3800e30b0394f84b51f370`.
- Fixed source base remains commit `81fd36bf5c73cb84b872deaf4ab3211a634fbe1f` with tree `0fc2f7877ab846ac7d9700986ee0f68d4e88f4b0`.
- The Phase-A predecessor and fixed source base must both be ancestors of the supplied governance execution HEAD.
- The committed delta from the Phase-A predecessor to the supplied governance execution HEAD must contain exactly these three governance paths:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_B_SERVER_SAVE_ENFORCEMENT.md`
- The worktree and index must be clean before implementation.

If any identity, ancestry, exact-delta, or clean-state condition fails, return `BLOCKED_BASE_MISMATCH` and change nothing.

## Mandatory first reads

Read completely, in order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_READ_ONLY_DIAGNOSIS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PPF_OFFERING_R1_A_UI_STATE_IMPLEMENTATION.md`
6. This directive

Then state the active phase, exact write allowlist, protected paths, frozen behavior, allowed commands, and stop boundary before editing.

## Literal implementation write allowlist

Only these five existing paths may be modified:

1. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
2. `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts`
3. `src/components/estimates/wizard/save/wizard-save-intent-types.ts`
4. `src/components/estimates/wizard/save/wizard-save-observability.ts`
5. `src/components/estimates/wizard/save/wizard-save-observability.test.ts`

No file may be created, deleted, renamed, formatted, staged, or modified outside this list. Do not edit governance documents during implementation.

## Additional read authority

In addition to the mandatory governance reads, only these paths may be opened or searched:

1. the five implementation write-allowlist paths
2. `src/components/estimates/wizard/save/save-estimate-from-wizard-intent-action.ts`
3. `src/components/estimates/wizard/save/wizard-save-intent-validation.ts`
4. `src/components/estimates/wizard/draft/wizard-draft-types.ts`
5. `src/components/estimates/wizard/draft/wizard-draft-state.ts`
6. `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
7. `src/lib/wizard-catalog/wizard-runtime-config.ts`

Do not search the repository broadly and do not open callers, siblings, tests, migrations, or generated artifacts outside this list.

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

1. The current dealer-bound runtime is the only PPF-offering authority. Use `runtime.screenConfig.serviceOfferings.ppf`; do not accept an offering flag, rank, catalog inference, or fallback from the client.
2. Keep the current ordering through runtime load, tenant identity validation, and exact configuration-revision validation.
3. After the revision check and before server pricing, reject a PPF-bearing validated draft when the authoritative offering is `false`.
4. The rejection result is the new stable public failure literal `service-not-offered`. It carries no raw value, PPF details, customer/vehicle content, runtime reason, stack, or free text.
5. Report exactly one pre-persist observability event for this rejection. Map it to stage `service-offering`, code `VALIDATION_ERROR`, severity `info`, and the already resolved dealer id.
6. The rejection must occur before pricing, mapping, DTO validation, or persistence. None of those dependencies may run.
7. When PPF is offered, the current full-PPF and partial-PPF save flow remains byte-for-byte equivalent in behavior.
8. When PPF is off, a normal non-PPF draft whose required PPF configuration section is still at its canonical initial defaults remains valid. The mere structural presence of that required default section is not PPF intent.
9. The following each make a draft PPF-bearing and therefore denied while off:
   - `serviceSelection.selectedCategories` contains `ppf`;
   - `installationMethod` is non-null;
   - `fullCoverage` is non-null;
   - `selectedPartIds` is non-empty;
   - `quantitiesByPart` has any key;
   - `ppfTypeId` is non-null;
   - `unitPriceInput` is non-empty;
   - `vehicleCoefficientInput` differs from the canonical default string `1.0`;
   - `interiorRows` is non-empty.
10. Do not silently remove or normalize hostile/stale PPF state on the server. Reject it so the client cannot mistake an altered estimate for a successful save.
11. Keep stale-revision precedence: if the expected configuration revision does not match the loaded runtime, return `stale-config-revision` before evaluating PPF intent.
12. No non-PPF service family, pricing rule, rank rule, setting, DTO shape, idempotency behavior, tenant boundary, or persistence behavior may change.

## Required implementation shape

- Implement one small pure predicate in `wizard-save-intent-orchestrator.ts` that detects PPF-bearing canonical draft state using the exact rules above. It may be exported for direct tests; do not create another file.
- Invoke it only after the current revision equality guard and only when `runtime.screenConfig.serviceOfferings.ppf === false`.
- Add `service-not-offered` to `WizardSaveIntentFailure`. Preserve the existing result union and pre-/post-persist reporting ownership.
- Add the exhaustive observability mapping and update exact-count assertions. Do not add a new `EstimateSaveActionErrorCode`; `VALIDATION_ERROR` is the existing safe code for this pre-persist rejection.
- Do not modify `save-estimate-from-wizard-intent-action.ts`; it already injects the authoritative runtime loader and orchestrator.
- Do not modify structural intent validation. A structurally valid hostile intent is rejected by server authority after the runtime and revision are known.

## Required focused tests

### `wizard-save-intent-orchestrator.test.ts`

Prove at minimum:

1. PPF off plus a canonical default PPF section and no selected `ppf` proceeds to pricing and persistence.
2. PPF off plus selected `ppf` returns exactly `service-not-offered` and pricing, mapper, DTO validation, and persistence are never invoked.
3. PPF off plus partial PPF configuration without the category is rejected before pricing.
4. Each of the nine PPF-bearing signals listed above is independently rejected while off.
5. PPF offered preserves full and partial PPF paths and reaches the existing downstream sequence.
6. A stale revision takes precedence over PPF-off rejection and nothing downstream runs.
7. Dealer/runtime mismatch still takes precedence and nothing downstream runs.
8. The rejection reports exactly one `service-not-offered` event with the resolved dealer id and returns no raw or internal detail.
9. All non-PPF families remain unaffected.
10. A throwing reporter cannot change the typed `service-not-offered` result.

### `wizard-save-observability.test.ts`

Prove at minimum:

1. `service-not-offered` is included in the exhaustive pre-persist failure list and map count.
2. It emits stage `service-offering`, code `VALIDATION_ERROR`, and severity `info`.
3. Its event contains only the existing sanitized event keys and no PPF/customer/vehicle/draft content.
4. Existing stage, code, severity, and persistence-ownership contracts remain unchanged.

Do not delete or weaken unrelated assertions to make the new behavior pass.

## Allowed verification commands

Run each at most once:

1. `node --import tsx --test src/components/estimates/wizard/save/wizard-save-intent-orchestrator.test.ts src/components/estimates/wizard/save/wizard-save-observability.test.ts`
2. `npm run typecheck`
3. `git diff --check`
4. read-only Git identity/status/diff-name/stat commands
5. protected-path `git ls-files -s -- <path>` metadata checks

Do not install packages or create/symlink dependencies. If the committed worktree lacks usable dependencies, skip the affected command, report `VERIFICATION_BLOCKED_DEPENDENCIES`, and leave verification to MacBook Codex. Do not convert an environment blocker into a source change.

Do not run build, browser, E2E, application runtime, database, Supabase, Docker, Colima, Vercel, provider, network, or package-install commands.

## Git and stop boundary

- Do not stage, commit, push, create or modify a PR, mark Ready, merge, deploy, restore, stash, clean, or delete anything.
- Do not touch pre-existing unrelated changes. If the worktree is not clean at start, stop.
- At completion, the unstaged diff must contain exactly the five-path allowlist subset actually required, with no other changed or untracked path.
- Phase C remains mandatory: direct RPC callers must independently enforce the same dealer-owned PPF offering in a forward-only SQL migration and disposable-database acceptance gate. Phase B does not claim bypass-proof persistence by itself and must not be merged independently.

## Required result schema

Return:

1. `verdict`: `PASS`, `FAIL`, `VERIFICATION_BLOCKED_DEPENDENCIES`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, full start/end HEAD and tree, ancestry results, exact governance-delta paths, and clean start state.
3. Exact changed/untracked paths and confirmation that they are within the five-path implementation allowlist.
4. Concise explanation of the predicate, guard order, stable failure, and observability mapping.
5. Focused test command and exact pass/fail/skip counts, or the exact dependency blocker.
6. Typecheck command and result, or the exact dependency blocker.
7. `git diff --check` result.
8. Protected metadata-only blob verification.
9. Explicit confirmation that pricing, mapping, DTO, persistence, action wiring, RPC, SQL, migration, DB, provider, Preview, and production were not changed or contacted beyond the exact bounded tests.
10. Owner decision required: `NONE` or one exact question.

Stop after returning the report. Do not deliver Git changes.
