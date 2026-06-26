# Enterprise Distribution Platform Specification

**Module**: Office AZ Enterprise Distribution Platform (EDP)  
**Version**: 0.1.0 — Planning Document  
**Status**: Future — No implementation. Documentation only.  
**Sprint**: Roadmap planning  
**Last Updated**: 2026-06-26

> **IMPORTANT**: This document is a planning and roadmap artifact only.
> No code has been written. No database migrations exist. No implementation has begun.
> All content in this document is future scope. Nothing here conflicts with or modifies
> the current GYEON Detailer Agent architecture.

---

## 1. Platform Position

### 1.1 Two-product architecture

Office AZ Group operates two distinct digital platforms on the same underlying technology stack:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Office AZ Technology Platform                     │
│                  (Next.js 15 · Supabase · Vercel)                    │
│                                                                       │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐   │
│  │   GYEON Detailer Agent     │  │  Enterprise Distribution      │   │
│  │   (current product)        │  │  Platform (future)            │   │
│  │                            │  │                               │   │
│  │   Target: Dealers          │  │  Target: Office AZ Group      │   │
│  │   Market: B2C adjacent     │  │  Market: B2B wholesale        │   │
│  │   Scope: Per-shop ops      │  │  Scope: Import → retail       │   │
│  └────────────────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

The two products are **independent applications** sharing the same platform architecture. They do not share a database, codebase, or deployment unit. Platform-level investments (auth, AI gateway, SaaS billing, infrastructure) benefit both products.

### 1.2 Supply chain position

The Enterprise Distribution Platform manages the complete domestic Japan distribution chain for GYEON products:

```
GYEON Korea (manufacturer)
        ↓
Office AZ Group (official importer — Japan)
        ↓
Attraction Co., Ltd. (wholesale distribution arm)
        ↓  ┌─────────────────┐
           │ Wholesalers      │
           │ Retail stores    │
           │ Dealers          │
           └────────┬────────┘
                    ↓
             End customers
```

The GYEON Detailer Agent serves the "Dealers → Customers" layer. The Enterprise Distribution Platform serves the "Office AZ / Attraction → Wholesalers / Retailers / Dealers" layer.

### 1.3 Current state

Today, Attraction Co., Ltd. manages B2B orders primarily through:
- Telephone orders from wholesalers and retail stores
- Fax orders
- Email orders

Order processing, inventory tracking, invoicing, and payment collection are largely manual. The Enterprise Distribution Platform will replace these manual workflows with a fully digital B2B ordering system.

---

## 2. Business Background

### 2.1 Office AZ Group

Office AZ is the **official GYEON importer for Japan**. This means:
- All GYEON product inventory destined for the Japanese market flows through Office AZ
- Office AZ is responsible for import customs, domestic warehousing, and distribution
- Office AZ sets domestic wholesale and retail pricing

### 2.2 Attraction Co., Ltd.

Attraction Co., Ltd. is the primary wholesale distribution entity within Office AZ Group:
- Responsible for supplying authorized wholesalers and retailers
- Issues delivery notes, invoices, and monthly statements
- Maintains warehouse inventory and coordinates outbound logistics
- Manages B2B credit accounts and payment terms

### 2.3 Target expansion

The Enterprise Distribution Platform is designed for Office AZ Group companies broadly, with Attraction Co., Ltd. as the first deployment target.

Additional Office AZ Group companies may be onboarded to the same platform in future phases. Multi-company architecture must be considered from the start.

---

## 3. User Roles

The platform must support 8 distinct user roles:

| Role | Description | Primary access |
|---|---|---|
| **Super Admin** | Office AZ Group system administrator | Full platform access; multi-company; billing; user management |
| **Office AZ Admin** | Office AZ Group management | Cross-company reporting; pricing policy; master data |
| **Attraction Admin** | Attraction operational administrator | Full Attraction instance; pricing; customer management; statements |
| **Warehouse Staff** | Fulfillment and inventory team | Inventory management; pick/pack; stock adjustments; shipment creation |
| **Sales Staff** | Attraction sales team | Customer accounts; order entry; quotations; credit review |
| **Wholesaler** | Authorized B2B wholesale buyer | B2B portal: orders, invoices, statements, inventory availability |
| **Retail Store** | Authorized retail buyer | B2B portal: orders, invoices, delivery notes (with pricing), inventory |
| **Accounting** | Finance and accounts receivable | Invoicing; statements; payment records; overdue management |

### 3.1 Role isolation principles

- A `Wholesaler` or `Retail Store` user cannot see other companies' pricing, orders, or account data.
- Pricing visibility is company-specific: retail stores see retail prices; wholesalers see wholesale prices.
- `Warehouse Staff` does not see pricing or financial data.
- `Accounting` does not have access to inventory operations.

