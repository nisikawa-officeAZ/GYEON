# 10. Security and Row Level Security

| Field | Value |
|-------|-------|
| **Document** | 10 — Security and Row Level Security (RLS) |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `03_Development_Constitution.md`, `04_Database_Architecture.md`, `06_User_Roles_and_Permissions.md`, `08_API_Architecture.md` |

> This document specifies the **approved and implemented security model**. It does **not redesign security**, and does not duplicate database definitions (`04_Database_Architecture.md`) or API specifications (`08_API_Architecture.md`). Enforcement details are referenced from the architecture, constitution, roles, and API documents.

---

## 10.1 Purpose

To state the platform's security architecture and Row-Level Security model: how identity, authorization, tenant isolation, storage, secrets, auditing, and production protection are enforced — as the authoritative security reference.

## 10.2 Security Philosophy

1. **Defense in depth.** Application-level checks (auth, role, dealer scope) operate together with database-level RLS; neither alone is sufficient.
2. **Tenant isolation is absolute.** Every operation is bounded by the caller's dealer.
3. **Least privilege.** Roles and credentials receive only what they need; the public client holds no privileged authority.
4. **No bypass.** No API, role, or AI account may bypass authorization or isolation.
5. **Server-side truth.** Authorization and validation are decided on the server; the client is never trusted for security.
6. **No silent change.** Human confirmation for AI/OCR writes; soft-delete preferred; audit/billing records retained.

## 10.3 Security Architecture Overview

- Identity via Supabase Auth → server-side dealer resolution via `getCurrentDealer()` → role + tenant authorization → RLS at the database → private storage with signed URLs → audited mutations.
- External surface is minimal: data operations are Server Actions; only a small set of REST handlers exist for webhooks/auth/status/cron (`08_API_Architecture.md` §8.2).
- Secrets (OpenAI, LINE, service-role) are server-side only.

## 10.4 Authentication Model

- Supabase Auth establishes identity; the auth callback completes the session (`02_SYSTEM_ARCHITECTURE.md` §2.7).
- Sessions are per-device/browser; protected routes verify authentication on every request via middleware.
- A valid session is necessary but not sufficient — authorization and tenant checks still apply.

## 10.5 Authorization Model

- **Authorization is enforced server-side** for every operation.
- Role-based access per `06_User_Roles_and_Permissions.md` (Super Admin, Owner, Manager, Staff, ReadOnly, AI); privileged/admin operations are guarded before execution.
- **No API may bypass authorization** (`08_API_Architecture.md` §8.6).

## 10.6 Multi-Tenant Security

- Every business record is owned by exactly one dealer; cross-dealer read/write is prohibited.
- The isolation chain is `auth.users → dealer_members → dealer_id → records`.
- Cross-entity writes re-validate same-dealer ownership (e.g., a vehicle's customer must belong to the caller's dealer).

## 10.7 dealer_id Isolation

- **`dealer_id` must always come from `getCurrentDealer()`** (server-side).
- **`dealer_id` must never be accepted from client input** — not from forms, query/URL parameters, request bodies, or headers.
- `dealer_id` is injected server-side on insert and used (with `id`) as scope on update; it is never client-mutable.

## 10.8 Row Level Security (RLS)

- **RLS is mandatory for every protected table.** It is enabled on feature tables and enforces that a dealer can access only its own rows (e.g., dealers may select only their own dealer record; feature tables are scoped by `dealer_id`).
- RLS is **defense-in-depth beneath** application-level dealer scoping; both are required.
- Every change must **preserve existing RLS assumptions**; RLS is never disabled to "make a query work."
- Policy specifics are maintained with the schema; this document mandates the model, not a per-table policy dump (avoid duplicating `04_Database_Architecture.md`).

## 10.9 Database Access Policy

- Two server-side access paths: a request-scoped session client (honors RLS — default) and a **guarded service-role/admin client** for explicitly privileged operations only.
- **No client-side code may use service-role credentials.** The public/anonymous key is the only Supabase key permitted client-side.
- The admin client is used only inside guarded, audited server paths (e.g., Super Admin operations).

## 10.10 Storage Security

- Binaries (PDFs, OCR images) live in a **private** bucket; no public access.
- **Storage access must respect tenant isolation** — objects are associated with dealer-scoped records and reached only via short-lived signed URLs issued by server-side, dealer-validated logic.
- Database tables hold references/metadata, not blobs (`04_Database_Architecture.md` §4.15).

## 10.11 Server Action Security

