# 6. User Roles and Permissions

| Field | Value |
|-------|-------|
| **Document** | 06 — User Roles and Permissions |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `03_Development_Constitution.md`, `04_Database_Architecture.md`, `05_Business_Rules.md`, `10_Security_and_RLS.md` |

> This document defines **only the approved authorization model**. It does not invent roles, redesign the permission model, or duplicate database schema (`04_Database_Architecture.md`) or API definitions (`08_API_Architecture.md`). Enforcement mechanisms are specified in the architecture/security documents and only referenced here. **All permissions are enforced server-side; RLS remains mandatory for every role.**

---

## 6.1 Purpose

To define the canonical roles, their permissions, and the boundaries that govern who may read or modify which resources, within the platform's multi-tenant model. It is the authoritative reference for authorization decisions.

## 6.2 Authorization Philosophy

1. **Authorization is server-side.** Permission checks are performed on the server; the client never determines its own authority.
2. **Tenant isolation first.** Every authorization decision is bounded by the caller's dealer; role grants apply only within that dealer (except the platform Super Admin, §6.7).
3. **Least privilege.** Each role receives only the permissions required for its function.
4. **Defense in depth.** Application-level role/dealer checks operate together with mandatory RLS at the database layer; neither replaces the other.
5. **No bypass.** No role — including AI service accounts — may bypass authorization or tenant isolation.

## 6.3 Multi-Tenant Permission Model

- Every business resource is owned by exactly one dealer (`dealer_id`).
- **`dealer_id` isolation is mandatory:** `dealer_id` is always resolved server-side via `getCurrentDealer()` and never accepted from client input.
- **No user may access another dealer's data.** Dealer-scoped roles can act only within their own dealer.
- The platform Super Admin operates at the platform tier (global dealer management) through an explicitly guarded, audited path — distinct from per-dealer data operations.

## 6.4 Role Hierarchy

```
Super Admin            (platform / system tier — global dealer management)
   │
   ▼  (per dealer, scoped by dealer_id + RLS)
Owner   →  Manager  →  Staff  →  ReadOnly
AI       (service account — assistive only; never elevates; never bypasses)
```

Within a dealer, capability decreases Owner → Manager → Staff → ReadOnly. Super Admin is a platform role, not a higher tier of dealer data access. AI is a constrained service account, not a position in the dealer hierarchy.

## 6.5 System Roles

- **Super Admin** — platform-level administration (dealer lifecycle/global management). The only role permitted to manage dealers globally (§6.7).
- **AI (service account)** — assistive automation (e.g., OCR extraction). Constrained; never bypasses authorization (§6.12).

## 6.6 Dealer Roles

Scoped strictly to a single dealer via `dealer_id` + RLS:

- **Owner** — dealer configuration and administration within the dealer.
- **Manager** — operational data management within the dealer.
- **Staff** — daily operations within the dealer.
- **ReadOnly** — read-only access within the dealer; no write.

## 6.7 Super Admin Permissions

- **The only role allowed to manage dealers globally** (dealer approval, lifecycle, platform administration).
- Operates through an explicitly guarded administrative path; all actions are audited.
- Super Admin authority is platform-scoped; it is not a means for a dealer user to reach another dealer's operational data through normal flows.
- Subject to the same non-bypass principle: actions are server-enforced and logged.

## 6.8 Owner Permissions

- **Manages dealer configuration** (settings, staff/membership, subscription/licensing context) within the owning dealer.
- Has full operational access within the dealer (a superset of Manager and Staff).
- Cannot access or modify any other dealer's data.

## 6.9 Manager Permissions

- **Manages operational data** within the dealer (customers, vehicles, estimates, work orders, invoices, payments, and related operations), per the approved business rules in `05_Business_Rules.md`.
- Does not control dealer-level configuration reserved to the Owner.
- Cannot access any other dealer's data.

## 6.10 Staff Permissions

- **Performs daily operations** within the dealer (create/update operational records as permitted by business rules).
- Does not perform dealer configuration or owner-level administration.
- Cannot access any other dealer's data.

