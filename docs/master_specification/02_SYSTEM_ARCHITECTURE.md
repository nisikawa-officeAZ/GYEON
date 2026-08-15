# 2. System Architecture

| Field | Value |
|-------|-------|
| **Document** | 02 — System Architecture |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `04_Database_Architecture.md`, `05_Business_Rules.md`, `06_User_Roles_and_Permissions.md`, `10_Security_and_RLS.md` |

> This document is the official **System Architecture** specification — the binding description of *how* the platform is built and operated. It defines architecture, layers, and operational strategy. It does **not** restate the product purpose (see `01_PROJECT_OVERVIEW.md`), detailed database definitions (see `04_Database_Architecture.md`), or business rules (see `05_Business_Rules.md`). **Architecture decisions documented here are binding; any change requires explicit architect approval** under the workflow in `README.md`.

---

## 2.1 Architecture Overview

A multi-tenant SaaS web application delivered as a mobile-first PWA with a desktop presentation. Logical topology:

```
Browser / PWA (mobile-first; desktop presentation)
      │
      ▼
Next.js 15 (App Router — Server Components + Server Actions)
Vercel (hosting / edge network)
      │
      ├── Supabase Auth        (session/JWT; identity)
      ├── Supabase PostgreSQL  (Row-Level Security; dealer-scoped multi-tenant)
      ├── Supabase Storage     (private bucket; signed URLs)
      └── LINE Messaging API + LIFF (webhook + customer surfaces)
                 │
                 └── OpenAI API (gpt-4o-mini, vision — OCR only)
```

Data mutations are performed through Next.js Server Actions; only a small number of REST endpoints exist (see §2.14 and §2.20). Per-tenant isolation is enforced both in application code (server-side dealer resolution) and at the database layer (RLS).

## 2.2 Design Principles

1. **Tenant isolation is non-negotiable.** `dealer_id` is always resolved server-side via `getCurrentDealer()` and is never accepted from client input, URL parameters, or form fields.
2. **RLS is mandatory.** Row-Level Security is enabled on every feature table as defense-in-depth beneath application-level dealer scoping.
3. **Server-first.** Server Components and Server Actions are preferred; secrets and privileged logic never reach the client.
4. **Additive, audited change.** Schema changes are additive and applied through a controlled, reviewed migration process (see §2.6, §2.18).
5. **AI assists, humans decide.** AI/OCR output is always reviewable/editable and requires explicit user confirmation before any write (cross-reference `05_Business_Rules.md`).
6. **No silent data loss.** Soft-deletion is preferred; certain records (audit/billing) are never deletable.
7. **Specification-driven.** Implementation conforms to this specification; changes require architect approval.

## 2.3 System Layers

| Layer | Responsibility |
|-------|----------------|
| Presentation (client) | PWA UI, device-adaptive rendering, client interactions; holds no secrets. |
| Application (server) | Server Components/Actions, dealer resolution (`getCurrentDealer()`), validation, orchestration, audit/activity logging. |
| Data | PostgreSQL with RLS; dealer-scoped feature tables (definitions in `04_Database_Architecture.md`). |
| Storage | Private object storage for PDFs and OCR images; signed-URL access only. |
| Integration | External services: OpenAI (OCR), LINE (messaging/LIFF). |
| Platform | Hosting, edge network, environment configuration (Vercel). |

## 2.4 Frontend Architecture

| Concern | Detail |
|---------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI library | React |
| Styling | TailwindCSS |
| Build | Turbopack |
| PWA | Service worker; installable on iOS/Android without app-store submission |
| PDF rendering | Server-side PDF generation |
| Device strategy | Distinct desktop (PC) and mobile presentations sharing one data/business-logic engine |
| Client/server split | `"use client"` only where interactivity is required; type-only modules carry no directive; Server-Action modules export only async functions |

The client never holds service secrets; all privileged operations occur server-side.

## 2.5 Backend Architecture

