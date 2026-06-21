# DealerOS — PHASE33 GYEON Service Estimates CRUD

> **Status:** Implemented. RLS migration NOT applied yet.
> **Environment:** Development only.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. Purpose

Connect the GYEON Service Estimate UI to Supabase. Replace the mock-only `ServiceEstimateForm` with a fully wired `GyeonServiceForm` that reads/writes the `gyeon_service_estimates` table.

CRUD scope for this phase:

| Operation | Status |
|---|---|
| List (SELECT) | ✅ Implemented — includes nested JOIN to estimates → customers + vehicles |
| Create (INSERT) | ✅ Implemented |
| Update (UPDATE) | ✅ Implemented |
| Delete (DELETE) | ❌ Out of scope |

---

## 2. Architecture Rules

### dealer_id MUST NOT equal auth.uid()

`dealer_id` is the tenant identifier. It comes from `dealer_members`, not directly from `auth.uid()`.

### estimate_id ownership validated server-side

Before every INSERT or UPDATE, the server validates that `estimate_id` belongs to the current dealer:

```
estimate_id from form → SELECT FROM estimates WHERE id = ? AND dealer_id = currentDealer
                                        ↓
                             Only then proceed with write
```

### options_json serialization

GYEON service options (Record<OptionKey, boolean>) are:
- Serialized as `JSON.stringify(options)` in FormData on the client
- Parsed with `JSON.parse(optionsJsonRaw)` on the server (with try/catch)
- Stored as JSONB in Supabase

### Pricing computed client-side

Pricing values (base_price, discount, subtotal, tax, total) are computed client-side in `GyeonServiceForm` using the same logic as `ServiceSummary`. These are accepted by the server because they are derived from locked lookup tables (`BASE_PRICES`, `MOCK_DISCOUNT`). The security boundary is `dealer_id`, not pricing.

---

## 3. Files Created / Updated

| File | Status | Purpose |
|---|---|---|
| `src/lib/gyeon/gyeon-service-types.ts` | New | DB-aligned types including joined estimate → customer + vehicle |
| `src/lib/gyeon/get-gyeon-service-estimates.ts` | New | Server function — lists records with nested JOINs |
| `src/lib/gyeon/create-gyeon-service-estimate.ts` | New | Server action — validates estimate_id, injects dealer_id |
| `src/lib/gyeon/update-gyeon-service-estimate.ts` | New | Server action — validates estimate_id, scopes by dealer_id |
| `src/components/gyeon/GyeonServiceForm.tsx` | New | Connected form — estimate selector + existing UI sub-components |
| `src/components/gyeon/GyeonServiceDetail.tsx` | New | Read-only detail view — PDF-friendly layout |
| `src/components/estimates/EstimatesClient.tsx` | Updated | Uses GyeonServiceForm instead of ServiceEstimateForm |

---

## 4. dealer_members Isolation Model

```
auth.uid()
    │
    ▼
getCurrentDealer()
    │  queries dealer_members WHERE user_id = auth.uid() AND status = 'active'
    ▼
{ dealer_id, role }
    │
    ├── getGyeonServiceEstimates()
    │     SELECT *, estimates(estimate_no, status,
    │       customers(name, phone, email),
    │       vehicles(manufacturer, model, year, grade, license_plate)
    │     )
    │     FROM gyeon_service_estimates WHERE dealer_id = ?
    │
    ├── createGyeonServiceEstimate()
    │     1. validate estimate_id: SELECT FROM estimates WHERE id = ? AND dealer_id = ?
    │     2. parse options_json
    │     3. INSERT INTO gyeon_service_estimates (dealer_id = ?, estimate_id = ?, ...)
    │
    └── updateGyeonServiceEstimate()
          1. validate estimate_id: SELECT FROM estimates WHERE id = ? AND dealer_id = ?
          2. parse options_json
          3. UPDATE gyeon_service_estimates WHERE id = ? AND dealer_id = ?
```

---

## 5. estimate_id Ownership Validation

```typescript
const { data: estimate } = await supabase
  .from("estimates")
  .select("id")
  .eq("id",        estimateId)
  .eq("dealer_id", dealer.dealer_id)
  .single();

if (!estimate) return { error: "Estimate not found or does not belong to your dealer." };
```

Runs before every INSERT and UPDATE.

---

## 6. Data Flow

### Read

```
Server component (page.tsx) — if gyeon list page is added later
    │
    ▼
getGyeonServiceEstimates()
    │
    ▼
GyeonServiceDetail (read-only)
```

### Write

```
EstimatesClient (client)
    │  "Create GYEON Estimate" button → modal.mode = "gyeon"
    │
    ▼
GyeonServiceForm (client)
    ├── estimate selector (from estimates prop)
    ├── ServiceCategorySection
    ├── BodySizePriceSection
    ├── ServiceOptionSection
    ├── ServiceSummary
    │
    │  on submit:
    │    JSON.stringify(options) → FormData
    │    compute base_price, discount, subtotal, tax, total → FormData
    │
    ▼
createGyeonServiceEstimate(formData) / updateGyeonServiceEstimate(id, formData)
    ├── getCurrentDealer() → dealer_id
    ├── validate estimate_id ownership
    ├── JSON.parse(options_json)
    ├── supabase INSERT/UPDATE
    └── revalidatePath("/estimates")
```

---

## 7. UI Sub-components Reused (unchanged)

| Component | Location |
|---|---|
| ServiceCategorySection | `src/components/services/ServiceCategorySection.tsx` |
| BodySizePriceSection | `src/components/services/BodySizePriceSection.tsx` |
| ServiceOptionSection | `src/components/services/ServiceOptionSection.tsx` |
| ServiceSummary | `src/components/services/ServiceSummary.tsx` |
| mockServiceEstimate | `src/components/services/mockServiceEstimate.ts` |

These components were NOT modified. `GyeonServiceForm` composes them directly.

---

## 8. Testing Checklist

| Check | Method | Expected |
|---|---|---|
| TypeScript type check | `tsc --noEmit` | No errors |
| Build | `npm run build` | Success |
| `getGyeonServiceEstimates()` scopes by `dealer_id` | Code review | `.eq("dealer_id", dealer.dealer_id)` present |
| `createGyeonServiceEstimate()` validates `estimate_id` ownership | Code review | Estimate query with `dealer_id` check before insert |
| `createGyeonServiceEstimate()` does not accept `dealer_id` from form | Code review | No `formData.get("dealer_id")` |
| `updateGyeonServiceEstimate()` scopes by id + dealer_id | Code review | `.eq("id", ...).eq("dealer_id", ...)` present |
| `options_json` round-trip | Code review | JSON.stringify (client) → JSON.parse (server) |
| GYEON modal opens from estimates page | UI | "Create GYEON Estimate" button → GyeonServiceForm renders |
| Estimate selector shows estimate_no + customer name | UI | Select populated from estimates prop |
| RLS migration NOT applied | Supabase Dashboard → Auth → Policies | No policies on gyeon_service_estimates table |

---

## 9. Next Phase

**PHASE34+** (not yet specified by GPT CTO)
