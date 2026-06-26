# 05 — OCR REQUIREMENTS
## Vehicle Registration (車検証) OCR

> ⚠️ **Not present in the Canonical JSON.** Neither `gyeon_flow.json` nor `gyeon_settings_flow.json` defines OCR. This document is derived from the **implementation** (PHASE67) and the project audit. **Operator decision:** OCR should be added to the Canonical Specification to bring it under SDD authority.

---

## 1. Purpose
Scan a vehicle registration certificate (車検証) image and auto-populate vehicle fields (maker, model, year, plate, body size hints) to speed up STEP1 of the estimate flow, with mandatory human review before save.

## 2. Implemented components
| Concern | File |
|---------|------|
| OCR engine call | `src/lib/vehicle-registration/ocr.ts` |
| Server action / orchestration | `src/lib/vehicle-registration/actions.ts` |
| Image storage | `src/lib/vehicle-registration/storage.ts` |
| Types | `src/lib/vehicle-registration/vehicle-registration-types.ts` |
| Upload UI | `src/components/vehicle-registration/VehicleRegistrationUpload.tsx` |
| Human review UI | `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx` |
| Storage table | migration `067_vehicle_registration_ocr.sql` |

## 3. Requirements & status

| Item | Requirement | Status |
|------|-------------|--------|
| **GPT-mini integration** | Provider `openai`, model **`gpt-4o-mini`** (vision), endpoint `api.openai.com/v1/chat/completions` | 🟡 Code ✅ — returns `OPENAI_API_KEY_MISSING` when `OPENAI_API_KEY` unset (**currently unset**) |
| **OCR storage** | Persist scan image + extracted record (Supabase Storage + `vehicle_registration_ocr`) | 🟡 Code ✅ — needs `STORAGE_BUCKET` + service-role key |
| **Human confirmation** | Operator reviews/edits extracted fields before commit | ✅ `VehicleRegistrationOcrReview.tsx` |
| **Manual input fallback** | If OCR unavailable/declined, manual vehicle entry remains fully available | ✅ Upload component + standard vehicle form |

## 4. Required configuration
`OPENAI_API_KEY`, `STORAGE_BUCKET`, `SUPABASE_SERVICE_ROLE_KEY` (server-side). None set in the local `.env.local` → OCR is currently **non-operational locally** despite being code-complete.

## 5. Canonical gaps (operator decisions)
1. Add an **OCR section to the Canonical Specification** (inputs, extracted field mapping → `currentEstimate.car`, confidence handling, review rules).
2. Define **field-mapping contract**: which 車検証 fields map to which estimate/vehicle fields, and how body-size is inferred.
3. Define **retention/privacy** policy for uploaded registration images (PII).
