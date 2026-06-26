# IMPLEMENTATION BACKLOG
## GYEON Detailer Agent — PHASE77

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Active — Implementation Readiness Review |
| **Date** | 2026-06-25 |
| **Source** | MASTER_SPECIFICATION_V1_READY.md, OPERATOR_DECISIONS.md, MASTER_SPECIFICATION_CHANGELOG.md |
| **Related** | `PHASE77_IMPLEMENTATION_PLAN.md`, `VERSION_1_RELEASE_CHECKLIST.md`, `OPERATOR_DECISIONS.md` |

---

## STEP 1 — Operator Decision Classification

Each of the 17 open Operator Decisions is classified as:

- **A** — Required before Version 1.0 (functional correctness, DB integrity, or customer-facing accuracy)
- **B** — Can use temporary default values (inactive feature or reasonable defaults exist)
- **C** — Can be postponed until Version 1.1 (no current functional impact)

### Classification Table

| OD | Priority | Topic | Classification | Rationale |
|----|----------|-------|----------------|-----------|
| OD-1 | 🔴 BLOCKER | Migration 070 applied status | **A** | Without migration 070, all LINE/OCR/settings-extension columns are absent from DB. V1.0 cannot function at the DB level without this. |
| OD-2 | 🔴 BLOCKER | PPF plan prices | **A** | PPF step is in V1.0 scope. Wrong prices (¥30k–¥130k delta) are shown to customers. Must resolve before building PPF step. |
| OD-3 | 🔴 BLOCKER | PPF vehicle ranks | **A** | 4-rank vs 3-rank affects auto-detect logic. Building PPF step without resolving means auto-detect is broken for upper/luxury tiers. |
| OD-4 | 🔴 BLOCKER | PPF film types | **A** | Carbon film is missing from implementation. Color coefficient differs (1.8 vs 1.2). Cannot build PPF film-selection UI without canonical list. |
| OD-5 | ⚠️ IMPORTANT | Window film grade names | **A** | High-heat/security vs uv-cut/ir-cut are different product lines, not just names. Building window film UI requires knowing which products to offer. |
| OD-6 | ⚠️ IMPORTANT | Window film part IDs | **A** | Part IDs are stored in estimates DB. Estimates created with wrong IDs reference non-existent parts. Must resolve before building window film UI. |
| OD-7 | ⚠️ IMPORTANT | Room cleaning parts | **A** | rc-door and rc-trunk are missing from implementation; 4 prices wrong. Customer quotes will be incomplete and incorrectly priced. |
| OD-8 | 📋 NORMAL | Settings key count | **C** | Default assumption (37) is correct per JSON count. No functional impact. Verify in Phase C. |
| OD-9 | ⚠️ IMPORTANT | Default dealer rate | **A** | This affects ALL active estimates right now. 70% default means every estimate is automatically discounted 30%. Customer-facing defect in current V1.0. |
| OD-10 | 🔴 BLOCKER | PPF plan label | **A** | フロントフル vs フロントハーフ is a wrong product name shown to customers. Must correct before PPF step is built or activated. |
| OD-11 | ⚠️ IMPORTANT | LINE message dual-path | **B** | LINE is inactive (Phase B). Individual text columns exist and work. Can default to individual columns until LINE is activated; resolve before Phase B. |
| OD-12 | 📋 NORMAL | Roof PPF plan | **C** | Not in canonical flow. No customer-facing impact. Decide in Phase C. |
| OD-13 | ⚠️ IMPORTANT | g5 activation timing | **B** | Group g5 is hidden with 準備中. Safe to leave hidden until Phase B. Activation decision can be deferred. |
| OD-14 | 📋 NORMAL | Version track | **C** | Versioning only. No functional impact on implementation. |
| OD-15 | ⚠️ IMPORTANT | PPF body size 7th key | **A** | The wizard has 8 body sizes but PPF plan only covers 7. XL/XXL vs LL+ mismatch means largest vehicles get wrong pricing. Part of PPF step build. |
| OD-16 | 📋 NORMAL | OCR field mapping | **C** | OCR inactive. Field mapping needed before Phase B OCR activation, not V1.0. |
| OD-17 | 📋 NORMAL | Image retention policy | **C** | OCR inactive. APPI compliance needed before Phase B, not V1.0. |

