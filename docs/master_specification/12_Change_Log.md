# 12. Change Log

| Field | Value |
|-------|-------|
| **Document** | 12 — Change Log |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 Initial Edition |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | All `docs/master_specification/` documents (01–11), `09_PHASE_STATUS.md`, `INDEX.md` |

> This document maintains the **complete historical record of specification changes**. It records only approved historical information; it invents no history, redesigns no architecture, and does not duplicate feature specifications. **Change history must never be deleted.**

---

## 12.1 Purpose

To provide complete, traceable history of changes to the canonical specification set — versions, releases, phases, and approved policy/architecture decisions — so the evolution of the Single Source of Truth is auditable over time.

## 12.2 Change Management Philosophy

- **Every specification change requires architect approval.**
- **Every architecture change requires architect approval.**
- **Implementation must always follow the latest approved specification.**
- **Change history must never be deleted** — entries are appended, never removed; superseded content is recorded, not erased.
- Changes follow the lifecycle in `03_Development_Constitution.md` §3.4 and the change-control process in §3.21.

## 12.3 Versioning Policy

- **Major versions** represent **architectural milestones** (e.g., the v2.0 canonical specification baseline).
- **Minor versions** represent **specification refinement** (clarifications/additions that do not change architecture).
- **Patch versions** represent **documentation corrections only** (typos, formatting, non-semantic fixes).
- Each canonical document carries its own version in its metadata; this Change Log records the document set's release history.

## 12.4 Document Version History

| Document | Version | Notes |
|----------|---------|-------|
| `01_PROJECT_OVERVIEW.md` | 2.0 | Rewritten as v2.0; superseded prior v1.0 (preserved in git history). |
| `02_SYSTEM_ARCHITECTURE.md` | 2.0 | Rewritten as v2.0; approved decisions from v1.0 carried forward into the ADR register. |
| `03_Development_Constitution.md` | 2.0 | Authored from skeleton. |
| `04_Database_Architecture.md` | 2.0 | Authored from skeleton; describes the implemented schema only. |
| `05_Business_Rules.md` | 2.0 | Authored from skeleton. |
| `06_User_Roles_and_Permissions.md` | 2.0 | Authored from skeleton. |
| `07_Feature_Specifications.md` | 2.0 | Authored from skeleton. |
| `08_API_Architecture.md` | 2.0 | Authored from skeleton. |
| `09_UI_UX_Specification.md` | 2.0 | Authored from skeleton. |
| `10_Security_and_RLS.md` | 2.0 | Authored from skeleton. |
| `11_Roadmap.md` | 2.0 | Authored from skeleton. |
| `12_Change_Log.md` | 2.0 Initial Edition | This document. |

> Supporting files `INDEX.md` and `README.md` were established alongside this set; pre-existing supporting documents (e.g., `09_PHASE_STATUS.md`) were preserved.

## 12.5 Master Specification Release History

### Version 2.0 — Initial Edition (2026-06-30)

The canonical master specification baseline. **Completed documents:**

- `01_PROJECT_OVERVIEW`
- `02_SYSTEM_ARCHITECTURE`
- `03_DEVELOPMENT_CONSTITUTION`
- `04_DATABASE_ARCHITECTURE`
- `05_BUSINESS_RULES`
- `06_USER_ROLES_AND_PERMISSIONS`
- `07_FEATURE_SPECIFICATIONS`
- `08_API_ARCHITECTURE`
- `09_UI_UX_SPECIFICATION`
- `10_SECURITY_AND_RLS`
- `11_ROADMAP`
- `12_CHANGE_LOG`

Notes: documents 01 and 02 superseded earlier v1.0 content (retained in git history); documents 03–12 were authored from skeletons. `INDEX.md` (document map) and `README.md` (Single Source of Truth + approved workflow) were established with this edition. All documents committed on the feature branch with passing typecheck + build; not merged to main and not deployed to production.

## 12.6 Phase History

| Phase | Status | Reference |
|-------|--------|-----------|
| Phase 1 — Core platform | Completed | `07_Feature_Specifications.md`, `09_PHASE_STATUS.md` |
| Phase 2 — Customer & Vehicle Registration (incl. OCR/AI) | Completed (closed 2026-06-30, architect-approved) | `09_PHASE_STATUS.md`, `11_Roadmap.md` §11.7 |
| Master Specification v2.0 | In Progress → completed with this edition | This document |
| Phase 3 | Planned (not started) | `11_Roadmap.md` §11.8 |

Authoritative live phase/sprint status remains in `09_PHASE_STATUS.md`.

## 12.7 Major Architectural Decisions

- Architectural decisions are recorded as ADRs in `02_SYSTEM_ARCHITECTURE.md` §2.19 (ADR-01 through ADR-12) — e.g., App Router + Server Actions, RLS-based tenant isolation, `dealer_id` only via `getCurrentDealer()`, controlled/additive migrations, Supabase Auth, private storage with signed URLs.
- This Change Log references those decisions; it does not duplicate or redesign them. New/superseding ADRs are added there under architect approval and recorded here as they occur.

## 12.8 Approved Business Rule Changes

- The canonical business rules were documented in `05_Business_Rules.md` v2.0, including the dealer-rank model (`shop`/`detailer`/`certified`), the independent purchase (`all`/`detailer`/`certified`) and installation (`shop`/`detailer`/`certified`) permission axes, Product-Master-driven purchasing, and configurable Japan-specific rules.
- No business-rule change beyond documenting approved rules was made by this edition.

## 12.9 Security Policy Changes

- The security and RLS model was documented in `10_Security_and_RLS.md` v2.0 (mandatory RLS, `dealer_id` via `getCurrentDealer()`, no client service-role, AI/OCR confirmation, storage isolation, production protection, mandatory manual migration review).
- This edition documents the existing approved model; it introduces no security redesign.

## 12.10 API Policy Changes

- API architecture was documented in `08_API_Architecture.md` v2.0 (Server Actions as the primary data API; the limited set of real REST handlers; server-side authorization; production API changes require architect approval).
- No API policy change beyond documentation was made.

## 12.11 Database Policy Changes

- Database architecture/policy was documented in `04_Database_Architecture.md` v2.0 (dealer-scoped tenancy, RLS, manual/additive migrations, soft-delete, storage isolation).
- Historical implemented schema changes are recorded via numbered migrations (e.g., `058` subscriptions, `067` OCR, `068` OCR sessions, `073` detailer fields, `088` dealer soft-delete). This document introduces no schema change.

## 12.12 Roadmap Changes

- The approved roadmap was documented in `11_Roadmap.md` v2.0 using the five status categories (Completed, In Progress, Planned, Deferred, Future).
- No roadmap items were invented or re-prioritized by this edition.

## 12.13 Future Revision Rules

- **Every specification change requires architect approval**; **every architecture change requires architect approval.**
- New entries are **appended** to this Change Log; history is never deleted.
- Version increments follow §12.3 (Major = architectural milestone, Minor = refinement, Patch = documentation correction).
- **Implementation must always follow the latest approved specification**; where code and specification disagree, the specification is authoritative until formally amended.
- Each future revision records: document(s) affected, version change, summary, approval, and date.

## 12.14 References

- `01`–`11` master specification documents (the subject of this log).
- `03_Development_Constitution.md` — change control and lifecycle.
- `09_PHASE_STATUS.md` — authoritative live phase/sprint status.
- `README.md` — Single Source of Truth + workflow. `INDEX.md` — document map.
