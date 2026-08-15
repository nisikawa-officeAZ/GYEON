# 4. Database Architecture

| Field | Value |
|-------|-------|
| **Document** | 04 — Database Architecture |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `03_Development_Constitution.md`, `05_Business_Rules.md`, `10_Security_and_RLS.md` |

> This document describes the **currently implemented** database architecture at a high level. It does **not** introduce future schema changes, invent tables, or redesign relationships. It does **not** duplicate business rules (`05_Business_Rules.md`) or API specifications (`08_API_Architecture.md`). Detailed table/column definitions may be added later if required; relationships here are described conceptually. Schema changes follow the migration policy in `03_Development_Constitution.md` §3.9.

---

## 4.1 Purpose

To document the implemented multi-tenant database: how tenant isolation is enforced, what domains exist, and the cross-cutting strategies (RLS, soft-delete, audit, storage). It is the authoritative reference for the database's current shape; it is descriptive of what exists, not prescriptive of new design.

## 4.2 Database Overview

- **Engine:** PostgreSQL (Supabase) with Row-Level Security enabled on feature tables.
- **Tenancy:** dealer-scoped multi-tenant; feature records carry a `dealer_id`.
- **Change process:** schema evolves through sequentially numbered, **manually reviewed** migrations applied via the controlled process (see §4.23 and `03_Development_Constitution.md`); core range `001`–`004`, feature ranges from `035` onward (e.g., `058` subscriptions, `067` vehicle-registration OCR, `068` OCR sessions, `073` detailer core fields, `088` dealer soft-delete).
- **Access path:** all access is mediated server-side; `dealer_id` is resolved via `getCurrentDealer()` (see `02_SYSTEM_ARCHITECTURE.md` §2.9).

## 4.3 Multi-Tenant Design

- Each dealer is represented by a `dealers` record with associated `dealer_settings`.
- Every feature record carries a `dealer_id` foreign key to its owning dealer.
- Users are associated with a dealer through `dealer_members` (the membership/isolation link).
- Reads and writes are dealer-scoped in application code and protected by RLS at the database layer (both required).

## 4.4 Dealer Isolation Strategy

Isolation chain (mandatory):

```
auth.users → dealer_members → dealer_id → all feature records
```

- `dealer_id` is **always** resolved server-side via `getCurrentDealer()`; it is **never** accepted from client input.
- Cross-dealer reference is impossible by construction; cross-entity writes re-validate same-dealer ownership.
- RLS policies enforce that a dealer can read/write only its own rows (see §4.20 and `10_Security_and_RLS.md`).

## 4.5 Entity Relationship Overview (high level)

```
dealers ──1:1── dealer_settings
dealers ──1:N── dealer_members ──N:1── auth.users
dealers ──1:N── customers ──1:N── vehicles
customers ──1:N── estimates ──1:N── estimate_items
estimates ──1:N── work_orders ──1:N── work_order_files
work_orders ──1:1/1:N── completion_reports
estimates/work_orders ──> invoices ──1:N── invoice_items ──1:N── payments
customers/vehicles ──> vehicle_registration_files ──N:1── vehicle_registration_ocr_sessions
dealers ──1:N── product_orders ──1:N── product_order_items
dealers ──1:N── reservations, maintenance_reminders, notifications, activity_logs
```

All relationships are scoped within a single dealer; the diagram shows ownership/cardinality conceptually, not column-level detail.

## 4.6 Core Tables

Tenancy, settings, staff, and platform-administration tables (implemented):

- `dealers`, `dealer_settings`, `dealer_members`, `dealer_staff`
- `admin_users`, `admin_audit_logs`
- `subscription_plans`, `dealer_subscriptions`, `dealer_billing`, `billing_invoices`
- `document_sequences` (per-dealer document numbering)

## 4.7 Customer Domain

- `customers` — dealer-scoped customer records (soft-deletable; business-customer fields added in migration `073`).
- Related customer-facing/engagement tables: `line_customers`, `line_message_logs`, `line_notification_queue`, `maintenance_reminders`, `notifications`, `activity_logs` (per-entity activity history).

## 4.8 Vehicle Domain

- `vehicles` — dealer-scoped vehicle records, each owned by a `customers` row (`customer_id`, NOT NULL); soft-deletable; detailer fields (displacement, fuel_type, registration_date) added in migration `073`.
- Linkage to the OCR domain via `vehicle_registration_files` / `vehicle_registration_ocr_sessions`.

## 4.9 Product Domain

- `gyeon_products` — product/service catalog.
- `product_orders`, `product_order_items`, `po_fulfillment_lines` — product ordering and fulfillment.
- Implemented stock/logistics tables (part of the current schema): `dealer_stock_levels`, `stock_movements`, `inventory_receipts`, `inventory_stocktaking_sessions`, `inventory_stocktaking_items`, `warehouse_adjustments`, `logistics_shipments`, `logistics_backorders`. These exist in the implemented database and are documented here for completeness; this document introduces no new inventory scope.

## 4.10 Estimate Domain

- `estimates`, `estimate_items` — estimates and their line items.
- `gyeon_service_estimates` — GYEON service estimate records.
- Document numbering via `document_sequences`; generated documents referenced in `document_files`.

## 4.11 Work Order Domain

- `work_orders`, `work_order_files` — work orders and their file attachments.
- `completion_reports` — completion reporting.
- `reservations` — scheduling/reservation records.

## 4.12 Invoice & Payment Domain

- `invoices`, `invoice_items`, `payments` — dealer-facing billing of customers (soft-deletable where applicable; payment records retained).
- Platform-level commercial billing: `dealer_billing`, `billing_invoices` (dealer subscription/commercial billing), with `subscription_plans` / `dealer_subscriptions`.

## 4.13 OCR Domain

