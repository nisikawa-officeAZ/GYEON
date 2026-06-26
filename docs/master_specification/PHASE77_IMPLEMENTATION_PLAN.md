# PHASE77 IMPLEMENTATION PLAN
## GYEON Detailer Agent — Version 1.0

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Implementation Readiness Review — Planning Document |
| **Date** | 2026-06-25 |
| **Source** | IMPLEMENTATION_BACKLOG.md, MASTER_SPECIFICATION_V1_READY.md |
| **Related** | `IMPLEMENTATION_BACKLOG.md`, `VERSION_1_RELEASE_CHECKLIST.md`, `03_BUSINESS_WORKFLOW.md`, `08_UI_REQUIREMENTS.md` |

> Documentation only. No implementation. No code changes. No UI changes. No commits.

---

## Implementation Sequence Overview

```
GATE 0: Operator Decisions (OD-1 through OD-15)
    ↓ (all ODs resolved)
GATE 1: Migration 070 applied to staging + production (OD-1)
    ↓
GATE 2: Defaults reconciliation (dealer-settings-defaults.ts updated)
    ↓
TRACK A: Wizard placeholder steps (6 screens)
TRACK B: Desktop UI rollout (Phase A screens)
    ↓
GATE 3: All 6 placeholder steps built and verified
    ↓
GATE 4: Core desktop screens complete (estimates, customers, vehicles, work-orders, settings)
    ↓
V1.0 RELEASE CANDIDATE
    ↓
TRACK C: Phase B integration activation (LINE + OCR)
```

---

## TASK GROUP 0: Operator Gate (prerequisite — no code work begins until complete)

### TASK 0-1: Resolve All Class A Operator Decisions

**Purpose:** Unblock all V1.0 implementation work. Without these decisions, building the wizard steps or reconciling defaults.ts will produce wrong output.

**Operator actions required:**

| OD | Action | Estimated time |
|----|--------|---------------|
| OD-1 | Confirm migration 070 applied status | 5 min |
| OD-9 | Confirm default dealer rate (100% or 70%) | 2 min |
| OD-2 | Review PPF price table (JSON vs defaults.ts) | 15 min |
| OD-3 | Review PPF rank system (4-rank vs 3-rank) | 10 min |
| OD-4 | Review PPF film types (carbon/color/self-heal) | 10 min |
| OD-10 | Confirm PPF front-half plan label | 2 min |
| OD-15 | Confirm 7th body size key for PPF pricing | 5 min |
| OD-5 | Review window film grades | 10 min |
| OD-6 | Review window film part IDs and prices | 15 min |
| OD-7 | Review room cleaning parts and prices | 15 min |

**Total estimated operator time:** ~90 minutes (one review session with canonical JSON files)

**Affected files when resolved:** `OPERATOR_DECISIONS.md` (fill in decisions), then `03_BUSINESS_WORKFLOW.md` (prices), `dealer-settings-defaults.ts` (values)

**Dependencies:** None — this is the gate

**Estimated implementation order:** FIRST (before any code)

---

## TASK GROUP 1: Migration 070 Application

### TASK 1-1: Apply migration 070 to staging environment

**Purpose:** Add 32 new columns to `dealer_settings` so all Phase B features have their required DB columns.

**Affected files:**
- `supabase/migrations/070_dealer_settings_canonical.sql` (existing file — apply via Supabase SQL Editor)
- Supabase staging project — `dealer_settings` table

