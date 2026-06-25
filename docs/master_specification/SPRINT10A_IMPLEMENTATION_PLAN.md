# Sprint 10A — Implementation Plan
## Dealer Application & Admin Approval Flow

| Field | Value |
|-------|-------|
| **Sprint** | 10A |
| **Created** | 2026-06-26 |
| **Status** | Ready to implement (pending migration approval) |
| **Decisions** | Locked in `SPRINT10_APPROVAL_FLOW_SPEC.md` |
| **Commit target** | `Sprint 10A: dealer approval flow` |
| **Files to change** | 14 |

---

## Prerequisites Before Starting

- [ ] CTO reviews and approves `supabase/migrations/071_dealer_approval_flow.sql`
- [ ] Migration applied to **staging** environment
- [ ] Backfill verified on staging: `SELECT approval_status, COUNT(*) FROM dealers GROUP BY approval_status` — zero NULLs
- [ ] No existing dealers locked out after staging migration (login tested)

**Do not begin code implementation until staging migration is verified.**

---

## Phase A — Migration Tracking

### A1. Update migration probe list

**File:** `src/lib/migrations/migration-types.ts`
**Function:** `getExpectedMigrationList()`
**Change:** Append entry at the end of the return array:

```typescript
{
  number:  28,
  filename: "071_dealer_approval_flow.sql",
  purpose:  "Add approval_status/approved_by/approved_at to dealers; backfill existing",
  probe:    { type: "column", table: "dealers", column: "approval_status" },
},
```

---

## Phase B — Server Layer

### B1. Update `getCurrentDealer()`

**File:** `src/lib/auth/get-current-dealer.ts`

**Current behaviour:** Queries `dealer_members` only; returns `{ dealer_id, role } | null`.

**Required behaviour after migration:**
- Join `dealers` table in same query
- Enforce `dealers.approval_status = 'approved'` AND `dealers.status = 'active'`
- NULL-safe fallback: if `approval_status` is absent from response (migration not applied), treat as `'approved'`
- Return type unchanged: `DealerMembership | null`

**Query change (conceptual — must be tested for Supabase PostgREST syntax):**
```typescript
const { data, error } = await supabase
  .from("dealer_members")
  .select("dealer_id, role, dealers!inner(approval_status, status)")
  .eq("user_id", user.id)
  .eq("status", "active")
  .single();

if (error || !data) return null;

const dealer = data.dealers as { approval_status?: string; status?: string } | null;
// NULL-safe fallback: if column absent, allow through
const approvalOk = dealer?.approval_status == null || dealer.approval_status === "approved";
const statusOk   = dealer?.status          == null || dealer.status          === "active";
if (!approvalOk || !statusOk) return null;

return { dealer_id: data.dealer_id, role: data.role };
```

**Important:** The NULL-safe fallback (`== null` check) ensures no lockout if the migration has not been applied. Once migration is confirmed on production, the fallback can be tightened in a follow-up.

### B2. Create `getDealerAccessState()`

**File:** `src/lib/auth/get-dealer-access-state.ts` (NEW)

**Purpose:** Returns the reason a dealer cannot access the app. Used ONLY by status screen pages (`/pending-approval`, `/rejected`, `/suspended`). Must NOT be used to gate app access — that is `getCurrentDealer()`'s job.

```typescript
"use server";

export type DealerAccessState =
  | { state: "approved" }
  | { state: "pending" }
  | { state: "rejected"; reason: string | null }
  | { state: "suspended" }
  | { state: "no_membership" };

export async function getDealerAccessState(): Promise<DealerAccessState>
```

**Logic:**
1. `getCurrentUser()` → if null, return `{ state: "no_membership" }`
2. Query `dealer_members` JOIN `dealers` WHERE `user_id = user.id`, no status filter
3. If no row: `{ state: "no_membership" }`
4. If `dealers.status = 'suspended'`: `{ state: "suspended" }`
5. If `dealers.approval_status = 'rejected'`: `{ state: "rejected", reason: dealers.rejection_reason ?? null }`
6. If `dealers.approval_status = 'pending'` (or NULL): `{ state: "pending" }`
7. Return `{ state: "approved" }`

