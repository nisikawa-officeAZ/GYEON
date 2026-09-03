# Claude Directive — INV001-P19 Book D4 Authenticated Server Boundary

## 1. Identity

- Directive: `INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY_V1`
- Readiness diagnosis marker: `INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY_DIAGNOSIS_RESULT_V1`
- Implementation result marker: `INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY_IMPLEMENTATION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `f27ff9b85bb5dd1e821ba21da7b41d2bea9e0f71` / `8c37779327c803ac710bdc06d8e37b9fd27f7107`
- Proposed governance branch: `agent/inv001-p19-book-d4-authenticated-server-boundary-governance`
- D3B governance PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/59`
- Current mode: governance preparation only; implementation blocked until D2, D3A, and D3B are fully closed

D4 defines the only authenticated Book server boundary allowed to call the accepted Foundation runtime, persistence, and product-mapping layers. It must verify identity and current business authorization at the point of every command or query. A hidden button, authenticated Supabase role, client-supplied dealer ID, role string, or successful login alone is never authorization.

## 2. Current Verified Facts and Blockers

1. D1 is merged and supplies a pure injected adaptor boundary.
2. D2 package publication, exact dependency pin, and runtime wrapper remain incomplete.
3. D3A persistence implementation and disposable verification remain incomplete.
4. D3B mapping implementation and disposable verification remain incomplete.
5. Existing `getCurrentDealer()` selects one active membership with `.limit(1).single()` and can silently choose a tenant when multiple active memberships exist. It is not D4 authority.
6. Existing `requireStaffCapability()` composes legacy dealer/staff helpers and represents dealer business permissions, not Office AZ inventory-operator authority. It is not D4 authority.
7. `getEstimateSaveActorContext()` is an accepted pattern for one coherent server-resolved user/dealer/role context, but its estimate-edit capability and dealer roles are not inventory authorization.
8. Current dealer roles `owner`, `manager`, `staff`, and `readonly` do not prove warehouse, inventory-owner, stocktake, transfer, shipment, recovery, or audit permissions.
9. Office AZ is the sole currently authorized live inventory owner. `ATTRACTION` remains a supported Foundation identity but has no D4 live authorization until a separate Owner decision and accepted authority source exist.
10. The exact Office AZ operator identity source, capability matrix, location scope, suspension/revocation behavior, and multi-membership tenant-selection contract are not yet proven. They remain `NOT_CONFIGURED` and block D4 implementation.

This directive may be created early only to save planning time. It authorizes no diagnosis, private-source transmission, Claude invocation, package access, migration, DB connection, implementation, executable test, stage, commit, push, PR mutation, provider, Android, staging, or production action.

## 3. Trust and Authorization Contract

Gate A must prove one coherent, request-local authority object or fail closed. It must bind:

- freshly verified Supabase identity from the current request's SSR cookies;
- current session identity and revocation/freshness behavior appropriate to the command risk;
- exact Book user/actor ID;
- exact human or system operator ID without defaulting actor and operator into one another;
- exactly one dealer/tenant context, or an explicitly authorized tenant-selection contract;
- Office AZ owner authority;
- current Office AZ operator status and command/query capability;
- exact location scope where the operation is location-bound;
- exact Foundation command/query surface;
- server-owned Book request identity;
- server-bound idempotency identity and payload fingerprint where applicable;
- optimistic-concurrency/version identity where applicable;
- D3B-resolved Foundation product identity where applicable;
- server-owned authorization evidence without forwarding raw access tokens or cookie material.

Actor and operator are distinct semantic fields. Equality is allowed only when an accepted authority says that the authenticated human is also the operator for that operation. D4 must never fill a missing operator from the actor, fill a missing actor from the operator, or accept either value from a browser as authority.

## 4. Command and Query Matrix to Fix Before Implementation

Gate A must classify all five D1 surfaces and all 18 Foundation commands:

1. who may request the operation;
2. who may operate it;
3. required Office AZ capability;
4. whether a dealer/tenant is a subject, requester, or irrelevant;
5. required owner and location scope;
6. required product mapping;
7. request/idempotency/version/evidence requirements;
8. safe response DTO fields;
9. stable public failure code and HTTP/action result;
10. audit event required on success, denial, replay conflict, stale version, or infrastructure failure.

No command may be enabled by analogy. Unknown or missing capability, operator, owner, location, tenant, mapping, request, idempotency, version, or evidence returns a closed failure and invokes no downstream port.

Dealer staff must never receive Office AZ inventory mutation authority merely because their dealer role is `owner`, `manager`, or `staff`. Dealer-facing availability may be exposed only through a separately accepted query DTO and policy that reveals the minimum authorized quantity/state, never raw ledger, audit, recovery, or cross-location details.

