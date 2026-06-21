# DealerOS — PHASE31 Vehicles CRUD Foundation

> **Status:** Implemented. RLS migration NOT applied yet.
> **Environment:** Development only.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. Purpose

Connect the Vehicles UI to Supabase. Replace mock data with real database queries scoped by dealer membership. Enforce that vehicles are linked to customers belonging to the same dealer.

CRUD scope for this phase:

| Operation | Status |
|---|---|
| List (SELECT) | ✅ Implemented |
| Create (INSERT) | ✅ Implemented |
| Update (UPDATE) | ✅ Implemented |
| Delete (DELETE) | ❌ Out of scope — see Section 7 |

---

## 2. Architecture Rules

### dealer_id MUST NOT equal auth.uid()

`dealer_id` on `vehicles` is the tenant identifier. It comes from `dealer_members`, not directly from `auth.uid()`.

### dealer_id is always server-injected

`dealer_id` is NEVER accepted from client form input. It is resolved server-side on every write operation.

### customer_id ownership is validated server-side

Before any INSERT or UPDATE, `customer_id` from the form is validated against the database:

```
customer_id from form
    │
    ▼
SELECT id FROM customers
WHERE id = customer_id
  AND dealer_id = currentDealer.dealer_id
    │
    ├── Not found → return error (cross-dealer attachment blocked)
    └── Found → proceed with insert/update
```

This ensures a user cannot attach a vehicle to another dealer's customer.

---

## 3. Files Created / Updated

| File | Status | Purpose |
|---|---|---|
| `src/lib/vehicles/vehicle-types.ts` | New | DB-aligned types (`VehicleDB`, `VehicleInsert`, `VehicleUpdate`) |
| `src/lib/vehicles/get-vehicles.ts` | New | Server function — lists vehicles for current dealer |
| `src/lib/vehicles/create-vehicle.ts` | New | Server action — validates customer_id + inserts with server-injected dealer_id |
| `src/lib/vehicles/update-vehicle.ts` | New | Server action — updates vehicle scoped by id + dealer_id |
| `src/components/vehicles/VehicleForm.tsx` | Updated | Wired to server actions, customer selector, create/edit modes |
| `src/components/vehicles/VehicleTable.tsx` | Updated | Accepts `VehicleDB[]` prop, optional `onEdit` callback |
| `src/components/vehicles/VehiclesClient.tsx` | New | Client wrapper for modal/form state |
| `src/app/vehicles/page.tsx` | Updated | Server component — fetches vehicles + customers in parallel |

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
    ├── getVehicles()
    │     SELECT * FROM vehicles WHERE dealer_id = ?
    │
    ├── createVehicle()
    │     1. validate customer_id: SELECT FROM customers WHERE id = ? AND dealer_id = ?
    │     2. INSERT INTO vehicles (dealer_id = ?, customer_id = ?, ...)
    │
    └── updateVehicle()
          1. validate customer_id: SELECT FROM customers WHERE id = ? AND dealer_id = ?
          2. UPDATE vehicles WHERE id = ? AND dealer_id = ?
```

---

## 5. customer_id Ownership Validation

Every vehicle must belong to a customer within the same dealer. This is enforced server-side on both create and update:

```typescript
// Before insert or update
const { data: customer } = await supabase
  .from("customers")
  .select("id")
  .eq("id",        customerId)       // the customer_id from the form
  .eq("dealer_id", dealer.dealer_id) // must match current dealer
  .single();

if (!customer) return { error: "Customer not found or does not belong to your dealer." };
```

This prevents:
- Attaching a vehicle to a customer from Dealer B while logged in as Dealer A
- Manipulating `customer_id` in the browser to target another dealer's data

---

## 6. Data Flow

### Read (getVehicles + getCustomers)

```
Server component (page.tsx)
    │
    ▼
Promise.all([getVehicles(), getCustomers()])
    ├── getVehicles()  → VehicleDB[]
    └── getCustomers() → CustomerDB[]  (for customer selector in form)
    │
    ▼
VehiclesClient (client)
    ├── VehicleTable  (vehicles list)
    └── VehicleForm   (customers prop → selector dropdown)
```

### Write (createVehicle / updateVehicle)

```
VehicleForm (client)
    │  user selects customer, fills form, submits
    ▼
createVehicle(formData) / updateVehicle(id, formData)
    ├── getCurrentDealer() → dealer_id
    ├── validate customer_id belongs to dealer_id
    ├── supabase INSERT/UPDATE
    └── revalidatePath("/vehicles") → page re-fetches automatically
```

---

## 7. Why Delete Is Excluded

Same policy as customers:

- Hard delete on vehicles cascades to estimates (ON DELETE CASCADE)
- Soft delete (`deleted_at`) must be confirmed in schema before implementing
- Current `getVehicles()` already filters `.is("deleted_at", null)` in preparation

---

## 8. Testing Checklist

| Check | Method | Expected |
|---|---|---|
| TypeScript type check | `tsc --noEmit` | No errors |
| Build | `npm run build` | Success |
| `/vehicles` page builds | Build output | Route present as `ƒ (Dynamic)` |
| `getVehicles()` scopes by `dealer_id` | Code review | `.eq("dealer_id", dealer.dealer_id)` present |
| `createVehicle()` validates `customer_id` ownership | Code review | Customer query with `dealer_id` check before insert |
| `createVehicle()` does not accept `dealer_id` from form | Code review | No `formData.get("dealer_id")` |
| `updateVehicle()` scopes by id + dealer_id | Code review | `.eq("id", ...).eq("dealer_id", ...)` present |
| `updateVehicle()` validates changed `customer_id` | Code review | Customer ownership check before update |
| Customer selector uses same dealer's customers only | Code review | `customers` prop from `getCustomers()` (dealer-scoped) |
| RLS migration NOT applied | Supabase Dashboard → Auth → Policies | No policies on vehicles table |
| Git status clean | `git status` | `nothing to commit` |

---

## 9. Next Phase

**PHASE32 — Estimates CRUD**

- Connect `estimates` page to Supabase
- Replace mock estimate data with real queries
- Estimate requires both `customer_id` and `vehicle_id`
- Both must belong to the same dealer
- `estimate_no` generation strategy to be specified