### B3. Create `approveDealerApplication()`

**File:** `src/lib/dealer-settings/approve-dealer-application.ts` (NEW)

```typescript
"use server";

export async function approveDealerApplication(
  dealerId: string,
  rank: DetailerRank
): Promise<{ success: true } | { success: false; error: string }>
```

**Logic:**
1. `requireAdmin()` — throws if not Admin
2. Validate `dealerId` non-empty
3. Validate `rank` in `["detailer", "certified"]`
4. `createAdminClient()` — service-role
5. Verify `dealers` row exists; read current `approval_status` for audit
6. Update `dealers`: `approval_status='approved'`, `approved_by=admin.id`, `approved_at=now()`
7. Upsert `dealer_settings`: `detailer_rank=rank` (same pattern as `setDealerRank()`)
8. `writeAuditLog`: action=`'dealer_approved'`, details=`{ rank, from: prevStatus }`
9. Return `{ success: true }`

**Error returns:** dealer not found → Japanese error string. DB error → Japanese error string.

### B4. Create `rejectDealerApplication()`

**File:** `src/lib/dealer-settings/reject-dealer-application.ts` (NEW)

```typescript
"use server";

export async function rejectDealerApplication(
  dealerId: string,
  reason: string
): Promise<{ success: true } | { success: false; error: string }>
```

**Logic:**
1. `requireAdmin()`
2. Validate `dealerId` non-empty
3. `createAdminClient()`
4. Verify dealer exists
5. Update `dealers`: `approval_status='rejected'`, `rejected_by=admin.id`, `rejected_at=now()`, `rejection_reason=reason.trim()||null`
6. `writeAuditLog`: action=`'dealer_rejected'`, details=`{ reason }`
7. Return `{ success: true }`

### B5. Update `admin-types.ts`

**File:** `src/lib/admin/admin-types.ts`

Add to `AdminAuditAction` union:
```typescript
| "dealer_approved"
| "dealer_rejected"
| "dealer_suspended"
| "dealer_reactivated"
```

---

## Phase C — Access Control

### C1. Update `page.tsx` redirect logic

**File:** `src/app/page.tsx`

Current check (onboarding redirect):
```typescript
if (!settings || (!completed && step === 1)) shouldRedirectToOnboarding = true;
```

Add before the onboarding check:

```typescript
// Approval / suspension gate
const dealer = await getCurrentDealer();
if (!dealer) {
  const user = await getCurrentUser();
  if (user) {
    const accessState = await getDealerAccessState();
    switch (accessState.state) {
      case "pending":   redirect("/pending-approval");
      case "rejected":  redirect("/rejected");
      case "suspended": redirect("/suspended");
      default:          redirect("/login");
    }
  }
  redirect("/login");
}
```

**Execution order in `page.tsx`:**
1. Auth check → access state check → redirect if not 'approved'
2. Onboarding check → redirect to `/onboarding` if step=1
3. Load dashboard

### C2. Update `onboarding/page.tsx`

Add check: if `getDealerAccessState()` returns `rejected` or `suspended`, redirect to appropriate screen. Pending dealers are allowed to reach onboarding (their account is still being set up).

---

## Phase D — Status Screen Pages

All three pages: no `MainLayout`. Server components. Full-screen centered layout. Dark background `#0a0f1a`.

### D1. `/app/pending-approval/page.tsx` (NEW)

- Calls `getDealerAccessState()` to confirm state is still `'pending'` (guard against stale redirect)
- If state is `'approved'` → redirect to `/`
- Japanese content as designed in spec §7a
- Logout button → signs out via Supabase client

### D2. `/app/rejected/page.tsx` (NEW)

