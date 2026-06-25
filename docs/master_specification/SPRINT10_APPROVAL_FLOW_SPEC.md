# Sprint 10 — Dealer Application & Admin Approval Flow
## Specification (Decisions Locked)

| Field | Value |
|-------|-------|
| **Sprint** | 10 — Approval Flow |
| **Created** | 2026-06-26 |
| **Decisions locked** | 2026-06-26 |
| **Status** | Decisions locked — ready for Sprint 10A implementation |
| **Prerequisite** | Schema migration 071 approved and applied to staging |
| **Depends on** | Sprint 9 (dealer rank server-controlled) ✅ commit `448ecb4` |
| **Implementation plan** | `SPRINT10A_IMPLEMENTATION_PLAN.md` |

---

## Decision Lock (Canonical — Do Not Reopen Without CTO Sign-off)

| # | Decision | Value |
|---|---------|-------|
| D1 | Registration model | Admin-created / invitation-only in v1.0. Public self-registration is deferred. |
| D2 | Dealer access before approval | No dealer may access the main app before approval. |
| D3 | Rejected dealer re-application | Rejected dealers cannot re-apply from inside the app. Admin resets manually. Rejected screen shows reason if available. |
| D4 | Suspended dealer access | `dealers.status = 'suspended'` blocks app access even if `approval_status = 'approved'`. Suspended dealers see a Japanese suspended screen. |
| D5 | Access preconditions (all required) | `approval_status = 'approved'` AND `dealers.status = 'active'` AND authenticated `dealer_members` row exists AND `dealer_members.status = 'active'` |
| D6 | Backfill policy | Existing active dealers → `approval_status = 'approved'` only after staging verification. Migration must not auto-apply. |
| D7 | Dealer rank | Admin/Super Admin only. Dealers cannot change their own rank. Product ordering and pricing use Admin-assigned rank only. (Implemented Sprint 9.) |
| D8 | Dealer-facing status screens | Three required: `/pending-approval`, `/rejected`, `/suspended` |

---

## 1. Architecture Findings (from Sprint 10 Planning)

### 1a. How Dealer Accounts Are Created Today

No self-registration exists. Admin creates accounts manually:

```
Admin creates: dealers row (name, email, type)
Admin creates: auth.users entry (Supabase Auth dashboard)
Admin creates: dealer_members row (dealer_id, user_id, role='owner', status='active')
Dealer logs in → redirected to /onboarding if step=1
Dealer completes onboarding → onboarding_completed=true
```

### 1b. Current Access Control Gaps

| Check | Location | Gap |
|-------|---------|-----|
| `dealer_members.status = 'active'` | `get-current-dealer.ts` | ✅ Working |
| `dealers.approval_status` | Does not exist | ❌ Not implemented |
| `dealers.status` ('active'/'suspended'/'archived') | Schema only | ❌ **Not checked in app code** |
| Onboarding redirect | `page.tsx` | ✅ Working, not approval-aware |

**`dealers.status` is a critical unfixed gap.** A suspended dealer can currently access all app features.

### 1c. Where detailer_rank Is Stored

`dealer_settings.detailer_rank` — PHASE70 column. CHECK `IN ('detailer', 'certified')`. DEFAULT `'detailer'`. Written only by `setDealerRank()` (Admin-only, Sprint 9).

### 1d. Current dealers Table

```
id, name, dealer_type, prefecture, address, phone, email
status CHECK('active','suspended','archived')
plan CHECK('basic','pro','pro_plus')
subscription_status CHECK('active','trial','expired','cancelled')
started_at, expired_at, created_at, updated_at
owner_user_id (column exists in app query, not in tracked migration)
```

