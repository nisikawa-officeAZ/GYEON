# DealerOS — PHASE34 PDF Generation Foundation

> **Status:** Implemented. Browser print only. No external PDF library yet.
> **Environment:** Development only.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. Purpose

Implement the PDF generation foundation for estimates and GYEON service estimates.
Replace the static mock PDF preview with real, tenant-scoped data rendering.
Provide a browser-based print/save-to-PDF flow.

---

## 2. What Is Included

| Feature | Status |
|---|---|
| `getEstimatePdfData(id)` — tenant-scoped estimate fetch | ✅ |
| `getGyeonServicePdfData(id)` — tenant-scoped GYEON fetch | ✅ |
| `EstimatePdfPreview` — A4-style printable estimate layout | ✅ |
| `GyeonServicePdfPreview` — A4-style printable GYEON layout | ✅ |
| `/pdf?estimateId=xxx` — load real estimate PDF | ✅ |
| `/pdf?gyeonId=xxx` — load real GYEON service PDF | ✅ |
| `/pdf` (no params) — existing mock demo preserved | ✅ |
| Browser print button (`window.print()`) | ✅ |
| Print CSS (`@media print` visibility isolation) | ✅ |

## 3. What Is Excluded

| Feature | Reason |
|---|---|
| Server-side PDF file generation | PHASE35+ |
| Supabase Storage upload | PHASE35+ |
| LINE / email sending | PHASE37 |
| Line-item breakdown (wheel/tire/work cost) | Not yet connected to DB |
| Dealer info header (dealer name, address) | PHASE35 Dealer Settings |

---

## 4. Architecture Rules

### dealer_id MUST NOT equal auth.uid()

`dealer_id` is the tenant identifier. It comes from `dealer_members`, not directly from `auth.uid()`.

### PDF data is always server-scoped

PDF data functions run server-side and scope every query by both `id` AND `dealer_id`:

```typescript
.eq("id",        targetId)
.eq("dealer_id", dealer.dealer_id)   // from getCurrentDealer() → dealer_members
```

A user cannot access another dealer's PDF by guessing an ID — the `dealer_id` check blocks unauthorized access even if RLS is not yet applied.

---

## 5. PDF Data Flow

### Estimate PDF

```
/pdf?estimateId=<uuid>
    │
    ▼ (server component)
getEstimatePdfData(estimateId)
    ├── getCurrentDealer() → dealer_id
    ├── SELECT * FROM estimates
    │     JOIN customers, vehicles
    │     WHERE id = ? AND dealer_id = ?
    └── returns EstimateDB | null
    │
    ▼
EstimatePdfPreview (server component → printable HTML)
```

### GYEON Service PDF

```
/pdf?gyeonId=<uuid>
    │
    ▼ (server component)
getGyeonServicePdfData(gyeonId)
    ├── getCurrentDealer() → dealer_id
    ├── SELECT * FROM gyeon_service_estimates
    │     JOIN estimates → customers, vehicles
    │     WHERE id = ? AND dealer_id = ?
    └── returns GyeonServiceEstimateDB | null
    │
    ▼
GyeonServicePdfPreview (server component → printable HTML)
```

### No ID (demo fallback)

```
/pdf (no params)
    │
    ▼
PDFPreview (existing mock — unchanged)
```

---

## 6. Print Flow

```
User clicks "Print / Save PDF"
    │
    ▼
PDFActions (client component) → window.print()
    │
    ▼
Browser print dialog
    ├── Print to paper
    └── Save as PDF (browser built-in)

Print CSS (@media print):
    - All page elements hidden
    - Only #pdf-print-area visible
    - Clean A4 output
```

---

## 7. Files Created / Updated

| File | Status | Purpose |
|---|---|---|
| `src/lib/pdf/get-estimate-pdf-data.ts` | New | Server function — estimate by id + dealer_id |
| `src/lib/pdf/get-gyeon-service-pdf-data.ts` | New | Server function — GYEON by id + dealer_id |
| `src/components/pdf/EstimatePdfPreview.tsx` | New | A4 printable estimate layout |
| `src/components/pdf/GyeonServicePdfPreview.tsx` | New | A4 printable GYEON layout |
| `src/components/pdf/PDFActions.tsx` | Updated | Print button wired to window.print() |
| `src/app/pdf/page.tsx` | Updated | Async server component; searchParams routing |

Existing files preserved (unchanged):
- `src/components/pdf/PDFPreview.tsx` — mock demo, still used as fallback
- `src/components/pdf/mockPdfEstimate.ts` — mock data for demo

---

## 8. Dealer Isolation Model

```
auth.uid()
    │
    ▼
getCurrentDealer()
    │  queries dealer_members WHERE user_id = auth.uid() AND status = 'active'
    ▼
{ dealer_id, role }
    │
    ├── getEstimatePdfData(id)
    │     SELECT * FROM estimates
    │       WHERE id = ? AND dealer_id = ?
    │
    └── getGyeonServicePdfData(id)
          SELECT * FROM gyeon_service_estimates
            WHERE id = ? AND dealer_id = ?
```

ID from URL params is NEVER trusted without the `dealer_id` check.

---

## 9. Testing Checklist

| Check | Method | Expected |
|---|---|---|
| TypeScript type check | `tsc --noEmit` | No errors |
| Build | `npm run build` | Success |
| `/pdf` page builds | Build output | Route present |
| `/pdf` (no params) | UI | Mock demo preview shown |
| `/pdf?estimateId=<valid>` | UI | Real estimate rendered |
| `/pdf?estimateId=<invalid>` | UI | Demo preview + amber notice |
| `/pdf?gyeonId=<valid>` | UI | Real GYEON estimate rendered |
| `getEstimatePdfData()` scopes by id + dealer_id | Code review | `.eq("id",...).eq("dealer_id",...)` |
| `getGyeonServicePdfData()` scopes by id + dealer_id | Code review | `.eq("id",...).eq("dealer_id",...)` |
| No dealer_id accepted from client | Code review | No `searchParams.dealer_id` usage |
| Print button triggers window.print() | Code review | `onClick={() => window.print()}` |
| Print CSS isolates print area | Code review | `@media print` in EstimatePdfPreview + GyeonServicePdfPreview |
| RLS migration NOT applied | Supabase Dashboard | No policies on estimates / gyeon table |
| Existing UI preserved | Build + navigation | Customers, Vehicles, Estimates pages unaffected |

---

## 10. Next Phase

**PHASE35 — Dealer Settings**

- Dealer profile management (name, address, phone, license number)
- Dealer info displayed in PDF header
- Settings page connected to `dealers` table
