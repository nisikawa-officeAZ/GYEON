# IMPLEMENTATION SPRINT 8.1 REPORT
## GYEON Detailer Agent — Onboarding Stability Fix

| Field | Value |
|-------|-------|
| **Sprint** | 8.1 — Onboarding Stability Fix |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `2720b1a` fix(onboarding): prevent duplicate customer on retry |
| **Files changed** | 1 |
| **Lines added** | +12 / -3 |

---

## 1. Build Checks

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ PASS — 0 errors |
| Build | `npm run build` | ✅ PASS — 37/37 pages |
| Lint | `npm run lint` | N/A — no lint script |

---

## 2. Root Cause

`handleConfirm` used `isNewCustomer = existingCustomerId === null` to decide whether to call `createCustomer`. This flag never changed after a successful customer creation. On a retry (user clicks submit again after a vehicle creation failure), `isNewCustomer` was still `true` → `createCustomer` was called again → duplicate customer row in the database.

**Failure sequence (before fix):**

```
Attempt 1:
  createCustomer()  → ✅ customer A created (ID: abc123)
  createVehicle()   → ❌ server error
  setError("...")   → user sees error, presses confirm again

Attempt 2 (BUG):
  isNewCustomer = true (flag never updated)
  createCustomer()  → ✅ customer A' created (duplicate, ID: def456)
  createVehicle()   → may succeed → vehicle attached to wrong customer
```

---

## 3. Implementation

**File:** `src/components/onboarding/CustomerVehicleOnboardingWizard.tsx`

**Change 1 — Add `createdCustomerId` state** (line 105):

```typescript
const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
```

Persists the ID of a successfully created customer across retry attempts within the same wizard session.

**Change 2 — Replace `handleConfirm` customer ID resolution** (was lines 156–162, now lines 157–165):

Before:
```typescript
let customerId = existingCustomerId ?? "";

if (isNewCustomer) {
  // ... create customer ...
  customerId = customerResult.customerId;
}
```

After:
```typescript
let customerId: string;

if (existingCustomerId !== null) {
  // Existing customer path — use selected customer ID directly
  customerId = existingCustomerId;
} else if (createdCustomerId) {
  // Retry path — customer already created on a previous attempt; reuse to prevent duplicate
  customerId = createdCustomerId;
} else {
  // New customer, first attempt — create now
  // ...
  customerId = customerResult.customerId;
  setCreatedCustomerId(customerResult.customerId);
}
```

**Change 3 — Store ID after creation** (inside the `else` branch):

```typescript
setCreatedCustomerId(customerResult.customerId);
```

---

## 4. State Machine After Fix

```
handleConfirm() called:

  ┌─ existingCustomerId ≠ null?
  │     YES → customerId = existingCustomerId
  │           createCustomer() skipped
  │
  ├─ createdCustomerId set?
  │     YES → customerId = createdCustomerId   ← RETRY PATH (fix)
  │           createCustomer() skipped
  │
  └─ else (first attempt, new customer)
        createCustomer()
        setCreatedCustomerId(result.id)        ← store for retry
        customerId = result.id

  → createVehicle(customerId)
```

`createCustomer` is now called **at most once** per wizard session for a new customer.

---

## 5. Regression Results

| Scenario | Expected | Verified |
|----------|---------|---------|
| Existing customer → vehicle created | `existingCustomerId` used, no `createCustomer` call | ✅ |
| New customer + manual, first attempt | `createCustomer` called once, `createdCustomerId` stored | ✅ |
| New customer + OCR, first attempt | same as above | ✅ |
| Retry after `createVehicle` failure | `createdCustomerId` branch taken, `createCustomer` skipped | ✅ |
| Manual retry (user changes vehicle fields, resubmits) | same as above | ✅ |
| Back-nav to vehicle-form then confirm again | `createdCustomerId` still set → no duplicate | ✅ |
| `handleConfirm` button `disabled` during `isPending` | unchanged — prevents concurrent submissions | ✅ |
| OCR path, `createVehicle` fails, retry | OCR-pre-filled customer reused | ✅ |
| TypeScript — `let customerId: string` all paths assigned | three-way `if/else if/else` guarantees assignment | ✅ |

---

## 6. Risk Assessment

| Risk | Assessment |
|------|-----------|
| Regression to existing customer path | None — `existingCustomerId !== null` branch unchanged in behavior |
| Regression to first-attempt new customer path | None — `else` branch is the original code path |
| TypeScript safety | `let customerId: string` without initializer — TypeScript confirms all branches assign before use |
| State leak between sessions | N/A — `createdCustomerId` is component state; resets on component unmount (modal close) |
| Edge case: user navigates back to `customer-select`, selects different existing customer | `existingCustomerId !== null` branch takes priority over `createdCustomerId`; correct behavior |
| Orphaned customer if user abandons after `createCustomer` succeeds but before `createVehicle` | Pre-existing concern — not introduced by this fix. Orphaned customer has no vehicle; can be cleaned up from Customers page |

**Net risk: Zero** — fix is additive (new state variable + branch condition). All existing code paths are preserved structurally; only the retry path is new.

---

## 7. W-OB-005 Status

**RESOLVED** — See ONBOARDING_BUG_BACKLOG.md for updated status.

---

*GYEON Detailer Agent | Implementation Sprint 8.1 Report | Office AZ | 2026-06-25*
