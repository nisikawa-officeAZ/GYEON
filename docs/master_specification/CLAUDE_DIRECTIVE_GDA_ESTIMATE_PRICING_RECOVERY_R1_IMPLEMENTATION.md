# Claude Directive — GDA Estimate Pricing Recovery R1 Implementation

## Result identifier

Return exactly one report headed:

`GDA_ESTIMATE_PRICING_RECOVERY_R1_IMPLEMENTATION_RESULT_V1`

## Governing phase and authority

- Phase: `GDA-ESTIMATE-PRICING-RECOVERY-R1`
- Mode: bounded two-file source implementation and focused local verification only
- Implementation agent: MacBook Claude
- Independent acceptance authority: MacBook Codex
- Owner authority: Office AZ
- Coordination PR: `#41` (`OPEN / Draft` until separately authorized otherwise)

This document does not itself authorize execution or external transmission. MacBook Codex must supply the exact accepted implementation-governance execution HEAD and tree after the separate commit/push gate, and the owner must separately authorize transmission and implementation.

## Fixed source base and future execution identity

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `agent/preview-pricing-recovery-r1`
- Fixed source-base commit: `48de96bbf5518be3fd7fd8a3964dfd7975716165`
- Fixed source-base tree: `e25590d276237f643e9b1408e6c47d192388de07`
- Diagnosis-governance execution HEAD: `862f2c18424249596df77feb6666c94ca7616c7b`
- Diagnosis-governance execution tree: `8429598f8ef4dc2dd613bdad10ccedb687099e85`
- At invocation, MacBook Codex must provide the later accepted implementation-governance HEAD/tree containing this directive.
- The fixed source base must remain an ancestor of that supplied HEAD.
- The committed delta from `862f2c18424249596df77feb6666c94ca7616c7b` to the supplied HEAD must contain exactly these three governance paths:
  1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
  2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
  3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_PRICING_RECOVERY_R1_IMPLEMENTATION.md`
- The worktree and index must be clean with no untracked files before implementation.

If branch, supplied HEAD/tree, ancestry, exact governance delta, or clean state does not match, stop with `BLOCKED_BASE_MISMATCH` and make no source change.

## Mandatory first reads

Read completely, in this order:

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. The latest entry in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. This directive

Then state the phase, authorization boundary, literal read/write allowlists, protected paths, approved commands, and responsible agent before editing.

## Accepted diagnosis and Codex scope correction

Accepted root cause:

1. `save_coating_v34_settings` applies `jsonb_set(coalesce(service_price_settings, '{}'), '{coating}', p_coating, true)`.
2. A null settings row therefore naturally becomes a coating-only object.
3. `applyServiceOverrides` currently requires `ppf`, `window_film`, `maintenance`, `carwash`, and `room_cleaning` unconditionally before accepting the valid V3.4 coating payload.
4. The first missing key causes `malformed`, which becomes `pricing-catalog-failed` and renders the generic unavailable state.

Codex scope correction:

- The diagnosis narrative incorrectly claimed that the proposed change also closes a `window_film_v1`-only case while its own required test kept that case malformed.
- This implementation fixes the observed coating-only row only.
- Valid V3.4 coating remains mandatory for every non-null `service_price_settings` object in R1.
- Do not claim that PPF-only, window-film-only, or coating-disabled stores are solved here.
- `GDA-ESTIMATE-PPF-OFFERING-R1` remains a separate queued phase and PR.

## Literal source read allowlist

Only these implementation paths may be opened or searched after the mandatory governance reads:

1. `src/lib/pricing/authoritative-pricing-catalog-core.ts`
2. `src/lib/pricing/authoritative-pricing-catalog-core.test.ts`

Do not open callers, siblings, migrations, settings actions, UI files, or generated artifacts during implementation. The accepted diagnosis already supplies the required call-chain evidence.

## Literal source write allowlist

Exactly these two paths may change:

1. `src/lib/pricing/authoritative-pricing-catalog-core.ts`
2. `src/lib/pricing/authoritative-pricing-catalog-core.test.ts`

No other file may be created, edited, deleted, formatted, staged, or generated.

## Required implementation

1. In the pure strict reader, treat each of these five legacy service sections as optional when absent or explicitly null:
   - `ppf`
   - `window_film`
   - `maintenance`
   - `carwash`
   - `room_cleaning`
2. An absent or explicit-null optional section means no override for that family. `makePricingCatalog` must retain the exact corresponding values from `DEFAULT_PRICING_CATALOG`.
3. A present, non-null optional section must pass the same complete validation that exists before this change. A wrong container, missing required nested field, malformed map entry, invalid menu, invalid label, invalid price, or invalid coefficient must still fail the entire catalog as `malformed`.
4. Keep V3.4 coating resolution mandatory and unchanged for every non-null service settings object.
5. Keep the separate `ppf_price_tables` reader and PPF R1 contract unchanged.
6. Keep `window_film_v1` parsing unchanged.
7. Do not fabricate store-specific prices or persist defaults.
8. Preserve unset versus explicit zero, seven sizes `SS / S / M / ML / L / LL / XL`, independent coating layers, tenant/RLS boundaries, and historical finalized estimates.
9. Prefer one small helper that distinguishes absent/null from present values and invokes existing validators without duplicating validation logic.

## Required regression coverage

Add focused tests proving all of the following:

1. A valid V3.4 coating-only object with `ppf_price_tables === null` resolves `ok:true`.
2. Its PPF, legacy window-film, maintenance, carwash, and room-cleaning catalog families equal `DEFAULT_PRICING_CATALOG` exactly.
3. For each of the five optional sections, both absence and explicit null resolve as no override when a valid V3.4 coating payload is present.
4. For each optional section, a present but malformed value still returns exactly `{ ok:false, reason:'malformed' }`.
5. A complete valid six-section object preserves current successful output parity.
6. `service_price_settings === null` preserves full canonical-default behavior.
7. Explicit zero remains a valid coating price and is not converted to null or default.
8. A `window_film_v1`-only object without valid V3.4 coating remains malformed. This test is mandatory and records the R1 scope boundary.
9. Inputs remain immutable.

## Approved verification commands

Run only these commands, in this order, after the two-file edit:

```bash
node --import /Users/atsushinishikawa/dealeros/node_modules/tsx/dist/loader.mjs --test src/lib/pricing/authoritative-pricing-catalog-core.test.ts
/Users/atsushinishikawa/dealeros/node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

