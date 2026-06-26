# 04 — DATABASE REQUIREMENTS

> Derived from the Canonical JSON (data contracts) **and** the verified implementation (`supabase/migrations/`).
> Canonical data contracts come first; the implemented schema must satisfy them.

---

## 1. Canonical data contracts (from JSON)

### 1.1 Estimate (`currentEstimate`, from `gyeon_flow.json`)
The estimate must persist all fields in `02_BUSINESS_WORKFLOW.md` §5 — customer block, customer_id link, car block, size, coating + layer/topcoats, options, and per-category objects (ppf, windowFilm, maintenance, carWash, roomCleaning, otherWork), categories[], notes, couponDiscount, appliedCoupons[], discountAmount, is_dealer, dealer_rate, dealer_discount, created_at.

### 1.2 Canonical entity stores (from `gyeon_flow.json.indexeddb_stores`)
`estimates`, `settings`, `customers`, `maintenances`, `schedules`, `past_histories`, `dealer_statements` — with the indexes listed in §6 of doc 02.

### 1.3 Canonical settings store (from `gyeon_settings_flow.json`)
A single key/value settings store holding the **39 keys** enumerated in `03_SETTINGS_WORKFLOW.md` §7.

---

## 2. Implemented schema (Supabase / PostgreSQL)

**34 migration files** in `supabase/migrations/` (legacy/core `001`–`004`, feature line `035`–`070`). Key tables:

| Domain | Tables (migration) |
|--------|--------------------|
| Tenancy | `dealers`, `dealer_members` (003), `dealer_settings` (070 canonical, 066) |
| Customers/Vehicles | `customers` (035), `vehicles` (036), `vehicle_registration_ocr` (067) |
| Estimates | `estimates`, `estimate_items` (037) |
| Work | `work_orders` (038), `work_order_files` (039), `completion_reports` (040) |
| Billing docs | `invoices` (041), `payments` (042), `document_sequences` (046), `document_files` (053) |
| LINE | `line_customers` (043), `line_message_logs` (044) |
| Scheduling | `maintenance_reminders` (045), `reservations` (052) |
| Products | `gyeon_products` (047), `product_orders` (048) |
| Staff | `staff_roles`/`staff_members` (050) |
| Platform | `notifications`/`activity_timeline` (054), `audit_logs` (055) |
| Commercial | subscription/license (058), dealer onboarding (059), staging (062), UAT (063), billing (064) |

All feature tables are RLS-enabled and **dealer-scoped** (`dealer_id` resolved server-side via `getCurrentDealer()`).

---

## 3. Canonical ↔ implemented mapping

| Canonical store/contract | Implemented equivalent | Status |
|--------------------------|------------------------|--------|
| `estimates` + `currentEstimate` | `estimates` + `estimate_items` (037) | ✅ present — **verify every per-category field & pricing field is represented** |
| `customers` | `customers` (035) | ✅ |
| `maintenances` | `maintenance_reminders` (045) | 🟡 verify field parity (customer_id, date, menus) |
| `schedules` | `reservations` (052) | 🟡 verify parity |
| `past_histories` | (completion_reports / activity_timeline?) | ⚠️ **operator decision** — no direct table |
| `dealer_statements` | (billing / invoices?) | ⚠️ **operator decision** — 業販 statement model unclear |
| settings key/value (39 keys) | `dealer_settings` (070 canonical) | 🟡 **verify all 39 keys covered** |

---

## 4. Persistence-architecture discrepancy (operator decision)

The Canonical JSON specifies **IndexedDB + Cloudflare KV + D1** with offline-first sync. The implementation uses **Supabase (PostgreSQL)** server-side with RLS.

- **Recommended resolution:** treat the JSON's *data shapes and semantics* (entities, fields, settings keys, pricing tables) as canonical, and treat **Supabase as the canonical persistence substrate going forward** (superseding the IndexedDB/KV/D1 text). Offline-first behavior becomes an explicit, separate roadmap decision.
- **Action required:** the operator must ratify this so SDD has a single, unambiguous persistence authority.

---

## 5. Database hygiene findings (from audit — informational)

- Numbering gaps `056, 057, 060, 061, 065, 068, 069` = code/doc-only phases (no schema). Document explicitly.
- Duplicate `001_create_core_tables.sql` + `001_create_core_tables_PASTE_ONLY.sql` — cleanup candidate.
- `CHANGELOG.md` migration filenames do **not** match real files — unreliable; this doc supersedes them.
- "Applied" status is manual (no automated drift check) and was **not** verified live (read-only audit, no service-role key).

---

## 6. Requirements summary

1. The implemented `estimates`/`estimate_items` MUST hold every field in doc 02 §5, including per-category subtotals and all discount/dealer fields.
2. `dealer_settings` MUST store and serve all 39 canonical settings keys (doc 03 §7).
3. Resolve `past_histories` and `dealer_statements` (業販 statements) to concrete tables or formally defer them.
4. Ratify Supabase as canonical persistence (§4).