---

## 4. B2B Portal

The B2B portal is the buyer-facing interface for wholesalers and retail stores. It replaces telephone, fax, and email ordering.

### 4.1 Authentication

- Company-level login (not individual consumer login)
- Each buyer company has an account managed by Attraction Admin
- Individual buyer user accounts under the company account
- Secure invite-based onboarding for new buyer companies

### 4.2 Company-specific pricing

- Each buyer company has a pricing tier assigned by Attraction Admin
- Prices displayed throughout the portal always reflect the buyer's tier
- Pricing tiers are managed in the admin panel and are not visible to buyers
- Price list PDF export for buyer company records

### 4.3 Company-specific payment terms

Payment terms are configured per buyer company:

| Parameter | Description |
|---|---|
| Closing day | Day of month that closes the billing period (e.g., end of month, 20th) |
| Payment day | Day of following month that payment is due (e.g., 25th of next month) |
| Credit limit | Maximum outstanding balance; orders over limit are flagged for review |
| Payment conditions | Bank transfer, cheque, cash, or future card payment |

### 4.4 Portal capabilities

| Feature | Description |
|---|---|
| Product catalog | Full GYEON product catalog with company-specific pricing |
| Order placement | Cart-based ordering with real-time inventory availability |
| Order history | Full order history with status and shipment tracking |
| Backorder visibility | If stock is insufficient, backorder date estimation shown |
| Real-time inventory | Available-to-promise stock shown at order time |
| Shipment tracking | Tracking number + carrier + delivery status |
| Invoice download | PDF invoice per order or per billing period |
| Statement download | Monthly PDF statement of all transactions in the billing period |
| Credit account status | Outstanding balance vs. credit limit visibility |
| Reorder shortcuts | Repeat last order or saved order templates |

---

## 5. Inventory Management

### 5.1 Stock categories

| Category | Description |
|---|---|
| **On-hand stock** | Physical units confirmed in warehouse |
| **Reserved stock** | Units allocated to confirmed orders not yet shipped |
| **Available stock** | On-hand minus reserved (shown to buyers in portal) |
| **Incoming stock** | Units on purchase orders from GYEON HQ with expected arrival date |
| **Available-to-promise** | Available + incoming within buyer's acceptable lead time |
| **Backorder quantity** | Demand that cannot be fulfilled from available or incoming stock |

### 5.2 Inventory operations (warehouse staff)

- **Stock receive**: Record incoming shipment from GYEON HQ; validate vs. purchase order
- **Stock adjustment**: Manual correction with reason code (damage, count error, write-off)
- **Stock transfer**: Between warehouse locations (if multi-location)
- **Pick confirmation**: Mark units as picked for an order (removes from available)
- **Shipment close**: Attach tracking number; triggers customer notification

### 5.3 Warehouse synchronization

When the EDP goes live, all stock movements flow through the platform. If an external warehouse management system is used, a synchronization interface will be required (design at implementation time).

### 5.4 HQ synchronization

Purchase orders sent to GYEON Korea must be traceable in the system:
- PO number, line items, quantities, requested delivery date
- Acknowledgment from GYEON HQ (manual entry or future EDI)
- Expected arrival date updating incoming stock

---

## 6. Ordering Workflow

### 6.1 B2B order lifecycle

```
Buyer (Wholesaler / Retail Store)
  ↓  Places order via B2B portal (or Sales Staff enters on behalf of buyer)
Order Created
  ↓  System checks: credit limit, inventory availability, buyer account status
Order Confirmed
  ↓  Available stock → allocated (reserved); backorder items flagged
Warehouse: Pick Order Created
  ↓  Warehouse staff picks items; confirms pick quantity
Shipment Created
  ↓  Carrier assigned; tracking number entered; invoice generated
Buyer Notified
  ↓  Email notification with tracking number and invoice link
Delivered
  ↓  Delivery confirmed (carrier update or manual); record closed
```

### 6.2 Credit limit enforcement

Orders that would exceed a buyer's credit limit are not automatically blocked by default. The behavior is configurable per company:
- **Soft block**: Order placed but flagged for Sales Staff review before confirmation
- **Hard block**: Order rejected until credit limit headroom is restored

### 6.3 Backorder handling

When ordered items are out of stock:
- Out-of-stock items are recorded as backorders with the original order
- Buyer is notified of expected ship date based on incoming stock
- When stock arrives, backorder items are auto-allocated to outstanding backorders (FIFO)
- Buyer is notified when backorder items are ready for shipment

### 6.4 Order entry on behalf of buyer (Sales Staff)

