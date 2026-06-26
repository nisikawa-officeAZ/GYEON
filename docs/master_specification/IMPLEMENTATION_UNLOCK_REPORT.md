# IMPLEMENTATION UNLOCK REPORT
## GYEON Detailer Agent — PHASE78

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Pre-Implementation — Awaiting Operator Decisions |
| **Date** | 2026-06-25 |
| **Source** | IMPLEMENTATION_BACKLOG.md, PHASE77_IMPLEMENTATION_PLAN.md, OPERATOR_DECISIONS.md |
| **Related** | `OPERATOR_DECISION_WORKBOOK.md`, `VERSION1_READINESS_SUMMARY.md` |

> This report shows exactly which implementation tasks are unlocked when each Operator Decision is resolved.
> Tasks listed as "Immediate" can begin within 24 hours of the decision being made.
> Tasks listed as "Enabled" require the decision plus additional work before starting.

---

## Reading Guide

```
OD-N resolved
└─ IMMEDIATE → tasks that can start right away
└─ ENABLES   → tasks that become possible (may have other dependencies too)
└─ UNBLOCKS  → checklist items that move from ❌ Blocked to ⏳ Pending
```

---

## OD-1 — Migration 070 Apply Status

**Resolves:** Database foundation uncertainty  
**Decision time:** ~5 minutes

```
OD-1 resolved (migration 070 applied to staging)
│
├── IMMEDIATE → Staging verification run
│   └── Verify all 32 new dealer_settings columns exist
│   └── Re-run staging test suite
│
├── ENABLES (after staging verified)
│   └── Apply migration 070 to production
│   └── Begin Phase B preparation
│
├── UNBLOCKS (checklist items DB section)
│   └── DB-2.1  Migration 070 applied to staging          ❌ → ✅
│   └── DB-2.2  Migration 070 applied to production        ❌ → ✅
│   └── DB-2.3  32 new columns verified (staging)         ❌ → ✅
│   └── DB-2.4  32 new columns verified (production)      ❌ → ✅
│   └── DB-2.8  Staging verification passes               ❌ → ✅
│   └── DB-2.9  Production verification passes            ❌ → ✅
│
├── UNBLOCKS (settings section)
│   └── S-9.9   Settings reads from 32 extension columns  ❌ → ⏳
│
├── UNBLOCKS (LINE section — partial; OD-11 + env vars also needed)
│   └── L-4.4   line_public_settings column available     ❌ → ⏳
│   └── L-4.4   line_message_templates column available   ❌ → ⏳
│
├── UNBLOCKS (OCR section — partial; env vars also needed)
│   └── O-3.7   ocr_enabled + ocr_policy columns exist   ❌ → ⏳
│
└── DOWNSTREAM GATE
    └── All Phase B (LINE + OCR activation) requires OD-1 complete
```

**Total items unlocked: 10**

---

## OD-9 — Default Dealer Trade Rate

**Resolves:** Active production defect — ALL estimates currently discounted  
**Decision time:** ~2 minutes  
**⚠️ HIGHEST URGENCY — affects production quotes right now**

```
OD-9 resolved (dealer rate confirmed — recommended: 100%)
│
├── IMMEDIATE → Update dealer-settings-defaults.ts DEFAULT_DEALER_RATE
│   └── Single constant change: DEFAULT_DEALER_RATE = 1.0 (or confirmed value)
│   └── Verify: create test estimate, confirm rate applied
│   └── Commit fix
│
├── UNBLOCKS (estimate section)
│   └── E-5.9   Default dealer rate correct               ❌ → ✅
│
└── NOTE
    └── This fix resolves an active production defect.
    └── No other OD dependencies — can be done immediately after OD-9 decision.
```

**Total items unlocked: 1 (but fixes production defect)**

---

## OD-2 + OD-3 + OD-4 + OD-10 + OD-15 — PPF Pricing Package

**Note:** These 5 ODs must be resolved together before PPF implementation begins. Resolving any subset is insufficient to start building the PPF wizard step.

**Decision time:** ~40 minutes (combined review session)

