# Changelog

All notable changes to GYEON Detailer Agent are documented here.

Format: `PHASE[N] — Title — [files changed]`

---

## [1.0.0-RC1] — 2026-06-21

### PHASE65 — Release Candidate (RC1)
- VERSION.md, CHANGELOG.md, RELEASE_NOTES_v1.md
- KNOWN_LIMITATIONS.md, ROADMAP_V2.md, RELEASE_CHECKLIST.md
- `src/lib/release/rc-status.ts` — RC status utility with 10-category scoring
- `src/components/admin/ReleaseCandidatePanel.tsx` — RC dashboard UI
- `src/app/admin/release-candidate/page.tsx` — Admin RC page
- `docs/OFFICIAL_RELEASE_PROCESS.md`
- Admin nav: Release Candidate link

### PHASE64 — Commercial Billing Preparation
- `supabase/migrations/064_billing_management.sql` — `dealer_billing`, `billing_invoices`
- `src/lib/billing/billing-types.ts` — ContractStatus, InvoiceStatus, helpers
- `src/lib/billing/billing.ts` — 9 billing server functions
- `src/lib/billing/reminder.ts` — renewal reminder targets
- `src/components/admin/BillingDashboard.tsx` — admin billing dashboard
- `src/components/subscription/BillingStatusCard.tsx` — dealer-facing billing card
- `src/app/admin/billing/page.tsx` — admin billing page
- `docs/BILLING_OPERATION_MANUAL.md`, `docs/COMMERCIAL_POLICY.md`

### PHASE63 — UAT Management
- `supabase/migrations/063_uat_management.sql` — `uat_dealers`, `uat_sessions`, `uat_feedback`, `uat_issues`; 4 test dealers seeded
- `src/lib/uat/uat-types.ts`, `src/lib/uat/uat.ts` — 11 UAT service functions
- `src/components/admin/UatDashboard.tsx`, `src/components/admin/UatFeedbackPanel.tsx`
- `src/app/admin/uat/page.tsx`
- `docs/UAT_TEST_CASES.md`, `docs/UAT_FEEDBACK_TEMPLATE.md`, `docs/UAT_KNOWN_LIMITATIONS.md`, `docs/UAT_EXIT_CRITERIA.md`

### PHASE62 — Staging Verification
- `supabase/migrations/062_staging_verification.sql` — `staging_verification_runs`, `staging_verification_items`, `staging_issues`
- `src/lib/staging-verification/checklist.ts` — 63-item checklist across 13 categories
- `src/lib/staging-verification/staging-verification.ts` — 8 server functions
- `src/components/admin/StagingVerificationPanel.tsx`, `src/components/admin/StagingIssuePanel.tsx`
- `src/app/admin/staging-verification/page.tsx`
- `docs/STAGING_VERIFICATION_RUNBOOK.md`, `docs/STAGING_EXIT_CRITERIA.md`

### PHASE61 — Migration Status
- `src/lib/migrations/migration-types.ts` — 27 migration entries with probes
- `src/lib/migrations/migration-status.ts` — checkDatabaseSchemaStatus, getMigrationReadinessStatus
- `src/components/admin/MigrationStatusPanel.tsx`
- `src/app/admin/migration-status/page.tsx`
- `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md`, `docs/MANUAL_MIGRATION_TRACKING.md`, `docs/STAGING_SQL_VERIFICATION_PACK.md`, `docs/STAGING_TEST_DEALER_GUIDE.md`, `docs/STAGING_SMOKE_TEST_CHECKLIST.md`

### PHASE60 — Production Readiness
- `src/lib/release/readiness.ts` — 6 readiness check functions, getReleaseReadinessStatus
- `src/components/admin/ReleaseReadinessPanel.tsx`
- `src/app/admin/release-readiness/page.tsx`
- `docs/ENVIRONMENT_RELEASE_CHECKLIST.md`, `docs/RLS_VERIFICATION_CHECKLIST.md`, `docs/STORAGE_VERIFICATION_CHECKLIST.md`, `docs/LINE_RELEASE_CHECKLIST.md`, `docs/PDF_RELEASE_CHECKLIST.md`, `docs/SUBSCRIPTION_ONBOARDING_CHECKLIST.md`

