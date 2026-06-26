# 08 — DEVELOPMENT RULES

> Binding rules for the project under Specification-Driven Development.

---

## 1. Specification authority (SDD)
1. The **Canonical Core Specification** — `gyeon_flow.json` + `gyeon_settings_flow.json` — is the highest authority.
2. **Implementation must follow the specification. Never the reverse.**
3. The canonical JSON files are **read-only**: never overwrite, never redesign. Changes to business logic happen by changing the spec *first*, then the implementation.
4. `/docs/master_specification/*` is **derived** from the JSON + verified implementation; if a doc and the JSON disagree, the JSON wins and the doc is corrected.
5. ⚠️ The canonical JSONs currently live only in the Desktop export, **not in the repo**. Until they are placed under version control in the repo, "canonical" is not yet enforceable. (Operator decision — see report.)

## 2. Multi-tenant & security (carry-over, non-negotiable)
- `dealer_id` is **always** resolved server-side via `getCurrentDealer()` — never from client input, URL, or form.
- All queries are dealer-scoped (`.eq('dealer_id', …)`); RLS enabled on every table.
- Never weaken RLS; never query another dealer's data.
- LINE Channel Secret / Access Token and OpenAI key are **server-side only**; never exposed in UI.
- No DELETE policies on audit/billing/UAT tables.

## 3. Database / migrations
- Migrations are **additive only**; staging-first verification; **never delete production data**; no `DROP`/`RENAME`/`TRUNCATE` of production tables.
- Migrations applied **manually** (Supabase SQL Editor); apply in order; document intentional numbering gaps.
- PPF mandatory fields must never be removed or simplified.

## 4. Incremental delivery (working method)
- Work **one screen/feature at a time**: small change → verify by eye → commit (Git save point) → next.
- Mobile screens are **not modified** when adding desktop screens, and vice versa.
- Verify visually (PC ≥1024px and mobile <1024px) before sign-off.

## 5. Design workflow
- Designs are produced in **Genspark** (the visual authority) and **implemented by Claude** into `~/dealeros`.
- Preferred handoff: HTML/code > screenshot > URL. For PC, instruct Genspark for a **desktop/wide** layout.

## 6. Persistence reconciliation (operator-ratified default)
- Canonical JSON describes IndexedDB + Cloudflare KV/D1; implementation uses **Supabase**.
- **Default rule:** canonical = *data shapes/semantics/settings keys/pricing*; **Supabase is the canonical persistence substrate** going forward. Offline-first is a separate, explicit roadmap item, not implied.
- Auth: **Supabase Auth** supersedes the JSON's custom `AuthToken`/`/api/auth/*` (business intent preserved).

## 7. Audit/process constraints honored in this task
- No implementation, no UI change, no code modification, no commits during specification/audit work.
- Documentation deliverables (this folder) are generated, not committed, unless the operator explicitly asks to commit.

## 8. Scope discipline
- Do **not** invent features. New scope must trace to the canonical spec or to an already-documented project plan (e.g. existing V2 roadmap). See `10_ROADMAP.md`.
