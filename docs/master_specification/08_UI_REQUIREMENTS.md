# 08 — UI REQUIREMENTS

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Canonical |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | `gyeon_flow.json` (estimate screens), `gyeon_settings_flow.json` (settings screens) |
| **Related Documents** | `03_BUSINESS_WORKFLOW.md`, `04_SETTINGS_WORKFLOW.md`, `07_LINE_REQUIREMENTS.md`, `09_PHASE_STATUS.md`, `11_CANONICAL_RULES.md` |

> Canonical screen set from `gyeon_flow.json` (estimate) and `gyeon_settings_flow.json` (settings). UI must render every canonical screen/step and respect every display condition.

---

## 1. Canonical Screen Requirements

### 1.1 Estimate screens (13) — see `03_BUSINESS_WORKFLOW.md`

Home → Category select → STEP1 (customer/vehicle) → STEP2 (body size, conditional) → STEP3 (coating, conditional) → STEP4 (options, conditional) → PPF / Window / Maintenance / Car wash / Room clean / Other (each conditional) → STEP5 (confirm/save).

**Display-condition rules (must be enforced in UI):**
- STEP2 shown **only if** `coating` OR `ppf` selected.
- STEP3 / STEP4 shown **only if** `coating` selected.
- Each category step shown **only if** its category is selected.
- "Next" button label is dynamic per selected categories.
- Multi-category selection is the primary supported use case; all combinations are valid.

### 1.2 Settings screens — see `04_SETTINGS_WORKFLOW.md`

Settings hub with **drawer (bottom-sheet) pattern**; groups g1–g7; g5 currently hidden (準備中). Save = 「保存する」 → toast feedback. Each drawer item opens by tapping.

### 1.3 Auth screens

Login / Register / Reset panels. See `04_SETTINGS_WORKFLOW.md` §1.

---

## 2. Device Strategy

**Separate PC and Mobile UIs — not responsive CSS.** Ratified working agreement (2026-06-25):
- Shared **engine** (data, pricing, persistence, business logic) written once.
- Separate **presentation** layers per device class.
- Device switch at the **`lg` (≥1024px)** breakpoint.

**Current implementation of the switch (home screen):** `src/app/page.tsx` renders the PC design (`public/desktop-home.html` via iframe) at `lg`+, and the original mobile tree (`MainLayout`) below `lg`.

**Rule:** Mobile screens are **not modified** when adding desktop screens, and vice versa. See `11_CANONICAL_RULES.md` §4.

> ⚠️ **iframe stale-cache risk:** The current PC top screen uses an HTML file served via iframe (`public/desktop-home.html`). This approach cannot display live data (customer counts, estimate totals, reminders) without additional fetch calls from the iframe. Service worker caching may serve a stale version after deploys. Evaluate migration to native React components for screens requiring live data. See `10_ROADMAP.md` Phase D.

---

## 3. UI Status (from Audit)

| Surface | Mobile | Desktop |
|---------|--------|---------|
| Home / Dashboard | ✅ Complete | 🟡 PC version delivered (needs review) |
| Estimate wizard (category select + STEP1–5) | ✅ Complete | 🔴 Not started |
| Estimate wizard (PPF step) | 🟡 Routing only — UI placeholder | 🔴 Not started |
| Estimate wizard (window film step) | 🟡 Routing only — UI placeholder | 🔴 Not started |
| Estimate wizard (maintenance step) | 🟡 Routing only — UI placeholder | 🔴 Not started |
| Estimate wizard (carwash step) | 🟡 Routing only — UI placeholder | 🔴 Not started |
| Estimate wizard (room cleaning step) | 🟡 Routing only — UI placeholder | 🔴 Not started |
| Estimate wizard (other work step) | 🟡 Routing only — UI placeholder | 🔴 Not started |
| Settings (12-category nav) | ✅ Complete | 🔴 Not started |
| Customers | ✅ Complete | 🔴 Not started |
| Vehicles | ✅ Complete | 🔴 Not started |
| Work Orders | ✅ Complete (mobile) | 🔴 Not started |
| Invoices / Payments / Products | ✅ Complete (mobile) | 🔴 Not started |
| Calendar / Reservations | ✅ Complete (mobile) | 🔴 Not started |
| LINE / Maintenance | ✅ Complete (mobile) | 🔴 Not started |

