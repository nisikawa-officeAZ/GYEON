# 7. Feature Specifications

| Field | Value |
|-------|-------|
| **Document** | 07 — Feature Specifications |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `02_SYSTEM_ARCHITECTURE.md`, `04_Database_Architecture.md`, `05_Business_Rules.md`, `06_User_Roles_and_Permissions.md`, `10_Security_and_RLS.md`, `09_PHASE_STATUS.md` |

> This document specifies **only approved and implemented features plus approved future phases**. It invents no functionality, redesigns no architecture, and does not duplicate database definitions (`04_Database_Architecture.md`) or API definitions (`08_API_Architecture.md`). Each feature is tagged **Implemented**, **Planned**, or **Future**. Authoritative live status is in `09_PHASE_STATUS.md`.

**Status legend:** **Implemented** = present in the current build · **Planned** = approved, partially built or scheduled · **Future** = approved direction, not yet built (requires a future approved specification).

---

## 7.1 Purpose

To enumerate the platform's features, their scope, current status, components, dependencies, security considerations, and approved future expansion — as a single authoritative feature index.

## 7.2 Functional Architecture

- Features are delivered as dealer-scoped modules over the architecture in `02_SYSTEM_ARCHITECTURE.md`: a Next.js App-Router frontend (PWA), Server Actions/Components, PostgreSQL with RLS, private storage, and external integrations (OpenAI, LINE).
- Every feature obeys the cross-cutting rules: `dealer_id` via `getCurrentDealer()`, mandatory RLS, server-side authorization (`06_User_Roles_and_Permissions.md`), soft-delete, and human confirmation for AI/OCR writes (`05_Business_Rules.md`).
- The platform ships in a GYEON edition and a brand-neutral Generic edition (`01_PROJECT_OVERVIEW.md` §1.5).

---

## 7.3 Authentication Module
- **Purpose:** Authenticate users and establish dealer membership.
- **Scope:** Email/password login, session management, route protection.
- **Current Status:** Implemented.
- **Major Components:** Supabase Auth; middleware (auth + subscription checks); dealer resolution via `getCurrentDealer()`.
- **Dependencies:** Supabase Auth; `dealer_members`.
- **Security Considerations:** Per-device sessions; server-side enforcement; no client-supplied identity/`dealer_id` (`02` §2.7, `06` §6.15).
- **Future Expansion:** Additional auth factors — Future (requires approval).

## 7.4 Dashboard Module
- **Purpose:** Provide a dealer-scoped operational summary on entry.
- **Scope:** Summary metrics/overview for the current dealer.
- **Current Status:** Implemented.
- **Major Components:** Dashboard summary data layer; home presentation (PC + mobile).
- **Dependencies:** Customer/vehicle/estimate/operational data.
- **Security Considerations:** Dealer-scoped reads; excludes soft-deleted records.
- **Future Expansion:** Deeper analytics — see §7.27.

## 7.5 Customer Management
- **Purpose:** Manage dealer customers and their relationships.
- **Scope:** List, search, filters, detail, profile editing, notes, derived status/tags, activity timeline.
- **Current Status:** Implemented (Phase 2 Sprint 2).
- **Major Components:** Customer list/detail; controlled search + filters; profile form; notes; derived status/tags (read-only foundation); activity timeline.
- **Dependencies:** `customers`; activity log; `06` roles.
- **Security Considerations:** Dealer-scoped; soft-delete excluded; updates scoped by id + dealer_id.
- **Future Expansion:** Persisted/editable status & tags — Future (needs migration).

## 7.6 Vehicle Management
- **Purpose:** Manage vehicles and their customer linkage.
- **Scope:** List, search, filters, detail, profile editing, derived 車検 status/tags, service-history foundation, customer↔vehicle verification.
- **Current Status:** Implemented (Phase 2 Sprint 3).
- **Major Components:** Vehicle list/detail; search + filters; profile form; derived status/tags; service-history view; owner resolution.
- **Dependencies:** `vehicles` (owned by same-dealer customer); activity log.
- **Security Considerations:** Dealer-scoped; `customer_id` re-validated; soft-delete excluded.
- **Future Expansion:** Persisted status/tags and `model_code` persistence — Future (needs migration).

