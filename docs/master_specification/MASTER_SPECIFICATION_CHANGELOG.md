# MASTER SPECIFICATION CHANGELOG
## GYEON Detailer Agent — PHASE75 Finalization

**Compiled:** 2026-06-25  
**Source:** `MASTER_SPECIFICATION_AUDIT_REPORT.md` (PHASE74)  
**Mode:** Documentation only. No code, no migrations, no UI, no commits.

---

## Classification Key

| Code | Meaning |
|------|---------|
| SE | Specification Error — doc is wrong or incomplete; fix applied in this phase |
| IE | Implementation Error — spec is correct; implementation must catch up (future phase) |
| FF | Future Feature — confirmed roadmap item; placed in `10_ROADMAP.md` |
| OD | Operator Decision — business decision required; tracked in `OPERATOR_DECISIONS.md` |

---

## Status Key

| Status | Meaning |
|--------|---------|
| Resolved | Fix applied to spec doc in PHASE75 |
| Pending | Doc change deferred to Phase C (spec reconciliation) |
| Operator Decision | Awaiting operator input; documented in `OPERATOR_DECISIONS.md` |
| Future Phase | Tracked in roadmap; not a spec error |

---

## CROSS-CUTTING ITEMS

| ID | Type | Affected Docs | Description | Resolution | Status |
|----|------|---------------|-------------|------------|--------|
| CC-1 | SE | 04, 05, 09, 10 | "39 canonical settings keys" stated everywhere; canonical JSON has exactly **37** keys | Fixed "39" → "37" in all affected documents | Resolved |
| CC-2 | OD | 03, 05 | PPF plan prices: JSON vs defaults.ts diverge by ¥15,000–¥130,000 at large-vehicle tiers | Documented in OPERATOR_DECISIONS.md as OD-2 | Operator Decision |
| CC-3 | OD | 03, 05, 11 | PPF vehicle ranks: 4-rank system (JSON) vs 3-rank system (implementation); different names | Documented as OD-3 | Operator Decision |
| CC-4 | OD | 03, 05 | PPF film types: carbon/color@1.8 (JSON) vs color@1.2/self-heal (implementation) | Documented as OD-4 | Operator Decision |
| CC-5 | OD | 03, 04 | Window film grades: high-heat/security (JSON) vs uv-cut/ir-cut (implementation) | Documented as OD-5 | Operator Decision |
| CC-6 | OD | 03, 04 | Window film part IDs: wf-rear-glass/wf-rear-qtr (JSON) vs wf-rear/wf-quarter (implementation) | Documented as OD-6 | Operator Decision |
| CC-7 | OD | 03, 04 | Room cleaning parts: rc-door and rc-trunk missing from defaults; 4 price mismatches | Documented as OD-7 | Operator Decision |
| CC-8 | IE | 03, 08, 09 | 6 of 13 EstimateWizard steps are PLACEHOLDER_SCREENS (no detailed UI built) | Spec is correct; implementation incomplete. Status updated in 08, 09. | Future Phase |
| CC-9 | OD | 05, 07, 09 | Migration 070 file exists in repo; unknown if applied to database | Documented as OD-1 | Operator Decision |

---

## DOCUMENT-BY-DOCUMENT ITEMS

### 01_PROJECT_OVERVIEW.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 01-SE-1 | SE | Old spec files (02–08 old numbering) coexist with new set; no superseded notice | Add superseded notice to §7 | Pending |
| 01-SE-2 | SE | Repo URL `github.com/nisikawa-officeAZ/GYEON` unverified | Mark as unverified in §4 | Pending |

---

### 02_SYSTEM_ARCHITECTURE.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 02-SE-1 | SE | RTO/RPO values not labeled as targets | Mark as "design targets" in §7 | Pending |
| 02-SE-2 | SE | LIFF client pages (`/liff/link`, `/liff/reservation`) conflated with REST API routes | Add distinction note to §10 | Pending |
| 02-SE-3 | SE | Intentional migration gap numbers not listed | Add gap list to §4.2 | Resolved (gaps listed in `05_DATABASE_REQUIREMENTS.md` §7) |
| 02-SE-4 | SE | 12 extra JSONB extension columns from migration 070 not in architecture doc | Add note to §4.2 | Pending |

---