**Desktop UI = In Progress** (only the top screen exists). **Mobile UI = Partially complete.**

> ⚠️ **PLACEHOLDER_SCREENS:** `EstimateWizard.tsx` defines `PLACEHOLDER_SCREENS = ["step-ppf", "step-window", "step-maintenance", "step-carwash", "step-roomclean", "step-other"]`. These 6 steps navigate correctly (routing is wired) but show no category-specific UI fields. The canonical spec in `03_BUSINESS_WORKFLOW.md` §4.5–4.10 describes the full UI that must be built. This is an **Implementation Error (IE)** — the spec is correct, the implementation is incomplete.

### 3a. 13-Screen Implementation Status Table

| # | Canonical screen ID | Canonical label | Mobile status | Desktop status |
|---|--------------------|-----------------|-|--|
| 1 | screen-home | ホーム / トップ | ✅ Complete | 🟡 iframe version |
| 2 | screen-category | カテゴリ選択 | ✅ Complete | 🔴 Not started |
| 3 | screen-step1 | STEP 1 顧客・車両情報 | ✅ Complete | 🔴 Not started |
| 4 | screen-step2 | STEP 2 ボディサイズ (conditional) | ✅ Complete | 🔴 Not started |
| 5 | screen-step3 | STEP 3 コーティング選択 (conditional) | ✅ Complete | 🔴 Not started |
| 6 | screen-step4 | STEP 4 追加オプション (conditional) | ✅ Complete | 🔴 Not started |
| 7 | step-ppf | PPF (conditional) | 🟡 Routing only | 🔴 Not started |
| 8 | step-window | ウィンドウフィルム (conditional) | 🟡 Routing only | 🔴 Not started |
| 9 | step-maintenance | ボディ定期メンテナンス (conditional) | 🟡 Routing only | 🔴 Not started |
| 10 | step-carwash | メンテナンス洗車 (conditional) | 🟡 Routing only | 🔴 Not started |
| 11 | step-roomclean | ルームクリーニング (conditional) | 🟡 Routing only | 🔴 Not started |
| 12 | step-other | その他作業 (conditional) | 🟡 Routing only | 🔴 Not started |
| 13 | screen-step5 | STEP 5 お見積確認 | ✅ Complete (LINE転送 inactive) | 🔴 Not started |

---

## 4. Design Language

All screens must conform to the GYEON design language:

| Element | Value |
|---------|-------|
| Background | `#080d1a` (dark navy luxury) |
| Primary accent | `#2563eb → #1d4ed8` (blue gradient) |
| Highlight | `#60a5fa` |
| Cards | `rgba(255,255,255,0.04)` + blue-tinted border + backdrop blur |
| Brand wordmark | `GYEON®` (letter-spacing applied) |

**Visual authority:** Genspark. New desktop screens are produced in Genspark and implemented into `~/DealerOS`. See `11_CANONICAL_RULES.md` §5.

---

## 5. UI Implementation Rules

1. Every canonical screen and display-condition must be faithfully rendered (estimate + settings + auth).
2. Maintain the **separate PC/mobile** strategy with a shared engine.
3. Roll out desktop versions **screen-by-screen** (see `10_ROADMAP.md` Phase A), preserving mobile untouched per change.
4. Keep brand/design consistency with the Genspark visual authority.
5. For each new desktop screen: produce in Genspark → implement → verify visually on both PC (≥1024px) and mobile (<1024px) → commit.
6. `public/desktop-home.html` (iframe approach) is the current pattern for PC top screen. Evaluate migration to native React components when screens need live data (see `10_ROADMAP.md` Phase D).

---

## 6. Canonical Screens Not Yet in Implementation

| Screen | Status | Notes |
|--------|--------|-------|
| `screen-analytics` | Not implemented | Requires PRO plan (subscription-gated). Out of v1 scope. |
| `screen-step5` → PDF output | ✅ Implemented | `@react-pdf/renderer`, private storage, signed URL |
| `screen-step5` → LINE transfer | 🟡 Code complete | Needs LINE credentials to activate |

---

## 7. Accessibility & Performance Notes

- PWA installable on iOS and Android (no app store required).
- PDFs generated server-side; render correctly on desktop and mobile browsers.
- Service worker active — manage stale cache on deploys (Phase D hardening item).
