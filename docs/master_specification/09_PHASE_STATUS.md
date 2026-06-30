# 09 — PHASE STATUS

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Active — Living Document (updated each phase) |
| **Last Updated** | 2026-06-30 |
| **Canonical Source** | `CHANGELOG.md`, git history, project audit (PHASE74/75) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `10_ROADMAP.md`, `OPERATOR_DECISIONS.md` |

> Sources: `CHANGELOG.md` (through PHASE65), git history (through PHASE73 + recent UI work), and the 2026-06-25 project audit (PHASE74/75).

---

## STATUS LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ Completed | Code complete, tested, committed |
| 📄 Documentation Complete | Spec written; implementation pending or not required |
| 🟡 Implementation Pending | Spec correct; code started but incomplete |
| 🔴 Future Phase | Not yet started; planned in roadmap |
| 🟠 Operator Decision | Cannot proceed without business decision |
| ⏳ Awaiting | External dependency (env vars, CTO approval, etc.) |

---

## 1. Completed Phases

### Documented in CHANGELOG (PHASE35–65) — all ✅

| Range | Scope |
|-------|-------|
| 35–40 | Core schema: customers, vehicles, dealers, audit |
| 41 | Authentication (Supabase Auth + middleware) |
| 42 | Onboarding (5-step wizard) |
| 43 | Staff management (roles) |
| 44 | Settings |
| 45–46 | PDF generation + document storage |
| 47–48 | Calendar + notifications |
| 49–50 | LINE CRM + reservations |
| 51–52 | Maintenance scheduler + products/services |
| 53–54 | Estimate & product orders + work order/completion report |
| 55–56 | Invoices + payments |
| 57–59 | Admin console + subscriptions + disaster recovery |
| 60–61 | Production readiness + migration status |
| 62–63 | Staging verification + UAT |
| 64–65 | Commercial billing + Release Candidate (RC1) |

### In git history but not in CHANGELOG — ✅ (undocumented)

| Phase | Scope |
|-------|-------|
| 66–69 | Settings category navigation; dealer_settings read layer; EstimateWizard canonical gap fix |
| 70–71 | `dealer_settings` canonical schema consolidation (migration 070 + TypeScript types) |
| 72 | Settings icon navigation UI |
| 73 | Home screen premium visual restoration |

### Post-phase work (unnumbered) — ✅

- Genspark-style home rewrite + background unification (`#080d1a`).
- CustomerForm redesign (Genspark-aligned).
- **PC top screen implemented + PC/Mobile device switch** (2026-06-25).
- SDD restructuring: `/docs/master_specification/` created (11 files, 2026-06-25).
- **PHASE74:** Master Specification Audit — `MASTER_SPECIFICATION_AUDIT_REPORT.md` (2026-06-25).
- **PHASE75:** Master Specification Finalization — `OPERATOR_DECISIONS.md`, `MASTER_SPECIFICATION_CHANGELOG.md`, `MASTER_SPECIFICATION_V1_READY.md`, spec file updates (2026-06-25).

---

## 1b. Phase 2 — Customer & Vehicle Registration

### Sprint 1 — Customer & Vehicle Registration Foundation — ✅ Completed (2026-06-30)

| Item | Status |
|------|--------|
| Completed | ✅ |
| Committed | ✅ `feat: phase2 sprint1 customer vehicle registration foundation` (74fec20) |
| Pushed | ✅ feature branch `fix/branding-schema-block` (not merged to main) |
| Typecheck | ✅ `npm run typecheck` passed |
| Build | ✅ `npm run build` passed |
| Sprint 2 | 🔴 Not started |

**Summary:**
- Customer duplicate detection helper implemented (`src/lib/customers/find-customer-duplicates.ts`, dealer-scoped).
- Vehicle duplicate detection helper implemented (`src/lib/vehicles/find-vehicle-by-vin-or-plate.ts`, dealer-scoped).
- `register-from-ocr` orchestration implemented (`src/lib/ocr/register-from-ocr.ts`) — creates/reuses customer + linked vehicle and completes the OCR session, composing existing create actions.
- Existing UI wired to the registration flow (`CustomerVehicleOnboardingWizard.tsx`) with non-blocking duplicate warnings; no UI redesign.

Scope guardrails honored: no schema change, no migration, no production deploy, no merge to main. Architecture preserved (dealer_id always from `getCurrentDealer()`; RLS assumptions unchanged).

### Sprint 2 — Customer Management Foundation — ✅ Completed (2026-06-30)

