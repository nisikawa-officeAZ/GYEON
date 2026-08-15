# 9. UI / UX Specification

| Field | Value |
|-------|-------|
| **Document** | 09 — UI / UX Specification |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `02_SYSTEM_ARCHITECTURE.md`, `06_User_Roles_and_Permissions.md`, `07_Feature_Specifications.md`, `08_API_Architecture.md` |

> This document specifies **approved UI/UX principles, implemented screens, and approved planned screens**. It **does not redesign the UI**, preserve only approved patterns, and does not duplicate API (`08_API_Architecture.md`) or database (`04_Database_Architecture.md`) definitions. Each screen/area is tagged **Implemented**, **Planned**, or **Future**.

**Status legend:** **Implemented** = present in the current build · **Planned** = approved, partial/scheduled · **Future** = approved direction, not built.

---

## 9.1 Purpose

To define the platform's UI/UX conventions and the per-screen experience at a specification level, so that implementation remains consistent and existing UI is preserved rather than redesigned.

## 9.2 UI Philosophy

- **Preserve the existing UI.** No redesign of approved screens; changes are additive and consistent with current patterns.
- Mobile-first PWA with a dedicated desktop (PC) presentation; one shared data/business-logic engine (`02_SYSTEM_ARCHITECTURE.md` §2.4).
- Dark, card-based visual system already established in the app; new UI reuses existing components and styles rather than introducing new visual languages.

## 9.3 UX Principles

1. Clarity over density; primary actions are obvious and reachable.
2. Consistency: reuse existing components (tables, forms, modals, badges, page titles).
3. Human-in-the-loop for AI/OCR — review and edit before any save.
4. Safe by default — no destructive actions without confirmation; soft-delete preferred.
5. Permission-aware UI — controls reflect the caller's role (`06_User_Roles_and_Permissions.md`); the UI never grants authority the server would deny.

## 9.4 Supported Devices

- **Web (PWA):** installable; mobile and desktop. **Implemented.**
- **Mobile:** camera-first capture for OCR. **Implemented.**
- **Desktop:** file-upload-first workflow. **Implemented.**
- **iPad + HID barcode scanner:** **Future.**
- **Android handheld (PWA):** **Future.**

## 9.5 Responsive Design Strategy

- Distinct desktop (PC) and mobile presentations; shared logic. **Implemented** (home/top screen delivered; remaining screens progressively aligned — **Planned**).
- Layouts adapt at established breakpoints; touch targets meet minimum sizes on mobile.

## 9.6 Layout System

- Card-based layout on a dark theme; consistent page header (title + primary action) and content cards.
- Reusable building blocks: page title, data tables, forms, modals, status/tag badges, activity timelines. **Implemented.**

## 9.7 Navigation Model

- **Sidebar** primary navigation (desktop) and **bottom navigation** (mobile). **Implemented.**
- Business-flow grouping in the sidebar (e.g., customers → vehicles → estimates …) with utility links (e.g., OCR履歴) separated. **Implemented.**
- List → detail navigation for customers and vehicles; OCR history links back to customer/vehicle. **Implemented.**

## 9.8 Dashboard UX
- **Status:** Implemented.
- Dealer-scoped operational summary on entry (PC + mobile).
- **Rules:** **Sales/revenue information must not be shown on staff-facing top screens unless permission-controlled** (role-gated per `06`). **A product ticker/strip on the dashboard is not required** and is not part of the approved UX.

## 9.9 Customer Management UX
- **Status:** Implemented (Phase 2 Sprint 2).
- List with controlled search + filters; detail page with profile, notes, derived status/tags, activity timeline; create/edit via form/modal.
- **Rules:** soft-deleted records excluded; permission-aware editing.

## 9.10 Vehicle Management UX
- **Status:** Implemented (Phase 2 Sprint 3).
- List with search + filters; detail page with profile, derived 車検 status/tags, service-history view, owner link; create/edit via form/modal.
- **Rules:** customer↔vehicle relationship surfaced; mismatch flagged, not crashed.

## 9.11 OCR Registration UX
- **Status:** Implemented (Phase 2 Sprint 1/4).
- **The OCR flow must clearly separate: camera capture · file upload · review · edit · duplicate detection · confirmation.**
- **Mobile camera-first behavior is required**; **desktop file-upload fallback is required.**
- Clear progress and error states during upload/analysis.

