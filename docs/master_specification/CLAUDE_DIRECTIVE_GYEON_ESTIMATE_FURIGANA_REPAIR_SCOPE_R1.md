# Claude directive — estimate furigana required, bounded repair scope R1

Status: LOCAL GOVERNANCE CANDIDATE; scope defined, execution NOT authorized or dispatched.
Phase: GYEON_ESTIMATE_FURIGANA_REPAIR_SCOPE_R1.
Responsible: MacBook Codex scope/acceptance; MacBook Claude later repair and executable verification.
Model requested by Owner: Claude Opus 5, effort high. Verify availability at dispatch; no silent substitution.

## 1. Governing evidence

Read repository AGENTS.md and the complete GYEON_DA_COMPLETION_PLAN.md, especially sections 10, 12, 14 and 16, plus the latest accepted/pending result-ledger entries. CRM section 15 remains deferred and does not add generated readings to this repair.

Fixed source HEAD: f86e87b8c1dbe8f0e5893518ea2ff20d65afd8fb.
Fixed source tree: 227129f55e3c45b5c154f5ee97d8498cadab9808.
The accompanying GYEON_ESTIMATE_FURIGANA_REPAIR_SCOPE_R1.json records exact source/test/read-only hashes and absent-file checks. These are Codex local observations, not Claude-executed or deployed evidence.

Combined diagnosis: R1 and R2 reports plus their independent CODEX_REVIEW.md files in the wrapper evidence/furigana-diagnosis-r1-20260913 and evidence/furigana-diagnosis-r2-20260913 directories. R2 raw SHA-256 e27b737b6fafa8ac74aa0386053af410dbaec9ad389affa1b67ed1231527696e. R2 review, not the rejected raw proposal, governs the corrections below. The later execution input manifest must include the exact diagnostic artifacts and governance hashes.

This scope supersedes the local wrapper CLAUDE_FURIGANA_REPAIR_DIRECTIVE_DRAFT_R1.md proposal for file classification only. It does not supersede a remote comment until actually published. PR71 comment 5653473744 authorized diagnosis only, never repair.

## 2. Required behavior and forbidden shortcuts

- Require nonblank reading for newly created estimates in manual/OCR/existing modes, including companies. Reject whitespace-only including full-width spaces. No guessed reading, katakana-only restriction or broad legacy backfill.
- UI must provide the field-level error フリガナを入力してください. Existing authoritative reading is reused without redundant entry.
- Use a distinct supplemental reading bound to the selected customer ID. Never reuse newCustomer.kana for an existing customer. Invalidate on customer/mode changes; reject mismatched bindings. Correctness must hold for customer selection, duplicate selection and vehicle-led customer selection, not only one click handler.
- Keep selection IDs-only except an explicitly justified supplement reset. Central reducer/bridge handling may preserve existing selection helpers unchanged; paths are an upper bound, not a requirement to edit every file. Retain unrelated new-customer inputs.
- Presence hint is server-computed UI data, never authority. All preload/search/duplicate paths must select sufficient reading columns and preserve tenant filtering. Missing reading projection is unknown/error, not a false assertion that the database reading is empty. Never return the raw reading when a presence flag suffices.
- Check canonical and legacy reading columns independently. Generated match key is not a complete presence predicate. Keep comparison/whitespace behavior consistent in TS/SQL fixtures without silently normalizing existing stored values.
- Separate structural/type checks from fresh-save business enforcement. Authorized exact replay/conflict resolution precedes the new mandatory-reading check. Historically accepted blank-reading replays must remain valid.
- An absent supplemental payload field stays absent; adding null changes the whole-customer fingerprint. Supplied material intent remains fingerprinted. Same key plus changed intent is a conflict, not success. Same mount does not prove identical input.
- Supplement only the same authorized active customer if its reading is still absent, in the same atomic operation as estimate save. No separately committed customer update. Reuse existing actor and RPC tenant/role authority, with no grant/RLS expansion.
- Protect against concurrent overwrites and partial failures. Keep transactions short and no external work within locks. Prove rollback and separate-connection interleavings later; advisory idempotency locks are not customer-row locks.
- Do not change historical estimates/issued documents, tax/pricing/offering behavior, CRM, inventory, general restart recovery or closed finance. Do not infer global historical-display safety from limited contexts. Account for ordinary generated/update metadata in write-footprint assertions.