## 5. Supabase Identity and RLS Boundary

The later D4 implementation must follow these requirements:

- use the current request's server-side Supabase SSR client and verified identity; never authorize from `getSession()`'s unverified user object;
- Gate A must choose `getClaims()` or `getUser()` from current package/runtime facts and document why; source presence alone is not runtime proof;
- never use `raw_user_meta_data` or client-editable metadata for authorization;
- treat app metadata as trusted only when its freshness/revocation window is accepted; current DB authority is required for sensitive inventory commands;
- never treat `TO authenticated` alone as authorization;
- preserve D3A RLS/grant/RPC enforcement as defense in depth; D4 must not replace or weaken it;
- do not import or create the admin/service-role client in the route or browser-callable action boundary;
- never expose service-role, secret, access token, refresh token, cookie, authorization evidence, or Foundation package internals to the client;
- never add a public `SECURITY DEFINER` function or bypass RLS to repair an authorization failure;
- make every authenticated response request-specific and non-cacheable.

Current official references to re-check immediately before Gate A and again before implementation:

- `https://supabase.com/changelog`
- `https://supabase.com/docs/guides/auth/server-side`
- `https://supabase.com/docs/guides/auth/server-side/creating-a-client`
- `https://supabase.com/docs/reference/javascript/auth-getuser`
- `https://supabase.com/docs/guides/database/postgres/row-level-security`
- `https://nextjs.org/docs/15/app/guides/data-security`
- `https://nextjs.org/docs/app/guides/authentication`
- `https://nextjs.org/docs/app/api-reference/file-conventions/route`

The Supabase 2026 Data API exposure change means grants and exposure cannot be inferred from table creation. D3A remains responsible for exact objects, grants, and RLS; D4 consumes only its accepted server port.

## 6. HTTP and Server-Action Boundary

Both Server Actions and Route Handlers are public request entry points and must independently authenticate and authorize every invocation.

The future route must:

- run dynamically and return `Cache-Control: no-store` for authenticated data;
- expose only the operations explicitly accepted by Gate A, never a generic pass-through to the Foundation runtime;
- use `GET` only for accepted read/query DTOs and a mutation method accepted by Gate A for commands;
- require an accepted media type and bounded body size for mutation requests;
- validate the body as untrusted data before authorization or downstream invocation;
- enforce same-origin/CSRF protection for cookie-authenticated mutations instead of assuming Server Action protection covers Route Handlers;
- define CORS as denied by default and never add wildcard credentialed CORS;
- reject unknown methods, fields, operation names, commands, contracts, and versions;
- return sanitized stable codes without stack traces, database messages, package errors, policy details, secrets, or raw Foundation results;
- avoid logging request bodies, credentials, customer data, inventory evidence, or raw downstream errors.

The future server-action module must not become a second public bypass around the route. Gate A must determine whether it is a shared server-only orchestration/data-access layer or a deliberately exported Server Action surface. If it is exported as a Server Action, every async export must repeat the same authorization and validation boundary and must not rely on UI visibility.

## 7. Closed Failure and No-Invocation Contract

Gate A must fix one closed union that covers at least:

- `unauthenticated`
- `session_invalid_or_stale`
- `tenant_context_unavailable`
- `operator_authority_not_configured`
- `operator_inactive`
- `authorization_denied`
- `owner_scope_denied`
- `location_scope_denied`
- `product_mapping_not_configured`
- `invalid_request`
- `unknown_operation`
- `replay_conflict`
- `stale_version`
- `dependency_not_configured`
- `downstream_failure`

Every failure before an accepted downstream invocation must prove zero package, persistence, mapping, or Foundation-port calls. Caught errors are never returned or logged raw. HTTP status mapping, retryability, operator-facing message, and audit classification must be explicit and deterministic.

## 8. Separate D4 Gates

### Gate A — tool-disabled read-only boundary diagnosis

After D2, D3A, and D3B full closure and separate Owner authorization for every transmitted private file, Claude may diagnose the exact D4 contract. Gate A authorizes no command, edit, package/registry access, DB connection, provider access, or executable test.

Allowed verdicts:

- `PASS_AUTHENTICATED_SERVER_BOUNDARY_READY`
- `BLOCKED_D2_D3A_OR_D3B_NOT_CLOSED`
- `BLOCKED_OPERATOR_AUTHORITY_NOT_CONFIGURED`
- `CHANGES_REQUIRED_AUTHORITY_SOURCE`
- `CHANGES_REQUIRED_READ_SCOPE`
- `CHANGES_REQUIRED_IMPLEMENTATION_SCOPE`
- `BLOCKED_GOVERNANCE_PRECONDITION`

### Gate B — uncommitted four-path implementation candidate

