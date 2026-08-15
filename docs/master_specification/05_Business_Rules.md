# 5. Business Rules

| Field | Value |
|-------|-------|
| **Document** | 05 — Business Rules |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `02_SYSTEM_ARCHITECTURE.md`, `04_Database_Architecture.md`, `06_User_Roles_and_Permissions.md`, `10_Security_and_RLS.md` |

> This document defines **only the approved business rules**. It introduces no new functionality and redesigns no workflow. It does **not** duplicate API specifications (`08_API_Architecture.md`) or database definitions (`04_Database_Architecture.md`). Where a rule has an enforcement mechanism, the mechanism is specified in the architecture/security documents and only referenced here.

---

## 5.1 Purpose

To state the authoritative business rules that govern platform behavior: dealer classification and permissions, the core operational domains (customer, vehicle, estimate, work order, invoice, payment), AI/OCR handling, duplicate detection, and cross-cutting ownership and regional rules.

## 5.2 Business Rule Philosophy

1. Rules are **declarative and configurable** where they vary by market or dealer; they are not hardcoded into feature logic.
2. **Tenant isolation is absolute**: every rule operates within a single dealer's data.
3. **AI assists, humans decide**: automated extraction never finalizes a business record without explicit human confirmation.
4. **No silent change**: customer and vehicle data is never overwritten automatically; soft-deletion is preferred over destruction.
5. Rules document **approved behavior only**; new rules require architect approval under `03_Development_Constitution.md`.

## 5.3 Dealer Hierarchy

- A **dealer** is the tenant boundary; all business data belongs to exactly one dealer.
- Dealers are classified by a **dealer rank** (see §5.4). Rank is a classification attribute of the dealer; it is **not** itself a purchasing or installation grant.
- Platform administration (dealer approval/lifecycle) is distinct from per-dealer operation.

## 5.4 Dealer Rank Rules

**Canonical dealer ranks:**

- `shop`
- `detailer`
- `certified`

Rules:
- Dealer rank classifies the dealer's standing/capability tier.
- **Dealer rank never directly determines purchasing.** Purchasing eligibility is determined by the Product Master (see §5.5).
- Rank may inform installation permission semantics (see §5.6) but does not by itself grant purchase rights.

## 5.5 Product Purchase Permission Rules

**Canonical purchase-permission values (per product):**

- `all`
- `detailer`
- `certified`

Rules:
- **The Product Master (product catalog) determines purchasing eligibility.** Each product declares which audience may purchase it via its purchase-permission value.
- `all` = any dealer may purchase; `detailer` = dealers qualifying at the detailer tier or above; `certified` = certified dealers only.
- **Dealer rank does not directly determine purchasing** — eligibility is resolved by matching the dealer's qualification against the product's purchase-permission value, not by rank alone.

## 5.6 Installation Permission Rules

**Canonical installation-permission values:**

- `shop`
- `detailer`
- `certified`

Rules:
- Installation permission governs which dealers may perform/record installation of a given product/service.
- **Purchase permission and installation permission are independent.** A dealer may be permitted to purchase a product without being permitted to install it, and vice versa; the two axes are evaluated separately and never conflated.

## 5.7 Customer Rules

- Customers are dealer-scoped; a customer belongs to exactly one dealer.
- A customer requires at minimum a surname (`last_name`); other fields are optional.
- Business-customer attributes (e.g., business flag, trade-discount, credit terms) apply only when the customer is marked as a business customer.
- Customers are soft-deleted (`deleted_at`), never hard-deleted by normal operation; lists exclude soft-deleted customers.
- **Duplicate detection runs before customer registration** (see §5.14); customer data is never auto-overwritten.

## 5.8 Vehicle Rules

- Vehicles are dealer-scoped and each vehicle is owned by a customer **of the same dealer** (`customer_id` is required and re-validated on create/update).
- A vehicle may never be attached to another dealer's customer.
- Vehicles are soft-deleted (`deleted_at`); lists exclude soft-deleted vehicles.
- **Duplicate detection (VIN / license plate) runs before vehicle registration** (see §5.14); existing vehicles are updated only by explicit user action, never auto-overwritten.

## 5.9 Estimate Rules

- Estimates are dealer-scoped and associated with a customer (and, where applicable, a vehicle).
- The platform supports multiple service categories (e.g., Coating/GYEON, PPF, Window Film, Maintenance, Car Wash, Room Cleaning, Other Work); each category carries its own pricing model.
- Estimates flow downstream to work orders, invoices, and payments (see §5.10–§5.12).
- Detailed pricing/calculation semantics are part of the estimate specification and are not restated here.

## 5.10 Work Order Rules

- Work orders are dealer-scoped and derive from the approved estimate/job context.
- Completion is recorded via completion reports; work-order attachments are dealer-scoped.
- Work-order state transitions follow the approved operational workflow.

## 5.11 Invoice Rules

- Invoices are dealer-scoped and reference the customer/job being billed.
- Invoice documents are generated and stored as references in storage (private bucket; see `02_SYSTEM_ARCHITECTURE.md` §2.10).
- Commercial (platform→dealer) billing is distinct from dealer→customer invoicing.

### 5.11.1 Closing-Payment (Aggregate) Billing for Trade/Business Customers — FUTURE REQUIREMENT (corrected 2026-06-30; NOT yet implemented)

