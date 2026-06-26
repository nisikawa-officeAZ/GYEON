# PACKAGE STRUCTURE
## GYEON Detailer Agent — Canonical Package v1.0

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Specification Freeze Candidate |
| **Last Updated** | 2026-06-25 |
| **Related** | `00_MASTER_SPECIFICATION_INDEX.md`, `CANONICAL_PACKAGE.md` |

---

## 1. Complete File Inventory

### 1a. Core Specification (Active — use these)

| File | Size | Role | Status | Phase |
|------|------|------|--------|-------|
| `00_MASTER_SPECIFICATION_INDEX.md` | Index | Entry point, reading order, folder map | ✅ Current | PHASE76 |
| `01_PROJECT_OVERVIEW.md` | Overview | Product identity, stack, SDD philosophy | ✅ Canonical | SDD Restructuring |
| `02_SYSTEM_ARCHITECTURE.md` | Architecture | System design, security, subscriptions, APIs | ✅ Canonical | SDD Restructuring |
| `03_BUSINESS_WORKFLOW.md` | Workflow | Estimate flow — from `gyeon_flow.json` | ⚠️ OD-pending | SDD Restructuring |
| `04_SETTINGS_WORKFLOW.md` | Workflow | Settings & auth — from `gyeon_settings_flow.json` | ✅ Canonical | SDD Restructuring |
| `05_DATABASE_REQUIREMENTS.md` | Database | Data model, migrations, JSONB schemas | ✅ Canonical | SDD Restructuring |
| `06_OCR_REQUIREMENTS.md` | Integration | Vehicle registration OCR | ✅ Canonical | SDD Restructuring |
| `07_LINE_REQUIREMENTS.md` | Integration | LINE / LIFF / messaging | ✅ Canonical | SDD Restructuring |
| `08_UI_REQUIREMENTS.md` | UI | Screen requirements, device strategy | ✅ Canonical | SDD Restructuring |
| `09_PHASE_STATUS.md` | Status | Implementation status (living document) | ✅ Current | SDD Restructuring |
| `10_ROADMAP.md` | Roadmap | What's next (living document) | ✅ Current | SDD Restructuring |
| `11_CANONICAL_RULES.md` | Rules | All binding rules for all work | ✅ Canonical | SDD Restructuring |

### 1b. Audit & Finalization Documents

| File | Role | Status | Phase |
|------|------|--------|-------|
| `MASTER_SPECIFICATION_AUDIT_REPORT.md` | Full audit report — 60 findings | ✅ Complete | PHASE74 |
| `MASTER_SPECIFICATION_CHANGELOG.md` | Per-item resolution log | ✅ Complete | PHASE75 |
| `OPERATOR_DECISIONS.md` | 17 business decision forms | ⏳ Awaiting decisions | PHASE75 |
| `MASTER_SPECIFICATION_V1_READY.md` | Freeze certification | ✅ Complete (Conditional Pass) | PHASE75 |

### 1c. Package Organization Documents (this phase)

| File | Role | Status | Phase |
|------|------|--------|-------|
| `00_MASTER_SPECIFICATION_INDEX.md` | Master index | ✅ Created | PHASE76 |
| `VERSION.md` | Version and approval record | ✅ Created | PHASE76 |
| `CANONICAL_PACKAGE.md` | Consumption guide | ✅ Created | PHASE76 |
| `PACKAGE_STRUCTURE.md` | This document — structure guide | ✅ Created | PHASE76 |
| `CANONICAL_PACKAGE_REPORT.md` | Completion report | ✅ Created | PHASE76 |

### 1d. Superseded Files (do not use)

These files were created before the SDD restructuring and have been superseded by the numbered files above. They are retained for reference only and should be deleted in Phase C.

