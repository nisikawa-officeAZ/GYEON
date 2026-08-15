# 11. Product Roadmap

| Field | Value |
|-------|-------|
| **Document** | 11 — Product Roadmap |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `07_Feature_Specifications.md`, `09_PHASE_STATUS.md`, `03_Development_Constitution.md` |

> This document records **only approved roadmap items**. It invents no items, redesigns no architecture, and does not modify implementation priorities or duplicate feature specifications (`07_Feature_Specifications.md`). Authoritative live status is in `09_PHASE_STATUS.md`.

**Status categories (only these are used):** **Completed** · **In Progress** · **Planned** · **Deferred** · **Future**.

---

## 11.1 Purpose

To present the approved product roadmap — what is done, what is in progress, what is planned next, and what is deferred or future — as a single authoritative reference, without changing priorities or inventing scope.

## 11.2 Product Vision

Per `01_PROJECT_OVERVIEW.md`: an AI-powered business operating system for professional detailing that carries the customer relationship forward into repeat business and, longer term, AI-driven growth. The roadmap sequences delivery toward that vision under the development constitution.

## 11.3 Roadmap Philosophy

- Items are tracked using only the five status categories above.
- Only approved items appear here; new items require architect approval and an updated specification (`03_Development_Constitution.md`).
- Roadmap reflects approved sequence; it does not alter implementation priorities.

## 11.4 Completed Milestones

| Item | Status |
|------|--------|
| **Phase 1** — Core platform | **Completed** |
| **Phase 2** — Customer & Vehicle Registration (incl. OCR/AI) | **Completed** (closed 2026-06-30) |

## 11.5 Current Project Status

| Item | Status |
|------|--------|
| **Master Specification v2.0** | **In Progress** |
| Phase 3 | Planned (not started) |

The platform is on a feature branch; not merged to main and not deployed to production as part of specification work.

## 11.6 Phase 1 Summary

- **Status: Completed.**
- The core operations platform (authentication, customers, vehicles, estimates, GYEON service, PDF, work orders, completion reports, invoices, payments, reservations, maintenance, products & orders, LINE, admin, subscriptions, audit) reaching the release baseline. Detail in `07_Feature_Specifications.md` and `09_PHASE_STATUS.md`.

## 11.7 Phase 2 Summary

- **Status: Completed (closed 2026-06-30).**
- Customer & Vehicle Registration with OCR/AI across six sprints: registration foundation, customer foundation, vehicle foundation, OCR/AI enhancement, OCR session & audit, and integration QA/stabilization. Detail in `07_Feature_Specifications.md` and `09_PHASE_STATUS.md`.

## 11.8 Phase 3 Roadmap

- **Status: Planned.**
- Approved Phase 3 scope items (Planned):
  - **Estimate Workflow**
  - **Work Orders**
  - **PDF**
  - **Price Engine**
- These build on existing implemented modules (see `07_Feature_Specifications.md`); their Planned status here denotes the next-phase roadmap scope (e.g., completing estimate category-specific steps and pricing). Concrete scope is confirmed by the architect before implementation; this document introduces no new items.

## 11.9 Phase 4 Roadmap

- **Status: Planned.**
- Scope to be defined and approved by the architect. Deferred items (§11.22) may be scheduled into Phase 4 upon approval. No specific items are invented here.

## 11.10 Phase 5 Roadmap

- **Status: Future.**
- Scope to be defined and approved by the architect; reserved for later product expansion. No specific items are invented here.

## 11.11 Future Product Expansion

- **Status: Future.**
- Approved future product directions are tracked in the dedicated roadmaps below (§11.12–§11.21) and the Deferred/Future lists (§11.22). Nothing here is scheduled until approved.

## 11.12 Generic Edition Roadmap

- **Status: Deferred / Future.**
- Brand-neutral edition direction (`01_PROJECT_OVERVIEW.md` §1.5). Includes **Inventory Management (Generic Edition only)** — Deferred (§11.17) — and broader **Generic SaaS Expansion** — Future (§11.21).

## 11.13 GYEON Edition Roadmap

- **Status: In Progress / Planned (primary edition).**
- The GYEON-branded edition is the reference implementation and the focus of current/Planned phase work (Phase 3, §11.8). Ongoing delivery follows the approved phase sequence.

## 11.14 White Label Roadmap

- **Status: Deferred.**
- White-label delivery for non-GYEON deployments; not in active scope. Requires a future approved specification.

## 11.15 Customer Mobile App Roadmap

- **Status: Deferred.**
- A dedicated customer-facing mobile application; not in active scope.

## 11.16 AI Roadmap

- **Status: Deferred (Advanced AI Modules) / Future.**
- **Deferred:** Advanced AI Modules.
- **Future:** **Marketing AI**, **SEO Automation**, **Review AI**.
- Aligns with the Pro+ AI Platform direction (`01_PROJECT_OVERVIEW.md` §1.12). No AI-learning functionality is in scope; each module requires its own approved specification.

## 11.17 Inventory Management Roadmap

- **Status: Deferred (Generic Edition only).**
- Not in approved active scope. Some database scaffolding exists (`04_Database_Architecture.md` §4.9), but the feature is Deferred and Generic-edition-only; it requires a future approved specification.

## 11.18 Android Handheld Support Roadmap

- **Status: Deferred.**
- Handheld-optimized (PWA) workflows; not in active scope.

## 11.19 iPad + HID Scanner Roadmap

- **Status: Deferred.**
- iPad workflow with HID barcode scanner support (relevant to inventory stocktaking, Generic edition); not in active scope.

## 11.20 EC Integration Roadmap

- **Status: Deferred.**
- E-commerce integrations; not in active scope.

## 11.21 Future Infrastructure Roadmap

- **Status: Future.**
- **Generic SaaS Expansion** and supporting infrastructure for multi-edition scale; reserved for future approved specification.
- **Communication Center** — Deferred (§11.22) — is tracked as a future platform capability pending approval.

## 11.22 Deferred Features

The following are **Deferred** (approved direction; not in active scope; require a future approved specification):

- Inventory Management (Generic Edition only)
- Android Handheld Support
- iPad + HID Barcode Scanner Support
- White Label
- Customer Mobile App
- EC Integrations
- Communication Center
- Advanced AI Modules

**Future** items (longer-horizon, approval required): Marketing AI · SEO Automation · Review AI · Generic SaaS Expansion.

## 11.23 Release Strategy

- Work proceeds on a feature branch through the approved lifecycle (`03_Development_Constitution.md` §3.4); verified (typecheck + build) before commit/push.
- Schema changes are staging-first; **production deployment requires explicit approval** (`02_SYSTEM_ARCHITECTURE.md` §2.14, `10_Security_and_RLS.md` §10.21).
- Releases are cut from approved, reviewed, merged work; not from in-progress branches.

## 11.24 References

- `01_PROJECT_OVERVIEW.md` — vision, editions, future direction.
- `07_Feature_Specifications.md` — feature scope/status (not duplicated here).
- `09_PHASE_STATUS.md` — authoritative live phase/sprint status.
- `03_Development_Constitution.md` — lifecycle, change control, release policy.
- `README.md` — Single Source of Truth + workflow. `INDEX.md` — document map.