**Missing:** `approval_status`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`, `application_submitted_at`

---

## 2. Required Flow (v1.0 Locked)

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1 — ADMIN CREATES DEALER                                   │
│  (Admin invitation / manual creation — no public registration)   │
│                                                                  │
│  Admin creates: dealers row → approval_status = 'pending'        │
│  Admin creates: auth.users entry                                 │
│  Admin creates: dealer_members row (status='active')             │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2 — DEALER LOGS IN (BEFORE APPROVAL)                       │
│                                                                  │
│  getCurrentDealer() joins dealers table                          │
│  approval_status = 'pending' → returns null                      │
│  getDealerAccessState() → { state: 'pending' }                  │
│  page.tsx → redirect('/pending-approval')                        │
│                                                                  │
│  Screen: "審査中です。管理者の承認をお待ちください。"            │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3 — ADMIN REVIEWS & DECIDES                                │
│                                                                  │
│  /admin/dealers → 審査待ち tab shows pending queue               │
│                                                                  │
│  APPROVE:                                                        │
│    Admin selects rank (ディテイラー / 認定ディテイラー)           │
│    approveDealerApplication(dealerId, rank):                     │
│      dealers: approval_status='approved', approved_by, approved_at │
│      dealer_settings: detailer_rank=rank                        │
│      audit: dealer_approved + rank_assigned                     │
│                                                                  │
│  REJECT:                                                         │
│    Admin enters rejection reason (Japanese text, optional)       │
│    rejectDealerApplication(dealerId, reason):                   │
│      dealers: approval_status='rejected', rejected_by,          │
│               rejected_at, rejection_reason                     │
│      audit: dealer_rejected                                     │
└──────────────────────────────────────────────────────────────────┘
         │
    ┌────┴────┐
  APPROVED  REJECTED
    │          │
    ▼          ▼
┌───────┐  ┌──────────────────────────────────┐
│ STEP 4│  │  REJECTED SCREEN                 │
│ ACCESS│  │  /rejected                       │
│ FULL  │  │  "申請が却下されました。"        │
│  APP  │  │  理由: {rejection_reason or —}   │
└───────┘  │  再申請はお問い合わせください。  │
           └──────────────────────────────────┘
                  (Admin resets manually if needed)
```

### Suspended dealer path (separate from approval)

```
Admin sets dealers.status = 'suspended' on any approved dealer
  ↓
getCurrentDealer() → dealers.status != 'active' → returns null
getDealerAccessState() → { state: 'suspended' }
page.tsx → redirect('/suspended')

Screen: "アカウントが一時停止されています。"
         "詳細はGYEON Japanまでお問い合わせください。"
```

---

## 3. Schema Migration (Proposal — DO NOT APPLY)

File: `supabase/migrations/071_dealer_approval_flow.sql`

**Added columns to `dealers`:**

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `approval_status` | `text NOT NULL DEFAULT 'pending'` | `'pending'` | No |
| `approved_by` | `uuid REFERENCES admin_users(id)` | NULL | Yes |
| `approved_at` | `timestamptz` | NULL | Yes |
| `rejected_by` | `uuid REFERENCES admin_users(id)` | NULL | Yes |
| `rejected_at` | `timestamptz` | NULL | Yes |
| `rejection_reason` | `text` | NULL | Yes |
| `application_submitted_at` | `timestamptz` | NULL | Yes |

CHECK constraint: `approval_status IN ('pending', 'approved', 'rejected')`

**Backfill (runs in migration body):**
- `status='active'` → `approval_status='approved'`, `approved_at=COALESCE(started_at, created_at)`
- `status='archived'` → `approval_status='rejected'`, `rejected_at=updated_at`
- Everything else → `approval_status='pending'`

**Backfill must be verified on staging before production:**
```sql
SELECT approval_status, COUNT(*) FROM public.dealers GROUP BY approval_status;
-- Zero NULLs expected
SELECT COUNT(*) FROM public.dealers WHERE approval_status IS NULL;
-- Must be 0
```

**RLS:** No changes. Admin writes via `service_role` (bypasses RLS). Dealer users have no UPDATE policy on `dealers`.

---

## 4. Access Control Design (Locked)

### 4a. getCurrentDealer() — updated behavior

After migration, the function must join `dealers` and enforce all five preconditions:

```
dealer_members.status = 'active'
  AND dealers.approval_status = 'approved'
  AND dealers.status = 'active'
```