## 9.12 OCR Review UX
- **Status:** Implemented (Phase 2 Sprint 4).
- Customer and vehicle fields shown separately; **AI/OCR data must always be editable before saving**; low-confidence and missing important fields highlighted.
- **Rule:** nothing is persisted without explicit user confirmation.

## 9.13 OCR History UX
- **Status:** Implemented (Phase 2 Sprint 5).
- Session list with status badges and reviewed summary; audit trail; links to resulting customer/vehicle records. Read-only.

## 9.14 Estimate UX
- **Status:** Implemented (core); category-specific steps (PPF/window film/maintenance/car wash/room cleaning/other) **Planned** (placeholder).
- Estimate creation with item entry and category routing; document output via PDF.

## 9.15 Product UX
- **Status:** Implemented.
- Catalog browsing/management; purchase/installation permission reflected per business rules (`05_Business_Rules.md`).

## 9.16 Calendar UX
- **Status:** Implemented.
- Calendar and reservation views; scheduling of jobs. **Future:** external calendar sync.

## 9.17 Work Order UX
- **Status:** Implemented.
- Work-order management with attachments; completion reporting; document output.

## 9.18 Invoice / Payment UX
- **Status:** Implemented.
- Invoice creation and document output; payment recording against invoices. Financial views are permission-aware (`06`).

## 9.19 LINE Integration UX
- **Status:** Implemented (code complete) — **inactive pending credentials.**
- Customer linkage and messaging surfaces (LIFF); LINE status reflected on customer records.

## 9.20 Super Admin UX
- **Status:** Implemented.
- Platform dealer management (approval/lifecycle) and admin views; only Super Admin sees global dealer management (`06` §6.7).

## 9.21 Dealer Settings UX
- **Status:** Implemented.
- **Settings UX should use category-based navigation where appropriate** (category hub/sections). Onboarding and document/branding settings included. Owner-managed.

## 9.22 Form Design Rules

- Required fields clearly marked; server-side validation is authoritative (client validation for UX only, `08` §8.21).
- Reuse existing form components and styles; no new form visual language.
- Destructive/irreversible actions require confirmation; AI/OCR-prefilled fields remain editable.
- Consistent input affordances (e.g., postal lookup, selects, toggles) as already implemented.

## 9.23 Error / Empty / Loading States

- Every list provides an explicit **empty state**; long operations provide a **loading/progress** state (e.g., OCR upload/analysis with elapsed time).
- **Errors are user-safe and actionable** (no secret/internal leakage); transient/retryable errors offer retry; setup/config errors give guidance.
- Advisory states (e.g., duplicate detection) are non-blocking and clearly distinguished from hard errors.

## 9.24 Accessibility

- Adequate color contrast on the dark theme; minimum touch-target sizes on mobile; keyboard-focusable interactive controls.
- Meaningful labels for inputs and actions. Accessibility is maintained, not regressed, by additive changes.

## 9.25 Japanese Localization

- **Japanese is the current primary UI language.** All implemented screens use Japanese copy.
- **English/multi-language support is Future** (not implemented).
- Region-specific presentation remains configurable, not hardcoded (`05_Business_Rules.md` §5.20).

## 9.26 Mobile / iPad UX

- **Mobile:** Implemented — camera-first OCR, bottom navigation, touch-optimized layouts.
- **iPad + HID barcode scanner:** **Future** — not implemented; reserved for a future approved specification (relevant to inventory stocktaking, Generic edition).

## 9.27 Android Handheld / PWA Future UX

- **Android handheld (PWA):** **Future** — handheld-optimized workflows are not implemented.
- **Inventory stocktaking UX:** **Future, Generic Edition only** — not in approved active scope; documented as future-only (consistent with `07_Feature_Specifications.md` §7.30).

## 9.28 UI Change Control

- **Do not redesign existing UI.** UI changes are additive, reuse existing components, and follow the lifecycle in `03_Development_Constitution.md` §3.4.
- Architecture-affecting UI changes (navigation model, device strategy) require architect approval.
- New screens require an approved feature specification (`07_Feature_Specifications.md`).

## 9.29 References

- `01_PROJECT_OVERVIEW.md` — product scope, editions, device direction.
- `02_SYSTEM_ARCHITECTURE.md` — device strategy, PWA, frontend architecture.
- `06_User_Roles_and_Permissions.md` — permission-aware UI gating.
- `07_Feature_Specifications.md` — feature scope/status (not duplicated here).
- `08_API_Architecture.md` — API/server-action contracts behind the UI (not duplicated here).
- `README.md` — Single Source of Truth + workflow. `INDEX.md` — document map.
