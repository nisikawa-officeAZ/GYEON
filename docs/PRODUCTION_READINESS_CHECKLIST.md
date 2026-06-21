# Production Readiness Checklist — DealerOS / GYEON Detailer Agent

> **IMPORTANT**: Production deployment is still prohibited until manual approval from the CTO.
> This checklist must be completed and signed off before any real-dealer rollout.

---

## Repository Status

```
□ main branch is clean (git status shows no uncommitted changes)
□ All PHASE commits are merged to main
□ Latest commit matches expected hash
□ No debug code or console.log left in production paths
□ No hardcoded dealer_ids, secrets, or test emails in source
□ .env.local is NOT committed to git
□ .env.example is up to date with all required variables
```

---

## Migration Status

```
□ All migrations applied in correct order (see MIGRATION_APPLICATION_ORDER.md)
□ Migration 058 applied: subscription_plans + dealer_subscriptions tables
□ Migration 059 applied: dealer_settings onboarding columns
□ No unapplied migrations remain
□ All existing dealers marked onboarding_completed=true (auto by migration 059)
□ subscription_plans seeded: basic, pro, pro_plus
□ Post-apply row count checks passed (see MIGRATION_APPLICATION_ORDER.md)
```

---

## Environment Variables

```
□ NEXT_PUBLIC_SUPABASE_URL        — set, points to production project
□ NEXT_PUBLIC_SUPABASE_ANON_KEY   — set, production anon key
□ SUPABASE_SERVICE_ROLE_KEY       — set, production service_role key (server-only)
□ NEXT_PUBLIC_APP_URL             — set to production URL (no trailing slash)
□ STORAGE_BUCKET                  — set (default: "documents")
□ LINE_CHANNEL_ID                 — set (if LINE is enabled)
□ LINE_CHANNEL_SECRET             — set (if LINE is enabled)
□ LINE_CHANNEL_ACCESS_TOKEN       — set (if LINE is enabled)
□ NEXT_PUBLIC_LIFF_ID             — set (if LIFF is used)
□ CRON_SECRET                     — set (random hex 32+)
□ No .env.local values leaked to Vercel production config
□ No staging secrets in production env
```

See `docs/ENVIRONMENT_RELEASE_CHECKLIST.md` for detailed verification steps.

---

## Supabase Auth

```
□ Email auth enabled
□ Email confirmation required (or disabled intentionally)
□ Password strength policy set
□ Session duration configured
□ Auth rate limiting enabled
□ Admin users exist in admin_users table
□ Test login succeeds with a non-admin dealer account
□ Test login succeeds with admin account
□ Non-admin cannot access /admin/* routes
□ Non-authenticated user is redirected to /login
```

---

## Dealer Isolation

```
□ Dealer A cannot see Dealer B's customers
□ Dealer A cannot see Dealer B's work orders, estimates, invoices
□ dealer_id is resolved from getCurrentDealer() on every server action
□ No dealer_id accepted from form data or URL params
□ Admin operations use service_role (createAdminClient) only on server
□ dealer_members.status = 'active' required for access
```

---

## RLS Policies

See `docs/RLS_VERIFICATION_CHECKLIST.md` for table-level verification.

```
□ RLS enabled on all dealer-scoped tables
□ No accidental public SELECT policy
□ audit_logs: INSERT + SELECT only (no UPDATE, no DELETE)
□ activity_logs: INSERT + SELECT only (no UPDATE, no DELETE)
□ dealer_subscriptions: no client-side INSERT/UPDATE/DELETE
□ admin_audit_logs: server-side only (service_role)
□ subscription_plans: read-only for authenticated users
```

---

## Storage Buckets

See `docs/STORAGE_VERIFICATION_CHECKLIST.md` for detailed steps.

```
□ "documents" bucket exists
□ Bucket is PRIVATE (not public)
□ Upload requires service_role key
□ Signed URLs expire (not permanent)
□ Path pattern enforced: {dealer_id}/{type}/{filename}.pdf
□ Cross-dealer file access denied
□ PDF upload succeeds for all 4 document types
□ document_files table is updated on each generation
□ Old active records are archived before new insert
```

---

## PDF Generation

See `docs/PDF_RELEASE_CHECKLIST.md`.

