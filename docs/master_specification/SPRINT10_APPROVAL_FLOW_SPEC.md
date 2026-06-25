# Sprint 10 — Dealer Application & Admin Approval Flow
## Specification, Impact Analysis, and Implementation Plan

| Field | Value |
|-------|-------|
| **Sprint** | 10 — Approval Flow Planning |
| **Date** | 2026-06-26 |
| **Status** | Planning only — No code changes |
| **Prerequisite** | Schema migration approval (071_dealer_approval_flow.sql) |
| **Depends on** | Sprint 9 (dealer rank locked to admin-controlled settings) ✅ |

---

## 1. Files Inspected

| File | Finding |
|------|---------|
| `src/lib/auth/get-current-dealer.ts` | Only checks `dealer_members.status = 'active'` — no approval gate |
| `src/app/page.tsx` | Redirects to `/onboarding` if not completed — no approval gate |
| `src/app/onboarding/page.tsx` | Redirects to `/` if onboarding done — no approval gate |
| `src/lib/onboarding/onboarding.ts` | Creates `dealer_settings` row; marks `onboarding_completed` — no approval |
| `src/app/admin/dealers/page.tsx` | Fetches dealers, renders `DealersAdminClient` — plan/status only |
| `src/app/admin/dealers/DealersAdminClient.tsx` | Can change `plan` and `subscription_status` — no approval workflow |
| `src/lib/admin/get-dealers-admin.ts` | Selects from `dealers` — no `approval_status` column fetched |
| `src/lib/admin/update-dealer-plan.ts` | Updates `dealers.plan` and `dealers.subscription_status` — Admin-only pattern |
| `src/lib/dealer-settings/set-dealer-rank.ts` | ✅ Sprint 9 — Admin-only rank write via `requireAdmin()` |
| `supabase/migrations/003_create_dealers_and_members.sql` | `dealers` table schema — no `approval_status` |
| `supabase/migrations/049_add_plan_to_dealers.sql` | Added `plan`, `subscription_status`, `started_at`, `expired_at` |
| `supabase/migrations/070_dealer_settings_canonical.sql` | Added `detailer_rank` to `dealer_settings` — CHECK constraint applied |
| `src/lib/migrations/migration-types.ts` | Expected migration list (27 entries, latest #27 = migration 059) |

---

## 2. Current Architecture Findings

### 2a. How Dealer Accounts Are Created Today

**There is no self-registration flow in the application.** Dealers are created manually by Admin (via Supabase dashboard or direct DB insert). The process is:

```
Admin creates row in dealers table
  → Admin creates auth.users entry (Supabase Auth)
  → Admin creates row in dealer_members table
     (dealer_id → dealers.id, user_id → auth.users.id, role='owner', status='active')
  → Dealer logs in
  → Dealer is redirected to /onboarding if dealer_settings.onboarding_step = 1
  → Dealer completes onboarding → dealer_settings.onboarding_completed = true
```

### 2b. Current Access Control Gates

| Check | Location | Blocks what |
|-------|---------|-------------|
| `dealer_members.status = 'active'` | `get-current-dealer.ts:35` | Suspended/removed staff |
| `onboarding_completed = false AND step = 1` | `page.tsx:30` | First-time users → `/onboarding` |
| `dealers.status` (active/suspended/archived) | Schema only | **NOT checked in app code** |
| Approval status | **Does not exist** | — |

**Critical gap:** `dealers.status` exists in the DB schema with values `('active', 'suspended', 'archived')`, but `get-current-dealer.ts` does NOT join to the `dealers` table — it only reads `dealer_members`. A dealer could be `status='suspended'` in the `dealers` table and still access the app.

### 2c. Where detailer_rank Is Stored

- Column: `dealer_settings.detailer_rank`
- Table: `dealer_settings` (NOT `dealers`)
- Migration: `070_dealer_settings_canonical.sql`
- CHECK constraint: `IN ('detailer', 'certified')`
- DEFAULT: `'detailer'`
- Writer: `setDealerRank()` server action (Admin-only, Sprint 9) ✅

### 2d. Current dealers Table Schema

```sql
dealers (
  id                  uuid PRIMARY KEY,
  name                text NOT NULL,
  dealer_type         text NOT NULL DEFAULT 'GYEON_DETAILER'
                      CHECK ('GYEON_DETAILER','GYEON_CERTIFIED_DETAILER','ADMIN'),
  prefecture          text,
  address             text,
  phone               text,
  email               text,
  status              text NOT NULL DEFAULT 'active'
                      CHECK ('active','suspended','archived'),  -- NOT checked in app code
  plan                text NOT NULL DEFAULT 'basic'
                      CHECK ('basic','pro','pro_plus'),
  subscription_status text NOT NULL DEFAULT 'active'
                      CHECK ('active','trial','expired','cancelled'),
  started_at          timestamptz,
  expired_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
)
```

**Missing:** `approval_status`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`,
`rejection_reason`, `application_submitted_at`, `owner_user_id`

Note: `get-dealers-admin.ts` selects `owner_user_id` from `dealers` — this column does not appear in migration 003. It was likely added manually or by a migration outside the tracked list.

---

## 3. Proposed Schema Changes

### Migration: `071_dealer_approval_flow.sql`

**Target table:** `dealers`

```sql
-- =============================================================================
-- PHASE71: Dealer Application / Admin Approval Flow
-- =============================================================================
-- DO NOT AUTO-APPLY.
-- Paste into Supabase SQL Editor manually after CTO review.
-- Apply AFTER migration 070 (dealer_settings_canonical).
--
-- Strategy: Additive only.
--   - No DROP statements.
--   - No destructive changes.
--   - No RLS weakening.
--   - All ADD COLUMN IF NOT EXISTS (idempotent).
--   - Backfill: existing active dealers → approval_status = 'approved'.
--   - Backfill: existing dealers without application date → approved_at = created_at.
-- =============================================================================

-- Section 1: Approval state columns on dealers
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS approval_status          text,
  ADD COLUMN IF NOT EXISTS approved_by              uuid REFERENCES public.admin_users(id),
  ADD COLUMN IF NOT EXISTS approved_at              timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by              uuid REFERENCES public.admin_users(id),
  ADD COLUMN IF NOT EXISTS rejected_at              timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason         text,
  ADD COLUMN IF NOT EXISTS application_submitted_at timestamptz;

-- Section 2: CHECK constraint for approval_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'dealers'
      AND c.conname = 'dealers_approval_status_check'
  ) THEN
    ALTER TABLE public.dealers
      ADD CONSTRAINT dealers_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$$;