Sales Staff can enter orders on behalf of buyer companies:
- Phone/email orders can be entered directly into the system
- Buyer receives confirmation email automatically
- Historical fax/email orders can be imported at go-live

---

## 7. Delivery Documents

Delivery document format is **configured per buyer company** by Attraction Admin.

### 7.1 Retail store: delivery note with prices

Retail stores receive a delivery note that includes:
- Line items with unit price and line total
- Subtotal, tax, and grand total
- Company name, order number, ship date, delivery address

### 7.2 Wholesaler: delivery note without prices

Wholesalers receive a delivery note that does **not** include prices:
- Line items with quantities only (no unit price, no totals)
- Company name, order number, ship date, delivery address
- Price exclusion is non-negotiable for some wholesalers who resell to sub-distributors

### 7.3 Document configuration

| Parameter | Options |
|---|---|
| Show prices | Yes / No (per company) |
| Show tax breakdown | Yes / No |
| Header / footer text | Custom per company |
| Document language | Japanese (v1); English (future) |
| Signature field | Yes / No |

All delivery documents are generated as PDF and are accessible for download from the buyer portal.

---

## 8. Monthly Billing

### 8.1 Billing cycle

Each buyer company has a configurable billing cycle:

| Parameter | Description | Example |
|---|---|---|
| Closing day | Last day of the billing period | 20th of the month |
| Payment due day | Day payment must arrive | 25th of following month |
| Statement generation | Automatic on closing day | After midnight on the 20th |

### 8.2 Automatic statement generation

On the closing day, the system automatically:
1. Collects all delivery records for the billing period
2. Generates an invoice for each delivery (if not already invoiced individually)
3. Generates a monthly statement listing all invoices and outstanding balance
4. Emails PDF invoice(s) and statement to the buyer company's registered billing email

### 8.3 Future LINE delivery

Monthly statement PDF delivery via LINE Business Connect is a planned future feature. Statement generation and billing logic is designed to be channel-agnostic.

### 8.4 Credit management

| Feature | Description |
|---|---|
| Credit limit tracking | Real-time outstanding balance vs. limit |
| Overdue flagging | Invoices overdue past payment day are flagged for Accounting |
| Overdue escalation | Manual escalation workflow (future: automated reminder) |
| Payment recording | Manual payment recording against invoices; future: bank reconciliation import |
| Credit hold | Accounting can place a company on credit hold (blocks new orders) |

---

## 9. Sales Dashboard

Attraction Admin and Sales Staff have access to a sales analytics dashboard.

### 9.1 Dashboard panels

| Panel | Description |
|---|---|
| Sales by customer | Revenue per buyer company for selected period |
| Sales by salesperson | Revenue attributed per Sales Staff member |
| Outstanding invoices | All unpaid invoices with due dates and overdue status |
| Gross profit | Revenue minus cost of goods sold (requires cost data in product master) |
| Monthly sales trend | Month-over-month comparison; year-over-year |
| Top customers | Top 10 buyer companies by revenue for the period |

### 9.2 Export

All dashboard data is exportable to CSV. PDF report generation is a future enhancement.

---

## 10. AI Features

All AI features in the Enterprise Distribution Platform follow the same architectural constraints as the GYEON Detailer Agent AI platform:
- No Office AZ inference costs — inference costs attributed to the EDP operating account
- Dealer-owned key model does not apply here — EDP AI features use Office AZ's own provider keys
- No real AI execution until provider adapters are implemented and AI gateway is ready

### 10.1 AI demand forecasting

**Capability**: Analyze historical order patterns to forecast demand per product per buyer per period.

- Input: 24 months of order history, seasonal patterns, promotions
- Output: Predicted demand per SKU for the next 30 / 60 / 90 days
- Use case: Attraction Admin pre-positions stock ahead of predicted demand spikes

### 10.2 AI inventory forecasting

**Capability**: Predict when specific SKUs will reach critical stock levels given current demand patterns.

- Input: Current on-hand stock, incoming stock, historical consumption rate
- Output: "SKU X will be depleted in N days at current run rate"
- Alert threshold: Configurable days-remaining trigger per SKU

### 10.3 AI purchasing recommendation

**Capability**: Generate a recommended purchase order to GYEON HQ based on demand forecast and current stock.

- Input: Demand forecast, current stock, lead time from GYEON HQ, safety stock targets
- Output: Draft purchase order quantities per SKU
- Workflow: Draft → Attraction Admin review → confirm → send to GYEON HQ

### 10.4 AI sales recommendation

**Capability**: Identify cross-sell and upsell opportunities for Sales Staff based on buyer purchase history.