- **Execution model:** Next.js Server Actions (`"use server"`) handle data mutations and privileged reads. REST API routes are reserved for external webhooks/integration callbacks (see §2.14).
- **Dealer resolution:** every server action/data function resolves the tenant via `getCurrentDealer()` (auth.users → dealer_members → `dealer_id`) before any data access.
- **Validation & orchestration:** server-side input validation; cross-entity operations re-validate ownership (e.g., a vehicle's `customer_id` must belong to the same dealer).
- **Logging:** significant actions are recorded via activity and audit logging.

Concrete table/column definitions are specified in `04_Database_Architecture.md`; business logic is specified in `05_Business_Rules.md`.

## 2.6 Database Architecture Overview

- **Engine:** PostgreSQL (Supabase) with Row-Level Security enabled on all feature tables.
- **Tenancy:** every feature record carries a `dealer_id`; reads are dealer-scoped and exclude soft-deleted rows where applicable.
- **Migrations:** applied through a controlled, reviewed process; additive and numbered sequentially; not auto-applied. (Detailed migration governance and the development constitution are in `03_Development_Constitution.md`; schema definitions in `04_Database_Architecture.md`.)

> Detailed table, column, index, and relationship definitions are **out of scope here** and belong to `04_Database_Architecture.md`.

## 2.7 Authentication Architecture

- **Provider:** Supabase Auth (email/password); a session/JWT is issued per authenticated session.
- **Session propagation:** authentication is per-device/browser; sessions are not shared across devices (relevant to mobile OCR capture).
- **Server enforcement:** middleware verifies authentication on protected routes on every request; unauthenticated access is rejected before data access.

## 2.8 Authorization Model

- **Tenant authorization:** access is constrained to the caller's dealer via `getCurrentDealer()` plus RLS.
- **Role-based authorization:** dealer-level roles gate privileged actions; administrative server functions are guarded (e.g., an admin/super-admin guard) before execution.
- **Subscription gating:** middleware enforces subscription/licensing status on protected dealer routes.

Role and permission definitions are specified in `06_User_Roles_and_Permissions.md`; this document defines only the enforcement architecture.

## 2.9 Multi-Tenant Isolation

The platform's foundational guarantee. Isolation chain:

```
auth.users → dealer_members → dealer_id → all feature records
```

Rules (binding):
- `dealer_id` is **always** resolved server-side via `getCurrentDealer()`; it is **never** read from client input, URL, or form.
- Every feature query is dealer-scoped (`.eq("dealer_id", …)`) in application code **and** protected by RLS at the database layer.
- Cross-dealer reference is impossible by construction; cross-entity writes re-validate same-dealer ownership.
- A user may belong to a dealer only through an active `dealer_members` association.

## 2.10 Storage Architecture

- **Bucket model:** private object storage; no public access.
- **Access:** files (PDFs, OCR images) are retrieved only via short-lived signed URLs (short expiry; e.g., ~60 seconds).
- **Tenant scoping:** stored objects are associated with dealer-scoped records; access is mediated by server-side, dealer-validated logic.

## 2.11 OCR / AI Architecture

- **Provider:** OpenAI `gpt-4o-mini` (vision), used for vehicle-registration OCR only.
- **Server-only key:** `OPENAI_API_KEY` is server-side only and never exposed to the client.
- **Flow:** client captures/uploads an image (mobile camera-first; desktop file-first) → server-side upload to private storage → server-side AI analysis (with timeout and bounded retry) → sanitized result → mandatory human review/edit → explicit confirmation → dealer-scoped persistence.
- **Sessions & audit:** OCR sessions and an audit trail provide history and review traceability.
- **Human-in-the-loop:** AI output is never persisted to customer/vehicle records without explicit user confirmation; no AI-learning functionality is in scope.

Feature behavior and decision rules (duplicate detection, register/update) are specified in `05_Business_Rules.md`.

## 2.12 LINE Integration Architecture

- **Inbound:** a webhook endpoint receives LINE messages; request signatures are validated server-side.
- **Customer surfaces:** LIFF pages support customer self-linking and related flows.
- **Secrets:** LINE channel secret and access token are server-side only; never exposed to the client.
- **Required configuration:** LINE channel and LIFF identifiers/credentials are provided via environment variables (values out of scope here).

## 2.13 Security Architecture

| Control | Implementation |
|---------|----------------|
| Row-Level Security | Enabled on all feature tables; dealers cannot access other dealers' data |
| `dealer_id` isolation | Always from `getCurrentDealer()`; never from client |
| Administrative guard | Privileged/admin server functions are guarded before execution |
| Middleware protection | Protected routes verify auth + subscription status on every request |
| Non-deletable records | Audit and billing-class records have no DELETE path; data is permanently retained |
| Signed-URL storage | No direct public access to PDFs or OCR images |
| Server-only secrets | OpenAI and LINE secrets are server-side only |
| Audit logging | Significant admin and dealer actions are recorded with timestamp and actor |

Security and RLS policy detail is further specified in `10_Security_and_RLS.md`.

## 2.14 Deployment Architecture

| Stage | Platform | Rule |
|-------|----------|------|
| Local | Next.js dev server | `.env.local`; never committed |
| Staging/Preview | Vercel preview | Schema/migration changes must pass staging verification first |
| Production | Vercel (main) | **Production deployment requires explicit approval** |

Binding rules:
- **Staging-first is mandatory** for schema changes; direct production deployment without staging verification is prohibited.
- **Production deployment requires explicit architect/owner approval.** Specification and feature work proceeds on a feature branch and is not merged to main or deployed to production without approval.

## 2.15 Monitoring & Logging

- **Audit log:** immutable record of significant administrative and dealer actions (actor, timestamp, resource).
- **Activity log:** per-entity activity history surfaced in the UI (e.g., customer/vehicle timelines).
- **Operational logging:** server-side diagnostic logging for integration and error conditions (no secrets logged).
- **OCR session/audit:** OCR review history and audit trail for traceability.

## 2.16 Disaster Recovery Strategy

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | < 4 hours |
| RPO (Recovery Point Objective) | < 24 hours (point-in-time recovery) |

Rollback procedure (summary):
1. Revert the hosting deployment to the previous known-good version.
2. If schema rollback is required, restore from the pre-migration backup / point-in-time recovery.
3. Notify affected dealers.
4. Document the incident, apply the fix, re-validate, and re-release.

The full runbook is maintained operationally (see project disaster-recovery documentation).

## 2.17 Scalability Strategy

- **Stateless application tier:** server execution is stateless and horizontally scalable on the hosting platform; sessions are token-based.
- **Database scaling:** managed PostgreSQL with RLS; dealer scoping keeps per-tenant working sets bounded.
- **Known current limits (to address as volumes grow):** several list/search and duplicate-detection operations execute client-side over dealer-scoped, page-loaded data; server-side pagination/search is a future enhancement (tracked in roadmap). These are acceptable at current volumes and are documented as technical debt rather than defects.
- **Edge delivery:** static assets and the PWA shell are served via the hosting edge network.

## 2.18 Architecture Constraints

Binding constraints (changes require architect approval):
1. `dealer_id` must always come from `getCurrentDealer()`; never from client input.
2. RLS is mandatory on all feature tables.
3. Migrations are additive and applied through the controlled process; not auto-applied; no destructive schema changes without explicit approval.
4. Production deployment requires explicit approval; staging-first for schema changes.
5. Secrets (OpenAI, LINE) are server-side only.
6. AI/OCR results require explicit user confirmation before any write.
7. Existing approved architecture and canonical documents are preserved; changes are additive and reconciled against this specification.

## 2.19 Architecture Decision Records (ADR)

| ADR | Decision | Status | Rationale |
|-----|----------|--------|-----------|
| ADR-01 | Next.js App Router (Server Components + Server Actions) | Accepted | Reduce client JS; perform mutations and privileged logic server-side. |
| ADR-02 | Supabase RLS for tenant isolation | Accepted | Enforce dealer isolation at the database layer as defense-in-depth beneath app scoping. |
| ADR-03 | `dealer_id` resolved only via `getCurrentDealer()` | Accepted | Prevent client-supplied tenant identifiers; foundational isolation guarantee. |
| ADR-04 | Server Actions for data ops; REST only for external webhooks | Accepted | Keep contracts server-side and typed; expose endpoints only where external callers require them. |
| ADR-05 | Controlled, additive migrations (not auto-applied) | Accepted | Prevent accidental/destructive schema change; maintain an audit trail of applied changes. |
| ADR-06 | Supabase Auth (not a custom token scheme) | Accepted | Standard session/JWT auth; supersedes earlier custom-token designs while preserving business intent. |
| ADR-07 | Private storage with short-lived signed URLs | Accepted | No public access to PDFs/OCR images. |
| ADR-08 | PWA delivery | Accepted | Install on iOS/Android without app-store submission. |
| ADR-09 | Separate PC/Mobile presentations, shared engine | Accepted | Device-appropriate UX without duplicating business logic. |
| ADR-10 | Manual/managed commercial billing at this stage (no third-party payment processor) | Accepted | Sufficient for current dealer volume; reduces launch complexity. |
| ADR-11 | Server-only secrets for OpenAI and LINE | Accepted | Secrets never reach the client. |
| ADR-12 | Staging-first deploys; production requires explicit approval | Accepted | Protect production; verify schema changes before promotion. |

New or superseding ADRs must be added here under architect approval; existing accepted ADRs are not removed without a superseding record.

## 2.20 References

- `01_PROJECT_OVERVIEW.md` — product identity, scope, editions, status.
- `04_Database_Architecture.md` — canonical database/schema definitions (not duplicated here).
- `05_Business_Rules.md` — business logic and feature decision rules (not duplicated here).
- `06_User_Roles_and_Permissions.md` — role and permission definitions.
- `10_Security_and_RLS.md` — detailed security model and RLS policies.
- `README.md` — Single Source of Truth and the governing development workflow.
- `INDEX.md` — master specification document map.
- Existing supporting documents (e.g., `09_PHASE_STATUS.md`, project disaster-recovery and Supabase architecture references) remain valid where not superseded by this specification.
