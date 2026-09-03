# Claude Directive — INV001-P19 Book D4A Office AZ Operator Authority

## 1. Identity

- Directive: `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_V1`
- Read-only diagnosis marker: `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_DIAGNOSIS_RESULT_V1`
- Owner-decision result marker: `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_OWNER_DECISION_V1`
- Future implementation result marker: `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_IMPLEMENTATION_RESULT_V1`
- Book repository: `nisikawa-officeAZ/GYEON`
- Book base branch: `main`
- Fixed Book base commit/tree: `c799b14b15a95177442e4505807d57056292e4d1` / `d8eacb42802d7b9d8fbf20875c46c087e5f0b790`
- Proposed governance branch: `agent/inv001-p19-book-d4a-office-az-operator-authority-governance`
- D4 governance PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/60`
- D4A governance PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/61`
- D4A merged commit/tree: `6fc4fe5bfcd681f04945c7ae7844dac61273cd3d` / `b948ea068b171bbd8d52117b6313c7682f403457`
- Owner-decision correction branch: `agent/inv001-p19-book-d4a-r1-owner-authority-decision`
- Current mode: Owner-ratified authority decision and formal-spec reconciliation only

D4A resolves the missing Office AZ inventory-operator authority that blocks D4. It does not implement authentication, create a migration, grant a role, expose a route, call Foundation, or authorize any inventory command.

## 2. Ratified Facts

1. `OFFICE_AZ` is the only currently authorized live inventory owner.
2. The three physical locations are `GYEON ロジスティックセンター`, `GYEON スタジオ`, and `オフィスアズ店舗`.
3. Location is a whereabouts and operational-scope dimension. It is not a separate inventory owner. Office AZ total on-hand is derived from the three location balances.
4. Dealer roles `owner`, `manager`, `staff`, and `readonly` are dealer-business roles and never grant Office AZ inventory authority.
5. Login, Supabase `authenticated`, UI visibility, a client role string, a dealer membership, `admin_users`, or service-role access alone is never authorization.
6. Actor and operator are distinct. Neither may be defaulted from the other.
7. Missing, inactive, suspended, revoked, ambiguous, stale, unreadable, unknown, cross-owner, or out-of-location authority fails closed before any Foundation call.
8. The Owner decision dated 2026-09-03 formally grants inbound confirmation to a warehouse operator, warehouse manager, and super admin within their location scope and supersedes the older narrower row.

## 3. Existing Evidence and Authority Gaps

### Existing Book roles

- `dealer_members` and `dealer_staff` describe dealer tenancy and dealer business permissions.
- `requireStaffCapability()` exposes only `edit`, `finance`, `delete`, and `manage`; it is not an Office AZ inventory authority source.
- `getCurrentDealer()` may silently choose one active dealer membership and cannot be used for Office AZ operator resolution.
- `getEstimateSaveActorContext()` is a useful coherent request-local pattern but only proves estimate-edit context for one dealer.
- `ENTERPRISE_ORGANIZATION_SPEC.md` names `warehouse_manager`, but current runtime enforcement, active assignments, status/revocation, location grants, and command capabilities are not proven.
- Existing `super_admin` descriptions that rely on service-role bypass are not acceptable command authorization for D4A.

### Resolved formal-spec contradiction

Before this D4A-R1 correction, `SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md` assigned:

- warehouse operator: work queue, pick, inspection, shipping-label confirmation, shipping information;
- warehouse manager: warehouse-operator permissions plus exception handling, unaccepted-order review, and reminder handling;
- super admin: shop/rule/calendar settings and inbound confirmation.

The Owner approved the closed authority matrix on 2026-09-03. `SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md` is corrected in the same governance candidate so that inbound confirmation belongs to warehouse operator, warehouse manager, and super admin within their location scope. The former `BLOCKED_FORMAL_ROLE_CONTRADICTION` condition is resolved at the specification level only; no live grant or implementation is authorized.

### Still unresolved for implementation

- canonical operator identity and assignment data source;
- exact relationship, if any, to enterprise organization roles;
- exact persistence/RLS/RPC boundary and migration ownership.

