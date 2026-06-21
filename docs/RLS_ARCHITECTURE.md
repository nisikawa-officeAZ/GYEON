# DealerOS — Row Level Security Architecture Design

> **Status:** Design only. No SQL executed. No RLS applied. No Supabase connection.
> **Approval required before execution:** GPT CTO

---

## 1. Dealer Isolation Principle

All business tables enforce dealer-level data isolation.

Every table contains a reserved column:

```
dealer_id  uuid  null
```

**Tables:**

| Table | dealer_id column | Status |
|---|---|---|
| `customers` | `dealer_id uuid null` | Reserved — not enforced yet |
| `vehicles` | `dealer_id uuid null` | Reserved — not enforced yet |
| `estimates` | `dealer_id uuid null` | Reserved — not enforced yet |
| `gyeon_service_estimates` | `dealer_id uuid null` | Reserved — not enforced yet |

> `dealer_id` is nullable in Phase 1. It becomes NOT NULL and enforced in Phase 2 (multi-dealer).

---

## 2. Access Rule Design

### Phase 1 — Single Dealer (Current Target)

Each authenticated user owns their own data.
`dealer_id` maps directly to `auth.uid()`.

**Access rule:**

```
WHERE dealer_id = auth.uid()
```

All operations (SELECT / INSERT / UPDATE / DELETE) are restricted to rows where `dealer_id` matches the authenticated user's UUID.

### Phase 2 — Multi-Dealer (Future)

A `dealer_members` junction table will be introduced.

**Access rule:**

```
WHERE dealer_id IN (
  SELECT dealer_id
  FROM dealer_members
  WHERE user_id = auth.uid()
)
```

> Phase 2 is not implemented. Blocked until GPT CTO approval.

---

## 3. RLS Policy Design

### Policy Pattern (per table)

| Policy Name | Operation | Rule |
|---|---|---|
| `select_own` | SELECT | `dealer_id = auth.uid()` |
| `insert_own` | INSERT | `dealer_id = auth.uid()` |
| `update_own` | UPDATE | `dealer_id = auth.uid()` |
| `delete_own` | DELETE | `dealer_id = auth.uid()` |

### Policy Design per Table

---

#### customers

| Policy | Operation | Using / With Check |
|---|---|---|
| `customers_select_own` | SELECT | `dealer_id = auth.uid()` |
| `customers_insert_own` | INSERT | `dealer_id = auth.uid()` |
| `customers_update_own` | UPDATE | `dealer_id = auth.uid()` |
| `customers_delete_own` | DELETE | `dealer_id = auth.uid()` |

---

#### vehicles

| Policy | Operation | Using / With Check |
|---|---|---|
| `vehicles_select_own` | SELECT | `dealer_id = auth.uid()` |
| `vehicles_insert_own` | INSERT | `dealer_id = auth.uid()` |
| `vehicles_update_own` | UPDATE | `dealer_id = auth.uid()` |
| `vehicles_delete_own` | DELETE | `dealer_id = auth.uid()` |

---

#### estimates

| Policy | Operation | Using / With Check |
|---|---|---|
| `estimates_select_own` | SELECT | `dealer_id = auth.uid()` |
| `estimates_insert_own` | INSERT | `dealer_id = auth.uid()` |
| `estimates_update_own` | UPDATE | `dealer_id = auth.uid()` |
| `estimates_delete_own` | DELETE | `dealer_id = auth.uid()` |

---

#### gyeon_service_estimates

| Policy | Operation | Using / With Check |
|---|---|---|
| `gyeon_select_own` | SELECT | `dealer_id = auth.uid()` |
| `gyeon_insert_own` | INSERT | `dealer_id = auth.uid()` |
| `gyeon_update_own` | UPDATE | `dealer_id = auth.uid()` |
| `gyeon_delete_own` | DELETE | `dealer_id = auth.uid()` |

---

### RLS Enablement

RLS must be explicitly enabled on each table before policies take effect.

```
alter table customers               enable row level security;
alter table vehicles                enable row level security;
alter table estimates               enable row level security;
alter table gyeon_service_estimates enable row level security;
```

> Not executed. Design only.

---

## 4. Authentication Design

### Phase 1 — Email + Password (Current Target)

| Item | Value |
|---|---|
| Provider | Supabase Auth built-in |
| Method | `supabase.auth.signInWithPassword({ email, password })` |
| Session | Managed by `@supabase/ssr` |
| User identity | `auth.users.id` (UUID) |
| Mapped to | `dealer_id` on all tables |

### Phase 2 — LINE Login (Future)

| Item | Value |
|---|---|
| Provider | LINE Login via OAuth 2.0 |
| Method | LINE Developers console + Supabase Custom OAuth |
| User identity | LINE user ID → mapped to `auth.users.id` |
| Mapped to | Same `dealer_id` mechanism as Phase 1 |

> LINE Login is not implemented. Blocked until GPT CTO approval and LINE Developers console setup.

### Identity Mapping

Both authentication methods resolve to the same identity:

```
Email + Password  ──┐
                    ├──▶  auth.users.id  ──▶  dealer_id
LINE Login        ──┘
```

All RLS policies reference `auth.uid()`, which returns `auth.users.id` regardless of login method.

---

## 5. Data Flow

```
Authenticated User
        │
        │  auth.uid()
        ▼
   dealer_id  ◀── set on INSERT, enforced on all operations
        │
        ├──▶  customers
        │          │
        │          ▼
        │       vehicles
        │
        └──▶  estimates
                   │
                   ▼
          gyeon_service_estimates
```

### Flow Description

| Step | Action |
|---|---|
| 1 | User authenticates via Email+Password (or LINE Login in Phase 2) |
| 2 | Supabase Auth issues JWT containing `auth.uid()` |
| 3 | All queries pass JWT automatically via `@supabase/ssr` session |
| 4 | RLS evaluates `dealer_id = auth.uid()` on every row operation |
| 5 | Rows not matching `dealer_id` are invisible and inaccessible |
| 6 | INSERT automatically sets `dealer_id = auth.uid()` via policy `WITH CHECK` |

---

## 6. Implementation Sequence (Future)

When approved, execute in this order:

```
1. Enable RLS on all 4 tables
2. Create SELECT policies
3. Create INSERT policies
4. Create UPDATE policies
5. Create DELETE policies
6. Verify with test user: confirm cross-dealer isolation
```

> No implementation until GPT CTO approval.

---

## 7. Reserved for Phase 2

| Item | Description |
|---|---|
| `dealer_members` table | Junction table: `user_id`, `dealer_id`, `role` |
| Multi-dealer policy | `auth.uid() IN (SELECT user_id FROM dealer_members WHERE dealer_id = table.dealer_id)` |
| Role-based access | `role IN ('owner', 'staff')` scoping for UPDATE/DELETE |

---

> **Execution blocked until:**
> - GPT CTO approval
> - Tables confirmed created in Development Supabase
> - Auth configured in Development Supabase
> - RLS policies reviewed and approved