## 7.7 OCR Registration
- **Purpose:** Assist customer+vehicle registration from a vehicle-registration certificate.
- **Scope:** Image capture/upload, server-side AI analysis, orchestration to create customer + linked vehicle.
- **Current Status:** Implemented (Phase 2 Sprint 1/4); requires `OPENAI_API_KEY` + storage bucket to be active.
- **Major Components:** Upload (mobile camera-first / desktop file), OCR engine (gpt-4o-mini), OCR→form mappers, register-from-ocr orchestration.
- **Dependencies:** OpenAI; private storage; `vehicle_registration_files`; customer/vehicle create actions.
- **Security Considerations:** Server-only key; dealer-scoped; **no auto-save — explicit confirmation required**.
- **Future Expansion:** Additional document types — Future.

## 7.8 OCR Review
- **Purpose:** Let the user verify and correct AI-extracted data before saving.
- **Scope:** Grouped customer/vehicle fields, editing, confidence + missing-field handling.
- **Current Status:** Implemented (Phase 2 Sprint 4).
- **Major Components:** Review component; field-analysis foundation (confidence/missing).
- **Dependencies:** OCR Registration (§7.7).
- **Security Considerations:** Mandatory human-in-the-loop; nothing persisted without confirmation.
- **Future Expansion:** Raw-vs-corrected field diff — Future.

## 7.9 OCR History
- **Purpose:** Review prior OCR sessions and audit trail.
- **Scope:** Session list (status, summary, linked records), audit trail.
- **Current Status:** Implemented (Phase 2 Sprint 5).
- **Major Components:** `/ocr-sessions` page; session list; audit trail; status badges.
- **Dependencies:** `vehicle_registration_ocr_sessions`; `audit_logs`.
- **Security Considerations:** Dealer-scoped reads; broken/cross-dealer links flagged.
- **Future Expansion:** Per-session correction diff; resume/abandon from list — Future.

## 7.10 Duplicate Detection
- **Purpose:** Prevent duplicate customers/vehicles at registration.
- **Scope:** Customer (surname + normalized phone) and vehicle (VIN/plate) detection; select-existing flow; register/update decision.
- **Current Status:** Implemented (Phase 2 Sprint 1/5).
- **Major Components:** Dealer-scoped detection helpers; confirm-step review + selection.
- **Dependencies:** Customer/Vehicle data; OCR/registration flow.
- **Security Considerations:** Dealer-scoped; advisory and non-destructive; never auto-overwrites.
- **Future Expansion:** Inline merge/resolution; server-side scaling — Future.

## 7.11 Estimate Management
- **Purpose:** Create and manage estimates across service categories.
- **Scope:** Estimate creation, items, category routing; GYEON service estimates.
- **Current Status:** Implemented (core); category-specific steps (PPF, window film, maintenance, car wash, room cleaning, other) — **Planned** (placeholder).
- **Major Components:** Estimate wizard/forms; `estimates`, `estimate_items`, `gyeon_service_estimates`; document numbering.
- **Dependencies:** Customers/vehicles; products; PDF generation.
- **Security Considerations:** Dealer-scoped; pricing logic server-side.
- **Future Expansion:** Complete category-specific pricing steps — Planned.

## 7.12 Product Management
- **Purpose:** Maintain the product/service catalog.
- **Scope:** Catalog records and purchase/installation permission attributes.
- **Current Status:** Implemented.
- **Major Components:** Product catalog (`gyeon_products`); catalog UI.
- **Dependencies:** Product ordering; estimates; business rules `05` §5.5–§5.6.
- **Security Considerations:** Purchase eligibility resolved by Product Master, not rank (`05` §5.5).
- **Future Expansion:** Extended catalog metadata — Future.

## 7.13 Product Ordering
- **Purpose:** Order products and track fulfillment.
- **Scope:** Orders, order items, fulfillment lines.
- **Current Status:** Implemented.
- **Major Components:** `product_orders`, `product_order_items`, `po_fulfillment_lines`; ordering UI.
- **Dependencies:** Product Management; permissions.
- **Security Considerations:** Dealer-scoped; permission-gated per business rules.
- **Future Expansion:** Deeper logistics — see §7.30 (Future).

### 7.13.1 Flexible B2B Ordering & Shipping Destinations — MANDATORY FUTURE REQUIREMENT (added 2026-06-30; NOT yet implemented)

