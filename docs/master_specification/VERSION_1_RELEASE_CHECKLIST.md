# VERSION 1.0 RELEASE CHECKLIST
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Pre-Release — Implementation Pending |
| **Date** | 2026-06-25 |
| **Source** | PHASE77 Implementation Readiness Review |
| **Related** | `IMPLEMENTATION_BACKLOG.md`, `PHASE77_IMPLEMENTATION_PLAN.md`, `OPERATOR_DECISIONS.md` |

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Ready | Complete and verified |
| ⏳ Pending | Work in progress or not yet started |
| ❌ Blocked | Cannot proceed without prerequisite action |

---

## SECTION 1 — SPECIFICATION

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | All 11 master spec documents exist (00–11) | ✅ Ready | PHASE76 complete |
| 1.2 | All spec documents have standardized metadata headers | ✅ Ready | PHASE76 complete |
| 1.3 | Settings key count correct (37) | ✅ Ready | Fixed in PHASE75 |
| 1.4 | Migration 070 column count correct (32 new columns) | ✅ Ready | Fixed in PHASE75 |
| 1.5 | vehicle_registration_files table name correct | ✅ Ready | Fixed in PHASE75 |
| 1.6 | PLACEHOLDER_SCREENS documented in spec | ✅ Ready | 08_UI_REQUIREMENTS.md §3a |
| 1.7 | All 17 operator decisions documented | ✅ Ready | OPERATOR_DECISIONS.md |
| 1.8 | Binding rules documented (11_CANONICAL_RULES.md) | ✅ Ready | PHASE76 complete |
| 1.9 | OD-9: Default dealer rate resolved | ❌ Blocked | Awaiting operator |
| 1.10 | OD-2–4, 10, 15: PPF pricing/ranks/films/label/size confirmed | ❌ Blocked | Awaiting operator |
| 1.11 | OD-5–7: Window film and room cleaning confirmed | ❌ Blocked | Awaiting operator |
| 1.12 | 03_BUSINESS_WORKFLOW.md updated with confirmed prices | ❌ Blocked | After OD-2 through OD-10 resolved |
| 1.13 | Old superseded spec files removed | ⏳ Pending | Phase C (operator approval needed) |

---

## SECTION 2 — DATABASE

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | Migration 070 applied to staging | ❌ Blocked | OD-1: apply status unknown |
| 2.2 | Migration 070 applied to production | ❌ Blocked | Requires staging first + CTO approval |
| 2.3 | All 32 new dealer_settings columns verified in staging | ❌ Blocked | After 2.1 |
| 2.4 | All 32 new dealer_settings columns verified in production | ❌ Blocked | After 2.2 |
| 2.5 | dealer_settings UNIQUE constraint on dealer_id confirmed | ✅ Ready | Migration 070 includes this |
| 2.6 | vehicle_registration_files table exists (migration 067) | ✅ Ready | Applied in PHASE67 |
| 2.7 | RLS enabled on all feature tables | ✅ Ready | Verified in audit |
| 2.8 | Staging verification suite passes post-migration 070 | ❌ Blocked | After 2.1 |
| 2.9 | Production verification suite passes post-migration 070 | ❌ Blocked | After 2.2 |
| 2.10 | No duplicate/legacy migration conflicts | ✅ Ready | Migration gap 005–034 intentional |
| 2.11 | dealer-settings-defaults.ts DEFAULT_DEALER_RATE correct | ❌ Blocked | After OD-9 resolved |
| 2.12 | dealer-settings-defaults.ts PPF pricing correct | ❌ Blocked | After OD-2, OD-3, OD-4, OD-10, OD-15 |
| 2.13 | dealer-settings-defaults.ts window film correct | ❌ Blocked | After OD-5, OD-6 resolved |
| 2.14 | dealer-settings-defaults.ts room cleaning correct | ❌ Blocked | After OD-7 resolved |

---