- Calls `getDealerAccessState()` to get state + `rejection_reason`
- If state is `'approved'` → redirect to `/`
- Shows `rejection_reason` if non-null, otherwise shows generic Japanese message
- Japanese content as designed in spec §7b

### D3. `/app/suspended/page.tsx` (NEW)

- Calls `getDealerAccessState()` to confirm state is still `'suspended'`
- If state is `'approved'` → redirect to `/`
- Japanese content as designed in spec §7c
- Explicit list of blocked functions (見積・注文・LINE・顧客情報)

---

## Phase E — Admin UI

### E1. Update `getDealersAdmin()`

**File:** `src/lib/admin/get-dealers-admin.ts`

**Change:** Add to `.select()`:
```
approval_status, approved_at, rejected_at, rejection_reason, application_submitted_at
```

Also fetch `detailer_rank` from `dealer_settings` per dealer. Options:
- Option A: second query — `SELECT dealer_id, detailer_rank FROM dealer_settings WHERE dealer_id IN (...)` — cleaner, avoids JOIN complexity
- Option B: LEFT JOIN `dealer_settings` in same query

**Recommended:** Option A (two queries). Supabase PostgREST cross-table JOINs on non-FK columns require care.

### E2. Update `DealersAdminClient.tsx`

**File:** `src/app/admin/dealers/DealersAdminClient.tsx`

**State additions:**
```typescript
type ApprovalStatus = "pending" | "approved" | "rejected";
type DealerSuspendStatus = "active" | "suspended";
const [filterTab, setFilterTab] = useState<"all" | ApprovalStatus>("all");
const [approvalModal, setApprovalModal] = useState<{ dealer: Dealer } | null>(null);
const [rejectionModal, setRejectionModal] = useState<{ dealer: Dealer } | null>(null);
const [rankModal, setRankModal] = useState<{ dealer: Dealer } | null>(null);
const [selectedRank, setSelectedRank] = useState<"detailer" | "certified">("detailer");
const [rejectionReason, setRejectionReason] = useState("");
```

**`Dealer` interface additions:**
```typescript
approval_status:          string;
approved_at:              string | null;
rejected_at:              string | null;
rejection_reason:         string | null;
application_submitted_at: string | null;
detailer_rank:            string | null;  // from dealer_settings
```

**New handlers:**
- `handleApprove(dealerId, rank)` — calls `approveDealerApplication()`
- `handleReject(dealerId, reason)` — calls `rejectDealerApplication()`
- `handleRankChange(dealerId, rank)` — calls `setDealerRank()` (Sprint 9, already exists)

**Tab filter logic:**
```typescript
const filtered = dealers
  .filter(d => filterTab === "all" || d.approval_status === filterTab)
  .filter(d => search ? /* name/email match */ : true);
```

**Approval status badge helper:**
```typescript
function approvalBadgeClass(status: string): string {
  switch (status) {
    case "approved": return "bg-green-900/50 text-green-300 border border-green-700/50";
    case "rejected": return "bg-red-900/50 text-red-300 border border-red-700/50";
    default:         return "bg-amber-900/50 text-amber-300 border border-amber-700/50"; // pending
  }
}

function approvalBadgeLabel(status: string): string {
  switch (status) {
    case "approved": return "承認済み";
    case "rejected": return "却下";
    default:         return "審査待ち";
  }
}
```

### E3. Update Admin layout header

**File:** `src/app/admin/layout.tsx`

Fetch pending count server-side:
```typescript
const { count: pendingCount } = await supabase
  .from("dealers")
  .select("id", { count: "exact", head: true })
  .eq("approval_status", "pending");
```

Nav link update:
```tsx
<Link href="/admin/dealers">
  ディーラー管理
  {(pendingCount ?? 0) > 0 && (
    <span className="ml-1.5 bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
      {pendingCount}
    </span>
  )}
</Link>
```

---

## Phase F — Build Validation

```bash
npx tsc --noEmit    # Must pass with 0 errors
npm run build       # Must pass, all routes
```

