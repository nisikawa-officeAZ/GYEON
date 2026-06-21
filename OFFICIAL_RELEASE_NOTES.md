# GYEON Detailer Agent — Official Release Notes

**Version:** 1.0.0  
**Status:** Official Release  
**Owner:** Office AZ  
**Powered by:** GYEON Japan  
**Release Date:** 2026

> 施工で終わらせない。顧客との関係を、次の来店へ。

---

## Overview

GYEON Detailer Agent is a cloud-based business management platform built exclusively for professional car detailing shops. It covers the full customer journey — from first contact and vehicle registration through estimate, work order, invoice, and payment — and extends that relationship through LINE CRM, maintenance reminders, and reservations.

Version 1.0.0 marks the official general availability release following PHASE35–PHASE66 of structured development, staging verification, and UAT with real dealerships.

---

## Main Features

### Customer Management
Register and manage customers with full contact details. Search by name, phone, or email. Link customers to LINE accounts for direct messaging. Attach multiple vehicles per customer.

### Vehicle Management
Track vehicles with make, model, year, plate number, color, and VIN. View full service history per vehicle. Link vehicles to customers and all downstream records.

### Estimate
Build line-item estimates with products and services from your catalog. Calculate subtotal, tax, and total automatically. Export to PDF and share with customers.

### PDF Generation
Generate professional PDF documents for estimates, work orders, completion reports, and invoices. PDFs are stored privately in Supabase Storage and delivered via signed URL. Renders correctly on desktop and mobile.

### Work Order
Create work orders from estimates or directly. Track status through draft → in_progress → completed. Assign staff, record before/after notes, link customer and vehicle.

### Completion Report
Document completed work with technician notes and service summary. Linked to work order. Generates a PDF completion report for customer records.

### Invoice
Generate invoices from work orders or estimates. Line items with quantity, unit price, and totals. Tax calculation. PDF invoice delivery. Link to payment records.

### Payment
Record payments against invoices. Track payment method (cash, transfer, credit). Support for partial payment and multiple payment records per invoice.

### LINE CRM Integration
- Webhook for inbound customer messages
- Automatic customer link via LINE ID
- Push message delivery (reservation reminders, maintenance reminders)
- LIFF customer self-link page
- LIFF self-booking reservation page
- Message log in admin audit

### Maintenance Reminder
Track maintenance records per vehicle with service type, date, and next interval. Send LINE push reminders to customers before service is due. Reduce no-shows and increase repeat visits.

### Reservation System
Accept reservations with date, time, service type, and staff assignment. Calendar view (month + week). Customer self-booking via LINE LIFF. Status management: pending → confirmed → completed / cancelled.

### Products & Services
Maintain a product catalog with SKU, name, price, and tax settings. Use products as line items in estimates, work orders, and invoices. Service items for non-product labor charges.

### Subscription Management
Plan tiers: Trial, Basic, Pro, Pro Plus. Admin-managed plan assignment. Trial period with full feature access. Middleware enforces subscription status on every request. Status: trial / active / suspended / cancelled / expired.

### Billing (Manual)
Commercial billing without payment gateway. Admin creates and issues invoices manually. Dealer can view own billing record and invoice history. Renewal reminder at 30 days and 7 days. Bank transfer payment confirmation workflow. Full audit log of all billing operations.

### Audit Log
Dealer-level audit log for all significant actions (create, update, status change). Admin audit log for admin console operations. Admin audit viewer with filter and timestamp display.

### Health & Release Readiness
Six-category readiness check: Environment, Storage, Database, LINE, Subscription, Onboarding. Status: READY / WARNING / BLOCKED. Migration status tracker with 27+ probe points. Staging verification checklist: 63 items across 13 categories. RC status scoring: 10 categories × 10 points = 100.

### Backup & Disaster Recovery
Supabase point-in-time recovery (PITR). Manual backup procedure documented. Restore procedure tested in staging. Rollback plan defined. On-call contact documented.

### Onboarding
Five-step dealer onboarding wizard on first login: business profile, settings, first customer, first vehicle, LINE connection. All existing dealers marked onboarding_completed automatically.

### UAT Management
Admin console for managing UAT dealer sessions, collecting structured feedback with ratings and categories, tracking issues by severity, and documenting exit criteria.

---

## System Architecture

