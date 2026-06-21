# Staging Verification Runbook — DealerOS / GYEON Detailer Agent

## Purpose

This runbook describes how to conduct a complete staging verification run using the
Admin Staging Verification console at `/admin/staging-verification`.

The goal is to systematically record pass/fail for every verification item before
declaring the staging environment ready for UAT (User Acceptance Testing).

---

## Prerequisites

- All migrations applied on staging (see `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md`)
- Migration status page shows all Applied (`/admin/migration-status`)
- Two test dealers created (see `docs/STAGING_TEST_DEALER_GUIDE.md`)
- Staging environment accessible at staging URL
- Super admin account available

---

## Step 1 — Create a Verification Run

1. Log in as Super Admin
2. Navigate to `/admin/staging-verification`
3. Click **"新規検証ランを作成"** (Create New Verification Run)
4. Enter a descriptive run name, e.g.:
   - `Staging Verification — 2026-06-21 — Pre-UAT`
5. Click **"作成"** (Create)
6. The checklist is auto-populated with all verification items in **Pending** status

```
□ Verification run created
□ All checklist items in Pending status
□ Run name reflects date and purpose
```

---

## Step 2 — Apply Migrations (if not yet done)

Before recording any results, all migrations must be applied:

1. Follow `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` exactly
2. Apply all 27 migrations in order
3. Verify each with `docs/STAGING_SQL_VERIFICATION_PACK.md`
4. Once done, update the Migration category items in the verification run

For migration items: check the **Migration Status** page at `/admin/migration-status`.
If all show "Applied", mark all Migration items as **Passed**.

---

## Step 3 — Record Results

### How to update each item

For each verification item:

1. Perform the test described in the item label
2. In the checklist, find the item
3. Set the **Status** dropdown:
   - **Passed** — test passed as expected
   - **Failed** — test did not pass
   - **Blocked** — cannot complete test due to another issue
   - **Not Applicable** — item does not apply to this deployment
4. Optionally add an **Operator Note** with details
5. Optionally add an **Evidence URL** (e.g. screenshot link, Supabase SQL result)
6. Click **"保存"** (Save) for that item

### Testing each category

| Category | Reference |
|---|---|
| Migration | `/admin/migration-status`, `docs/STAGING_SQL_VERIFICATION_PACK.md` |
| Storage | `docs/STORAGE_VERIFICATION_CHECKLIST.md` |
| RLS | `docs/RLS_VERIFICATION_CHECKLIST.md`, `docs/STAGING_SQL_VERIFICATION_PACK.md` |
| Auth | Login/logout test with test accounts |
| Dealer Isolation | `docs/STAGING_TEST_DEALER_GUIDE.md` Part D |
| PDF | Generate PDFs for each document type, inspect output |
| LINE | `docs/LINE_RELEASE_CHECKLIST.md` |
| Subscription | `docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md` Part A |
| Onboarding | `docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md` Part B |
| Audit | `/admin/audit` — inspect for expected entries |
| Notification | Dashboard notification bell after onboarding |
| Health | `/admin` — SystemHealthCard |
| Release Readiness | `/admin/release-readiness` |

---

## Step 4 — Create Issues for Failures

For any item that fails:

1. In the Issue Panel (below the checklist), click **"課題を追加"** (Create Issue)
2. Fill in:
   - **Title** — clear description of what failed
   - **Severity** — Low / Medium / High / Critical
   - **Related Area** — e.g. "PDF", "RLS", "LINE webhook"
   - **Description** — steps to reproduce, expected vs actual
3. Click **"作成"** (Create)

### Severity Guidelines

| Severity | When to use |
|---|---|
| Critical | Blocks all dealer operations, data loss risk, security vulnerability |
| High | Core feature broken, multi-tenant isolation failure, PDF generation down |
| Medium | Non-critical feature broken, minor UI issue |
| Low | Cosmetic issue, edge case, minor wording |

---

## Step 5 — Resolve Issues

For each issue created:

1. Investigate and fix the root cause
2. Re-test the affected verification item
3. If fixed: update issue status to **Resolved**, add resolution note
4. If not fixable for this staging run: update to **Won't Fix** with explanation
5. Update the verification item status to match (pass or fail)

---

## Step 6 — Complete the Verification Run

When all items have been reviewed:

1. Check the overall status shown at the top of the panel
2. If there are no **Blocked** or **Failed** items: overall status will be **Passed**
3. If there are failures: overall will be **Failed** or **Blocked**
4. Click **"ランを完了する"** (Complete Run)
5. Select the final status:
   - **Passed** — all required items passed
   - **Failed** — one or more items failed
   - **Blocked** — cannot complete verification due to environment issue
6. Add a summary note
7. Click **"確定"** (Confirm)

> **Important**: Completing a run does NOT deploy anything. It only records the verification outcome.

---

## Step 7 — Decide: Ready for UAT?

After completing the verification run:

```
□ All Migration items: Passed
□ All RLS items: Passed
□ No Critical issues: Open
□ No High issues: Open
□ All Core items Passed (or Not Applicable):
    Auth, Dealer Isolation, PDF, Subscription, Onboarding
□ Release Readiness page: READY or WARNING (not BLOCKED)
□ Overall verification run status: Passed
```

If all of the above are met: **proceed to UAT**.
If any are not met: **fix issues and start a new verification run**.

---

## How to Start a New Run

If the current run needs to be abandoned or replaced:

1. The current run will remain in the system with its recorded status
2. Create a new run from the top of `/admin/staging-verification`
3. The new run starts fresh with all items in Pending status
4. Previous runs are preserved for historical reference

---

## See Also

- `docs/STAGING_EXIT_CRITERIA.md` — formal exit criteria
- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` — migration application
- `docs/STAGING_SMOKE_TEST_CHECKLIST.md` — end-to-end smoke test
- `docs/STAGING_TEST_DEALER_GUIDE.md` — test dealer setup
- `docs/MANUAL_MIGRATION_TRACKING.md` — migration tracking