### Classification Summary

| Class | Count | OD IDs |
|-------|-------|--------|
| **A — Required before V1.0** | 10 | OD-1, OD-2, OD-3, OD-4, OD-5, OD-6, OD-7, OD-9, OD-10, OD-15 |
| **B — Temporary default OK** | 2 | OD-11, OD-13 |
| **C — Defer to V1.1** | 5 | OD-8, OD-12, OD-14, OD-16, OD-17 |

---

## STEP 2 — Implementation Blocker Analysis

### Active blockers from MASTER_SPECIFICATION_V1_READY.md

| # | Blocker | Affected Module | Required Work | Complexity |
|---|---------|----------------|--------------|-----------|
| B-1 | Migration 070 not confirmed applied (OD-1) | DB / All Phase B features | Apply migration 070 via Supabase SQL Editor (ADD COLUMN IF NOT EXISTS — safe re-apply) | Low |
| B-2 | PPF plan prices: ¥30k–¥130k delta (OD-2) | `EstimateWizard.tsx` (PPF step), `dealer-settings-defaults.ts` | Update `dealer-settings-defaults.ts` ppf_price_tables after operator decision; update `03_BUSINESS_WORKFLOW.md` prices | Low–Medium |
| B-3 | PPF rank system: 4-rank vs 3-rank (OD-3) | `EstimateWizard.tsx` (PPF step), `dealer-settings-defaults.ts` | Update rank definitions; if 4-rank canonical, add upper/luxury to defaults.ts; update auto-detect logic | Medium |
| B-4 | PPF film types: carbon missing; color delta (OD-4) | `EstimateWizard.tsx` (PPF step), `dealer-settings-defaults.ts` | Add/remove film type entries in defaults.ts; update film coefficient table; update PPF step UI | Medium |
| B-5 | Window film grades: different product lines (OD-5) | `EstimateWizard.tsx` (window step), `dealer-settings-defaults.ts` | Replace grade definitions in defaults.ts and PPF step UI | Medium |
| B-6 | Window film part IDs: wf-rear vs wf-rear-glass (OD-6) | `EstimateWizard.tsx` (window step), `dealer-settings-defaults.ts`, stored estimates | Update part ID keys; run data fix if estimates exist with wrong IDs | Medium |
| B-7 | Room cleaning: 2 parts missing, 4 prices wrong (OD-7) | `EstimateWizard.tsx` (room clean step), `dealer-settings-defaults.ts` | Add rc-door, rc-trunk; correct prices; update room clean step UI | Low–Medium |
| B-8 | Default dealer rate: 100% vs 70% (OD-9) | `dealer-settings-defaults.ts`, ALL active estimates | Update DEFAULT_DEALER_RATE constant; affects every estimate immediately | Low |
| B-9 | PPF plan label: フロントフル vs フロントハーフ (OD-10) | `dealer-settings-defaults.ts`, `EstimateWizard.tsx` (PPF step UI) | Change single label string in defaults.ts | Low |
| B-10 | LINE message dual-path ambiguity (OD-11) | `src/app/api/line/*`, `src/lib/line/*`, LINE settings UI | Decide canonical column path; update LINE send functions to read from one path only | Medium |

### Implementation Errors (from CHANGELOG)

| # | IE | Affected Module | Required Work | Complexity |
|---|-----|----------------|--------------|-----------|
| IE-1 | 6 PLACEHOLDER_SCREENS have no UI (CC-8) | `EstimateWizard.tsx` step-ppf, step-window, step-maintenance, step-carwash, step-roomclean, step-other | Build full UI for each step: pricing tables, item selection, subtotal display | **High** (6 screens × Medium) |
| IE-2 | Desktop UI absent for all screens except home (08-IE-1) | All `src/app/*/page.tsx` routes | Design (Genspark) → implement → verify × N screens | **High** (Phase A rollout) |

### Pending Specification Items (from CHANGELOG — Pending status)