After Gate A acceptance and separate Owner authorization, Claude may edit exactly the accepted D4 implementation paths and run only the accepted focused tests, typecheck, and diff check. No DB, Supabase environment, package registry, hosted auth, browser, provider, shared environment, staging, or production may be contacted.

If a separate pure authority-core path, DTO path, rate-limit path, audit path, or configuration change is required, Gate A must return `CHANGES_REQUIRED_IMPLEMENTATION_SCOPE`. Claude must not squeeze it into an unrelated file or create it without a new Owner-approved literal allowlist.

### Gate C — source acceptance and delivery

MacBook Codex independently verifies exact paths, hashes, source behavior, protected metadata, focused tests, typecheck, and `git diff --check`. Stage/local commit, normal push/Draft PR, Ready, and merge remain separate Owner gates.

### D6 — real request and disposable verification

Real login, SSR cookies, real request scope, RLS claims, separate connections, HTTP behavior, session revocation, CSRF, concurrency, cleanup, and evidence hashing belong to D6 after D1-D4 source acceptance. D4 unit/source tests cannot substitute for D6.

## 9. Proposed Gate A Private Read Allowlist

Transmission is not authorized by this directive.

### Book — exact paths

1. `AGENTS.md`
2. `CLAUDE.md`
3. `package.json`
4. `next.config.ts`
5. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
6. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
9. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D2_PRIVATE_PACKAGE_CONSUMER.md`
10. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3A_FOUNDATION_PERSISTENCE.md`
11. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D3B_PRODUCT_IDENTITY_MAPPING.md`
12. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY.md`
13. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
14. `src/lib/inventory/foundation/foundation-adaptor-core.ts`
15. `src/lib/inventory/foundation/foundation-adaptor-core.test.ts`
16. `src/lib/inventory/foundation/foundation-runtime-package.ts`
17. `src/lib/inventory/foundation/foundation-runtime-package.test.ts`
18. `src/lib/inventory/foundation/foundation-persistence-adaptor.ts`
19. `src/lib/inventory/foundation/foundation-persistence-adaptor.test.ts`
20. `src/lib/inventory/foundation/foundation-product-mapping.ts`
21. `src/lib/inventory/foundation/foundation-product-mapping.test.ts`
22. `src/lib/auth/get-current-user.ts`
23. `src/lib/auth/get-current-dealer.ts`
24. `src/lib/auth/require-active-dealer.ts`
25. `src/lib/auth/require-staff-capability.ts`
26. `src/lib/auth/estimate-save-actor-context.ts`
27. `src/lib/auth/estimate-save-actor-context.test.ts`
28. `src/lib/auth/resolve-estimate-save-actor-context.ts`
29. `src/lib/staff/current-staff-authorization-core.ts`
30. `src/lib/staff/current-staff-authorization-core.test.ts`
31. `src/lib/staff/get-current-staff.ts`
32. `src/lib/staff/staff-types.ts`
33. `src/lib/supabase/server.ts`
34. `src/lib/supabase/admin.ts`
35. `src/lib/inventory/inventory-actions.ts`
36. `src/lib/inventory/receiving-actions.ts`
37. `src/app/api/auth/status/route.ts`
38. `src/app/api/observability/event/route.ts`
39. `src/app/api/observability/event/route.test.ts`

Items 16–21 must exist at the accepted D2/D3A/D3B merged heads. Their absence returns `BLOCKED_D2_D3A_OR_D3B_NOT_CLOSED`.

### Accepted dependency evidence — exact artifacts

1. immutable Foundation package identity/version/integrity/commit/tree;
2. exported Foundation identity, command/query, owner, location, product, actor/operator, idempotency, version, evidence, and error declarations;
3. accepted D3A persistence objects/ports/RLS/grant evidence;
4. accepted D3B product-mapping objects/ports/evidence;
5. accepted D2/D3A/D3B delivery commits, trees, hashes, and test results.

No unlisted Foundation implementation source, environment file, secret, database row, or customer data may be transmitted.

## 10. Gate A Required Diagnosis

Gate A must report:

1. exact Book, D2, D3A, D3B, and Foundation identities plus every received hash;
2. current Next.js, Supabase SSR, and supabase-js versions and relevant official change notices;
3. the exact verified-identity method and request-scoped caching/freshness contract;
4. current multi-membership behavior and the accepted replacement or blocker;
5. exact Office AZ operator authority source, statuses, revocation, role/capability matrix, and location scope;
6. proof that dealer roles are not silently promoted into Office AZ inventory roles;
7. a complete five-surface and 18-command authorization matrix;
8. exact actor/operator equality and separation rules;
9. owner, dealer/tenant, location, product mapping, request, idempotency, version, and evidence binding;
10. exact server-action versus server-only orchestration boundary;
11. exact Route Handler methods, operation DTOs, body/media/size validation, same-origin/CSRF, cache, CORS, and status-code contract;
12. closed public result/failure union, log redaction, and audit contract;
13. proof that failures make zero downstream calls and accepted requests call the port once without retry;
14. proof that no browser or route imports the Foundation package, persistence implementation, admin client, or secret;
15. whether the proposed four implementation paths are sufficient; otherwise return a literal minimum correction;
16. exact focused unit/source/route/typecheck/diff commands for Gate B;
17. exact D6 real-request/disposable cases without running them;
18. zero-action and final Git-state confirmation.

