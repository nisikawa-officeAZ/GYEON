# Roadmap v2 — GYEON Detailer Agent

**Current Version:** 1.0.0-RC1  
**Document Date:** 2026-06-21  
**Status:** Planning

---

## v1.0.0 — General Availability (Current Target)

Complete core detailing shop management for Japanese market:
- Customer, Vehicle, Estimate, Work Order, Invoice, Payment
- LINE CRM, Reservation, Maintenance Reminder
- Subscription Management, Manual Billing
- Admin Console with full operational tooling

---

## v1.1 — Stripe Payment Integration

| Feature | Description |
|---------|-------------|
| Stripe Connect | Accept card payments from customers |
| Automated Invoice | Auto-generate and send invoices on completion |
| Subscription Auto-Renewal | Automated dealer subscription billing |
| Payment Dashboard | Revenue analytics per dealer |

---

## v1.2 — Operational Enhancements

| Feature | Description |
|---------|-------------|
| Automated Renewal Reminder | Email + LINE push 30/7 days before renewal |
| Inventory Management | Product stock tracking, low-stock alerts |
| Inventory ETA | Expected arrival dates for ordered products |
| Backorder Management | Handle out-of-stock items with customer notification |
| Supplier Management | Supplier catalog, PO creation, delivery tracking |

---

## v2.0 — Global Edition

### Internationalization (i18n)

| Feature | Description |
|---------|-------------|
| English UI | Full English translation |
| Chinese UI | Simplified Chinese translation |
| Multi-Currency | USD, EUR, AUD, CNY support |
| Timezone Support | Per-dealer timezone configuration |
| Date/Number Formats | Locale-appropriate formatting |

### Global Messaging

| Feature | Description |
|---------|-------------|
| WhatsApp Business API | Customer messaging for non-LINE markets |
| SMS Notifications | Fallback for markets without WhatsApp/LINE |
| Email Campaigns | Promotional email to customer list |
| Multi-Channel | Unified inbox (LINE + WhatsApp + SMS + Email) |

### B2B Ordering & Supply Chain

| Feature | Description |
|---------|-------------|
| B2B Supplier Portal | Online ordering from GYEON distributors |
| Distributor Integration | API connection to distributor inventory |
| Order Tracking | Real-time order status |
| Bulk Pricing | Volume discount tiers per dealer |
| EC Integration | E-commerce platform sync (Shopify, WooCommerce) |

---

## v2.1 — AI & Intelligence

| Feature | Description |
|---------|-------------|
| AI Assistant | Natural language Q&A about customer/vehicle history |
| Smart Scheduling | AI-suggested appointment slots based on demand patterns |
| Maintenance Prediction | ML-based maintenance interval recommendations |
| Revenue Forecasting | AI-powered revenue projection |
| Customer Churn Prediction | Identify at-risk customers before they leave |

---

## v2.2 — Multi-Store / Enterprise

| Feature | Description |
|---------|-------------|
| Multi-Store | One account for multiple shop locations |
| Franchise Management | Franchisor dashboard for network oversight |
| Staff Hierarchy | Regional manager, store manager, technician roles |
| Consolidated Reporting | Cross-store analytics and revenue roll-up |
| Enterprise SSO | SAML / Azure AD integration |
| API Access | Public REST API for enterprise integrations |
| White-Label | Custom branding per dealer group |

---

## v3.0 — Platform

| Feature | Description |
|---------|-------------|
| Marketplace | GYEON product marketplace within the app |
| Customer Portal | Self-service portal for customers (booking, history, documents) |
| Mobile App | Native iOS/Android app (beyond PWA) |
| Offline Mode | Full offline support for on-site operations |
| IoT Integration | Equipment sensor data (polishing machines, detailing bays) |

---

## Prioritization Criteria

1. **Revenue impact** — features that directly enable billing or upsell
2. **Customer demand** — feedback from UAT dealers and sales pipeline
3. **Market expansion** — features required for non-Japanese markets
4. **Operational efficiency** — reduce manual admin work

---

*GYEON Detailer Agent | Office AZ | Powered by GYEON Japan*