```
OD-2 (prices) + OD-3 (ranks) + OD-4 (films) + OD-10 (label) + OD-15 (size key) ALL resolved
│
├── IMMEDIATE → Update dealer-settings-defaults.ts PPF tables
│   ├── ppf_price_tables.plan_prices  (all 7 or 8 body sizes)
│   ├── ppf_price_tables.rank_coeff   (3 or 4 ranks)
│   ├── ppf_price_tables.film_coeff   (confirmed film set)
│   └── PPF plan front-half label     (フロントフル or フロントハーフ)
│
├── ENABLES (after defaults.ts updated + Genspark design ready)
│   └── Build step-ppf UI (TASK 3-1)
│       ├── Plan selection UI (front-half / full-body / partial)
│       ├── Rank selection UI (confirmed ranks + coefficients)
│       ├── Film type selection UI (confirmed films)
│       ├── Partial coverage parts checkboxes
│       └── PPF subtotal calculation
│
├── ENABLES (after step-ppf built)
│   └── PPF + coating combined estimate
│   └── PPF estimate save to DB with correct part IDs
│
├── UNBLOCKS (PPF section)
│   └── P-10.3  PPF prices confirmed                     ❌ → ✅
│   └── P-10.4  PPF ranks confirmed                      ❌ → ✅
│   └── P-10.5  PPF films confirmed                      ❌ → ✅
│   └── P-10.6  PPF label confirmed                      ❌ → ✅
│   └── P-10.7  7th size key confirmed                   ❌ → ✅
│   └── P-10.8  dealer-settings-defaults.ts PPF updated  ❌ → ⏳
│   └── P-10.9  PPF step UI built                        ❌ → ⏳
│   └── P-10.10 PPF pricing calculation correct          ❌ → ⏳
│   └── P-10.11 PPF + coating combined estimate          ❌ → ⏳
│   └── P-10.12 PPF estimate saved to DB                 ❌ → ⏳
│
├── UNBLOCKS (database section)
│   └── DB-2.12 dealer-settings-defaults.ts PPF correct  ❌ → ⏳
│
├── UNBLOCKS (estimate section)
│   └── E-5.10  PPF step UI built                        ❌ → ⏳
│
└── UNBLOCKS (testing section)
    └── T-13.6  PPF estimate end-to-end test             ❌ → ⏳
    └── T-13.9  Multi-category estimate test             ❌ → ⏳ (partial — also needs OD-5,6)
```

**Total items unlocked: 15**

---

## OD-5 + OD-6 — Window Film Package

**Decision time:** ~25 minutes (combined review session)

```
OD-5 (grades) + OD-6 (part IDs) resolved
│
├── IMMEDIATE → Update dealer-settings-defaults.ts window film
│   ├── service_price_settings.window_film.grades  (confirmed grades + coefficients)
│   └── service_price_settings.window_film.parts   (confirmed part IDs + prices)
│
├── PRE-BUILD CHECK
│   └── If OD-6 changes part IDs (wf-rear → wf-rear-glass etc.):
│       └── Audit estimates table for existing window film estimates
│       └── If any exist with old IDs: run data fix script before renaming
│
├── ENABLES (after defaults.ts updated + Genspark design ready)
│   └── Build step-window UI (TASK 3-2)
│       ├── Grade selection (confirmed grades)
│       ├── Part checkboxes (confirmed parts)
│       └── Window film subtotal calculation
│
├── UNBLOCKS (estimate section)
│   └── E-5.11  Window film step UI built                ❌ → ⏳
│
├── UNBLOCKS (database section)
│   └── DB-2.13 Window film defaults correct             ❌ → ⏳
│
└── UNBLOCKS (testing section)
    └── T-13.7  Window film end-to-end test              ❌ → ⏳
    └── T-13.9  Multi-category estimate test             ❌ → ⏳ (partial — also needs OD-2–4)
```

**Total items unlocked: 6**

---

## OD-7 — Room Cleaning Package

**Decision time:** ~15 minutes

```
OD-7 (parts and prices) resolved
│
├── IMMEDIATE → Update dealer-settings-defaults.ts room cleaning
│   ├── Add rc-door (if choice A or D)
│   ├── Add rc-trunk (if choice A or D)
│   ├── Correct rc-seat, rc-ceiling, rc-dash prices
│   └── Remove or keep rc-full (based on decision)
│
├── ENABLES (after defaults.ts updated + Genspark design ready)
│   └── Build step-roomclean UI (TASK 3-5)
│       ├── Part checkboxes (confirmed parts)
│       └── Room cleaning subtotal calculation
│
├── UNBLOCKS (estimate section)
│   └── E-5.14  Room cleaning step UI built              ❌ → ⏳
│
└── UNBLOCKS (database section)
    └── DB-2.14 Room cleaning defaults correct           ❌ → ⏳
```