| File | Superseded by |
|------|--------------|
| `02_BUSINESS_WORKFLOW.md` | `03_BUSINESS_WORKFLOW.md` |
| `03_SETTINGS_WORKFLOW.md` | `04_SETTINGS_WORKFLOW.md` |
| `04_DATABASE_REQUIREMENTS.md` | `05_DATABASE_REQUIREMENTS.md` |
| `05_OCR_REQUIREMENTS.md` | `06_OCR_REQUIREMENTS.md` |
| `06_LINE_REQUIREMENTS.md` | `07_LINE_REQUIREMENTS.md` |
| `07_UI_REQUIREMENTS.md` | `08_UI_REQUIREMENTS.md` |
| `08_DEVELOPMENT_RULES.md` | `11_CANONICAL_RULES.md` |

---

## 2. Document Metadata Summary

| Document | Version | Canonical Source | Type |
|----------|---------|-----------------|------|
| 00_MASTER_SPECIFICATION_INDEX | 1.0 | All spec documents | Index |
| 01_PROJECT_OVERVIEW | 1.0 | gyeon_flow.json + gyeon_settings_flow.json + implementation | Overview |
| 02_SYSTEM_ARCHITECTURE | 1.0 | OFFICIAL_RELEASE_NOTES.md + implementation audit | Architecture |
| 03_BUSINESS_WORKFLOW | 1.0 | gyeon_flow.json | Workflow |
| 04_SETTINGS_WORKFLOW | 1.0 | gyeon_settings_flow.json | Workflow |
| 05_DATABASE_REQUIREMENTS | 1.0 | gyeon_flow.json + gyeon_settings_flow.json + migrations | Database |
| 06_OCR_REQUIREMENTS | 1.0 | Implementation (PHASE67) + migration 067 | Integration |
| 07_LINE_REQUIREMENTS | 1.0 | gyeon_settings_flow.json + implementation | Integration |
| 08_UI_REQUIREMENTS | 1.0 | gyeon_flow.json + gyeon_settings_flow.json | UI |
| 09_PHASE_STATUS | 1.0 | git history + CHANGELOG.md | Status (living) |
| 10_ROADMAP | 1.0 | ROADMAP_V2.md + ROADMAP_AFTER_v1.md + audit | Roadmap (living) |
| 11_CANONICAL_RULES | 1.0 | gyeon_flow.json + gyeon_settings_flow.json + dealer_settings_final_schema.md | Rules |

---

## 3. File Relationships

### Core specification flow

```
gyeon_flow.json
    │
    ├──► 03_BUSINESS_WORKFLOW.md   (estimate screens, pricing, transitions)
    └──► 08_UI_REQUIREMENTS.md     (screen requirements)

gyeon_settings_flow.json
    │
    ├──► 04_SETTINGS_WORKFLOW.md   (settings, auth, persistence)
    └──► 07_LINE_REQUIREMENTS.md   (LINE settings)

implementation + migrations
    │
    ├──► 02_SYSTEM_ARCHITECTURE.md (system design)
    ├──► 05_DATABASE_REQUIREMENTS.md (DB schema)
    ├──► 06_OCR_REQUIREMENTS.md   (OCR implementation)
    └──► 09_PHASE_STATUS.md        (phase history)

All of the above
    │
    ├──► 11_CANONICAL_RULES.md     (rules derived from all sources)
    └──► 01_PROJECT_OVERVIEW.md    (summary of all)
```

### Process flow

```
OPERATOR_DECISIONS.md
    │
    └──► blocks ──► 03_BUSINESS_WORKFLOW.md (pricing sections)
                    05_DATABASE_REQUIREMENTS.md (migration 070 status)
                    07_LINE_REQUIREMENTS.md (dual-path decision)
                    10_ROADMAP.md (Phase B, C sequencing)
```

### Living documents (updated each phase)

```
09_PHASE_STATUS.md    ─── updated when phases complete
10_ROADMAP.md         ─── updated when ODs resolved or phases change
OPERATOR_DECISIONS.md ─── updated when operator fills in decisions
```

---

## 4. Content Map — What Lives Where

