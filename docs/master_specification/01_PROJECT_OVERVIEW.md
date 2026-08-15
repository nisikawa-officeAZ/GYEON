# GYEON Detailer Agent Enterprise Master Specification

| Field | Value |
|-------|-------|
| **Document** | 01 — Project Overview |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `09_PHASE_STATUS.md`, `10_ROADMAP.md` / `11_Roadmap.md`, `INDEX.md` |

> This document is the official **Project Overview** for the platform. It defines *what* the product is and *why* it exists. Architecture, deployment, and technology details are defined in `02_SYSTEM_ARCHITECTURE.md` and are **not duplicated here** — this document references them where relevant. All implementation must follow this specification under the workflow defined in `README.md`; implementation conforms to the specification, never the reverse.

---

## 1. Project Overview

### 1.1 Vision

To be the AI-powered business operating system for professional automotive detailing — a platform that does not end at the completed job, but carries the customer relationship forward into repeat business and measurable growth. The long-term vision extends the core operations platform into AI-driven marketing, reputation, retention, and growth capabilities (see §1.12 and `10_ROADMAP.md`).

### 1.2 Mission

Enable detailing businesses to convert an on-site service consultation into a structured, priced, shareable record, and to manage the full downstream lifecycle — customer, vehicle, estimate, work order, completion report, invoice, payment, and maintenance follow-up — within a single multi-tenant SaaS platform, with strict per-tenant (dealer) data isolation.

### 1.3 Project Goals

1. Provide a complete operational workflow for detailing shops: estimate → work order → completion report → invoice → payment → maintenance reminder → repeat visit.
2. Reduce manual data entry through AI assistance (e.g., vehicle-registration OCR that auto-populates customer and vehicle records, subject to mandatory human confirmation).
3. Guarantee tenant isolation: every record is owned by exactly one dealer and is never visible or modifiable across dealers.
4. Remain specification-driven and incrementally verifiable, with each change reviewed, type-checked, and built before commit (see `README.md`).
5. Support a path from a GYEON-branded edition to a brand-neutral generic edition (see §1.5) without architectural divergence.

### 1.4 Target Users

- **Detailing shop staff / operators** — create and manage estimates, customers, vehicles, work orders, invoices, and payments for their own shop (dealer).
- **Shop owners / managers** — oversee operations, staff, and subscription/billing for their dealer.
- **Platform / Super Admin** — operate the multi-tenant platform: dealer approval, lifecycle management, and platform-wide administration (distinct from per-dealer users).
- **End customers (indirect)** — interact through customer-facing surfaces (e.g., LINE integration and customer-facing views) but are not platform operators.

Role and permission definitions are specified in `06_User_Roles_and_Permissions.md`.

### 1.5 Product Editions

The platform is delivered in two editions that share one codebase, data model, and architecture. Editions differ in branding, terminology, and catalog content — **not** in core architecture or tenant-isolation model.

#### GYEON Detailer Agent
The GYEON-branded edition for shops operating within the GYEON ceramic-coating ecosystem. It includes GYEON-specific branding, product/service catalog semantics, and coating-related terminology and warranty concepts. This is the primary edition and the reference implementation.

#### Detailer Agent (Generic Edition)
A brand-neutral edition for detailing businesses not tied to the GYEON brand. It provides the same operational platform with neutral branding and a generic catalog/terminology, enabling white-label or non-GYEON deployments. Edition selection affects presentation and catalog content only; the underlying business rules, data isolation, and architecture remain identical.

### 1.6 Core Principles

1. **Specification-Driven Development (SDD).** The canonical specification is the highest authority; implementation conforms to it, never the reverse.
2. **Tenant isolation first.** `dealer_id` is always resolved server-side from the authenticated user's dealer membership and is never accepted from client input. All data access is dealer-scoped, with Row-Level Security as defense-in-depth (see `10_Security_and_RLS.md`).
3. **No silent data loss.** Customer and vehicle data is never overwritten automatically; soft-deletion is preferred over destructive deletion.
4. **AI assists, humans decide.** AI/OCR output must always be reviewable and editable, and requires explicit user confirmation before any record is created or updated.
5. **Incremental, verified change.** Work proceeds one feature at a time and is verified (review → typecheck → build) before commit and push, per `README.md`.
6. **Preserve existing behavior.** Approved business logic and existing canonical documents are preserved; changes are additive and reconciled against the specification.

### 1.7 Business Scope

In scope for the platform:

