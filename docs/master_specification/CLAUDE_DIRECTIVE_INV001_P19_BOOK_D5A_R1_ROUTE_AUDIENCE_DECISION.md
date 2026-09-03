# Claude Directive — INV001-P19 Book D5A-R1 Route Audience Decision

## 1. Identity

- Decision marker: `INV001_P19_BOOK_D5A_R1_ROUTE_AUDIENCE_DECISION_V1`
- Parent governance: `INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI_GOVERNANCE_V1`
- Accepted diagnosis marker: `INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI_DIAGNOSIS_RESULT_V1`
- Accepted correction: `D5A-R2_CORRECTION_ADDENDUM`
- Book repository: `nisikawa-officeAZ/GYEON`
- Base branch: `main`
- Fixed Book commit/tree: `3d7ff378ba189c1e45e273bc9e023d95ca75ffd5` / `6ad7815cc73c4c8a63c9e6b51706eac492dc4c56`
- Candidate branch: `agent/inv001-p19-book-d5a-r1-route-audience-decision`
- Date: `2026-09-03`
- Current mode: local governance decision candidate only

This document records the Owner's route-audience decision after the accepted D5A tool-disabled read-only diagnosis. It does not authorize D5 implementation, tests, package work, database work, external access, Git delivery, or deployment.

## 2. Accepted Diagnosis Boundary

MacBook Codex independently accepted the original D5A result together with the `D5A-R2_CORRECTION_ADDENDUM`:

- primary implementation verdict: `BLOCKED_D1_D4_PRECONDITION`;
- fixed Book commit/tree matched the identities above;
- all 24 approved D5A read-path SHA-256 values matched;
- ordered 24-path hash-manifest SHA-256: `443a491f5e0852fe64cd4b26815105c5d051cbe89d92bf03b8ea5f0d95117b7d`;
- the C3 three-path D5 reservation is insufficient because the Server Component loader and D4 DTO-consumption boundary are outside it;
- the accepted package evidence is attributed to the D2-Q1R1 governance record, while registry publication remains `NOT_VERIFIED_CREDENTIAL_SCOPE` and package absence is not inferred;
- the corrected UI contract preserves distinct actor/operator identity, all D4 closed failures, proven-zero versus unknown, fail-closed product mapping, and server-returned post-command state;
- no Book, Foundation, Git, package, database, Supabase, provider, Android, staging, production, or deployment mutation occurred during diagnosis.

Diagnosis acceptance proves the future shape and blockers only. It is not implementation authority.

## 3. Owner-Ratified Route Decision

The Owner ratifies exactly the following separation:

1. `/inventory` remains the dealer-local inventory surface.
2. `/inventory` stays outside the Office AZ Foundation D5 cutover.
3. No Foundation quantity, owner/location aggregate, D4 DTO, Foundation command, or Office AZ operator authority may be mixed into `/inventory` under D5.
4. Existing dealer-local behavior is not Foundation authority and may never be used as Foundation fallback, reconciliation truth, or a component of the Office AZ total.
5. `/admin/logistics/inventory` is the sole current Book UI candidate for the future Office AZ Foundation inventory view.
6. That logistics route may expose Foundation-derived data only through the accepted future D4/D4A server boundary and sanitized DTOs after every prerequisite is closed.
7. The two routes must retain separate audiences, authorization sources, DTOs, copy, navigation meaning, and failure states.

This decision resolves only the route-audience blocker. It does not decide whether the dealer-local `/inventory` surface is retained forever, redesigned, or retired in a later separately authorized product phase.

## 4. Effect on the C3 Reservation

The C3 D5 implementation reservation is corrected for future planning only:

- `src/app/inventory/InventoryClient.tsx` is removed from the Office AZ Foundation D5 candidate because `/inventory` remains dealer-local.
- `src/app/inventory/page.tsx` and `src/app/inventory/page.test.ts` are not D5 Foundation paths.
- `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx` remains a future D5 candidate.
- `src/lib/inventory/foundation/foundation-cutover-ui.test.ts` remains a proposed future D5 test path.

The diagnosis also identified a required Server Component loader and D4 DTO-consumption boundary. The following is a proposed minimum planning set, not an implementation allowlist:

1. `src/app/admin/logistics/inventory/page.tsx`
2. `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx`
3. `src/lib/inventory/foundation/foundation-cutover-query.ts` (new proposal)
4. `src/lib/inventory/foundation/foundation-cutover-ui.test.ts` (new proposal)
5. `src/app/admin/logistics/inventory/page.test.ts` (new proposal)

Gate A acceptance does not create these files or approve this set. After D4 is accepted, a new exact D5 implementation instruction must prove the minimum paths again and the Owner must separately approve its literal allowlist.

## 5. Binding Cutover Rules

- `OFFICE_AZ` remains the only current live Foundation inventory owner.
- The three Office AZ physical locations remain scopes under one derived Office AZ total.
- `/admin/logistics/inventory` must not use `createAdminClient`, service-role possession, `admin_users`, dealer roles, client flags, or UI visibility as Office AZ inventory authority.
- Browser and Client Components must never import the private Foundation package, persistence adaptors, or raw authority sources.
- Legacy Book tables, actions, and local availability calculations must never become fallback authority when Foundation is missing, stale, forbidden, unmapped, or unavailable.
- No dual read as authority, dual write, optimistic authoritative quantity, automatic retry, automatic command chaining, or client-side inventory calculation is allowed.
- Missing or ambiguous product mapping is `NOT_CONFIGURED`; no quantity is requested or displayed and controls are disabled or absent.
- `COMMAND_ACCEPTED` updates the UI only from a sanitized server-returned post-command snapshot or another future D4 contract explicitly accepted before D5 implementation.

## 6. Dependency Wall

D5 implementation remains prohibited until all of the following are merged and independently accepted:

1. D2 immutable private package consumer;
2. D3A Foundation persistence;
3. D3B one-to-one product mapping;
4. D4 authenticated server command/query boundary;
5. D4A live operator authority, schema, RLS, grants, resolver, and revocation behavior;
6. a new D5 exact-scope implementation instruction;
7. separate Owner authorization for the final literal D5 allowlist.

The current package publication state is not proven because available GitHub credentials lack `read:packages`. No token, registry login, publication, installation, or bypass is authorized here.

## 7. Exact Current Candidate Allowlist

Only these three documentation paths may change in this local candidate:

1. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D5A_R1_ROUTE_AUDIENCE_DECISION.md` (new)
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

No source, UI, route, action, DTO, test, package, dependency, lockfile, configuration, migration, or generated artifact is included.

## 8. Protected Content

The following remain pathname/mode/blob/Git-state metadata only and must not be opened, read, diffed, copied, staged, or modified:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `src/components/ScreensPreview.tsx` if present
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## 9. Verification and Exit

Local candidate verification is limited to:

- exact three-path diff inspection;
- directive SHA-256;
- fixed base/branch identity;
- protected pathname/mode/blob/clean-state metadata;
- `git diff --check` on the three candidate paths.

Stage, local commit, push, Draft PR creation or mutation, Ready conversion, merge, private-source transmission, Claude invocation, implementation, executable tests, package/registry work, Auth, DB, Supabase, provider, Android, staging, production, or deployment all require later separate authorization.

The exit of this candidate is a verified, unstaged, uncommitted three-document governance decision only.