If any command fails, stop and report the exact failure. Do not broaden the write allowlist or run additional tests without a new owner-authorized correction.

## Protected paths

Metadata only. Never open, read, diff, copy, stage, or modify contents:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Expected blobs at the diagnosis boundary:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- monthly-invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- monthly-invoice test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## Prohibitions

- No database, Supabase, Auth, Storage, Docker, Colima, Vercel, browser, HTTP, provider, or other external-service access.
- No migration, SQL, RPC, settings action, UI, dependency, lockfile, config, documentation, generated file, or snapshot change.
- No subagent.
- No branch, worktree, index, stage, commit, push, PR comment, Ready, merge, deployment, cleanup, stash, reset, or restore action.
- No protected-path content access.
- Do not implement or redesign PPF offering control.
- Do not change or backfill the existing Preview row.

## Required result schema

Return one report containing:

1. `verdict`: `READY_FOR_CODEX_REVIEW`, `CHANGES_REQUIRED`, or `BLOCKED_BASE_MISMATCH`.
2. Exact branch, supplied execution HEAD/tree, fixed-base ancestry, exact three-path governance delta, and before/after clean status.
3. Exact changed paths; it must be the two-path write allowlist and nothing else.
4. Concise implementation summary with function/test names and line references.
5. Invariant ledger for defaults, malformed-present rejection, zero/unset, seven sizes, independent layers, independent PPF tables, tenant/RLS, and historical estimates.
6. Test/typecheck/diff-check commands and exact results.
7. Protected-path blob identities before and after.
8. Confirmation that no DB, external service, Git delivery, PR mutation, or out-of-scope action occurred.
9. Remaining known boundary: `window_film_v1`-only without valid V3.4 coating remains malformed and PPF offering control remains queued separately.
10. Owner decision required: `NONE` or one exact question.

Stop after returning the report. Do not commit or push.