> **Status: Mandatory future requirement for B2B product ordering. Documented only — not
> implemented. Does NOT change any current sprint scope. Relates to the Enterprise
> Distribution Platform direction (`ENTERPRISE_DISTRIBUTION_PLATFORM_SPEC.md`).**

The ordering system must distinguish these **independent** parties/attributes on an order
(they must NOT be assumed equal):
- **Purchasing entity** (who places the order).
- **Billing entity** (who is invoiced / pays).
- **Ordering store** (the store originating the order).
- **Ordering user** (the staff member placing the order).
- **Shipping destination type** (see below).
- **Recipient / store / customer address** (where goods ship).

**Required order patterns (must all be supportable):**
1. Headquarters orders → ships to **headquarters**.
2. Headquarters orders → ships to a **branch store**.
3. Branch store orders → ships to the **same branch store**.
4. Branch store orders → ships to **another store**.
5. Headquarters or branch store orders → ships **directly to an end customer**.

**Shipping destination types:**
- Headquarters
- Own store
- Other company store
- End-customer direct shipment
- Manually entered address (only if permitted)

**Required behavior:**
- Do **NOT** assume the ordering location and the delivery destination are the same.
- Do **NOT** assume the payer/billing entity and the shipping recipient are the same.
- Support **company-level and store-level ordering permissions** (who may order, who may
  ship where, who may bill whom).
- Support **direct-shipment rules and restrictions** (e.g., which roles/stores may ship to an
  end customer; which destinations are allowed).
- Keep all data **dealer/company-scoped**; `dealer_id` (and any company/store identifier) is
  always resolved **server-side from `getCurrentDealer()`** and **never** accepted from
  client input. Preserve RLS assumptions.

**Implementation status:** Documentation only — no implementation, no migrations, no schema
changes, no current-sprint scope change. Separating purchasing/billing/ordering-store/
shipping-destination is **new order data** (likely new fields/relations on `product_orders`
and a destination model: headquarters/store/customer/manual address) and **company/store
hierarchy + ordering permissions**, all requiring **separately-approved migration / schema**
and permission-model work when scheduled. Composes with the Enterprise Distribution Platform
spec and §7.30 (Future logistics).

## 7.14 Calendar & Reservations
- **Purpose:** Schedule jobs and manage reservations.
- **Scope:** Calendar views; reservation records.
- **Current Status:** Implemented.
- **Major Components:** `/calendar`, `/reservations`; `reservations`.
- **Dependencies:** Customers/vehicles; notifications.
- **Security Considerations:** Dealer-scoped.
- **Future Expansion:** External calendar sync — Future.

### 7.14.1 Calendar Day Time-Axis Management — MANDATORY FUTURE REQUIREMENT (added 2026-06-30; NOT yet implemented)

> **Status: Mandatory future requirement for the calendar/reservation workflow. Documented
> only — not implemented. This does NOT change the current Phase 5 Sprint 3 (notification
> observability) scope.**

- **Date click opens a day view:** clicking a date on the calendar must open or display that
  day's **time-axis schedule** (a single-day, time-of-day view).
- **Time slots:** the day view must show **time slots** along a time axis.
- **Reservation positioning:** reservations must be **positioned by their start time and end
  time** (reservations carry `reservation_date`, `start_time`, `end_time`).
- **Availability visibility:** users must be able to see **available vs occupied** time
  ranges at a glance.
- **Future capability — create from slot:** the implementation should support **creating a
  reservation from a selected time slot** (pre-filling date + start/end from the chosen slot).
- **Future capability — overlap detection:** the implementation should support **detecting
  overlapping reservations** (same dealer; optionally same assigned staff/resource).
- **Workflow ownership:** this requirement belongs to the **calendar/reservation workflow**
  (`/calendar`, `/reservations`, `reservations`), is **dealer-scoped** (`dealer_id` always
  from `getCurrentDealer()`, never from client), and must preserve RLS assumptions.
- **Implementation note (future):** the existing `reservations` columns
  (`reservation_date`, `start_time`, `end_time`, `assigned_staff_id`, `status`) already
  support time-axis positioning and overlap checks; any additional fields would require a
  separately-approved migration when this requirement is scheduled.

### 7.14.2 Service Duration Settings for Calendar Time-Axis — MANDATORY FUTURE REQUIREMENT (added 2026-06-30; NOT yet implemented)

