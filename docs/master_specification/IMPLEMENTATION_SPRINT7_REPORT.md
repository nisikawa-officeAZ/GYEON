# IMPLEMENTATION SPRINT 7 REPORT
## GYEON Detailer Agent — Customer & Vehicle Onboarding Flow

| Field | Value |
|-------|-------|
| **Sprint** | 7 — Customer & Vehicle Onboarding |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `9f6ca8a` feat(onboarding): implement customer vehicle onboarding flow |
| **New files** | 4 |
| **Modified files** | 1 |
| **Lines added** | +911 / -11 |

---

## 1. Build Checks

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS — 0 errors |
| Build | `npm run build` | ✅ PASS — 37/37 pages |

---

## 2. New Files

### `src/lib/ocr/ocr-types.ts` — OCR Adapter Interface Layer

Provider-agnostic abstraction for the OCR pipeline. Decouples the onboarding UI from any specific OCR implementation.

| Export | Type | Purpose |
|--------|------|---------|
| `OcrAdapterInput` | interface | `{ imageBase64: string; mimeType: string }` |
| `OcrAdapterOutput` | interface | `{ result: VehicleRegistrationOcrResult; provider: string; model: string }` |
| `OcrAdapter` | interface | `analyze(input): Promise<OcrAdapterOutput \| { error: string }>` |
| `ManualCorrectionInput` | interface | Field correction entry for audit trail |
| `OcrParserConfig` | interface | `{ splitNameOnSpace, normalizeDate, trimWhitespace }` |
| `DEFAULT_OCR_PARSER_CONFIG` | const | Default parser settings |

The existing `analyzeVehicleRegistrationImage()` in `src/lib/vehicle-registration/ocr.ts` is the concrete `OcrAdapter` implementation. These interfaces allow future swap-in of alternative OCR providers.

---

### `src/lib/ocr/customer-mapper.ts` — OCR → Customer Form Mapper

Maps `VehicleRegistrationOcrResult` fields to the customer onboarding form state.

| Export | Type | Purpose |
|--------|------|---------|
| `CustomerFormState` | interface | All customer form fields |
| `EMPTY_CUSTOMER_FORM` | const | Zero-value form state |
| `mapOcrToCustomer()` | function | `Partial<OcrResult>` → `Partial<CustomerFormState>` |

**Name splitting logic:** `user_name` (or `owner_name`) is split on half-width space or full-width space (U+3000) into `last_name` + `first_name`. If no space found, the entire string is treated as `last_name`.

**Field mapping:**
| OCR field | Customer field |
|-----------|---------------|
| `user_name` / `owner_name` | `last_name` + `first_name` (split) |
| `user_address` / `owner_address` | `address1` |

---

### `src/lib/ocr/vehicle-mapper.ts` — OCR → Vehicle Form Mapper

Maps `VehicleRegistrationOcrResult` fields to the vehicle onboarding form state.

| Export | Type | Purpose |
|--------|------|---------|
| `VehicleFormState` | interface | All vehicle form fields |
| `EMPTY_VEHICLE_FORM` | const | Zero-value form state |
| `mapOcrToVehicle()` | function | `Partial<OcrResult>` → `Partial<VehicleFormState>` |

**Field mapping:**
| OCR field | Vehicle field |
|-----------|--------------|
| `maker` | `maker` |
| `vehicle_name` | `model` |
| `grade` | `grade` |
| `color` | `color` |
| `chassis_number` | `vin` |
| `inspection_expiry_date` | `inspection_expiry_date` |
| `license_plate_region/class/kana/number` | `plate_number` (joined with spaces) |
| `first_registration_date` | `year` (4-char prefix) |

---

### `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — Onboarding Flow

Standalone wizard for creating customer + vehicle before opening the Estimate Wizard.

**Props:**
```typescript
interface Props {
  customers:  CustomerDB[];               // existing customer list
  onComplete: (customerId: string, vehicleId: string) => void;
  onCancel:   () => void;
}
```

**Screen flow:**

```
customer-select
  ├── [existing customer] → vehicle-form → confirm
  └── [new customer] → customer-method
        ├── [OCR] → ocr-upload → ocr-review → customer-form → vehicle-form → confirm
        └── [manual] → customer-form → vehicle-form → confirm
```

**Screens:**

| Screen | Component | Description |
|--------|-----------|-------------|
| `customer-select` | custom | Search/filter existing customers; "新規顧客登録" button |
| `customer-method` | custom | Choice: OCR scan or manual entry |
| `ocr-upload` | `VehicleRegistrationUpload` | Image upload + OCR trigger |
| `ocr-review` | `VehicleRegistrationOcrReview` | Review/edit extracted fields; select which to apply |
| `customer-form` | custom | Customer fields (pre-filled from OCR if applicable) |
| `vehicle-form` | custom | Vehicle fields (pre-filled from OCR if applicable) |
| `confirm` | custom | Summary + create button |

