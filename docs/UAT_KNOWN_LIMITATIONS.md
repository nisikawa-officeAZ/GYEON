# UAT Known Limitations — DealerOS / GYEON Detailer Agent

## Purpose

This document describes known limitations of the UAT staging environment.
UAT participants should be aware of these limitations before testing.

---

## 1. Staging Environment Only

```
LIMITATION: All UAT testing is conducted on the STAGING environment.
This is NOT the production system.

IMPACT: 
- Data entered during UAT will not carry over to production
- Some features may behave slightly differently in production
- Performance may differ from production (shared resources)

ACTION: No action needed — by design.
```

---

## 2. No Production Deployment

```
LIMITATION: Production deployment is explicitly prohibited during UAT.

IMPACT:
- Any issues found in UAT cannot be fixed and immediately deployed to production
- Production customers are not affected by UAT

ACTION: Issues are tracked and will be resolved before production launch.
```

---

## 3. Manual Migration Required

```
LIMITATION: Database migrations must be applied manually by an operator
in Supabase SQL Editor. There is no automated migration system.

IMPACT:
- Schema changes require operator intervention before testing
- If a migration is missing, some features will not work

ACTION: Confirm migration status at /admin/migration-status before testing.
If migrations are incomplete, notify the operator.
```

---

## 4. LINE Integration Test Environment

```
LIMITATION: LINE integration on staging uses a test LINE channel,
not the production channel.

IMPACT:
- Test messages are sent to the test LINE channel only
- LIFF links may use a staging-specific LIFF App ID
- LINE customer links created during UAT will not exist in production

ACTION: Use the designated test LINE account for UAT.
Do not link your personal LINE account.
```

---

## 5. Subscription Plan — Trial Limitations

```
LIMITATION: Subscription plans on staging are configured for testing.
Payment processing (Stripe/billing) is NOT integrated.

IMPACT:
- Plan changes are made manually by admins in the admin console
- Billing cycles do not automatically advance
- "Expired" subscription status must be manually set for testing

ACTION: Notify the admin if you need a specific plan status for testing
(e.g., "suspended" to test feature gates).
```

---

## 6. Email Notifications

```
LIMITATION: Email notifications (if any) on staging use a test email
domain and may not reach real mailboxes.

IMPACT:
- "Invite" emails or notification emails may not be delivered
- Email confirmation flows may need to be bypassed manually

ACTION: The admin will set up accounts manually for UAT participants.
```

---

## 7. PDF File Storage

```
LIMITATION: PDFs generated during UAT are stored in the staging Supabase
Storage bucket, not in production storage.

IMPACT:
- Generated PDFs will be deleted when staging data is cleared
- Signed URLs will expire and become inaccessible after expiry

ACTION: Download any important test PDFs immediately after generation.
```

---

## 8. Test Data Only

```
LIMITATION: Test data entered during UAT (customers, vehicles, estimates, etc.)
is staging data only and will not be migrated to production.

IMPACT:
- Do not enter real customer information (PII) during UAT
- Use fictional test data (e.g., テスト顧客, テスト車両)

ACTION: Use the test data patterns defined in docs/STAGING_TEST_DEALER_GUIDE.md.
```

---

## 9. Concurrent Users

```
LIMITATION: Staging may have multiple UAT participants testing simultaneously.

IMPACT:
- You may see test data created by other participants
- Performance may degrade under concurrent load
- Conflicting test scenarios may interfere

ACTION: Coordinate test scheduling with the admin if precise isolation is needed.
Each test dealer has their own isolated data space via RLS.
```

---

## 10. Admin Console Access

```
LIMITATION: The Admin console (/admin) is only accessible to designated
Super Admin accounts.

IMPACT:
- UAT dealer accounts cannot access /admin
- Audit logs, subscription management, and UAT tracking require admin access

ACTION: Super Admin access is granted to designated testers only.
```

---

## 11. Maintenance Reminders (Auto-Send)

```
LIMITATION: Automatic reminder sending via scheduled jobs may not be
active in staging.

IMPACT:
- Reminder schedules can be created but auto-send may not trigger
- Manual testing of individual reminder sends is possible

ACTION: Test reminder creation and manual send only.
```

---

## 12. Calendar Integration

```
LIMITATION: Google Calendar / external calendar sync is not configured
in the staging environment.

IMPACT:
- Reservations appear in the in-app calendar only
- No external calendar sync events are created

ACTION: Test in-app calendar only.
```

---

## Reporting Limitations

If you encounter a behavior that seems like a limitation rather than a bug,
check this document first. If it's not listed here, it may be an actual bug.

When in doubt, report it via the UAT feedback process — the admin will classify it.

---

## See Also

- `docs/UAT_TEST_CASES.md` — test cases designed within these limitations
- `docs/UAT_FEEDBACK_TEMPLATE.md` — how to report bugs vs. limitations
- `docs/STAGING_TEST_DEALER_GUIDE.md` — test data setup guide
