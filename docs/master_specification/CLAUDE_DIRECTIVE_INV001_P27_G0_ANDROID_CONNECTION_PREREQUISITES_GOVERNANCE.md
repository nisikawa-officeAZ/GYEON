# Claude Directive — INV001-P27-G0 Android Connection Prerequisites Governance

## 1. Identity

- Directive: `INV001_P27_G0_ANDROID_CONNECTION_PREREQUISITES_GOVERNANCE_V1`
- Governance result marker: `INV001_P27_G0_ANDROID_CONNECTION_PREREQUISITES_GOVERNANCE_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main` (detached)
- Exact Book base HEAD: `54c32343b4ef57e4e4b703b23540153e529473dd`
- Exact Book base tree: `633a2fc4ab68c06ebb3002a8e2e481b8df4ce76b`
- Accepted diagnosis instruction: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/issues/39#issuecomment-5790917545`
- Accepted diagnosis result: `https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/issues/39#issuecomment-5791009334`
- Diagnosis result marker: `INV001_P27_BOOK_ANDROID_CONNECTION_PREREQUISITES_READ_ONLY_DIAGNOSIS_RESULT_V1`
- Diagnosis verdict: `READY_FOR_OWNER_DECISIONS`; Book Codex accepted the marker, model evidence, exact base, clean Git state, literal read scope, protected metadata, and zero-mutation result.
- Phase scope: P27-D-06 Book-hosted managed-device session issue/refresh contract, P27-D-07 non-production runtime-injected endpoint contract, P27-D-10 device registration plus device/operator session revoke contracts.
- Current mode: governance only. This G0 candidate consists of exactly three documents and authorizes nothing else.

## 2. Mandatory reads and responsibility

Every session acting on this phase must first read `AGENTS.md`, `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`, the latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`, and the accepted diagnosis result linked above, then state the active phase, authorization boundary, literal allowlist, protected paths, and responsibility.

- Owner / Office AZ: product owner; ratifies policy decisions and every later gate.
- Book Codex (MacBook Codex): specification authority, independent acceptance, and gate control for Book integration/auth work.
- Book Claude (Claude Fable high): bounded diagnosis and, only inside a later separately authorized gate, bounded implementation and executable tests.
- Mac Studio Cursor/Codex: sole owner of the Office AZ inventory Foundation (inventory rules, ledger, balances, DB/RLS/RPC, recovery, tests). Studio does not implement Book auth/session code.

P27 is Book integration/auth work. It does not transfer Foundation inventory-rule ownership from Studio to MacBook, and MacBook must not implement Office AZ inventory rules under the P27 label.

## 3. Owner-ratified decisions (verbatim in substance)

1. **Track order.** P27 Book auth/session work is the next prerequisite track. It is Book integration/auth work and does not transfer Foundation inventory-rule ownership from Studio to MacBook.
2. **Initial device policy.** Company-owned/managed devices only; one active device per operator.
3. **Session policy.** Access token TTL 15 minutes; refresh idle expiry 7 days; absolute session lifetime 30 days; high-risk actions require re-authentication within 5 minutes.
4. **Device registration and revocation authority.** Inventory Super Admin only.
5. **Identity/activation.** Verified Supabase Auth user login plus one-time admin-issued managed-device activation.
6. **Endpoint key.** `DEALEROS_INVENTORY_API_BASE_URL`; non-secret; injected per Android build/runtime environment; the production value must not be hard-coded or committed.
7. **Prerequisite reconciliation.** Record the completed D4 Gate B PR #117 and the existing D4A authority migration acceptance before P27 implementation governance depends on them.
8. **Concurrent refresh/reuse.** A consumed refresh token replay revokes the entire token family.

These numbers and decisions are fixed. No agent may change them in chat; a change requires an updated plan, an updated ledger entry, and explicit Owner ratification.

## 4. Current evidence classification (at the exact base)

| Capability | Classification | Evidence |
|---|---|---|
| Browser SSR-cookie authenticated D4 path into `/api/inventory/foundation` | PRESENT | Merged through PR #117 (see section 5); request-scoped `@supabase/ssr` cookie client, `getUser()`-based identity, Office AZ authority resolution, same-origin mutation check, closed public codes. |
| Operator status and authority-version validation per request | PARTIAL / PRESENT | D4A resolver exists on `main`; no device-session invalidation path exists. |
| Managed Android session issue/refresh (P27-D-06) | NOT_EVIDENCED | No Book-issued opaque access/refresh token, rotation, reuse denial, or non-cookie request authentication exists. |
| `DEALEROS_INVENTORY_API_BASE_URL` endpoint contract (P27-D-07) | NOT_EVIDENCED | Existing Supabase URL keys are not an Android inventory API endpoint contract. No runtime-injection contract exists. |
| Company-managed device registration/binding (P27-D-10) | NOT_EVIDENCED | No registration table, RPC, route, or admin surface exists. |
| Per-device revoke, operator-wide device revoke, immediate device-session invalidation, device audit (P27-D-10) | NOT_EVIDENCED | Operator status `revoked` in D4A is not a device/session revoke. |

The generic browser Supabase session must not be reused as the managed-device API session.

## 5. D4 Gate B and D4A reconciliation (repository evidence)

### 5.1 D4 Gate B — PR #117

- PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/117` — state `MERGED`, merged normally to `main` at `2026-09-23T07:27:16Z`.
- Repair head: `5465938e519c5849f0530c32030fd2b1bb48dc5b` (tree `b2dc43b65d5199760bb7527fc7b6f47057612dd7`).
- Merge commit: `54c32343b4ef57e4e4b703b23540153e529473dd`; merge tree: `633a2fc4ab68c06ebb3002a8e2e481b8df4ce76b`; merge parents `0d4ae782e02678c0768b669c53b1c9c7d23e5d4f` and `5465938e519c5849f0530c32030fd2b1bb48dc5b`.
- Whole-PR delta: 13 paths (`src/app/api/inventory/foundation/route.ts` + test, `src/lib/inventory/foundation/foundation-server-actions.ts` + test, and nine existing D3/D4A graph paths touched only by the Turbopack-resolvable import repair).
- Verification recorded on PR #117 (fresh independent review comment `5790801935`, `VERDICT=PASS`): build/Turbopack PASS; focused tests 132/132 PASS; path-limited TypeScript PASS; `git diff --check` PASS; replacement Vercel deployment `SUCCESS` and Vercel Preview Comments `SUCCESS`; fresh Book Codex independent review PASS with no actionable finding.
- Owner-authorized gate sequence (recorded as separate gates): Issue #39 comments `5790862241` and `5790921677` are historical records of an earlier interpretation that the commit/push/PR update and the later Ready/merge exceeded the then-literal stop rule. The Owner subsequently and separately authorized each step as its own gate: (1) local commit of the repair head; (2) normal non-force push; (3) one-time CI confirmation; (4) fresh independent review (PR #117 comment `5790801935`, `VERDICT=PASS`); (5) Ready conversion; (6) normal merge to `main`. This candidate records that sequence as separately Owner-authorized gates. No rollback, revert, amend, rebase, history rewrite, or additional Git work is authorized or required. `D4_TECHNICAL_STATUS=COMPLETE_ON_GYEON_MAIN`.