**Customer form fields:** 姓 (required), 名, 姓カナ, 名カナ, 電話, Email, 住所, LINE ID, 内部メモ, 法人フラグ

**Vehicle form fields:** メーカー, 車名, グレード, 年式, 色, ナンバープレート, VIN, ボディサイズ（select: SS–XXL）, 車検有効期限, 内部メモ

**OCR integration:** When OCR result is applied, `mapOcrToCustomer()` and `mapOcrToVehicle()` pre-fill both forms. User can edit all fields before confirming.

**Creation:** On confirm, calls `createCustomer()` (if new customer) then `createVehicle()` via existing server actions. Both follow the established security pattern: `dealer_id` injected server-side, `customer_id` validated to same dealer.

**Navigation:** Screen stack (push/pop) — same pattern as EstimateWizard.

---

## 3. Modified Files

### `src/components/estimates/EstimatesClient.tsx`

| Change | Description |
|--------|-------------|
| Added `useRouter` import | For `router.refresh()` after onboarding |
| Added `CustomerVehicleOnboardingWizard` import | New component |
| Added `"onboarding"` to `ModalState` | New modal mode |
| Added "顧客・車両登録" button | Opens onboarding modal |
| Added onboarding modal block | Renders `CustomerVehicleOnboardingWizard` |

**`onComplete` callback behavior:**
```typescript
onComplete={() => {
  router.refresh();          // re-fetch server data (customers, vehicles)
  setModal({ mode: "create" });  // auto-open EstimateWizard
}}
```

After onboarding, the page data refreshes to include the new customer/vehicle, then the Estimate Wizard opens automatically.

---

## 4. Architecture Notes

### Existing OCR infrastructure reused

Sprint 7 builds on top of the full OCR pipeline already implemented in PHASE67:

| Existing file | Role in Sprint 7 |
|---------------|-----------------|
| `src/lib/vehicle-registration/ocr.ts` | Concrete OCR engine (GPT-4o-mini) |
| `src/lib/vehicle-registration/actions.ts` | Upload + analyze server action |
| `src/components/vehicle-registration/VehicleRegistrationUpload.tsx` | Upload UI (reused) |
| `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx` | Review UI (reused) |
| `src/lib/vehicle-registration/vehicle-registration-types.ts` | `VehicleRegistrationOcrResult` type |

### Mapper pattern

The mapper layer (`customer-mapper.ts`, `vehicle-mapper.ts`) is intentionally thin:
- Accepts `Partial<VehicleRegistrationOcrResult>` (the reviewed/selected subset)
- Returns `Partial<FormState>` (only fields where OCR found data)
- No side effects — pure functions for testability

### What was NOT implemented (by design)

| Scope exclusion | Reason |
|-----------------|--------|
| GPT API implementation | Already exists; not duplicated |
| OCR provider implementation | Use existing `analyzeVehicleRegistrationImage` |
| DB schema changes | No migrations required |
| EstimateWizard screen modifications | Standalone flow — no overlap needed |

---

## 5. Integration Point

The new "顧客・車両登録" button sits in the EstimatesClient header alongside "GYEON見積作成" and "新規見積". The full operator workflow is:

```
[顧客・車両登録] → onboarding wizard → create customer → create vehicle
     → router.refresh() + open EstimateWizard → complete estimate
```

Or the existing flow continues to work unchanged:

```
[新規見積] → EstimateWizard step1 (inline customer/vehicle)
```

---

## 6. Quality Status

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean — 0 errors |
| Build (`npm run build`) | ✅ Pass — 37/37 pages |
| Estimate Wizard v1 regression | ✅ Unchanged |
| Pricing Engine | ✅ Unchanged |
| DB schema | ✅ Unchanged — no migrations |
| Existing OCR pipeline | ✅ Reused without modification |

---

## 7. File Inventory

| File | Role | Sprint |
|------|------|--------|
| `src/lib/ocr/ocr-types.ts` | OCR adapter interfaces | 7 (new) |
| `src/lib/ocr/customer-mapper.ts` | OCR → customer form mapper | 7 (new) |
| `src/lib/ocr/vehicle-mapper.ts` | OCR → vehicle form mapper | 7 (new) |
| `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` | Standalone onboarding wizard | 7 (new) |
| `src/components/estimates/EstimatesClient.tsx` | Add onboarding modal entry | 7 (modified) |

---

*GYEON Detailer Agent | Implementation Sprint 7 Report | Office AZ | 2026-06-25*