-- Section 3: Backfill existing dealers
-- All currently active dealers are considered pre-approved.
-- approval_status = NULL means "not yet migrated" — treat as 'approved' in app code.
UPDATE public.dealers
SET
  approval_status = 'approved',
  approved_at     = COALESCE(started_at, created_at)
WHERE approval_status IS NULL AND status = 'active';

UPDATE public.dealers
SET approval_status = 'rejected'
WHERE approval_status IS NULL AND status = 'archived';

UPDATE public.dealers
SET approval_status = 'pending'
WHERE approval_status IS NULL;

-- Section 4: Set NOT NULL after backfill
ALTER TABLE public.dealers
  ALTER COLUMN approval_status SET NOT NULL,
  ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Section 5: Index for pending queue lookups
CREATE INDEX IF NOT EXISTS dealers_approval_status_idx ON public.dealers (approval_status);

-- Section 6: Extend detailer_rank CHECK to allow future ranks (optional)
-- Current CHECK: IN ('detailer', 'certified')
-- Future: may add 'master', 'elite', etc.
-- To add new rank values, drop and re-add the constraint.
-- Example (add 'master' rank):
-- ALTER TABLE public.dealer_settings
--   DROP CONSTRAINT IF EXISTS dealer_settings_detailer_rank_check;
-- ALTER TABLE public.dealer_settings
--   ADD CONSTRAINT dealer_settings_detailer_rank_check
--   CHECK (detailer_rank IN ('detailer', 'certified', 'master'));
-- This section is documented for future use; not applied here.

-- =============================================================================
-- RLS: No changes to existing policies.
-- The approval_status column is set only by Admin via service-role client.
-- Dealer users cannot write approval_status (RLS + server-side enforcement).
-- =============================================================================