### 5.2 D4A authority migration — source presence on `main`

- Path: `supabase/migrations/20260920093931_office_az_operator_authority.sql`; blob `4297e9f3af0a4add51fe7bc63fe5ed020a9fa27d`, mode `100644`, 192 lines.
- First added in commit `f4078fa03e178e302bf7ad57a32995007551128a` (`feat(inventory): add Office AZ authority resolver`, 2026-09-20), landed on `main` through PR #104 (`feat(inventory): add Office AZ authority core`, merge `4a9d68567430fc7d01b262269577f98f9a8e3786`).
- Disposable CI validation: `.github/workflows/inv001-d4a-b2-disposable-db.yml` (blob `6a407267df0d9736c7fe7e094f4ce1030dbc50be`) landed through PR #112 (`test(inventory): validate D4A B2 in disposable PostgreSQL`, merge `882faa7d2d92471be09b268965e467b406421b04`). It runs the four focused authority tests including `office-az-inventory-authority-migration.test.ts` and `scripts/e2e/inv001-office-az-authority-disposable.mjs` against a fresh disposable database on `pull_request` only, then destroys the resources.
- The migration header states that it deliberately creates no assignments, locations, grants, or mutation RPCs, so a freshly applied database remains fail-closed.

**What repository evidence proves:** the migration source and its resolver/core/actions are present on `main`; a CI workflow exists that validates the migration in a disposable database on qualifying pull requests; the accepted D4A policy (roles, 18-command matrix, five surfaces, three current locations) is Git-governed.

**What repository evidence does not prove:** hosted, staging, or production application of the migration; any seeded or live operator assignment, location row, capability grant, or RLS-effective authority; any Auth user provisioning or claim; the named initial warehouse-operator designation as a live grant; production authority of any kind. Live authority remains `NOT_CONFIGURED` and fail-closed until a separately authorized environment gate proves otherwise.

## 6. Accepted high-level architecture