**Total items unlocked: 3**

---

## No OD Required — Immediately Available Tasks

**These tasks have no blocking Operator Decisions. They can begin now.**

```
No OD required
│
├── IMMEDIATE → Maintenance step UI (step-maintenance)
│   └── Build step-maintenance UI (TASK 3-3)
│       ├── Maintenance menus match JSON and defaults.ts
│       └── No pricing divergence
│
├── IMMEDIATE → Carwash step UI (step-carwash)
│   └── Build step-carwash UI (TASK 3-4)
│       └── Simple plan selection; no pricing conflicts
│
├── IMMEDIATE → Other work step UI (step-other)
│   └── Build step-other UI (TASK 3-6)
│       └── Free-form entry; no canonical data needed
│
├── IMMEDIATE → Desktop UI design sessions with Genspark
│   └── Estimates list (TASK 4-1) — design can start while ODs being resolved
│   └── Customers (TASK 4-2)
│   └── Vehicles (TASK 4-3)
│   └── Work Orders (TASK 4-4)
│
└── IMMEDIATE → Spec documentation cleanup
    └── Fix 01_PROJECT_OVERVIEW.md (old file notice, repo URL)
    └── Fix 02_SYSTEM_ARCHITECTURE.md (RTO/RPO labels, LIFF note)
```

**Immediately available implementation tasks: 3 wizard steps + 4 desktop Genspark sessions + spec cleanup**

---

## OD-11 — LINE Message Path

**Note:** LINE is inactive. Resolving this is required before Phase B, not V1.0.

```
OD-11 resolved (individual columns vs JSONB)
│
├── ENABLES (Phase B only)
│   └── LINE send functions read from confirmed column path
│   └── g5 settings UI writes to confirmed column path
│
└── UNBLOCKS (LINE section)
    └── L-4.6  OD-11 resolved                           ⏳ → ✅
```

---

## OD-13 — g5 Activation Timing

```
OD-13 resolved (Phase B recommended)
│
├── ENABLES (Phase B only)
│   └── Make g5 settings group visible when LINE credentials present
│   └── Design g5 settings drawer (Genspark)
│
└── UNBLOCKS (settings section)
    └── S-9.8  g5 hidden state confirmed                ⏳ → Plan defined
```

---

## Cumulative Unlock Summary

| Decision(s) | Items Unlocked | Effort Required |
|-------------|---------------|----------------|
| OD-9 alone | 1 + fixes production defect | 2-min decision + 5-min code fix |
| OD-1 alone | 10 | 5-min decision + staging apply |
| OD-9 + OD-1 | 11 | First 2 decisions — highest ROI |
| OD-2+3+4+10+15 | 15 | 40-min session — unlocks PPF build |
| OD-5+6 | 6 | 25-min session — unlocks window build |
| OD-7 | 3 | 15-min session — unlocks room clean build |
| All Category A (10 ODs) | **~50** | ~2 hour session total |
| All 17 ODs | All | Clears all blocks |

---

## Critical Path Visualization

```
TODAY
  │
  ├─ OD-9 decided (2 min) ──────────────────────────────────► DEFAULT_DEALER_RATE fixed
  │
  ├─ OD-1 decided (5 min) ──────────────────────────────────► Migration 070 applied
  │                                                             DB foundation ready
  │
  ├─ Maintenance step (no OD needed) ───────────────────────► step-maintenance built
  ├─ Carwash step (no OD needed) ───────────────────────────► step-carwash built
  ├─ Other work step (no OD needed) ────────────────────────► step-other built
  │
  ├─ OD-2+3+4+10+15 decided (40 min) ──────────────────────► PPF defaults updated
  │                                                             ► step-ppf buildable
  │
  ├─ OD-5+6 decided (25 min) ──────────────────────────────► Window film defaults updated
  │                                                             ► step-window buildable
  │
  ├─ OD-7 decided (15 min) ────────────────────────────────► Room clean defaults updated
  │                                                             ► step-roomclean buildable
  │
  ├─ Genspark design sessions (parallel to above) ─────────► Desktop UI designs ready
  │
  └─ All step UIs built + Desktop designs ready
       │
       └─────────────────────────────────────────────────────► V1.0 RELEASE CANDIDATE
```

---

*GYEON Detailer Agent | PHASE78 — Implementation Unlock Report | Office AZ | 2026-06-25*  
*Documentation only — no code, no UI, no migrations, no commits.*
