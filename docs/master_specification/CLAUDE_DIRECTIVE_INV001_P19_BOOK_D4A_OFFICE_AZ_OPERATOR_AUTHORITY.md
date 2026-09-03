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
- Current mode: governance preparation only

D4A resolves the missing Office AZ inventory-operator authority that blocks D4. It does not implement authentication, create a migration, grant a role, expose a route, call Foundation, or authorize any inventory command.

## 2. Ratified Facts

1. `OFFICE_AZ` is the only currently authorized live inventory owner.
2. The three physical locations are `GYEON ロジスティックセンター`, `GYEON スタジオ`, and `オフィスアズ店舗`.
3. Location is a whereabouts and operational-scope dimension. It is not a separate inventory owner. Office AZ total on-hand is derived from the three location balances.
4. Dealer roles `owner`, `manager`, `staff`, and `readonly` are dealer-business roles and never grant Office AZ inventory authority.
5. Login, Supabase `authenticated`, UI visibility, a client role string, a dealer membership, `admin_users`, or service-role access alone is never authorization.
6. Actor and operator are distinct. Neither may be defaulted from the other.
7. Missing, inactive, suspended, revoked, ambiguous, stale, unreadable, unknown, cross-owner, or out-of-location authority fails closed before any Foundation call.
8. The later Owner decision that inbound confirmation may be performed by a warehouse operator, warehouse manager, or super admin supersedes the older narrower row only after the formal-spec contradiction is recorded and reconciled under an explicit Owner gate.

## 3. Existing Evidence and Authority Gaps

### Existing Book roles

- `dealer_members` and `dealer_staff` describe dealer tenancy and dealer business permissions.
- `requireStaffCapability()` exposes only `edit`, `finance`, `delete`, and `manage`; it is not an Office AZ inventory authority source.
- `getCurrentDealer()` may silently choose one active dealer membership and cannot be used for Office AZ operator resolution.
- `getEstimateSaveActorContext()` is a useful coherent request-local pattern but only proves estimate-edit context for one dealer.
- `ENTERPRISE_ORGANIZATION_SPEC.md` names `warehouse_manager`, but current runtime enforcement, active assignments, status/revocation, location grants, and command capabilities are not proven.
- Existing `super_admin` descriptions that rely on service-role bypass are not acceptable command authorization for D4A.

### Formal-spec contradiction

`SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md` currently assigns:

- warehouse operator: work queue, pick, inspection, shipping-label confirmation, shipping information;
- warehouse manager: warehouse-operator permissions plus exception handling, unaccepted-order review, and reminder handling;
- super admin: shop/rule/calendar settings and inbound confirmation.

The later Owner decision grants inbound confirmation to all three roles. Until an explicit reconciliation updates the formal authority, D4A must report `BLOCKED_FORMAL_ROLE_CONTRADICTION` and must not implement the inbound grant by inference.

### Still unresolved

- canonical operator identity and assignment data source;
- exact relationship, if any, to enterprise organization roles;
- role assignment and revocation administrator;
- explicit location grants and whether super admin is location-unbounded;
- adjustment, transfer, stocktake, return/restock, audit, snapshot, recovery, and emergency authority;
- machine/service identities for reservation and order-orchestration commands;
- separation-of-duty and second-approval requirements for high-risk commands;
- exact persistence/RLS/RPC boundary and migration ownership.

All unresolved permissions remain denied. No least-privilege proposal below is a live grant.

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
- super admin receives only explicit capabilities and locations unless the Owner separately ratifies an all-location rule;
- authority may not fall back to dealer roles, JWT user metadata, stale cached app metadata, environment flags, or service-role availability;
- self-grant, self-reactivation, and self-expansion are prohibited;
- assignment, grant, suspension, revocation, and denied high-risk attempts require append-only audit evidence.

## 5. Role Vocabulary

The following IDs are proposed normalized identifiers, not yet implementation constants:

| Proposed role | Japanese label | Boundary |
|---|---|---|
| `office_az_warehouse_operator` | 倉庫担当者 | Assigned-location physical warehouse work only |
| `office_az_warehouse_manager` | 倉庫管理者 | Operator work plus separately granted exception/supervision capabilities |
| `office_az_inventory_super_admin` | スーパーアドミン | Explicit administrative inventory capabilities; never blanket service-role authority |
| `office_az_inventory_service` | システム実行主体 | Narrow machine commands with rotated server-held identity and exact command allowlist |

Dealer and GYEON Japan catalogue roles are outside this vocabulary. Role labels never replace capability checks.

## 6. Capability Vocabulary

Gate A must accept, correct, or reject a closed capability list. Minimum candidates are:

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