1. **Book-owned exchange boundary.** Verified Supabase Auth user login plus one-time admin-issued managed-device activation is exchanged, server-side in Book, for Book-issued opaque access and refresh tokens. The generic browser Supabase session is never the managed-device API session. No second identity provider is created.
2. **Hash-only token storage.** Access and refresh tokens are opaque; only their hashes are stored. Raw tokens, JWTs, cookies, or secrets never appear in responses, logs, audit rows, or Foundation payloads.
3. **Single-use refresh rotation and whole-family reuse revocation.** Each refresh token is consumed exactly once and rotated. Replay of a consumed refresh token revokes the entire token family (decision 8). Lifetimes follow decision 3.
4. **Per-request revalidation before the D4 boundary.** Every device request re-checks current device registration status, current operator assignment status, authority version, required capability, and location scope before any Foundation command or query. Actor and operator remain distinct; Office AZ owner, capability, location, authority version, Foundation request/idempotency/version binding, no browser-supplied authority metadata, and service-only command denial are preserved unchanged from D4/D4A.
5. **Separate super-admin-only registration and revocation web surfaces.** Device registration and device/operator session revocation are distinct authorization surfaces, reachable only by an Inventory Super Admin through the existing web SSR-cookie same-origin path. Device sessions can never call them.
6. **Android runtime-injected endpoint origin.** Android reads `DEALEROS_INVENTORY_API_BASE_URL` as a non-secret origin injected per build/runtime environment. Dev/staging values are supplied by environment; the production value is never hard-coded and never committed.
7. **Cookie versus bearer.** The web path keeps CSRF/same-origin rules; the device path uses bearer/device-bound authentication with CORS denied by default and no cookie fallback. Neither path may weaken the other.

## 7. Stable future gate sequence (each separately authorized; never collapsed)

1. **C1 — pure contracts.** Pure TypeScript types/cores/tests for session, device, and endpoint contracts; no persistence, route, DB, or Android.
2. **C2 — database source.** CLI-generated migration source for device registrations, token families, and audit under a private schema with RLS/grants; not applied anywhere.
3. **C3 — request handlers.** Bearer resolver, session issue/refresh/revoke handlers, and super-admin-only registration/revocation handlers; fail-closed until C2 persistence is accepted.
4. **C4 — local verification.** Focused tests, path-limited typecheck, build, and `git diff --check` on the exact candidate.
5. **C5 — disposable PG17/Auth/PostgREST/race verification.** Fresh disposable runtime with genuine Auth claims and separate-connection concurrency; failed attempts are burned.
6. **Local commit.**
7. **Push / Draft PR.**
8. **Independent review.**
9. **Ready.**
10. **Merge.**
11. **Environment configuration / migration apply.**
12. **Android source.**
13. **Production rollout.**

Governance (this G0), each implementation gate, verification, commit, push, PR, review, Ready, merge, environment, Android, and production remain separate Owner gates. Discovering a defect outside a gate's allowlist stops that gate.

## 8. Proposed implementation paths — PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE

The accepted diagnosis returned separate gates and required a literal minimal allowlist per implementation gate. The accepted Issue #39 result comment (`5791009334`) records the architecture and gate separation but does not enumerate literal paths. The parallel Studio read-only diagnosis comment (Issue #39 comment `5790921677`) is **non-authoritative planning input only**: it is not an accepted diagnosis allowlist, it predates the Owner-ratified decisions, and it used a stale, superseded proposed endpoint-key name; the only ratified key is `DEALEROS_INVENTORY_API_BASE_URL` (decision 6). Its path proposals are retained below solely as non-authoritative planning input for continuity. Every group below is PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE: nothing here is ratified, nothing here authorizes any path, and each future gate (C1, C2, C3, C5, Android) must independently re-diagnose and fix its own exact literal allowlist inside its own separately authorized governance before any implementation. Every path below is labeled NEW unless stated otherwise.

- **C1 pure contracts — PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE:**
  - `src/lib/inventory/mobile/office-az-inventory-mobile-session-types.ts` (NEW)
  - `src/lib/inventory/mobile/office-az-inventory-mobile-session-core.ts` (NEW)
  - `src/lib/inventory/mobile/office-az-inventory-mobile-session-core.test.ts` (NEW)
- **C2 database source — PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE:**
  - one Supabase-CLI-generated migration for managed-device registrations, token families, and append-only device/session audit (NEW; exact path reconciled at the gate)
  - `src/lib/inventory/mobile/office-az-inventory-mobile-persistence.ts` (NEW)
  - `src/lib/inventory/mobile/office-az-inventory-mobile-persistence.test.ts` (NEW)