> **Status: Mandatory future requirement for **store settings** + the calendar/reservation
> workflow. Documented only — not implemented. Depends on §7.14.1 (time-axis scheduling).
> Does NOT change the current Phase 5 Sprint 3 (notification observability) scope.**

- **Per-service estimated duration:** when the calendar supports time-axis scheduling,
  **store settings** must allow each **service / work item** to define a **configurable
  estimated required duration**.
- **Units:** duration may be entered as **hours**, and must also support **days** for
  **multi-day work** (e.g., multi-day PPF/coating jobs).
- **Reservation time blocks from durations:** a reservation's time block should be
  **calculated from the selected service's duration** (start time + duration → end time /
  multi-day span), rather than relying solely on manual end-time entry.
- **Multi-service totals:** a reservation spanning **multiple services** must compute the
  **total required time** from the sum (or appropriate composition) of the selected service
  durations.
- **Future use — occupied ranges:** the computed durations feed the §7.14.1 day view to
  **display occupied time ranges** accurately.
- **Future use — conflict / overbooking detection:** the computed time blocks must enable
  **schedule-conflict and overbooking detection** (overlapping reservations for the same
  dealer; optionally same assigned staff/resource per §7.14.1).
- **Workflow ownership:** this requirement belongs to **store settings** AND the
  **calendar/reservation workflow**. Dealer-scoped (`dealer_id` always from
  `getCurrentDealer()`, never from client); RLS preserved.
- **Implementation note (future):** per-service duration configuration is **new settings
  data** (likely a per-dealer service catalog / settings field) and would require a
  **separately-approved migration / schema** when scheduled; it then composes with the
  existing `reservations` time fields (§7.14.1) to derive time blocks.

### 7.14.3 Store Settings — Service Scheduling Configuration — MANDATORY FUTURE REQUIREMENT (added 2026-06-30; NOT yet implemented)

> **Status: Mandatory future requirement for **Store Settings**. Documented only — not
> implemented. Superset of §7.14.2; depends on §7.14.1 (time-axis scheduling). Does NOT
> change any current sprint scope (incl. Phase 5 Sprint 3 notification observability).**

Each service / work item must support **scheduling configuration** in Store Settings.

**Required configuration fields (per service/work item):**
- Estimated duration (**hours**).
- Estimated duration (**days**) for multi-day work.
- **Default working hours per day**.
- **Buffer time before** service (optional).
- **Buffer time after** service (optional).
- Whether the service **blocks the work bay**.
- Whether the service **blocks the assigned technician**.
- **Default reservation color**.
- Whether the service is **available on weekends**.
- Whether the service **requires manual confirmation** before reservation.

**Scheduling behavior:**
- Reservation length must be **calculated automatically** from the configured duration
  (hours/days), incorporating before/after buffer time and default working hours per day.
- **Multiple selected services** must produce **one combined reservation duration**.
- **Multi-day services** must **occupy all applicable calendar days** on the time-axis view (§7.14.1).
- Future **conflict detection** must use these **calculated occupied periods** (overlap /
  overbooking; bay and technician blocking inform what counts as a conflict).
- Future **staff/resource allocation** (technician, work bay) must use these scheduling settings.

**Constraints:**
- **Store-specific configuration only**, **dealer-scoped**: `dealer_id` always from
  `getCurrentDealer()`, **never** from client input; **RLS assumptions preserved**.

**Implementation status:** Documentation only — no implementation, no migrations, no schema
changes, no current-sprint scope change. The configuration fields are **new per-dealer
settings data** and would require a **separately-approved migration / schema** when this
requirement is scheduled; they then compose with §7.14.1 (time-axis) and §7.14.2 (duration)
to derive reservation time blocks, occupied ranges, and conflict/overbooking detection.

### 7.14.4 Store Business Hours, Holidays & Google Business Profile Sync — MANDATORY FUTURE REQUIREMENT (added 2026-06-30; NOT yet implemented)

> **Status: Mandatory future requirement for **Store Settings** AND the
> **calendar/reservation workflow**. Documented only — not implemented. Composes with
> §7.14.1–§7.14.3. Does NOT change any current sprint scope (incl. Phase 5 Sprint 3
> notification observability).**

