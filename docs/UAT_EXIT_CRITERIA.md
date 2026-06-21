# UAT Exit Criteria — DealerOS / GYEON Detailer Agent

## Purpose

This document defines the minimum criteria that must be met to declare
UAT (User Acceptance Testing) successfully completed and authorize
progression to production rollout planning.

> **IMPORTANT**: Completion of UAT does NOT authorize production deployment.
> Production deployment requires a separate, explicit CTO sign-off after UAT.

---

## Mandatory Exit Criteria

ALL of the following must be satisfied.

### A. Participation

```
□ At least 2 UAT dealers have completed testing (status = completed)
□ Each completing dealer has at least 1 completed UAT session
□ At least 5 feedback items submitted across all sessions
```

### B. No Critical Issues Open

```
□ Zero uat_issues records with severity = 'critical' AND status = 'open'
□ Zero uat_issues records with severity = 'critical' AND status = 'investigating'
□ Any critical issues that were found are Resolved or documented as Won't Fix
  with explicit CTO acknowledgement
```

### C. No High Issues Open

```
□ Zero uat_issues records with severity = 'high' AND status = 'open'
□ Zero uat_issues records with severity = 'high' AND status = 'investigating'
□ All high issues resolved or Won't Fix with documented justification
```

### D. Core Flows Tested and Passed

Every flow below must have at least one "passed" test result from a UAT participant:

```
□ Login and authentication (TC-01)
□ Customer create and view (TC-02)
□ Vehicle create and link to customer (TC-03)
□ Estimate create with line items (TC-04)
□ Estimate PDF generation with Japanese text (TC-05)
□ Invoice create and link (TC-06)
□ Payment record and balance update (TC-07)
□ Work order create (TC-08)
□ Completion report create (TC-09)
□ Onboarding wizard — skip and complete flows (TC-15)
```

### E. PDF Generation Stable

```
□ Estimate PDF: tested by at least 2 dealers, both passed
□ Invoice PDF: tested and passed
□ Japanese text renders correctly in ALL PDF types (no tofu boxes reported)
□ No "PDF generation failed" bugs open with High or Critical severity
```

### F. Subscription Feature Gates Verified

```
□ Basic plan restrictions tested: /work-orders, /invoices blocked
□ Pro plan restrictions tested: /line blocked
□ FeatureLocked screen shows correct plan label
□ No bypass of feature gates reported
```

### G. Dealer Isolation Verified (by UAT testing)

```
□ Dealer A confirmed cannot see Dealer B's data
□ No cross-dealer data leakage reported by any UAT participant
□ Staff accounts confirmed unable to access /admin
```

### H. RLS Verified

```
□ Staging verification run shows all RLS items Passed
  (see /admin/staging-verification)
□ No RLS bypass reported during UAT
```

### I. LINE Integration (if applicable)

```
□ LINE integration tested with at least 1 Pro Plus dealer
  OR documented as "not available in UAT environment" with known limitation noted
□ No critical LINE issues open
□ LINE feature gate confirmed (Basic/Pro cannot access)
```

### J. Staging Verification Run Passed

```
□ At least one staging_verification_runs record with status = 'passed'
  (from /admin/staging-verification)
□ No critical items in failed state in the passing run
```

### K. UAT Dashboard Reflects Reality

```
□ /admin/uat shows correct participant status
□ All feedback items recorded in the system
□ All issues recorded with correct severity and status
□ At least 2 dealers show status = 'completed'
```

---

## Quantitative Thresholds

| Metric | Minimum Required |
|---|---|
| UAT dealers completed | 2 |
| UAT sessions completed | 2 |
| Feedback items submitted | 5 |
| Average feature rating | ≥ 3.0 out of 5 |
| Critical issues open | 0 |
| High issues open | 0 |
| Core flows tested | All 10 (TC-01 to TC-09 + TC-15) |

---

## Quality Bar (Non-Blocking but Tracked)

These are not blocking but should be reviewed before launch:

```
□ Average overall rating ≥ 4.0 (target)
□ No more than 3 Medium issues unresolved
□ Onboarding flow rated ≥ 4 by both completing dealers
□ PDF generation rated ≥ 4 by both completing dealers
□ At least 1 "positive feedback" item per core flow
```

---

## UAT Sign-Off Process

When all mandatory criteria are met:

1. Admin confirms criteria via `/admin/uat` dashboard
2. Admin marks UAT session status = 'completed' for all participating dealers
3. Admin generates UAT summary:
   - Total dealers tested
   - Total feedback items
   - Issues found, resolved, and remaining
   - Average ratings
   - Recommendation: Go / No-Go for production
4. Summary submitted to CTO for review
5. CTO makes final Go / No-Go decision for production

---

## Go / No-Go Decision Matrix

| Situation | Decision |
|---|---|
| All mandatory criteria met, average rating ≥ 4 | GO |
| All mandatory criteria met, rating 3.0–3.9 | GO with conditions (address Medium issues in first patch) |
| Mandatory criteria met but known limitations | GO with documented risk acceptance |
| Any critical issue open | NO-GO |
| Any high issue open | NO-GO |
| Fewer than 2 dealers completed | NO-GO |
| Core flow failure reported | NO-GO |

---

## After UAT Sign-Off

After CTO signs off on UAT:

1. Begin `docs/PRODUCTION_READINESS_CHECKLIST.md` manual review
2. Apply all migrations to production (manual, one at a time)
3. Complete `docs/MANUAL_MIGRATION_TRACKING.md` for production
4. Deploy application to production
5. Run `docs/STAGING_SMOKE_TEST_CHECKLIST.md` equivalent on production

---

## See Also

- `docs/STAGING_EXIT_CRITERIA.md` — staging must pass before UAT starts
- `docs/UAT_TEST_CASES.md` — test cases UAT participants follow
- `docs/UAT_FEEDBACK_TEMPLATE.md` — feedback submission format
- `docs/UAT_KNOWN_LIMITATIONS.md` — known staging limitations
- `docs/PRODUCTION_READINESS_CHECKLIST.md` — post-UAT production checklist