-- =============================================================================
-- Post-apply verification
-- =============================================================================
-- SELECT id, name, approval_status, approved_at, rejected_at
-- FROM public.dealers ORDER BY created_at DESC LIMIT 20;
--
-- Expected: All pre-existing dealers have approval_status IN ('approved','rejected','pending').
-- No NULL values in approval_status after migration.
```

### Migration list update required

Add to `src/lib/migrations/migration-types.ts` `getExpectedMigrationList()`:
```typescript
{
  number:  28,
  filename: "071_dealer_approval_flow.sql",
  purpose:  "Add approval_status/approved_by/approved_at to dealers; backfill existing",
  probe:    { type: "column", table: "dealers", column: "approval_status" },
},
```

---

## 4. Required Flow Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  NEW DEALER CREATION (Admin creates account)                        │
│                                                                     │
│  Admin: create dealers row (name, email, type)                      │
│      → approval_status = 'pending' (DEFAULT)                       │
│      → application_submitted_at = NULL (filled when dealer submits) │
│  Admin: create auth.users entry                                     │
│  Admin: create dealer_members entry (status='active')               │
│                                                                     │
│  Dealer logs in → getCurrentDealer() returns null (not approved)   │
│  → Redirect to /pending-approval                                    │
│                                                                     │
│  OR: Future self-registration flow                                  │
│  Dealer fills application form → submitted_at set                  │
│  → approval_status stays 'pending'                                  │
│  → App shows /pending-approval screen                              │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ADMIN REVIEW                                                       │
│                                                                     │
│  Admin visits /admin/dealers → Pending tab shows queue             │
│  Admin clicks dealer → Detail panel opens                          │
│  Admin sees: name, email, type, submitted_at, phone                │
│                                                                     │
│  Admin: APPROVE                                                     │
│    → Select rank: ディテイラー | 認定ディテイラー                   │
│    → Confirm                                                        │
│    → approveDealerApplication(dealerId, rank) server action:        │
│         dealers.approval_status = 'approved'                        │
│         dealers.approved_by = admin.id                              │
│         dealers.approved_at = now()                                 │
│         dealer_settings.detailer_rank = rank (via setDealerRank)   │
│         audit log: 'dealer_approved' + 'rank_assigned'             │
│                                                                     │
│  Admin: REJECT                                                      │
│    → Enter rejection reason (Japanese text)                        │
│    → Confirm                                                        │
│    → rejectDealerApplication(dealerId, reason) server action:       │
│         dealers.approval_status = 'rejected'                        │
│         dealers.rejected_by = admin.id                              │
│         dealers.rejected_at = now()                                 │
│         dealers.rejection_reason = reason                           │
│         audit log: 'dealer_rejected'                               │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DEALER AFTER APPROVAL                                              │
│                                                                     │
│  getCurrentDealer() now returns membership (approval_status check) │
│  Dealer can access the app                                          │
│  Dealer sees rank in settings (read-only): ディテイラー            │
│  EstimateWizard uses admin-assigned rank ✅ (Sprint 9)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Access Control Design

### 5a. getCurrentDealer() changes (after migration)

Current query (no approval check):
```typescript
supabase
  .from("dealer_members")
  .select("dealer_id, role")
  .eq("user_id", user.id)
  .eq("status", "active")
  .single()
```

Proposed query (with approval gate):
```typescript
supabase
  .from("dealer_members")
  .select("dealer_id, role, dealers!inner(approval_status, status)")
  .eq("user_id", user.id)
  .eq("status", "active")
  .eq("dealers.approval_status", "approved")
  .eq("dealers.status", "active")
  .single()
