# Known Limitations — GYEON Detailer Agent v1.0.0-RC1

**Version:** 1.0.0-RC1  
**Date:** 2026-06-21

---

## Database

### No Automatic Migration
- All database migrations must be applied **manually** via Supabase SQL Editor
- There is no admin button or API to apply migrations
- Running migrations out of order may cause failures
- **Workaround:** Follow `docs/STAGING_MIGRATION_EXECUTION_GUIDE.md` strictly

### Manual Migration Numbering
- Migrations are numbered sequentially (035–065)
- Gaps in numbering are not supported
- **Workaround:** Apply all migrations in order; do not skip

---

## Payments

### No Stripe Integration
- Payment gateway (Stripe, PAY.JP, etc.) is **not integrated** in v1.0.0
- All billing is manual: admin creates invoices, confirms payment by bank transfer
- **Workaround:** Use `docs/BILLING_OPERATION_MANUAL.md` for manual billing procedure

### No Card Payment
- Dealers cannot accept credit/debit card payments through the system at this stage
- **Planned:** Stripe integration in a future phase

### No Automatic Invoice Generation
- Invoices are created manually by admin
- **Planned:** Automated invoice generation on subscription renewal

---

## Language

### Japanese Only
- The entire user interface is in Japanese
- Email templates, LINE messages, and notifications are Japanese only
- **Planned:** Internationalization (i18n) in v2 Global Edition
- **Planned:** English, Chinese language support

### No Multi-Currency
- All pricing is in JPY (Japanese Yen)
- **Planned:** USD, EUR support in v2 Global Edition

---

## Messaging

### WhatsApp Not Supported
- WhatsApp integration is **reserved for Global Edition (v2)**
- Japanese market uses LINE for customer messaging
- **Planned:** WhatsApp Business API in v2

### LINE Dependency
- Customer messaging requires LINE account linkage
- Customers without LINE cannot receive push reminders
- **Workaround:** Manual contact for non-LINE customers

---

## Operations

### Staging First — No Direct Production Deployment
- All changes must go through staging verification before production
- Direct production deployment is prohibited
- See `docs/STAGING_EXIT_CRITERIA.md`

### No Automated Backup
- Supabase provides point-in-time recovery; no additional automated backup tool is integrated
- **Workaround:** Follow manual backup procedure in DR documentation

### Manual Renewal Reminders
- Renewal reminders are surfaced in the Admin Console but not automatically sent via email/LINE
- Admin must manually contact dealers with upcoming renewals
- **Planned:** Automated renewal reminder email/LINE push

---

## Features Planned for v2

See `ROADMAP_V2.md` for full v2 feature list.

| Feature | Notes |
|---------|-------|
| Stripe / card payment | v2 |
| Internationalization | v2 Global Edition |
| WhatsApp | v2 Global Edition |
| B2B supplier ordering | v2 |
| Inventory management | v2 |
| AI assistant | v2 |
| Multi-store / franchise | v2 |
| Enterprise SSO | v2 |

---

*GYEON Detailer Agent v1.0.0-RC1 | Office AZ*
