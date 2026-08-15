# DealerOS — Master Specification Index

**This directory (`docs/master_specification/`) is the Single Source of Truth (SSOT) for the DealerOS project.**
All requirements, architecture, business rules, and specifications are canonical here. The canonical document set (01–12) is **complete**.

**Last Updated:** 2026-06-30
**Completion:** **100% (12 / 12 documents complete)**

---

## Master Specification v2.0 — Initial Edition

| Field | Value |
|-------|-------|
| **Status** | **Released** |
| **Canonical Documents** | **12 / 12 Complete** |
| **Architecture** | **Frozen** |
| **Current Development Status** | **Ready for Phase 3 Architecture Planning** |

> The canonical specification baseline (v2.0 Initial Edition) is released. Architecture is frozen; changes require architect approval per `03_Development_Constitution.md` and `12_Change_Log.md`. Phase 3 is not started.

---

## Canonical Document Set (01–12)

| # | Document | File | Status | Description |
|---|----------|------|--------|-------------|
| 01 | Project Overview | `01_PROJECT_OVERVIEW.md` | ✅ Complete (v2.0) | Project vision, scope, mission, and high-level summary. |
| 02 | System Architecture | `02_SYSTEM_ARCHITECTURE.md` | ✅ Complete (v2.0) | System design, tech stack, components, and tenant-isolation model. |
| 03 | Development Constitution | `03_Development_Constitution.md` | ✅ Complete (v2.0) | Permanent development rules, principles, and guardrails for all implementation. |
| 04 | Database Architecture | `04_Database_Architecture.md` | ✅ Complete (v2.0) | Canonical schema, tables, relationships, and data-modeling conventions. |
| 05 | Business Rules | `05_Business_Rules.md` | ✅ Complete (v2.0) | Authoritative business logic, workflows, and domain rules. |
| 06 | User Roles and Permissions | `06_User_Roles_and_Permissions.md` | ✅ Complete (v2.0) | Role definitions, permission matrix, and access-control rules. |
| 07 | Feature Specifications | `07_Feature_Specifications.md` | ✅ Complete (v2.0) | Per-feature functional specifications and acceptance criteria. |
| 08 | API Architecture | `08_API_Architecture.md` | ✅ Complete (v2.0) | Server actions, endpoints, contracts, and integration patterns. |
| 09 | UI/UX Specification | `09_UI_UX_Specification.md` | ✅ Complete (v2.0) | Screen flows, component standards, and UI/UX conventions. |
| 10 | Security and RLS | `10_Security_and_RLS.md` | ✅ Complete (v2.0) | Security model, tenant isolation, and Row Level Security policies. |
| 11 | Roadmap | `11_Roadmap.md` | ✅ Complete (v2.0) | Phased delivery plan and milestone tracking. |
| 12 | Change Log | `12_Change_Log.md` | ✅ Complete (v2.0 Initial Edition) | Chronological record of approved specification changes. |

> Note: Documents 01 and 02 retain their established filenames (their v2.0 content supersedes prior v1.0, preserved in git history); documents 03–12 were authored from skeletons to v2.0. All twelve are now complete and canonical.

---

## Existing Supporting Documents (preserved)

These pre-existing documents remain canonical and continue to be used. The list below highlights key references; additional `*_SPEC.md`, `*_REQUIREMENTS.md`, and `*_WORKFLOW.md` documents in this directory also remain valid.

| Document | File | Description |
|----------|------|-------------|
| Master Specification Index (legacy) | `00_MASTER_SPECIFICATION_INDEX.md` | Original index of the master specification set. |
| Business Workflow | `03_BUSINESS_WORKFLOW.md` | Detailed business workflow specification. |
| Settings Workflow | `04_SETTINGS_WORKFLOW.md` | Settings flow specification. |
| Database Requirements | `05_DATABASE_REQUIREMENTS.md` | Database requirements detail. |
| OCR Requirements | `06_OCR_REQUIREMENTS.md` | OCR/AI requirements detail. |
| LINE Requirements | `07_LINE_REQUIREMENTS.md` | LINE integration requirements. |
| UI Requirements | `08_UI_REQUIREMENTS.md` | UI requirements detail. |
| Development Rules | `08_DEVELOPMENT_RULES.md` | Established development rules. |
| Phase Status | `09_PHASE_STATUS.md` | Living phase/sprint status (includes Phase 2 closure record). |
| Roadmap (legacy) | `10_ROADMAP.md` | Existing roadmap document. |
| Canonical Rules | `11_CANONICAL_RULES.md` | Canonical project rules. |

---

## Single Source of Truth

`docs/master_specification/` is the authoritative project specification. Any implementation, architecture decision, or change must be reconciled against the documents in this directory. See `README.md` for the mandatory workflow and rules.
