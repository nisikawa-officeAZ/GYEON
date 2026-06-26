# 07 — UI REQUIREMENTS

> Canonical screen set from `gyeon_flow.json` (estimate) and `gyeon_settings_flow.json` (settings). UI must render every canonical screen/step and respect every display condition.

---

## 1. Canonical screen requirements

### 1.1 Estimate screens (13) — see `02_BUSINESS_WORKFLOW.md`
Home → Category select → STEP1 (customer/vehicle) → STEP2 (body size, conditional) → STEP3 (coating, conditional) → STEP4 (options, conditional) → PPF / Window / Maintenance / Car wash / Room clean / Other (each conditional) → STEP5 (confirm/save).
**Display-condition rules** (must be enforced in UI):
- STEP2 shown only if coating OR ppf selected.
- STEP3/STEP4 shown only if coating selected.
- Each category step shown only if its category is selected.
- "Next" button label is dynamic per selected categories.

### 1.2 Settings screens — see `03_SETTINGS_WORKFLOW.md`
Settings hub with **drawer (bottom-sheet) pattern**; groups g1–g7; g5 currently hidden (準備中). Save = "保存する" → toast feedback.

### 1.3 Auth screens
Login / Register / Reset panels (see doc 03 §1).

---

## 2. Device strategy (implementation decision — ratified by operator)

**Separate PC and Mobile UIs** (not responsive). Confirmed working agreement (2026-06-25):
- Shared **engine** (data, pricing, persistence) written once.
- Separate **presentation** per device; device switch at the `lg` (≥1024px) breakpoint.

Current implementation of the switch (home screen): `src/app/page.tsx` renders the PC design (`public/desktop-home.html` via iframe) at `lg`+, and the original mobile tree (`MainLayout`) below `lg`.

---

## 3. UI status (from audit)

| Surface | Mobile | Desktop |
|---------|--------|---------|
| Home / Dashboard | ✅ Complete | 🟡 PC version delivered (needs review) |
| Estimate (wizard) | ✅ Complete | 🔴 Not started |
| Settings | ✅ Complete (12-cat nav) | 🔴 Not started |
| Customers | ✅ Complete | 🔴 Not started |
| Vehicles | ✅ Complete | 🔴 Not started |
| Work Orders / Invoices / Payments / Products / Calendar / Reservations / LINE / Maintenance | ✅ Complete (mobile) | 🔴 Not started |

**Desktop UI = In Progress** (only the top screen exists). **Mobile UI = Complete.**

---

## 4. Design language (carry-over)
Dark navy luxury (`#080d1a`), blue gradient accents (`#2563eb → #1d4ed8`, `#60a5fa`), glass cards (`rgba(255,255,255,0.04)` + blue-tinted border + blur), `GYEON®` wordmark (letter-spacing). The Genspark design is the visual authority; new desktop screens are produced in Genspark and implemented (see `08` §5).

---

## 5. UI requirements summary
1. Every canonical screen and display-condition must be faithfully rendered (estimate + settings + auth).
2. Maintain the **separate PC/mobile** strategy with a shared engine.
3. Roll out desktop versions screen-by-screen (see `10_ROADMAP.md`), preserving mobile untouched per change.
4. Keep brand/design consistency with the Genspark visual authority.
