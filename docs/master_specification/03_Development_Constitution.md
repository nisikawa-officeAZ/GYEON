# 3. Development Constitution

| Field | Value |
|-------|-------|
| **Document** | 03 — Development Constitution |
| **Status** | Canonical |
| **Owner** | System Architect |
| **Version** | 2.0 |
| **Last Updated** | 2026-06-30 |
| **Governing Workflow** | `README.md` (Single Source of Truth + approved workflow) |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `02_SYSTEM_ARCHITECTURE.md`, `04_Database_Architecture.md`, `05_Business_Rules.md`, `06_User_Roles_and_Permissions.md`, `10_Security_and_RLS.md` |

> This document is the official **Development Constitution** — the binding set of rules, governance, and process that all implementation work must follow. Where this document and code disagree, this document (and the specification set it belongs to) is authoritative until formally amended. **Specification documents in `docs/master_specification/` are the Single Source of Truth.**

---

## 3.1 Purpose

To define the permanent governance, process, and engineering rules for the platform, so that every change is specified, reviewed, verified, and safe for a multi-tenant production system. The Constitution exists to:

- Guarantee tenant isolation and data safety.
- Ensure no implementation bypasses the approved specification.
- Make change deliberate, reviewable, and reversible.

## 3.2 Governance Model

- The **specification set** (`docs/master_specification/`) is the highest authority; **implementation conforms to it, never the reverse**.
- The **System Architect** owns architecture and approves changes to it.
- Changes follow the approved workflow (§3.4) and the change-control process (§3.21).
- No implementation may bypass the approved specification.

## 3.3 Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| System Architect | Owns architecture and specifications; grants architecture and production approvals; arbitrates exceptions. |
| Reviewer (ChatGPT review step) | Reviews architecture proposals and specifications before approval. |
| Implementer (Claude) | Reads the relevant specification, implements only approved work, runs verification, commits, and pushes to a feature branch. |
| Operator/Owner | Authorizes production deployment and commercial actions. |

Detailed product/user roles and permissions are specified in `06_User_Roles_and_Permissions.md`; this section concerns development governance roles only.

## 3.4 Development Lifecycle

Every feature and change MUST follow this sequence (no step may be skipped):

```
Requirement Analysis
→ Architecture Proposal
→ ChatGPT Review
→ Final Specification Approval
→ Claude Implementation
→ Review
→ Typecheck
→ Build
→ Commit
→ Push
```

Implementation begins only after **Final Specification Approval**. Verification (Review → Typecheck → Build) MUST pass before Commit and Push.

## 3.5 Architecture Approval Process

- **Architecture changes require explicit architect approval** before implementation.
- A change is "architectural" if it alters layers, data model shape, tenant-isolation mechanics, authentication/authorization model, external integrations, deployment topology, or any Architecture Decision Record (ADR) in `02_SYSTEM_ARCHITECTURE.md` §2.19.
- New or superseding ADRs are recorded in `02_SYSTEM_ARCHITECTURE.md` under architect approval; accepted ADRs are not removed without a superseding record.

## 3.6 Coding Standards

- Follow existing conventions in the codebase (naming, file layout, server/client split, comment density).
- Respect the `"use client"` / `"use server"` boundaries: type-only modules carry no directive; Server-Action modules export only async functions; secrets never reach the client.
- Server actions/data functions resolve the tenant via `getCurrentDealer()` before any data access and validate inputs server-side.
- Prefer additive, reversible changes; avoid redesigns unless explicitly approved.
- Reuse existing components/utilities rather than duplicating them.

## 3.7 Git Workflow

- Work occurs on a feature branch; **do not merge to main** without approval.
- Commits are made only after verification passes (typecheck + build).
- One logical change per commit; clear, scoped commit messages.
- Push only the feature branch; never force-push shared history.

## 3.8 Branch Strategy

- `main` is the protected, production-tracking branch; changes reach it only via reviewed merge with approval.
- Feature branches carry all in-progress work (specifications, features, fixes).
- Documentation-only changes are committed on the same feature branch and follow the same verification gate.

## 3.9 Migration Policy

- **Migrations must be manually reviewed before execution.** They are never auto-applied.
- Migrations are **additive** and numbered sequentially; gaps are intentional where documented; apply strictly in order.
- No destructive schema change without explicit architect approval.
- Schema changes are **staging-first**; production apply only after staging verification.
- Migration governance is binding here; schema definitions live in `04_Database_Architecture.md`.

## 3.10 Database Change Policy

- No schema change without an approved specification and the migration process in §3.9.
- Every feature table carries `dealer_id` and is protected by RLS (§3.13–§3.14).
- Reads exclude soft-deleted rows where applicable; destructive deletes are avoided in favor of soft-deletion; audit/billing-class records are never deletable.
- Detailed table/column/index definitions are specified in `04_Database_Architecture.md` (not duplicated here).

## 3.11 Security Rules

