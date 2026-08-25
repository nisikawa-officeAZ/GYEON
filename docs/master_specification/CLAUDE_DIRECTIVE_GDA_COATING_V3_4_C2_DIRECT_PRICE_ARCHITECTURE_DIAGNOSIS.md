# Claude Directive — GDA Coating V3.4 C2 Direct-Price Architecture Diagnosis

## 1. Control metadata

| Field | Value |
|---|---|
| Directive ID | `GDA_COATING_V3_4_C2_DIRECT_PRICE_ARCHITECTURE_DIAGNOSIS` |
| Mode | `READ_ONLY_DIAGNOSIS_ONLY` |
| Responsible investigator | MacBook Claude |
| Specification authority and acceptance | MacBook Codex |
| Product authority | Office AZ / owner |
| Repository | `nisikawa-officeAZ/GYEON` |
| Required base branch | `main` |
| Required base commit | `0bfd69f4d6f4085163ba19599151fa689646a088` |
| Required base tree | `8ccbdf10323b710e97bb091aa7d20d022fe59973` |
| Canonical specification | `docs/master_specification/GDA_COATING_SETTINGS_FORMAL_SPEC_CHANGE_V3.md` V3.4 |
| Canonical specification SHA-256 | `4b14f28694b94352752807a6390f31562a8b04d0c1f0485cf2eb932e34d36fc5` |
| Accepted UI delivery | `gda_coating_settings_ui_v3_3_r2_r1.zip` |
| Accepted UI SHA-256 | `59e5307c2391dfb94210dd28d5f434b0edfacca7ed92d5c8a9e01b621c4f3686` |
| Evidence target | One self-contained C2 read-only architecture result |

This directive authorizes one bounded diagnosis only. It does not authorize source edits, tests, a migration, DB access, commit, push, Ready, merge, Preview, or deploy.

## 2. Mandatory first reads

Read completely, in this order:

1. root `AGENTS.md`;
2. root `OPERATIONS_RULES.md`;
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`;
4. the latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`;
5. `docs/master_specification/GDA_COATING_SETTINGS_FORMAL_SPEC_CHANGE_V3.md` V3.4;
6. this directive; and
7. the newest non-superseded instruction on the active coordination Draft PR.

Before inspection, report the phase, exact base commit/tree, read boundary, protected paths, prohibitions, and stop boundary. Stop if any authority or identity diverges.

## 3. Frozen owner decisions

1. The only valid new-operation sizes are `SS / S / M / ML / L / LL / XL`.
2. `XXL` is abolished. No alias, merge, migration, fallback, or automatic `XL` substitution is allowed.
3. Each price is a tax-exclusive integer entered directly for one of the seven sizes.
4. The old `base_price_m × size_multipliers` architecture must be retired from new pricing only through later accepted implementation phases.
5. Layer 1, layer 2, and layer 3 are separate product-selection and price contracts.
6. Layer 2 and layer 3 may use different liquids. Their product choice, seven-size price map, unset/free/error state, validation, persistence, and read path must remain separate.
7. Never copy, substitute, or fall back from a layer-2 price to layer 3 or from layer 3 to layer 2, even when the product ID is identical.
8. Existing coating matrix and shop-rank restrictions remain authoritative and fail closed.
9. `0` means explicitly confirmed free; unset means unavailable. Unset must never be coerced to zero.
10. Finalized historical estimates, invoices, and work records are not recalculated or rewritten.
11. The accepted R2-R1 UI package is the visual authority. Do not request another GenSpark revision for an implementation-level correction.

## 4. Diagnosis objective

Return the smallest safe architecture and implementation sequence that converts current coating pricing to:

```text
layer 1 product × seven sizes -> direct tax-exclusive price or unset
layer 2 product × seven sizes -> independent direct tax-exclusive price or unset
layer 3 product × seven sizes -> independent direct tax-exclusive price or unset
```

The result must be source-derived. Do not invent a schema, route, RPC, migration, product, matrix rule, threshold, rank, or legacy-data behavior without tracing the current implementation.

## 5. Bounded read scope

Start from these source seeds and follow only direct imports, exported-symbol callers, persistence paths, and focused tests needed to answer the required diagnosis:

- `src/lib/dealer-settings/dealer-settings-types.ts`
- `src/lib/dealer-settings/dealer-settings-defaults.ts`
- `src/lib/pricing/pricing-data.ts`
- `src/lib/pricing/pricing-catalog.ts`
- `src/lib/pricing/authoritative-pricing-catalog-core.ts`
- `src/lib/pricing/pricing-engine.ts`
- `src/lib/pricing/wizard-coating-id-adapter.ts`
- `src/components/settings/SettingsCategoryNav.tsx`
- `src/components/estimates/wizard/pricing/`
- `src/components/estimates/wizard/screens/CoatingSelector.tsx`
- `src/components/estimates/wizard/screens/coating-matrix.ts`
- `src/components/estimates/wizard/draft/`
- `src/components/estimates/wizard/save/`
- relevant existing focused tests adjacent to those paths
- relevant Supabase migration and generated-type paths only when a traced persistence call proves they are required

The accepted UI ZIP may be read from the owner-supplied local path recorded by MacBook Codex. Verify its SHA-256 before using it. Treat its HTML/CSS/SVG/screenshots as visual evidence only.

Use literal symbol/path searches with the protected path excluded before execution. Do not perform an unrestricted content grep across the repository.

