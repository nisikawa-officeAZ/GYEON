# Enterprise Reservation, Store Management & Logistics Architecture — Canonical Design

> **Status: CANONICAL DESIGN ADDITION — MANDATORY FUTURE REQUIREMENTS. Documented only
> (2026-06-30). NOT implemented. No migrations, no schema changes, no current-sprint scope
> change.** This document updates the Master Specification v2.0 and becomes part of the
> canonical design. It is a **design directive only**.
>
> Several sections are already documented in detail elsewhere and are cross-referenced here;
> this document is the **authoritative consolidated reference** for the enterprise
> reservation / store-management / logistics architecture.

**Global constraints (apply to ALL sections below, at implementation time):**
- Preserve Master Specification v2.0 and the approved architecture.
- `dealer_id` (and any company/store identifier) is **always** resolved server-side via
  `getCurrentDealer()` — **never** accepted from client input.
- Preserve RLS assumptions; keep all data **dealer/company-scoped**.
- Feature-branch workflow; no merge to main / no production deploy without approval.
- Each schema-touching item requires a **separately-approved migration** when scheduled.

---

## 1. Multi-Company / Multi-Store Architecture (Mandatory)

DealerOS must support **companies operating one or many stores**.

```
Company
├── Headquarters
├── Store A
├── Store B
├── Store C
└── …
```

- **Company-level** and **Store-level** configuration must be **separated**.
- **Company Settings** (examples): company name; billing information; subscription; global
  product catalog; global service catalog; corporate branding; global permissions;
  headquarters dashboard.
- **Store Settings** (examples): store name; address; telephone; business hours; closed days;
  holiday schedule; Google Business Profile configuration; staff; work bays; capacity
  settings; store-specific pricing; store-specific services.
- **Future permission roles:** Company Administrator · Headquarters Manager · Store Manager ·
  Staff (extends `06_USER_ROLES_AND_PERMISSIONS.md`).
- **Data-model impact (future, migration-gated):** a company/store hierarchy (company →
  stores, with HQ), company-vs-store settings split, and role scoping. Until then `dealer`
  is the tenant boundary; the company/store hierarchy is new structure requiring approved
  migrations. All scoping remains server-resolved; never client-supplied.

## 2. Business Calendar

Each **store** must have configurable: weekly business hours; regular closed days; holiday
schedule; temporary closure; lunch break; special opening hours; special closing hours.

- **Google Business Profile sync (future, optional):** Regular Hours and Special Hours.
- **The application database is ALWAYS the source of truth;** Google sync is **optional** and
  push-only-when-authorized.
- **Already documented:** `07_Feature_Specifications.md` §7.14.4 (Store Business Hours,
  Holidays & GBP Sync). This section is the canonical pointer.

## 3. Calendar Philosophy

DealerOS calendar is **NOT a simple reservation calendar** — it is a **workshop capacity
management system**.

- Views: **Month**, **Week**, **Day**.
- Clicking a day opens the **time-axis schedule** (implemented foundation: Calendar
  Time-Axis Sprints 1–2; see §7.14.1).
- The time-axis must display: **available periods**, **occupied periods**, **reservation
  duration**, **reservation status**.
- **Already documented:** §7.14.1 (day time-axis), §7.14.5 (flexible capacity). Canonical
  philosophy: capacity management, not binary availability.

## 4. Service Scheduling

Each service must support **scheduling configuration**.

- Examples (estimated time per service): ONE EVO — estimated **hours**; PURE EVO — estimated
  **hours**; PPF Full — estimated **days**; Maintenance — estimated **hours**; Wash —
  estimated **hours**.
- **Future configuration fields:** estimated hours; estimated days; buffer before; buffer
  after; work-bay blocking; technician blocking; parallel work allowed; default reservation
  color (and weekend availability, manual-confirmation flag).
- **Already documented:** §7.14.2 (service duration) and §7.14.3 (store-settings service
  scheduling configuration — the full field list). This section names the canonical service
  examples.

## 5. Capacity-Based Reservation (Core Philosophy)

