# Billing Operation Manual

**Phase:** PHASE64 — Commercial Billing Preparation  
**Scope:** Admin manual billing operations. No Stripe. No automatic charge.

---

## Overview

DealerOS billing is operated **manually** by the Super Admin. There is no payment gateway integration at this stage. All invoice issuance, payment confirmation, and subscription state changes are performed through the Admin Console Billing page.

---

## Plans

| Plan Code | Price (JPY/year) | Target |
|-----------|-----------------|--------|
| `trial`   | ¥0 | UAT participants, internal testing |
| `basic`   | Internal only | Reserved for future use |
| `pro`     | ¥12,000 | Standard commercial dealers |
| `pro_plus`| Custom quote | Enterprise / high-volume dealers |

See `docs/COMMERCIAL_POLICY.md` for full pricing and terms.

---

## Contract Lifecycle

```
[invited] → [trial] → [active] → [expired]
                    ↘ [cancelled]
                    ↘ [suspended] → [active]
```

| Status | Meaning |
|--------|---------|
| `trial` | UAT / evaluation period, no charge |
| `active` | Paid subscription, access granted |
| `expired` | Contract end date passed, access restricted |
| `cancelled` | Dealer cancelled; record retained |
| `suspended` | Access suspended by admin (non-payment, etc.) |

---

## Invoice Lifecycle

```
[draft] → [issued] → [paid]
        ↘ [cancelled]
[issued] → [overdue]  (manual flag by admin)
```

| Status | Action required |
|--------|----------------|
| `draft` | Not yet sent to dealer |
| `issued` | Sent; awaiting payment |
| `paid` | Payment confirmed by admin |
| `overdue` | Payment not received by due date |
| `cancelled` | Invoice voided |

---

## Common Operations

### 1. Onboard a New Paid Dealer

1. Go to **Admin Console → Billing**
2. Click **"請求レコード作成"** for the dealer
3. Set `plan_code = pro`, `contract_status = active`
4. Set `started_at`, `expires_at` (1 year from start), `renewal_date`
5. Create a draft invoice
6. Issue the invoice (set status → `issued`, fill `issued_at`, `due_at`)
7. Once payment confirmed: set status → `paid`, fill `paid_at`

### 2. Renew a Subscription

1. Go to **Billing** → "Upcoming Renewals" section
2. Locate the dealer (renewal within 30 days)
3. Click **"更新"** — this extends `expires_at` by 1 year and resets `renewal_date`
4. Create and issue a new invoice for the renewal period
5. Mark invoice as paid when payment received

### 3. Suspend a Dealer (Non-Payment)

1. Go to **Billing** → dealer row
2. Click **"停止"**
3. Set `contract_status = suspended`
4. The dealer's login still exists but access to detailer agent features will be restricted based on billing status check

### 4. Cancel a Subscription

1. Go to **Billing** → dealer row
2. Click **"解約"**
3. Set `contract_status = cancelled`, `cancelled_at = now()`
4. Retain all records (no DELETE)

---

## Invoice Numbering Convention

Format: `INV-YYYYMM-NNNN`

Examples:
- `INV-202601-0001` — first invoice of January 2026
- `INV-202602-0001` — first invoice of February 2026

The admin must assign invoice numbers manually. Ensure uniqueness.

---

## Renewal Reminders

The Admin Console shows:
- **30-day reminder** — dealers with `renewal_date` within 30 days
- **7-day reminder** — dealers with `renewal_date` within 7 days
- **Expired** — dealers where `expires_at` is in the past and status is still `active`

Check the Billing page weekly to catch upcoming renewals.

---

## Data Retention

- **No DELETE policies** on `dealer_billing` or `billing_invoices`
- Cancelled invoices remain as `cancelled` status
- Cancelled subscriptions remain as `cancelled` status
- All changes are logged to `admin_audit_logs`

---

## Security

- Only Super Admins can create/update billing records
- Dealers can view their own billing record and invoices (read-only)
- No dealer-facing payment forms exist at this stage

---

## Future Payment Integration

When Stripe or another payment provider is integrated (future phase):
- This manual workflow will be replaced/supplemented
- `dealer_billing` and `billing_invoices` tables will remain as the source of truth
- `invoice_number` field will map to external payment references