**Dependencies:** OD-1 confirmed (know whether it's already applied)

**Implementation steps:**
1. Confirm migration 070 SQL file exists at `~/DealerOS/supabase/migrations/070_dealer_settings_canonical.sql`
2. Open Supabase staging project → SQL Editor
3. Paste migration SQL
4. Execute — `ADD COLUMN IF NOT EXISTS` makes re-application safe
5. Verify all 32 new columns exist in `dealer_settings`
6. Run staging verification test suite

**Estimated complexity:** Low

**Note:** The migration uses `ADD COLUMN IF NOT EXISTS` for all columns — safe to apply even if partially applied. No data loss risk.

### TASK 1-2: Apply migration 070 to production environment

**Purpose:** Align production DB schema with staging.

**Affected files:** Production Supabase `dealer_settings` table

**Dependencies:** TASK 1-1 complete and staging verified

**Implementation steps:**
1. CTO approval (required per `11_CANONICAL_RULES.md` §3)
2. Apply same SQL to production via Supabase SQL Editor
3. Verify column existence in production
4. Update `05_DATABASE_REQUIREMENTS.md` §5 migration status table

**Estimated complexity:** Low

---

## TASK GROUP 2: Defaults Reconciliation

### TASK 2-1: Update DEFAULT_DEALER_RATE

**Purpose:** Fix incorrect default discount rate that affects ALL active estimates now.

**Affected files:**
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — `DEFAULT_DEALER_RATE` constant

**Dependencies:** OD-9 resolved

**Implementation steps:**
1. Read `dealer-settings-defaults.ts` to find `DEFAULT_DEALER_RATE`
2. Update to confirmed rate (100% or 70%)
3. Test: create a new estimate and verify the rate applied is correct

**Estimated complexity:** Low (single constant change)

**Estimated implementation order:** HIGHEST PRIORITY — this affects production estimates now

### TASK 2-2: Update PPF pricing, ranks, film types, and label

**Purpose:** Align `dealer-settings-defaults.ts` PPF pricing with the canonical source.

**Affected files:**
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — `ppf_price_tables`, rank coefficients, film coefficients
- `03_BUSINESS_WORKFLOW.md` §4.5 — update prices if JSON values change

**Dependencies:** OD-2, OD-3, OD-4, OD-10, OD-15 resolved

**Implementation steps:**
1. Read current `dealer-settings-defaults.ts` PPF section
2. Update `plan_prices` table with confirmed prices for all 7 (or 8) body sizes
3. Update `rank_coeff` table (3 or 4 ranks with confirmed coefficients)
4. Update `film_coeff` table (add carbon if canonical; remove self-heal if not canonical)
5. Update plan label for `front-half` (フロントフル or フロントハーフ)
6. If 8-size coverage needed (OD-15 choice C): add XL and XXL entries
7. Update `03_BUSINESS_WORKFLOW.md` §4.5 price tables to match

**Estimated complexity:** Low–Medium (data changes, not logic changes)

### TASK 2-3: Update window film definitions

**Purpose:** Align window film grades and parts with canonical source.

**Affected files:**
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — `service_price_settings.window_film`

**Dependencies:** OD-5, OD-6 resolved

**Implementation steps:**
1. Update grade IDs and coefficients (if OD-5 → JSON canonical: add high-heat, security; remove uv-cut, ir-cut)
2. Update part IDs (if OD-6 → JSON canonical: rename wf-rear → wf-rear-glass, wf-quarter → wf-rear-qtr; add wf-sunroof, wf-windshield)
3. Update prices to match canonical source
4. Update `03_BUSINESS_WORKFLOW.md` §4.6 if IDs changed

**Estimated complexity:** Low–Medium

**Data migration note:** If any estimates exist in DB with old part IDs (wf-rear, wf-quarter), a data fix script will be needed. Check before renaming.

### TASK 2-4: Update room cleaning parts

**Purpose:** Add missing parts and correct prices.

**Affected files:**
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — `service_price_settings.room_cleaning`

**Dependencies:** OD-7 resolved

**Implementation steps:**
1. Add `rc-door` and `rc-trunk` entries if canonical (OD-7 choice A)
2. Remove `rc-full` if not canonical
3. Correct prices for rc-seat, rc-ceiling, rc-dash
4. Update `03_BUSINESS_WORKFLOW.md` §4.9 parts table

**Estimated complexity:** Low

---

## TASK GROUP 3: Estimate Wizard — Placeholder Steps

All 6 steps follow the same implementation pattern:
1. Genspark design review (design first — see `11_CANONICAL_RULES.md` §5)
2. Implement in `src/components/estimates/EstimateWizard.tsx`
3. Verify on mobile (≥ iOS/Android) — mobile layout only; desktop is separate
4. Commit one step at a time

### TASK 3-1: PPF Step (`step-ppf`)

**Purpose:** Replace placeholder with full PPF estimate UI: plan selection, body size confirmation, rank selection, film type selection, partial coverage parts.

**Affected files:**
- `src/components/estimates/EstimateWizard.tsx` — `step-ppf` screen component
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — reads from `ppf_price_tables`
- `src/lib/estimates/` — pricing calculation functions (if any need updating)

**Dependencies:**
- TASK 2-2 complete (PPF defaults reconciled)
- OD-2, OD-3, OD-4, OD-10, OD-15 resolved
- Genspark design for PPF step

**Spec reference:** `03_BUSINESS_WORKFLOW.md` §4.5

**Implementation steps:**
1. Read `03_BUSINESS_WORKFLOW.md` §4.5 for all required fields and display logic
2. Read current `step-ppf` placeholder in `EstimateWizard.tsx` to understand skeleton
3. Obtain Genspark design for PPF step (desktop-style layout; confirm with CTO)
4. Implement plan selection (front-half / full-body / partial)
5. Implement rank selection (std / premium / upper / luxury or confirmed rank system)
6. Implement film type selection (clear / matte / carbon / color or confirmed set)
7. Implement partial coverage parts checkboxes
8. Wire up to pricing calculation: `base_price × rank_coeff × film_coeff`
9. Display subtotal
10. Verify on mobile and tablet

**Estimated complexity:** Medium

### TASK 3-2: Window Film Step (`step-window`)

**Purpose:** Build window film estimate UI: part selection (front door, rear door, rear glass, etc.), grade selection, price calculation.

**Affected files:**
- `src/components/estimates/EstimateWizard.tsx` — `step-window` screen component
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — reads `service_price_settings.window_film`

**Dependencies:**
- TASK 2-3 complete (window film definitions reconciled)
- OD-5, OD-6 resolved
- Genspark design for window step

**Spec reference:** `03_BUSINESS_WORKFLOW.md` §4.6

**Implementation steps:**
1. Read `03_BUSINESS_WORKFLOW.md` §4.6
2. Implement grade selection (standard / premium / high-heat / security or confirmed grades)
3. Implement part checkboxes (front door / rear door / rear glass / quarter / sunroof / windshield or confirmed parts)
4. Calculate: `part_base_price × grade_coeff` per part; sum for window subtotal
5. Verify on mobile

**Estimated complexity:** Medium

### TASK 3-3: Maintenance Step (`step-maintenance`)

**Purpose:** Build maintenance service estimate UI: menu selection (wash, wax, clay, ceramic refresh, etc.) and pricing.

**Affected files:**
- `src/components/estimates/EstimateWizard.tsx` — `step-maintenance` screen component
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — reads `service_price_settings.maintenance`

**Dependencies:**
- No blocking ODs — maintenance pricing matches across JSON and defaults.ts
- Genspark design for maintenance step

**Spec reference:** `03_BUSINESS_WORKFLOW.md` §4.7

**Implementation steps:**
1. Read `03_BUSINESS_WORKFLOW.md` §4.7 for maintenance menus and pricing
2. Implement menu checkboxes with prices
3. Wire subtotal calculation
4. Note: `menus[].id` values are referenced by `maintenance_reminder_templates` — use exact canonical IDs

**Estimated complexity:** Low–Medium

**Note:** No blocking ODs. Can begin immediately after TASK 2-1 (defaults rate fix).

### TASK 3-4: Carwash Step (`step-carwash`)

**Purpose:** Build carwash estimate UI: plan selection (standard / deluxe / premium) and pricing.

**Affected files:**
- `src/components/estimates/EstimateWizard.tsx` — `step-carwash` screen component
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — reads `service_price_settings.carwash`

**Dependencies:**
- No blocking ODs
- Genspark design for carwash step

**Spec reference:** `03_BUSINESS_WORKFLOW.md` §4.8

**Estimated complexity:** Low — simpler than PPF/window steps

### TASK 3-5: Room Cleaning Step (`step-roomclean`)

**Purpose:** Build room cleaning estimate UI: part selection and pricing.

**Affected files:**
- `src/components/estimates/EstimateWizard.tsx` — `step-roomclean` screen component
- `src/lib/dealer-settings/dealer-settings-defaults.ts` — reads `service_price_settings.room_cleaning`

**Dependencies:**
- TASK 2-4 complete (room cleaning parts reconciled)
- OD-7 resolved
- Genspark design for room cleaning step

**Spec reference:** `03_BUSINESS_WORKFLOW.md` §4.9

**Estimated complexity:** Low–Medium

### TASK 3-6: Other Work Step (`step-other`)

**Purpose:** Build free-form other work estimate UI: custom item entry with description and price.

**Affected files:**
- `src/components/estimates/EstimateWizard.tsx` — `step-other` screen component

**Dependencies:**
- No blocking ODs
- Genspark design for other work step

**Spec reference:** `03_BUSINESS_WORKFLOW.md` §4.10

**Estimated complexity:** Low — free-form entry, minimal pricing logic

---

## TASK GROUP 4: Desktop UI Rollout (Phase A)

All desktop screens follow this pattern:
1. Request Genspark design (desktop/wide layout — state this explicitly)
2. Implement via iframe (quick) or native React (if live data needed)
3. Verify: ≥1024px and <1024px (mobile must be untouched)
4. Commit

### TASK 4-1: Desktop — Estimates (`/estimates`)

**Purpose:** PC layout for estimates list and estimate detail.

**Affected files:**
- `src/app/estimates/page.tsx`
- `src/app/estimates/[id]/page.tsx`
- New: `public/desktop-estimates.html` (or native React component)

**Dependencies:** Genspark design; no OD blockers for list view

**Spec reference:** `08_UI_REQUIREMENTS.md` §2

**Estimated complexity:** Medium

### TASK 4-2: Desktop — Customers (`/customers`)

**Purpose:** PC layout for customers list and customer detail.

**Affected files:**
- `src/app/customers/page.tsx`
- `src/app/customers/[id]/page.tsx`

**Dependencies:** Genspark design

**Estimated complexity:** Medium

### TASK 4-3: Desktop — Vehicles (`/vehicles`)

**Purpose:** PC layout for vehicles list and vehicle detail.

**Affected files:**
- `src/app/vehicles/page.tsx`
- `src/app/vehicles/[id]/page.tsx`

**Dependencies:** Genspark design

**Estimated complexity:** Medium

### TASK 4-4: Desktop — Work Orders (`/work-orders`)

**Purpose:** PC layout for work orders list and detail.

**Affected files:**
- `src/app/work-orders/page.tsx`
- `src/app/work-orders/[id]/page.tsx`

**Dependencies:** Genspark design

**Estimated complexity:** Medium

### TASK 4-5: Desktop — Settings (`/settings`)

**Purpose:** PC layout for the settings hub with 12-category navigation.

**Affected files:**
- `src/app/settings/page.tsx`
- `src/components/settings/SettingsCategoryNav.tsx`

**Dependencies:** Genspark design; OD-13 resolved (g5 timing)

**Spec reference:** `04_SETTINGS_WORKFLOW.md`, `08_UI_REQUIREMENTS.md`

**Estimated complexity:** High — 12 categories, drawer pattern, complex state

---

## TASK GROUP 5: Spec Reconciliation (Phase C — post-OD resolution)

### TASK 5-1: Update 03_BUSINESS_WORKFLOW.md with confirmed prices

**Purpose:** After ODs resolved, update the spec to reflect canonical prices, IDs, labels.

**Affected files:**
- `03_BUSINESS_WORKFLOW.md` §4.5, §4.6, §4.7, §4.8, §4.9, §4.10

**Dependencies:** OD-2 through OD-10, OD-15 resolved

**Estimated complexity:** Low (documentation update)

### TASK 5-2: Update OPERATOR_DECISIONS.md with resolution records

**Purpose:** Record each decision's date and rationale.

**Affected files:** `OPERATOR_DECISIONS.md`

**Dependencies:** Operator has resolved decisions

**Estimated complexity:** Low

### TASK 5-3: Delete 7 superseded spec files

**Purpose:** Remove old (pre-SDD) spec files to eliminate confusion.

**Affected files:**
- `02_BUSINESS_WORKFLOW.md`, `03_SETTINGS_WORKFLOW.md`, `04_DATABASE_REQUIREMENTS.md`
- `05_OCR_REQUIREMENTS.md`, `06_LINE_REQUIREMENTS.md`, `07_UI_REQUIREMENTS.md`
- `08_DEVELOPMENT_RULES.md`

**Dependencies:** Operator approval required (CLAUDE.md rule: "Ask before deleting any files")

**Estimated complexity:** Low

---

## Implementation Order Summary

```
ORDER 1  TASK 0-1   Operator resolves OD-1, OD-9 (most critical)
ORDER 2  TASK 1-1   Apply migration 070 to staging
ORDER 3  TASK 2-1   Update DEFAULT_DEALER_RATE (affects production now)
ORDER 4  TASK 0-1   Operator resolves OD-2 through OD-15 (remaining)
ORDER 5  TASK 2-2   Update PPF defaults (post OD-2,3,4,10,15)
ORDER 6  TASK 2-3   Update window film defaults (post OD-5,6)
ORDER 7  TASK 2-4   Update room cleaning defaults (post OD-7)
ORDER 8  TASK 1-2   Apply migration 070 to production (after staging verified)
ORDER 9  TASK 3-3   Maintenance step (no blocking ODs — can start while PPF ODs resolve)
ORDER 10 TASK 3-4   Carwash step (no blocking ODs)
ORDER 11 TASK 3-6   Other work step (no blocking ODs)
ORDER 12 TASK 3-5   Room cleaning step (post TASK 2-4)
ORDER 13 TASK 3-1   PPF step (post TASK 2-2, most complex)
ORDER 14 TASK 3-2   Window film step (post TASK 2-3)
ORDER 15 TASK 4-1   Desktop — Estimates
ORDER 16 TASK 4-2   Desktop — Customers
ORDER 17 TASK 4-3   Desktop — Vehicles
ORDER 18 TASK 4-4   Desktop — Work Orders
ORDER 19 TASK 4-5   Desktop — Settings (most complex desktop screen)
ORDER 20 TASK 5-*   Spec reconciliation
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Operator decisions delayed | Medium | High — blocks all wizard work | Begin maintenance/carwash/other steps (no ODs) while waiting |
| Migration 070 partially applied (some columns exist) | Low | Low — ADD COLUMN IF NOT EXISTS is idempotent | Safe to re-apply |
| Existing estimates with old part IDs (wf-rear, wf-quarter) | Unknown | Medium — if OD-6 changes IDs, old data breaks | Audit estimates table before renaming IDs |
| PPF 7th size key mismatch causes pricing gaps | Medium | Medium — XL/XXL users get wrong price | OD-15 resolution blocks this |
| Desktop design iterations with Genspark | High | Medium — each screen needs review cycle | Front-load Genspark sessions; do estimates first (highest value) |
| Line message path ambiguity (OD-11) | Low | Medium — LINE send writes to wrong column | Resolve OD-11 before Phase B; in Phase A use individual columns |

---

*GYEON Detailer Agent | PHASE77 — Implementation Readiness | Office AZ | 2026-06-25*  
*Documentation only — no code, no UI, no migrations, no commits.*
