# GYEON Business Hub — Dealer Owner Dashboard Specification

**Route**: `/dashboard`  
**Version**: 1.0.0 — Sprint 12A  
**Status**: Foundation implemented  
**Last Updated**: 2026-06-26

---

## 1. Purpose

The Dealer Owner Dashboard is the primary business intelligence UI for authenticated dealers. It provides a role-aware, privacy-safe view of operational and financial performance.

---

## 2. Route

| Property | Value |
|---|---|
| Route | `/dashboard` |
| Page file | `src/app/dashboard/page.tsx` |
| Component type | React Server Component (no `"use client"`) |
| Auth required | Yes — `getCurrentStaff()` resolves role server-side |
| Layout | `MainLayout` |
| Linked from | Home page mobile utility grid (`/`) |

---

## 3. Role Visibility Rules (Phase C / ANL-002)

Revenue data is gated server-side. The role check happens in `page.tsx` using `canViewFinance()` from `src/lib/staff/staff-types.ts`.

| Role | Revenue Section | Operational Data | Communication | AI Insights |
|---|---|---|---|---|
| `owner` | Visible | Visible | Visible | Visible |
| `manager` | Visible | Visible | Visible | Visible |
| `staff` | Hidden | Visible | Visible | Visible |
| `readonly` | Hidden | Visible | Visible | Visible |
| Unknown | Hidden (fail-closed) | Visible | Visible | Visible |

**Privacy guarantee**: `OwnerRevenueSection` is a React Server Component. Revenue data is only included in the server response when `canViewFinance(role)` returns `true`. Staff users receive a response where the revenue HTML is never generated — the data cannot be read via browser DevTools or React DevTools.

---

## 4. Dashboard Sections

### 4.1 Dashboard Header
- Role badge (color-coded: purple = owner, blue = manager, slate = staff)
- Today's date (Japanese locale)
- Quick-status chips: in-progress jobs, today's reservations, maintenance due, pending estimates
- Link back to home

### 4.2 Operations Overview
**Component**: `src/components/dashboard/OperationsOverview.tsx` (`"use client"`)  
**Data**: `getDashboardSummary()` → work_orders, estimates, customer_count, vehicle_count  
**Metrics referenced** (Analytics Center):
- `dealer_operations.active_jobs_in_shop` — work_orders.in_progress
- `work_orders.open_work_orders` — work_orders.scheduled
- `estimates.pending_estimates` — estimates.sent
- `estimates.estimate_count` — estimates.draft

### 4.3 Today's Schedule
**Component**: `src/components/dashboard/TodayReservationsCard.tsx` (existing)  
**Data**: `dash.today_work_orders`, `dash.reservation_stats.today`  
**Safe for all roles.**

### 4.4 Maintenance Opportunities
**Component**: `src/components/dashboard/MaintenanceDueCard.tsx` (existing)  
**Data**: `dash.maintenance_stats`, `dash.line_stats`  
**Safe for all roles.**

### 4.5 Communication Overview
**Component**: `src/components/dashboard/CommunicationOverview.tsx` (`"use client"`)  
**Data**: `dash.line_stats`, `dash.line_message_stats`, `dash.line_queue_stats`  
**Metrics referenced**:
- `communication.messages_sent` — line_message_stats.this_month_sent (real)
- `communication.channel_distribution` — LINE only (others: placeholder "Sprint 12+")
**Safe for all roles.**

### 4.6 Review Opportunities
**Component**: `src/components/dashboard/ReviewOpportunities.tsx` (`"use client"`)  
**Data**: No live data connected yet. Placeholder with clear "Sprint 12+" label.  
**Metrics**: `reviews.review_conversion_rate`, `reviews.review_requests_sent` — all show "—"  
**Safe for all roles.**

### 4.7 Owner Revenue Section (OWNER / MANAGER ONLY)
**Component**: `src/components/dashboard/OwnerRevenueSection.tsx` (**Server Component**)  
**Data**: `dash.sales` (SalesSummary), `dash.invoices` (InvoiceCounts)  
**Only rendered when**: `canViewFinance(role) === true` (owner or manager)

| Card | Data Source | Metric Reference |
|---|---|---|
| 今月の売上 | `sales.monthly_sales` | `sales.monthly_revenue` |
| 今月の入金 | `sales.monthly_received` | `accounting.monthly_cash_flow` |
| 未収金 | `sales.outstanding` | `accounting.accounts_receivable` |
| 今年の売上 | `sales.yearly_sales` | `sales.revenue_growth_rate` |

