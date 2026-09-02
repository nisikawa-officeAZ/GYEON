# GDA_ESTIMATE_WIZARD_OCR_CUSTOMER_MARKER_POSTAL_R7_READ_ONLY_DIAGNOSIS

Directive ID: `GDA_ESTIMATE_WIZARD_OCR_CUSTOMER_MARKER_POSTAL_R7_READ_ONLY_DIAGNOSIS_V1`

## Objective

Diagnose only the PR #48 Preview regression in which a reviewed vehicle-registration OCR result can place placeholder/repetition text such as `***` into the Estimate Wizard customer name and address, after which OCR address-to-postal completion leaves the postal code blank. Determine the exact source chain, the smallest safe later implementation allowlist, the required synthetic regression tests, and the separate environment-activation proof for the Japan Post postal master.

Do not implement, edit, test, access an environment, or infer that a placeholder always names the other party. Diagnosis and implementation remain separate gates.

## Dispatch identity

- Repository: `nisikawa-officeAZ/GYEON`
- Pull request: `#48`, required `OPEN` and `Draft`
- Base branch: `main`
- Branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- Source baseline commit: `13c0798979129302b1845d5d6e0542210dce29c4`
- Source baseline tree: `0300f36c482ab7ea008f7e8e128d6aa9a67cfd98`
- A later owner-approved dispatch must provide exact `DISPATCH_HEAD` and `DISPATCH_TREE` after this three-path governance candidate is committed and normally pushed.
- The source baseline must be an ancestor of `DISPATCH_HEAD`.
- The baseline-to-dispatch delta must be exactly the three governance paths named below.
- Responsible diagnosis agent: MacBook terminal Claude Code
- Independent acceptance authority: MacBook Codex

Return `BLOCKED_CANDIDATE_DRIFT` without diagnosis if identity, ancestry, clean committed state, exact governance delta, or protected metadata differs.

## Mandatory complete read scope

Read only these paths completely:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_CUSTOMER_MARKER_POSTAL_R7_READ_ONLY_DIAGNOSIS.md`
6. `src/lib/vehicle-registration/ocr-customer-mapping.ts`
7. `src/lib/vehicle-registration/ocr-customer-mapping.test.ts`
8. `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx`
9. `src/lib/vehicle-registration/vehicle-registration-types.ts`
10. `src/lib/vehicle-registration/ocr.ts`
11. `src/lib/ocr/wizard-customer-ocr-apply-core.ts`
12. `src/lib/ocr/wizard-customer-ocr-apply-core.test.ts`
13. `src/components/estimates/wizard/steps/Step1Customer.tsx`
14. `src/components/estimates/wizard/steps/estimate-wizard-ocr-apply.test.tsx`
15. `src/components/estimates/wizard/steps/postal-master-apply.ts`
16. `src/components/estimates/wizard/steps/postal-master-apply.test.ts`
17. `src/lib/geo/jp-postal-master-actions.ts`
18. `src/lib/geo/jp-postal-master-actions.test.ts`
19. `src/lib/geo/jp-postal-master-contract.ts`
20. `src/lib/geo/jp-postal-master-contract.test.ts`
21. `src/app/estimates/new/page.tsx`
22. `supabase/migrations/20260901001246_jp_postal_master.sql`
23. `src/lib/geo/jp-postal-master-migration-contract.test.ts`
24. `scripts/postal-master/import-japan-post.ts`
25. `scripts/postal-master/import-japan-post.test.ts`

If one additional existing path is essential, stop with `BLOCKED_READ_SCOPE` and identify the exact path and reason. Do not read it.

## Required diagnosis

### A. Customer placeholder/repetition chain

Trace the exact value path from OCR raw owner/user fields through live review analysis, default/explicit source selection, resolved customer candidate fields, Wizard customer patch construction, one combined store update, and Step-1 inputs.

Determine, without inventing document semantics:

1. Why nonblank marker text such as `***` can become the customer name and address.
2. Which existing functions treat marker text as ordinary data.
3. Whether marker recognition belongs in OCR sanitization, the shared owner/user mapping authority, the review payload, the Wizard patch core, or a minimal combination.
4. How to preserve the anti-mixing rule: name and address must come from one effective party, except where a recognized directional repetition phrase proves the other line is the same party.
5. A literal marker contract for later owner approval. At minimum analyze:
   - ASCII and full-width asterisk-only values;
   - `同上`;
   - `使用者に同じ` / `使用者住所に同じ`;
   - `所有者に同じ` / `所有者住所に同じ`.
6. Which markers mean only “not usable” and which directional phrases can safely resolve to the named opposite line.
7. How blank/unusable marker handling preserves an operator-entered value and never fabricates a customer.

Use synthetic strings only. Do not request, read, transmit, quote, or reproduce a real vehicle-registration PDF or personal/customer data.

### B. OCR address-to-postal chain

Trace the exact one-shot chain from the accepted customer patch address to `addressToPostalInvoker`, stale-response planning, authenticated server action, active-batch/RPC contract, and Step-1 postal field.

Separate these outcomes explicitly:

1. `SOURCE_DEFECT`: a usable OCR address is not passed or an invalid marker reaches lookup.
2. `MASTER_UNAVAILABLE`: source wiring is correct but migration, active batch, or imported Japan Post data is absent in the target environment.
3. `NOT_FOUND` or `AMBIGUOUS`: expected fail-closed business result.
4. `FOUND`: exact unique result formats and fills the postal field without overwriting operator input.

Do not claim an environment state from source. Return the exact later read-only environment proof needed to distinguish migration absence, no active batch, empty/incomplete import, RPC/auth failure, and a legitimate non-unique/no-match address.

### C. Later implementation boundary

Return:

- the smallest literal source/test write allowlist for placeholder/repetition handling;
- focused synthetic tests covering owner-only, user-only, same-party, separated parties, business-holder owner, every approved marker class, marker-only data, operator-value preservation, one combined customer/vehicle apply, and postal invocation only with a usable resolved address;
- the exact test commands;
- a separate environment-activation phase and commands/evidence, with no DB mutation in this diagnosis.

Do not include Step-2 chassis UI, vehicle-name authority, grade, PDF parser, body-size rules, pricing, save, schema redesign, or unrelated postal implementation changes in the later allowlist.

## Governance write allowlist

The only paths that may differ from the source baseline in the later dispatch commit are:

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_OCR_CUSTOMER_MARKER_POSTAL_R7_READ_ONLY_DIAGNOSIS.md`