| Topic | Document | Section |
|-------|----------|---------|
| Project tagline, purpose | 01 | §1 |
| Technology stack | 01 | §3 |
| SDD philosophy | 01 | §6 |
| System architecture diagram | 02 | §1 |
| Supabase architecture | 02 | §4 |
| Security architecture | 02 | §6 |
| Subscription plans | 02 | §8 |
| Estimate screen list (13 screens) | 03 | §2 |
| Flow transitions (nextScreen logic) | 03 | §3 |
| Category pricing (coating, PPF, window, etc.) | 03 | §4 |
| currentEstimate data structure | 03 | §5 |
| Auth flow | 04 | §1 |
| Plan system | 04 | §2 |
| App init sequence | 04 | §3 |
| Settings groups (g1–g7) | 04 | §4 |
| Drawer details | 04 | §5 |
| 37 canonical settings keys | 04 | §7 |
| Extension JSONB columns | 04 | §8a |
| Canonical entity stores | 05 | §1 |
| dealer_settings column listing (all ~61) | 05 | §4 |
| Migration 070 status | 05 | §5 |
| Reminder fallback rule | 05 | §4.1 / 11 §7.7 |
| OCR components | 06 | §2 |
| vehicle_registration_files schema | 06 | §2a |
| OCR dealer_settings columns | 06 | §5 |
| LINE components | 07 | §2 |
| LINE dealer_settings columns (all) | 07 | §5 |
| LINE security rules | 07 | §4 |
| PC vs mobile device strategy | 08 | §2 |
| 13-screen implementation status | 08 | §3a |
| Design language | 08 | §4 |
| Completed phases | 09 | §1 |
| Implementation pending | 09 | §3a |
| Awaiting external action | 09 | §3b |
| Feature completion table | 09 | §4 |
| Phase A–E roadmap | 10 | All sections |
| SDD specification authority rules | 11 | §1 |
| Multi-tenant security rules | 11 | §2 |
| Migration rules | 11 | §3 |
| Incremental delivery rules | 11 | §4 |
| Design workflow rules | 11 | §5 |
| Persistence reconciliation | 11 | §6 |
| dealer_settings rules | 11 | §7 |
| Estimate flow rules | 11 | §8 |
| Audit / process constraints | 11 | §9 |
| Scope control rules | 11 | §10 |
| All 17 operator decisions | OPERATOR_DECISIONS | §1–10 |
| Freeze certification | MASTER_SPECIFICATION_V1_READY | All |
| Audit findings (60 items) | MASTER_SPECIFICATION_AUDIT_REPORT | All |
| Changelog (resolution tracking) | MASTER_SPECIFICATION_CHANGELOG | All |

---

## 5. External File Dependencies

These files are **outside** the `docs/master_specification/` folder but are referenced by spec documents.

| File | Location | Used by | Status |
|------|----------|---------|--------|
| `gyeon_flow.json` | `~/Desktop/_gyeon_review/export_staging/CANONICAL_DOCS/` | 03, 04, 05, 11 | ⚠️ Not in repo — Phase C task |
| `gyeon_settings_flow.json` | `~/Desktop/_gyeon_review/export_staging/CANONICAL_DOCS/` | 04, 07, 11 | ⚠️ Not in repo — Phase C task |
| `dealer_settings_final_schema.md` | `~/Desktop/_gyeon_review/export_staging/CANONICAL_DOCS/` | 05, 07, 11 | ⚠️ Not in repo |
| `OFFICIAL_RELEASE_NOTES.md` | `~/Desktop/_gyeon_review/export_staging/CANONICAL_DOCS/` | 02, 09 | ⚠️ Not in repo |
| `070_dealer_settings_canonical.sql` | `~/DealerOS/supabase/migrations/` | 05, 06, 07, 11 | ✅ In repo |
| `067_vehicle_registration_ocr.sql` | `~/DealerOS/supabase/migrations/` | 06 | ✅ In repo |
| `EstimateWizard.tsx` | `~/DealerOS/src/components/estimates/` | 03, 08 | ✅ In repo |
| `dealer-settings-types.ts` | `~/DealerOS/src/lib/dealer-settings/` | 05 | ✅ In repo |
| `dealer-settings-defaults.ts` | `~/DealerOS/src/lib/dealer-settings/` | 03, 04, 05 | ✅ In repo (⚠️ has OD-pending values) |

---

*GYEON Detailer Agent | Canonical Package v1.0 | Office AZ | 2026-06-25*
