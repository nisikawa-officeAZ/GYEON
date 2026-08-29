# Claude Directive — GDA Estimate Pricing Recovery R1 Read-Only Diagnosis

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_PRICING_RECOVERY_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

## Governing phase

- Phase: `GDA-ESTIMATE-PRICING-RECOVERY-R1`
- Mode: read-only diagnosis only
- Responsible implementation agent after a later gate: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Owner authority: Office AZ

## Fixed source base and invocation-time execution identity

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/preview-pricing-recovery-r1`
- Fixed source-base commit: `48de96bbf5518be3fd7fd8a3964dfd7975716165`
- Fixed source-base tree: `e25590d276237f643e9b1408e6c47d192388de07`
- At invocation, MacBook Codex must supply the exact accepted governance execution HEAD and tree containing this directive.
- The fixed source base must be an ancestor of the supplied execution HEAD.
- The committed delta from the fixed source base to the supplied execution HEAD must contain exactly the three governance paths in the active phase's governance write allowlist.
- The worktree and index must be clean, with no untracked files, before and after diagnosis.

If the branch, supplied execution HEAD/tree, ancestry, exact three-path committed delta, or clean state does not match, stop with `BLOCKED_BASE_MISMATCH` and make no further inspection. Do not require the checked-out execution HEAD to equal the older fixed source-base commit.

## Mandatory first reads

Read completely, in this order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest entry in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

Then state the phase, authorization boundary, literal read allowlist, protected paths, and responsible agent before continuing.

## Literal read allowlist

Only these paths may be opened or searched:

1. `src/app/estimates/new/page.tsx`
2. `src/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer.ts`
3. `src/lib/wizard-catalog/wizard-runtime-config.ts`
4. `src/lib/pricing/authoritative-pricing-catalog-core.ts`
5. `src/lib/pricing/authoritative-pricing-catalog-core.test.ts`
6. `src/lib/pricing/coating-v34-persisted-payload.ts`
7. `src/lib/pricing/save-authoritative-coating-v34-settings.ts`
8. `src/lib/pricing/save-authoritative-coating-v34-settings.test.ts`
9. `src/lib/pricing/coating-v34-persistence-migration.test.ts`
10. `src/lib/pricing/ppf-r1-price-contract.ts`
11. `src/lib/pricing/window-film-v1-contract.ts`
12. `supabase/migrations/070_dealer_settings_canonical.sql`
13. `supabase/migrations/20260824151255_coating_v34_atomic_persistence.sql`
14. `supabase/migrations/20260826010000_ppf_r1_atomic_price_persistence.sql`
15. `supabase/migrations/20260826143000_window_film_v1_atomic_persistence.sql`

The three mandatory governance reads above are additional read authority only for session bootstrap. Do not search the repository broadly and do not open callers or siblings outside this list.

## Protected paths

The following remain metadata-only. Do not open, read, diff, copy, stage, or modify their contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## Accepted sanitized evidence

MacBook Codex already established through authorized read-only Preview/Supabase inspection:

- The affected tenant has exactly one active membership and one active staff row for the current actor.
- Rank is `detailer`.
- Lifecycle is `CATALOG_REVIEWED`; current and reviewed revisions are both `5`; reviewed time exists.
- PPF and window-film service offerings are enabled.
- Required global counts are window areas `7`, PPF methods `5`, PPF parts `16`, and PPF type groups `11`.
- The affected `service_price_settings` JSON object has exactly one top-level key: `coating`.
- `ppf_price_tables` is null, which the strict pricing contract documents as a valid intentional default.
- Customer and vehicle counts are irrelevant to this failure and were zero in the affected Preview tenant.

Do not contact Supabase, Vercel, GitHub, a browser, or any other external service to repeat or expand this evidence.

## Required diagnosis

1. Trace the exact source path from `save_coating_v34_settings` through stored JSON to Estimate Wizard startup failure.
2. Explain why a null or incomplete `service_price_settings` row can become coating-only and why the strict reader rejects it.
3. Determine the safest repair architecture among:
   - persistence initialization of the complete canonical structure;
   - bounded compatibility normalization at the strict reader;
   - forward-only remediation of existing sparse rows;
   - a necessary combination of the above.
4. Preserve all existing security and business invariants:
   - no fabricated store-specific prices;
   - unset and explicit zero remain distinct;
   - seven sizes remain `SS / S / M / ML / L / LL / XL`;
   - coating layers remain independent;
   - PPF price tables remain independent;
   - malformed values still fail closed;
   - tenant/RLS boundaries remain unchanged;
   - no historical finalized estimate is rewritten.
5. Produce the smallest literal source/test/migration write allowlist for a later implementation gate.
6. Specify exact focused tests, mixed-version cases, existing-row remediation checks, rollback boundary, and authenticated Preview acceptance steps.
7. State whether any owner business decision is still required before implementation.

## Prohibitions

- No file edit, creation, deletion, formatting, or generated artifact.
- No test, typecheck, build, script, package manager, runtime, or application command.
- No database, Supabase, Auth, Storage, Docker, Colima, Vercel, browser, HTTP, provider, or external-service access.
- No branch, worktree, index, commit, push, PR comment, Ready, merge, deployment, or cleanup mutation.
- No GitHub Claude invocation and no additional `@claude` comment.
- No protected-path content access.
- Do not redesign the approved UI or add the queued PPF offering-control phase to this repair.

## Required result schema

Return all of the following:

1. `verdict`: `READY_FOR_IMPLEMENTATION_GOVERNANCE`, `CHANGES_REQUIRED_GOVERNANCE`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, supplied full execution HEAD/tree, fixed-base ancestry result, exact committed-delta paths, and before/after clean status.
3. Root-cause call chain with file and line references.
4. Invariant ledger: preserved, threatened, and required new regression coverage.
5. Recommended repair architecture and rejected alternatives with reasons.
6. Exact future write allowlist.
7. Exact focused verification commands, but do not run them.
8. Existing Preview-row remediation and rollback plan.
9. Authenticated Preview acceptance sequence.
10. Owner decision required: `NONE` or one exact question.

Stop after returning the report.