**Store Settings — business calendar configuration (required):**
- **Regular business hours by weekday** — per-weekday **open time** and **close time**.
- **Regular closed days** (recurring weekly closures).
- **Temporary closed days** (one-off dates).
- **Holiday business hours** and **special open days** / **special close days**.
- **Lunch break / unavailable time blocks** within a day (if needed).
- **Reservation availability based on business hours**; **block reservations outside
  business hours** and **on closed days**.
- **Calendar display must reflect open/closed status.**

**Calendar behavior:**
- The **date view** and **time-axis view** (§7.14.1) must use the store's **business hours**.
- **Time slots outside business hours** must be **disabled or visually blocked**.
- Reservations must **not be created outside available hours** unless **manually overridden
  by an authorized user** (override is permission-gated).
- **Multi-day work must skip closed days** unless manually overridden.
- **Conflict detection** must consider: **business hours, closed days, service duration
  (§7.14.2/§7.14.3), work-bay blocking, and technician blocking**.

**Google Business Profile (GBP) — future integration:**
- Future implementation **may** sync **regular business hours** → GBP `regularHours`.
- Future implementation **may** sync **holiday/special hours** → GBP `specialHours`.
- GBP integration requires **OAuth and approved API access**.
- Google sync must be **optional per dealer/store**.
- **Manual review/confirmation** should be required **before pushing** changes to Google.
- The app must keep an **internal source of truth first**, then **push to Google only when
  authorized** (internal config is authoritative; Google is a downstream, opt-in mirror).

**Constraints:**
- **Dealer-scoped**: `dealer_id` always from `getCurrentDealer()`, **never** from client
  input; **RLS assumptions preserved**.
- **Documentation only** — no implementation, no migrations, no schema changes, no
  current-sprint scope change. Business-hours / holiday / GBP-link configuration is **new
  per-dealer settings data** requiring a **separately-approved migration / schema** (and,
  for GBP, OAuth + approved API access) when scheduled.

### 7.14.5 Flexible Reservation Capacity & Manual Override — MANDATORY FUTURE REQUIREMENT (added 2026-06-30; NOT yet implemented)

> **Status: Mandatory future requirement for the calendar/reservation workflow. Documented
> only — not implemented. Refines the conflict-detection model referenced in §7.14.1 and
> §7.14.3–§7.14.4. Does NOT change the current Calendar Time-Axis Sprint 2 scope.**

**Business reality (capacity is flexible, not binary):**
- Calendar availability must **NOT** be treated as a simple fully-available / fully-blocked rule.
- Example: a coating job reserved **July 1–5** (plus optional buffer days) does **not** block
  the whole shop — **other jobs may still be accepted** during that period.
- The shop may handle **2–3 vehicles in parallel** depending on workload, space, and staff;
  conflict detection must support this flexibility.

**Required behavior:**
- **Warn-first, not hard-block by default:** calendar conflicts should **warn** rather than
  prevent booking by default.
- **Hard blocking only when explicitly required** — by the service, the work bay, the
  technician, or a store setting.
- **Per-service configurable blocking behavior** (extends §7.14.3):
  - **Blocks work bay**
  - **Blocks technician**
  - **Allows parallel work**
  - **Requires manual confirmation**
- **Permissioned manual override:** users with the appropriate permission may **manually
  override** a conflict warning; the **override must require a reason** (recorded).
- **Capacity-aware scheduling (future):** scheduling should consider **shop capacity, work
  bays, technicians, and service duration** (§7.14.2/§7.14.3) when deciding warn vs block.
- **Multi-day reservations must NOT automatically prevent all other reservations** during the
  same period (they occupy days per §7.14.4 but do not exclusively lock the shop unless a
  blocking flag requires it).

**Constraints:**
- **Dealer-scoped**: `dealer_id` always from `getCurrentDealer()`, **never** from client
  input; **RLS assumptions preserved**. Override permission follows the existing capability
  model (`06_USER_ROLES_AND_PERMISSIONS.md`).

**Implementation status:** Documentation only — no implementation, no migrations, no schema
changes, no current-sprint scope change. Per-service blocking flags, shop-capacity settings,
and override-reason capture are **new settings/records** requiring a **separately-approved
migration / schema** when scheduled; they then compose with §7.14.1–§7.14.4.

