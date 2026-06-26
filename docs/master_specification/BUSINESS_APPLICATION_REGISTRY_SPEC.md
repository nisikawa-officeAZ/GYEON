# Business Application Registry Specification

**Module**: `src/lib/business-applications/`  
**Version**: 1.1.0 — Sprint 11W (branding updated post-Sprint 11W)  
**Status**: Active — Foundation implemented  
**Last Updated**: 2026-06-26

> **Branding note**: Platform name is **GYEON Business Hub**. See `GYEON_BUSINESS_HUB_BRANDING_SPEC.md` for the canonical name mapping. Internal module IDs and TypeScript identifiers are unchanged.

---

## 1. Purpose

The Business Application Registry is a coordination layer above Platform Core.

| Layer | Concern |
|-------|---------|
| Platform Core | Technical module metadata (shared services, capabilities, isolation policy) |
| Business App Registry | Business-domain metadata (what each application does for users) |
| Organization Foundation | Org hierarchy, roles, permissions, and application ownership |

---

## 2. GYEON Business Hub Application Model

GYEON Business Hub supports six independent business applications on top of shared Platform Core.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GYEON Business Hub                                    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Business Applications (6)                         │   │
│  │                                                                        │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │   │
│  │  │ GYEON Dealer   │  │ GYEON          │  │ GYEON Warehouse        │  │   │
│  │  │ Agent          │  │ Distribution   │  │                        │  │   │
│  │  │ (active)       │  │ (planned)      │  │ (planned)              │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘  │   │
│  │                                                                        │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │   │
│  │  │ GYEON          │  │ GYEON CRM      │  │ GYEON AI Center        │  │   │
│  │  │ Accounting     │  │                │  │                        │  │   │
│  │  │ (planned)      │  │ (planned)      │  │ (planned)              │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                Shared Services (via Platform Core)                    │   │
│  │  Auth · Authorization · AI Gateway · AI Marketplace · PDF            │   │
│  │  OCR · LINE · Media · Notification · Analytics · Organization        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Registered Applications

### 3.1 GYEON Dealer Agent

| Field | Value |
|-------|-------|
| **Display Name** | GYEON Dealer Agent |
| Internal ID | `dealer_agent` |
| Type | `dealer_management` |
| Status | **active** |
| Target | GYEON-certified detailing shop owners, managers, technicians |
| Required Services | authentication, authorization, pdf |
| Optional Services | ai_gateway, ai_marketplace, ocr, line, media, notification, analytics, organization |
| Org Scope | dealer → platform |
| Sprint | Sprint 1 |

**Capabilities (14):** Customer Management, Vehicle Management, Estimate Creation, Work Orders, Completion Reports, LINE Messaging, OCR Document Scanning, PDF Generation, AI Settings, Dealer Settings, Staff Management, AI Content Generation (planned), Maintenance Reminders (planned), Reputation Management (planned)

---

### 3.2 GYEON Distribution

| Field | Value |
|-------|-------|
| **Display Name** | GYEON Distribution |
| Internal ID | `enterprise_distribution` |
| Type | `b2b_distribution` |
| Status | planned |
| Target | Office AZ Group staff, Attraction Co., Ltd. team, authorized wholesalers and retailers |
| Required Services | authentication, authorization, pdf, notification |
| Optional Services | ai_gateway, ai_marketplace, analytics, line, organization |
| Org Scope | company → platform |
| Feature Flag | `enterprise_distribution_enabled` |

**Capabilities (9):** B2B Order Management, Wholesaler Portal, Retailer Portal, Inventory Management, Delivery Note Generation, Monthly Billing, Credit Account Workflows, Product Catalog (future), AI Demand Forecasting (future)

---

### 3.3 GYEON Warehouse

| Field | Value |
|-------|-------|
| **Display Name** | GYEON Warehouse |
| Internal ID | `warehouse` |
| Type | `warehouse_management` |
| Status | planned |
| Target | Warehouse staff, logistics coordinators, warehouse managers |
| Required Services | authentication, authorization, notification |
| Optional Services | ai_gateway, analytics, organization |
| Org Scope | warehouse, company, platform |
| Feature Flag | `warehouse_management_enabled` |

**Capabilities (7):** Stock Receiving, Order Picking, Shipping Management, Inventory Location (future), Shipment Tracking (future), Cycle Count (future), AI Replenishment Suggestions (future)

---

### 3.4 GYEON Accounting

| Field | Value |
|-------|-------|
| **Display Name** | GYEON Accounting |
| Internal ID | `accounting` |
| Type | `financial_management` |
| Status | planned |
| Target | Accounting team, finance managers, company executives |
| Required Services | authentication, authorization, pdf, notification |
| Optional Services | analytics, ai_gateway, organization |
| Org Scope | company → platform |
| Feature Flag | `accounting_enabled` |

**Capabilities (7):** Invoice Management, Account Statements, Closing Day Processing, Payment Status Tracking, Accounts Receivable, Financial Reporting (future), AI Anomaly Detection (future)

---

### 3.5 GYEON CRM

| Field | Value |
|-------|-------|
| **Display Name** | GYEON CRM |
| Internal ID | `crm` |
| Type | `customer_relationship` |
| Status | planned |
| Target | Sales team, account managers, customer success |
| Required Services | authentication, authorization, notification |
| Optional Services | ai_gateway, ai_marketplace, analytics, line, media, organization |
| Org Scope | branch → platform |
| Feature Flag | `crm_enabled` |