If **any** condition fails → return `null`.

NULL-safe fallback: if `approval_status` column does not exist in DB response (migration not yet applied), treat as `'approved'` to prevent lockout of existing dealers.

Return type stays `DealerMembership | null` — callers that need to know WHY access was denied use `getDealerAccessState()`.

### 4b. getDealerAccessState() — new function

Purpose: called only on status screens. Tells the page which screen to show.

```typescript
type DealerAccessState =
  | { state: "approved" }                              // should not redirect
  | { state: "pending" }                               // show /pending-approval
  | { state: "rejected"; reason: string | null }       // show /rejected
  | { state: "suspended" }                             // show /suspended
  | { state: "no_membership" }                         // show /login

// Reads from dealers + dealer_members without the status filter
// Uses getCurrentUser() to get auth.uid() — does NOT use getCurrentDealer()
```

### 4c. page.tsx redirect logic (after migration)

```
if getCurrentDealer() returns null AND user is authenticated:
  call getDealerAccessState()
  match state:
    'pending'   → redirect('/pending-approval')
    'rejected'  → redirect('/rejected')
    'suspended' → redirect('/suspended')
    'no_membership' → redirect('/login')
```

### 4d. New routes — all must be loop-safe

| Route | Accessible by | Description |
|-------|--------------|-------------|
| `/pending-approval` | Authenticated, any approval_status | 審査中画面 |
| `/rejected` | Authenticated, any approval_status | 却下画面 + reason |
| `/suspended` | Authenticated, any approval_status | 停止画面 |

Loop prevention: these routes must NOT call `getCurrentDealer()` to decide whether to redirect. They check `getCurrentUser()` (auth only) and `getDealerAccessState()` to confirm the state is what the URL implies.

### 4e. Existing redirect NOT broken

The onboarding redirect in `page.tsx` stays in place. Execution order:
1. Check if user is authenticated → if not, middleware handles login redirect
2. Check access state → if not 'approved', redirect to status screen
3. Check onboarding completion → if step=1, redirect to `/onboarding`
4. Load dashboard

---

## 5. Server Actions Required

### 5a. `approveDealerApplication(dealerId, rank)` — `src/lib/dealer-settings/approve-dealer-application.ts`

```
requireAdmin()
Validate: dealerId non-empty, rank IN ['detailer', 'certified']
Verify dealer exists (dealers table, admin client)
Read current approval_status for audit
Update dealers: approval_status='approved', approved_by=admin.id, approved_at=now()
Upsert dealer_settings: detailer_rank=rank (same pattern as setDealerRank)
writeAuditLog: action='dealer_approved', details={rank, from: prev_status}
Return: { success: true } | { success: false, error: string }
```

### 5b. `rejectDealerApplication(dealerId, reason)` — `src/lib/dealer-settings/reject-dealer-application.ts`

```
requireAdmin()
Validate: dealerId non-empty, reason string (empty string allowed — reason is optional per D3)
Verify dealer exists
Update dealers: approval_status='rejected', rejected_by=admin.id,
                rejected_at=now(), rejection_reason=reason||null
writeAuditLog: action='dealer_rejected', details={reason}
Return: { success: true } | { success: false, error: string }
```

### 5c. `getDealerAccessState()` — `src/lib/auth/get-dealer-access-state.ts`

```
getCurrentUser() → if null, return { state: 'no_membership' }
Query dealer_members JOIN dealers WHERE user_id = auth.uid()
  (no status filter — read all states)
If no row: return { state: 'no_membership' }
If dealers.status = 'suspended': return { state: 'suspended' }
If dealers.approval_status = 'rejected': return { state: 'rejected', reason: rejection_reason }
If dealers.approval_status = 'pending': return { state: 'pending' }
Return { state: 'approved' }
```

### 5d. Admin audit action additions — `src/lib/admin/admin-types.ts`

Add to `AdminAuditAction`:
- `"dealer_approved"`
- `"dealer_rejected"`
- `"dealer_suspended"` (for future suspend action)
- `"dealer_reactivated"` (for future reactivate action)

