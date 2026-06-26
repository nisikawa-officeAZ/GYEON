# Enterprise Organization Foundation Specification

**Module**: `src/lib/organization/`  
**Sprint**: Sprint 11V  
**Version**: 1.0.0  
**Status**: Foundation complete

---

## 1. Purpose

The Enterprise Organization Foundation provides the canonical multi-organization model for the Office AZ platform. It prepares the platform for multi-company, multi-division, and multi-application deployment while maintaining complete dealer isolation.

This module does not implement persistence. All registries are static declarations. The foundation types and hierarchy enable future runtime organization management without requiring any schema changes today.

---

## 2. Organization Hierarchy

Six levels, forming a tree rooted at the platform singleton:

```
Platform  (tier_1, depth 0)
└── Company  (tier_2, depth 1)
    └── Division  (tier_3, depth 2)
        ├── Branch  (tier_4, depth 3)
        │   └── Dealer  (tier_6, depth 5)
        ├── Dealer  (tier_6, depth 5)   [directly under division]
        └── Warehouse  (tier_5, depth 4)
```

### Level definitions

| Level | Type | Tier | Applications |
|-------|------|------|-------------|
| Platform | `platform` | tier_1 | All 5 applications |
| Company | `company` | tier_2 | dealer_agent, enterprise_distribution |
| Division | `division` | tier_3 | dealer_agent, enterprise_distribution |
| Branch | `branch` | tier_4 | dealer_agent |
| Warehouse | `warehouse` | tier_5 | warehouse, enterprise_distribution |
| Dealer | `dealer` | tier_6 | dealer_agent |

### Invariants

- Exactly one `platform` node exists (singleton root)
- `dealer` nodes are leaf nodes — they have no children
- `warehouse` nodes are leaf nodes — they have no children
- Every node except the platform root has exactly one parent
- No cycles — ancestor path always resolves to the platform root

---

## 3. Registered Organizations (Static)

7 organizations pre-registered in the foundation:

| ID | Name | Type | Status | Parent |
|----|------|------|--------|--------|
| `org_platform_root` | Office AZ Platform | platform | active | — |
| `org_gyeon_japan` | GYEON Japan K.K. | company | active | platform |
| `org_attraction` | Attraction Co., Ltd. | company | planned | platform |
| `org_detailing_division` | Detailing Sales Division | division | active | GYEON Japan |
| `org_wholesale_division` | Wholesale Division | division | planned | GYEON Japan |
| `org_main_warehouse` | Main Warehouse | warehouse | planned | Wholesale Division |
| `org_attraction_sales` | Attraction Sales Division | division | planned | Attraction |

---

## 4. Application Ownership

6 ownership entries mapping organizations to Platform applications:

| Organization | Application | Ownership | Status |
|---|---|---|---|
| GYEON Japan | dealer_agent | owner | active |
| GYEON Japan | enterprise_distribution | owner | planned |
| Attraction | enterprise_distribution | subscriber | planned |
| GYEON Japan | warehouse | owner | planned |
| GYEON Japan | accounting | owner | planned |
| GYEON Japan | crm | owner | planned |

**Ownership types**:
- `owner` — built and operates the application
- `operator` — runs the application under license
- `subscriber` — uses the application as a customer (e.g., EDP B2B buyer)
- `partner` — integrates with the application

---

## 5. Permission Model

### 7 organization roles

| Role ID | Scope | Dealer Role Mapping | Can Manage Children |
|---------|-------|---------------------|---------------------|
| `platform_admin` | platform | — | Yes |
| `company_admin` | company | — | Yes |
| `division_manager` | division | — | Yes |
| `branch_manager` | branch | — | Yes |
| `warehouse_manager` | warehouse | — | No |
| `dealer_owner` | dealer | `owner` | No |
| `dealer_staff` | dealer | `staff` | No |

### Role scope matrix

| Role | platform | company | division | branch | warehouse | dealer |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| platform_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| company_admin | — | ✓ | ✓ | ✓ | — | ✓ |
| division_manager | — | — | ✓ | ✓ | — | ✓ |
| branch_manager | — | — | — | ✓ | — | ✓ |
| warehouse_manager | — | — | — | — | ✓ | — |
| dealer_owner | — | — | — | — | — | ✓ |
| dealer_staff | — | — | — | — | — | ✓ |

### Key permission resources