## 7.15 Work Orders
- **Purpose:** Execute and track service work.
- **Scope:** Work orders and attachments.
- **Current Status:** Implemented.
- **Major Components:** `/work-orders`; `work_orders`, `work_order_files`.
- **Dependencies:** Estimates; completion reports.
- **Security Considerations:** Dealer-scoped.
- **Future Expansion:** Workflow automation — Future.

## 7.16 Completion Reports
- **Purpose:** Record job completion.
- **Scope:** Completion reporting per work order.
- **Current Status:** Implemented.
- **Major Components:** `completion_reports`; report UI/PDF.
- **Dependencies:** Work orders; PDF generation.
- **Security Considerations:** Dealer-scoped.
- **Future Expansion:** Customer-facing delivery — Future.

## 7.17 Invoice Management
- **Purpose:** Bill customers for completed work.
- **Scope:** Invoices and items.
- **Current Status:** Implemented.
- **Major Components:** `/invoices`; `invoices`, `invoice_items`; PDF.
- **Dependencies:** Estimates/work orders; payments.
- **Security Considerations:** Dealer-scoped; documents via signed URLs.
- **Future Expansion:** Automated billing — Future.

## 7.18 Payment Management
- **Purpose:** Record customer payments.
- **Scope:** Payments against invoices.
- **Current Status:** Implemented.
- **Major Components:** `/payments`; `payments`.
- **Dependencies:** Invoices.
- **Security Considerations:** Dealer-scoped; payment records retained (no delete).
- **Future Expansion:** Payment-processor integration — Future.

## 7.19 Maintenance Management
- **Purpose:** Drive repeat visits via maintenance reminders.
- **Scope:** Reminder scheduling tied to customers/vehicles.
- **Current Status:** Implemented.
- **Major Components:** `/maintenance`; `maintenance_reminders`.
- **Dependencies:** Customers/vehicles; notifications/LINE.
- **Security Considerations:** Dealer-scoped.
- **Future Expansion:** AI-driven timing — Future.

## 7.20 LINE Integration
- **Purpose:** Customer messaging and self-service via LINE.
- **Scope:** Webhook intake, LIFF self-link, messaging.
- **Current Status:** Implemented (code complete) — **inactive pending credentials** (`09_PHASE_STATUS.md`).
- **Major Components:** LINE webhook route; LIFF; `line_customers`, `line_message_logs`, `line_notification_queue`.
- **Dependencies:** LINE Messaging API/LIFF credentials.
- **Security Considerations:** Server-only secrets; signature validation (`02` §2.12).
- **Future Expansion:** LINE rich-menu management — Future.

## 7.21 Notification System
- **Purpose:** Surface in-app and outbound notifications.
- **Scope:** Notification records and delivery queue.
- **Current Status:** Implemented.
- **Major Components:** `notifications`; `line_notification_queue`.
- **Dependencies:** LINE; maintenance/reservations.
- **Security Considerations:** Dealer-scoped.
- **Future Expansion:** Channel expansion — Future.

## 7.22 PDF Generation
- **Purpose:** Generate documents (estimates, invoices, reports).
- **Scope:** Server-side PDF rendering and storage references.
- **Current Status:** Implemented.
- **Major Components:** `/pdf`; PDF renderer; `document_files`.
- **Dependencies:** Estimates/invoices/reports; private storage.
- **Security Considerations:** Private bucket; signed-URL access only.
- **Future Expansion:** Template customization — Future.

## 7.23 News Center
- **Purpose:** Distribute platform/dealer news.
- **Scope:** News items and read tracking.
- **Current Status:** Implemented.
- **Major Components:** `/news`; `gyeon_news`, `gyeon_news_reads`.
- **Dependencies:** Notifications.
- **Security Considerations:** Dealer-scoped where applicable.
- **Future Expansion:** Targeted distribution — Future.

## 7.24 Newsletter
- **Purpose:** Scheduled newsletter delivery.
- **Scope:** Delivery jobs and recipients.
- **Current Status:** Implemented.
- **Major Components:** `news_delivery_jobs`, `news_delivery_recipients`.
- **Dependencies:** News Center; notifications/LINE.
- **Security Considerations:** Dealer-scoped.
- **Future Expansion:** Campaign analytics — Future.