| # | ID | Doc | Item | Phase C task |
|---|-----|-----|------|-------------|
| P-1 | 01-SE-1 | 01 | Old spec files (02–08) no superseded notice | Add notice; delete old files |
| P-2 | 01-SE-2 | 01 | Repo URL unverified | Verify in §4 |
| P-3 | 02-SE-1 | 02 | RTO/RPO not labeled as design targets | Mark in §7 |
| P-4 | 02-SE-2 | 02 | LIFF client pages vs REST API conflated | Add distinction to §10 |
| P-5 | 02-SE-4 | 02 | 12 extra JSONB columns not in architecture doc | Add to §4.2 |
| P-6 | 03-SE-1 | 03 | screen-home vs wizard start not documented | Add implementation note |
| P-7 | 03-SE-2 | 03 | PLACEHOLDER steps not annotated with status | Add status annotation |
| P-8 | 03-SE-3 | 03 | Category display label differences not noted | Add IDs vs labels note |

---

## Priority 1 — Required for V1.0

These items must be completed before V1.0 can be considered functionally correct and ready for customers.

### 1-A: Operator Decisions (unblock all building work)

| Task | OD | Action | Owner | Complexity |
|------|----|--------|-------|-----------|
| Apply migration 070 to staging + production | OD-1 | Paste SQL into Supabase Editor → confirm apply | CTO | Low |
| Confirm canonical PPF plan prices | OD-2 | Review JSON vs defaults.ts; select canonical | CTO | Low |
| Confirm PPF vehicle rank system (4 or 3 rank) | OD-3 | Review JSON vs defaults.ts; select canonical | CTO | Low |
| Confirm PPF film types (carbon / self-heal) | OD-4 | Review JSON vs defaults.ts; select canonical | CTO | Low |
| Confirm window film grade names | OD-5 | Review JSON vs defaults.ts; select canonical | CTO | Low |
| Confirm window film part IDs and prices | OD-6 | Review parts table; select canonical | CTO | Low |
| Confirm room cleaning parts and prices | OD-7 | Review parts table; select canonical | CTO | Low |
| Confirm default dealer rate | OD-9 | Decision: 100% or 70% | CTO | Low |
| Confirm PPF plan label フロントフル vs フロントハーフ | OD-10 | Single label decision | CTO | Low |
| Confirm PPF 7th body size key (XL vs LL+ vs 8-size) | OD-15 | Affects pricing table coverage | CTO | Low |

### 1-B: Defaults Reconciliation (after OD resolution)

| Task | Affected File | Work | Complexity |
|------|--------------|------|-----------|
| Update DEFAULT_DEALER_RATE to confirmed rate | `dealer-settings-defaults.ts` | Change 1 constant | Low |
| Update PPF plan prices | `dealer-settings-defaults.ts` | Update price table | Low |
| Update PPF rank definitions | `dealer-settings-defaults.ts` | Add/remove rank entries | Low |
| Update PPF film type definitions | `dealer-settings-defaults.ts` | Add/remove film entries | Low |
| Update window film grade definitions | `dealer-settings-defaults.ts` | Replace grade table | Low |
| Update window film part IDs and prices | `dealer-settings-defaults.ts` | Update parts array | Low |
| Update room cleaning parts and prices | `dealer-settings-defaults.ts` | Add missing parts; correct prices | Low |
| Update PPF plan label | `dealer-settings-defaults.ts` | Change 1 string | Low |
| Update 03_BUSINESS_WORKFLOW.md with confirmed prices | `03_BUSINESS_WORKFLOW.md` | Spec update post-OD | Low |

### 1-C: Core Feature Implementation