- Input: Buyer order history, product categories, GYEON product relationships
- Output: "This buyer consistently orders Product A but has never ordered Product B — potential cross-sell"
- Delivery: Sales Staff dashboard panel, not pushed automatically to buyers

### 10.5 AI customer inactivity alerts

**Capability**: Alert Sales Staff when a buyer has been inactive beyond a configurable threshold.

- Input: Last order date per buyer, configurable inactivity threshold (default: 60 days)
- Output: "Attraction Wholesaler A has not ordered for 60 days — last order was [date]"
- Delivery: Dashboard notification, optional email digest to assigned Sales Staff

Example alerts:
> "Customer has not ordered for 60 days."
> "Inventory will be depleted in 12 days at current run rate."
> "Recommended HQ purchase quantity for SKU-XXXX: 48 units."

---

## 11. Technical Architecture

### 11.1 Shared platform

The Enterprise Distribution Platform shares the same underlying technology stack as the GYEON Detailer Agent:
- **Next.js 15** (App Router)
- **TypeScript 5**
- **Supabase** (PostgreSQL + Auth + Storage)
- **Vercel** (deployment)
- **TailwindCSS v4**

### 11.2 Separate deployment

Despite sharing the technology stack, the EDP is a **separate Next.js application** with:
- Separate Supabase project (separate database, auth, storage)
- Separate Vercel deployment
- Separate domain
- No shared database tables with GYEON Detailer Agent

### 11.3 Shared platform investments

Both products benefit from shared architectural work:
- AI Gateway pattern (provider-agnostic, key storage, adapter registry)
- SaaS subscription and billing architecture
- Auth patterns (Supabase Auth, RLS, server-side session management)
- PDF generation infrastructure
- LINE integration patterns (future)

### 11.4 Database design considerations (future)

When EDP database design begins:
- Multi-company isolation via `company_id` RLS policies
- Buyer company account separate from individual user accounts
- Product master shared across buyer companies (catalog)
- Pricing tables are company-specific (not in shared product master)
- Audit logs for all financial document generation and state changes

---

## 12. Implementation Prerequisites

The Enterprise Distribution Platform will not begin implementation until:

1. **GYEON Detailer Agent v1.0 is stable and deployed** — EDP does not compete for engineering capacity with the core product
2. **Office AZ Group formal project approval** — EDP is a separate product requiring separate budget and timeline approval
3. **Attraction Co., Ltd. operational requirements confirmed** — pricing model, payment terms structure, customer account structure, and document formats verified with Attraction stakeholders
4. **Technical architecture review** — separate Supabase project, domain, deployment pipeline, and CI/CD configured before any code is written
5. **Data migration plan** — existing customer accounts, pricing data, and order history from current manual system require a migration design

---

## 13. Future Expansion

### 13.1 Additional Office AZ Group companies

The platform architecture must support multiple Office AZ Group companies within the same EDP instance. Each company operates as a fully isolated tenant with:
- Separate inventory
- Separate buyer company accounts
- Separate pricing
- Separate billing cycles and statements
- Cross-company reporting for Super Admin and Office AZ Admin only

### 13.2 International distribution (future)

GYEON is a global brand. Future phases may require:
- Non-Japanese buyer companies (English language support)
- Multi-currency pricing
- International shipping workflows
- Country-specific tax and compliance rules

### 13.3 Supplier integration (future)

Future direct EDI or API integration with GYEON Korea for:
- Purchase order transmission
- Order acknowledgment
- Advance ship notice (ASN)
- Electronic invoice reconciliation

---

## 14. Open Questions (to be resolved before implementation begins)

| # | Question | Owner |
|---|---|---|
| EDP-OD-01 | What is the exact legal entity structure for the EDP tenant? Is it Office AZ or Attraction? | Office AZ Group |
| EDP-OD-02 | How many buyer companies exist today? What is the expected onboarding volume? | Attraction |
| EDP-OD-03 | What pricing tiers currently exist? What is the pricing tier structure? | Attraction |
| EDP-OD-04 | What are the exact billing cycles for current buyer companies? | Attraction |
| EDP-OD-05 | What is the format and content of the current delivery note and statement? | Attraction |
| EDP-OD-06 | Is there an existing product master (SKU list)? What format? | Attraction / Office AZ |
| EDP-OD-07 | What is the current warehouse management process? Is there an existing WMS? | Attraction |
| EDP-OD-08 | What historical order data should be migrated? In what format? | Attraction |
| EDP-OD-09 | What AI provider will be used for EDP AI features? Who owns the API key? | Office AZ |
| EDP-OD-10 | What is the expected go-live timeline? What phases are highest priority? | Office AZ Group |

---

*Office AZ Group | Enterprise Distribution Platform | Planning Document v0.1.0 | 2026-06-26*