| Resource | Actions | Notes |
|---|---|---|
| `platform` | read, admin | Platform-level config |
| `application` | manage | Register/configure applications |
| `organization` | manage | Create/modify org nodes |
| `company` | read, write | Company metadata |
| `division` | manage | Create divisions and branches |
| `warehouse` | read, write, manage | Warehouse operations |
| `dealer_settings` | write | Own dealer config only |
| `ai_settings` | write | Own dealer AI config only |
| `estimates` | manage | Own dealer estimates |
| `invoices` | manage | Own dealer invoices |
| `analytics` | read | Scoped to role level |

---

## 6. Governance Policies

8 policies (6 strict, 2 advisory):

| ID | Title | Enforcement |
|----|-------|-------------|
| ORG-001 | Dealer Identity Isolation | strict |
| ORG-002 | Identity Always Server-Side | strict |
| ORG-003 | No Cross-Company Data Access | strict |
| ORG-004 | Application Scoped to Correct Hierarchy Level | strict |
| ORG-005 | Platform Admin Minimum Cardinality | strict |
| ORG-006 | Hierarchy Integrity — No Cycles | strict |
| ORG-007 | Dealer Role Mapping Consistency | advisory |
| ORG-008 | Warehouse Organization Aligned to Warehouse Application | advisory |

**ORG-001 and ORG-002 are the most critical**. They preserve the existing multi-tenant security model: `dealer_id` always comes from `getCurrentDealer()`, and organization hierarchy never provides cross-dealer access.

---

## 7. Platform Core Integration

The organization module integrates with Platform Core through a one-way bridge (`platform-core-bridge.ts`):

```
organization/ ──imports──→ platform-core/  (types only)
platform-core/ ───does not import from──→ organization/
```

The bridge provides:
- `ORG_TYPE_APPLICATION_MAP` — `OrganizationType → PlatformApplicationId[]`
- `APPLICATION_ORG_TYPE_MAP` — `PlatformApplicationId → OrganizationType[]`
- `ORGANIZATION_MODULE_MANIFEST` — module descriptor for Platform Core tooling
- `ORGANIZATION_POLICY_SUMMARY` — policy summary for cross-module reference
- Query helpers: `getApplicationsForOrgType`, `getOrgTypesForApplication`, `isOrgTypeRelevantToApplication`

Applications must not import from `organization/` directly — they access organization metadata through Platform Core integration points.

---

## 8. Module Structure

```
src/lib/organization/
├── organization-types.ts       — all domain types (no imports from platform-core)
├── organization-hierarchy.ts   — 6 levels + 7 static orgs + hierarchy helpers
├── organization-registry.ts    — 6 application ownership entries + lookup helpers
├── organization-roles.ts       — 7 roles + permissions + ROLE_SCOPE_MATRIX
├── organization-policy.ts      — 8 governance policies + lookup helpers
├── platform-core-bridge.ts     — Platform Core integration (only file that imports platform-core)
├── organization-descriptor.ts  — ORGANIZATION_FOUNDATION singleton
└── index.ts                    — barrel export
```

---

## 9. Descriptor

```typescript
const ORGANIZATION_FOUNDATION: OrganizationFoundationDescriptor = {
  version:                       "1.0.0",
  sprint:                        "Sprint 11V",
  hierarchy_level_count:         6,
  registered_organization_count: 7,
  role_count:                    7,
  policy_count:                  8,
  application_ownership_count:   6,
  platform_core_integrated:      true,
  persistence_required:          false,
  target_sprint:                 "Sprint 12+",
};
```

---

## 10. Security Notes

1. **dealer_id isolation preserved** — `Organization` entities never expose cross-dealer data. The `dealer_id_ref` field on `Organization` is typed as `null` in this foundation — runtime dealer linking is handled at the application level.
2. **No authentication changes** — organization roles extend, not replace, Supabase Auth.
3. **Server-side identity** — ORG-002 mandates that `dealer_id` and `organization_id` always come from the server session. Enforced by existing `getCurrentDealer()` pattern.
4. **Admin validation unchanged** — `requireAdmin()` in server actions is unaffected by organization roles.

---

## 11. Pending (Sprint 12+)

1. **Persistence layer** — `organization_nodes`, `organization_members`, `organization_application_links` tables (CTO approval required for migrations)
2. **Runtime role resolution** — replace static ORGANIZATION_REGISTRY with DB-backed queries
3. **Platform Core shared service registration** — register `organization` module in `SHARED_SERVICES_REGISTRY`
4. **Admin UI** — organization tree viewer, member management, role assignment
5. **EDP integration** — connect `org_attraction` to EDP B2B portal (company_id isolation for EDP)
6. **Dealer linking** — runtime link between `Organization` nodes of type `dealer` and `dealer_id` records