**Capabilities (7):** Relationship Management, Sales Follow-up, Inactivity Alerts, Opportunity Tracking (future), Contact Management (future), AI Lead Scoring (future), LINE Business Integration (future)

---

### 3.6 GYEON AI Center

| Field | Value |
|-------|-------|
| **Display Name** | GYEON AI Center |
| Internal ID | `ai_operations` |
| Type | `ai_operations` |
| Status | planned |
| Target | Platform administrators, AI operations engineers, technical management |
| Required Services | authentication, authorization, ai_gateway, ai_marketplace |
| Optional Services | analytics, notification, organization |
| Org Scope | company, platform only |
| Feature Flag | `ai_operations_enabled` |

**Capabilities (8):** AI Execution Monitoring, AI Usage Reporting, AI Marketplace Administration, Provider Health Dashboard, AI Cost Reporting, Budget Policy Administration (future), AI Model Registry (future), AI Audit Log (future)

---

## 4. Application Isolation Rules

All rules complement Platform Core policy (PLAT-001 through PLAT-010).

| Rule | Title | Enforcement |
|------|-------|-------------|
| APP-001 | Applications Must Not Import Each Other | strict |
| APP-002 | Cross-Application Communication Through Shared Services Only | strict |
| APP-003 | Application-Specific Data Must Remain Isolated | strict |
| APP-004 | Cross-Application Workflows Require Explicit Platform Policy Declaration | strict |
| APP-005 | Tenant Identity Is Always Injected Server-Side | strict |
| APP-006 | Organization Scope Validated Server-Side | strict |
| APP-007 | GYEON AI Center May Observe But Not Control Other Applications | strict |
| APP-008 | Feature Flag Gates Are Platform-Scoped and Must Not Be Bypassed | advisory |

---

## 5. Shared Service Dependency Model

| Service | Required By | Optional For |
|---------|------------|--------------|
| authentication | all 6 | — |
| authorization | all 6 | — |
| ai_gateway | GYEON AI Center | GYEON Dealer Agent, GYEON Distribution, GYEON Warehouse, GYEON Accounting, GYEON CRM |
| ai_marketplace | GYEON AI Center | GYEON Dealer Agent, GYEON Distribution, GYEON CRM |
| pdf | GYEON Dealer Agent, GYEON Distribution, GYEON Accounting | — |
| notification | GYEON Distribution, GYEON Warehouse, GYEON Accounting, GYEON CRM | GYEON AI Center |
| ocr | — | GYEON Dealer Agent |
| line | — | GYEON Dealer Agent, GYEON Distribution, GYEON CRM |
| media | — | GYEON Dealer Agent, GYEON CRM |
| analytics | — | all 6 |
| organization | — | all 6 |

---

## 6. Organization Integration

| Application | Display Name | Supported Org Types | Admin Roles |
|-------------|-------------|---------------------|-------------|
| `dealer_agent` | GYEON Dealer Agent | dealer, branch, division, company, platform | platform_admin, dealer_owner |
| `enterprise_distribution` | GYEON Distribution | platform, company, division, branch, warehouse | platform_admin, company_admin |
| `warehouse` | GYEON Warehouse | platform, company, division, warehouse | platform_admin, company_admin |
| `accounting` | GYEON Accounting | platform, company, division | platform_admin, company_admin |
| `crm` | GYEON CRM | platform, company, division, branch | platform_admin, company_admin |
| `ai_operations` | GYEON AI Center | platform, company | platform_admin |

---

## 7. Module Structure

```
src/lib/business-applications/
├── index.ts                        — package barrel (public API)
├── business-application-types.ts  — domain types
├── business-application-registry.ts — all 6 application manifests
├── application-capabilities.ts    — capability discovery API
├── application-isolation-policy.ts — APP-001 through APP-008
├── organization-integration.ts    — per-app org scope declarations
└── platform-core-bridge.ts        — Platform Core-compatible adapters
```

**Dependency direction:**
```
business-applications/ → organization/ → platform-core/
```
No circular imports. `platform-core/` does not import from `business-applications/`.

---

## 8. Capability Counts

| Display Name | Internal ID | Available | Planned | Future | Total |
|-------------|-------------|-----------|---------|--------|-------|
| GYEON Dealer Agent | `dealer_agent` | 11 | 3 | 0 | 14 |
| GYEON Distribution | `enterprise_distribution` | 0 | 7 | 2 | 9 |
| GYEON Warehouse | `warehouse` | 0 | 3 | 4 | 7 |
| GYEON Accounting | `accounting` | 0 | 5 | 2 | 7 |
| GYEON CRM | `crm` | 0 | 3 | 4 | 7 |
| GYEON AI Center | `ai_operations` | 0 | 5 | 3 | 8 |
| **Total** | | **11** | **26** | **15** | **52** |

---

## 9. Next Steps

| Sprint | Focus |
|--------|-------|
| Sprint 11X | GYEON Business Hub admin diagnostic UI (read-only application registry view) |
| Sprint 12+ | Runtime activation gate (feature flag resolution for planned applications) |
| Sprint 12+ | GYEON Distribution implementation begins |