- Server Actions resolve the tenant via `getCurrentDealer()`, validate inputs server-side, enforce authorization, perform dealer-scoped operations, and log significant actions.
- `dealer_id` is never read from client input; results are typed and user-safe (no secret leakage).
- Write operations are server-side controlled (`08_API_Architecture.md` §8.3).

## 10.12 API Security

- REST handlers are limited to webhooks/auth/status/cron; webhooks validate signatures/secrets; cron/admin endpoints are guarded.
- **No API bypasses authorization** or tenant isolation; **production API changes require architect approval** (`08_API_Architecture.md` §8.24).

## 10.13 AI/OCR Security

- The OpenAI key is **server-side only**; AI runs server-side.
- **AI/OCR results require explicit user confirmation before persistence** — nothing is written to customer/vehicle records automatically.
- AI operates within tenant scope and never elevates privilege; no AI-learning functionality is in scope (`06` §6.12, `05_Business_Rules.md` §5.13/§5.17).

## 10.14 LINE Security

- LINE channel secret and access token are **server-side only**; never exposed to the client.
- Inbound webhooks validate request signatures server-side (`02_SYSTEM_ARCHITECTURE.md` §2.12).
- LINE data is dealer-scoped.

## 10.15 File Upload Security

- Uploads are performed via server-side actions with type/size validation before any processing or storage.
- Files are stored in the private bucket and associated with dealer-scoped records; access is via signed URLs only.
- Upload size/type limits are enforced server-side regardless of client checks.

## 10.16 Session Management

- Token-based sessions issued by Supabase Auth; per-device.
- Protected routes re-check authentication (and subscription status) on every request via middleware.
- No long-lived client secrets; the client cannot self-elevate.

## 10.17 Secret Management

- All secrets (OpenAI, LINE, Supabase service-role) are server-side only, provided via environment configuration; never committed and never exposed to client code.
- Local development uses `.env.local` (never committed).
- Logs never contain secrets.

## 10.18 Audit Logging

- Significant administrative and dealer actions are recorded in an immutable audit log (actor, action, resource, timestamp); platform-admin actions have their own trail.
- Per-entity activity logs support UI timelines; OCR sessions + audit provide review traceability.
- Audit/billing-class records have **no DELETE path** (permanent retention; `04_Database_Architecture.md` §4.20).

## 10.19 Soft Delete Security

- Soft-deletion (`deleted_at`) is the preferred deletion mechanism; reads exclude soft-deleted rows.
- Customer/vehicle data is never destroyed by normal flows; restoration clears `deleted_at`.
- Soft-deleted records remain protected by the same isolation/RLS guarantees.

## 10.20 Backup & Disaster Recovery Considerations

- Managed PostgreSQL with point-in-time recovery underpins the recovery targets (RTO < 4h, RPO < 24h; `02_SYSTEM_ARCHITECTURE.md` §2.16).
- Schema changes are backed up and staging-verified before production apply.
- Retained audit/billing data supports forensic review.

## 10.21 Production Protection Policy

- **Production changes require architect approval**; production deployment is gated.
- **Manual migration review is mandatory** — migrations are never auto-applied; staging-first for schema changes; no destructive change without explicit approval (`03_Development_Constitution.md` §3.9, §3.19).
- Specification/feature work proceeds on a feature branch without merge to main or production deploy unless explicitly authorized.

## 10.22 Security Change Control

- Security-affecting changes follow the lifecycle in `03_Development_Constitution.md` §3.4 and require architect approval where they touch isolation, authorization, RLS, secrets, or the external surface.
- The foundational guarantees are non-waivable: `dealer_id` via `getCurrentDealer()`, no client-supplied `dealer_id`, mandatory RLS, no service-role on the client, no authorization bypass, and human confirmation for AI/OCR writes.
- Exceptions require explicit, time-bounded architect approval (`03` §3.22).

## 10.23 Future Security Enhancements

- **Future** (require approval, not implemented): additional authentication factors; finer-grained per-resource policies; expanded automated security testing; security tooling for the Pro+ AI Platform and Generic edition.
- No future enhancement may weaken the foundational guarantees in §10.22.

## 10.24 References

- `02_SYSTEM_ARCHITECTURE.md` — security architecture, isolation, storage, DR.
- `03_Development_Constitution.md` — dealer_id/RLS/security policy, migration & production protection.
- `04_Database_Architecture.md` — RLS-protected tables, audit, soft-delete (not duplicated here).
- `06_User_Roles_and_Permissions.md` — authorization model.
- `08_API_Architecture.md` — API/server-action security (not duplicated here).
- `README.md` — Single Source of Truth + workflow. `INDEX.md` — document map.