### 03_BUSINESS_WORKFLOW.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 03-SE-1 | SE | `screen-home` is separate route; wizard starts at `category` — split not documented | Added implementation note to §3 | Pending |
| 03-SE-2 | SE | Steps §4.5–4.10 are PLACEHOLDER in implementation; no status annotation in spec | Added implementation-status disclaimer | Pending |
| 03-SE-3 | SE | Category display labels differ from JSON (acceptable if IDs match); not documented | Note that canonical category IDs must be preserved; display names are UI-level | Pending |
| 03-OD-1 | OD | Body size 7th key: LL+ (JSON) vs XL (implementation) | OD-15 | Operator Decision |
| 03-OD-2 | OD | PPF plan label: フロントフル (JSON) vs フロントハーフ (implementation) | OD-10 | Operator Decision |
| 03-OD-3 | OD | Default dealer_rate: 100% (spec/JSON) vs 70% (implementation defaults) | OD-9 | Operator Decision |

---

### 04_SETTINGS_WORKFLOW.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 04-SE-1 | SE | §7 heading says "39 canonical settings keys" — should be 37 | Fixed: changed to 37 | Resolved |
| 04-SE-2 | SE | §7 footer note still says "39 settings keys" | Fixed: changed to 37 | Resolved |
| 04-SE-3 | SE | §8.6 canonical save path is KV+IndexedDB; Supabase path not documented here | Added Supabase mapping note | Resolved |
| 04-SE-4 | SE | 12 extra JSONB columns from migration 070 not documented in settings workflow | Added §8a Extension JSONB Columns section | Resolved |
| 04-SE-5 | SE | §7 table lacks JSON key → dealer_settings column/JSONB path mapping | Added mapping note in §7 footer | Resolved |
| 04-SE-6 | SE | §5.6 ppf-new drawer shows JSON values (carbon, upper/luxury ranks) — conflicts with defaults.ts | Marked as pending operator decision | Operator Decision |

---

### 05_DATABASE_REQUIREMENTS.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 05-SE-1 | SE | §4.1 says "New columns count: 19" — migration 070 adds 32 new columns | Fixed count; added 13 extra columns to column listing | Resolved |
| 05-SE-2 | SE | §5 "Pending Migrations" presents 5 draft migrations — migration 070 already exists and covers all 5 | Replaced §5 with accurate "Migration 070" section | Resolved |
| 05-SE-3 | SE | §1.3 says "39 keys" | Fixed to 37 | Resolved |
| 05-SE-4 | SE | §8 requirement 2 says "all 39 canonical settings keys" | Fixed to 37 | Resolved |
| 05-SE-5 | SE | `reminder_templates` dual-column fallback logic undocumented | Added fallback note to §4.1 | Resolved |
| 05-SE-6 | SE | `CanonicalDealerSettings` TypeScript type file not referenced | Added reference to §4 | Resolved |
| 05-SE-7 | SE | Extra 12 JSONB extension blobs not documented in §4.1 column listing | Added all 12 columns to column listing | Resolved |
| 05-SE-8 | SE | Nullable DB vs non-nullable TypeScript asymmetry undocumented | Added note to §4.1 | Resolved |
| 05-OD-1 | OD | Has migration 070 been applied to the database? | OD-1 | Operator Decision |
| 05-SE-9 | SE | Spec says `vehicle_registration_ocr` table (mig 067); actual table name is `vehicle_registration_files` | Fixed reference in §2 domain table | Resolved |

---

### 06_OCR_REQUIREMENTS.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 06-SE-1 | SE | §5 only lists `ocr_enabled`; migration 070 also adds `ocr_policy` JSONB column | Added `ocr_policy` column + schema to §5 | Resolved |
| 06-SE-2 | SE | Spec refers to table as `vehicle_registration_ocr`; actual table is `vehicle_registration_files` | Fixed table name throughout | Resolved |
| 06-SE-3 | SE | `vehicle_registration_files` table schema not documented anywhere | Added full schema to §2a | Resolved |
| 06-SE-4 | SE | §3 "ocr_enabled as NOT SET locally" is ambiguous — confuses DB column with env var | Clarified distinction in §3 and §4 | Resolved |
| 06-OD-1 | OD | Field-mapping contract: which 車検証 fields map to which estimate/vehicle fields | OD-16 | Operator Decision |
| 06-OD-2 | OD | Retention/privacy policy for uploaded 車検証 images (PII: name, address, plate) | OD-17 | Operator Decision |
| 06-FF-1 | FF | Electronic vehicle registration (e-車検証) QR support | Added to roadmap Phase E | Future Phase |

---

### 07_LINE_REQUIREMENTS.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 07-SE-1 | SE | `line_public_settings` JSONB column (mig 070) absent from §5 | Added to §5 column table | Resolved |
| 07-SE-2 | SE | `line_message_templates` JSONB column (mig 070) absent from §5 | Added to §5 column table | Resolved |
| 07-SE-3 | SE | ➕ ADD column status ambiguous when migration 070 status is unknown | Added note: status depends on OD-1 (migration 070 apply status) | Resolved |
| 07-OD-1 | OD | LINE message dual-path: individual text columns vs `line_message_templates` JSONB | OD-11 | Operator Decision |