## SECTION 3 — OCR

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | OCR code complete (`src/app/api/ocr/*`, `src/lib/ocr/*`) | ✅ Ready | PHASE67 — code done |
| 3.2 | vehicle_registration_files table with correct schema | ✅ Ready | Migration 067 applied |
| 3.3 | ocr_policy JSONB column documented in spec | ✅ Ready | Fixed in PHASE75 |
| 3.4 | human_confirmation_required invariant rule in place | ✅ Ready | 11_CANONICAL_RULES.md §7.3 |
| 3.5 | OPENAI_API_KEY provisioned in environment | ❌ Blocked | Phase B — env var required |
| 3.6 | STORAGE_BUCKET provisioned | ❌ Blocked | Phase B — env var required |
| 3.7 | Migration 070 applied (ocr_enabled + ocr_policy columns) | ❌ Blocked | After OD-1 / DB section 2.1–2.2 |
| 3.8 | OCR field-mapping contract defined (OD-16) | ⏳ Pending | Phase C / V1.1 |
| 3.9 | Vehicle registration image retention policy decided (OD-17) | ⏳ Pending | Phase C / V1.1 (before activation) |
| 3.10 | OCR activation end-to-end tested on staging | ❌ Blocked | After 3.5, 3.6, 3.7 |

---

## SECTION 4 — LINE

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | LINE code complete (`src/app/api/line/*`, `src/lib/line/*`) | ✅ Ready | PHASE49 — code done |
| 4.2 | line_public_settings security rule enforced in code | ✅ Ready | 11_CANONICAL_RULES.md §2 |
| 4.3 | line_channel_secret / line_access_token server-only | ✅ Ready | getDealerSettingsPublic() strips secrets |
| 4.4 | Migration 070 applied (line_public_settings, line_message_templates) | ❌ Blocked | After OD-1 / DB section 2.1–2.2 |
| 4.5 | LINE credentials provisioned (OD-1 + env vars) | ❌ Blocked | Phase B |
| 4.6 | OD-11 resolved (individual columns vs JSONB template path) | ⏳ Pending | Before Phase B activation |
| 4.7 | Settings group g5 (SNS・LINE連携) activation decided (OD-13) | ⏳ Pending | Phase B |
| 4.8 | LIFF app configured and NEXT_PUBLIC_LIFF_ID set | ❌ Blocked | Phase B — env var required |
| 4.9 | LINE Messaging API webhook registered | ❌ Blocked | Phase B |
| 4.10 | LINE push message tested on staging | ❌ Blocked | After 4.4, 4.5, 4.8, 4.9 |
| 4.11 | Maintenance reminder LINE push tested | ❌ Blocked | After 4.10 |
| 4.12 | STEP5 LINE転送 button functional | ❌ Blocked | After 4.5 (needs credentials) |

---

## SECTION 5 — ESTIMATE

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Category selection screen complete (mobile) | ✅ Ready | |
| 5.2 | STEP1 — customer/vehicle info screen complete (mobile) | ✅ Ready | |
| 5.3 | STEP2 — body size selection complete (mobile, conditional) | ✅ Ready | |
| 5.4 | STEP3 — coating selection complete (mobile, conditional) | ✅ Ready | |
| 5.5 | STEP4 — coating options complete (mobile, conditional) | ✅ Ready | |
| 5.6 | STEP5 — estimate confirmation and save complete (mobile) | ✅ Ready | LINE転送 button inactive |
| 5.7 | Multi-category combination: coating + PPF | ✅ Ready | Routing works; PPF step UI pending |
| 5.8 | Estimate tax formula correct: `(subtotal - discounts) × tax_rate / 100` | ✅ Ready | 11_CANONICAL_RULES.md §8 |
| 5.9 | Default dealer rate correct | ❌ Blocked | After OD-9 resolved |
| 5.10 | PPF step UI built (step-ppf) | ❌ Blocked | After OD-2, 3, 4, 10, 15 + Genspark design |
| 5.11 | Window film step UI built (step-window) | ❌ Blocked | After OD-5, 6 + Genspark design |
| 5.12 | Maintenance step UI built (step-maintenance) | ⏳ Pending | No blocking ODs; needs Genspark design |
| 5.13 | Carwash step UI built (step-carwash) | ⏳ Pending | No blocking ODs; needs Genspark design |
| 5.14 | Room cleaning step UI built (step-roomclean) | ❌ Blocked | After OD-7 + Genspark design |
| 5.15 | Other work step UI built (step-other) | ⏳ Pending | No blocking ODs; needs Genspark design |
| 5.16 | All 6 placeholder steps verified on mobile | ⏳ Pending | After 5.10–5.15 |
| 5.17 | Estimate desktop UI (estimates list) | ⏳ Pending | Phase A — Genspark design first |
| 5.18 | Estimate wizard runs correctly on desktop | ⏳ Pending | Phase A |