## 3. Literal source upper bound for later separately approved repair

- `src/components/estimates/wizard/steps/Step1Customer.tsx`
- `src/components/estimates/wizard/steps/existing-entity-selection.ts`
- `src/components/estimates/wizard/wizard-types.ts`
- `src/components/estimates/wizard/draft/wizard-draft-types.ts`
- `src/components/estimates/wizard/draft/wizard-draft-state.ts`
- `src/components/estimates/wizard/bridge/ew-ui1-to-draft.ts`
- `src/components/estimates/wizard/bridge/draft-to-ew-ui1.ts`
- `src/components/estimates/wizard/contract/ew-ui1-field-contract.ts`
- `src/components/estimates/wizard/validity/wizard-step-validity.ts`
- `src/components/estimates/wizard/contract/wizard-runtime-inputs.ts`
- `src/lib/estimates/wizard-entity-references.ts`
- `src/lib/estimates/dealer-wizard-entity-references.ts`
- `src/lib/estimates/get-dealer-wizard-entity-references.ts`
- `src/lib/customers/search-dealer-customers-action.ts`
- `src/lib/customers/find-wizard-customer-duplicates-action.ts`
- `src/lib/customers/find-wizard-customer-duplicates-core.ts`
- `src/components/estimates/wizard/save/wizard-save-intent-validation.ts`
- `src/components/estimates/wizard/save/estimate-save-dto.ts`
- `src/components/estimates/wizard/save/estimate-save-mapper-from-config.ts`
- `src/components/estimates/wizard/save/estimate-save-validation.ts`
- `src/lib/customers/customer-reading-presence.ts` — new pure presence helper; no IO or customer mutation.
- `supabase/migrations/20260913132430_require_estimate_customer_reading.sql` — CLI-generated empty migration, already exists; SQL authoring NOT begun.

Supabase CLI 2.116.0 generated the migration with migration new require_estimate_customer_reading after installed help inspection. Zero bytes, not applied. Do not regenerate a second filename or edit old migrations. Later authoring must preserve the current save function's replay, authorization, offering and transaction contracts. Current docs/changelog and the actual migration-chain authority must be checked before implementing or executing SQL; the local baseline alone does not prove live schema.

Duplicate lookup SELECT columns are owned by find-wizard-customer-duplicates-core.ts, so it is included for projection-only changes. Do not change duplicate-match algorithms or query thresholds.

## 4. Exact test-authoring upper bound

- `src/components/estimates/wizard/steps/existing-entity-selection.test.tsx`
- `src/components/estimates/wizard/bridge/ew-ui1-controller.test.ts`
- `src/components/estimates/wizard/contract/ew-ui1-field-contract.test.ts`
- `src/components/estimates/wizard/validity/wizard-step-validity.test.ts`
- `src/components/estimates/wizard/save/wizard-save-intent-validation.test.ts`
- `src/components/estimates/wizard/save/estimate-save-mapper-from-config.test.ts`
- `src/components/estimates/wizard/save/estimate-save-validation.test.ts`
- `src/lib/estimates/dealer-wizard-entity-references.test.ts`
- `src/lib/customers/find-wizard-customer-duplicates-core.test.ts`
- `supabase/tests/estimate_wizard_atomic_save.test.sql`
- `src/lib/customers/customer-reading-presence.test.ts` — new.
- `src/components/estimates/wizard/steps/Step1Customer.reading.test.tsx` — new.
- `scripts/e2e/gda-estimate-customer-reading/concurrency.mjs` — new.

Existing strict minimal-reference key expectations in dealer-wizard-entity-references.test.ts must be deliberately updated to the approved presence-hint contract and still exclude raw private fields. Keep negative tests, tenant failures and unrelated behavior. Extend duplicate core assertions for the projection change only. Older fixtures may omit optional fields only if omission is handled explicitly as unknown/legacy shape; never silently convert missing server evidence into a reading-presence fact.

