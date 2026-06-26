# 02 — SYSTEM ARCHITECTURE
## GYEON Detailer Agent — Architecture Specification

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Canonical |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | `OFFICIAL_RELEASE_NOTES.md`, `SUPABASE_ARCHITECTURE.md`, implementation audit |
| **Related Documents** | `01_PROJECT_OVERVIEW.md`, `05_DATABASE_REQUIREMENTS.md`, `07_LINE_REQUIREMENTS.md`, `11_CANONICAL_RULES.md` |

> **Status:** Canonical. Generated under Specification-Driven Development (SDD).
> **Sources:** `OFFICIAL_RELEASE_NOTES.md`, `SUPABASE_ARCHITECTURE.md`, implementation audit.
> **Rule:** Architecture decisions documented here are binding. Changes require CTO approval.

---

## 1. Architecture Overview

```
Browser / PWA
     │
     ▼
Next.js 15 (App Router, Turbopack)
Vercel Edge Network
     │
     ├── Supabase Auth (JWT, RLS enforcement)
     ├── Supabase Database (PostgreSQL, 65+ migrations)
     ├── Supabase Storage (private bucket, signed URLs)
     └── LINE Messaging API (webhook + LIFF)
          │
          └── OpenAI API (gpt-4o-mini — OCR only)
```

---

## 2. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js App Router | Server components reduce client JS; server actions handle mutations |
| Supabase RLS | Dealer isolation enforced at DB layer — no application-level tenant filter needed |
| `"use server"` / `"use client"` split | Type-only files have no directive; server action files export only async functions |
| Manual migration apply | Prevents accidental schema mutation in production; full audit trail of what was applied |
| No Stripe (v1) | Simplifies launch; manual billing is sufficient for initial dealer count |
| PWA | Dealers can install on iOS/Android without app store submission |
| Private storage bucket | PDFs accessed via signed URLs (60-second expiry) — no direct public access |
| Supabase Auth (not custom token) | Supersedes Canonical JSON's custom AuthToken/`/api/auth/*` scheme; business intent preserved |

---

## 3. Frontend

| Concern | Detail |
|---------|--------|
| Framework | Next.js 15, App Router |
| Language | TypeScript 5 |
| UI library | React 19 |
| Styling | TailwindCSS v4 |
| Build | Turbopack |
| PWA | `@ducanh2912/next-pwa` — service worker, installable on iOS/Android |
| PDF renderer | `@react-pdf/renderer` — server-side PDF generation |
| Device strategy | Separate PC (≥1024px) and Mobile (<1024px) UIs; shared data/business logic engine |

---

## 4. Backend — Supabase

| Concern | Detail |
|---------|--------|
| Database | PostgreSQL with Row-Level Security |
| Auth | Supabase Auth — email/password; JWT issued per session |
| Storage | Private bucket; files accessed only via signed URL (60s expiry) |
| Migrations | Applied manually via Supabase SQL Editor; additive only; numbered sequentially |
| RLS | Enabled on every feature table; `dealer_id` always resolved server-side via `getCurrentDealer()` |

### 4.1 Multi-tenancy model
- Each dealer has one `dealers` record and one `dealer_settings` record (UNIQUE on `dealer_id`).
- All feature data (customers, vehicles, estimates, work orders, etc.) carry a `dealer_id` FK.
- RLS policies enforce that dealers can only read/write their own records.
- `dealer_id` is **never** sourced from client input, URL parameters, or forms — only from `getCurrentDealer()` on the server.

### 4.2 Migration numbering
- Legacy/core range: `001`–`004`
- Feature range: `035`–`070+` (PHASE35 onward)
- Apply strictly in order; gaps are intentional where noted; do not skip.

---

## 5. External Services

| Service | Purpose | Required env vars |
|---------|---------|-------------------|
| OpenAI API | Vehicle registration OCR (`gpt-4o-mini` vision) | `OPENAI_API_KEY` |
| LINE Messaging API | Push messages, customer reminders | `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` |
| LINE LIFF | Customer self-link, self-booking reservation pages | `NEXT_PUBLIC_LIFF_ID` |
| Vercel | Hosting, edge network, environment variables | — |

---

## 6. Deployment

| Stage | Platform | Rule |
|-------|----------|------|
| Production | Vercel (main branch) | Schema changes: staging first; then production |
| Staging | Vercel (preview) | All migrations must pass staging verification before production apply |
| Local | Next.js dev server | `.env.local` — never commit |

**Staging-first rule is mandatory.** Direct production deployment without staging verification is prohibited.

---

## 7. Security Architecture

| Control | Implementation |
|---------|---------------|
| Row Level Security | Enabled on all feature tables; dealers cannot access other dealers' data |
| No DELETE policies | Audit logs, billing records, UAT tables, and staging verification records have no DELETE policy — data is permanently retained |
| Admin guard | `requireAdmin()` on all admin server functions |
| `dealer_id` isolation | Always sourced from `getCurrentDealer()`, never from client |
| Signed URL storage | No direct public access to PDFs or OCR images |
| Middleware protection | All dealer routes check auth + subscription status on every request |
| Audit logging | Every admin action and significant dealer action recorded with timestamp and actor |
| LINE secrets | `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` are server-side only; never exposed to client |
| OpenAI key | Server-side only; never exposed to client |

---

## 8. Subscription Plans

| Plan | Price (v1) | Access |
|------|-----------|--------|
| Trial | ¥0 | Full feature access; trial period enforced by middleware |
| Pro | ¥12,000 / year | Full feature access |
| Pro Plus | Custom quote | Full feature access |

- Plan status enforced by middleware on every request.
- Subscription records in `dealer_subscriptions` / `subscription_plans` (migration 058).
- Commercial billing at v1 is manual (no Stripe): admin creates invoice, dealer pays by bank transfer, admin confirms.

---

## 9. Disaster Recovery

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | < 4 hours |
| RPO (Recovery Point Objective) | < 24 hours (via Supabase PITR) |

**Rollback procedure:**
1. Revert Vercel deployment to previous version (Vercel Dashboard → Promote).
2. If schema rollback needed: restore from pre-migration backup via Supabase PITR.
3. Notify affected dealers.
4. Document incident, fix, re-validate, re-release.

See `docs/DISASTER_RECOVERY.md` for full runbook.

---

## 10. API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/line/webhook` | Receive and process inbound LINE messages; signature validated |
| `GET/POST /api/line/liff/link` | LINE LIFF customer self-link flow |

All other data operations use Next.js Server Actions (`"use server"`), not REST endpoints.
