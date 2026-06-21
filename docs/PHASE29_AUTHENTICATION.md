# DealerOS — PHASE29 Authentication Foundation

> **Status:** Implemented. RLS migration NOT applied yet.
> **Environment:** Development only.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. Purpose

Establish the authentication foundation for DealerOS as a multi-tenant SaaS system.

This phase implements:
- Email + Password login via Supabase Auth
- Logout with session clear
- Server-side current user resolution
- Server-side dealer membership resolution via `dealer_members`
- Protected route readiness (per-page, not middleware yet)

---

## 2. Architecture Rule

### dealer_id MUST NOT equal auth.uid()

| Concept | Value | Represents |
|---|---|---|
| `auth.uid()` | UUID of the logged-in user | **Who** is authenticated |
| `dealer_id` | UUID of the dealer tenant | **Whose data** is being accessed |

These are different values. Equating them would mean one user = one dealer forever, which breaks:
- Multi-staff dealers
- Future role-based access
- User account transfers or invitations

### Correct access resolution

```
auth.uid()
    │
    ▼
dealer_members.user_id  (WHERE status = 'active')
    │
    ▼
dealer_members.dealer_id  →  used to filter business data
```

---

## 3. Auth Flow

```
User visits /login
    │
    ▼
Enters email + password
    │
    ▼
supabase.auth.signInWithPassword({ email, password })
    │
    ├── Error → show "Invalid email or password."
    │
    └── Success → router.push("/")
                      │
                      ▼
               Session stored in cookies (via @supabase/ssr)
                      │
                      ▼
               Pages can call getCurrentUser() → User
                      │
                      ▼
               Pages can call getCurrentDealer() → { dealer_id, role }
```

---

## 4. dealer_members Based Isolation

`getCurrentDealer()` queries:

```sql
SELECT dealer_id, role
FROM dealer_members
WHERE user_id = auth.uid()
  AND status = 'active'
LIMIT 1
```

Returns `{ dealer_id, role }` or `null`.

Business pages use the returned `dealer_id` to scope data queries. This is the foundation for all future CRUD operations.

---

## 5. Why 004_enable_saas_rls.sql Is Not Applied Yet

`004_enable_saas_rls.sql` references `dealer_members` in every RLS policy. Applying it before:
- Authentication is working
- `dealer_members` records exist for test users

...would lock all data immediately with no way to read or write.

**Correct sequence:**
```
1. Authentication working (PHASE29 — current)
2. Create test dealer and dealer_members record manually
3. Verify getCurrentDealer() returns correct dealer_id
4. Apply 004_enable_saas_rls.sql (PHASE30 or later)
5. Verify data isolation works end-to-end
```

---

## 6. Files Created

| File | Type | Purpose |
|---|---|---|
| `src/app/login/page.tsx` | Client component | Email + password login form |
| `src/lib/auth/get-current-user.ts` | Server helper | Returns current `auth.users` record or null |
| `src/lib/auth/get-current-dealer.ts` | Server helper | Queries `dealer_members`, returns `{ dealer_id, role }` or null |
| `src/components/auth/LogoutButton.tsx` | Client component | Signs out and redirects to `/login` |

---

## 7. Protected Route Pattern (Future Use)

Pages that require authentication can use this pattern:

```typescript
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { redirect }         from "next/navigation";

export default async function ProtectedPage() {
  const user   = await getCurrentUser();
  const dealer = await getCurrentDealer();

  if (!user)   redirect("/login");
  if (!dealer) redirect("/login"); // no active dealer membership

  // page content
}
```

This pattern is not yet applied to existing pages. Existing pages continue to use mock data and are unaffected.

---

## 8. Testing Checklist

| Check | Method | Expected |
|---|---|---|
| `npm run lint` | CLI | No errors |
| `npm run build` | CLI | Build succeeds |
| Login page renders | Browser → `/login` | Form visible, no crash |
| Invalid credentials | Submit wrong email/pass | "Invalid email or password." appears |
| Valid login | Submit correct credentials | Redirects to `/` |
| Logout | Click Sign Out | Redirects to `/login`, session cleared |
| `getCurrentUser()` returns null | Unauthenticated call | Returns `null`, no throw |
| `getCurrentDealer()` queries `dealer_members` | Authenticated call | Returns `{ dealer_id, role }` or `null` |
| RLS migration NOT applied | Supabase Dashboard → Auth → Policies | No policies on business tables |
| Git status clean after commit | `git status` | `nothing to commit` |

---

## 9. Next Phase

**PHASE30 — Customers CRUD**

- Connect `customers` page to Supabase
- Replace mock data with real queries
- Use `getCurrentDealer()` to scope all queries by `dealer_id`
- Requires `.env.local` configured locally
- Requires at least one `dealer_members` record for the test user
