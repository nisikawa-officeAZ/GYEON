# 8. API Architecture

| Field | Value |
|-------|-------|
| **Document** | 08 — API Architecture |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `03_Development_Constitution.md`, `04_Database_Architecture.md`, `06_User_Roles_and_Permissions.md`, `07_Feature_Specifications.md`, `10_Security_and_RLS.md` |

> This document specifies the **approved API architecture and implemented patterns**. It invents no endpoints, redesigns no architecture, and does not duplicate feature specs (`07_Feature_Specifications.md`) or database definitions (`04_Database_Architecture.md`). Each item is tagged **Implemented**, **Planned**, or **Future**.

**Status legend:** **Implemented** = present in the current build · **Planned** = approved, partial/scheduled · **Future** = approved direction, not built.

---

## 8.1 Purpose

To define how the application exposes server-side operations: the use of Next.js Server Actions as the primary data API, the small set of REST route handlers reserved for external/integration concerns, and the cross-cutting rules (dealer isolation, authorization, validation, logging) every API obeys.

## 8.2 API Architecture Overview

- **Primary data API = Next.js Server Actions** (`"use server"`). Data reads/writes are performed as server functions invoked from Server/Client Components — not as public REST endpoints.
- **REST route handlers exist only for external/integration concerns** (webhooks, auth callbacks, scheduled jobs, lightweight status checks).
- The complete set of implemented REST route handlers is (Implemented):

| Route | Purpose | Status |
|-------|---------|--------|
| `POST /api/line/webhook` | Inbound LINE messages; signature validated server-side | Implemented (inactive pending credentials) |
| `GET/POST /api/line/liff/link` | LINE LIFF customer self-link flow | Implemented (inactive pending credentials) |
| `GET /api/auth/callback` | Supabase Auth callback | Implemented |
| `GET /api/auth/status` | Auth/dealer/OCR-key preflight status (used by OCR upload) | Implemented |
| `GET /api/trial/status` | Trial/subscription status check | Implemented |
| `POST /api/admin/cron/downgrade-trials` | Scheduled trial downgrade (platform job) | Implemented |

> No other public REST endpoints exist. All other operations are Server Actions. New endpoints require architect approval (§8.24).

## 8.3 Server Actions Strategy

- Server Actions are the canonical mechanism for data operations (the codebase contains a large number of `"use server"` modules across domains).
- Each action: resolves the tenant via `getCurrentDealer()` → validates input server-side → performs the dealer-scoped operation → logs (activity/audit) where applicable → returns a typed result (success or a descriptive error).
- Actions never accept `dealer_id` from the client; `dealer_id` is injected server-side on insert and used (with `id`) as scope on update.
- Mutations revalidate affected paths as needed.

## 8.4 Route Handlers Strategy

- Route handlers are reserved for external callers and platform jobs (see §8.2): webhooks (LINE), auth callback, status checks, and scheduled/cron jobs.
- Inbound webhooks validate signatures/secrets server-side; scheduled jobs are guarded (e.g., a shared secret / admin guard).
- Route handlers do not provide a generic data API and do not bypass tenant isolation or authorization.

## 8.5 Authentication Context

- Identity is established by Supabase Auth; the auth callback route completes the session.
- Server functions obtain the current user server-side (`getCurrentUser()`) and the dealer membership via `getCurrentDealer()`.
- The `/api/auth/status` preflight reports authentication, dealer membership, and OCR-key availability to the client without exposing secrets (Implemented).

## 8.6 Authorization Enforcement

- **Authorization is enforced server-side** for every operation (Server Action or route handler).
- Role and tenant checks apply per `06_User_Roles_and_Permissions.md`; privileged/admin operations are guarded (e.g., an admin/super-admin guard) before execution.
- **APIs must never bypass authorization** or tenant isolation; a valid session is necessary but not sufficient.

## 8.7 dealer_id Resolution

- **`dealer_id` must always come from `getCurrentDealer()`** (server-side: `auth.users → dealer_members → dealer_id`).
- **`dealer_id` must never be accepted from client input** — not from forms, query/URL parameters, request bodies, or headers.
- Cross-entity writes re-validate same-dealer ownership (e.g., a vehicle's `customer_id` must belong to the caller's dealer).

## 8.8 Supabase Client Usage

- Two server-side client paths: a request-scoped client honoring the user session + RLS (default), and a guarded service-role/admin client for explicitly privileged operations.
- **Service-role logic is server-only and is never exposed to client-side code.** The anonymous/public key is the only Supabase key permitted client-side.
- RLS remains active for the session client; the admin client is used only within guarded, audited server paths.

## 8.9 Customer APIs (Implemented)
- **Pattern:** dealer-scoped Server Actions/data functions for create, update, read (list/detail), duplicate detection, and notes (e.g., `createCustomer`, `updateCustomer`, `getCustomers`, `getCustomerById`, `findCustomerDuplicates`, `updateCustomerNotes`).
- **Rules:** `dealer_id` server-injected; surname required; soft-delete excluded on reads; no auto-overwrite.
- **Security:** server-side validation + authorization; activity/audit logging.

## 8.10 Vehicle APIs (Implemented)
- **Pattern:** dealer-scoped Server Actions for create, update, read, and lookup (e.g., `createVehicle`, `updateVehicle`, `getVehicles`, `getVehicleById`, `findVehicleByVinOrPlate`).
- **Rules:** `customer_id` re-validated to the same dealer; soft-delete excluded; no auto-overwrite.
- **Security:** server-side validation + authorization.

