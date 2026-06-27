# RC-08: Detailer Core Field Persistence

## Overview

RC-08 adds three missing vehicle columns and three missing customer columns to
the DealerOS database, and wires them through the TypeScript types, server
actions, forms, and the EstimateWizard OCR pre-fill.

---

## Migration

**File:** `supabase/migrations/073_detailer_core_missing_fields.sql`

> **MANUAL APPLY ONLY.**
> Do NOT run this migration automatically. Apply it in the Supabase dashboard
> SQL editor, or via the CLI on a deliberate operator action:
>
> ```
> supabase db push
> ```
>
> Verify the migration was applied before deploying the updated application
> to production.

### SQL

```sql
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS displacement      text,
  ADD COLUMN IF NOT EXISTS fuel_type         text,
  ADD COLUMN IF NOT EXISTS registration_date date;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_business         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_discount_pct  numeric(5,2) NOT NULL DEFAULT 0
    CONSTRAINT trade_discount_pct_range
      CHECK (trade_discount_pct >= 0 AND trade_discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS credit_terms        text;
```

All statements use `IF NOT EXISTS` — safe to run more than once.
No DROP statements. Existing rows receive safe defaults.

---

## New Columns

### vehicles table

| Column              | Type   | Description                                 |
|---------------------|--------|---------------------------------------------|
| `displacement`      | text   | Engine displacement, e.g. "1998cc"          |
| `fuel_type`         | text   | Fuel kind: ガソリン / ディーゼル / HV / BEV etc. |
| `registration_date` | date   | 初年度登録 (first registration date) YYYY-MM-DD |

### customers table

| Column               | Type          | Description                           |
|----------------------|---------------|---------------------------------------|
| `is_business`        | boolean       | True for business/dealer customers     |
| `trade_discount_pct` | numeric(5,2)  | Trade discount rate 0–100 (%)         |
| `credit_terms`       | text          | Payment terms, e.g. "翌月末払い"       |

---

## Changed Files

### Types
- `src/lib/customers/customer-types.ts` — added `is_business`, `trade_discount_pct`, `credit_terms`
- `src/lib/vehicles/vehicle-types.ts` — added `displacement`, `fuel_type`, `registration_date`

### Server Actions
- `src/lib/customers/create-customer.ts` — inserts new customer columns; clamps `trade_discount_pct` to [0, 100]
- `src/lib/customers/update-customer.ts` — updates new customer columns; clears `credit_terms` when `is_business=false`
- `src/lib/vehicles/create-vehicle.ts` — inserts new vehicle columns
- `src/lib/vehicles/update-vehicle.ts` — updates new vehicle columns

### Forms
- `src/components/customers/CustomerForm.tsx` — removed occupation/notes encoding workaround; reads directly from DB columns; encodes `is_business`, `trade_discount_pct`, `credit_terms` in FormData
- `src/components/vehicles/VehicleForm.tsx` — added displacement, fuel_type (dropdown), registration_date fields

### OCR
- `src/lib/vehicle-registration/vehicle-registration-types.ts` — updated `OCR_TO_VEHICLE_MAP`: `first_registration_date → registration_date`, added `fuel_type → fuel_type`, `displacement → displacement`

### EstimateWizard
- `src/components/estimates/EstimateWizard.tsx` — OCR pre-fill now populates `displacement`, `fuel_type`, `registration_date` in `nv` state; new vehicle FormData includes all three; new customer FormData uses `is_business`/`trade_discount_pct` (not occupation/notes); selecting an existing business customer auto-sets `isDealer=true` and `dealerRate` from DB

---

## Security Notes

- `dealer_id` is never accepted from client FormData.  It is always injected server-side from `getCurrentDealer()`.
- `trade_discount_pct` is validated server-side: clamped to [0, 100], rounded to 2 decimal places, NaN treated as 0.
- `credit_terms` is stored only when `is_business=true`; it is cleared to `null` otherwise.

---

## Verification Checklist

After applying the migration:

- [ ] Create a business customer from CustomerForm — confirm `is_business=true`, `trade_discount_pct`, `credit_terms` are saved to DB
- [ ] Edit that customer — confirm the business toggle and rate are loaded from DB (not from occupation/notes)
- [ ] Create a vehicle from VehicleForm — confirm `displacement`, `fuel_type`, `registration_date` are saved
- [ ] Edit that vehicle — confirm the three new fields are pre-populated
- [ ] Run OCR on a vehicle registration certificate — confirm `displacement`, `fuel_type`, `registration_date` are pre-filled in the review form
- [ ] In EstimateWizard: select an existing business customer — confirm `isDealer` and `dealerRate` are automatically applied
- [ ] In EstimateWizard: create a new vehicle via wizard — confirm all three new fields are passed and saved

---

## Previous Workaround (now removed)

RC-06 encoded business customer data into standard columns as a workaround:
- `occupation = "業者"` to flag business customer
- `notes` prefix: `業販掛け率: XX%\n与信条件: ...`

This workaround is fully removed in RC-08. The dedicated columns (`is_business`,
`trade_discount_pct`, `credit_terms`) replace it.

> NOTE: Any customers created with the RC-06 workaround will have stale
> `occupation`/`notes` data. A one-time data migration should be run in
> production to backfill `is_business` and `trade_discount_pct` from those
> notes patterns if needed.
