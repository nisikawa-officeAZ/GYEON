# Roadmap After v1 — GYEON Detailer Agent

**Base Version:** 1.0.0 — Official Release  
**Document Date:** 2026-06-21

> These are the features planned after the v1.0.0 Official Release. None of these are implemented in v1. Prioritization may change based on dealer feedback and market needs.

---

## v1.1 — Payments & Operations Upgrade

### Stripe Payment Integration
Accept card payments from customers within the app. Automated invoice payment links. Subscription auto-renewal billing without admin intervention.

### Automated Invoice Generation
Auto-generate and send invoices on work order completion. Email + LINE push delivery to customer.

### Automated Renewal Reminder
Send email and LINE push automatically at 30-day and 7-day renewal milestones. Remove manual admin step.

---

## v1.2 — Inventory & Supply Chain

### Inventory Management
Track product stock levels. Low-stock alerts. Stock adjustment log. Inventory valuation.

### Inventory ETA
Register expected arrival dates for ordered products. Show ETA to dealer in stock view.

### Backorder Management

When a product is out of stock and a customer order is placed:

```
Dealer places backorder
        ↓
GYEON Japan orders from HQ
        ↓
Register:
  incoming_quantity      — how many units are incoming
  expected_arrival_date  — when the shipment is expected to arrive
  target_delivery_date   — when the dealer can expect delivery
        ↓
Dealer sees delivery target in their order view
        ↓
Dealer proactively contacts customer with ETA
        ↓
Inquiry volume reduced — fewer "where is my order?" calls
```

**Backorder data model (planned):**
```sql
backorders (
  id, dealer_id, product_id, customer_id,
  ordered_quantity,
  incoming_quantity,       -- confirmed incoming from HQ
  expected_arrival_date,   -- at GYEON Japan warehouse
  target_delivery_date,    -- at dealer
  status,                  -- pending / incoming / ready / delivered / cancelled
  notes,
  created_at, updated_at
)
```

**Dealer view:**
- Backorder list with product, quantity, ETA, status
- Customer notification when target_delivery_date is set
- Status update when goods arrive

### Incoming Quantity Tracking
Register quantity of each SKU expected in each incoming shipment from GYEON Japan HQ. Allows dealers to see total incoming stock across all pending orders.

### Expected Arrival Date
Per-shipment expected arrival. Displayed in inventory view and backorder view. Updated when shipment status changes.

### Target Delivery Date
The date the dealer commits to delivering to the customer. Derived from expected_arrival_date + dealer processing time. Used for customer communication.

### Supplier Management
Maintain supplier records (GYEON Japan, local distributors). Link products to suppliers. Track supplier lead times and minimum order quantities. Purchase order creation and delivery tracking.

---

## v2.0 — Global Edition

### Internationalization (i18n)
Full English UI translation. Simplified Chinese translation. Locale-aware date, number, and currency formatting. Per-dealer language setting.

### Multi-Currency
USD (US Dollar) support for US/Australia markets. EUR (Euro) support for European markets. AUD (Australian Dollar). Exchange rate display (manual rate entry at v2, live rate API at v2.1).

### WhatsApp Business API
Customer messaging for markets where LINE is not used. Reservation reminders via WhatsApp. Maintenance reminders via WhatsApp. Unified inbox: LINE + WhatsApp + SMS.

### Global Edition Architecture
Separate international deployment on Vercel. Supabase project per region (JP, US, EU). Data residency compliance. GDPR-ready data handling.

---

## v2.1 — AI & Intelligence

### AI Assistant
Natural language questions about customer history: "When did Tanaka-san last visit?" "What did we do on the blue BMW last time?" Powered by Claude API. Context: customer, vehicle, work order, estimate history.

### Smart Scheduling
AI-suggested appointment slots based on historical demand patterns. Staff availability optimization. Peak/off-peak pricing signals.

### Maintenance Prediction
ML-based maintenance interval recommendations per vehicle make/model/usage pattern. Proactive outreach suggestions.

### Revenue Forecasting
Monthly and quarterly revenue projection based on reservation pipeline and subscription renewals. Admin dashboard widget.

### Customer Churn Prediction
Identify customers who haven't visited in longer than their historical interval. Auto-flag for re-engagement campaign.

---

## v2.2 — Enterprise & Multi-Store

### Multi-Store Management
One account for multiple shop locations. Staff assigned to specific locations. Consolidated cross-store reporting. Transfer stock between locations.

### Franchise Management
Franchisor dashboard for network-wide oversight. Per-store KPIs: revenue, customer count, repeat rate, average ticket. Compliance monitoring. Brand standard enforcement.

### Staff Hierarchy
Regional Manager role with multi-store visibility. Store Manager role. Technician role with task assignment. Detailed activity log per staff member.

### Enterprise SSO
SAML 2.0 / Azure AD / Google Workspace integration. Automatic account provisioning. Role mapping from IdP groups.

### REST API
Public REST API for enterprise integrations. Webhook subscriptions for key events. API key management in admin console.

### White-Label
Custom logo, color scheme, and domain per dealer group. Powered-by attribution configurable per contract.

---

## v3.0 — Platform

### EC Integration
Sync product catalog with Shopify, WooCommerce, or Rakuten. Online GYEON product sales linked to dealer accounts. Order fulfillment tracking.

### Customer Portal
Self-service portal for customers: view service history, download invoices, book next appointment, track maintenance reminders. Accessible via LINE LIFF or direct URL.

### Native Mobile App
iOS and Android native apps (beyond PWA). Push notifications via APNs/FCM. Offline mode for on-site operations without connectivity.

### IoT Integration
Connect polishing machine usage data (hours, RPM profiles) to work order records. Bay utilization tracking. Equipment maintenance alerts.

---

## Prioritization Criteria

Roadmap items will be prioritized based on:

1. **Dealer revenue impact** — features that directly increase dealer revenue or reduce churn
2. **Operational efficiency** — reduce manual admin burden
3. **Customer demand** — features requested by multiple dealers in UAT feedback
4. **Market expansion** — required for entry into non-Japanese markets
5. **Competitive differentiation** — features not available in competing products

---

*GYEON Detailer Agent | Office AZ | Powered by GYEON Japan*  
*Roadmap is subject to change. Not a commitment to deliver by any specific date.*