## 7.25 Super Admin
- **Purpose:** Platform-level dealer and administration management.
- **Scope:** Dealer approval/lifecycle; platform administration; admin audit.
- **Current Status:** Implemented.
- **Major Components:** `/admin`; `admin_users`, `admin_audit_logs`; admin guard.
- **Dependencies:** Dealers; subscriptions.
- **Security Considerations:** Only Super Admin manages dealers globally; guarded + audited (`06` §6.7).
- **Future Expansion:** Expanded platform tooling — Future.

## 7.26 Dealer Settings
- **Purpose:** Per-dealer configuration.
- **Scope:** Settings categories; onboarding; document/branding settings.
- **Current Status:** Implemented.
- **Major Components:** `/settings`; `dealer_settings`.
- **Dependencies:** Owner role (`06` §6.8).
- **Security Considerations:** Owner-managed; dealer-scoped.
- **Future Expansion:** Edition/region configuration depth — Future.

## 7.27 Reporting & Analytics
- **Purpose:** Operational insight for dealers.
- **Scope:** Dashboard summary (implemented); broader analytics center.
- **Current Status:** Dashboard summary Implemented; broader analytics — **Planned/Future**.
- **Major Components:** Dashboard summary; analytics (planned).
- **Dependencies:** Operational data.
- **Security Considerations:** Dealer-scoped aggregation only.
- **Future Expansion:** AI insights — Future.

## 7.28 AI Features
- **Purpose:** AI-assisted capabilities.
- **Scope:** OCR (implemented); AI marketing/reputation/growth (future).
- **Current Status:** OCR Implemented; AI Gateway and AI Marketing/Reputation/Growth agents — **Future**.
- **Major Components:** OCR subsystem; future Pro+ AI modules.
- **Dependencies:** Provider keys (dealer-owned for future modules).
- **Security Considerations:** Server-only keys; **no auto-save; human confirmation required; no AI-learning in scope** (`05` §5.17).
- **Future Expansion:** Pro+ AI Platform — Future (`01` §1.12, `11_Roadmap.md`).

## 7.29 Generic Edition Features
- **Purpose:** Brand-neutral edition for non-GYEON detailers.
- **Scope:** Neutral branding, generic catalog/terminology; edition-specific capabilities.
- **Current Status:** **Future** (edition direction approved; white-label not yet built).
- **Major Components:** Edition configuration; generic catalog.
- **Dependencies:** Configuration model (`05` §5.20).
- **Security Considerations:** Same isolation/RLS guarantees as GYEON edition.
- **Future Expansion:** White Label — **Future**; Inventory Management — **Future (Generic Edition only)**.

## 7.30 Future Features

All items below are **Future** (approved direction; not in active scope; require a future approved specification). Distinguished here from Implemented/Planned features above.

| Feature | Status | Notes |
|---------|--------|-------|
| Inventory Management | **Future (Generic Edition only)** | Some database scaffolding exists (`04_Database_Architecture.md` §4.9); the feature is **not** in approved active scope and is classified Future per architect directive. |
| White Label | **Future** | Brand-neutral/white-label delivery for the Generic edition. |
| Customer Mobile App | **Future** | Dedicated customer-facing mobile application. |
| Android Handheld Support | **Future** | Handheld device support. |
| iPad + HID Barcode Scanner | **Future** | iPad workflow with HID barcode scanning. |
| Pro+ AI Platform (Gateway, Marketing, Reputation, Growth, LINE rich-menu) | **Future** | Deferred until core platform is stable in production (`01` §1.12). |

> No Future feature is implemented or scheduled by this document. Each requires its own approved specification under `03_Development_Constitution.md` and `README.md`.

## 7.31 References

- `01_PROJECT_OVERVIEW.md` — scope, editions, status.
- `02_SYSTEM_ARCHITECTURE.md` — architecture and enforcement (not duplicated here).
- `04_Database_Architecture.md` — domains/tables (not duplicated here).
- `05_Business_Rules.md` — feature rules and decision logic.
- `06_User_Roles_and_Permissions.md` — who may use each feature.
- `08_API_Architecture.md` — API/server-action contracts (not duplicated here).
- `09_PHASE_STATUS.md` — authoritative live status. `10_Security_and_RLS.md` — security/RLS detail.
- `11_Roadmap.md` — future phases. `README.md` — SSOT + workflow. `INDEX.md` — document map.
