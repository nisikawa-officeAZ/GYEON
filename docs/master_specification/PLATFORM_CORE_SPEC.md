# Platform Core Specification

**Module**: `src/lib/platform-core/`  
**Sprint**: Sprint 11T  
**Version**: 1.0.0  
**Status**: Foundation complete

---

## 1. Purpose

Platform Core is the shared infrastructure layer for all Office AZ applications. It provides:
- A canonical registry of all applications on the platform
- A registry of all shared services (modules) those applications consume
- Cross-application isolation policy rules
- A feature/capability discovery API

Platform Core has no business logic of its own. It is the architectural contract that prevents applications from directly depending on each other.

---

## 2. Applications

Five applications are registered in the Platform Core:

| Application | ID | Status | Target Users |
|---|---|---|---|
| GYEON Detailer Agent | `dealer_agent` | **active** | Detailing shop owners, managers, technicians |
| Enterprise Distribution Platform | `enterprise_distribution` | planned | Attraction Co., Ltd. staff, B2B buyers |
| Warehouse Management System | `warehouse` | planned | Warehouse staff, logistics coordinators |
| Accounting System | `accounting` | planned | Finance team, accounts receivable |
| Customer Relationship Management | `crm` | planned | Sales team, account managers |

### Application isolation

All 5 applications are fully isolated. No application may import from another application's source tree. All shared functionality flows through `src/lib/platform-core/`.

### Deployment model

Each application is a separate Next.js deployment with its own Supabase project. The Dealer Agent and all future applications share no database tables.

| Application | Deployment | Database |
|---|---|---|
| dealer_agent | Separate Vercel project | Shared Supabase project (multi-tenant) |
| enterprise_distribution | Separate Vercel project | Separate Supabase project |
| warehouse | Separate Vercel project | Separate Supabase project |
| accounting | Separate Vercel project | Separate Supabase project |
| crm | Separate Vercel project | Separate Supabase project |

---

## 3. Shared Services (Modules)

Ten shared modules are registered. Applications declare which modules they require or optionally consume:

| Module | ID | Status | Source Path |
|---|---|---|---|
| Authentication | `authentication` | **active** | `src/lib/supabase/` |
| Authorization | `authorization` | **active** | `src/lib/plans/` |
| PDF | `pdf` | **active** | `src/lib/pdf/` |
| AI Gateway | `ai_gateway` | planned | `src/lib/ai/` |
| AI Marketplace | `ai_marketplace` | planned | `src/lib/ai-marketplace/` |
| OCR | `ocr` | planned | `src/lib/ocr/` |
| LINE | `line` | planned | `src/lib/line/` |
| Media | `media` | planned | `src/lib/media/` |
| Notification | `notification` | planned | `src/lib/notifications/` |
| Analytics | `analytics` | planned | `src/lib/dashboard/` |

### Module-to-application matrix

| Module | dealer_agent | enterprise_distribution | warehouse | accounting | crm |
|---|:---:|:---:|:---:|:---:|:---:|
| authentication | required | required | required | required | required |
| authorization | required | required | required | required | required |
| pdf | required | required | required | required | — |
| ai_gateway | optional | optional | optional | optional | optional |
| ai_marketplace | optional | optional | — | — | optional |
| ocr | optional | optional | — | optional | — |
| line | optional | optional | — | — | optional |
| media | optional | optional | — | — | optional |
| notification | optional | required | required | required | required |
| analytics | optional | optional | — | — | — |

---

## 4. Cross-Application Policy

10 isolation rules govern the platform. 8 are strict; 2 are advisory.

### Strict rules (8)

| Rule ID | Title | Summary |
|---|---|---|
| PLAT-001 | No Direct Application Imports | Applications may not import from each other's source trees |
| PLAT-002 | Shared Services Through Platform Core | All shared functionality declared in `src/lib/platform-core/` |
| PLAT-003 | Shared Authentication | Single Supabase Auth instance per deployment |
| PLAT-004 | Shared AI Gateway | Single AI Gateway; applications do not maintain independent provider registries |
| PLAT-005 | Separate Database Schema Per Application | Each application has its own Supabase project; no cross-schema SQL |
| PLAT-006 | API Keys Never Shared Between Applications | Credentials are application-scoped; never cross-application |
| PLAT-007 | Identity Injection Always Server-Side | `dealer_id` / `company_id` always from server-side session; never URL params or client state |
| PLAT-009 | No Synthetic Data in Production | No fake data, placeholder implementations, or mock responses in production paths |

### Advisory rules (2)