- **C3 request handlers — PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE:**
  - `src/lib/inventory/mobile/resolve-office-az-inventory-mobile-bearer.ts` (NEW)
  - `src/lib/inventory/mobile/resolve-office-az-inventory-mobile-bearer.test.ts` (NEW)
  - `src/lib/inventory/mobile/office-az-inventory-mobile-server.ts` (NEW)
  - `src/lib/inventory/mobile/office-az-inventory-mobile-server.test.ts` (NEW)
  - `src/app/api/inventory/mobile/session/route.ts` (NEW)
  - `src/app/api/inventory/mobile/session/route.test.ts` (NEW)
  - `src/app/api/inventory/mobile/devices/route.ts` (NEW)
  - `src/app/api/inventory/mobile/devices/route.test.ts` (NEW)
  - if a device-register / session-revoke capability must be added to the closed authority capability set: `src/lib/inventory/authority/office-az-inventory-authority-types.ts`, `office-az-inventory-authority-core.ts`, `office-az-inventory-authority-core.test.ts` (existing; requires explicit scope correction)
- **C5 disposable verification — PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE:** one disposable harness script under `scripts/e2e/` (NEW) and, if required, one CI workflow (NEW).
- **Android source — PROPOSED ONLY / NOT AUTHORIZED / REQUIRES A FRESH LITERAL GATE (later project gate):** no path is proposed; Android source remains uncreated and minSdk/targetSdk undecided.

`src/lib/auth/get-current-user.ts`, `src/lib/supabase/server.ts`, and `src/app/api/inventory/foundation/route.ts` are proposed as read-only during C1-C3 unless a later gate records an explicit scope correction. `package.json`, lockfile, `next.config.ts`, `tsconfig.json`, and all existing migrations are outside every proposed group above. These proposals are non-authoritative planning input; the literal allowlist of each future gate is fixed only by that gate's own fresh diagnosis and Owner authorization.

## 9. Security acceptance cases (from the accepted diagnosis; required at C4/C5)

1. **Token theft/replay.** A stolen access token is rejected after 15 minutes; a stolen refresh token that is replayed after consumption revokes the whole family and every session in it.
2. **Refresh reuse.** A consumed refresh token presented again is denied and revokes the entire token family; the legitimate holder's next request fails closed and must re-activate through the exchange boundary.
3. **Revoked/suspended operator.** A device session whose operator assignment is inactive, suspended, or revoked is denied on the next request with zero Foundation calls; existing tokens do not extend authority.
4. **Stale authority version.** A request bound to an authority version older than the current one is denied before any Foundation call.
5. **Wrong device.** A token family presented from a device other than its registered device, or from a device whose registration is revoked, is denied and the family is revoked.
6. **Wrong location.** A command outside the operator's granted location scope is denied before any Foundation call.
7. **Wrong endpoint environment.** A build whose `DEALEROS_INVENTORY_API_BASE_URL` targets a different environment cannot exchange or refresh; the production origin is never present in source, tests, or fixtures.
8. **Concurrent refresh.** Two concurrent refreshes with the same token yield exactly one rotation; the second is treated as reuse and revokes the family.
9. **Revoke-vs-request race.** A revocation committed on one connection is honored by a concurrent request on another connection; no request completes with revoked authority.
10. **Session lifetimes.** Access 15 minutes, refresh idle 7 days, absolute 30 days, and high-risk re-authentication within 5 minutes are enforced server-side and are not client-adjustable.
11. **One active device per operator.** A second managed-device activation for an operator with an active device fails closed until an Inventory Super Admin revokes the existing device registration.
12. **Surface separation.** Device sessions cannot reach the registration or revocation surfaces; non-super-admin web sessions are denied on both surfaces; no raw token, hash, cookie, JWT, or audit row is returned.

## 10. Authorization boundary of this G0 candidate

This G0 candidate authorizes **no** source, migration, test, DB/Auth, endpoint configuration, Android, commit, push, PR, Ready, merge, deploy, or production action. It authorizes exactly three documents:

1. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P27_G0_ANDROID_CONNECTION_PREREQUISITES_GOVERNANCE.md` (this file, NEW)
2. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
3. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`

Protected paths remain metadata-only: `src/components/estimates/wizard/screens/ScreensPreview.tsx` (never opened, read, diffed, copied, staged, or modified), `supabase/migrations/20260801110110_line_link_tokens.sql`, `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`, and `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`.

The candidate is left unstaged and uncommitted. Stage, local commit, push, Draft PR, independent review, Ready, and merge of these documents are each separate Owner gates.

## 11. Exit

Return `INV001_P27_G0_ANDROID_CONNECTION_PREREQUISITES_GOVERNANCE_RESULT_V1` with the exact three-path diff, `git diff --check`, marker/decision checks, per-path SHA-256, unchanged protected metadata, and unstaged/uncommitted Git state. Next: Book Codex independent read-only governance review.
