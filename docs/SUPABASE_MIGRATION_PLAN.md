# DealerOS — Supabase Migration Plan

> **Status:** Design only. No SQL executed. No migrations applied. No Supabase connection.
> **Approval required before execution:** GPT CTO

---

## Migration Order

Migrations must be applied in sequence due to foreign key dependencies.

```
001_customers
002_vehicles
003_estimates
004_gyeon_service_estimates
```

---

## 001_customers

**Purpose:** Create the root customer table. All other tables depend on this.

**Columns:**

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | NOT NULL |
| `kana` | `text` | |
| `phone` | `text` | |
| `email` | `text` | |
| `postal_code` | `text` | |
| `address` | `text` | |
| `line_id` | `text` | |
| `memo` | `text` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Reserved (not created yet):**
- `dealer_id uuid`
- `deleted_at timestamptz`
- `line_user_id text`

**Indexes:**
- `customers_phone_idx` → `phone`
- `customers_email_idx` → `email`

**RLS:** Enabled. Users access only own records.

---

## 002_vehicles

**Purpose:** Create vehicle table linked to customers.

**Columns:**

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `customer_id` | `uuid` | NOT NULL, FK → `customers.id` ON DELETE CASCADE |
| `manufacturer` | `text` | NOT NULL |
| `model` | `text` | NOT NULL |
| `year` | `text` | |
| `grade` | `text` | |
| `body_color` | `text` | |
| `license_plate` | `text` | |
| `vin` | `text` | |
| `memo` | `text` | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Foreign Key:**
```
vehicles.customer_id → customers.id  (ON DELETE CASCADE)
```

**Reserved:**
- `dealer_id uuid`
- `deleted_at timestamptz`

**Indexes:**
- `vehicles_license_plate_idx` → `license_plate`
- `vehicles_customer_id_idx` → `customer_id`

**RLS:** Enabled. Users access only records linked to own customers.

---

## 003_estimates

**Purpose:** Create estimate table linked to customers and vehicles.

**Columns:**

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `customer_id` | `uuid` | NOT NULL, FK → `customers.id` ON DELETE CASCADE |
| `vehicle_id` | `uuid` | FK → `vehicles.id` ON DELETE SET NULL |
| `estimate_no` | `text` | NOT NULL, UNIQUE |
| `status` | `text` | NOT NULL, CHECK IN (`DRAFT`,`SENT`,`APPROVED`,`REJECTED`) |
| `subtotal` | `integer` | NOT NULL, default `0` |
| `tax` | `integer` | NOT NULL, default `0` |
| `total` | `integer` | NOT NULL, default `0` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Foreign Keys:**
```
estimates.customer_id → customers.id  (ON DELETE CASCADE)
estimates.vehicle_id  → vehicles.id   (ON DELETE SET NULL)
```

> `vehicle_id` uses SET NULL (not CASCADE) to preserve estimates if a vehicle is deleted.

**Reserved:**
- `dealer_id uuid`
- `deleted_at timestamptz`

**Indexes:**
- `estimates_estimate_no_idx` → `estimate_no` (UNIQUE)
- `estimates_created_at_idx` → `created_at`
- `estimates_customer_id_idx` → `customer_id`
- `estimates_status_idx` → `status`

**RLS:** Enabled. Users access only own estimates.

---

## 004_gyeon_service_estimates

**Purpose:** Create GYEON detailing service estimate detail table linked to estimates.

**Columns:**

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `estimate_id` | `uuid` | NOT NULL, FK → `estimates.id` ON DELETE CASCADE |
| `service_category` | `text` | NOT NULL |
| `body_size` | `text` | NOT NULL |
| `base_price` | `integer` | NOT NULL, default `0` |
| `options_json` | `jsonb` | NOT NULL, default `'{}'` |
| `discount` | `integer` | NOT NULL, default `0` |
| `subtotal` | `integer` | NOT NULL, default `0` |
| `tax` | `integer` | NOT NULL, default `0` |
| `total` | `integer` | NOT NULL, default `0` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

**Foreign Key:**
```
gyeon_service_estimates.estimate_id → estimates.id  (ON DELETE CASCADE)
```

**Reserved:**
- `dealer_id uuid`
- `deleted_at timestamptz`

**Indexes:**
- `gyeon_service_estimates_estimate_id_idx` → `estimate_id`

**RLS:** Enabled. Users access only own service estimates.

---

## Foreign Key Summary

```
vehicles.customer_id              → customers.id       CASCADE
estimates.customer_id             → customers.id       CASCADE
estimates.vehicle_id              → vehicles.id        SET NULL
gyeon_service_estimates.estimate_id → estimates.id     CASCADE
```

---

## Index Summary

| Table | Index | Column |
|---|---|---|
| `customers` | `customers_phone_idx` | `phone` |
| `customers` | `customers_email_idx` | `email` |
| `vehicles` | `vehicles_license_plate_idx` | `license_plate` |
| `estimates` | `estimates_estimate_no_idx` | `estimate_no` (UNIQUE) |
| `estimates` | `estimates_created_at_idx` | `created_at` |

---

## Future Reserved Columns

These columns are **not created** in initial migrations. Reserved for future phases.

| Column | Type | Purpose |
|---|---|---|
| `dealer_id` | `uuid` | Multi-dealer support — FK to future `dealers` table |
| `deleted_at` | `timestamptz` | Soft delete — `NULL` means active |
| `line_user_id` | `text` | LINE Login user ID — on `customers` table |

---

## RLS Preparation

### Current strategy (Phase 1)
- RLS enabled on all tables at creation.
- Policy: `auth.uid() = user_id` (single-user per record).
- All INSERT policies set `user_id = auth.uid()` automatically.

### Future strategy (Phase 2 — Multi-dealer)
- `dealer_id` column added to all tables.
- `dealer_members` junction table created (`user_id`, `dealer_id`, `role`).
- RLS policy expands to:
  ```
  auth.uid() IN (
    SELECT user_id FROM dealer_members
    WHERE dealer_id = <table>.dealer_id
  )
  ```
- No implementation until GPT CTO approval.

---

## Dependency Graph

```
001_customers
      │
      ├── 002_vehicles
      │         │
      │         └── 003_estimates
      │                   │
      │                   └── 004_gyeon_service_estimates
      │
      └── 003_estimates (also depends directly)
```

---

> **Execution blocked until:**
> - GPT CTO approval
> - Supabase project URL and anon key configured in `.env.local`
> - RLS policies reviewed and approved
> - Migrations tested in development environment only
