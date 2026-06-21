# DealerOS — SaaS Authentication & Dealer Isolation Architecture

> **Status:** Design only. No SQL executed. No RLS applied. No Supabase connection.
> **Approval required before execution:** GPT CTO

---

## 1. Core Concept

DealerOS is a **multi-tenant SaaS** platform serving multiple GYEON authorized dealers nationwide.

| Principle | Description |
|---|---|
| Single Supabase project | All dealers share one database instance |
| Multiple dealers | Each dealer is an independent tenant |
| Mandatory data isolation | No dealer can read or write another dealer's data |
| User-to-dealer mapping | Users access data through `dealer_members`, not directly |

### Tenant Model

```
One Supabase Project
        │
        ├── Dealer A (e.g. GYEON Tokyo)
        │       ├── user: owner@tokyo.com
        │       ├── user: staff1@tokyo.com
        │       └── data: customers / vehicles / estimates (dealer_id = A)
        │
        ├── Dealer B (e.g. GYEON Osaka)
        │       ├── user: owner@osaka.com
        │       └── data: customers / vehicles / estimates (dealer_id = B)
        │
        └── Dealer C ...
```

Dealer A users **cannot access** Dealer B data under any circumstance.
Isolation is enforced at the database layer via RLS — not application logic.

---

## 2. Tables to Add in Future

### 2-1. dealers

Represents each GYEON authorized dealer as an independent tenant.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Tenant identifier |
| `name` | `text` | NOT NULL | Dealer name |
| `dealer_type` | `text` | | e.g. `authorized`, `premium` |
| `prefecture` | `text` | | 都道府県 |
| `address` | `text` | | 住所 |
| `phone` | `text` | | 電話番号 |
| `email` | `text` | | 代表メールアドレス |
| `status` | `text` | | `active`, `suspended`, `inactive` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

---

### 2-2. dealer_members

Junction table linking auth users to dealers with a role assignment.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `dealer_id` | `uuid` | NOT NULL, FK → `dealers.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users.id` ON DELETE CASCADE | |
| `role` | `text` | NOT NULL | See roles below |
| `status` | `text` | NOT NULL, default `'active'` | `active`, `suspended` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `(dealer_id, user_id)` — one membership per dealer per user.

---

## 3. Roles

| Role | Description | Typical Permissions |
|---|---|---|
| `owner` | Dealer owner | Full access + invite users + delete records |
| `manager` | Store manager | Full access to business data + invite staff |
| `staff` | Sales / service staff | SELECT / INSERT / UPDATE on business tables |
| `readonly` | Auditor / viewer | SELECT only |

> Role-based permission scoping is a Phase 2 concern. Phase 1 enforces dealer isolation only.

---

## 4. Access Model

A logged-in user may access business records **only when** the record's `dealer_id` belongs to one of their active dealer memberships.

```sql
-- Access predicate applied via RLS on every business table
business_table.dealer_id IN (
  SELECT dealer_id
  FROM dealer_members
  WHERE user_id = auth.uid()
    AND status = 'active'
)
```

### Multi-dealer membership

A single user (e.g. a regional manager) may belong to multiple dealers:

```
auth.uid() = user-X
    │
    ├── dealer_members: dealer_id = A, role = manager, status = active
    └── dealer_members: dealer_id = C, role = readonly, status = active
```

User-X can access data for Dealer A and Dealer C. Dealer B data is invisible.

---

## 5. Business Tables

All business tables retain `dealer_id uuid` as the tenant identifier.

| Table | dealer_id column | Role |
|---|---|---|
| `customers` | `dealer_id uuid` | Links customer to dealer tenant |
| `vehicles` | `dealer_id uuid` | Links vehicle to dealer tenant |
| `estimates` | `dealer_id uuid` | Links estimate to dealer tenant |
| `gyeon_service_estimates` | `dealer_id uuid` | Links service estimate to dealer tenant |

`dealer_id` on business tables references `dealers.id`, not `auth.users.id`.

---

## 6. RLS Strategy

### Policy pattern for all business tables

#### SELECT

```
USING (
  dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
```

#### INSERT

```
WITH CHECK (
  dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
```

#### UPDATE

```
USING (
  dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
WITH CHECK (
  dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
)
```

