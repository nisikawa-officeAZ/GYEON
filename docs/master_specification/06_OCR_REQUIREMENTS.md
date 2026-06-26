# 06 — OCR REQUIREMENTS
## Vehicle Registration (車検証) OCR

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Active (implementation-derived — not in Canonical JSON) |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | Implementation (PHASE67) + `supabase/migrations/067_vehicle_registration_ocr.sql` |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `05_DATABASE_REQUIREMENTS.md`, `11_CANONICAL_RULES.md`, `OPERATOR_DECISIONS.md` (OD-16, OD-17) |

> ⚠️ **Not present in the Canonical JSON.** Neither `gyeon_flow.json` nor `gyeon_settings_flow.json` defines OCR. This document is derived from the **implementation** (PHASE67) and the project audit.
> **Operator decision required:** OCR should be added to the Canonical Specification to bring it under SDD authority.

---

## 1. Purpose

Scan a vehicle registration certificate (車検証) image and auto-populate vehicle fields (maker, model, year, plate, body size hints) to speed up STEP1 of the estimate flow, with **mandatory human review before save**.

---

## 2. Implemented Components

| Concern | File |
|---------|------|
| OCR engine call | `src/lib/vehicle-registration/ocr.ts` |
| Server action / orchestration | `src/lib/vehicle-registration/actions.ts` |
| Image storage | `src/lib/vehicle-registration/storage.ts` |
| Types | `src/lib/vehicle-registration/vehicle-registration-types.ts` |
| Upload UI | `src/components/vehicle-registration/VehicleRegistrationUpload.tsx` |
| Human review UI | `src/components/vehicle-registration/VehicleRegistrationOcrReview.tsx` |
| Storage table | `supabase/migrations/067_vehicle_registration_ocr.sql` (table: `vehicle_registration_files`) |

> ⚠️ **PHASE75 correction:** The spec previously referenced this table as `vehicle_registration_ocr`. The actual table name defined in migration 067 is **`vehicle_registration_files`**. All references updated.

### 2a. vehicle_registration_files Table Schema (migration 067)

```sql
CREATE TABLE vehicle_registration_files (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id          uuid        NOT NULL,
  customer_id        uuid        REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id         uuid        REFERENCES vehicles(id)  ON DELETE SET NULL,
  estimate_id        uuid        REFERENCES estimates(id) ON DELETE SET NULL,

  -- Storage
  storage_bucket     text        NOT NULL DEFAULT 'vehicle-registration-documents',
  storage_path       text        NOT NULL,
  file_name          text        NOT NULL,
  file_size          bigint,
  mime_type          text,

  -- OCR processing
  ocr_provider       text,
  ocr_model          text,
  ocr_status         text        NOT NULL DEFAULT 'pending'
                     CHECK (ocr_status IN ('pending','processing','completed','failed','confirmed','archived')),
  ocr_result         jsonb       DEFAULT '{}',
  ocr_confidence     numeric(4,3),

  -- Human confirmation
  confirmed          boolean     DEFAULT false,
  confirmed_by       uuid,
  confirmed_at       timestamptz,

  -- Metadata
  uploaded_by        uuid,
  archived_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
```

**RLS:** SELECT/INSERT/UPDATE via `dealer_members` membership check. **No DELETE policy** — archive pattern only (set `archived_at`).  
**Storage bucket:** `vehicle-registration-documents` (private; signed URLs only).  
**Retention policy:** ⚠️ See `OPERATOR_DECISIONS.md` OD-17.

---

## 3. Requirements & Status

| Item | Requirement | Status |
|------|-------------|--------|
| **GPT-4o-mini integration** | Provider: OpenAI; model: `gpt-4o-mini` (vision); endpoint: `api.openai.com/v1/chat/completions` | 🟡 Code ✅ — returns `OPENAI_API_KEY_MISSING` when `OPENAI_API_KEY` unset (currently unset) |
| **OCR storage** | Persist scan image + extracted record (Supabase Storage + `vehicle_registration_ocr` table) | 🟡 Code ✅ — needs `STORAGE_BUCKET` + service-role key |
| **Human confirmation** | Operator reviews and edits extracted fields before committing to any record | ✅ `VehicleRegistrationOcrReview.tsx` |
| **Manual input fallback** | If OCR unavailable or declined, standard manual vehicle entry remains fully available | ✅ Upload component + standard vehicle form |
| **Audit log** | Every OCR event (upload / OCR start / complete / confirm / archive) logged | ✅ Implemented in migration 067 |
| **Private storage** | Images stored in private Supabase Storage bucket; accessible only via signed URL | ✅ |

---

## 4. Required Configuration

| Env var | Purpose | Current status |
|---------|---------|---------------|
| `OPENAI_API_KEY` | OpenAI API authentication | ❌ Not set locally |
| `STORAGE_BUCKET` | Supabase Storage bucket name | ❌ Not set locally |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access for storage operations | ❌ Not set locally |

OCR is currently **non-operational locally** despite being code-complete. Activation is Phase B work (see `10_ROADMAP.md`).

---

## 5. dealer_settings OCR Columns

From migration 070 (`dealer_settings`):

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `ocr_enabled` | boolean | true | ON/OFF switch. Added in migration 070. When `false`, OCR upload UI is hidden. |
| `ocr_policy` | jsonb | `{}` | `OcrPolicySettings` — see schema below. Added in migration 070. |

**`ocr_policy` JSONB schema (`OcrPolicySettings` type):**

```typescript
interface OcrPolicySettings {
  human_confirmation_required: boolean;   // MUST always be true — see 11_CANONICAL_RULES.md §7.3
  allowed_formats?:            string[];  // e.g. ["image/jpeg","image/png","application/pdf"]
  max_file_size_mb?:           number;    // default: no limit specified
}
```

> **Invariant:** `ocr_policy.human_confirmation_required` **must always be `true`**. It must never be set to `false` through any UI, API, or migration. This is a safety requirement, not a preference. See `11_CANONICAL_RULES.md` §7.3.

> **Clarification on "NOT SET locally":** The §3 status table description "NOT SET" refers to the environment variable `OPENAI_API_KEY` being absent from `.env.local`. The DB column `ocr_enabled` defaults to `true` once migration 070 is applied. These are independent: `ocr_enabled = true` (DB) + `OPENAI_API_KEY` absent (env) = OCR UI shown but API call fails gracefully.

---

## 6. Canonical Gaps (Operator Decisions Required)

1. **Add an OCR section to the Canonical Specification** — define: inputs, extracted field mapping → `currentEstimate.car`, confidence handling, review rules.
2. **Define field-mapping contract** — which 車検証 fields map to which estimate/vehicle fields (`car.maker`, `car.model`, `car.year`, `car.plate`, body size hints), and how body size is inferred.
3. **Define retention/privacy policy** for uploaded registration images (PII — owner name, address, plate number are present on 車検証).
4. **Electronic vehicle registration (e-車検証)** QR support — future enhancement, not yet specced.