The business-policy decisions are closed below. Implementation details remain denied until a separate gate accepts the canonical data source, schema, RLS, RPC, resolver, tests, and literal paths. No ratified business row is a live grant.

## 4. Proposed Authority Object

Gate A must prove one coherent server-resolved object or fail closed:

```text
OfficeAzInventoryAuthority {
  authenticatedUserId
  actorId
  operatorId
  operatorStatus
  authoritySource
  authorityVersion
  owner = OFFICE_AZ
  role
  capabilities[]
  allowedLocationIds[]
  validFrom
  validUntil
  resolvedAt
}
```

Requirements:

- no browser-supplied field is authority;
- the authenticated user, actor, and operator linkage is read server-side;
- `active` is the only permissive operator status;
- status, grants, location scope, validity, and version are read together or bound by an accepted transaction/version contract;
- zero or multiple current operator assignments fail closed;
- an operator may have no implicit location access;
- super admin receives the closed capabilities below and explicit access to the three current Office AZ locations only;
- a future location is never added automatically and requires a new Owner decision plus server-side activation;
- authority may not fall back to dealer roles, JWT user metadata, stale cached app metadata, environment flags, or service-role availability;
- self-grant, self-reactivation, and self-expansion are prohibited;
- assignment, grant, suspension, revocation, and denied high-risk attempts require append-only audit evidence.

## 5. Role Vocabulary

The following IDs are Owner-ratified normalized role identifiers, but are not yet implementation constants or live grants:

| Ratified role ID | Japanese label | Boundary |
|---|---|---|
| `office_az_warehouse_operator` | 倉庫担当者 | Assigned-location physical warehouse work only |
| `office_az_warehouse_manager` | 倉庫管理者 | Operator work plus separately granted exception/supervision capabilities |
| `office_az_inventory_super_admin` | スーパーアドミン | Explicit administrative inventory capabilities; never blanket service-role authority |
| `office_az_inventory_service` | システム実行主体 | Narrow machine commands with rotated server-held identity and exact command allowlist |

Dealer and GYEON Japan catalogue roles are outside this vocabulary. Role labels never replace capability checks.

## 6. Capability Vocabulary

The Owner ratifies the following closed capability vocabulary. Gate A must map it to the minimum implementation without widening it:

- `inventory.quantity.read`
- `inventory.audit.read`
- `inventory.inbound.confirm`
- `inventory.adjust`
- `inventory.reservation.manage`
- `inventory.fulfillment.open`
- `inventory.fulfillment.pick`
- `inventory.fulfillment.pack`
- `inventory.fulfillment.ship`
- `inventory.fulfillment.return`
- `inventory.fulfillment.restock`
- `inventory.transfer.request`
- `inventory.transfer.dispatch`
- `inventory.transfer.receive`
- `inventory.stocktake.open`
- `inventory.stocktake.count`
- `inventory.stocktake.complete`
- `inventory.snapshot.export`
- `inventory.snapshot.import`
- `inventory.recovery.evaluate`
- `inventory.authorization.issue`
- `inventory.operator.manage`

Unknown capabilities deny. A broad `inventory.manage` capability is prohibited.

## 7. Owner-Ratified Command Disposition

The policy is final. `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` means that the business decision is fixed but the command must continue to deny until the later implementation gate is completed.

| Foundation command/surface | Warehouse operator | Warehouse manager | Super admin | System identity | Status |
|---|---|---|---|---|---|
| quantity/status query | assigned locations | assigned locations | current three locations | narrow read service | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `receive_supplier_shipment` | assigned location | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `pick_fulfillment` | assigned location | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `pack_fulfillment` | assigned location | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `ship_fulfillment` | assigned location | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `open_fulfillment` | no | no | no direct human execution | order service only | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `reserve`, `cancel_reservation`, `confirm_shipment` | no | no | no direct human execution | order service only | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `adjust_inventory` | no | assigned location with reason | current three locations with reason | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `return_fulfillment`, `restock_fulfillment` | no | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `request_transfer` | no | assigned locations | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `dispatch_transfer`, `receive_transfer` | authorized source/destination locations | authorized source/destination locations | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `stocktake_open` | no | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `stocktake_finalize_line` | assigned location | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `stocktake_complete` | no | assigned location | current three locations | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| `authorize_with_evidence` | no | no | no direct human execution | narrow authority service only | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| audit read | no | assigned scope | current three locations and all operator events | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| snapshot export | no | no | allowed | narrow snapshot service | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| snapshot import and recovery evaluation | no | no | re-authentication, reason, pre-backup, explicit confirmation, and audit required | narrow recovery service | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |
| operator assignment, suspension, revocation, and permission management | no | no | allowed; self-grant and self-reactivation prohibited | no | `RATIFIED_POLICY_IMPLEMENTATION_NOT_AUTHORIZED` |