---

### 08_UI_REQUIREMENTS.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 08-SE-1 | SE | §3 table shows "Estimate wizard ✅ Complete (mobile)" without noting 6 PLACEHOLDER steps | Added PLACEHOLDER note and 13-screen breakdown table | Resolved |
| 08-SE-2 | SE | iframe stale-cache risk not discussed in §2 | Added risk callout to §2 | Resolved |
| 08-IE-1 | IE | 6 category wizard steps (PPF/window/maintenance/carwash/roomclean/other) have no detailed UI | Spec is correct; implementation must build these. Tracked in 09 as Implementation Pending. | Future Phase |

---

### 09_PHASE_STATUS.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 09-SE-1 | SE | LINE CRM and OCR marked `✅ (code)` without noting inactive status | Updated to `🟡 Code complete — inactive (no credentials)` | Resolved |
| 09-SE-2 | SE | Pending phase item 5 says "5 pending migrations" | Updated to reference "migration 070 file exists — apply pending CTO approval" | Resolved |
| 09-SE-3 | SE | Pending phase item 6 says "39 settings keys" | Fixed to 37 | Resolved |
| 09-SE-4 | SE | Estimate Builder marked ✅ Complete; 6 steps are placeholder | Updated to `🟡 Category selection + STEP1-5 ✅; 6 category-specific steps placeholder` | Resolved |
| 09-SE-5 | SE | Status categories not distinguishing Completed / Doc Complete / Implementation Pending / Future | Added status legend and reorganized pending phases | Resolved |
| 09-OD-1 | OD | Version track: 1.0.0 vs 1.1.0-dev | OD-14 | Operator Decision |

---

### 10_ROADMAP.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 10-SE-1 | SE | Phase C references "5 draft migrations in §5" — migration 070 already exists | Updated Phase C to reference migration 070 | Resolved |
| 10-SE-2 | SE | Phase C references "39 canonical settings keys" | Fixed to 37 | Resolved |
| 10-SE-3 | SE | No Phase B→C sequencing dependency note (LINE activation requires migration 070 first) | Added dependency note | Resolved |
| 10-SE-4 | SE | No mention of PHASE74 audit or PHASE75 finalization as prerequisite gate | Added PHASE74/75 reference | Resolved |
| 10-FF-1 | FF | OCR field-mapping spec (OD-16 future work) | Added to Phase C | Resolved |
| 10-FF-2 | FF | e-車検証 QR support | Added to Phase E v1.1 | Resolved |
| 10-FF-3 | FF | Image retention/privacy policy for vehicle registration images | Added to Phase C | Resolved |

---

### 11_CANONICAL_RULES.md

| ID | Type | Description | Resolution | Status |
|----|------|-------------|------------|--------|
| 11-SE-1 | SE | No rule for `line_public_settings` security (must never contain LINE secrets) | Added to §2 security rules | Resolved |
| 11-SE-2 | SE | No rule for `ocr_policy.human_confirmation_required` always-true invariant | Added to §7.3 | Resolved |
| 11-SE-3 | SE | No rule for `reminder_templates` dual-column fallback read order | Added to §7.6 as new sub-rule | Resolved |
| 11-SE-4 | SE | 12 extra JSONB extension blobs (from mig 070) have no governing rules | Added §7.8 Extension Blobs | Resolved |
| 11-OD-1 | OD | `roof` PPF plan keys in defaults.ts not in canonical JSON — extension or deviation? | OD-12 | Operator Decision |

---

## SUMMARY COUNTS

| Classification | Count | Action |
|---------------|-------|--------|
| Specification Error (SE) | 38 | Fixed in PHASE75 (Resolved) or deferred to Phase C (Pending) |
| Implementation Error (IE) | 2 | Tracked in 09_PHASE_STATUS.md as Implementation Pending |
| Future Feature (FF) | 3 | Placed in 10_ROADMAP.md |
| Operator Decision (OD) | 17 | Documented in OPERATOR_DECISIONS.md |
| **Total** | **60** | |

| Resolved (this phase) | 30 |
| Pending (Phase C) | 8 |
| Operator Decision | 17 |
| Future Phase | 5 |

---

*GYEON Detailer Agent | PHASE75 Finalization | Office AZ | 2026-06-25*  
*Documentation only — no code, no migrations, no UI, no commits.*