The manifest closes this initial upper bound; it does not guarantee that later typecheck will discover no further dependency. Any additional file requires a concrete failure/dependency report and a superseding scope BEFORE edits. No broad fixture rewrite or weakening assertions to achieve PASS.

## 5. Read-only technical references

- `src/components/estimates/wizard/bridge/ew-ui1-controller.ts`
- `src/components/estimates/wizard/save/estimate-persistence-payload.ts`
- `src/components/estimates/wizard/save/wizard-save-intent-orchestrator.ts`
- `src/components/estimates/wizard/save/wizard-save-intent-types.ts`
- `src/components/estimates/wizard/save/wizard-idempotency-session.ts`
- `src/components/estimates/wizard/save/WizardSavePanel.tsx`
- `src/components/estimates/wizard/production/ProductionEstimateWizard.tsx`
- `src/components/estimates/wizard/save/estimate-save-errors.ts`
- `src/components/estimates/wizard/save/supabase-persistence-gateway.ts`
- `src/lib/auth/require-staff-capability.ts`
- `src/lib/staff/staff-types.ts`
- `supabase/migrations/20260830160000_estimate_managed_service_offering_guard.sql`

No automatic import traversal or protected-content reads. Existing initial diagnostic read scope is not a blanket write scope. If another source dependency is essential, name it and state why before expanding the execution read manifest.

## 6. Required regression matrix (unexecuted)

1. Manual/OCR blank, ASCII/full-width whitespace: field error and authoritative fresh-save rejection.
2. Valid person/company reading persists and reads back without guessed values.
3. Existing reading in each canonical/legacy column is reused. Full-width-only canonical plus valid legacy does not require re-entry.
4. Missing reading: supplement and estimate persist together, no duplicate customer.
5. New/OCR A -> existing B, B -> C, mode changes, vehicle-led and duplicate selection: no wrong-customer carry-over.
6. Tampered hint/ID/tenant/deleted customer fails closed; unknown reference state not claimed as authoritative absence.
7. Failure after supplement stage rolls back customer and estimate/number effects.
8. Separate concurrent connections: first committed reading preserved, failed competing transaction does not cause partial persistence.
9. Old exact blank-reading replay and absent-field fingerprint compatibility; new exact supplemented replay has no duplicate effects.
10. Changed material intent with same key remains conflict. Unknown outcome never becomes invented success or key rotation.
11. Historical documents and existing offering/tax/total/pricing guards retain their behavior.
12. TS and SQL presence fixtures cover null, ASCII whitespace, full-width whitespace, mixed canonical/legacy and normal readings; distinguish test source from executed results.

## 7. Activation and stop rules

This turn authorizes only this governance candidate, the manifest, plan/ledger records and the CLI-created empty migration. It does NOT authorize Claude/private transmission, source or SQL authoring, executable tests, local/shared DB operations, deployment or Git delivery.

Before later repair: deliver the approved plan under the separate Git gate; pin the actual execution HEAD/tree, source hashes, diagnostic artifact hashes and ledger range; verify the real OPEN/Draft coordination PR; publish the matching instruction; obtain the corresponding execution authority. A later governance commit changes HEAD without permitting source drift. Preserve CRM records and prior diagnosis entries.

Protected file src/components/estimates/wizard/screens/ScreensPreview.tsx remains pathname/mode/stored Git metadata only: never open/read/diff/copy/stage/modify. Preserve the LINE migration 20260801110110, closed finance migration 20260807135006, monthly-invoice-artifact-boundary.test.ts, and all four retained D3A candidates. No Studio work.

After separately authorized repair/test authoring, return a literal changed-path list, diff rationale, untouched-path evidence, unresolved items and test cases authored. STOP before running tests if only authoring was authorized. Executable tests, disposable concurrency, authenticated staging, commit, push, Ready, merge and deploy are separate gates. Do not report IMPLEMENTED_AND_VERIFIED from source alone.