This directive itself authorizes no write.

## Protected paths

`src/components/estimates/wizard/screens/ScreensPreview.tsx` is pathname/mode/blob/status metadata only. Never open, read, diff, copy, stage, or modify it.

The following also remain unchanged and content must not be opened during this diagnosis:

- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Required baseline blobs:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `line_link_tokens`: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- monthly-invoice test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## Prohibited actions

- No file edit, creation, deletion, formatting, or generated artifact.
- No executable test, typecheck, build, dev server, browser, OCR upload, or dependency command.
- No Git stage, commit, push, clean, stash, restore, PR comment, Ready, merge, or deployment.
- No database, Supabase, Auth, Storage, RPC execution, migration action, CSV download/import, provider, Vercel, Preview, production, or external-service access.
- No real PDF, PII, customer data, secrets, environment values, database rows, or logs in the diagnosis packet or result.
- No implementation recommendation that silently broadens beyond the literal later allowlist.

## Required result

Return identifier:

`GDA_ESTIMATE_WIZARD_OCR_CUSTOMER_MARKER_POSTAL_R7_READ_ONLY_DIAGNOSIS_RESULT_V1`

Then report:

1. `VERDICT`: `IMPLEMENTATION_SCOPE_READY`, `OWNER_DECISION_REQUIRED_MARKER_CONTRACT`, `CHANGES_REQUIRED`, `BLOCKED_CANDIDATE_DRIFT`, or `BLOCKED_READ_SCOPE`
2. `BASE_AND_SCOPE_PROOF`
3. `CUSTOMER_MARKER_ROOT_CAUSE`
4. `OWNER_USER_ANTI_MIXING_PROOF`
5. `PROPOSED_LITERAL_MARKER_CONTRACT`
6. `POSTAL_SOURCE_CHAIN`
7. `ENVIRONMENT_PROOF_REQUIRED`
8. `EXACT_FUTURE_WRITE_ALLOWLIST`
9. `FOCUSED_SYNTHETIC_TEST_PLAN_AND_COMMANDS`
10. `PROTECTED_AND_NO_EXTERNAL_ACTION_PROOF`
11. `REMAINING_OWNER_DECISIONS`

Stop after the result.