- Secrets (e.g., OpenAI and LINE credentials) are **server-side only** and never exposed to the client.
- Privileged/administrative server functions are guarded before execution.
- Protected routes verify authentication and subscription status on every request.
- Private storage; files accessed only via short-lived signed URLs.
- AI/OCR output is never persisted without explicit user confirmation.
- Detailed security model and RLS policies are specified in `10_Security_and_RLS.md`.

## 3.12 Multi-Tenant Rules

- The isolation chain `auth.users → dealer_members → dealer_id → records` is mandatory.
- Every query is dealer-scoped in application code **and** protected by RLS at the database layer.
- Cross-dealer reads/writes are prohibited; cross-entity writes re-validate same-dealer ownership.

## 3.13 dealer_id Policy

- **`dealer_id` MUST always be obtained through `getCurrentDealer()` (server-side).**
- **`dealer_id` MUST never be accepted from client input** — not from forms, URL/query parameters, request bodies, or any client-controlled source.
- `dealer_id` is injected server-side on insert and used as a scope (with `id`) on update; it is never changeable via a mutation.

## 3.14 RLS Policy

- **Row-Level Security is mandatory** and enabled on every feature table.
- RLS is defense-in-depth beneath application-level dealer scoping; both are required, neither substitutes for the other.
- RLS assumptions must be preserved by every change; policy detail is specified in `10_Security_and_RLS.md`.

## 3.15 Testing Requirements

- Every change MUST pass `npm run typecheck` and `npm run build` before commit.
- Where a project lint script exists, it MUST pass; if no lint script exists, this is reported as N/A (no lint tooling is added implicitly).
- Pure logic modules (e.g., mappers, derived-status, analysis helpers) SHOULD have unit tests; integration verification SHOULD cover tenant isolation and the human-confirmation requirement for AI/OCR writes.
- Verification results are reported honestly; failing checks block commit.

## 3.16 Code Review Process

- Architecture proposals and specifications are reviewed (ChatGPT review step) before Final Specification Approval (§3.4).
- Implementation is reviewed (the **Review** step) before commit; review covers correctness, tenant isolation, security, reuse, and conformance to the specification.
- Self-review is required at minimum; independent/adversarial review is used for higher-risk changes (e.g., integration QA).

## 3.17 Documentation Requirements

- The relevant specification document MUST be read before implementing a feature.
- Specification changes are committed as documentation under the same verification gate.
- Living status (phases/sprints) is recorded in `09_PHASE_STATUS.md`; the document map is in `INDEX.md`.
- No existing specification content is replaced with placeholder skeletons; canonical documents are preserved and amended, not discarded.

## 3.18 Release Policy

- Releases are cut from approved, verified work on a feature branch that has been reviewed and merged under approval.
- Schema changes are staging-verified before any production release.
- Release readiness and disaster-recovery posture are maintained per `02_SYSTEM_ARCHITECTURE.md` §2.16.

## 3.19 Production Protection Policy

- **Production deployment requires explicit approval** (architect/owner).
- Direct production deployment without staging verification of schema changes is prohibited.
- Specification and feature work proceeds without merging to main or deploying to production unless explicitly authorized.

## 3.20 Definition of Done

A change is "Done" only when ALL of the following hold:

1. It conforms to the approved specification (no bypass).
2. `dealer_id` is server-resolved; no client-supplied tenancy; RLS preserved.
3. AI/OCR writes require explicit user confirmation; no automatic overwrite of customer/vehicle data.
4. `npm run typecheck` passes; `npm run build` passes; lint passes or is N/A.
5. It was reviewed (self-review minimum) and follows existing conventions.
6. It is committed with a clear message and pushed to the feature branch (not merged to main, not deployed to production, unless explicitly approved).
7. Relevant documentation/status is updated where applicable.

## 3.21 Change Control Process

- All changes enter through the lifecycle in §3.4.
- Architectural changes require architect approval (§3.5) and an ADR where applicable.
- Database/schema changes require the migration policy (§3.9–§3.10).
- The Single Source of Truth is updated to reflect approved changes; code and specification are kept reconciled.

## 3.22 Exceptions

- Any deviation from this Constitution requires **explicit architect approval**, recorded as a time-bounded, scoped exception.
- Exceptions never waive the foundational guarantees: `dealer_id` via `getCurrentDealer()`, no client-supplied `dealer_id`, mandatory RLS, human confirmation for AI/OCR writes, and production-approval requirements.
- An exception is documented (what, why, scope, expiry) and reconciled back to the specification when resolved.

## 3.23 References

- `README.md` — Single Source of Truth and the governing development workflow.
- `01_PROJECT_OVERVIEW.md` — product identity, scope, editions, status.
- `02_SYSTEM_ARCHITECTURE.md` — architecture, constraints, and ADRs.
- `04_Database_Architecture.md` — canonical schema definitions.
- `05_Business_Rules.md` — business logic and decision rules.
- `06_User_Roles_and_Permissions.md` — role and permission definitions.
- `10_Security_and_RLS.md` — detailed security model and RLS policies.
- `09_PHASE_STATUS.md` — living phase/sprint status. `INDEX.md` — document map.
