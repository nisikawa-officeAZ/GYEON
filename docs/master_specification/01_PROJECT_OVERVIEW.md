# 01 — PROJECT OVERVIEW
## GYEON Detailer Agent — Master Specification

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Canonical |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | `gyeon_flow.json`, `gyeon_settings_flow.json`, implementation audit |
| **Related Documents** | `02_SYSTEM_ARCHITECTURE.md`, `09_PHASE_STATUS.md`, `10_ROADMAP.md`, `11_CANONICAL_RULES.md` |

> **Status:** Canonical. Generated under Specification-Driven Development (SDD).
> **Source of truth:** `gyeon_flow.json` + `gyeon_settings_flow.json` (the Canonical Core Specification).
> **Rule:** Implementation must follow this specification. Never the reverse.
> **Generated:** 2026-06-25 · Documentation only — no code changed.

---

## 1. Purpose

GYEON Detailer Agent is an **AI-powered business operating system for professional detailers** — a cloud platform for automotive detailing shops that handle GYEON ceramic coating and related services.

Its core job today is to turn an on-site service consultation into a structured, priced, shareable **estimate**, and to carry that relationship forward (work order → invoice → payment → maintenance reminder → repeat visit).

Its long-term vision is to become a full AI business growth platform: supporting not only estimate, customer, vehicle, work order, product order, and LINE operations, but also **AI-driven marketing, reputation management, customer retention, and business growth.**

Tagline (from `VERSION.md`): **「施工で終わらせない。顧客との関係を、次の来店へ。」**

The estimate engine supports seven service categories, each with its own pricing model:
**Coating (GYEON), PPF, Window Film, Maintenance, Car Wash, Room Cleaning, Other Work.**

### Strategic platform direction (Pro+ AI Platform)

| Module | Scope |
|--------|-------|
| **AI Gateway** | Provider-agnostic AI infrastructure; dealer-owned API keys; Office AZ does not pay inference costs |
| **AI Marketing Agent** | Convert completed jobs into marketing content (video, captions, SNS publishing) with mandatory SEO/MEO/AEO/LLMO/AIO optimization |
| **AI Reputation Agent** | Authentic review collection via LINE; Google Business Profile integration; reputation analytics |
| **AI Growth Agent** | Proactive business growth analysis and content recommendations |
| **LINE Rich Menu Management** | Customer-facing LINE rich menu (reservation, service menu, maintenance, review, inquiry) |

> These modules are approved future features — deferred until core platform reaches stable production. See `10_ROADMAP.md` Phase F and `AI_GATEWAY_SPEC.md`.

---

## 2. Two Architectural Layers

### 2.1 Canonical business architecture (runtime-agnostic)
Defined by the Canonical JSON. This is the **immutable business logic**: screens, steps, conditions, calculations, transitions, settings, and pricing. It does not depend on any particular database or framework and applies to every implementation.

### 2.2 Implemented runtime architecture (current)
The live implementation in `~/DealerOS`:

```
Browser (PWA, mobile-first; PC top screen added)
        │
        ▼
Next.js 15 (App Router, Server Components + Server Actions)
        │
        ▼
Supabase  ── PostgreSQL (RLS, dealer-scoped multi-tenant)
          ── Supabase Auth (email/password)
          ── Supabase Storage (PDF, OCR images)
        │
        ▼
Vercel (hosting)   +   External: OpenAI (OCR), LINE (LIFF/Messaging)
```

> ⚠️ **Architecture discrepancy note.**
> The Canonical JSON's persistence/auth/sync sections describe the *original Genspark runtime* — IndexedDB + Cloudflare KV + D1 (SQLite) + Workers/Hono + custom AuthToken. The **current implementation replaces that** with Supabase (PostgreSQL + Auth + Storage). The *business logic* (estimate flow, pricing, settings semantics) is preserved; the *storage substrate* is not the same. See `05_DATABASE_REQUIREMENTS.md` §4 and `11_CANONICAL_RULES.md` §6.

---

## 3. Technology Stack (implemented)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, TailwindCSS v4 |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (private bucket, signed URLs) |
| PDF | @react-pdf/renderer |
| PWA | @ducanh2912/next-pwa (service worker) |
| OCR | OpenAI `gpt-4o-mini` (vision) |
| Messaging | LINE LIFF + Messaging API |
| Hosting | Vercel |

---

## 4. Current Version

| Field | Value |
|-------|-------|
| Declared version (`VERSION.md`) | **1.0.0 — "Official Release"** |
| Latest CHANGELOG phase | PHASE65 — Release Candidate (RC1) |
| Canonical JSON version | `2024-06` |

---

## 5. Current Phase

- **Last documented numbered phase (CHANGELOG):** PHASE65 — Release Candidate (RC1)
- **Last numbered phase in git history:** PHASE73 — Home screen visual restoration
- **Current active work:** Post-1.0.0 **PC / Mobile UI separation** (PC top screen delivered; other screens pending).

Full detail in `09_PHASE_STATUS.md`.

---

## 6. Development Philosophy

**Specification-Driven Development (SDD).**

1. The **Canonical Core Specification** (`gyeon_flow.json`, `gyeon_settings_flow.json`) is the highest authority.
2. Implementation conforms to the specification — never the reverse.
3. The canonical JSON files are **not overwritten or redesigned**; they are read-only inputs.
4. Documents in `/docs/master_specification/` are **derived from** the JSON and from the verified implementation state.
5. Changes proceed **incrementally**, one screen/feature at a time, verified by eye, saved to Git after each step (see `11_CANONICAL_RULES.md`).

---

## 7. Master Specification Index

| File | Contents |
|------|----------|
| `01_PROJECT_OVERVIEW.md` | This document — project identity, purpose, stack |
| `02_SYSTEM_ARCHITECTURE.md` | System architecture, deployment, security, subscriptions |
| `03_BUSINESS_WORKFLOW.md` | Estimate workflow — derived from `gyeon_flow.json` |
| `04_SETTINGS_WORKFLOW.md` | Settings & persistence — derived from `gyeon_settings_flow.json` |
| `05_DATABASE_REQUIREMENTS.md` | Data model requirements — canonical vs implemented |
| `06_OCR_REQUIREMENTS.md` | Vehicle-registration OCR requirements |
| `07_LINE_REQUIREMENTS.md` | LINE / LIFF / messaging requirements |
| `08_UI_REQUIREMENTS.md` | Screen & UI requirements |
| `09_PHASE_STATUS.md` | Completed / current / pending phases |
| `10_ROADMAP.md` | Roadmap from the current baseline |
| `11_CANONICAL_RULES.md` | SDD rules, security rules, migration rules, design rules |
