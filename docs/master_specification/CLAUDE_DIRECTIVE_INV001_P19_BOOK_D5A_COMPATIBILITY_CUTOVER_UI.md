# Claude Directive — INV001-P19 Book D5A Compatibility/Cutover UI Governance

## 1. Identity

- Directive: `INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI_GOVERNANCE_V1`
- Read-only diagnosis marker: `INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI_DIAGNOSIS_RESULT_V1`
- Future implementation marker: `INV001_P19_BOOK_D5_COMPATIBILITY_CUTOVER_UI_IMPLEMENTATION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `f85a35266dfdea6e1986982bfea0e451186fbd13` / `a6c9537a242124cf6d48d81488cda217ffa592dc`
- Governance branch: `agent/inv001-p19-book-d5a-compatibility-ui-governance`
- Current mode: governance candidate creation only

D5A defines the read-only diagnosis and future cutover contract for the two existing inventory UIs. It does not edit either UI, connect the Foundation package, create a DTO, call a database, grant authority, run tests, or authorize D5 implementation.

## 2. Ratified Architecture

1. `OFFICE_AZ` is the only current live inventory owner.
2. `GYEON ロジスティックセンター`, `GYEON スタジオ`, and `オフィスアズ店舗` are location scopes under one Office AZ total, not independent owners.
3. Foundation immutable product ID is canonical for Foundation inventory and maps one-to-one to Book `gyeon_products.id`.
4. The private immutable Foundation package is server-only. Browser, Client Components, and Android may never import it directly.
5. D4 is the only future authenticated command/query boundary. UI visibility, client props, dealer roles, `authenticated`, user metadata, admin-client possession, or service-role possession never authorize inventory.
6. D5 may expose Foundation-derived state only after D1, D2, D3A, D3B, D4, and the D4A authority implementation are accepted.
7. No old Book inventory table, action, calculation, or cached quantity may silently substitute when Foundation is missing, unavailable, stale, or unauthorized.
8. D5 is a cutover, not a dual-write bridge. No command may write both Foundation and legacy Book inventory.

## 3. Current Evidence and Blocking Conflicts

### Dealer inventory UI

`src/app/inventory/InventoryClient.tsx` currently:

- receives dealer-local `ProductWithStock[]`;
- calls `getProductsWithStock`, `upsertStockCount`, `createReceivingRecord`, and `getRecentMovements` directly;
- presents case/loose arithmetic as the inventory authority;
- permits receiving and absolute stock counting through legacy actions;
- derives a displayed total from dealer-local rows.

The page loader `src/app/inventory/page.tsx` obtains the same legacy rows before rendering. This is dealer-local inventory behavior and cannot be relabeled as Office AZ Foundation state.

### Logistics admin UI

`src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx` currently receives `LogisticsInventoryRow[]` grouped by dealer. Its page loader calls `getLogisticsInventory()`, which uses an admin client to read `dealer_stock_levels`, `dealers`, `product_orders`, and `product_order_items`, then calculates reserved and available quantities locally.

This is not the accepted Office AZ owner/location/status model. A broad admin read or a derived `total - reserved` calculation is not Foundation authorization or availability evidence.

### Literal-scope conflict

C3 reserved these D5 implementation paths:

1. `src/app/inventory/InventoryClient.tsx`
2. `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx`
3. `src/lib/inventory/foundation/foundation-cutover-ui.test.ts` (new)

The current Server Component loaders and legacy DTO/action imports sit outside that three-path list. Gate A must determine whether the three-path implementation scope is sufficient. If it is not, it must return `CHANGES_REQUIRED_IMPLEMENTATION_SCOPE` with the minimum literal corrected allowlist. It must not hide the mismatch inside client props, reuse legacy rows, or ask D5 clients to call a new broad endpoint directly.

## 4. D5 Cutover State Contract

Every D5 surface must render one explicit server-owned state. Unknown states deny.

| State | Quantity display | Mutation controls | Required behavior |
|---|---|---|---|
| `NOT_CONFIGURED` | none | disabled/absent | Explain that Foundation connection or authority is not configured; never show zero |
| `FORBIDDEN` | none | disabled/absent | Show no cross-owner/location data and no raw authority detail |
| `LOADING` | skeleton only | disabled | Do not flash legacy or cached authoritative quantities |
| `READY` | only sanitized D4 DTO quantities | capability and location scoped | Distinguish Office AZ total, location balances, statuses, reserved, available, and version/evidence time |
| `STALE` | last accepted value clearly marked stale only if the later D4 contract explicitly permits it | disabled | Require refresh; stale data never authorizes a command |
| `ERROR` | none or clearly non-authoritative last-known display | disabled | Never convert transport/parse errors to zero or success |
| `COMMAND_PENDING` | accepted pre-command snapshot only | duplicate command disabled | Preserve request/idempotency identity and prevent double submit |
| `COMMAND_ACCEPTED` | response DTO only | follow returned capability state | Do not predict the post-command balance client-side |
| `COMMAND_REJECTED` | unchanged accepted state | retry only when the typed result permits | Do not silently fall back, auto-retry, or partially update UI |

The UI must distinguish a proven numeric zero from missing, forbidden, stale, mapping-unavailable, or Foundation-unavailable data.

## 5. Surface Separation

### `/inventory`

Gate A must classify the real audience and retained business purpose of this route. Dealer-local stock management is not Office AZ inventory and must not be silently converted into an Office AZ operator tool. If the route remains dealer-local, it stays outside the Foundation cutover and no Foundation quantity is mixed into it. If the Owner later repurposes it, the route, loader, authorization, copy, and navigation require an explicit separate decision.

### `/admin/logistics/inventory`

This route is the candidate Office AZ logistics view, but `requireAdmin()` and an admin client are not sufficient authorization. Future state must come through the accepted D4 boundary, use the D4A operator/capability/location decision, and expose only sanitized DTOs. Raw Foundation audit rows, raw authority assignments, service credentials, other tenants, and ungranted locations must not reach the client.

The two routes may not share a DTO if doing so erases audience, owner, operator, location, capability, status, or evidence distinctions.

## 6. Display and Command Rules

- Show one Office AZ derived total plus per-location breakdowns only when the caller has the required read scope.
- Preserve Foundation status dimensions; do not flatten available, reserved, damaged, quarantine, and in-transit into one editable number.
- Display canonical product mapping failures as blocked rows, not JAN/SKU/name auto-matches.
- Use server-returned capabilities for presentation, but reauthorize every command on the server.
- Do not calculate authoritative availability, reservation, stocktake variance, transfer balance, or post-command quantity in the browser.
- Do not expose a generic command name/input form or generic Foundation proxy.
- Do not import `createAdminClient`, service-role clients, the Foundation package, or persistence adaptors into either Client Component.
- No optimistic quantity mutation. Pending state may lock the control, but accepted state must come from a new server response.
- No automatic retry, command chaining, compensation, or recovery from the browser.
- Empty results, denied results, and failures require different UI states.

## 7. Gate A — Tool-Disabled Read-Only Diagnosis

Gate A may start only after separate Owner authorization to transmit every private file in section 8 to Anthropic Claude Code. It may inspect and propose but may not edit, test, install, build, connect, stage, commit, push, or mutate GitHub.

Allowed verdicts:

- `PASS_D5_IMPLEMENTATION_SCOPE_READY`
- `CHANGES_REQUIRED_IMPLEMENTATION_SCOPE`
- `CHANGES_REQUIRED_ROUTE_AUDIENCE_DECISION`
- `BLOCKED_D1_D4_PRECONDITION`
- `CHANGES_REQUIRED_READ_SCOPE`
- `BLOCKED_GOVERNANCE_PRECONDITION`

A dependency blocker does not excuse incomplete diagnosis. Gate A must still report the exact safe future implementation shape unless a required file is outside the approved read scope.

## 8. Proposed Exact Gate A Read Scope

Transmission is not authorized by this directive. Proposed Book paths are exactly:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_C3_OWNER_DECISION_RATIFICATION.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D1_PURE_ADAPTOR_CONTRACT.md`
7. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY.md`
8. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY.md`
9. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI.md`
10. `docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md`
11. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
12. `src/lib/inventory/foundation/foundation-adaptor-core.ts`
13. `src/app/inventory/page.tsx`
14. `src/app/inventory/InventoryClient.tsx`
15. `src/lib/inventory/inventory-actions.ts`
16. `src/lib/inventory/receiving-actions.ts`
17. `src/lib/inventory/inventory-types.ts`
18. `src/app/admin/logistics/inventory/page.tsx`
19. `src/app/admin/logistics/inventory/LogisticsInventoryClient.tsx`
20. `src/lib/admin/logistics/get-logistics-inventory.ts`
21. `src/lib/admin/logistics/logistics-types.ts`
22. `src/lib/admin/get-current-admin.ts`
23. `src/lib/admin/require-admin.ts`
24. `src/lib/auth/get-current-dealer.ts`

No wildcard, directory scan, migration content, database schema, package registry, environment, secret, protected content, or Foundation repository source is included.

## 9. Gate A Required Result

Return `INV001_P19_BOOK_D5A_COMPATIBILITY_CUTOVER_UI_DIAGNOSIS_RESULT_V1` containing:

- fixed commit/tree and SHA-256 for all 24 received files;
- current route, loader, DTO, read, write, authorization, and error-state map for both surfaces;
- every legacy table/action/calculation that must not remain authoritative after cutover;
- `/inventory` audience decision requirement and safe alternatives without selecting one by inference;
- D1-to-D4/D4A-to-D5 data and command flow;
- closed DTO proposal that preserves owner, operator, location, product mapping, capability, status, quantity dimensions, version, evidence time, and typed failure;
- exact UI states and control behavior;
- exact proof that browser code imports no package, persistence, admin/service-role client, or legacy fallback;
- exact assessment of the C3 three-path scope and minimum corrected literal allowlist if required;
- focused test matrix for zero-versus-unknown, forbidden data, stale state, mapping failure, pending/double submit, rejected command, cross-location denial, and no fallback/dual-write;
- dependency status and a zero-change confirmation.

## 10. Future Implementation Gate

D5 implementation may begin only after:

1. D2 package consumer is merged and fixed;
2. D3A persistence is merged and verified;
3. D3B product mapping is merged and verified;
4. D4 authenticated server boundary and D4A authority implementation are merged and accepted;
5. Gate A is independently accepted;
6. the Owner decides the `/inventory` audience if Gate A returns that blocker;
7. Codex publishes a new exact implementation instruction and the Owner separately approves its literal allowlist.

No implementation path is authorized now. C3's three paths remain reservations until Gate A proves or corrects them.

## 11. Protected and Frozen Content

Claude and all D5 phases must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 12. Absolute Prohibitions

- No UI, route, action, DTO, test, auth, inventory, package, persistence, mapping, migration, dependency, lockfile, configuration, or protected-source edit.
- No Claude/private-source transmission, sub-agent, delegation, external AI, package/registry, Auth, DB, Supabase, provider, browser, Android, shared/staging/production, or customer-data access.
- No executable test, build, install, stage, commit, push, PR mutation, Ready, merge, tag, release, or deployment.
- No Foundation rule duplication, client quantity authority, client capability authority, generic proxy, direct package import, legacy fallback, dual-read reconciliation, or dual write.
- No route repurposing, role widening, location widening, product auto-match, or unresolved decision by inference.

## 13. Governance Exit Gate

D5A governance is ready for delivery only after the exact three-document diff, directive hash, fixed base, current-source conflict evidence, route-audience blocker, literal read scope, C3 allowlist sufficiency check, D1-D4 dependency wall, no-fallback/no-dual-write contract, D6 separation, and protected metadata pass independent local verification.

D5A governance completion authorizes no diagnosis transmission or D5 implementation.
