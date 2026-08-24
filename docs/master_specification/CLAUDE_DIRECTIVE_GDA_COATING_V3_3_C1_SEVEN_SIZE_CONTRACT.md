# Claude Directive — GDA Coating V3.3 C1 Seven-Size Contract

## 1. Control metadata

| Field | Value |
|---|---|
| Directive ID | `GDA_COATING_V3_3_C1_SEVEN_SIZE_CONTRACT` |
| Status | `PREPARED_NOT_AUTHORIZED` |
| Responsible implementer | MacBook Claude |
| Specification authority and acceptance | MacBook Codex |
| Product authority | Office AZ / owner |
| Repository | `nisikawa-officeAZ/GYEON` |
| Required base branch | `main` |
| Prepared base commit | `372bb9d3dc625b3ff978c4f2a71401043078eb26` |
| Prepared base tree | `b9be41da4e116bb591af42763d1f145ca4785be7` |
| Canonical product specification | `GDA_COATING_SETTINGS_FORMAL_SPEC_CHANGE_V3.md` V3.3 |
| Canonical specification SHA-256 | `a44900105190c7af5232192f24e1336fa5d85cfefa2e2fa2ed17813da688d97c` |
| Evidence target | E2 uncommitted local candidate |

This directive is complete but is not implementation authority by itself.

Before Claude may edit a file, MacBook Codex must:

1. register this phase in `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` and `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`;
2. deliver the governing documentation to Git;
3. publish the newest non-superseded Claude instruction on the active coordination Draft PR;
4. confirm the exact current base commit and tree still match this directive, or supersede this directive with corrected values; and
5. receive separate owner authorization for implementation.

If any prerequisite is missing, Claude must stop without editing.

## 2. Mandatory first reads

Claude must read completely, in this order:

1. root `AGENTS.md`;
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`;
3. the latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`;
4. the complete canonical V3.3 specification identified above; and
5. the newest non-superseded Claude instruction on the active coordination Draft PR.

Claude must then state the active phase, exact base, literal allowlist, protected paths, commands, prohibitions, and stop boundary before editing.

## 3. Objective

Establish exactly one canonical vehicle-size contract across the unprotected source paths covered by this phase:

`SS / S / M / ML / L / LL / XL`

This phase removes `XXL` from new operations and makes `XL` the maximum result of the existing 3M classifier without changing any existing numeric boundary.

This phase does not implement the new coating price-entry UI or the new direct-price data architecture.

## 4. Owner decisions frozen by this phase

1. The official vehicle-size set contains exactly seven values: `SS`, `S`, `M`, `ML`, `L`, `LL`, `XL`.
2. `XXL` is abolished.
3. `XXL` must not be merged, aliased, mapped, automatically converted, or used as a price fallback for `XL`.
4. `XL` is the maximum classification returned for a 3M value at or above the existing maximum boundary.
5. The existing 3M thresholds are preserved exactly in C1. Claude must not invent, move, reinterpret, or optimize a threshold.
6. OCR or entered dimensions continue to use `length_m + width_m + height_m`.
7. Automatic selection remains correctable by the operator. C1 must not remove or weaken manual correction.
8. Historical finalized estimates, invoices, work records, and snapshots must not be rewritten or recalculated.
9. Existing persisted `XXL` values must not be queried, migrated, updated, or converted in C1. Their read-only inventory and manual-remediation flow require a separate authorized gate.

## 5. Literal implementation allowlist

Claude may modify or add only these paths:

1. `src/lib/dealer-settings/dealer-settings-types.ts` — MODIFY
2. `src/lib/dealer-settings/dealer-settings-defaults.ts` — MODIFY
3. `src/lib/pricing/pricing-data.ts` — MODIFY
4. `src/lib/pricing/pricing-engine.ts` — MODIFY, comment/type-description correction only; no calculation rewrite
5. `src/lib/vehicles/body-size-estimate.ts` — MODIFY
6. `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — MODIFY, remove only the `XXL` size option
7. `src/lib/vehicles/body-size-estimate.test.ts` — ADD
8. `src/lib/pricing/body-size-contract.test.ts` — ADD

No other path may change. A required change outside this list is a stop condition, not permission to broaden the phase.

## 6. Exact implementation requirements

### 6.1 Canonical type

In `dealer-settings-types.ts`:

- `BodySizeKey` must be exactly `"SS" | "S" | "M" | "ML" | "L" | "LL" | "XL"`.
- Do not add an alias, legacy union member, compatibility type, coercion function, or fallback for `XXL`.
- Keep the current `base_price_m` and `size_multipliers` architecture temporarily unchanged except that its size-key set becomes exactly seven values. Direct per-size prices belong to C2.

### 6.2 Defaults

In `dealer-settings-defaults.ts`:

- `size_multipliers` must contain exactly the seven canonical keys.
- Preserve every existing multiplier for those seven keys byte-for-value.
- Remove only the `XXL` entry. Do not redesign coating pricing in C1.

### 6.3 Shared pricing data and PPF fallback removal

In `pricing-data.ts`:

- `BODY_SIZES` must contain exactly seven entries in this exact order: `SS`, `S`, `M`, `ML`, `L`, `LL`, `XL`.
- Preserve the existing label and multiplier of every retained entry.
- Remove the `XXL` body-size entry.
- Remove every `XXL` key from `PPF_PLAN_PRICES`.
- Remove the obsolete comment that describes `XXL` as an `XL` fallback.
- Preserve all seven retained PPF prices exactly.
- Do not change PPF products, film types, ranks, plans, labels, or formulas.

### 6.4 Pricing-engine description

In `pricing-engine.ts`:

- Remove `XXL` only from the `PpfInput.sizeKey` size-description comment.
- Do not change `calcCoating`, `calcPpf`, a formula, a fallback, an input interface, a persisted snapshot, or runtime behavior in this phase.

### 6.5 3M classifier

In `body-size-estimate.ts`:

- Every size list and type description must identify exactly seven canonical sizes.
- Use the canonical `BodySizeKey` type where this can be done inside the allowlist without weakening type safety.
- Preserve the existing thresholds exactly:
  - `< 6.9` → `SS`
  - `< 7.3` → `S`
  - `< 7.9` → `M`
  - `< 8.3` → `ML`
  - `< 8.6` → `L`
  - `< 8.9` → `LL`
  - all remaining finite values → `XL`
- The former terminal `XXL` result must become `XL`.
- Preserve OCR dimension priority, approximate maker fallback, unknown-vehicle null behavior, rounding, basis text, and every dimension-map value.
- Do not add threshold validation, new vehicle data, or new estimation behavior in C1.

### 6.6 Onboarding size choice

In `CustomerVehicleOnboardingWizard.tsx`:

- Remove only the `XXL` button/option from the body-size choices.
- Preserve the exact order, labels, callbacks, state, validation, saving, permissions, and layout of the seven retained options.
- Do not redesign the onboarding UI.

## 7. Required focused tests

### 7.1 `body-size-estimate.test.ts`

The test must prove at minimum:

1. each existing boundary transition remains unchanged;
2. `9.19` resolves to `XL`;
3. `9.2` resolves to `XL`;
4. a clearly larger finite value resolves to `XL`;
5. explicit OCR dimensions producing a value above the last boundary resolve to `XL`;
6. an unknown vehicle without dimensions still returns `sizeKey: null` and does not fabricate a result; and
7. no result produced by the tested public functions equals `XXL`.

Do not invent a new threshold expectation.

### 7.2 `body-size-contract.test.ts`

The test must prove at minimum:

1. `BODY_SIZES.map(size => size.key)` exactly equals `SS, S, M, ML, L, LL, XL` in order;
2. the retained labels and multipliers are unchanged;
3. every `PPF_PLAN_PRICES` plan has exactly those seven keys;
4. retained PPF values are unchanged;
5. `DEFAULT_SERVICE_PRICE_SETTINGS.coating.size_multipliers` has exactly those seven keys; and
6. no inspected exported runtime structure in this test contains an `XXL` key.

## 8. Validation commands

Run each command exactly once, after implementation:

```bash
node --import tsx --test src/lib/vehicles/body-size-estimate.test.ts src/lib/pricing/body-size-contract.test.ts
npx tsc --noEmit
git diff --check
```

Do not run the full test suite or a build unless MacBook Codex separately authorizes it after a focused failure that cannot be isolated.

## 9. Protected paths

The following paths remain protected:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
  - Prepared-base metadata: `100644 blob c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
  - Pathname, mode, blob, and Git state only.
  - Never open, read, grep by content, diff, copy, stage, or modify it.
- `supabase/migrations/20260801110110_line_link_tokens.sql`
  - Prepared-base metadata: `100644 blob accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
  - Prepared-base metadata: `100644 blob 32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
  - Prepared-base metadata: `100644 blob fe3c80f22fd80dcbfab076082473216dda582c14`

No protected path may be included in a content search. Use literal exclude rules before running a search.

## 10. Prohibited work

C1 does not authorize:

- the direct seven-size coating-price architecture;
- `pricesBySize` or upper-layer product pricing;
- coating settings UI implementation;
- GenSpark asset binding;
- OCR upload or production-wizard wiring;
- changes to 3M thresholds;
- historical `XXL` data reads or conversion;
- DB, Supabase, Auth, Storage, LINE, migration, RLS, RPC, API, environment, or external-service access;
- dependency, configuration, route, permission, or unrelated UI changes;
- test-fixture weakening or test deletion;
- branch deletion, stash, restore, cleanup, broad staging, or destructive action;
- stage, commit, push, Ready conversion, merge, Preview, production deployment, or GitHub posting.

## 11. Stop conditions

Stop without broadening scope if:

1. the GitHub main commit/tree differs from the authorized base;
2. the working tree or index is not clean before implementation;
3. the canonical specification hash differs;
4. the newest Draft-PR instruction does not match this phase and base;
5. a protected path would need content access;
6. a compile or focused-test repair requires a path outside the allowlist;
7. a retained threshold, price, label, callback, permission, route, or behavior would need to change;
8. persisted `XXL` data must be read or modified; or
9. any instruction implies automatic `XXL` to `XL` conversion.

## 12. Required result report

Return exactly one self-contained report named:

`GDA_COATING_V3_3_C1_SEVEN_SIZE_CONTRACT_RESULT_V1`

It must include:

- repository identity and origin URL;
- base branch, commit, tree, isolated worktree, candidate branch, HEAD, index, and worktree state;
- canonical-spec path and verified SHA-256;
- literal allowlist and actual changed paths;
- concise per-path change description;
- proof that thresholds and retained prices were unchanged;
- focused-test command, individual test count, pass/fail count, and exit code;
- typecheck command and exit code;
- `git diff --check` result;
- protected-path mode/blob and absent-from-diff proof, without content access;
- explicit flags for tests, build, DB, Supabase, Auth, Storage, LINE, migrations, external services, stage, commit, push, Ready, merge, and deployment;
- ambiguities, failures, or stopped conditions; and
- exact next gate.

The candidate must remain uncommitted. Stop after reporting.