- `vehicle_registration_files` — uploaded vehicle-registration images and their OCR result/status (migration `067`).
- `vehicle_registration_ocr_sessions` — the end-to-end OCR review session, linking to the resulting `customer_id` / `vehicle_id` and the reviewed result (migration `068`).
- Storage of the underlying images is in a private bucket (see §4.15); AI processing detail is in `02_SYSTEM_ARCHITECTURE.md` §2.11.

## 4.14 Authentication Domain

- **Identity:** Supabase Auth (`auth.users`) — authentication boundary; the application does not own password storage.
- **Membership/authorization:** `dealer_members` links an authenticated user to a dealer (active membership required); `dealer_staff` and `admin_users` carry role/administrative context.
- The database trusts only server-resolved identity; `dealer_id` is never taken from the client (see §4.4).

## 4.15 Storage Architecture

- Binary assets (generated PDFs, OCR images) live in a **private** object-storage bucket, not in the relational database.
- Database tables (e.g., `document_files`, `vehicle_registration_files`, `work_order_files`) store **references/metadata** (paths, status), not the binaries.
- Access is via short-lived signed URLs only; storage objects are associated with dealer-scoped records, preserving tenant isolation (see `02_SYSTEM_ARCHITECTURE.md` §2.10).

## 4.16 Indexing Strategy

- Primary keys on `id` (UUID) for all tables.
- Foreign-key columns (notably `dealer_id`, and ownership keys such as `customer_id`) are indexed to support dealer-scoped lookups and joins.
- Partial/auxiliary indexes are used where they materially help common queries (e.g., the partial index on active, non-deleted dealers introduced with migration `088`).
- Detailed index inventory may be added later if required; this section states the strategy, not an exhaustive list.

## 4.17 Naming Conventions

- `snake_case` table and column names.
- Surrogate primary key `id` (UUID); tenant key `dealer_id`; ownership keys named `<entity>_id`.
- Timestamps `created_at` / `updated_at`; soft-delete marker `deleted_at` (nullable `timestamptz`).
- Junction/line-item tables named `<parent>_items` (e.g., `estimate_items`, `invoice_items`, `product_order_items`).

## 4.18 Referential Integrity

- Feature records reference their owning `dealers` row via `dealer_id`.
- Ownership relationships use foreign keys (e.g., `vehicles.customer_id` → `customers.id`, NOT NULL; line items → their parent).
- Integrity is enforced both by foreign keys and by application-level same-dealer re-validation on cross-entity writes.

## 4.19 Soft Delete Strategy

- Soft-deletion via a nullable `deleted_at timestamptz` column is the preferred deletion mechanism for feature records (customers, vehicles, estimates, invoices, etc.).
- Reads exclude soft-deleted rows (`deleted_at IS NULL`) by default.
- Dealers themselves became soft-deletable via migration `088` (`dealers.deleted_at` + partial active index).
- Restoration is performed by clearing `deleted_at`; deletion never cascades to destroy related auth/customer/vehicle data automatically.

## 4.20 Audit Strategy

- `audit_logs` — immutable record of significant dealer/admin actions (actor, action, resource type/id, timestamp); no DELETE path.
- `admin_audit_logs` — platform-administration audit trail.
- `activity_logs` — per-entity activity history surfaced in the UI (e.g., customer/vehicle timelines).
- OCR review traceability is provided by `vehicle_registration_ocr_sessions` together with audit entries.

## 4.21 Performance Considerations

- Dealer scoping keeps per-tenant working sets bounded; indexed `dealer_id`/ownership keys support efficient lookups.
- Some list/search and duplicate-detection operations currently execute in the application over dealer-scoped, page-loaded data; server-side pagination/search is a documented future enhancement (see `02_SYSTEM_ARCHITECTURE.md` §2.17). These are acceptable at current volumes.

## 4.22 Backup & Recovery Considerations

- Managed PostgreSQL with point-in-time recovery underpins the recovery targets (RTO < 4h, RPO < 24h) defined in `02_SYSTEM_ARCHITECTURE.md` §2.16.
- Schema changes are staging-verified and backed up prior to production apply (migration policy, §4.23).
- Audit/billing-class data is permanently retained (no DELETE path).

## 4.23 Database Constraints

Binding constraints (changes require architect approval and the migration process):
1. `dealer_id`-based tenant isolation on all feature tables.
2. RLS mandatory on all feature tables (defense-in-depth beneath app scoping).
3. `dealer_id` resolved only via `getCurrentDealer()`; never from client input.
4. Migrations are sequential, additive, and **manually reviewed before execution** (not auto-applied); staging-first; no destructive change without explicit approval.
5. Soft-delete preferred; audit/billing records non-deletable.
6. Binaries in private storage only; tables hold references, not blobs.
7. Authentication boundary is Supabase Auth; membership via `dealer_members`.

## 4.24 Future Database Expansion

- Future schema needs identified during Phase 2 (documented, not yet implemented, requiring a future approved migration): e.g., persisting `model_code` for vehicles, and persisted (editable) customer/vehicle status/tags. These are listed as deferred items only; **no schema change is introduced by this document.**
- Any expansion follows the change-control and migration policy in `03_Development_Constitution.md`.

## 4.25 References

- `02_SYSTEM_ARCHITECTURE.md` — architecture, isolation mechanics, storage, OCR/AI, DR, scalability.
- `03_Development_Constitution.md` — migration policy, database change policy, dealer_id and RLS policy.
- `05_Business_Rules.md` — business logic (not duplicated here).
- `08_API_Architecture.md` — API/server-action contracts (not duplicated here).
- `10_Security_and_RLS.md` — detailed RLS policies and security model.
- `09_PHASE_STATUS.md` — phase/sprint status. `README.md` — SSOT + workflow. `INDEX.md` — document map.