| # | Task | Primary Files | Complexity | Notes |
|---|------|--------------|-----------|-------|
| 1 | Build PPF step UI | `src/components/estimates/EstimateWizard.tsx` | Medium | Requires OD-2,3,4,10,15 resolved |
| 2 | Build window film step UI | `src/components/estimates/EstimateWizard.tsx` | Medium | Requires OD-5,6 resolved |
| 3 | Build maintenance step UI | `src/components/estimates/EstimateWizard.tsx` | Medium | No blocking ODs |
| 4 | Build carwash step UI | `src/components/estimates/EstimateWizard.tsx` | Low–Medium | No blocking ODs |
| 5 | Build room cleaning step UI | `src/components/estimates/EstimateWizard.tsx` | Medium | Requires OD-7 resolved |
| 6 | Build other work step UI | `src/components/estimates/EstimateWizard.tsx` | Low | No blocking ODs |
| 7 | Desktop UI — Estimates list | `src/app/estimates/page.tsx` | Medium | Genspark design first |
| 8 | Desktop UI — Customers | `src/app/customers/page.tsx` | Medium | Genspark design first |
| 9 | Desktop UI — Vehicles | `src/app/vehicles/page.tsx` | Medium | Genspark design first |
| 10 | Desktop UI — Work Orders | `src/app/work-orders/page.tsx` | Medium | Genspark design first |
| 11 | Desktop UI — Settings | `src/app/settings/page.tsx` | High | 12-category nav on desktop |

---

## Priority 2 — Recommended for V1.0

These items improve quality and correctness but V1.0 could ship without them.

| # | Task | Affected Area | Complexity | Notes |
|---|------|--------------|-----------|-------|
| 1 | Resolve OD-11 (LINE message path) | `src/lib/line/*`, LINE settings | Medium | Before Phase B |
| 2 | Decide OD-13 (g5 activation timing) | Settings UI | Low | Before Phase B |
| 3 | Desktop UI — Invoices / Payments | `src/app/invoices/*`, `payments/*` | Medium | Phase A continuation |
| 4 | Desktop UI — Products / Product Orders | `src/app/products/*` | Medium | Phase A continuation |
| 5 | Desktop UI — Calendar / Reservations | `src/app/calendar/*`, `reservations/*` | Medium | Phase A continuation |
| 6 | Desktop UI — LINE / Maintenance | `src/app/line/*`, `maintenance/*` | Medium | Phase A continuation |
| 7 | ESLint config restore | project root | Low | Phase D |
| 8 | Silence /products dynamic-server log | `src/app/products/page.tsx` | Low | Phase D |
| 9 | Fix CHANGELOG (PHASE66–73+) | `CHANGELOG.md` | Low | Phase C |
| 10 | Delete 7 superseded spec files | `docs/master_specification/` | Low | Phase C — needs operator approval |

---

## Priority 3 — Future Version (V1.1 or later)

| # | Task | Affected Area | Target Version | OD/FF |
|---|------|--------------|---------------|-------|
| 1 | Phase B: Apply env vars, activate LINE | All LINE modules | V1.1 | OD-1 prerequisite done |
| 2 | Phase B: Activate OCR | All OCR modules | V1.1 | OD-1 prerequisite done |
| 3 | Resolve OD-8 (settings key count final) | Spec + JSON | V1.1 | Phase C |
| 4 | Resolve OD-12 (roof PPF plan decision) | defaults.ts | V1.1 | Phase C |
| 5 | Resolve OD-14 (version track) | VERSION.md | V1.1 | Phase C |
| 6 | Resolve OD-16 (OCR field mapping) | `06_OCR_REQUIREMENTS.md` | V1.1 | Before Phase B |
| 7 | Resolve OD-17 (image retention policy) | Storage, APPI compliance | V1.1 | Before Phase B |
| 8 | Place canonical JSONs in repo (version control) | `gyeon_flow.json` + settings | V1.1 | Phase C |
| 9 | PWA service worker stale cache hardening | `public/`, `next.config.ts` | V1.1 | Phase D |
| 10 | Evaluate iframe → native React for PC screens | `public/desktop-home.html` | V1.1 | Phase D |
| 11 | Resolve data model gaps: past_histories, dealer_statements | DB schema | V1.1 | Phase C |
| 12 | Stripe integration | Billing module | V1.1 | Phase E |
| 13 | Automated invoice generation | Invoice module | V1.1 | Phase E |
| 14 | Automated renewal reminder | Maintenance module | V1.1 | Phase E |
| 15 | e-車検証 QR support | OCR module | V1.1 | Phase E |

---

*GYEON Detailer Agent | PHASE77 — Implementation Readiness | Office AZ | 2026-06-25*  
*Documentation only — no code, no UI, no migrations, no commits.*
