# CURRENT_TASK — Full Page Estimate Editor

> **Status**: 🟡 DRAFT — awaiting Architect approval. **Do NOT implement yet.**
> **Decision**: Adopt **Option B (Full Page Editor)** for the Estimate Create/Edit workflow.
> **Author**: Claude (implementation) / Architect (owner)
> **Date**: 2026-07-04
> **Baseline commit**: `246ef4a` (v17 cert bridge)

---

## 1. Purpose

Replace the small desktop **modal** Estimate Create/Edit UI with a **professional
full-page editor**. Estimate creation/editing is a core business workflow and must
have a wide, sectioned, deep-linkable page — not a cramped `max-w-xl` modal with
nested modals and scroll fatigue.

Goals:
- One **unified sectioned editor** used for both Create and Edit (removing the
  current Create=Wizard / Edit=Form divergence).
- **Deep-linkable** routes (URL state, browser back, shareable links, refresh-safe).
- **Responsive**: wide multi-column on desktop, single-column on mobile (aligned
  with v17 breakpoints Mobile `<768` / Tablet `768–1023` / Desktop `1024+`).
- **Zero behavioral change** to pricing, OCR, customer/vehicle persistence, and PDF.

Non-goal (this task): visual redesign of the estimate LIST, GYEON service estimate,
work-order, or onboarding flows (tracked separately).

---

## 2. Routes

New App Router routes under `src/app/estimates/`:

| Route | File | Purpose | Data loaded (server) |
|---|---|---|---|
| `/estimates/new` | `estimates/new/page.tsx` | Create | catalog, customers, vehicles, dealer settings |
| `/estimates/[id]/edit` | `estimates/[id]/edit/page.tsx` | Edit | above + `getEstimate(id)` (estimate + items + customer + vehicle) |
| `/estimates/[id]` | `estimates/[id]/page.tsx` | Detail (read-only) | `getEstimate(id)` + dealer branding (for PDF button) |

Notes:
- `/estimates` (list) stays; its actions **navigate** instead of opening modals:
  - Row click → `/estimates/[id]`
  - Edit action → `/estimates/[id]/edit`
  - “＋新規見積” → `/estimates/new`
- Optional query param: `/estimates/new?customer_id=<id>` preserves the existing
  "create estimate for this customer" hand-off (currently `defaultCustomerId`).
- Guard: `/estimates/[id]/edit` and `/estimates/[id]` must 404/redirect if the id
  does not belong to the current dealer (reuse the dealer-scoped `getEstimate`).

---

## 3. Layout

A shared client component **`EstimateEditor`** (create + edit) renders the same
sections; a mode flag (`create` | `edit`) controls prefill + submit target.

### Sections (in order)
1. **顧客 (Customer)** — select existing OR create new (name, kana, phone, email,
   address, LINE ID + **LINE QR**), 業者/掛け率, business billing fields.
2. **車両 (Vehicle)** — select existing OR create new; **車検証OCR** entry; editable
   extended fields (maker/model/grade/型式/year/color/plate/VIN/初度登録年月/
   登録年月日/車検満了日/排気量) + **ボディサイズ (3M推定)**.
3. **サービス (Services)** — catalog-driven category selection (coating / ppf /
   window / maintenance / carwash / roomclean / other) + options. Drives pricing.
4. **明細 (Items)** — the generated line items; editable quantity / discount; per-line total.
5. **値引き (Discounts)** — coupons / manual discount (existing discount UI).
6. **備考・メモ (Notes)** — customer note + internal memo.
7. **合計 (Totals)** — live subtotal / discount / tax / total (sticky on desktop).

### Desktop (`≥1024px`)
- Wide full-page layout (e.g. `max-w-6xl` content column) inside `MainLayout`.
- Two-column where sensible: **left = editable sections (1–6)**, **right = sticky
  Totals + primary actions (保存/PDF)**. Or single wide column with a sticky
  bottom/side Totals bar — final grid to match v17 density.
- Section headers, generous spacing; no modal, no nested modals.

### Mobile (`<768px`)
- **Single-column**, top-to-bottom sections; Totals as a **sticky bottom bar**
  with the primary CTA (保存).
- OCR / LINE QR open as focused overlays (existing components), not nested inside a modal.
- 48×48px tap targets, `text-base` inputs (iOS zoom-safe) — consistent with v17.

### Detail page (`/estimates/[id]`)
- Read-only full page reusing the current `EstimateDetail` content (customer,
  vehicle, Service Summary, 明細, totals, 備考/メモ, 送信履歴) + header actions
  (status control, PDF表示, 施工指示). Rendered as a page, not a modal.

---

## 4. Preserve (no behavioral change)

The editor **reuses existing logic** — it is a new presentation layer only.