```

**Fallback rule:** If `approval_status` column does not exist (migration not yet applied), treat as `'approved'` to avoid locking out existing dealers. Use `maybeSingle()` + column-missing detection.

### 5b. Page-level access gates

| Route | Current behavior | After migration |
|-------|-----------------|-----------------|
| `/` | Redirect to `/onboarding` if step=1 | Also check approval_status; redirect to `/pending-approval` if pending, `/rejected` if rejected |
| `/onboarding` | No approval check | Block if `approval_status = 'rejected'` |
| All protected routes | `getCurrentDealer()` null → middleware redirects to `/login` | `getCurrentDealer()` null when `approval_status != 'approved'` → redirect accordingly |

### 5c. New routes required

| Route | Component | Content |
|-------|-----------|---------|
| `/pending-approval` | `PendingApprovalPage` | Japanese screen: "審査中です。管理者の承認をお待ちください。" |
| `/rejected` | `RejectedPage` | Japanese screen: "申請が却下されました。理由: {rejection_reason}" |

Both routes must be **public** (accessible without `getCurrentDealer()` returning active dealer), but authenticated (require `auth.uid()`).

### 5d. Middleware considerations

Current `middleware.ts` (if it exists) or page-level redirect logic must be updated. The `/pending-approval` and `/rejected` routes must NOT redirect back to themselves in a loop.

---

## 6. Admin UI Changes

### 6a. `/admin/dealers` page additions

**Tab bar (new):**
- 全て (All)
- 審査待ち (Pending) — badge with count
- 承認済み (Approved)
- 却下 (Rejected)

**Table new columns:**
- 審査状況 (`approval_status` badge: 審査待ち / 承認済み / 却下)
- ランク (`detailer_rank` from `dealer_settings` — joined or separate fetch)
- 申請日 (`application_submitted_at`)
- 承認日 (`approved_at`)

**Row actions (新):**
- Pending → [承認] button → opens approval modal
- Pending → [却下] button → opens rejection modal
- Approved → [ランク変更] button → opens rank modal (uses existing `setDealerRank()`)

### 6b. Approval modal

```
┌───────────────────────────────────────┐
│  ディーラーを承認する                 │
│                                       │
│  ショップ名: {dealer.name}            │
│  メール: {dealer.email}               │
│                                       │
│  ディテイラーランクを設定:            │
│  ○ 🔵 ディテイラー                   │
│  ○ ⭐ 認定ディテイラー               │
│                                       │
│       [キャンセル]  [承認する]        │
└───────────────────────────────────────┘
```

### 6c. Rejection modal

```
┌───────────────────────────────────────┐
│  申請を却下する                       │
│                                       │
│  ショップ名: {dealer.name}            │
│                                       │
│  却下理由（ディーラーに通知されます）:│
│  ┌─────────────────────────────────┐  │
│  │ 却下理由を入力...               │  │
│  └─────────────────────────────────┘  │
│                                       │
│       [キャンセル]  [却下する]        │
└───────────────────────────────────────┘
```

---

## 7. Server Actions Required (Sprint 10 Implementation)

### 7a. `approveDealerApplication(dealerId, rank)` — NEW

```typescript
// src/lib/dealer-settings/approve-dealer-application.ts
// Admin/Super Admin only — requireAdmin()
// 1. requireAdmin()
// 2. Validate dealerId, rank
// 3. Update dealers: approval_status='approved', approved_by=admin.id, approved_at=now()
// 4. Upsert dealer_settings: detailer_rank=rank (reuse setDealerRank logic)
// 5. writeAuditLog: action='dealer_approved', details={rank}
// Returns: { success: true } | { success: false, error: string }
```

### 7b. `rejectDealerApplication(dealerId, reason)` — NEW

```typescript
// src/lib/dealer-settings/reject-dealer-application.ts
// Admin/Super Admin only — requireAdmin()
// 1. requireAdmin()
// 2. Validate dealerId, reason (non-empty)
// 3. Update dealers: approval_status='rejected', rejected_by=admin.id,
//                    rejected_at=now(), rejection_reason=reason
// 4. writeAuditLog: action='dealer_rejected', details={reason}
// Returns: { success: true } | { success: false, error: string }
```

### 7c. `getDealerApplicationStatus(dealerId?)` — NEW

```typescript
// src/lib/auth/get-dealer-approval-status.ts
// Returns approval_status for the current dealer (uses getCurrentDealer())
// No Admin required — dealer reads their own status
// Used by /pending-approval and /rejected pages
```

### 7d. Admin audit action additions

Add to `AdminAuditAction` in `admin-types.ts`:
- `"dealer_approved"`
- `"dealer_rejected"`

---

## 8. Security Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dealer bypasses approval by calling `getCurrentDealer()` directly | LOW | `getCurrentDealer()` joins `dealers.approval_status` — not bypassable from client |
| Dealer changes own `approval_status` via direct DB write | LOW | RLS on `dealers` — only service_role can write `approval_status` |
| Admin self-approves without audit trail | LOW | `writeAuditLog()` in all approval actions — tamper-evident |
| Race condition: dealer approved, rank not yet set | LOW | `approveDealerApplication()` writes both atomically in same server action |
| Backfill sets wrong `approval_status` for existing dealers | MEDIUM | Migration backfill logic sets `approved` for `status='active'` only — review carefully before applying |
| `approval_status` check missing during migration rollout | MEDIUM | Fallback: treat `NULL` as `'approved'` in app code until migration confirmed |
| `rejection_reason` exposed to dealer | INTENTIONAL | Shown only on `/rejected` screen — helps dealer understand why |
| Admin rank change bypasses approval check | LOW | `setDealerRank()` already requires `requireAdmin()` — ranks are always Admin-controlled |
| Future ranks break CHECK constraint | MEDIUM | Extend `detailer_rank` CHECK in a future migration before adding new rank values to code |

---

## 9. Implementation Checklist (Sprint 10 Execution)

### Phase A — Schema (requires migration approval)

- [ ] CTO approves `071_dealer_approval_flow.sql` schema design
- [ ] Confirm `owner_user_id` column exists in `dealers` table (used in `get-dealers-admin.ts` but not in migration 003)
- [ ] Apply `071_dealer_approval_flow.sql` to staging
- [ ] Verify backfill: `SELECT approval_status, COUNT(*) FROM dealers GROUP BY approval_status`
- [ ] Confirm no existing dealers locked out after migration
- [ ] Add migration 071 probe to `src/lib/migrations/migration-types.ts`

### Phase B — Server actions

- [ ] `approveDealerApplication(dealerId, rank)` in `src/lib/dealer-settings/approve-dealer-application.ts`
- [ ] `rejectDealerApplication(dealerId, reason)` in `src/lib/dealer-settings/reject-dealer-application.ts`
- [ ] `getDealerApplicationStatus()` in `src/lib/auth/get-dealer-approval-status.ts`
- [ ] Add `"dealer_approved"` and `"dealer_rejected"` to `AdminAuditAction`

### Phase C — Access control

- [ ] Update `getCurrentDealer()` to join `dealers` and check `approval_status = 'approved'`
- [ ] Add `NULL`-safe fallback in `getCurrentDealer()` (migration not yet applied → treat as approved)
- [ ] Update `page.tsx` redirect logic: pending → `/pending-approval`, rejected → `/rejected`
- [ ] Create `/pending-approval` page (Japanese UI, no MainLayout)
- [ ] Create `/rejected` page (Japanese UI, shows `rejection_reason`)
- [ ] Ensure `/pending-approval` and `/rejected` do not require approval themselves (loop prevention)

### Phase D — Admin UI

- [ ] Update `getDealersAdmin()` to include `approval_status, approved_at, rejected_at, rejection_reason`
- [ ] Update `DealersAdminClient` with approval status tab + column
- [ ] Add approval modal (rank selection + confirm)
- [ ] Add rejection modal (reason input + confirm)
- [ ] Wire `approveDealerApplication()` to approval modal
- [ ] Wire `rejectDealerApplication()` to rejection modal
- [ ] Add rank-change control for approved dealers (uses existing `setDealerRank()`)
- [ ] Add "承認待ち" nav badge to admin layout header

### Phase E — Settings UI

- [ ] Update `SettingsCategoryNav.tsx`: show rank as "管理者承認済みランク"
- [ ] No edit control for dealer users (already read-only ✅)

### Phase F — Build validation

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run build` — all pages build clean
- [ ] One clean commit: `Sprint 10: dealer approval flow`