```
□ @react-pdf/renderer in serverExternalPackages (next.config.ts)
□ Estimate PDF renders correctly with Japanese text
□ Work Order / Completion Report / Invoice / Product Order PDFs work
□ PDF contains correct dealer info (name, address, phone)
□ Tax rate applies correctly
□ Stamp image renders (if configured)
□ PDF footer renders
□ Generated file accessible via signed URL
□ PDF file size is reasonable (< 2 MB for typical documents)
```

---

## LINE Integration

See `docs/LINE_RELEASE_CHECKLIST.md`.

```
□ LINE env vars set (or confirmed as intentionally absent)
□ Webhook URL configured in LINE Developers Console
□ Signature verification enabled in webhook handler
□ LINE only accessible on Pro Plus plan
□ Basic / Pro dealers cannot access LINE features
□ Test message send succeeds (if LINE is configured)
□ Failed sends create line_message_logs entries
□ LINE customer link/unlink works
```

---

## Subscription Plans

See `docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md`.

```
□ subscription_plans table seeded (basic, pro, pro_plus)
□ Feature gates work: Basic cannot access Pro features
□ Feature gates work: Pro cannot access Pro Plus features
□ Feature gate on work_orders page (Pro required)
□ Feature gate on invoices page (Pro required)
□ Feature gate on reservations page (Pro required)
□ Feature gate on maintenance page (Pro required)
□ Feature gate on LINE page (Pro Plus required)
□ SubscriptionStatusCard shows correct info on settings page
□ Admin subscription management (/admin/subscriptions) works
□ Plan change syncs dealers.plan + dealer_subscriptions
□ Audit log written on subscription change
```

---

## Onboarding Flow

```
□ New dealer (no dealer_settings) is redirected to /onboarding
□ Existing dealer (migration 059 applied) is NOT redirected
□ Step 1 saves dealer info to dealer_settings
□ Skip (後で続ける) sets onboarding_step=8, no more redirect
□ Resume: OnboardingCard on dashboard links to /onboarding
□ Step 7 completes: onboarding_completed=true, notification created
□ Dashboard OnboardingCard hides after completion
□ All 7 steps render without errors
```

---

## Audit Logs

```
□ audit_logs table is IMMUTABLE (no UPDATE/DELETE RLS)
□ createAuditLog() is fire-and-forget (never blocks primary flow)
□ PDF generation logged
□ Staff creation/deletion logged
□ Subscription changes logged (via admin_audit_logs)
□ Onboarding events logged
□ Feature access denied logged
□ AuditLogViewer renders at /admin/audit
□ CSV export works
□ Admin can filter by action, resource type, date range
```

---

## Backup / Disaster Recovery

See `docs/DISASTER_RECOVERY.md` and `docs/BACKUP_DATABASE.md`.

```
□ Supabase Pro plan backup is enabled and verified
□ Most recent backup timestamp confirmed
□ Database restore procedure tested on staging
□ Storage backup procedure documented and tested
□ All env vars stored in Vercel + password manager
□ Admin can access /admin → SystemHealthCard shows all green
□ Disaster recovery runbook accessible to all team members
```

---

## Health Monitoring

```
□ /admin → SystemHealthCard shows all green
□ /admin/release-readiness — no BLOCKED items
□ Supabase dashboard shows no errors
□ Vercel function logs show no runtime errors
□ Test dealer can complete a full workflow:
  Customer → Vehicle → Estimate → Work Order → Invoice → Payment → PDF
```

---

## Final Approval Gate

```
□ All sections above are checked off
□ Staging environment tested with realistic data
□ Admin release readiness page shows "Ready" or "Warning" (not "Blocked")
□ CTO / Technical Lead has reviewed this checklist
□ Production deployment approved by authorized person
□ Rollback plan confirmed
□ On-call contact identified for day-1 support
```

**Production deployment is PROHIBITED until all gates above are cleared.**

---

## See Also

- `docs/MIGRATION_APPLICATION_ORDER.md`
- `docs/ENVIRONMENT_RELEASE_CHECKLIST.md`
- `docs/RLS_VERIFICATION_CHECKLIST.md`
- `docs/STORAGE_VERIFICATION_CHECKLIST.md`
- `docs/LINE_RELEASE_CHECKLIST.md`
- `docs/PDF_RELEASE_CHECKLIST.md`
- `docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md`
- `docs/DISASTER_RECOVERY.md`
- `docs/BACKUP_DATABASE.md`
