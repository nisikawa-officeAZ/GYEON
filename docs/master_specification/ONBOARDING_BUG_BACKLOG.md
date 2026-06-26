# ONBOARDING BUG BACKLOG
## GYEON Detailer Agent — CustomerVehicleOnboardingWizard

| Field | Value |
|-------|-------|
| **Created** | 2026-06-25 |
| **Sprint** | 8 — Onboarding E2E Validation |
| **Open bugs** | 4 |
| **Resolved** | 1 (W-OB-005, Sprint 8.1) |

---

## W-OB-005 — Partial creation failure causes duplicate customer on retry

| Field | Value |
|-------|-------|
| **Bug ID** | W-OB-005 |
| **Severity** | MEDIUM |
| **Status** | ✅ RESOLVED (Sprint 8.1) |
| **Type** | Data integrity |
| **Found in sprint** | 8 |
| **Fixed in sprint** | 8.1 |
| **Commit** | `2720b1a` fix(onboarding): prevent duplicate customer on retry |

### Description

If `createCustomer` succeeds but `createVehicle` subsequently fails, the confirm screen shows the vehicle error. The user sees the error and may correct the vehicle form. When they click "登録して見積作成へ" again, `handleConfirm` re-enters the `if (isNewCustomer)` block and calls `createCustomer` a second time — creating a duplicate customer in the database.

### Root cause

`handleConfirm` determines whether to call `createCustomer` via `isNewCustomer = existingCustomerId === null`. This flag is never updated after a successful `createCustomer` call. On retry, `existingCustomerId` is still null → `createCustomer` is called again.

### Affected file

`src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — `handleConfirm` function (lines 153–209)

### Recommended fix

After a successful `createCustomer`, store the returned ID in state:

```typescript
const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);

// In handleConfirm, after successful createCustomer:
setCreatedCustomerId(customerResult.customerId);
customerId = customerResult.customerId;

// Then use: let customerId = createdCustomerId ?? existingCustomerId ?? "";
// And skip createCustomer if createdCustomerId is already set
```

### Impact

- **Likelihood:** Low — requires createCustomer to succeed AND createVehicle to fail (server error), then user retries
- **Effect:** Duplicate customer in DB for the same dealer
- **Workaround:** Operator can delete the duplicate from the Customers page

---

## W-OB-001 — Back-navigation from customer-form overwrites manual edits on OCR re-apply

| Field | Value |
|-------|-------|
| **Bug ID** | W-OB-001 |
| **Severity** | LOW |
| **Status** | Open |
| **Type** | UX / data loss risk |
| **Found in sprint** | 8 |

### Description

In the OCR path: if the user applies OCR fields (navigated to customer-form), makes manual edits in the customer form, then presses "← 戻る" to return to `ocr-review` and clicks "フォームへ反映" again, the `applyOcrFields()` call overwrites the manual edits made in customer-form.

### Root cause

`applyOcrFields(selected)` uses spread merge `setCustomerForm(f => ({ ...f, ...customerData }))`. If the user re-applies OCR, `customerData` values overwrite whatever was manually set.

### Affected file

`src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — `applyOcrFields` function (lines 136–141)

### Impact

- **Likelihood:** Very low — requires deliberate back-navigation to ocr-review and explicit re-apply
- **Effect:** Manual edits to customer-form lost
- **Workaround:** User can re-enter manual data in customer-form after returning

---

## W-OB-002 — router.refresh() race condition: wizard briefly opens with stale customer list

| Field | Value |
|-------|-------|
| **Bug ID** | W-OB-002 |
| **Severity** | LOW |
| **Status** | Open |
| **Type** | Race condition / UX |
| **Found in sprint** | 8 |

### Description

In `EstimatesClient.tsx`, `onComplete` fires `router.refresh()` and `setModal({ mode: "create" })` synchronously. The Estimate Wizard opens immediately. The `router.refresh()` runs concurrently and updates the `customers` and `vehicles` props when complete. During the brief window between wizard open and refresh completion, the wizard shows the pre-creation customer list (without the newly created customer).

### Root cause

```typescript
onComplete={() => {
  router.refresh();               // async — runs in background
  setModal({ mode: "create" });   // synchronous — opens wizard immediately
}}
```

### Affected file

`src/components/estimates/EstimatesClient.tsx` — onboarding `onComplete` callback (line ~96)

### Recommended fix (low priority)

No functional defect — the new customer IS in the DB and the wizard will show it after refresh. If the operator creates an estimate right away (before refresh propagates), the customer selection in wizard step1 may not show the new customer. Once refresh completes (< 1s typically), it appears.

One option: delay wizard open until refresh resolves:
```typescript
onComplete={async () => {
  await router.refresh();
  setModal({ mode: "create" });
}}
```
Note: `router.refresh()` does not actually return a Promise in current Next.js App Router. True awaiting requires a workaround.

### Impact

- **Likelihood:** Low — only affects users who start creating an estimate within ~1 second of completing onboarding
- **Effect:** Operator cannot immediately select the new customer in wizard step1 (it appears ~1s later)

---

## W-OB-003 — No vehicle field validation allows empty vehicle creation

| Field | Value |
|-------|-------|
| **Bug ID** | W-OB-003 |
| **Severity** | LOW |
| **Status** | Open |
| **Type** | Missing validation |
| **Found in sprint** | 8 |

### Description

The `vehicle-form` screen's "次へ → 確認" button has no validation. The user can proceed to `confirm` and create a vehicle with zero identifying data (empty maker, model, plate number, VIN). `createVehicle` succeeds with all-null optional fields — the result is a vehicle row with only `customer_id` and `dealer_id`.

### Affected file

`src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — vehicle-form "次へ" button (line ~611)

### Impact

- **Likelihood:** Low — operator oversight
- **Effect:** Vehicle row created with no identifiers; shows as "(無し)" or blank in lists
- **Note:** Vehicle fields are intentionally optional per the schema design (`VehicleInsert` has all fields optional except `customer_id` and `dealer_id`)

---

## W-OB-004 — Existing customer path has no OCR option for vehicle data

| Field | Value |
|-------|-------|
| **Bug ID** | W-OB-004 |
| **Severity** | LOW |
| **Status** | Open |
| **Type** | Feature gap |
| **Found in sprint** | 8 |

### Description

When an existing customer is selected, the flow navigates directly to `vehicle-form` (manual entry only). There is no option to scan a 車検証 to pre-fill vehicle data. The OCR path is only available during new customer registration.

### Affected file

`src/components/onboarding/CustomerVehicleOnboardingWizard.tsx` — `customer-select` existing customer onClick (line ~264)

### Impact

- **Likelihood:** High — any operator registering a vehicle for an existing customer
- **Effect:** Must enter vehicle data manually even if they have the 車検証 available
- **Severity justification:** LOW — manual entry works correctly; this is a UX improvement, not a defect

### Recommended fix

Add a `vehicle-method` screen between `customer-select` (existing path) and `vehicle-form`, identical to `customer-method` but for vehicle data:

```
[existing customer selected] → vehicle-method → OCR upload → OCR review → vehicle-form
                                              → manual → vehicle-form
```

---

*GYEON Detailer Agent | Onboarding Bug Backlog | Office AZ | 2026-06-25*