One clean commit after all checks pass:
```
Sprint 10A: dealer approval flow
```

---

## Test Checklist

### Schema (staging only)
- [ ] Migration 071 applied: `SELECT column_name FROM information_schema.columns WHERE table_name='dealers' AND column_name='approval_status'`
- [ ] Zero NULL `approval_status` values: `SELECT COUNT(*) FROM dealers WHERE approval_status IS NULL`
- [ ] Existing active dealers have `approval_status='approved'`
- [ ] No existing dealers locked out (test login for each existing dealer)

### Access control
- [ ] Approved + active dealer: full app access ✅
- [ ] Pending dealer: redirected to `/pending-approval` ✅
- [ ] Rejected dealer: redirected to `/rejected` with reason shown ✅
- [ ] Suspended dealer: redirected to `/suspended` ✅
- [ ] Suspended dealer direct URL attempt (`/estimates`): getCurrentDealer() → null → 404 or redirect
- [ ] NULL `approval_status` fallback: treat as approved ✅
- [ ] Unauthenticated user: redirected to `/login` ✅
- [ ] Status screens do not loop on themselves ✅

### Server actions
- [ ] `approveDealerApplication(dealerId, rank)` — non-admin caller → throws "管理者権限が必要です"
- [ ] `approveDealerApplication(dealerId, rank)` — unknown dealerId → `{ success: false, error: "..." }`
- [ ] `approveDealerApplication(dealerId, rank)` — invalid rank → `{ success: false, error: "..." }`
- [ ] `approveDealerApplication(dealerId, "detailer")` — success → dealer_settings.detailer_rank = 'detailer', audit log written
- [ ] `rejectDealerApplication(dealerId, reason)` — success → approval_status='rejected', reason stored, audit log written
- [ ] `rejectDealerApplication(dealerId, "")` — empty reason accepted → rejection_reason=NULL stored
- [ ] `getDealerAccessState()` — pending dealer → `{ state: "pending" }`
- [ ] `getDealerAccessState()` — rejected dealer with reason → `{ state: "rejected", reason: "..." }`
- [ ] `getDealerAccessState()` — suspended dealer → `{ state: "suspended" }`

### Admin UI
- [ ] `/admin/dealers` tab 審査待ち: shows pending dealers only ✅
- [ ] Approval modal: rank selector defaults to ディテイラー ✅
- [ ] Approval modal: submit → dealer moves to 承認済み tab, rank badge appears ✅
- [ ] Rejection modal: submit with reason → dealer moves to 却下 tab ✅
- [ ] Rejection modal: submit without reason → dealer moves to 却下 tab, no reason shown ✅
- [ ] Rank change modal (approved dealer): submit → `setDealerRank()` called → rank updated ✅
- [ ] Admin nav badge shows pending count ✅
- [ ] Admin nav badge hidden when 0 pending ✅
- [ ] Audit logs: `dealer_approved` entry written with admin user id ✅
- [ ] Audit logs: `dealer_rejected` entry written with admin user id ✅
- [ ] Audit logs: `rank_assigned` entry written alongside `dealer_approved` ✅

### Dealer-facing status screens
- [ ] `/pending-approval`: no MainLayout, logout button works ✅
- [ ] `/rejected`: shows rejection_reason if set, generic message if null ✅
- [ ] `/suspended`: lists blocked features explicitly ✅
- [ ] All three screens: accessible when not in approved+active state ✅
- [ ] All three screens: if dealer becomes approved, redirect to `/` ✅

---

## Rollback Plan

If `getCurrentDealer()` change causes lockout issues after deployment:
1. Revert `get-current-dealer.ts` to the version before the join (removes approval gate temporarily)
2. Dealers can access app while issue is diagnosed
3. Root cause: likely migration not fully applied to production

Migration 071 is idempotent (IF NOT EXISTS, DO $$ blocks). Re-applying is safe.

---

*GYEON Detailer Agent | Sprint 10A Implementation Plan | Office AZ | 2026-06-26*