Every command must also bind exact owner, location, product mapping, request, idempotency, aggregate version, actor/operator, and evidence requirements from D4. A role match without all bindings denies.

## 8. Location and Owner Rules

1. Owner is always `OFFICE_AZ` for current live use. `ATTRACTION` denies.
2. Location scope is an explicit set of canonical Foundation location IDs, not a user-entered label.
3. Source and destination must both be authorized where a transfer spans locations.
4. Assigned-location authorization never changes the Office AZ global total calculation.
5. Cross-location quantity visibility requires an explicit read capability; one-location assignment must not leak other-location balances.
6. The EC sellable/reservable location subset remains `NOT_CONFIGURED`; D4A must not derive it from operator grants.
7. A command lacking a required location or naming an unrecognized/retired location denies before invocation.
8. Super admin covers exactly the three current locations. A future location remains denied until a separate Owner decision and server-side activation.
9. The initial named operational assignment for 小尾野氏 is warehouse operator only. This statement does not create an Auth, DB, RLS, or account grant.

## 9. Server, Database, and RLS Boundary

Gate A must decide the canonical persistence design before any implementation. At minimum it must prove:

- operator identity, user linkage, role, status, capability grants, location grants, validity, and version;
- unique active assignment and revocation behavior;
- who may assign, suspend, revoke, or widen authority;
- RLS and grants that prevent ordinary dealer sessions from reading or mutating operator authority;
- explicit Data API exposure and table/function grants evaluated separately from RLS policies; neither may be inferred from the other;
- a server-owned resolution path that does not expose service-role or raw authority rows to the browser;
- atomic authority reads appropriate to command risk;
- append-only audit for administrative changes and denied high-risk operations;
- no `SECURITY DEFINER` or admin-client shortcut that turns possession of a route into authority.

Any future exposed-schema authority table requires exact `anon`/`authenticated` grants, RLS enabled, operation-specific policies, and allow/deny database tests. `TO authenticated` without an ownership/authority predicate is prohibited. Authorization must not use client-editable `user_metadata`, and JWT/app-metadata authority may not substitute for current revocation-sensitive rows.

The D3A inventory persistence migration and the D4A authority persistence migration must not be silently combined. Gate A must name the owning phase and literal migration path or return `CHANGES_REQUIRED_IMPLEMENTATION_SCOPE`.

## 10. Separate Gates

### Gate A — tool-disabled read-only authority diagnosis

After separate Owner authorization for every private file, Claude may read the exact accepted scope and return one result. No edit, test, DB, Auth, Supabase, browser, package, registry, stage, commit, push, PR mutation, or external action is allowed.

Allowed verdicts:

- `PASS_AUTHORITY_DECISIONS_READY`
- `CHANGES_REQUIRED_AUTHORITY_SOURCE`
- `CHANGES_REQUIRED_READ_SCOPE`
- `BLOCKED_D2_D3A_D3B_PRECONDITION`
- `BLOCKED_GOVERNANCE_PRECONDITION`

### Owner decision gate — completed at policy level

The Owner accepted the following on 2026-09-03 under marker `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_OWNER_DECISION_V1`:

1. the canonical three role IDs;
2. the inbound reconciliation;
3. every 18-command and five-surface row in section 7;
4. super-admin location scope;
5. operator assignment/revocation authority;
6. high-risk safeguards: re-authentication, reason, pre-backup, explicit confirmation, and audit for snapshot import/recovery; no additional second-human approval is introduced by this decision;
7. human versus service identity boundaries;
8. authority persistence remains a separate later implementation scope and may not be combined silently with D3A.