| Item | Status |
|------|--------|
| Completed | ✅ |
| Committed | ✅ `feat: phase2 sprint2 customer management foundation` (493031f) |
| Pushed | ✅ feature branch `fix/branding-schema-block` (not merged to main) |
| Typecheck | ✅ `npm run typecheck` passed |
| Build | ✅ `npm run build` passed |
| Sprint 3 | (superseded — now complete, see below) |

**Summary:** Customer list (functional search + filters + detail navigation), Customer Detail page (`/customers/[id]`), Customer Search (controlled), Customer Filters, Customer Profile editing (reused `CustomerForm`), Customer Timeline (reused `CustomerActivityTimeline`), Customer Notes (`updateCustomerNotes`), derived Customer Status & Tags foundations, and navigation integration. No schema change; status/tags derived from existing columns.

### Sprint 3 — Vehicle Management Foundation — ✅ Completed (2026-06-30)

| Item | Status |
|------|--------|
| Completed | ✅ |
| Committed | ✅ `feat: phase2 sprint3 vehicle management foundation` (6462a99) |
| Pushed | ✅ feature branch `fix/branding-schema-block` (not merged to main) |
| Lint | ✅ no `lint` script / ESLint config in repo (same as Sprints 1–2); not applicable |
| Typecheck | ✅ `npm run typecheck` passed |
| Build | ✅ `npm run build` passed |
| Sprint 4 | 🔴 Not started |

**Completed work:**
- Vehicle List page — functional search + filters + row navigation to detail.
- Vehicle Detail page — `src/app/vehicles/[id]/page.tsx` (dealer-scoped fetch + `notFound`).
- Vehicle Search — controlled `VehicleSearch` (maker / model / plate; space-insensitive).
- Vehicle Filters — `VehicleFilters` (車検: 有効/間近/切れ/未登録; 顧客: 紐付きあり/なし) + shown/total count.
- Vehicle Profile editing — reused `VehicleForm` (edit toggle on detail + list modal).
- Vehicle Status foundation — derived `deriveVehicleStatus` from `inspection_expiry_date` + `VehicleStatusBadge` (read-only).
- Vehicle Tags foundation — derived `deriveVehicleTags` + `VehicleTagList` (read-only).
- Vehicle Service History foundation — `VehicleServiceHistory` via `getActivityLogsByEntity("vehicle", id)`.
- Customer ↔ Vehicle relationship verification — owner resolved via dealer-scoped `getCustomerById`; same-dealer ownership confirmed and linked, mismatch flagged; write paths still validate `customer_id` belongs to the dealer.
- Navigation integration — list → `/vehicles/[id]`; detail → back link + 所有者 link to `/customers/[id]`.

Scope guardrails honored: no schema change, no migration, no production deploy, no merge to main. Sprint 1 OCR registration flow and duplicate-detection logic untouched. Architecture preserved (dealer_id always from `getCurrentDealer()`; RLS assumptions unchanged).

### Sprint 4 — Vehicle Registration OCR & AI Enhancement — ✅ Completed (2026-06-30)

| Item | Status |
|------|--------|
| Completed | ✅ |
| Committed | ✅ `feat: phase2 sprint4 ocr ai enhancement` (5a4937b) |
| Pushed | ✅ feature branch `fix/branding-schema-block` (not merged to main) |
| Lint | N/A — no `lint` script / ESLint config in repo (same as Sprints 1–3) |
| Typecheck | ✅ `npm run typecheck` passed |
| Build | ✅ `npm run build` passed |
| Sprint 5 | 🔴 Not started |

**Completed work:**
- OCR review flow improvements — low-confidence warning + missing important-field summary in `VehicleRegistrationOcrReview` (customer/vehicle shown separately).
- Camera / File selection improvements — clearer selection UI in `VehicleRegistrationUpload`.
- Mobile camera-first behavior — camera capture is the primary action on mobile.
- Desktop upload support — file upload preserved as the primary path on desktop.
- AI field mapping improvements — `mapOcrToVehicle` model now falls back to 型式 when 車名 is absent.
- Missing-field handling — new `ocr-field-analysis.ts` detects important fields the model failed to read.
- Confidence handling — confidence level classification (high/medium/low/none) surfaced in review.
- Duplicate review improvements — confirm step now lists matched customers (name/phone) and vehicles (maker/model + plate/VIN); detection core logic unchanged.
- Preserved register-from-ocr orchestration — `register-from-ocr.ts` untouched.

Scope guardrails honored: no schema change, no migration, no production deploy, no merge to main. OCR/AI output remains fully editable and requires explicit user confirmation before any write. Sprint 1 orchestration + duplicate-detection core preserved. Architecture preserved (dealer_id always from `getCurrentDealer()`; RLS assumptions unchanged).

---

## 2. Current Phase