## 8.11 OCR APIs (Implemented)
- **Pattern:** Server Actions for upload+analyze, confirm, and session management (e.g., `uploadAndAnalyzeVehicleRegistration`, `confirmVehicleRegistrationOcr`, OCR session actions, `registerCustomerAndVehicleFromOcr`); plus the `/api/auth/status` preflight.
- **Rules:** server-only OpenAI key; **AI/OCR output requires explicit user confirmation before persistence**; nothing written automatically.
- **Security:** dealer-scoped; private storage; human-in-the-loop.

## 8.12 Estimate APIs
- **Pattern:** dealer-scoped Server Actions for estimate and item operations and GYEON service estimates. **Status: Implemented (core); category-specific steps Planned.**
- **Rules:** dealer-scoped; pricing computed server-side.
- **Security:** server-side validation + authorization.

## 8.13 Product APIs (Implemented)
- **Pattern:** dealer-scoped Server Actions for catalog read/management.
- **Rules:** purchase eligibility resolved by Product Master, not rank (`05_Business_Rules.md` §5.5).
- **Security:** dealer-scoped; permission-gated.

## 8.14 Order APIs (Implemented)
- **Pattern:** dealer-scoped Server Actions for product orders, items, and fulfillment.
- **Rules:** permission-gated per business rules; dealer-scoped.
- **Security:** server-side authorization.

## 8.15 Calendar APIs (Implemented)
- **Pattern:** dealer-scoped Server Actions for reservations/calendar data.
- **Rules:** dealer-scoped.
- **Security:** server-side authorization. **Future:** external calendar sync — Future.

## 8.16 LINE APIs (Implemented — inactive pending credentials)
- **Endpoints:** `POST /api/line/webhook` (signature-validated inbound), `GET/POST /api/line/liff/link` (customer self-link). Server Actions handle dealer-scoped LINE data.
- **Rules:** server-only LINE secrets; signature validation.
- **Security:** secrets never client-exposed (`02_SYSTEM_ARCHITECTURE.md` §2.12).

## 8.17 PDF APIs (Implemented)
- **Pattern:** server-side PDF generation (no public endpoint); documents stored as references and retrieved via signed URLs.
- **Rules:** dealer-scoped; private bucket.
- **Security:** signed-URL access only.

## 8.18 Super Admin APIs (Implemented)
- **Pattern:** guarded Server Actions for dealer lifecycle/platform administration (admin/super-admin guard), plus the platform cron route `POST /api/admin/cron/downgrade-trials` and `GET /api/trial/status`.
- **Rules:** only Super Admin manages dealers globally (`06` §6.7); actions audited.
- **Security:** guarded + audited; not reachable by dealer roles.

## 8.19 File / Storage APIs (Implemented)
- **Pattern:** uploads via Server Actions (e.g., OCR/work-order/document uploads); signed-URL issuance server-side; tables store references only.
- **Rules:** private bucket; dealer-validated access.
- **Security:** no public storage endpoint; short-lived signed URLs (`02` §2.10).

## 8.20 Error Handling

- Server Actions return typed results: a success shape or a descriptive, user-safe error (no secret/internal leakage).
- Graceful degradation is used where infrastructure may be absent (e.g., OCR session actions return descriptive guidance if a migration is not applied).
- Route handlers return appropriate HTTP status codes; failures are logged server-side.

## 8.21 Validation Strategy

- All inputs are validated server-side regardless of any client-side checks.
- Required-field, type, and range validation occurs in the action; cross-entity ownership is re-validated (same-dealer) before writes.
- Client-side validation is for UX only and is never trusted for authorization or integrity.

## 8.22 Logging Strategy

- Significant actions write to the audit log (immutable; actor/resource/timestamp) and/or per-entity activity log (`04_Database_Architecture.md` §4.20).
- Diagnostic logging is server-side and never logs secrets.
- OCR review traceability is provided via OCR sessions + audit entries.

## 8.23 Security Requirements

Binding (changes require architect approval):
1. `dealer_id` always from `getCurrentDealer()`; never from client input.
2. All write operations are server-side controlled.
3. RLS must remain active.
4. APIs must never bypass authorization.
5. AI/OCR outputs require explicit user confirmation before persistence.
6. Service-role logic is server-only; never exposed to client-side code.
7. Secrets (OpenAI, LINE) are server-side only.

## 8.24 API Change Control

- **Production API changes require architect approval.**
- New endpoints or Server Actions follow the lifecycle in `03_Development_Constitution.md` §3.4 and must preserve §8.23.
- Adding a REST endpoint is an architectural decision (it widens the external surface) and requires explicit approval and, where applicable, an ADR (`02_SYSTEM_ARCHITECTURE.md` §2.19).

## 8.25 Future API Expansion

- **Future:** Pro+ AI Platform APIs (AI Gateway and agent integrations), external calendar sync, and any Generic-edition/white-label or future-device APIs (`07_Feature_Specifications.md` §7.30). None are implemented or scheduled by this document.
- Any expansion preserves the security requirements in §8.23 and the change control in §8.24.

## 8.26 References

- `02_SYSTEM_ARCHITECTURE.md` — server-action vs REST decision (ADR-04), isolation, security.
- `03_Development_Constitution.md` — lifecycle, dealer_id/RLS policy, change control.
- `04_Database_Architecture.md` — domains/ownership (not duplicated here).
- `06_User_Roles_and_Permissions.md` — authorization model enforced by APIs.
- `07_Feature_Specifications.md` — feature scope/status (not duplicated here).
- `10_Security_and_RLS.md` — detailed security/RLS. `README.md` — SSOT + workflow. `INDEX.md` — document map.