| Rule ID | Title | Summary |
|---|---|---|
| PLAT-008 | Shared Module Versions Are Pinned | All applications consuming a shared module use the same version |
| PLAT-010 | Dealer-Facing UI May Remain Japanese | Application UI in Japanese is permitted; all infrastructure code, comments, and docs in English |

### Always-shared modules

These modules must never be duplicated per application:
`authentication` · `authorization` · `ai_gateway` · `ai_marketplace` · `pdf` · `notification`

---

## 5. Feature Discovery

`discoverFeatures(query)` returns matching capabilities, features, and module manifests.

### Query options

```typescript
interface FeatureDiscoveryQuery {
  application_id?: PlatformApplicationId;  // filter by application
  module_id?:      PlatformModuleId;        // filter by module
  status?:         PlatformCapabilityStatus; // "active" | "planned" | "experimental" | "deprecated"
}
```

### Key discovery functions

| Function | Description |
|---|---|
| `discoverFeatures(query)` | Full discovery with capabilities, features, and modules |
| `getAvailableModules(app_id)` | All module manifests for an application |
| `getActiveCapabilitiesForApplication(app_id)` | Capabilities with status "active" |
| `getPlannedCapabilitiesForApplication(app_id)` | Capabilities with status "planned" |
| `getFeaturesForApplication(app_id)` | Platform features available to an application |
| `isCapabilityAvailable(cap_id, app_id?)` | Point check — is this capability active? |
| `getApplicationModuleSummary(app_id)` | Structured summary: app descriptor + required/optional modules |
| `getPlatformFeatures()` | All declared platform features |

---

## 6. Platform Core Descriptor

```typescript
const PLATFORM_CORE: PlatformCoreDescriptor = {
  version:                    "1.0.0",
  sprint:                     "Sprint 11T",
  application_count:          5,
  active_application_count:   1,
  planned_application_count:  4,
  module_count:               10,
  active_module_count:        3,     // authentication, authorization, pdf
  planned_module_count:       7,
  capability_count:           /* sum of all module capability entries */,
  isolation_rule_count:       10,
  cross_app_isolation:        true,
  shared_auth:                true,
  shared_ai_gateway:          true,
  platform_ui_available:      false, // admin UI not yet built
  target_sprint:              "Sprint 12+",
};
```

---

## 7. Module Structure

```
src/lib/platform-core/
├── platform-types.ts         — all domain types and interfaces
├── application-registry.ts   — 5 application descriptors + lookup helpers
├── shared-services.ts        — 10 module manifests + lookup helpers
├── platform-policy.ts        — 10 cross-application isolation rules
├── feature-discovery.ts      — discovery query API + platform features
├── platform-descriptor.ts    — PLATFORM_CORE singleton descriptor
└── index.ts                  — package barrel (all public exports)
```

---

## 8. Relationship to Existing Modules

### What Platform Core does NOT replace

| Existing module | Purpose | Relationship to Platform Core |
|---|---|---|
| `src/lib/plans/` | Dealer subscription feature gates | Platform Core is above this; gates remain in `plans/` |
| `src/lib/features/feature-registry.ts` | Dealer-facing feature metadata | Platform Core is above this; feature registry remains |
| `src/lib/ai-settings/` | Per-dealer AI configuration | Consumed by `ai_gateway` module in Platform Core |
| `src/lib/ai-marketplace/` | Capability marketplace | Declared as `ai_marketplace` module; code unchanged |
| `src/lib/subscription/` | Subscription types | No change; Platform Core does not touch these |

### Dependency direction

```
Platform Core
  ← consumed by: dealer_agent, enterprise_distribution, warehouse, accounting, crm
  → imports from: none (no application-specific imports)
  → references: src/lib/ai/, src/lib/ai-marketplace/, src/lib/supabase/ (by source_path string only)
```

Platform Core does not import from any application module. It declares paths as strings in module manifests (`source_path`, `spec_document`), not as import statements.

---

## 9. Pending before Sprint 12+

1. **Platform Admin UI** — admin console showing all registered applications, module status, and policy rule compliance
2. **Runtime enforcement** — import-path linting rules (eslint) to enforce PLAT-001 and PLAT-002 at CI time
3. **Warehouse specification** — `WAREHOUSE_SPEC.md` does not yet exist
4. **Accounting specification** — `ACCOUNTING_SPEC.md` does not yet exist
5. **CRM specification** — `CRM_SPEC.md` does not yet exist
6. **Multi-tenant authorization** — PLAT-005 compliance for EDP (`company_id` RLS design)
7. **Notification module specification** — full design for email and scheduled delivery
8. **Platform versioning** — shared module version pinning strategy across applications
