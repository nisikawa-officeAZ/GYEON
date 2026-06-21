# Release Checklist — GYEON Detailer Agent v1.0.0

**Version:** 1.0.0  
**Prepared by:** Office AZ Admin  
**Date:** ___________  
**Environment:** Staging → Production

---

## Pre-Release Gates

All items must be PASS before production deployment is approved.

---

## 1. Database Migrations [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1 | All 27+ migrations applied in Supabase (staging) | [ ] | |
| 1.2 | No migration errors in Supabase dashboard | [ ] | |
| 1.3 | Migration probe: all tables accessible | [ ] | |
| 1.4 | Subscription plans seeded (basic, pro, pro_plus) | [ ] | |
| 1.5 | UAT test dealers seeded (063 migration) | [ ] | |
| 1.6 | staging_verification_items count ≥ 63 | [ ] | |

**Gate: All 6 PASS → proceed** ✓ / ✗

---

## 2. Row Level Security (RLS) [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1 | RLS enabled on all dealer tables | [ ] | |
| 2.2 | Dealer A cannot read Dealer B data | [ ] | |
| 2.3 | Admin tables accessible to admin_users only | [ ] | |
| 2.4 | Billing tables: dealer read-own, no DELETE | [ ] | |
| 2.5 | UAT tables: admin only | [ ] | |
| 2.6 | No public SELECT policy on sensitive tables | [ ] | |

**Gate: All 6 PASS → proceed** ✓ / ✗

---

## 3. Storage [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1 | Storage bucket exists and is PRIVATE | [ ] | |
| 3.2 | Signed URL generation works (60s expiry) | [ ] | |
| 3.3 | PDF upload succeeds | [ ] | |
| 3.4 | document_files table accessible | [ ] | |
| 3.5 | No public access to bucket | [ ] | |

**Gate: All 5 PASS → proceed** ✓ / ✗

---

## 4. LINE Integration [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1 | LINE_CHANNEL_ID set | [ ] | |
| 4.2 | LINE_CHANNEL_SECRET set | [ ] | |
| 4.3 | LINE_CHANNEL_ACCESS_TOKEN set | [ ] | |
| 4.4 | NEXT_PUBLIC_LIFF_ID set | [ ] | |
| 4.5 | Webhook URL registered in LINE Developers Console | [ ] | |
| 4.6 | Webhook signature validation passes | [ ] | |
| 4.7 | Test message received and logged | [ ] | |
| 4.8 | Customer link via LIFF works | [ ] | |

**Gate: All 8 PASS → proceed** ✓ / ✗

---

## 5. PDF Generation [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1 | Estimate PDF generates without error | [ ] | |
| 5.2 | Work Order PDF generates without error | [ ] | |
| 5.3 | Invoice PDF generates without error | [ ] | |
| 5.4 | PDF uploads to storage and signed URL works | [ ] | |
| 5.5 | PDF renders correctly in browser | [ ] | |

**Gate: All 5 PASS → proceed** ✓ / ✗

---

## 6. Subscription [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.1 | Subscription plans (basic, pro, pro_plus) accessible | [ ] | |
| 6.2 | Plan assignment works (admin) | [ ] | |
| 6.3 | Trial status correctly restricts/allows features | [ ] | |
| 6.4 | Suspension blocks dealer access | [ ] | |
| 6.5 | Middleware checks subscription on each request | [ ] | |

**Gate: All 5 PASS → proceed** ✓ / ✗

---

## 7. Billing [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.1 | dealer_billing table accessible | [ ] | |
| 7.2 | billing_invoices table accessible | [ ] | |
| 7.3 | Create billing record works | [ ] | |
| 7.4 | Create invoice works | [ ] | |
| 7.5 | Mark invoice paid works | [ ] | |
| 7.6 | Renewal logic extends expires_at correctly | [ ] | |
| 7.7 | Dealer can read own billing (RLS confirmed) | [ ] | |

**Gate: All 7 PASS → proceed** ✓ / ✗

---

## 8. Health & Audit [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 8.1 | audit_logs table accessible | [ ] | |
| 8.2 | admin_audit_logs table accessible | [ ] | |
| 8.3 | Audit entries written on key actions | [ ] | |
| 8.4 | Admin audit viewer displays entries | [ ] | |
| 8.5 | Release readiness page: no BLOCKED checks | [ ] | |
| 8.6 | Migration status page: all migrations probed | [ ] | |

**Gate: All 6 PASS → proceed** ✓ / ✗

---

## 9. UAT [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 9.1 | At least 2 UAT dealers completed | [ ] | |
| 9.2 | No CRITICAL open issues | [ ] | |
| 9.3 | No HIGH open issues | [ ] | |
| 9.4 | Average rating ≥ 3.5 stars | [ ] | |
| 9.5 | UAT exit criteria met (see docs/UAT_EXIT_CRITERIA.md) | [ ] | |
| 9.6 | UAT session summary documented | [ ] | |

**Gate: All 6 PASS → proceed** ✓ / ✗

---

## 10. Backup & DR [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 10.1 | Supabase PITR (point-in-time recovery) enabled | [ ] | |
| 10.2 | Manual backup taken before production migration | [ ] | |
| 10.3 | Restore procedure tested in staging | [ ] | |
| 10.4 | Rollback plan documented | [ ] | |
| 10.5 | On-call contact identified | [ ] | |

**Gate: All 5 PASS → proceed** ✓ / ✗

---

## 11. Release Readiness [ ]

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 11.1 | Release readiness page: READY or WARNING | [ ] | |
| 11.2 | RC status score ≥ 70 | [ ] | |
| 11.3 | npx tsc --noEmit passes | [ ] | |
| 11.4 | npm run lint passes | [ ] | |
| 11.5 | npm run build passes | [ ] | |
| 11.6 | Staging smoke test checklist complete | [ ] | |
| 11.7 | Staging verification run: PASSED | [ ] | |

**Gate: All 7 PASS → proceed** ✓ / ✗

---

## Final Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Engineer | | | |
| Admin / Owner | | | |
| GYEON Representative | | | |

**APPROVED FOR PRODUCTION DEPLOYMENT:** Yes / No

---

## Post-Release Verification (within 1 hour of deploy)

- [ ] Production migrations applied successfully
- [ ] Admin Console accessible
- [ ] Test dealer login works
- [ ] PDF generation works in production
- [ ] LINE webhook receives messages in production
- [ ] No errors in Vercel function logs

---

*GYEON Detailer Agent v1.0.0 Release Checklist | Office AZ*