### Future implementation gate

Only after D2/D3A/D3B closure and a separately approved literal allowlist may Claude create an uncommitted authority implementation candidate. A future Gate A must determine the minimum pure core, resolver, tests, and migration/RLS paths against the now-ratified policy. No implementation path is authorized by this directive.

### D6 verification gate

Real login, SSR cookies, active/suspended/revoked operators, real RLS claims, multi-membership users, cross-owner/location denial, concurrent revocation, CSRF, separate connections, cleanup, and evidence hashing remain D6 and cannot be replaced by source assertions.

## 11. Proposed Gate A Read Scope

Transmission is not authorized by this directive. Proposed exact Book files:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
4. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
5. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4_AUTHENTICATED_SERVER_BOUNDARY.md`
6. `docs/master_specification/CLAUDE_DIRECTIVE_INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY.md`
7. `docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md`
8. `docs/master_specification/ENTERPRISE_ORGANIZATION_SPEC.md`
9. `docs/master_specification/SAAS_ENTERPRISE_SPEC.md`
10. `src/lib/inventory/foundation/foundation-adaptor-types.ts`
11. `src/lib/auth/get-current-user.ts`
12. `src/lib/auth/get-current-dealer.ts`
13. `src/lib/auth/require-staff-capability.ts`
14. `src/lib/auth/estimate-save-actor-context.ts`
15. `src/lib/auth/resolve-estimate-save-actor-context.ts`
16. `src/lib/staff/staff-types.ts`
17. `src/lib/staff/current-staff-authorization-core.ts`
18. `src/lib/staff/get-current-staff.ts`
19. `src/lib/supabase/server.ts`
20. `src/lib/supabase/admin.ts`
21. `src/lib/inventory/inventory-actions.ts`
22. `src/lib/inventory/receiving-actions.ts`

Any database/RLS/migration read requires Gate A to return a separate exact scope request. No wildcard migration scan is allowed.

## 12. Gate A Required Result

Return `INV001_P19_BOOK_D4A_OFFICE_AZ_OPERATOR_AUTHORITY_DIAGNOSIS_RESULT_V1` containing:

- fixed commit/tree and complete received-file hashes;
- all role-source contradictions;
- one row for all 18 commands and five D1 surfaces;
- ratified, proposed, unresolved-deny, and prohibited distinctions;
- exact operator, actor, owner, tenant, location, capability, status, validity, version, and evidence binding;
- canonical authority data-source recommendation and literal minimum schema/read-scope request;
- role assignment, suspension, revocation, self-grant prevention, and audit rules;
- human/service identity and separation-of-duty proposal;
- exact Owner questions requiring decisions;
- proposed implementation allowlist and tests without editing;
- D6 real-request matrix without execution;
- zero-action and final Git-state confirmation.

## 13. Protected and Frozen Content

Claude must not open, read, diff, copy, transmit, stage, or modify the contents of:

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

Only pathname, mode, blob identity, and clean/dirty state supplied by MacBook Codex may be reported.

## 14. Absolute Prohibitions

- No private-source transmission, Claude invocation, sub-agent, delegation, broad scan, or external AI action during governance creation.
- No auth, staff, inventory, Foundation, route, UI, migration, dependency, lockfile, configuration, protected, or generated source edit.
- No login, Auth, DB, Supabase, provider, registry, browser, Android, shared/staging/production, deployment, or customer-data access.
- No role or capability grant from dealer role, UI state, `authenticated`, user metadata, service-role possession, or arbitrary membership.
- No super-admin access beyond the three current locations or the closed command matrix; future locations and unknown commands deny.
- No implementation, executable test, stage, commit, push, PR mutation, Ready, merge, tag, release, or production-ready declaration.

## 15. Exit Gate

D4A-R1 governance is ready for delivery only after the exact four-document diff, directive hash, formal-spec reconciliation, closed Owner-ratified matrix, implementation-deny behavior, D4/D6 separation, and protected metadata pass independent verification.

D4A implementation remains blocked until D2/D3A/D3B closure, a fresh exact-scope Gate A diagnosis, separate implementation authorization, and exact schema/RLS/source allowlists are accepted.