## 7. Provisional Command Disposition

This table separates ratified business behavior from unresolved grants. `PROPOSED` is not authorization.

| Foundation command/surface | Warehouse operator | Warehouse manager | Super admin | System identity | Status |
|---|---|---|---|---|---|
| quantity/status query | assigned locations | assigned locations | explicit locations | narrow read service | `PROPOSED` |
| `receive_supplier_shipment` | yes | yes | yes | no | `OWNER_DECISION_REQUIRES_FORMAL_RECONCILIATION` |
| `pick_fulfillment` | assigned location | assigned location | explicit grant | no | `RATIFIED_ROLE_INTENT_MAPPING_PENDING` |
| `pack_fulfillment` | assigned location | assigned location | explicit grant | no | `RATIFIED_ROLE_INTENT_MAPPING_PENDING` |
| `ship_fulfillment` | assigned location | assigned location | explicit grant | no | `RATIFIED_ROLE_INTENT_MAPPING_PENDING` |
| `open_fulfillment` | no implicit grant | no implicit grant | no implicit grant | order service candidate | `UNRESOLVED_DENY` |
| `reserve`, `cancel_reservation`, `confirm_shipment` | no | no | no implicit grant | order service candidate | `UNRESOLVED_DENY` |
| `adjust_inventory` | no | explicit grant candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `return_fulfillment`, `restock_fulfillment` | no implicit grant | explicit grant candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `request_transfer` | no implicit grant | explicit grant candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `dispatch_transfer`, `receive_transfer` | assigned-location candidate | assigned-location candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `stocktake_open` | no | explicit grant candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `stocktake_finalize_line` | assigned-location candidate | assigned-location candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `stocktake_complete` | no | explicit grant candidate | explicit grant candidate | no | `UNRESOLVED_DENY` |
| `authorize_with_evidence` | no | no | no direct UI grant | narrow authority service candidate | `UNRESOLVED_DENY` |
| audit read | no implicit raw access | scoped candidate | scoped candidate | no | `UNRESOLVED_DENY` |
| snapshot export/import and recovery evaluation | no | no implicit grant | separately approved emergency candidate | recovery service candidate | `UNRESOLVED_DENY` |

Every command must also bind exact owner, location, product mapping, request, idempotency, aggregate version, actor/operator, and evidence requirements from D4. A role match without all bindings denies.

## 8. Location and Owner Rules

1. Owner is always `OFFICE_AZ` for current live use. `ATTRACTION` denies.
2. Location scope is an explicit set of canonical Foundation location IDs, not a user-entered label.
3. Source and destination must both be authorized where a transfer spans locations.
4. Assigned-location authorization never changes the Office AZ global total calculation.
5. Cross-location quantity visibility requires an explicit read capability; one-location assignment must not leak other-location balances.
6. The EC sellable/reservable location subset remains `NOT_CONFIGURED`; D4A must not derive it from operator grants.
7. A command lacking a required location or naming an unrecognized/retired location denies before invocation.

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
- `BLOCKED_FORMAL_ROLE_CONTRADICTION`
- `CHANGES_REQUIRED_AUTHORITY_SOURCE`
- `CHANGES_REQUIRED_READ_SCOPE`
- `BLOCKED_D2_D3A_D3B_PRECONDITION`
- `BLOCKED_GOVERNANCE_PRECONDITION`

### Owner decision gate

The Owner must explicitly accept or correct:

1. the canonical three role IDs;
2. the inbound reconciliation;
3. every unresolved command/surface row;
4. super-admin location scope;
5. operator assignment/revocation authority;
6. high-risk second-approval rules;
7. human versus service identity boundaries;
8. the separate authority persistence owner and migration scope.

### Future implementation gate

Only after the Owner decision, D2/D3A/D3B closure, corrected formal specification, and a separately approved literal allowlist may Claude create an uncommitted authority implementation candidate. Gate A must determine the minimum pure core, resolver, tests, and migration/RLS paths. No implementation path is authorized by this directive.

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
- No implicit super-admin all-location/all-command grant.
- No implementation, executable test, stage, commit, push, PR mutation, Ready, merge, tag, release, or production-ready declaration.

## 15. Exit Gate

D4A governance is ready for delivery only after the exact three-document diff, directive hash, formal-role contradiction, ratified-versus-proposed matrix, unresolved-deny behavior, D4/D6 separation, and protected metadata pass independent verification.

D4A implementation remains blocked until Gate A, explicit Owner decisions, formal-spec correction, D2/D3A/D3B closure, separate implementation authorization, and exact schema/RLS/source allowlists are accepted.