Reservation availability is **NOT binary** — the workshop operates using **capacity**.

- Reservations must consider: **staff availability**, **work-bay availability**, **service
  duration**, **multi-day work**, **parallel work**, **capacity**.
- The system should **WARN before conflicts** instead of blocking by default.
- **Authorized users may override warnings with a reason** (recorded/audited).
- **Already documented:** §7.14.5 (Flexible Reservation Capacity & Manual Override) + the
  separately-delivered "Flexible Calendar Capacity System — Architecture Proposal" (design).

## 6. Reservation Configuration Wizard

Initial setup should be **simple**.

- The **Configuration Wizard** asks: business hours; closed day; number of technicians;
  number of work bays; simultaneous vehicle capacity.
- The system **generates recommended defaults** from those answers.
- **Advanced settings remain optional.**
- **Data-model impact (future, migration-gated):** stores the wizard answers into store
  settings (business hours, staff/bay counts, capacity); composes with §1/§2/§4/§5.

## 7. AI Recommendations (Future)

Future AI **may recommend**: estimated service duration; workshop utilization; capacity
optimization; suggested reservation slots; recommended configuration.

- **AI recommendations must NEVER automatically overwrite user settings** (advisory only;
  human confirmation required — consistent with the platform's no-auto-AI-write rule).
- Status: Future / Pro+ AI; requires its own approved specification. No AI activation now.

## 8. Flexible B2B Ordering

Ordering entity and shipping destination must be **independent**.

- **Supported order patterns:** (1) HQ → HQ; (2) HQ → Branch; (3) Branch → Same Branch;
  (4) Branch → Another Branch; (5) HQ/Branch → End Customer.
- The ordering model must distinguish: **purchasing entity**, **billing entity**, **ordering
  store**, **ordering user**, **shipping destination**, **recipient**.
- **Future destination types:** Headquarters · Own Store · Other Store · End Customer ·
  Manual Address. Future permissions determine who may use each destination.
- **Already documented:** §7.13.1 (Flexible B2B Ordering & Shipping Destinations) and
  `ENTERPRISE_DISTRIBUTION_PLATFORM_SPEC.md`.

## 9. Trade Customer Billing

**Trade customer** and **Closing Billing** are **independent**.

- A trade customer may use **per-invoice billing** OR **closing billing**.
- **Closing billing applies ONLY when configured.**
- **Closing cycle example:** Closing Day = **20**; Payment = **15th of the following month**;
  Billing Period = **21st → 20th**. The aggregate invoice becomes available **after closing**.
- The **invoice issue date** or **delivery-note issue date** becomes the **billing decision
  date** (i.e., which closing period a document falls into).
- **Already documented:** `05_Business_Rules.md` §5.11.1 (closing-payment terms independent of
  the trade/business flag). This section adds the closing-cycle example + billing-decision-date
  rule as canonical detail.

## 10. Architecture Principles

- DealerOS must **optimize for real detailing-shop operations**.
- **Ease of use has higher priority than configuration complexity.**
- The application should **guide users through recommendations** rather than requiring
  extensive manual setup (the wizard §6 + AI recommendations §7 serve this).
- All future implementations must preserve: Master Specification v2.0; the approved
  architecture; RLS; `dealer_id` from `getCurrentDealer()`; no client `dealer_id`; the
  feature-branch workflow.

---

### Cross-reference map
- §2 → `07_Feature_Specifications.md` §7.14.4
- §3 → §7.14.1, §7.14.5
- §4 → §7.14.2, §7.14.3
- §5 → §7.14.5 (+ Flexible Calendar Capacity System design proposal)
- §8 → §7.13.1, `ENTERPRISE_DISTRIBUTION_PLATFORM_SPEC.md`
- §9 → `05_Business_Rules.md` §5.11.1
- §1, §6, §7, §10 → canonical here (new); each schema/permission/AI item is a
  separately-approved future migration / specification.

**Implementation status:** Documentation only — no implementation, no migrations, no schema
changes, no current-sprint scope change.