---

## 6. Admin UI Design

### 6a. `/admin/dealers` — additions to `DealersAdminClient`

**Filter tabs (above table):**
```
[全て (n)]  [審査待ち (n) ●]  [承認済み (n)]  [却下 (n)]
```
The `●` badge on 審査待ち tab shows count when > 0.

**New table columns:**
| Column | Data | Notes |
|--------|------|-------|
| 審査状況 | `approval_status` badge | 審査待ち(amber) / 承認済み(green) / 却下(red) |
| ランク | `detailer_rank` from `dealer_settings` | Fetched separately or joined |
| 承認日 | `approved_at` | formatted ja-JP |

**Row actions — context-sensitive:**
| Dealer state | Actions shown |
|-------------|--------------|
| `approval_status = 'pending'` | [承認する] [却下する] |
| `approval_status = 'approved'`, `status = 'active'` | [ランク変更] [停止する] |
| `approval_status = 'approved'`, `status = 'suspended'` | [ランク変更] [再開する] |
| `approval_status = 'rejected'` | [審査リセット] (returns to 'pending') |

### 6b. Approval modal

```
┌─────────────────────────────────────────┐
│  ディーラーを承認する                   │
│                                         │
│  ショップ名: {dealer.name}              │
│  メール: {dealer.email}                 │
│                                         │
│  ディテイラーランクを設定:              │
│  ● 🔵 ディテイラー                     │
│  ○ ⭐ 認定ディテイラー                 │
│                                         │
│  [キャンセル]          [承認する →]     │
└─────────────────────────────────────────┘
```

### 6c. Rejection modal

```
┌─────────────────────────────────────────┐
│  申請を却下する                         │
│                                         │
│  ショップ名: {dealer.name}              │
│                                         │
│  却下理由（任意）:                      │
│  ┌───────────────────────────────────┐  │
│  │ 例: GYEON認定資格の確認が必要です │  │
│  └───────────────────────────────────┘  │
│  ※ ディーラーの却下画面に表示されます  │
│                                         │
│  [キャンセル]          [却下する →]     │
└─────────────────────────────────────────┘
```

### 6d. Rank change modal (approved dealers)

```
┌─────────────────────────────────────────┐
│  ランクを変更する                       │
│                                         │
│  ショップ名: {dealer.name}              │
│  現在のランク: 🔵 ディテイラー          │
│                                         │
│  新しいランク:                          │
│  ○ 🔵 ディテイラー                     │
│  ● ⭐ 認定ディテイラー                 │
│                                         │
│  [キャンセル]          [変更する →]     │
└─────────────────────────────────────────┘
```

### 6e. Admin nav header badge

Add to `/admin/layout.tsx` nav:
```
ディーラー管理 {pendingCount > 0 ? `(${pendingCount})` : ""}
```
`pendingCount` fetched server-side in layout by querying `dealers WHERE approval_status='pending'`.

---

## 7. Dealer-Facing Status Screens

### 7a. `/pending-approval`

```
┌──────────────────────────────────────────┐
│  [GYEON Detailer Agent ロゴ]             │
│                                          │
│  🕐                                      │
│  審査中です                              │
│                                          │
│  アカウントは現在、管理者による           │
│  審査待ちの状態です。                    │
│                                          │
│  審査が完了次第、ご登録のメールアドレス  │
│  にご連絡します。                        │
│                                          │
│  ご不明な点は GYEON Japan までお問い合   │
│  わせください。                          │
│                                          │
│  [ログアウト]                            │
└──────────────────────────────────────────┘
```

### 7b. `/rejected`

```
┌──────────────────────────────────────────┐
│  [GYEON Detailer Agent ロゴ]             │
│                                          │
│  ✕                                       │
│  申請が却下されました                    │
│                                          │
│  {rejection_reason が存在する場合:}      │
│  ──────────────────────────────          │
│  却下理由: {rejection_reason}            │
│  ──────────────────────────────          │
│                                          │
│  再申請をご希望の場合は GYEON Japan に   │
│  お問い合わせください。                  │
│                                          │
│  [ログアウト]                            │
└──────────────────────────────────────────┘
```

