# Commercial Policy

**Phase:** PHASE64 — Commercial Billing Preparation  
**Status:** Draft — for internal use only. Not customer-facing.

---

## Plans

### Trial

| Item | Detail |
|------|--------|
| Price | ¥0 |
| Duration | UAT period only (no fixed end date) |
| Access | Full feature access |
| Target | UAT test dealers, internal evaluation |
| Notes | No invoice issued. Upgrade to Pro upon commercial launch. |

### Pro

| Item | Detail |
|------|--------|
| Price | ¥12,000 / year (tax included) |
| Duration | 1 year (auto-renewal by admin manual operation) |
| Access | Full feature access |
| Target | Standard commercial detailer shops |
| Notes | Initial target plan for all commercial dealers at launch. |

### Pro Plus

| Item | Detail |
|------|--------|
| Price | Custom quote (contact sales) |
| Duration | Custom (minimum 1 year) |
| Access | Full feature access + priority support |
| Target | Enterprise accounts, dealer groups, high-volume users |
| Notes | Requires separate contract document. |

### Basic (Reserved)

| Item | Detail |
|------|--------|
| Price | TBD |
| Duration | TBD |
| Access | Limited feature set (TBD) |
| Target | Reserved for future feature-tier differentiation |
| Notes | Not currently offered. Do not set `plan_code = basic` for any active dealer. |

---

## Billing Cycle

- Annual billing only
- Invoice issued at contract start
- Renewal reminder sent 30 days and 7 days before expiry
- No monthly billing at this stage

---

## Currency

- All billing in JPY (Japanese Yen)
- No multi-currency support at this stage

---

## Trial-to-Commercial Conversion

1. UAT dealer completes trial
2. Admin contacts dealer to confirm commercial intent
3. Admin creates `dealer_billing` record with `plan_code = pro`, `contract_status = active`
4. Admin issues invoice
5. Dealer pays via bank transfer (account details provided separately)
6. Admin marks invoice as `paid`

---

## Cancellation Policy

- Dealer may cancel at any time
- No refund for remaining contract period
- Access continues until `expires_at` date
- Admin sets `contract_status = cancelled` and `cancelled_at = now()`

---

## Suspension Policy

- Admin may suspend a dealer for non-payment or policy violation
- Sets `contract_status = suspended`
- Dealer cannot use detailer agent features while suspended
- Suspension lifted when payment received or issue resolved
- Admin sets `contract_status = active` to reinstate

---

## Tax

- Prices listed are tax-included (税込)
- Consumption tax rate: 10%
- Invoices must display tax breakdown (future invoice template)

---

## Support

- Billing questions: handled by admin manually
- No automated billing support at this stage

---

## Revision History

| Date | Change |
|------|--------|
| 2026-06-21 | Initial draft (PHASE64) |