## 6. Protected paths

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
  - required-base metadata: `100644 blob c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
  - pathname, mode, blob, and Git state only
  - never open, read, grep by content, diff, copy, stage, or modify
- `supabase/migrations/20260801110110_line_link_tokens.sql`
  - required-base metadata: `100644 blob accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
  - required-base metadata: `100644 blob 32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
  - required-base metadata: `100644 blob fe3c80f22fd80dcbfab076082473216dda582c14`

The last three paths are metadata-only and outside C2. No protected content search is permitted.

## 7. Required diagnosis

The single result must answer all items below with exact path and symbol evidence.

### 7.1 Current contract ledger

- Exact TypeScript shape of `ServicePriceSettings.coating` and every related exported type.
- Current default values and product/rank sources.
- Current persistence boundary: where settings are loaded, validated, saved, and stored.
- Current authoritative catalog projection and price calculation chain.
- Current estimate-wizard selection, rank/matrix validation, preview, and save chain.
- Exact focused tests that freeze current behavior.

### 7.2 Legacy-field impact

Trace every read/write of:

- `base_price_m`
- `size_multipliers`
- `topcoat_prices`

Classify each occurrence as authoritative runtime, adapter, UI, test, fixture, historical snapshot, or unrelated documentation. Do not use counts without identities.

### 7.3 Target V3.4 contract

Propose one exact TypeScript contract for three independent layer price maps. It must:

- encode the seven sizes exactly;
- distinguish unset from confirmed free;
- keep layer-2 and layer-3 prices independent;
- preserve stable product identity;
- prevent unknown keys, missing required structure, negative/fractional/non-finite prices, and cross-layer fallback;
- support rank/matrix-derived read-only availability without duplicating the matrix into UI state; and
- preserve existing finalized estimate snapshots.

State whether the target should be versioned inside the existing settings payload or stored in a new table. Compare both using the actual current persistence boundary and recommend one with concrete reasons.

### 7.4 Migration and compatibility plan

- State whether a DB migration is required and why.
- Identify exact legacy data that can be deterministically displayed as a candidate.
- Identify data that cannot be assigned to layer 2 versus layer 3 without owner confirmation.
- Never propose automatic duplication of old `topcoat_prices` into both layers.
- Define fail-closed behavior before confirmation, during partial configuration, and after save failure.
- Define rollback and mixed-version behavior between old and new application commits.

This is design only. Do not connect to a database or inspect live data.

### 7.5 UI binding map

Map the accepted package to current React paths and identify:

- layer-1, layer-2, and layer-3 product selector ownership;
- seven-size direct-entry component ownership;
- rank/matrix availability adapter ownership;
- validation/status/save-state ownership;
- static save-button placement;
- existing option and partial-PPF sections that must remain;
- Desktop/Tablet/Mobile acceptance evidence needed later.

### 7.6 Exact phased implementation proposal

Propose the smallest ordered implementation phases after C2. For each phase state:

- phase ID and objective;
- exact literal path allowlist;
- paths that remain frozen;
- exact focused test commands;
- whether typecheck/build is needed;
- stop/failure conditions;
- commit/push/migration/environment/Preview gates; and
- dependencies on earlier phases.

Separate at minimum:

1. source data contract and pure validation/adapters;
2. persistence/migration candidate;
3. authoritative pricing calculation and estimate-wizard integration;
4. accepted UI binding;
5. focused tests/typecheck;
6. migration apply and authenticated Preview verification.

Do not combine a migration apply, source implementation, UI binding, and environment verification into one phase.

## 8. Prohibited work

C2 prohibits:

- editing any source, test, migration, dependency, configuration, or documentation file;
- running tests, typecheck, build, lint, dev server, browser automation, or runtime replay;
- DB, Supabase, Auth, Storage, LINE, Vercel, email, or other external-service access;
- live-data or persisted-`XXL` queries;
- branch/worktree creation by Claude;
- stage, commit, push, PR metadata change, Ready, merge, deploy, or destructive action;
- redesigning the accepted UI or asking GenSpark for another delivery;
- changing the seven-size contract, 3M thresholds, rank rules, coating matrix, tax rules, or historical snapshots.

Claude performs no Git mutation. The one MacBook Codex read-only `origin/main` fetch used to pin this gate must be disclosed in the result.

## 9. Stop conditions

Stop and return the divergence instead of guessing if:

1. repository origin, base commit, or tree differs;
2. the specification or accepted UI SHA differs;
3. the newest coordination comment differs from this directive;
4. protected content would be required;
5. current source cannot distinguish layer-2 and layer-3 identity;
6. a product/rank/matrix decision is missing;
7. a live DB query would be needed to recommend a safe contract; or
8. exact phase allowlists cannot be bounded from source.

## 10. Required result

Return exactly one self-contained report named:

`GDA_COATING_V3_4_C2_DIRECT_PRICE_ARCHITECTURE_DIAGNOSIS_V1`

It must include:

- repository identity, origin, exact base commit/tree, and source snapshot method;
- required first-read completion;
- accepted UI path/name, verified SHA-256, and visual-authority boundary;
- current contract ledger with exact paths/symbols;
- complete identities for all legacy-field reads/writes;
- recommended target contract and rejected alternative;
- migration/compatibility/fail-closed/rollback design;
- UI binding map;
- exact phased implementation proposal and literal allowlists;
- protected-path metadata and no-content-access proof;
- explicit flags for edits, tests, typecheck, build, DB, Supabase, Auth, Storage, LINE, external services, Git mutations, commit, push, Ready, merge, and deploy;
- ambiguities or stop conditions; and
- the exact next gate.

Stop after returning the report. Do not implement anything.