### PHASE59 — Disaster Recovery
- Backup/restore procedures, health check endpoints
- `src/app/admin/audit/page.tsx` — audit log viewer
- DR runbook documentation

### PHASE58 — Subscription Management
- `supabase/migrations/058_subscription_plans.sql` — `subscription_plans`, `dealer_subscriptions`
- `src/lib/subscriptions/` — subscription service
- `src/components/admin/SubscriptionPanel.tsx`
- `src/app/admin/subscriptions/page.tsx`

### PHASE57 — Admin Console Foundation
- `src/lib/admin/get-current-admin.ts`, `src/lib/admin/write-audit-log.ts`
- `src/app/admin/layout.tsx` — admin header with nav
- `src/app/admin/page.tsx` — admin overview
- `src/app/admin/dealers/page.tsx`, `src/app/admin/users/page.tsx`

### PHASE56 — Payment Records
- `supabase/migrations/056_payments.sql` — `payments` table
- `src/app/(dealer)/payments/page.tsx`
- Payment CRUD with invoice linkage

### PHASE55 — Invoice Management
- `supabase/migrations/055_invoices.sql` — `invoices` table
- `src/app/(dealer)/invoices/page.tsx`
- PDF generation for invoices

### PHASE54 — Work Order & Completion Report
- `supabase/migrations/054_work_orders.sql` — `work_orders`, `work_order_items`
- Work order CRUD, status transitions, PDF generation

### PHASE53 — Estimate & Product Orders
- `supabase/migrations/053_estimates.sql` — `estimates`, `estimate_items`, `product_orders`
- Estimate builder with line items and totals

### PHASE52 — Products & Services
- `supabase/migrations/052_products.sql` — `products`, `service_items`
- Product catalog with pricing

### PHASE51 — Maintenance Scheduler
- `supabase/migrations/051_maintenance.sql` — `maintenance_records`, `maintenance_reminders`
- `src/app/(dealer)/maintenance/page.tsx`
- Reminder-based scheduling

### PHASE50 — Reservation System
- `supabase/migrations/050_reservations.sql` — `reservations`
- `src/app/(dealer)/reservations/page.tsx`
- Calendar view, LINE LIFF booking

### PHASE49 — LINE CRM Integration
- LINE webhook, LIFF pages, `line_message_logs` table
- Customer auto-linking via LINE ID
- `src/app/api/line/` — webhook + LIFF handlers

### PHASE48 — Notifications
- `supabase/migrations/048_notifications.sql` — `notifications` table
- In-app notification bell, LINE push templates

### PHASE47 — Calendar
- `src/app/(dealer)/calendar/page.tsx`
- Reservation + maintenance unified calendar view

### PHASE46 — Document Storage
- `supabase/migrations/046_documents.sql` — `document_files` table
- Supabase Storage integration for PDF files

### PHASE45 — PDF Generation
- PDF service using @react-pdf/renderer
- Estimate PDF, Work Order PDF, Invoice PDF

### PHASE44 — Settings
- `src/app/(dealer)/settings/page.tsx`
- Dealer profile, business info, operating hours

### PHASE43 — Staff Management
- `supabase/migrations/043_dealer_members.sql` — `dealer_members`
- Staff invite, role assignment (owner/staff)

### PHASE42 — Onboarding Flow
- `supabase/migrations/042_onboarding.sql` — `dealer_settings` with onboarding columns
- 5-step onboarding wizard

### PHASE41 — Authentication
- Supabase Auth integration, login page
- Middleware for route protection
- Admin user seeding

### PHASE40 — Dealer Schema
- `supabase/migrations/040_dealers.sql` — `dealers`, `dealer_settings`
- Multi-tenant dealer isolation with RLS

### PHASE39 — Vehicle Schema
- `supabase/migrations/039_vehicles.sql` — `vehicles`
- Vehicle records linked to customers

### PHASE38 — Customer Schema
- `supabase/migrations/038_customers.sql` — `customers`
- Customer CRUD with search

### PHASE37 — Audit Log Schema
- `supabase/migrations/037_audit_logs.sql` — `audit_logs`
- Dealer-level action logging

### PHASE36 — Vehicle Schema (initial)
- Early vehicle schema iteration

### PHASE35 — Customer Schema (initial)
- Early customer schema iteration

---

*Generated: 2026-06-21 | GYEON Detailer Agent v1.0.0-RC1*