Additional: Overdue invoice count (red alert), issued invoice count (amber).

### 4.8 AI Insights Placeholder
**Component**: `src/components/dashboard/AIInsightsPlaceholder.tsx` (`"use client"`)  
**Data**: No data. Architecture placeholder only.  
**Insight types declared**: ai_summary, next_action_suggestion, anomaly_detection, growth_opportunity, risk_warning  
**Status**: Sprint 12B — requires AI Gateway integration.  
**Safe for all roles.**

### 4.9 Quick Navigation
3-column icon grid: Estimates, Work Orders, Customers, Vehicles, Reservations, Settings.  
**Safe for all roles.**

---

## 5. Revenue Privacy Design

```
src/app/dashboard/page.tsx (SERVER)
│
├── getCurrentStaff() → role
├── canViewFinance(role) → showRevenue (boolean)
│
├── [always] OperationsOverview ← work_orders, estimates, counts
├── [always] TodayReservationsCard ← today_work_orders
├── [always] MaintenanceDueCard ← maintenance_stats, line_stats
├── [always] CommunicationOverview ← line_stats, message_stats
├── [always] ReviewOpportunities ← (no live data)
├── [always] AIInsightsPlaceholder ← (no data)
│
└── [if showRevenue] OwnerRevenueSection (SERVER) ← sales, invoices
    → Revenue HTML only generated for owner/manager
    → Staff response contains NO revenue data in any form
```

`OwnerRevenueSection` has **no `"use client"`** directive. It is a React Server Component. Sales data never enters the React client bundle.

---

## 6. Analytics Registry Integration

The dashboard section labels and component metadata reference Analytics Center metric IDs (Sprint 11Z). No live query goes through the analytics module — data comes from existing `getDashboardSummary()`. The registry provides the canonical metric vocabulary.

| Dashboard Section | Metric Group (Analytics Registry) |
|---|---|
| Operations Overview | `dealer_operations`, `work_orders`, `estimates` |
| Maintenance Opportunities | `maintenance` |
| Communication Overview | `communication` |
| Review Opportunities | `reviews` (placeholder) |
| Owner Revenue Section | `sales`, `accounting` |
| AI Insights | `ai_usage` (placeholder) |

---

## 7. Component Inventory

| Component | Location | Type | Roles |
|---|---|---|---|
| Dashboard page | `src/app/dashboard/page.tsx` | Server | All |
| OperationsOverview | `src/components/dashboard/OperationsOverview.tsx` | Client | All |
| CommunicationOverview | `src/components/dashboard/CommunicationOverview.tsx` | Client | All |
| ReviewOpportunities | `src/components/dashboard/ReviewOpportunities.tsx` | Client | All |
| AIInsightsPlaceholder | `src/components/dashboard/AIInsightsPlaceholder.tsx` | Client | All |
| **OwnerRevenueSection** | `src/components/dashboard/OwnerRevenueSection.tsx` | **Server** | **Owner / Manager only** |
| TodayReservationsCard | `src/components/dashboard/TodayReservationsCard.tsx` | Client (existing) | All |
| MaintenanceDueCard | `src/components/dashboard/MaintenanceDueCard.tsx` | Client (existing) | All |

---

## 8. Home Page Integration

The dashboard link was added to the mobile home page utility grid (`src/app/page.tsx`):

```
ダッシュボード (📊) → /dashboard
商品注文 → /product-orders  
設定 → /settings
```

The desktop home (iframe of `/public/desktop-home.html`) was not modified.

---

## 9. Remaining Work Before Sprint 12B

| Item | Notes |
|---|---|
| Review data integration | Connect Google Business Profile review counts to ReviewOpportunities |
| AI Gateway wiring | Connect AIInsightsPlaceholder to live AI insights (Sprint 12B) |
| Desktop dashboard layout | Full-width responsive layout for `lg:` breakpoint |
| SNS / Marketing section | Connect sns_marketing metrics when available |
| Dashboard analytics logging | Track which sections users engage with most |
| Customer inactivity widget | Surface high-churn-risk customers on dashboard |
| Subscription tier badge | Show current plan on dashboard header |
