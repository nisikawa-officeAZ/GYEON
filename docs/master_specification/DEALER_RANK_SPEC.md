# Dealer Rank — Specification & Implementation Status

| Field | Value |
|-------|-------|
| **Document** | Dealer Rank Flow Specification |
| **Created** | 2026-06-26 |
| **Sprint** | 9 (Option A — minimal, no schema changes) |
| **Status** | Partially implemented — full approval flow deferred |

---

## 1. Business Rules (Canonical)

- Dealer rank controls product ordering permissions, purchasable items, pricing, and dealer privileges.
- Rank must be **Admin-controlled**. Dealers must not self-assign or change their own rank.
- Only Admin / Super Admin can assign or change dealer rank.
- Rank must be read from the server; no client-side value is trusted.

### Defined Ranks

| Rank value | Display name (JA) | Description |
|------------|-------------------|-------------|
| `detailer` | ディテイラー | Default rank. Standard product access. |
| `certified` | 認定ディテイラー | Admin-approved. Access to certified-only products (infinit Base Type 1, infinit Base Type 2). |

Future ranks may be added. The type system must be extended accordingly.

---

## 2. Current Implementation (Sprint 9 Option A)

### What was implemented

**Server action — `src/lib/dealer-settings/set-dealer-rank.ts`**
- Admin / Super Admin only (enforced via `requireAdmin()`)
- Writes `detailer_rank` to `dealer_settings` table using service-role client
- Upserts safely if no `dealer_settings` row exists
- Writes audit log entry with action `rank_assigned` (from / to)
- Returns `{ success: true }` or `{ success: false, error: string }`

**EstimateWizard — `src/components/estimates/EstimateWizard.tsx`**
- Removed `const [rank, setRank] = useState<DetailerRank>("detailer")` (client-side self-selection)
- Removed rank toggle buttons from step 3 (Coating) UI
- `dealerRank: DetailerRank` prop added — value flows from server
- `isCert`, `visCoats`, `tc2Opts`, `tc3Opts` all derive from the server-provided prop
- Step 3 shows a read-only rank badge with "管理者設定ランク" label

**Data flow — rank to EstimateWizard**
```
getCanonicalDealerSettings()          ← server component (estimates/page.tsx)
  → settings.detailer_rank
    → EstimatesClient (prop dealerRank)
      → EstimateWizard (prop dealerRank)
        → rank = dealerRank            ← never from local state
```

**Settings UI — `src/components/settings/SettingsCategoryNav.tsx`**
- Labels updated to Japanese (ディテイラー / 認定ディテイラー)
- Helper text updated: "管理者が設定するランクです"
- Display remains read-only (no edit controls for dealer users)

### DB column used

`dealer_settings.detailer_rank` — existing column (PHASE70). No schema change.

### What was NOT implemented

The full dealer application → Admin approval flow requires schema changes:
- `approval_status` column on `dealers` or `dealer_members`
- `approved_by`, `approved_at` columns
- Admin UI to review pending applications
- App-access gate tied to approval status

**These are deferred to a future sprint requiring schema migration approval.**

---

## 3. Deferred: Full Approval Flow

**Sprint 10 planning document:** `SPRINT10_APPROVAL_FLOW_SPEC.md` — full spec, schema migration proposal, UI design, security analysis, and implementation checklist.

### Required future work

| Item | Schema impact |
|------|--------------|
| `approval_status` on `dealers` / `dealer_members` | New column — migration required |
| `approved_by` (admin user id) | New column — migration required |
| `approved_at` (timestamp) | New column — migration required |
| Dealer application submit UI | No schema change |
| Admin pending-applications review page | No schema change |
| App-access gate: redirect if `approval_status != 'approved'` | No schema change (once column exists) |
| Rank assignment during approval | Uses existing `dealer_settings.detailer_rank` |

### Planned flow (post-schema migration)

```
1. Dealer registers → approval_status = 'pending'
2. App shows "審査中" screen — no functionality access
3. Admin reviews application → assigns rank + sets approval_status = 'approved'
4. Dealer gains app access with Admin-assigned rank
```

### Trigger

This sprint must be planned after schema migration approval. A separate migration file
(`YYYYMMDD_dealer_approval_flow.sql`) must be reviewed and approved before implementation.

---

## 4. Files Changed (Sprint 9 Option A)

| File | Change |
|------|--------|
| `src/lib/dealer-settings/set-dealer-rank.ts` | NEW — Admin-only rank assignment server action |
| `src/lib/admin/admin-types.ts` | Added `"rank_assigned"` to `AdminAuditAction` |
| `src/components/estimates/EstimateWizard.tsx` | Removed self-select UI; added `dealerRank` prop |
| `src/components/estimates/EstimatesClient.tsx` | Added `dealerRank` prop; passed to wizard |
| `src/app/estimates/page.tsx` | Fetches `getCanonicalDealerSettings()`; passes `detailer_rank` |
| `src/components/settings/SettingsCategoryNav.tsx` | Japanese rank labels; admin-assigned copy |

---

*GYEON Detailer Agent | Dealer Rank Specification | Office AZ | 2026-06-26*