**PC / Mobile UI Separation — Phase 1 (in progress).**
- ✅ Home/top screen: PC version live, device-switched, mobile untouched, verified, saved.
- 🟡 Remaining screens: still mobile-only on desktop.

---

## 3. Pending Work — Classified

### 3a. Implementation Pending (spec correct; code needed)

| Priority | Item | Status | Notes |
|----------|------|--------|-------|
| 1 | **Desktop UI rollout** — Estimates → Customers → Vehicles → Work Orders → Settings (and remainder) | 🟡 | Phase A in roadmap |
| 2 | **Estimate wizard: 6 placeholder steps** — PPF / window film / maintenance / carwash / room cleaning / other | 🟡 | PLACEHOLDER_SCREENS in EstimateWizard.tsx; spec in `03_BUSINESS_WORKFLOW.md` §4.5–4.10 |

### 3b. Awaiting External Action

| Priority | Item | Status | Notes |
|----------|------|--------|-------|
| 3 | **Apply migration 070** — `070_dealer_settings_canonical.sql` file exists; needs CTO approval + staging | ⏳ | See `OPERATOR_DECISIONS.md` OD-1 |
| 4 | **Environment configuration** — service-role key, storage bucket, OpenAI key, LINE credentials, CRON_SECRET | ⏳ | Phase B activation |
| 5 | **OCR activation** (code-complete; needs `OPENAI_API_KEY` + `STORAGE_BUCKET`) | ⏳ | Phase B |
| 6 | **LINE activation** (code-complete; g5 hidden; needs credentials) | ⏳ | Phase B; also requires migration 070 applied first |

### 3c. Operator Decisions Required

| Priority | Item | Status | Notes |
|----------|------|--------|-------|
| 7 | **17 open operator decisions** — pricing, IDs, grades, rate, version | 🟠 | See `OPERATOR_DECISIONS.md`; OD-1 through OD-17 |
| 8 | **Canonical JSON into repo** — place `gyeon_flow.json` / `gyeon_settings_flow.json` under version control | 🟠 | Phase C; required for SDD enforcement |

### 3d. Documentation / Phase C Tasks

| Priority | Item | Status | Notes |
|----------|------|--------|-------|
| 9 | **Data reconciliation** — `past_histories`, `dealer_statements` (業販) | 🔴 | Phase C |
| 10 | **Verify 37 settings keys covered** in `dealer_settings` schema | 🔴 | Phase C; count is 37 (corrected from earlier "39") |
| 11 | **CHANGELOG update** (PHASE66–73+), migration name fixes, version ratification | 🔴 | Phase C |
| 12 | **Spec reconciliation** — post OD resolution: update 03, 04, 05 with final prices/IDs | 🔴 | Phase C; after all OD items resolved |

---

## 4. Feature Completion Status (v1.0.0)

| # | Feature | Status | Phase | Notes |
|---|---------|--------|-------|-------|
| 1 | Customer Management | ✅ | PHASE38 | |
| 2 | Vehicle Management | ✅ | PHASE39 | |
| 3 | Estimate Builder (routing + STEP1–5) | 🟡 | PHASE53 | Category-specific steps (PPF/window/etc.) are placeholder |
| 4 | PDF Generation | ✅ | PHASE45 | |
| 5 | Work Order Management | ✅ | PHASE54 | |
| 6 | Completion Report | ✅ | PHASE54 | |
| 7 | Invoice Management | ✅ | PHASE55 | |
| 8 | Payment Records | ✅ | PHASE56 | |
| 9 | LINE CRM Integration | 🟡 Code complete — inactive | PHASE49 | Needs credentials (Phase B) |
| 10 | Maintenance Reminder | ✅ | PHASE51 | |
| 11 | Reservation System | ✅ | PHASE50 | |
| 12 | Products & Services | ✅ | PHASE52 | |
| 13 | Subscription Management | ✅ | PHASE58 | |
| 14 | Commercial Billing (manual) | ✅ | PHASE64 | |
| 15 | Audit Log | ✅ | PHASE37 | |
| 16 | Release Readiness | ✅ | PHASE60 | |
| 17 | Disaster Recovery | ✅ | PHASE59 | |
| 18 | Dealer Onboarding | ✅ | PHASE42 | |
| 19 | Admin Console | ✅ | PHASE57 | |
| 20 | UAT Management | ✅ | PHASE63 | |
| 21 | Vehicle Registration OCR | 🟡 Code complete — inactive | PHASE67 | Needs `OPENAI_API_KEY` (Phase B) |

---

## 5. Version Note

`VERSION.md` says **1.0.0 "Official Release"**, while development has continued past it. See `OPERATOR_DECISIONS.md` OD-14 for version track decision (1.0.0 vs 1.1.0-dev).
