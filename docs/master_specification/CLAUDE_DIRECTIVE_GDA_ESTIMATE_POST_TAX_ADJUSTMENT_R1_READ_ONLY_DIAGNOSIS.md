# Claude read-only diagnosis — GDA-ESTIMATE-POST-TAX-ADJUSTMENT-R1

## Authority

- Repository: `nisikawa-officeAZ/GYEON`
- Branch: `fix/estimate-post-tax-adjustment-r1`
- Fixed base commit: `a1c748aa2d100a7678f2cec2c47a6d4100e4c1c9`
- Fixed base tree: `5d418169537bd1e5c3c9cb3a815b8deec82362c4`
- Owner decision: estimate-level and invoice-level document discount is a post-tax adjustment.
- Required formula: `total = subtotal + floor(subtotal * tax_rate / 100) - clamped_discount`.
- Required conversion parity: estimate-to-invoice conversion must preserve the same subtotal, tax, discount, and total semantics.

## Task

Perform one independent read-only diagnosis. Determine the smallest safe implementation that makes all invoice creation, invoice editing, invoice issuance validation, and the atomic estimate-to-invoice conversion use the same post-tax adjustment rule without weakening authorization, idempotency, atomicity, numbering, tenant isolation, historical issued-document immutability, or existing line-level discount behavior.

## Literal read scope

1. `AGENTS.md`
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
4. `src/lib/pricing/estimate-totals.ts`
5. `src/lib/pricing/estimate-totals.test.ts`
6. `src/lib/invoices/invoice-types.ts`
7. `src/lib/invoices/create-invoice.ts`
8. `src/lib/invoices/update-invoice.ts`
9. `src/lib/invoices/invoice-issuance-snapshot.ts`
10. `src/lib/invoices/invoice-issuance-snapshot.test.ts`
11. `src/lib/invoices/estimate-invoice-conversion.test.ts`
12. `src/lib/invoices/invoice-issuance-boundary.test.ts`
13. `supabase/migrations/20260913163712_atomic_estimate_invoice_conversion.sql`

Do not read outside this list. The protected `ScreensPreview.tsx` path is pathname/hash-only and must not be opened.

## Questions to answer

1. Identify every active calculation authority that would otherwise retain the pre-tax discount rule.
2. Confirm whether changing only the TypeScript helper or only the conversion RPC would create issuance or persistence mismatch.
3. Return the smallest literal source/test allowlist for implementation.
4. Specify one new forward-only migration requirement. Historical migrations must remain byte-identical; do not create the migration in this diagnosis.
5. Specify focused test, typecheck, and diff-check commands for the later implementation phase.
6. Identify any compatibility consequence for existing draft invoices and prove that issued invoices are not rewritten.

## Required result

Post one comment to the coordination Draft PR with marker:

`GDA_ESTIMATE_POST_TAX_ADJUSTMENT_R1_READ_ONLY_DIAGNOSIS_RESULT_V1`

The result must contain:

- `VERDICT=READY_FOR_IMPLEMENTATION_GOVERNANCE|CHANGES_REQUIRED|BLOCKED`
- fixed commit and tree
- active calculation authorities
- smallest literal implementation allowlist
- exact forward-only migration requirement
- exact verification commands
- protected-path confirmation
- blockers and risks
- one copy-ready next Owner authorization sentence

## Prohibited

- No repository or filesystem mutation.
- No tests, typecheck, build, formatter, package install, or dependency mutation.
- No database, Supabase, Storage, Auth, environment, Preview, or production access.
- No migration creation or application.
- No stage, commit, push, PR state change, Ready conversion, merge, or deployment.
- No reading, diffing, copying, staging, or modifying `src/components/estimates/wizard/screens/ScreensPreview.tsx`.
- No autonomous redesign of the approved post-tax adjustment rule.

Stop after posting exactly one diagnosis result comment.
