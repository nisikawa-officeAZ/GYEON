# Staging Exit Criteria — DealerOS / GYEON Detailer Agent

## Purpose

This document defines the minimum requirements that must be met before the staging
environment is declared ready for UAT (User Acceptance Testing) and eventual
production rollout.

> **IMPORTANT**: Completion of staging verification does NOT constitute
> authorization to deploy to production. Production deployment requires
> separate, explicit CTO approval.

---

## Mandatory Exit Criteria

All items below must be satisfied before staging exit is declared.

### A. Migrations

```
□ All 27 migrations applied on staging in documented order
□ Migration status page (/admin/migration-status) shows all "Applied"
□ No failed migration has been skipped
□ subscription_plans seeded with basic, pro, pro_plus
□ dealer_settings has all onboarding columns (migration 059)
□ Existing dealers marked onboarding_completed=true (migration 059 UPDATE)
```

### B. RLS and Security

```
□ RLS enabled on all 28+ public tables
□ Dealer A cannot access Dealer B's: customers, vehicles, estimates, invoices, work_orders
□ audit_logs: no UPDATE or DELETE policy (immutable)
□ activity_logs: no UPDATE or DELETE policy
□ dealer_subscriptions: no client-side INSERT/UPDATE/DELETE
□ admin_users: not accessible to regular authenticated users
□ All dealer-scoped tables filter by dealer_id from getCurrentDealer()
□ No dealer_id accepted from form input or URL parameters
```

### C. No Critical Issues Open

```
□ Zero Critical severity issues in staging_issues with status = 'open'
□ Zero Critical severity issues with status = 'investigating'
```

### D. No High Issues Open

```
□ Zero High severity issues with status = 'open'
□ Zero High severity issues with status = 'investigating'
□ All High issues either Resolved or documented as Won't Fix with reason
```

### E. Core Features Verified

```
□ Customer create / update / list — working
□ Vehicle create / update / list — working
□ Estimate create / PDF generate — working
□ Work order create — working (Pro plan)
□ Completion report create — working (Pro plan)
□ Invoice create / PDF generate — working (Pro plan)
□ Payment record — working (Pro plan)
□ Reservation create — working (Pro plan)
```

### F. PDF Generation

```
□ All 4 document types generate PDF successfully:
    Estimate, Invoice, Completion Report, Product Order
□ Japanese text renders without tofu boxes
□ Dealer info (name, address, phone) appears in PDFs
□ Tax calculation correct
□ document_files table updated on generation
□ Signed URL accessible
□ Previous active PDF archived
```

### G. Multi-Tenant Isolation

```
□ Two test dealers verified: GYEON Test Osaka, GYEON Test Tokyo
□ Cross-tenant data access denied via both UI and direct SQL
□ Staff role cannot access /admin
□ Owner can only manage own dealer
□ Super Admin can view all dealers
```

### H. Subscription Feature Gates

```
□ Basic plan: work_orders, invoices, reservations, maintenance, LINE — all blocked
□ Pro plan: LINE — blocked
□ Pro Plus plan: all features accessible
□ Suspended dealer: paid features blocked
□ Feature gate shows correct plan label and upgrade prompt
```

### I. Onboarding

```
□ New dealer (no dealer_settings) redirects to /onboarding
□ Existing dealer (migration 059 applied) does NOT redirect
□ Skip flow: step=8, no future redirect, OnboardingCard shows resume
□ Complete flow: onboarding_completed=true, OnboardingCard hidden
□ Welcome notification created on completion
```

### J. Auth and Session

```
□ Email + password login works
□ Unauthenticated user redirected to /login
□ Super admin can access /admin
□ Non-admin user cannot access /admin
□ Session survives page refresh
```

### K. Release Readiness Page

```
□ /admin/release-readiness loads without error
□ Shows READY or WARNING (not BLOCKED) after all migrations applied
□ No uncaught runtime errors in Vercel logs
```

### L. Backup Documentation Available

```
□ docs/BACKUP_DATABASE.md — reviewed and procedures understood
□ docs/BACKUP_STORAGE.md — reviewed and procedures understood
□ docs/DISASTER_RECOVERY.md — reviewed by responsible team member
□ Most recent Supabase backup timestamp confirmed (staging)
```

### M. Verification Run Passed

```
□ At least one staging_verification_runs record with status = 'passed'
□ All checklist items in that run are Passed or Not Applicable
□ No items in Failed or Blocked state in the final passing run
□ Summary note written by operator
```

### N. UAT Candidates Identified

```
□ At least 2 test dealers ready for UAT (GYEON Test Osaka, GYEON Test Tokyo or real candidates)
□ UAT participants identified and briefed
□ UAT scenario list prepared (minimum: full workflow Customer → Estimate → Invoice → PDF)
□ Feedback collection method defined (email, form, or issue tracker)
```

---

## Optional / Recommended (Not Blocking)

```
□ LINE integration tested end-to-end (if Pro Plus staging account available)
□ Maintenance reminders tested
□ Product order PDF generated
□ Reservation calendar view tested
□ Admin CSV export from /admin/audit tested
□ Performance check: dashboard load < 3s on staging
□ Mobile browser check (iOS Safari, Android Chrome) on key screens
```

---

## Staging Exit Declaration

When ALL mandatory criteria (A through N) are met:

1. Record final status in `docs/MANUAL_MIGRATION_TRACKING.md` Session Log
2. Mark verification run as **Passed** in `/admin/staging-verification`
3. Notify CTO / Technical Lead that staging is ready for UAT
4. Provide:
   - Link to staging URL
   - List of test accounts (owner, staff, super admin)
   - Link to this document and the passing verification run
   - Summary of any Won't Fix issues

> **Reminder**: Production deployment is PROHIBITED until the CTO explicitly
> approves after reviewing this checklist and the staging verification run.

---

## See Also

- `docs/STAGING_VERIFICATION_RUNBOOK.md` — how to run the verification
- `docs/PRODUCTION_READINESS_CHECKLIST.md` — production requirements
- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` — migration application
- `docs/STAGING_SMOKE_TEST_CHECKLIST.md` — smoke test checklist