```
Browser / PWA
     │
     ▼
Next.js 15 (App Router, Turbopack)
Vercel Edge Network
     │
     ├── Supabase Auth (JWT, RLS enforcement)
     ├── Supabase Database (PostgreSQL, 65 migrations)
     ├── Supabase Storage (private bucket, signed URLs)
     └── LINE Messaging API (webhook + LIFF)
```

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js App Router | Server components reduce client JS; server actions handle mutations |
| Supabase RLS | Dealer isolation enforced at DB layer — no application-level tenant filter needed |
| "use server" / "use client" split | Type-only files have no directive; server action files export only async functions |
| Manual migration apply | Prevents accidental schema mutation in production; full audit of what was applied |
| No Stripe (v1) | Simplifies launch; manual billing is sufficient for initial dealer count |
| PWA | Dealers can install on iOS/Android without app store submission |

---

## Security

- **Row Level Security (RLS)** on every table — dealers cannot access other dealers' data
- **No DELETE policies** on audit, billing, UAT, staging verification tables — data is retained permanently
- **Admin guard** (`requireAdmin()`) on all admin server functions
- **dealer_id isolation** — always sourced from `getCurrentDealer()`, never from forms or URL parameters
- **Signed URL storage** — no direct public access to PDFs
- **Middleware protection** — all dealer routes check auth and subscription status on every request
- **Audit logging** — every admin action and significant dealer action is recorded with timestamp and actor

---

## Subscription

Three commercial tiers:

| Plan | Price | Target |
|------|-------|--------|
| Trial | ¥0 | UAT participants, evaluation |
| Pro | ¥12,000 / year | Standard commercial detailer shops |
| Pro Plus | Custom quote | Enterprise / high-volume / dealer groups |

Trial accounts have full feature access. All billing is manual at v1.0.

---

## Billing

Manual commercial billing workflow:

1. Admin creates `dealer_billing` record with plan, dates, notes
2. Admin creates `billing_invoices` record with amount and due date
3. Admin issues invoice (status: issued)
4. Dealer pays via bank transfer
5. Admin confirms payment (status: paid)
6. Admin renews subscription annually (extends expires_at + renewal_date)

Renewal reminders surface in Admin Console at 30 days and 7 days before renewal date.

---

## PDF

PDF documents are generated server-side using `@react-pdf/renderer`. All PDFs are:

- Uploaded to a **private** Supabase Storage bucket
- Accessed via signed URLs (60-second expiry)
- Referenced in the `document_files` table with dealer, type, and upload metadata
- Renderable on all major browsers and mobile devices

---

## LINE Integration

LINE is the primary customer communication channel for the Japanese market.

- **Webhook** at `/api/line/webhook` — receives and processes inbound messages
- **LIFF** at `/liff/link` — customer self-link to their dealer account
- **LIFF** at `/liff/reservation` — customer self-booking
- **Push messages** — reservation reminders, maintenance reminders
- **Signature validation** — all webhook requests verified with `LINE_CHANNEL_SECRET`

Required environment variables: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`.

---

## Backup

| Method | Detail |
|--------|--------|
| Supabase PITR | Point-in-time recovery on Supabase cloud projects |
| Manual backup | Admin takes snapshot from Supabase Dashboard before any migration |
| Restore procedure | Documented in DR runbook |

---

## Disaster Recovery

Recovery objectives for v1.0:

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | < 4 hours |
| RPO (Recovery Point Objective) | < 24 hours (PITR) |

Rollback procedure:
1. Revert Vercel deployment to previous version (Vercel Dashboard → Promote)
2. If schema rollback needed: restore from pre-migration backup via Supabase PITR
3. Notify affected dealers
4. Document incident, fix, re-validate, re-release

---

## Release Notes

### What's New in 1.0.0

This is the initial production release. All features listed above are available from day one.

### Upgrade from RC1

No data migration required. RC1 and v1.0.0 share the same schema. The version indicator is updated in `VERSION.md` and the Admin Console.

---

## Future Plans

See `ROADMAP_AFTER_v1.md` for the full post-v1 roadmap.

**Planned for v1.1:**
- Stripe payment integration
- Automated invoice generation on subscription renewal
- Automated renewal reminder (email + LINE push)
- Inventory management with stock tracking

**Planned for v2.0 (Global Edition):**
- Internationalization (English, Chinese)
- Multi-currency (USD, EUR, AUD)
- WhatsApp Business API integration
- B2B supplier ordering system
- AI assistant for customer and vehicle history

---

*GYEON Detailer Agent v1.0.0 | Office AZ | Powered by GYEON Japan*  
*施工で終わらせない。顧客との関係を、次の来店へ。*