| Concern | Reused modules (DO NOT reimplement) |
|---|---|
| **Pricing** | `src/lib/pricing/{canonical-pricing-engine,pricing-catalog,pricing-data,estimate-totals,get-dealer-pricing-catalog}.ts` + the wizard's `serviceInputs` → `buildLineItems` model + `body-size-estimate.ts` (3M) |
| **OCR** | `src/lib/vehicle-registration/{actions,ocr,ocr-customer-mapping,ocr-quality,vehicle-normalize}.ts`, `VehicleRegistrationUpload.tsx`, `VehicleRegistrationOcrReview.tsx` |
| **Customer save** | `src/lib/customers/create-customer.ts` (+ `update-customer.ts`) |
| **Vehicle save** | `src/lib/vehicles/create-vehicle.ts` (+ `update-vehicle.ts`) |
| **Estimate persistence** | `src/lib/estimates/{create-estimate,update-estimate,get-estimate,update-estimate-status}.ts`, `estimate-types.ts` (canonical workflow statuses) |
| **PDF generation** | `src/lib/pdf/{generate-estimate-pdf,get-estimate-pdf-data,dealer-branding}.ts`, `templates/estimate-pdf.tsx` (unchanged) |
| **LINE QR** | `src/components/ui/LineQrScanner.tsx` |

Hard rules:
- **No change** to server actions' input/output contracts, pricing math, OCR
  prompt/model, customer/vehicle column mapping, or PDF templates.
- Line-item generation must go through the **same catalog/pricing path** as today
  (avoid re-introducing a second manual pricing path like the old `EstimateForm`).
- **No DB migration** in this task. **No API/Auth/schema change.**

---

## 5. Component & file plan (proposed)

New:
- `src/app/estimates/new/page.tsx` (server: load catalog/customers/vehicles/settings)
- `src/app/estimates/[id]/edit/page.tsx` (server: + `getEstimate(id)`, dealer-scoped)
- `src/app/estimates/[id]/page.tsx` (server: detail)
- `src/components/estimates/EstimateEditor.tsx` (client: shared sectioned editor)
- Section subcomponents (extracted from Wizard/Form to keep files small):
  `EditorCustomerSection`, `EditorVehicleSection`, `EditorServicesSection`,
  `EditorItemsSection`, `EditorDiscountSection`, `EditorNotesSection`, `EditorTotalsPanel`.

Modified (presentation/navigation only):
- `src/components/estimates/EstimatesClient.tsx` — replace `create`/`edit`/`detail`
  modal modes with navigation (`useRouter().push`). Keep `gyeon`/`work-order`/
  `onboarding` as-is for now (out of scope).
- `src/components/estimates/EstimateTable.tsx` — row/actions navigate to routes.

Deprecated after cutover (kept until parity verified, then removed in a follow-up):
- `EstimateWizard.tsx` (create), `EstimateForm.tsx` (edit) — logic migrates into
  the shared editor + section components; do not delete until parity is confirmed.

---

## 6. Data flow

- **Create**: server page loads catalog + customers + vehicles → `EstimateEditor`
  (mode=create) → on save calls `createEstimate(...)` (same payload shape) →
  redirect to `/estimates/[newId]`.
- **Edit**: server page loads `getEstimate(id)` (estimate + items + customer +
  vehicle) + catalog → `EstimateEditor` (mode=edit, prefilled) → `updateEstimate(...)`
  → redirect to `/estimates/[id]`.
- **Detail**: server loads `getEstimate(id)` + branding → read-only render → PDF via
  existing `/…` PDF route/action.
- Customer/vehicle **created inline** during editing use the existing `createCustomer`
  / `createVehicle` actions and their returned ids are attached to the estimate
  (same as the current wizard hand-off).

---

## 7. Out of scope (explicit)

- Estimate LIST redesign (columns/search/duplicate) — only navigation wiring changes.
- GYEON service estimate, work-order, onboarding flows.
- Any DB migration, API, Auth, RLS, or pricing/OCR/PDF logic change.
- Removing `EstimateWizard`/`EstimateForm` (deferred to a post-parity cleanup task).
- The pending items unrelated to this editor (migrations 097–100, v17 responsive of
  other screens).

---

## 8. Risks & mitigations

- **Pricing parity**: the editor must produce identical line items/totals to the
  wizard. → Reuse `serviceInputs`/`buildLineItems`/pricing engine verbatim; add a
  parity check (same inputs → same items) before deprecating the wizard.
- **Inline customer/vehicle creation timing**: preserve the OCR→form fixes already
  landed (e.g. OCR vehicle mapping, body-size). → Reuse the same effects/handlers.
- **Lost modal immediacy**: navigation replaces modals. → Keep the list a fast entry;
  use optimistic redirects and `router.refresh()` after save.