## 6.11 ReadOnly Permissions

- **Has no write permission.** Read access to the dealer's data only, within tenant scope.
- Cannot create, update, or delete any record.
- Cannot access any other dealer's data.

## 6.12 AI Service Account Permissions

- Assistive only (e.g., OCR field extraction). **AI accounts never bypass authorization** and never elevate privilege.
- AI output is never persisted without explicit human confirmation (see `05_Business_Rules.md` §5.13/§5.17); AI does not autonomously write business records.
- AI operations remain dealer-scoped and server-mediated; secrets are server-side only.
- No AI-learning functionality is in scope.

## 6.13 Permission Boundaries

- All dealer roles are bounded by the dealer-isolation chain `auth.users → dealer_members → dealer_id → records`.
- Role grants apply only within the caller's dealer; capability is additive down the hierarchy (Owner ⊇ Manager ⊇ Staff ⊇ ReadOnly within a dealer).
- Privileged/administrative operations are guarded server-side before execution.
- Permission summary (high level):

| Capability | Super Admin | Owner | Manager | Staff | ReadOnly | AI |
|------------|:-----------:|:-----:|:-------:|:-----:|:--------:|:--:|
| Manage dealers globally | ✓ | — | — | — | — | — |
| Manage dealer configuration | — | ✓ | — | — | — | — |
| Manage operational data | — | ✓ | ✓ | — | — | — |
| Daily operations (create/update) | — | ✓ | ✓ | ✓ | — | — |
| Read dealer data | — | ✓ | ✓ | ✓ | ✓ | scoped |
| Write without human confirmation | — | — | — | — | — | — |

(— indicates the capability is not granted to that role through normal flows. Super Admin acts at the platform tier, not as a per-dealer operational role.)

## 6.14 Cross-Dealer Restrictions

- **No user may access another dealer's data.** Cross-dealer read or write is prohibited by both application-level scoping and RLS.
- Cross-entity operations re-validate same-dealer ownership (e.g., a vehicle's customer must belong to the same dealer).
- Ownership is never transferred across dealers through a normal mutation.

## 6.15 Authentication vs Authorization

- **Authentication** (identity) is provided by Supabase Auth; it establishes *who* the caller is (see `02_SYSTEM_ARCHITECTURE.md` §2.7).
- **Authorization** determines *what* the caller may do: role + dealer scope + RLS, enforced server-side (see §2.8).
- A valid session is necessary but not sufficient; every protected operation also passes authorization and tenant-scope checks.

## 6.16 Resource Ownership

- Every business resource is owned by exactly one dealer (`dealer_id`); ownership keys (e.g., `customer_id`) link resources within that dealer.
- Authorization to act on a resource requires that the resource belongs to the caller's dealer (Super Admin platform management excepted and audited).
- Soft-deleted resources are excluded from normal access (see `04_Database_Architecture.md` §4.19).

## 6.17 Storage Permissions

- Stored binaries (PDFs, OCR images) live in a private bucket; roles do not receive direct public bucket access.
- Access is granted only via short-lived signed URLs issued by server-side, dealer-validated logic (see `02_SYSTEM_ARCHITECTURE.md` §2.10).
- Storage access inherits the same tenant boundary and role constraints as the owning records.

## 6.18 Future Permission Extensions

- New roles or permission changes require architect approval and an updated specification before implementation; this document introduces none.
- Any extension must preserve the foundational guarantees: mandatory `dealer_id` isolation, mandatory RLS, server-side enforcement, no cross-dealer access, and no AI bypass.

## 6.19 References

- `02_SYSTEM_ARCHITECTURE.md` — authentication, authorization model, isolation, storage.
- `03_Development_Constitution.md` — dealer_id policy, RLS policy, security rules.
- `04_Database_Architecture.md` — ownership keys, membership, soft-delete (not duplicated here).
- `05_Business_Rules.md` — operational rules governing what each role acts upon.
- `10_Security_and_RLS.md` — detailed RLS policies and security model.
- `README.md` — Single Source of Truth + workflow. `INDEX.md` — document map.