### 7c. `/suspended`

```
┌──────────────────────────────────────────┐
│  [GYEON Detailer Agent ロゴ]             │
│                                          │
│  ⏸                                      │
│  アカウントが停止されています            │
│                                          │
│  このアカウントは現在、管理者により      │
│  一時停止されています。                  │
│                                          │
│  見積作成・製品注文・LINE送信・           │
│  顧客情報へのアクセスはできません。      │
│                                          │
│  詳細は GYEON Japan までお問い合わせ     │
│  ください。                              │
│                                          │
│  [ログアウト]                            │
└──────────────────────────────────────────┘
```

All three screens: no `MainLayout`. Full-screen centered card. Dark background (`#0a0f1a`). No navigation links to app internals.

---

## 8. Security Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dealer bypasses approval via direct URL access | HIGH | `getCurrentDealer()` returns null for all non-approved states; all server actions validate via `getCurrentDealer()` |
| Suspended dealer calls server actions directly | HIGH | All server actions call `getCurrentDealer()` — null = reject immediately |
| Admin sets `approval_status` via dealer-facing form | LOW | RLS: no dealer UPDATE policy on `dealers`; server actions use service_role only |
| Race condition: approve + rank write | LOW | Both writes in single `approveDealerApplication()` action — atomic from UI perspective |
| Backfill marks active dealer as rejected | MEDIUM | Backfill only runs for `status='active'` → 'approved', `status='archived'` → 'rejected'; staging verification required before production |
| NULL `approval_status` after partial migration | MEDIUM | App fallback: NULL treated as 'approved' to prevent lockout |
| Loop: status screen redirects to itself | MEDIUM | Status screens use `getDealerAccessState()` (not `getCurrentDealer()`) and do not redirect based on access |
| `rejection_reason` leaks sensitive info | LOW | Admin responsibility; shown only on authenticated `/rejected` screen |
| `suspended` dealers access product catalog read-only | MEDIUM | All data-fetching server actions check `getCurrentDealer()` → null on suspend → 403 pattern |
| Future rank values fail CHECK constraint | LOW | Extend CHECK in next migration before adding new `DetailerRank` values to code |

---

## 9. Files to Be Changed (Sprint 10A)

| File | Type | Change |
|------|------|--------|
| `supabase/migrations/071_dealer_approval_flow.sql` | EXISTS (proposal) | Apply to staging after approval |
| `src/lib/migrations/migration-types.ts` | MODIFY | Add probe for migration 071 |
| `src/lib/auth/get-current-dealer.ts` | MODIFY | Join `dealers`, check `approval_status='approved'` AND `status='active'`; NULL-safe fallback |
| `src/lib/auth/get-dealer-access-state.ts` | NEW | Return `DealerAccessState` for status screen routing |
| `src/lib/dealer-settings/approve-dealer-application.ts` | NEW | Admin approval server action |
| `src/lib/dealer-settings/reject-dealer-application.ts` | NEW | Admin rejection server action |
| `src/lib/admin/admin-types.ts` | MODIFY | Add `dealer_approved`, `dealer_rejected`, `dealer_suspended`, `dealer_reactivated` |
| `src/app/page.tsx` | MODIFY | Access state routing logic |
| `src/app/pending-approval/page.tsx` | NEW | 審査中画面 |
| `src/app/rejected/page.tsx` | NEW | 却下画面 + reason |
| `src/app/suspended/page.tsx` | NEW | 停止画面 |
| `src/lib/admin/get-dealers-admin.ts` | MODIFY | Include `approval_status`, `approved_at`, `rejected_at`, `rejection_reason` |
| `src/app/admin/dealers/DealersAdminClient.tsx` | MODIFY | Tabs, approval columns, modals, row actions |
| `src/app/admin/layout.tsx` | MODIFY | Pending-count badge in nav |

---

*GYEON Detailer Agent | Sprint 10 Specification (Decisions Locked) | Office AZ | 2026-06-26*