- **Large client bundle** (editor is heavy): → split sections, load OCR/QR lazily.
- **Deep-link auth**: dealer-scoped `getEstimate` must reject foreign ids (404/redirect).

---

## 9. Acceptance criteria

- [ ] `/estimates/new`, `/estimates/[id]/edit`, `/estimates/[id]` render full pages.
- [ ] Create and Edit use the **same** `EstimateEditor` (unified UX).
- [ ] Desktop: wide sectioned layout with sticky Totals; Mobile: single column + sticky CTA.
- [ ] All 7 sections present (customer, vehicle, services, items, discounts, notes, totals).
- [ ] Line items/totals are **identical** to the current wizard for the same inputs.
- [ ] OCR (車検証 + 3M body size), LINE QR, inline customer/vehicle create all work.
- [ ] PDF output unchanged (same template/data).
- [ ] List actions navigate to the new routes (no create/edit/detail modals).
- [ ] Foreign/invalid estimate id is rejected (dealer-scoped).
- [ ] `typecheck` and `build` pass. No DB/API/Auth/pricing/OCR/PDF logic change.

---

## 10. Suggested phasing (for the implementation task, after approval)

1. **Phase 1** — Routes + read-only Detail page (`/estimates/[id]`) + list navigation.
2. **Phase 2** — `EstimateEditor` shell + sections (customer, vehicle, notes, totals),
   Edit mode prefilled from `getEstimate`, wired to `updateEstimate`.
3. **Phase 3** — Services + Items + Discounts sections (catalog/pricing reuse);
   Create mode (`/estimates/new`) wired to `createEstimate`.
4. **Phase 4** — OCR + LINE QR + inline customer/vehicle create; responsive polish
   (v17 breakpoints); parity check vs wizard; then deprecate wizard/form (separate task).

---

## 11. Architect Requirements (MANDATORY — added post-review)

These four requirements are binding. Each must be satisfied before the relevant
phase is considered complete; the wizard MUST NOT be deprecated until all pass.

### 11.1 Unsaved Changes Protection
- The editor MUST track a **dirty** state — any unsaved change to customer, vehicle,
  services, items, discounts, or notes marks the form dirty.
- While dirty, navigating away MUST prompt a confirmation
  (e.g. 「未保存の変更があります。移動してもよろしいですか？」) and cancel the navigation
  if the operator declines. This applies to:
  - browser back / forward and in-app route changes (Next.js route-change guard),
  - tab close / reload (native `beforeunload`).
- A successful Save resets the dirty flag (no prompt afterwards).
- Applies to both `/estimates/new` and `/estimates/[id]/edit`.

### 11.2 Functional Parity Requirement
- The full-page editor MUST produce **identical line items and totals** to the current
  `EstimateWizard` for the same inputs (no pricing regression).
- Pricing is already shared — `buildLineItems`, `calculateEstimate`, and the
  `ServiceInput` type live in `src/lib/pricing/pricing-engine.ts` and MUST be reused
  **verbatim**. No second/manual pricing path may be introduced.
- The editor MUST reproduce the wizard's **UI-state → `ServiceInput[]`** construction
  (`EstimateWizard.tsx` ~L414–434) exactly.
- **Parity test (acceptance gate)**: for a fixed set of representative service
  combinations (coating+topcoat+options, ppf plan×body-size, window, maintenance,
  carwash, roomclean, other, and mixed), assert the editor's resulting items and
  totals equal the wizard's. The wizard MUST NOT be removed until this test passes.

### 11.3 Customer / Vehicle Integrity
- Inline-created customer/vehicle MUST use the existing `createCustomer` /
  `createVehicle` actions (no new write path).
- The estimate row is created/updated **only on explicit Save** — no draft/placeholder
  estimate row is pre-created.
- Abandoning `/estimates/new` after an inline customer/vehicle was created but before
  the estimate is saved MUST NOT silently orphan data. One of the following MUST be
  chosen and documented before implementation:
  - (a) defer customer/vehicle creation until Save, or
  - (b) track inline-created ids and clean them up / warn on abandon.
- On Edit, the existing linked customer/vehicle MUST NOT be duplicated or detached.

### 11.4 Catalog Loading Guard
- The dealer pricing catalog is fetched asynchronously via `getDealerPricingCatalog()`;
  until it resolves the editor falls back to `DEFAULT_PRICING_CATALOG`.
- Save MUST be blocked (or the catalog re-resolved) until the **dealer** catalog has
  loaded, so amounts are **never persisted using the default catalog** when a dealer
  catalog exists.
- Totals presented to the operator MUST reflect the loaded dealer catalog; show a brief
  loading state until it is ready.

---

*Draft only. No files other than CURRENT_TASK.md were created or modified.
Awaiting Architect approval before any implementation.*
