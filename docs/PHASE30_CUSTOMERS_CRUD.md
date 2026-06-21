# DealerOS — PHASE30 Customers CRUD Foundation

> **Status:** Implemented. RLS migration NOT applied yet.
> **Environment:** Development only.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. Purpose

Connect the Customers UI to Supabase. Replace mock data with real database queries scoped by dealer membership.

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

`dealer_id` on `customers` is the tenant identifier. It comes from `dealer_members`, not directly from `auth.uid()`.

### dealer_id is always server-injected

`dealer_id` is NEVER accepted from client form input. The form has no `dealer_id` field. It is resolved server-side on every write operation:

```
getCurrentDealer() → { dealer_id, role }
                          │
                          ▼
               injected into INSERT / UPDATE
```

If `getCurrentDealer()` returns null (no active membership), the operation returns an error and no data is written.

---

## 3. Files Created / Updated

| File | Status | Purpose |
|---|---|---|
| `src/lib/customers/customer-types.ts` | New | DB-aligned types (`CustomerDB`, `CustomerInsert`, `CustomerUpdate`) |
| `src/lib/customers/get-customers.ts` | New | Server function — lists customers for current dealer |
| `src/lib/customers/create-customer.ts` | New | Server action — inserts customer with server-injected dealer_id |
| `src/lib/customers/update-customer.ts` | New | Server action — updates customer scoped by id + dealer_id |
| `src/components/customers/CustomerForm.tsx` | Updated | Wired to server actions, handles create and edit modes |
| `src/components/customers/CustomerTable.tsx` | Updated | Accepts `CustomerDB[]` prop, optional `onEdit` callback |
| `src/components/customers/CustomersClient.tsx` | New | Client wrapper for modal/form state |
| `src/app/customers/page.tsx` | Updated | Server component — fetches customers, passes to client wrapper |

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
    ├── getCustomers() → SELECT * FROM customers WHERE dealer_id = ?
    │
    ├── createCustomer() → INSERT INTO customers (dealer_id = ?, ...)
    │
    └── updateCustomer() → UPDATE customers WHERE id = ? AND dealer_id = ?
```

A user with no `dealer_members` record receives an empty list and cannot write any data.

---

## 5. Why dealer_id Is Server-Injected

If `dealer_id` were accepted from the form:
- A malicious client could POST any `dealer_id` and write data into another dealer's tenant
- There would be no enforcement of ownership on INSERT

By injecting `dealer_id` server-side from `dealer_members`, this attack surface is eliminated even before RLS is applied.

---

## 6. Data Flow

### Read (getCustomers)

```
Server component (page.tsx)
    │
    ▼
getCustomers()
    ├── getCurrentDealer() → dealer_id
    └── supabase.from("customers").select("*").eq("dealer_id", dealer_id)
    │
    ▼
CustomerDB[] → CustomersClient → CustomerTable
```

### Write (createCustomer / updateCustomer)

```
CustomerForm (client)
    │  user fills form, submits
    ▼
createCustomer(formData) / updateCustomer(id, formData)
    ├── getCurrentDealer() → dealer_id  [server-side, not from form]
    ├── validate name required
    ├── supabase INSERT/UPDATE
    └── revalidatePath("/customers")  → page re-fetches automatically
```

---

## 7. Why Delete Is Excluded

DealerOS should implement **soft delete** when ready:

```sql
-- Planned soft delete columns (not yet in schema)
deleted_at  timestamptz null   -- NULL = active, set = soft-deleted
```

Hard delete (`DELETE FROM customers`) is excluded because:
- Deleting customers cascades to vehicles and estimates
- Soft delete allows recovery and audit trail
- Schema must confirm `deleted_at` column before implementing

Current `getCustomers()` already filters `.is("deleted_at", null)` in preparation.

---

## 8. Testing Checklist

| Check | Method | Expected |
|---|---|---|
| TypeScript type check | `tsc --noEmit` | No errors |
| Build | `npm run build` | Success |
| `/customers` page builds | Build output | Route present |
| `getCustomers()` scopes by `dealer_id` | Code review | `.eq("dealer_id", dealer.dealer_id)` present |
| `createCustomer()` does not accept `dealer_id` from form | Code review | `dealer_id` not in `formData.get()` calls |
| `updateCustomer()` scopes by id + dealer_id | Code review | `.eq("id", ...).eq("dealer_id", ...)` present |
| No `dealer_id` field in CustomerForm | Code review | No `dealer_id` input rendered |
| RLS migration NOT applied | Supabase Dashboard → Auth → Policies | No policies on customers table |
| Git status clean | `git status` | `nothing to commit` |

---

## 9. Next Phase

**PHASE31 — Vehicles CRUD**

- Connect `vehicles` page to Supabase
- Replace mock vehicle data with real queries
- Use `getCurrentDealer()` to scope all vehicle queries by `dealer_id`
- Vehicle create requires `customer_id` — customer must exist first