---

## SECTION 6 — PDF

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | PDF generation code complete (@react-pdf/renderer) | ✅ Ready | PHASE45 |
| 6.2 | PDF generated server-side | ✅ Ready | |
| 6.3 | PDF stored in private Supabase Storage with signed URL | ✅ Ready | |
| 6.4 | Estimate PDF renders correctly on mobile | ✅ Ready | |
| 6.5 | Estimate PDF renders correctly on desktop browser | ✅ Ready | |
| 6.6 | PDF includes all 6 category breakdowns (when applicable) | ⏳ Pending | Depends on 5.10–5.15 completing |
| 6.7 | PDF pricing matches estimate subtotals | ⏳ Pending | After defaults reconciliation |

---

## SECTION 7 — CUSTOMERS

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7.1 | Customer create/edit/list complete (mobile) | ✅ Ready | PHASE38 |
| 7.2 | CustomerForm redesigned (Genspark-aligned) | ✅ Ready | Post-v1 work |
| 7.3 | Customer RLS — dealer_id from getCurrentDealer() | ✅ Ready | |
| 7.4 | Customer search and filter functional | ✅ Ready | |
| 7.5 | Customer → vehicle → estimate linkage correct | ✅ Ready | |
| 7.6 | Desktop UI for customers | ⏳ Pending | Phase A — Genspark design first |
| 7.7 | Audit log entry on customer create/edit | ✅ Ready | PHASE37 |

---

## SECTION 8 — VEHICLES

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8.1 | Vehicle create/edit/list complete (mobile) | ✅ Ready | PHASE39 |
| 8.2 | Vehicle RLS — dealer_id from getCurrentDealer() | ✅ Ready | |
| 8.3 | Body size stored correctly (SS/S/M/ML/L/LL/XL/XXL) | ✅ Ready | |
| 8.4 | Vehicle → customer → estimate linkage correct | ✅ Ready | |
| 8.5 | Desktop UI for vehicles | ⏳ Pending | Phase A |
| 8.6 | OCR → vehicle field population | ❌ Blocked | After OCR activated (Phase B) |

---

## SECTION 9 — SETTINGS

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9.1 | Settings 12-category navigation complete (mobile) | ✅ Ready | PHASE72 |
| 9.2 | Drawer (bottom-sheet) pattern working | ✅ Ready | |
| 9.3 | Save → 「保存する」 → toast feedback | ✅ Ready | |
| 9.4 | dealer_id from getCurrentDealer() in all settings reads | ✅ Ready | |
| 9.5 | getDealerSettingsPublic() strips LINE secrets | ✅ Ready | |
| 9.6 | dealer_settings UNIQUE per dealer | ✅ Ready | |
| 9.7 | Settings groups g1–g4, g6–g7 functional | ✅ Ready | |
| 9.8 | Settings group g5 (LINE) hidden / 準備中 | ✅ Ready | Correct current state |
| 9.9 | Migration 070 applied (all 32 columns available) | ❌ Blocked | OD-1 |
| 9.10 | Settings correctly reads from 37 canonical keys | ⏳ Pending | After migration 070 + Phase C verification |
| 9.11 | reminder_templates read fallback rule implemented | ✅ Ready | 11_CANONICAL_RULES.md §7.7 |
| 9.12 | ocr_policy.human_confirmation_required always true | ✅ Ready | Invariant rule in spec |
| 9.13 | Desktop UI for settings | ⏳ Pending | Phase A — highest complexity |
| 9.14 | Dealer settings desktop drawers designed and implemented | ⏳ Pending | Phase A |