## 11. Proposed D4 Implementation Allowlist

The C3 paths remain proposals until Gate A accepts them:

1. `src/lib/inventory/foundation/foundation-server-actions.ts` (new)
2. `src/lib/inventory/foundation/foundation-server-actions.test.ts` (new)
3. `src/app/api/inventory/foundation/route.ts` (new)
4. `src/app/api/inventory/foundation/route.test.ts` (new)

No existing auth, staff, Supabase, D1/D2/D3A/D3B, inventory, route, UI, migration, dependency, configuration, or generated file may be edited. Any literal-path change requires a later Owner-approved reconciliation.

## 12. Gate B Minimum Test Contract

The later focused tests must prove at least:

- unauthenticated, invalid/stale session, zero membership, multiple membership, inactive membership, failed membership read, missing operator authority, inactive operator, unknown role/capability, owner mismatch, location mismatch, missing mapping, malformed input, unknown operation, replay conflict, stale version, and dependency failure all fail closed;
- dealer `owner`, `manager`, or `staff` alone never authorizes an Office AZ inventory command;
- actor/operator are both bound and neither is defaulted from the other;
- server-owned dealer/tenant, owner, location, product, request, idempotency, version, and evidence replace or reject conflicting client values;
- each pre-invocation denial produces zero downstream calls;
- an accepted operation invokes exactly one accepted downstream surface with no retry or automatic command chaining;
- query DTOs expose only accepted fields and never raw audit/recovery/cross-location data to dealer callers;
- mutation routes reject cross-origin, wrong media type, oversized/malformed body, extra fields, unknown method, unknown operation, and client-supplied authority;
- authenticated responses are dynamic/no-store and stable HTTP/action failures contain no raw error;
- browser-compatible files cannot import the Foundation runtime package, persistence adaptor, product mapping implementation, admin client, service role, or secrets;
- all existing D1 tests remain unchanged and passing where included by the accepted focused command;
- TypeScript and exact four-path `git diff --check` pass.

## 13. Protected and Frozen Content

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 14. Absolute Prohibitions

- No private-source transmission, Claude invocation, sub-agent, delegation, or broad repository scan from this governance creation.
- No package/registry access, dependency install/update, lockfile read or change, or Foundation source copy.
- No DB/Supabase/MCP/provider connection, migration generation/apply, reset, seed, query, backfill, or schema mutation.
- No service-role/admin client in a browser-callable route or action and no secret or token exposure.
- No authorization from client dealer/role/operator/owner/location fields, UI state, dealer role alone, user metadata, `authenticated` role alone, or arbitrary first membership.
- No generic Foundation proxy, browser direct DB/runtime/package access, client direct RPC, dual-write, fallback-to-local, automatic retry, command chaining, silent tenant choice, or guessed success.
- No edit to existing auth/staff/Supabase/D1/D2/D3A/D3B/inventory/route/UI/migration/dependency/configuration/protected files.
- No real login, hosted Auth, browser, shared/preview/staging/production verification, real-customer data, Android, provider, or deployment.
- No stage, commit, push, PR mutation, Ready, merge, tag, release, or production-ready declaration.

## 15. Required Results

### Gate A

Return `INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY_DIAGNOSIS_RESULT_V1` with verdict, identities/hashes, current framework facts, identity/freshness contract, authority sources, command/query matrix, binding matrix, HTTP/action contract, closed failures, exact scopes/tests, D6 plan, blockers, and zero-action statement.

### Gate B

Return `INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY_IMPLEMENTATION_RESULT_V1` with exact changed paths, authority/DTO/result contracts, operation matrix, no-invocation evidence, focused test counts, typecheck, diff check, hashes, protected metadata, and final unstaged/uncommitted state.

## 16. Exit Gate

D4 source completion requires D2, D3A, and D3B closure, Gate A acceptance, explicit resolution of Office AZ operator authority, Gate B implementation acceptance, separately authorized stage/commit/push/Draft PR, independent review, Ready, and merge.

D4 completion authorizes no D5 UI/cutover, D6 real-request/disposable execution, D7 retirement, Android, provider, shared/staging/production apply, or deployment.
