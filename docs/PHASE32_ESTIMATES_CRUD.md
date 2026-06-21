# DealerOS — PHASE32 Estimates CRUD Foundation

> **Status:** Implemented. RLS migration NOT applied yet.
> **Environment:** Development only.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. Purpose

Connect the Estimates UI to Supabase. Replace mock data with real database queries scoped by dealer membership. Enforce that estimates are linked to customers and vehicles belonging to the same dealer.

CRUD scope for this phase:

| Operation | Status |
|---|---|
| List (SELECT) | ✅ Implemented — includes joined customer and vehicle data |
| Create (INSERT) | ✅ Implemented |
| Update (UPDATE) | ✅ Implemented |
| Delete (DELETE) | ❌ Out of scope — see Section 8 |

---

## 2. Architecture Rules

### dealer_id MUST NOT equal auth.uid()

`dealer_id` on `estimates` is the tenant identifier. It comes from `dealer_members`, not directly from `auth.uid()`.

### dealer_id is always server-injected

`dealer_id` is NEVER accepted from client form input. It is resolved server-side on every write operation.

### customer_id and vehicle_id ownership validated server-side

Both FKs are validated before INSERT or UPDATE:

```
customer_id from form → validated: SELECT WHERE id = ? AND dealer_id = currentDealer
vehicle_id  from form → validated: SELECT WHERE id = ? AND dealer_id = currentDealer
                                        ↓
                                Only then proceed
```

---

## 3. Files Created / Updated

| File | Status | Purpose |
|---|---|---|
| `src/lib/estimates/estimate-types.ts` | New | DB-aligned types including joined `customers` and `vehicles` |
| `src/lib/estimates/get-estimates.ts` | New | Server function — lists estimates with joined customer + vehicle data |
| `src/lib/estimates/create-estimate.ts` | New | Server action — validates customer_id + vehicle_id, injects dealer_id |
| `src/lib/estimates/update-estimate.ts` | New | Server action — updates estimate scoped by id + dealer_id |
| `src/components/estimates/EstimateForm.tsx` | Updated | Real customer/vehicle selectors, server actions, create/edit modes |
| `src/components/estimates/EstimateTable.tsx` | Updated | Accepts `EstimateDB[]`, shows joined customer/vehicle names |
| `src/components/estimates/EstimateDetail.tsx` | Updated | Uses `EstimateDB` with joined data instead of mock lookups |
| `src/components/estimates/EstimatesClient.tsx` | New | Client wrapper — all modal state (create, edit, detail, GYEON) |
| `src/app/estimates/page.tsx` | Updated | Server component — fetches estimates + customers + vehicles in parallel |

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
    ├── getEstimates()
    │     SELECT *, customers(name,phone,email), vehicles(manufacturer,model,year,grade,license_plate)
    │     FROM estimates WHERE dealer_id = ?
    │
    ├── createEstimate()
    │     1. validate customer_id: SELECT FROM customers WHERE id = ? AND dealer_id = ?
    │     2. validate vehicle_id:  SELECT FROM vehicles  WHERE id = ? AND dealer_id = ?
    │     3. INSERT INTO estimates (dealer_id = ?, customer_id = ?, vehicle_id = ?, ...)
    │
    └── updateEstimate()
          1. validate customer_id: SELECT FROM customers WHERE id = ? AND dealer_id = ?
          2. validate vehicle_id:  SELECT FROM vehicles  WHERE id = ? AND dealer_id = ?
          3. UPDATE estimates WHERE id = ? AND dealer_id = ?
```

---

## 5. customer_id Ownership Validation

```typescript
const { data: customer } = await supabase
  .from("customers")
  .select("id")
  .eq("id",        customerId)
  .eq("dealer_id", dealer.dealer_id)
  .single();

if (!customer) return { error: "Customer not found or does not belong to your dealer." };
```

---

## 6. vehicle_id Ownership Validation

```typescript
const { data: vehicle } = await supabase
  .from("vehicles")
  .select("id")
  .eq("id",        vehicleId)
  .eq("dealer_id", dealer.dealer_id)
  .single();

if (!vehicle) return { error: "Vehicle not found or does not belong to your dealer." };
```

Both validations run before every INSERT and UPDATE.

---

## 7. Data Flow

### Read

```
Server component (page.tsx)
    │
    ▼
Promise.all([getEstimates(), getCustomers(), getVehicles()])
    │
    ▼
EstimatesClient (client)
    ├── EstimateTable    (estimates list with joined customer + vehicle names)
    ├── EstimateForm     (customers + vehicles props for selectors)
    ├── EstimateDetail   (joined customer + vehicle data from EstimateDB)
    └── ServiceEstimateForm  (GYEON service form — unchanged)
```

### Write

```
EstimateForm (client)
    │  user selects customer → vehicle selector filters to that customer's vehicles
    │  user fills form, submits
    ▼
createEstimate(formData) / updateEstimate(id, formData)
    ├── getCurrentDealer() → dealer_id
    ├── validate customer_id ownership
    ├── validate vehicle_id ownership
    ├── supabase INSERT/UPDATE
    └── revalidatePath("/estimates")
```

---

## 8. Why Delete Is Excluded

Same policy as customers and vehicles:

- Hard delete on estimates cascades to `gyeon_service_estimates` (ON DELETE CASCADE)
- Soft delete (`deleted_at`) must be confirmed in schema before implementing
- Current `getEstimates()` already filters `.is("deleted_at", null)` in preparation

---

## 9. Testing Checklist

| Check | Method | Expected |
|---|---|---|
| TypeScript type check | `tsc --noEmit` | No errors |
| Build | `npm run build` | Success |
| `/estimates` page builds | Build output | Route present as `ƒ (Dynamic)` |
| `getEstimates()` scopes by `dealer_id` | Code review | `.eq("dealer_id", dealer.dealer_id)` present |
| `createEstimate()` validates `customer_id` ownership | Code review | Customer query with `dealer_id` check before insert |
| `createEstimate()` validates `vehicle_id` ownership | Code review | Vehicle query with `dealer_id` check before insert |
| `createEstimate()` does not accept `dealer_id` from form | Code review | No `formData.get("dealer_id")` |
| `updateEstimate()` scopes by id + dealer_id | Code review | `.eq("id", ...).eq("dealer_id", ...)` present |
| `updateEstimate()` validates changed `customer_id` | Code review | Customer ownership check before update |
| `updateEstimate()` validates changed `vehicle_id` | Code review | Vehicle ownership check before update |
| GYEON Service form still works | Build + UI | `ServiceEstimateForm` renders in modal |
| RLS migration NOT applied | Supabase Dashboard → Auth → Policies | No policies on estimates table |
| Git status clean | `git status` | `nothing to commit` |

---

## 10. Next Phase

**PHASE33 — GYEON Service Estimates CRUD**

- Connect GYEON service estimate form to Supabase
- Link to parent `estimates` record
- `gyeon_service_estimates.estimate_id` must belong to the same dealer's estimate
- `options_json` stored as JSONB