- Customer management (profiles, search, status/tagging foundations, notes, activity timeline).
- Vehicle management (profiles, search, status foundations, service-history foundation, customer↔vehicle linkage).
- Vehicle-registration OCR / AI-assisted registration with duplicate detection and a register/update decision flow.
- Estimate creation across the platform's service categories (e.g., Coating/GYEON, PPF, Window Film, Maintenance, Car Wash, Room Cleaning, Other Work).
- Downstream operations: work orders, completion reports, invoices, payments, and maintenance reminders.
- Product catalog and product orders.
- LINE integration (customer messaging / LIFF surfaces).
- Multi-tenant administration: dealer onboarding, approval, subscription/licensing, and audit logging.

Out of scope (deferred / future): AI marketing, reputation, and growth modules (see §1.12). Detailed per-feature behavior is specified in `07_Feature_Specifications.md` and related documents.

### 1.8 Supported Platforms

- **Web (PWA):** mobile-first responsive web application, installable as a Progressive Web App, with a desktop (PC) presentation in addition to mobile.
- **Mobile devices:** camera-first capture for vehicle-registration OCR on mobile.
- **Desktop:** file-upload-first workflow for OCR and full operational use.
- **Messaging surface:** LINE (LIFF / Messaging API) for customer-facing interactions.

Runtime, hosting, and platform technology are defined in `02_SYSTEM_ARCHITECTURE.md`.

### 1.9 High-Level System Components

At a conceptual level the platform comprises:

- **Operations core** — customers, vehicles, estimates, work orders, completion reports, invoices, payments, maintenance.
- **AI / OCR subsystem** — vehicle-registration analysis, field mapping, duplicate detection, and OCR session/audit history.
- **Catalog & orders** — products/services and product orders.
- **Messaging integration** — LINE customer messaging.
- **Multi-tenant administration** — dealer lifecycle, subscriptions/licensing, roles/permissions, and audit logging.
- **Tenant-isolation layer** — server-side dealer resolution plus Row-Level Security.

Concrete component design, technology choices, data flow, and deployment topology are defined in `02_SYSTEM_ARCHITECTURE.md` and are intentionally not restated here.

### 1.10 Current Development Status

- The core operations platform is implemented and has reached an official release baseline (declared release 1.0.0 / RC1; see `09_PHASE_STATUS.md` for the authoritative phase record).
- **Phase 2 — Customer & Vehicle Registration (including OCR/AI)** has been completed and **CLOSED (architect-approved, 2026-06-30)** across six sprints, with integration QA and stabilization performed.
- Work is conducted on a feature branch; it is not merged to main and not deployed to production as part of these specification activities.
- **Phase 3 has not started.**

`09_PHASE_STATUS.md` is the living source of truth for phase/sprint status.

### 1.11 Completed Phases

Summarized at a high level (authoritative detail in `09_PHASE_STATUS.md`):

- **Core platform (through release baseline):** authentication, customer management, vehicle management, estimates, GYEON service estimates, PDF generation, document storage, work orders, completion reports, invoices, payments, reservations, maintenance reminders, products and product orders, LINE integration, admin console, subscriptions/licensing, audit logging, and release/disaster-recovery readiness.
- **Phase 2 — Customer & Vehicle Registration:**
  - Sprint 1 — Registration foundation (OCR → customer + vehicle orchestration; duplicate-detection helpers).
  - Sprint 2 — Customer Management foundation (list, detail, search, filters, profile editing, notes, derived status/tags, timeline).
  - Sprint 3 — Vehicle Management foundation (list, detail, search, filters, profile editing, derived 車検 status/tags, service-history foundation, customer↔vehicle verification).
  - Sprint 4 — OCR & AI enhancement (camera/file selection, mobile camera-first, review improvements, field-mapping and confidence/missing-field handling).
  - Sprint 5 — OCR session & audit foundation (history viewer, status management, audit trail, existing-record selection, register/update decision flow).
  - Sprint 6 — Integration QA & stabilization (flows verified; three integration bugs fixed). **Phase 2 CLOSED.**

### 1.12 Future Roadmap Summary

High-level direction only; the authoritative roadmap is `10_ROADMAP.md` / `11_Roadmap.md`:

- **Phase 3 and beyond:** scope to be defined and approved by the architect before implementation begins.
- **Pro+ AI Platform (deferred future modules):** provider-agnostic AI Gateway (dealer-owned keys), AI Marketing Agent, AI Reputation Agent, AI Growth Agent, and LINE Rich-Menu management. These are approved future features deferred until the core platform is stable in production.
- **Editions:** continued support for the GYEON and Generic editions from a single codebase (see §1.5).

> No AI-learning functionality is implied or authorized by this overview. Future modules are subject to separate specification and architect approval under the workflow in `README.md`.