#### DELETE

```
USING (
  dealer_id IN (
    SELECT dealer_id FROM dealer_members
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'manager')
  )
)
```

> DELETE is restricted to `owner` and `manager` roles. Phase 2 implementation.

---

## 7. Authentication

### Phase 1 — Email + Password

| Item | Detail |
|---|---|
| Provider | Supabase Auth built-in |
| Method | `supabase.auth.signInWithPassword({ email, password })` |
| Session | Managed by `@supabase/ssr` |
| Identity | `auth.users.id` (UUID) |

### Phase 2 — LINE Login

| Item | Detail |
|---|---|
| Provider | LINE Login via OAuth 2.0 |
| Setup | LINE Developers console + Supabase Custom OAuth |
| Identity | LINE user ID → resolved to `auth.users.id` |

### Identity Mapping

Both providers resolve to the same identity:

```
Email + Password  ──┐
                    ├──▶  auth.users.id  ──▶  dealer_members.user_id  ──▶  dealer_id
LINE Login        ──┘
```

RLS policies reference `auth.uid()` exclusively. The login method is transparent to the access model.

---

## 8. Dealer Onboarding Flow

Recommended sequence for adding a new dealer to the system:

```
1. Platform admin creates dealer record in dealers table
        │
        ▼
2. Admin creates auth user for the dealer owner
   (Supabase Auth: email + temp password)
        │
        ▼
3. Admin inserts dealer_members record
   { dealer_id: <new dealer>, user_id: <owner uid>, role: 'owner', status: 'active' }
        │
        ▼
4. Owner logs in — RLS immediately filters to their dealer's data
        │
        ▼
5. Owner invites staff
   (creates auth users + dealer_members records with role: 'staff')
        │
        ▼
6. Staff logs in — same RLS enforcement applies
```

> Invitation UI and admin panel are future scope. Blocked until GPT CTO approval.

---

## 9. Why `dealer_id ≠ auth.uid()`

This is the critical architectural distinction.

| Concept | Identity Type | Cardinality |
|---|---|---|
| `auth.uid()` | **User identity** — who is logged in | 1 per person |
| `dealer_id` | **Tenant identity** — which business entity owns the data | 1 per dealer |

### The mismatch problem

If `dealer_id = auth.uid()`:

- Only one user could ever be associated with a dealer
- A dealer could never have multiple staff accounts
- A user could never switch between dealers
- The model breaks at the first hire

### The correct model

```
auth.uid()  →  dealer_members  →  dealer_id
  (who)          (membership)      (whose data)
```

This indirection enables:

| Capability | Enabled by |
|---|---|
| One dealer, many users | Multiple `dealer_members` rows with same `dealer_id` |
| One user, multiple dealers | Multiple `dealer_members` rows with same `user_id` |
| Role-based access | `role` column on `dealer_members` |
| Suspension without deletion | `status = 'suspended'` on `dealer_members` |

---

## 10. Implementation Order

| Phase | Task | Scope |
|---|---|---|
| **PHASE21** | Create `dealers` and `dealer_members` migration SQL file | File creation only — no execution |
| **PHASE22** | Rewrite RLS migration (`002_enable_rls.sql`) to use `dealer_members` subquery | File only — no execution |
| **PHASE23** | Apply `dealers` / `dealer_members` migration in Development Supabase | Manual SQL Editor execution |
| **PHASE24** | Apply rewritten RLS migration in Development Supabase | Manual SQL Editor execution |
| **PHASE25** | Authentication UI | Email+Password login/logout screen |

---

## Entity Relationship Overview

```
auth.users
    │
    │ user_id
    ▼
dealer_members ──── dealer_id ────▶ dealers
    │
    │ (via dealer_id subquery in RLS)
    ▼
customers ──────────────────────── dealer_id
    │
    ├──▶ vehicles ───────────────── dealer_id
    │
    └──▶ estimates ──────────────── dealer_id
               │
               └──▶ gyeon_service_estimates ── dealer_id
```

---

> **Implementation blocked until:**
> - GPT CTO approval
> - `dealers` and `dealer_members` tables created in Development Supabase
> - RLS policies reviewed and approved
> - Authentication UI specification provided