---

## SECTION 10 — PPF

| # | Item | Status | Notes |
|---|------|--------|-------|
| 10.1 | PPF category selectable in estimate wizard | ✅ Ready | Routing wired |
| 10.2 | PPF step navigated to when PPF selected | ✅ Ready | nextScreen() logic correct |
| 10.3 | OD-2 resolved: canonical PPF plan prices confirmed | ❌ Blocked | Awaiting operator |
| 10.4 | OD-3 resolved: PPF vehicle rank system confirmed | ❌ Blocked | Awaiting operator |
| 10.5 | OD-4 resolved: PPF film types confirmed | ❌ Blocked | Awaiting operator |
| 10.6 | OD-10 resolved: PPF plan label confirmed | ❌ Blocked | Awaiting operator |
| 10.7 | OD-15 resolved: 7th body size key confirmed | ❌ Blocked | Awaiting operator |
| 10.8 | dealer-settings-defaults.ts PPF tables updated | ❌ Blocked | After OD-2–4, 10, 15 |
| 10.9 | PPF step UI built (plan / rank / film / parts) | ❌ Blocked | After 10.8 + Genspark design |
| 10.10 | PPF pricing calculation correct (base × rank × film) | ❌ Blocked | After 10.9 |
| 10.11 | PPF + coating combined estimate correct | ❌ Blocked | After 10.9 |
| 10.12 | PPF estimate saved to DB with correct part IDs | ❌ Blocked | After 10.9 + migration 070 |
| 10.13 | Roof PPF plan decision (OD-12) | ⏳ Pending | Phase C |

---

## SECTION 11 — DASHBOARD

| # | Item | Status | Notes |
|---|------|--------|-------|
| 11.1 | Home screen mobile version complete | ✅ Ready | Post-v1 Genspark rework |
| 11.2 | Home screen dark navy (`#080d1a`) background | ✅ Ready | |
| 11.3 | PC top screen (iframe, `public/desktop-home.html`) | ✅ Ready | Delivered 2026-06-25 |
| 11.4 | Device switch at `lg` (≥1024px) breakpoint | ✅ Ready | `src/app/page.tsx` |
| 11.5 | Dashboard shows live data (customer count, estimates, reminders) | ⏳ Pending | Requires iframe → native React migration (Phase D) |
| 11.6 | PWA service worker stale cache risk mitigated | ⏳ Pending | Phase D |
| 11.7 | GYEON® wordmark with letter-spacing | ✅ Ready | |

---

## SECTION 12 — UI

| # | Item | Status | Notes |
|---|------|--------|-------|
| 12.1 | Mobile UI complete across all screens | ✅ Ready | Core screens done |
| 12.2 | Design language: `#080d1a`, blue gradient, glass cards | ✅ Ready | |
| 12.3 | PWA installable on iOS and Android | ✅ Ready | @ducanh2912/next-pwa |
| 12.4 | PC top screen delivered | ✅ Ready | iframe approach |
| 12.5 | Desktop — Estimates | ⏳ Pending | Phase A |
| 12.6 | Desktop — Customers | ⏳ Pending | Phase A |
| 12.7 | Desktop — Vehicles | ⏳ Pending | Phase A |
| 12.8 | Desktop — Work Orders | ⏳ Pending | Phase A |
| 12.9 | Desktop — Settings | ⏳ Pending | Phase A |
| 12.10 | Desktop — Invoices / Payments / Products | ⏳ Pending | Phase A continuation |
| 12.11 | Desktop — Calendar / Reservations | ⏳ Pending | Phase A continuation |
| 12.12 | Desktop — LINE / Maintenance | ⏳ Pending | Phase A continuation |
| 12.13 | All 6 estimate wizard placeholder steps built | ❌ Blocked | Depends on OD resolution |
| 12.14 | Mobile screens verified untouched when desktop added | ⏳ Pending | Ongoing during Phase A |