> **Status: Documented future billing/invoice workflow requirement. Not implemented.**
> This **corrects** the earlier assumption that a trade/business customer always uses
> closing-payment (aggregate) billing.

- The **trade/business flag** and **closing-payment terms** are **INDEPENDENT**. Marking a
  customer as trade/business does **not** imply closing-payment billing, and must **not**
  require closing/payment fields to be filled.
- **Closing-payment (aggregate) billing applies ONLY when the closing day and payment date
  are explicitly configured** for that customer.
  - If a closing day **and** a payment date are entered → use **aggregate closing-cycle
    billing** (invoices/delivery notes are aggregated and billed on the configured cycle).
  - If the closing/payment fields are **blank** → do **not** treat the customer as
    closing-payment billing; handle billing **normally, per individual invoice / delivery
    note**, regardless of the trade/business flag.
- The closing/payment fields are **optional** for trade/business customers; the system must
  not require them just because the business flag is set.
- Examples:
  - Trade customer with **closing day 20, payment day 15** → aggregate billing cycle.
  - Trade customer with **no closing/payment dates** → normal per-invoice / per-delivery-note billing.
- Implementation note (future): closing/payment configuration likely reuses the existing
  `dealer_closing_day` / `dealer_payment_day` scaffolding (see `05_DATABASE_REQUIREMENTS.md`
  §line 111) and the Monthly Billing roadmap item (`10_ROADMAP.md`). Any schema/columns
  required for **per-customer** closing/payment terms must be defined under a separately
  approved migration when this requirement is scheduled. Trade/business attributes otherwise
  follow §5.7 (business-customer attributes apply only when the business flag is set).

## 5.12 Payment Rules

- Payments are dealer-scoped and recorded against invoices.
- Payment records are retained (no deletion path) to preserve financial history.

## 5.13 OCR Rules

- Vehicle-registration OCR assists data entry; it **never saves data automatically**.
- **Explicit user confirmation is always required** before any customer or vehicle record is created or updated from OCR output.
- All AI-extracted fields are reviewable and editable before confirmation; low-confidence or missing important fields are surfaced for manual completion.
- OCR sessions and an audit trail preserve review history (see `04_Database_Architecture.md` §4.13, §4.20).

## 5.14 Duplicate Detection Rules

- **Customer and Vehicle duplicate detection always occurs before registration.**
- Customer duplicates are detected by surname and normalized phone (dealer-scoped); vehicle duplicates by normalized VIN/plate (dealer-scoped).
- On a detected duplicate, the user may **select an existing record** (use existing customer; update existing vehicle) instead of creating a new one — the Register / Update decision.
- Selecting "update existing" never overwrites automatically; it routes the user to perform the update explicitly.
- Detection results are advisory: the user may still proceed with new registration after review. The core detection logic is fixed and changes only upon discovery of a defect (per change control).

## 5.15 Maintenance Rules

- Maintenance reminders are dealer-scoped and associated with customers/vehicles.
- Reminders support the repeat-visit lifecycle; delivery may use the messaging integration (see §5.16).

## 5.16 LINE Integration Rules

- LINE integration is customer-facing and dealer-scoped.
- Customer linkage occurs through approved self-link flows; messaging respects customer association.
- LINE credentials are server-side only and never exposed to the client (see `02_SYSTEM_ARCHITECTURE.md` §2.12).

## 5.17 AI Assistance Rules

- AI assists; humans decide. AI output is never authoritative without human confirmation.
- **No AI/OCR result is persisted automatically** (see §5.13).
- **No AI-learning functionality is in scope**; AI is used for assistive extraction only.
- Future AI modules (marketing/reputation/growth) are deferred and require separate specification and approval.

## 5.18 Security Rules

- **`dealer_id` isolation is mandatory.** `dealer_id` is always resolved server-side via `getCurrentDealer()` and never accepted from client input.
- Row-Level Security is mandatory on all feature tables (see `10_Security_and_RLS.md`).
- Privileged actions are guarded; secrets are server-side only.

## 5.19 Data Ownership Rules

- Every business record is owned by exactly one dealer (`dealer_id`).
- Cross-dealer read or write is prohibited; cross-entity operations re-validate same-dealer ownership.
- Ownership cannot be transferred across dealers through a normal mutation.

## 5.20 Regional Rules

- **Japan-specific business rules must remain configurable** — they are not hardcoded into core logic. Examples include region-specific address handling, document formats, and locale-dependent presentation.
- The platform supports a GYEON edition and a brand-neutral Generic edition (see `01_PROJECT_OVERVIEW.md` §1.5); region/edition differences are configuration, not divergent business logic.

## 5.21 Future Rule Extensions

- New or modified business rules require architect approval and an updated specification before implementation.
- Deferred items (e.g., persisted/editable customer & vehicle status/tags) remain documented-but-not-active until an approved change introduces them.
- This document introduces no new functionality.

## 5.22 References

- `01_PROJECT_OVERVIEW.md` — product scope, editions, target users.
- `02_SYSTEM_ARCHITECTURE.md` — isolation mechanics, OCR/AI, LINE, storage, security enforcement.
- `04_Database_Architecture.md` — domains, ownership keys, soft-delete, audit (not duplicated here).
- `06_User_Roles_and_Permissions.md` — role/permission definitions.
- `10_Security_and_RLS.md` — detailed security model and RLS policies.
- `README.md` — Single Source of Truth + workflow. `INDEX.md` — document map.
