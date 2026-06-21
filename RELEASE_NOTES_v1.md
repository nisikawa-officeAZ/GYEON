# Release Notes — GYEON Detailer Agent v1.0.0-RC1

**Release Date:** 2026-06-21  
**Status:** Release Candidate  
**Owner:** Office AZ / GYEON Japan

---

## Overview

GYEON Detailer Agent is a cloud-based business management platform purpose-built for professional car detailing shops. Version 1.0.0-RC1 represents the first release candidate for general availability.

---

## Major Features

### Customer Management
- Customer registration with name, phone, email, address
- Customer search and filtering
- Vehicle linkage per customer
- LINE customer link via LIFF

### Vehicle Management
- Vehicle records linked to customers
- Make, model, year, plate, color, VIN
- Service history per vehicle

### Estimate
- Line-item estimate builder
- Product/service catalog integration
- Subtotal, tax, total calculation
- PDF export

### PDF Generation
- Estimate PDF
- Work Order PDF
- Completion Report PDF
- Invoice PDF
- Signed URL delivery via Supabase Storage

### Work Order
- Work order creation from estimate
- Status transitions: draft → in_progress → completed
- Assigned staff tracking
- Before/after notes

### Completion Report
- Linked to work order
- Service summary and technician notes
- Customer sign-off record

### Invoice
- Invoice generation from work order / estimate
- Line items with totals
- PDF invoice delivery

### Payment
- Payment records linked to invoices
- Payment method tracking
- Partial payment support

### LINE CRM Integration
- Webhook for inbound messages
- Customer auto-linking via LINE ID
- Push message templates (reservation reminder, maintenance reminder)
- LIFF customer link page
- LIFF reservation page

### Reservation System
- Reservation booking with date/time/service
- Calendar view (month/week)
- LINE LIFF self-booking
- Status: pending / confirmed / cancelled / completed

### Maintenance Reminder
- Maintenance record tracking per vehicle
- Interval-based reminder scheduling
- LINE push reminder delivery

### Subscription Management
- Plan tiers: Basic / Pro / Pro Plus
- Trial period support
- Admin plan management
- Subscription status: trial / active / suspended / cancelled / expired

### Billing (Manual)
- Contract status tracking per dealer
- Manual invoice creation and issuance
- Payment confirmation workflow
- Renewal reminder system (30-day, 7-day, overdue)
- No Stripe / no automatic charge at RC1

### Audit Log
- Admin audit log for all sensitive actions
- Dealer-level action log
- Audit viewer in Admin Console

### Health & Disaster Recovery
- Release readiness check (6 categories)
- Migration status tracker (27 migration probes)
- Staging verification checklist (63 items, 13 categories)
- Backup and restore procedures documented

### UAT Management
- UAT dealer registration and session tracking
- Feedback collection with categories and ratings
- Issue tracker with severity levels
- Exit criteria documentation

### Admin Console
- Overview dashboard
- Dealer management
- User management
- Subscription management
- Audit log viewer
- Release readiness panel
- Migration status panel
- Staging verification panel
- UAT management panel
- Billing management panel
- Release Candidate (RC) status panel

---

## Technical Highlights

- **Next.js 15 App Router** with Turbopack
- **Supabase** for database, auth, and storage
- **Row Level Security (RLS)** on all tables — dealer isolation enforced at DB layer
- **Multi-tenant** architecture — each dealer's data is fully isolated
- **PWA** — installable on iOS/Android via @ducanh2912/next-pwa
- **PDF generation** with @react-pdf/renderer
- **TypeScript** strict mode throughout
- **TailwindCSS v4**

---

## Deployment Notes

- Deployment target: **Vercel**
- Database: **Supabase** (PostgreSQL)
- Storage: **Supabase Storage** (private bucket)
- No migration is applied automatically — all SQL must be run manually in Supabase SQL Editor
- See `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` for migration procedure

---

## Known Limitations

See `KNOWN_LIMITATIONS.md` for full details.

- No automatic database migration
- No Stripe / card payment integration
- Japanese language only (internationalization is v2)
- WhatsApp reserved for Global Edition (v2)
- Manual billing operations only

---

## Upgrade Path

This is the initial release. No upgrade path from a prior version.

---

*GYEON Detailer Agent v1.0.0-RC1 | Office AZ | Powered by GYEON Japan*
