# DealerOS — Master Specification Index

**This directory (`docs/master_specification/`) is the Single Source of Truth (SSOT) for the DealerOS project.**
All requirements, architecture, business rules, and specifications are canonical here. Existing documents are preserved as-is; newly added documents complete the canonical structure.

**Last Updated:** 2026-06-30

---

## Canonical Document Set (01–12)

| # | Document | File | Status | Description |
|---|----------|------|--------|-------------|
| 01 | Project Overview | `01_PROJECT_OVERVIEW.md` | Existing (preserved) | Project vision, scope, mission, and high-level summary. |
| 02 | System Architecture | `02_SYSTEM_ARCHITECTURE.md` | Existing (preserved) | System design, tech stack, components, and tenant-isolation model. |
| 03 | Development Constitution | `03_Development_Constitution.md` | New (skeleton) | Permanent development rules, principles, and guardrails for all implementation. |
| 04 | Database Architecture | `04_Database_Architecture.md` | New (skeleton) | Canonical schema, tables, relationships, and data-modeling conventions. |
| 05 | Business Rules | `05_Business_Rules.md` | New (skeleton) | Authoritative business logic, workflows, and domain rules. |
| 06 | User Roles and Permissions | `06_User_Roles_and_Permissions.md` | New (skeleton) | Role definitions, permission matrix, and access-control rules. |
| 07 | Feature Specifications | `07_Feature_Specifications.md` | New (skeleton) | Per-feature functional specifications and acceptance criteria. |
| 08 | API Architecture | `08_API_Architecture.md` | New (skeleton) | Server actions, endpoints, contracts, and integration patterns. |
| 09 | UI/UX Specification | `09_UI_UX_Specification.md` | New (skeleton) | Screen flows, component standards, and UI/UX conventions. |
| 10 | Security and RLS | `10_Security_and_RLS.md` | New (skeleton) | Security model, tenant isolation, and Row Level Security policies. |
| 11 | Roadmap | `11_Roadmap.md` | New (skeleton) | Phased delivery plan and milestone tracking. |
| 12 | Change Log | `12_Change_Log.md` | New (skeleton) | Chronological record of approved specification changes. |

> Note: Documents 01 and 02 already existed with content and are preserved under their established filenames; documents 03–12 were newly created as skeletons awaiting specification content. Detailed specification content for the skeletons will be authored under the approved workflow (see `README.md`).

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