---

## 10. Questions Requiring Decision Before Implementation

| # | Question | Options |
|---|---------|---------|
| Q1 | Will dealers self-register, or will Admin always create accounts? | (a) Admin-creates-only (current); (b) self-registration form at `/apply` |
| Q2 | Should rejection reason be shown to the dealer? | (a) Yes, on `/rejected`; (b) No, generic message only |
| Q3 | Can a rejected dealer re-apply (reset to pending)? | (a) Admin resets manually; (b) Dealer can re-submit |
| Q4 | Should `application_submitted_at` be set when onboarding starts, or when dealer explicitly submits? | Depends on Q1 |
| Q5 | Email notification on approve/reject? | Out of scope for Sprint 10, but hook exists via LINE or email |
| Q6 | Should `dealers.status = 'suspended'` also block app access? | Currently not enforced — clarify desired behavior |

---

## 11. Files to Be Changed (Sprint 10 Implementation)

| File | Type | Change |
|------|------|--------|
| `supabase/migrations/071_dealer_approval_flow.sql` | NEW | Schema migration proposal |
| `src/lib/migrations/migration-types.ts` | MODIFY | Add migration 071 probe |
| `src/lib/auth/get-current-dealer.ts` | MODIFY | Join dealers, check approval_status |
| `src/lib/auth/get-dealer-approval-status.ts` | NEW | Read approval state for dealer-facing pages |
| `src/lib/dealer-settings/approve-dealer-application.ts` | NEW | Admin approval action |
| `src/lib/dealer-settings/reject-dealer-application.ts` | NEW | Admin rejection action |
| `src/lib/admin/admin-types.ts` | MODIFY | Add `dealer_approved`, `dealer_rejected` audit actions |
| `src/app/page.tsx` | MODIFY | Approval status redirect logic |
| `src/app/pending-approval/page.tsx` | NEW | Japanese pending screen |
| `src/app/rejected/page.tsx` | NEW | Japanese rejected screen with reason |
| `src/lib/admin/get-dealers-admin.ts` | MODIFY | Include approval columns in select |
| `src/app/admin/dealers/DealersAdminClient.tsx` | MODIFY | Approval UI, rank column, tabs |
| `src/app/admin/layout.tsx` | MODIFY | Pending-count badge in nav |

---

*GYEON Detailer Agent | Sprint 10 Planning Specification | Office AZ | 2026-06-26*
