# GYEON Business Hub — Branding Specification

**Version**: 1.0.0  
**Status**: Active — Effective immediately  
**Sprint**: Post-Sprint 11W  
**Last Updated**: 2026-06-26

---

## 1. Platform Name

| Context | Name |
|---------|------|
| **User-facing (canonical)** | **GYEON Business Hub** |
| Internal architecture / technical modules | AZ Platform (legacy; acceptable in existing committed code) |
| Documentation going forward | GYEON Business Hub |

All new documentation, roadmap items, and external-facing materials must use **GYEON Business Hub** as the platform name.

Existing committed source code comments and previously committed documentation that reference "AZ Platform" do not require retroactive updates. New code comments and documentation must use GYEON Business Hub.

---

## 2. Application Name Mapping

| Internal ID | Technical Name (internal) | **User-Facing Name (canonical)** |
|-------------|--------------------------|----------------------------------|
| `dealer_agent` | GYEON Dealer Agent | **GYEON Dealer Agent** |
| `enterprise_distribution` | Enterprise Distribution Platform | **GYEON Distribution** |
| `warehouse` | Warehouse Management System | **GYEON Warehouse** |
| `accounting` | Accounting System | **GYEON Accounting** |
| `crm` | Customer Relationship Management | **GYEON CRM** |
| `ai_operations` | AI Operations Platform | **GYEON AI Center** |

---

## 3. Usage Rules

### 3.1 In new documentation

Use the canonical user-facing names everywhere:

- Platform: **GYEON Business Hub**
- Applications: **GYEON Dealer Agent**, **GYEON Distribution**, **GYEON Warehouse**, **GYEON Accounting**, **GYEON CRM**, **GYEON AI Center**

### 3.2 In source code

Internal module IDs, TypeScript type values, and source path names are **not required to change**:

```typescript
// These stay as-is — internal architecture identifiers
type BusinessApplicationId =
  | "dealer_agent"
  | "enterprise_distribution"   // internal ID; display name = GYEON Distribution
  | "warehouse"
  | "accounting"
  | "crm"
  | "ai_operations";            // internal ID; display name = GYEON AI Center
```

`display_name` fields in existing TypeScript registries do not require retroactive updates.  
**New** TypeScript `display_name` fields should use the canonical names.

### 3.3 In existing committed documents

Files committed before this branding spec do not require renaming or retroactive edits.  
References like "Enterprise Distribution Platform", "AZ Platform", "AI Operations Platform" in older committed files remain valid as-is.

### 3.4 In roadmaps and future sprints

All future sprint descriptions, roadmap entries, and release notes must use the canonical names.

---

## 4. Branding Rationale

The **GYEON Business Hub** name:

- Anchors the platform brand to the GYEON product family that all current applications serve
- Distinguishes the B2B operations platform from the dealer-facing GYEON Dealer Agent product
- Provides a coherent product family naming convention (GYEON + function)
- Scales cleanly as additional applications join the platform

**GYEON Distribution** replaces "Enterprise Distribution Platform" because:
- It is shorter and more memorable for external partners (wholesalers, retailers)
- It maintains consistency with the GYEON product family prefix
- "Enterprise Distribution Platform" remains valid as the technical/architectural descriptor

---

## 5. Application Descriptions (Canonical)

### GYEON Business Hub
Cloud-based multi-application business platform for the GYEON Japan ecosystem. Shared services include authentication, AI Gateway, PDF generation, notifications, organization management, and analytics.

### GYEON Dealer Agent
Cloud-based business management platform for GYEON-certified automotive detailing shops. Handles estimates, work orders, invoices, LINE messaging, AI marketing, and maintenance reminders.

### GYEON Distribution
B2B wholesale distribution management for Attraction Co., Ltd. Digitizes the GYEON Japan supply chain from importer to wholesalers and retail stores.

### GYEON Warehouse
Physical inventory and fulfillment management for Office AZ Group warehouse operations. Tracks inbound receipts, pick-and-pack, outbound shipments, and inventory locations.

### GYEON Accounting
Financial management for Office AZ Group. Invoices, accounts receivable, closing day processing, payment tracking, and financial reporting for distribution operations.

### GYEON CRM
B2B customer relationship management for Office AZ Group. Unified wholesaler and retailer account view, sales follow-up automation, inactivity alerts, and opportunity tracking.

### GYEON AI Center
Platform-level AI operations management. Monitors AI request execution, usage, and costs across all GYEON Business Hub applications. Manages the AI Marketplace and provider health.

---

## 6. File Naming Convention for New Documentation

New specification and documentation files should follow this naming convention:

| Document type | Convention | Example |
|--------------|-----------|---------|
| Application spec | `GYEON_<APP>_SPEC.md` | `GYEON_DISTRIBUTION_SPEC.md` |
| Platform-level spec | `GYEON_BUSINESS_HUB_<TOPIC>.md` | `GYEON_BUSINESS_HUB_ARCHITECTURE.md` |
| Sprint reports | `IMPLEMENTATION_SPRINT<N>_REPORT.md` | (unchanged) |

Existing files named with old conventions (`ENTERPRISE_DISTRIBUTION_PLATFORM_SPEC.md`, etc.) are not renamed.

---

## 7. Cross-Reference

| Old Name | New Canonical Name | Internal ID / Module |
|----------|--------------------|---------------------|
| AZ Platform | GYEON Business Hub | — |
| Enterprise Distribution Platform | GYEON Distribution | `enterprise_distribution` |
| Warehouse Management System | GYEON Warehouse | `warehouse` |
| Accounting System | GYEON Accounting | `accounting` |
| Customer Relationship Management | GYEON CRM | `crm` |
| AI Operations Platform | GYEON AI Center | `ai_operations` |