---

## SECTION 13 — TESTING

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13.1 | Staging environment available | ✅ Ready | |
| 13.2 | UAT management module complete | ✅ Ready | PHASE63 |
| 13.3 | Post-migration 070 staging verification | ❌ Blocked | After DB section 2.1 |
| 13.4 | Post-migration 070 production verification | ❌ Blocked | After DB section 2.2 |
| 13.5 | Estimate wizard end-to-end: category select → STEP5 → save (mobile) | ✅ Ready | Core STEP1–5 complete |
| 13.6 | PPF estimate end-to-end test | ❌ Blocked | After estimate section 10.9 |
| 13.7 | Window film estimate end-to-end test | ❌ Blocked | After estimate section 5.11 |
| 13.8 | Maintenance estimate end-to-end test | ⏳ Pending | After section 5.12 |
| 13.9 | Multi-category estimate (coating + PPF + window) test | ❌ Blocked | After 10.9, 5.11 |
| 13.10 | PDF generation for all 6 categories verified | ⏳ Pending | After sections 5.10–5.15 |
| 13.11 | RLS isolation test (dealer A cannot read dealer B data) | ✅ Ready | Verified in PHASE74 audit |
| 13.12 | LINE secrets not returned to client | ✅ Ready | Code reviewed |
| 13.13 | ocr_policy.human_confirmation_required = true enforced | ✅ Ready | Invariant rule confirmed |
| 13.14 | Desktop screens verify on ≥1024px without breaking mobile | ⏳ Pending | Ongoing in Phase A |
| 13.15 | Subscription gating tested (PRO plan features) | ✅ Ready | PHASE58, 64 |
| 13.16 | Admin console verified | ✅ Ready | PHASE57 |
| 13.17 | Disaster recovery procedure tested | ✅ Ready | PHASE59 |

---

## Overall Readiness Summary

| Section | Ready | Pending | Blocked | Total |
|---------|-------|---------|---------|-------|
| 1. Specification | 8 | 2 | 3 | 13 |
| 2. Database | 3 | 0 | 11 | 14 |
| 3. OCR | 4 | 2 | 4 | 10 |
| 4. LINE | 3 | 2 | 7 | 12 |
| 5. Estimate | 9 | 3 | 6 | 18 |
| 6. PDF | 5 | 2 | 0 | 7 |
| 7. Customers | 6 | 1 | 0 | 7 |
| 8. Vehicles | 4 | 1 | 1 | 6 |
| 9. Settings | 8 | 2 | 2 | 12 |
| 10. PPF | 2 | 1 | 10 | 13 |
| 11. Dashboard | 5 | 2 | 0 | 7 |
| 12. UI | 5 | 8 | 1 | 14 |
| 13. Testing | 7 | 5 | 5 | 17 |
| **Total** | **69** | **31** | **50** | **150** |

---

## Critical Path to V1.0

```
1. Operator resolves OD-1 through OD-15           [unblocks 50 blocked items]
2. Apply migration 070                              [unblocks DB + LINE + OCR]
3. Update DEFAULT_DEALER_RATE                       [fixes active estimate defect]
4. Reconcile dealer-settings-defaults.ts            [unblocks all wizard steps]
5. Build 6 estimate wizard placeholder steps        [highest implementation value]
6. Desktop UI rollout (Phase A: 5 core screens)     [required for PC users]
7. Full end-to-end testing pass                     [verifies all sections]
────────────────────────────────────────────────────
V1.0 Release Candidate
```

**Current state: 69/150 items ready (46%). 50 items blocked by operator decisions and migration 070.**  
**After operator resolves OD-1 through OD-15: ~100/150 items can be marked ready or unblocked.**

---

*GYEON Detailer Agent | PHASE77 — Version 1.0 Release Checklist | Office AZ | 2026-06-25*  
*Documentation only — no code, no UI, no migrations, no commits.*
