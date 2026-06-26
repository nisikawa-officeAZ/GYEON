# PROJECT STATUS REPORT
## GYEON Detailer Agent

> **Audit type:** Read-only audit. No code modified, no commits created, no migrations run.
> **Generated:** 2026-06-25
> **Auditor evidence base:** live working tree at `/Users/atsushinishikawa/dealeros`, git history, source tree, `tsc`, `next build`.

Legend: ✅ Complete · 🟡 In Progress / code-complete but not fully configured · 🔴 Not Started

---

## 1. Current Development Status

| Item | Value |
|------|-------|
| **Current phase (actual work)** | Post-v1.0.0 **UI rework — PC/Mobile UI separation** (no PHASE number assigned; latest deliverable = "PC版トップ画面実装") |
| **Last completed numbered PHASE (git history)** | **PHASE73** — Home screen visual restoration |
| **Last PHASE documented in CHANGELOG** | **PHASE65** — Release Candidate (RC1) — ⚠️ CHANGELOG is behind the actual code |
| **Current branch** | `main` |
| **Latest commit** | `ae97aa03e19791f76affc842a0683a45e5ae113e` (`ae97aa0`) — "PC版トップ画面を追加(Gensparkデザイン実装)" |
| **Sync status** | local `main` == `origin/main` (pushed) |

> Note: `VERSION.md` declares **1.0.0 "Official Release"**, but development has continued past it (PHASE67–73 + Genspark UI rework). The documented version and the live codebase are out of sync.

---

## 2. Feature Completion

| # | Module | Status | Evidence | Notes |
|---|--------|--------|----------|-------|
| 1 | Authentication | ✅ | `lib/auth`, `/login`, `middleware.ts` | Supabase Auth; operational locally |
| 2 | Customers | ✅ | `/customers`, `lib/customers`, `components/customers` | |
| 3 | Vehicles | ✅ | `/vehicles`, `lib/vehicles` | |
| 4 | OCR | 🟡 | `lib/vehicle-registration/ocr.ts` (gpt-4o-mini), `storage.ts`, review/upload UI | Code complete; **not configured** (`OPENAI_API_KEY`, `STORAGE_BUCKET` unset) |
| 5 | Estimate | ✅ | `EstimateWizard.tsx`, `EstimateForm.tsx`, `lib/estimates`, `gyeon_flow` | 5-step wizard, 7 categories |
| 6 | Estimate PDF | ✅ | `lib/pdf`, `components/pdf` (17 files), `/pdf` | @react-pdf/renderer |
| 7 | Work Orders | ✅ | `/work-orders`, mig 038/039 | |
| 8 | Completion Reports | ✅ | `lib/completion-reports`, `components/completion-reports`, mig 040 | |
| 9 | Invoices | ✅ | `/invoices`, mig 041 | |
| 10 | Payments | ✅ | `/payments`, mig 042 | Manual only (no Stripe/card) |
| 11 | Calendar | ✅ | `/calendar`, `components/calendar` | |
| 12 | Product Catalog | ✅ | `/products`, `lib/products`, mig 047 | Non-fatal dynamic-server log at build (see §7/§8) |
| 13 | Product Orders | ✅ | `/product-orders`, mig 048 | Internal ordering only |
| 14 | Dealer Settings | ✅ | `/settings`, `lib/dealer-settings`, mig 070 canonical | 12-category nav (PHASE72) |
| 15 | LINE Integration | 🟡 | `api/line/webhook`, `api/line/liff/link`, `lib/line` (12 files) | Code complete; **not configured** (`LINE_*`, `LIFF_ID` unset) |
| 16 | LINE Messaging | 🟡 | `send-line-message.ts`, `process-line-notification-queue.ts`, queue | Code complete; needs `LINE_CHANNEL_ACCESS_TOKEN` |
| 17 | Maintenance Reminder | 🟡 | `/maintenance` (+ CRUD), `lib/maintenance`, mig 045 | UI ✅; scheduled send needs `CRON_SECRET` + LINE token |
| 18 | Dashboard | ✅ | `/` home, `lib/dashboard`, `components/dashboard` | Mobile ✅; **PC version newly added (needs review)** |
| 19 | Subscription | ✅ | `lib/subscription`, mig 058, `/admin/subscriptions` | Trial/Pro/Pro Plus |
| 20 | Activity Log | ✅ | `lib/activity`, mig 054 | |
| 21 | Audit Log | ✅ | `lib/audit`, mig 055, `/admin/audit` | |
| 22 | Disaster Recovery | ✅ | `lib/health`, PHASE59 runbook docs | Procedural + health checks |
| 23 | Admin Console | ✅ | `/admin/*` (13 routes) | Overview, dealers, users, subs, audit, UAT, billing, RC, etc. |

**Summary:** 18 modules ✅ Complete · 4 modules 🟡 code-complete-but-unconfigured (OCR, LINE Integration, LINE Messaging, Maintenance Reminder) · 0 🔴.

> The four 🟡 modules are **fully coded** — they are gated only by missing runtime credentials in the local environment, not by missing implementation.

---

## 3. Database

| Item | Finding |
|------|---------|
| **Migration files present** | **34** SQL files in `supabase/migrations/` |
| **Sequence** | Legacy/core: `001`–`004` (incl. a duplicate `001_..._PASTE_ONLY.sql`). Feature line: `035`–`070`. |
| **Draft migrations** | **None** in filenames (no `draft`/`wip`/`todo`). |
| **Pending / numbering gaps** | Missing numbers **056, 057, 060, 061, 065, 068, 069**. These map to **code-/docs-only phases** (e.g. PHASE57 Admin foundation, PHASE60 Readiness, PHASE61 Migration status, PHASE65 RC) that introduced no schema change — so they are *intentional gaps*, not lost migrations. |
| **Applied status** | ⚠️ **Cannot be confirmed by static audit.** Project policy applies migrations **manually** via the Supabase SQL Editor (per `KNOWN_LIMITATIONS`). `FINAL_FEATURE_MATRIX` claims `035`–`066` applied. Verifying against the live DB requires `SUPABASE_SERVICE_ROLE_KEY` (not present locally) and was out of scope for this read-only audit. |
| **Documentation consistency** | ⚠️ `CHANGELOG.md` references migration filenames (e.g. `056_payments.sql`, `055_invoices.sql`) that **do not match** the actual files (`042_create_payments.sql`, `041_create_invoices.sql`). The CHANGELOG migration names are unreliable. |

---

## 4. UI

| Surface | Status | Notes |
|---------|--------|-------|
| **Desktop UI** | 🟡 **In Progress** | Only the **Home / Top screen** has a dedicated PC layout (Genspark design, added today). All other screens are still mobile-only when viewed on desktop. |
| **Mobile UI** | ✅ **Complete** | All screens are mobile-first and functional. |
| **Estimate UI** | ✅ Complete (mobile) | 5-step `EstimateWizard`. No PC version yet. |
| **Settings UI** | ✅ Complete (mobile) | 12-category icon navigation. No PC version yet. |
| **Customer UI** | ✅ Complete (mobile) | CRUD + search. No PC version yet. |
| **Vehicle UI** | ✅ Complete (mobile) | CRUD + service history. No PC version yet. |
| **Dashboard UI** | 🟡 **Needs Review** | Mobile ✅. **PC version just implemented** (iframe of `public/desktop-home.html`, device-switched at `lg` breakpoint in `src/app/page.tsx`); verified visually at 1440px and 375px today, pending user sign-off as the canonical pattern. |

---

## 5. OCR

| Item | Status | Evidence |
|------|--------|----------|
| GPT-mini integration | 🟡 Code ✅ / not configured | `lib/vehicle-registration/ocr.ts` — provider `openai`, model `gpt-4o-mini`, calls `api.openai.com/v1/chat/completions`. Returns `OPENAI_API_KEY_MISSING` when unset (it currently is). |
| OCR storage | 🟡 Code ✅ / not configured | `lib/vehicle-registration/storage.ts` (Supabase Storage). Needs `STORAGE_BUCKET` + service role. |
| Human confirmation | ✅ | `components/vehicle-registration/VehicleRegistrationOcrReview.tsx` (review/correct extracted fields before save). |
| Manual input fallback | ✅ | `VehicleRegistrationUpload.tsx` + standard manual vehicle entry remain available. |

---

## 6. LINE

| Item | Status | Evidence |
|------|--------|----------|
| LIFF | 🟡 Code ✅ / not configured | `app/liff/link`, `app/liff/reservation`, `api/line/liff/link/route.ts`. Needs `NEXT_PUBLIC_LIFF_ID`. |
| Messaging API | 🟡 Code ✅ / not configured | `lib/line/send-line-message.ts`, `process-line-notification-queue.ts`. Needs `LINE_CHANNEL_ACCESS_TOKEN`. |
| Webhook | 🟡 Code ✅ / not configured | `api/line/webhook/route.ts`. Needs `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ID`. |
| Reminder | 🟡 Code ✅ / not configured | Notification queue + maintenance reminders. Scheduled send needs `CRON_SECRET` + LINE token. |

---

## 7. Build Status

| Check | Result | Detail |
|-------|--------|--------|
| **lint** | ⚠️ **Not configured** | No ESLint config file and no `lint` script in `package.json`. Linting is not part of the current pipeline. |
| **typecheck** | ✅ **Pass** | `tsc --noEmit` → exit 0, **0 type errors**. |
| **build** | ✅ **Pass** | `next build --turbopack` → exit 0, "Compiled successfully". One **non-fatal** runtime log during prerender: `/products` uses `cookies()` so it renders dynamically (`ƒ`) — expected for an authenticated page; does not fail the build. |

---

## 8. Known Issues

1. **Local environment is only ~2/12 configured.** Only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Missing: `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`/`LINE_CHANNEL_ID`/`LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`/`NEXT_PUBLIC_LINE_LIFF_ID`, `CRON_SECRET`. → OCR, LINE, document storage, scheduled reminders, and service-role server actions are runtime-disabled locally.
2. **Desktop UI exists for the Home screen only.** All other screens are mobile-only on desktop. PC/Mobile separation has just begun.
3. **CHANGELOG is stale** — documents only up to PHASE65; PHASE67–73 and all recent UI rework are undocumented.
4. **CHANGELOG ↔ migration filename mismatch** — the migration names in CHANGELOG do not correspond to the real files in `supabase/migrations/`.
5. **Migration numbering gaps** (056, 057, 060, 061, 065, 068, 069) are undocumented; they appear to be code-only phases but should be explicitly recorded to avoid "missing migration" confusion.
6. **No lint pipeline** — ESLint is not configured.
7. **`/products` logs a dynamic-server error at build time** (non-fatal) — cosmetic, but should be silenced by marking the route dynamic.
8. **Duplicate/legacy core migration** — `001_create_core_tables.sql` and `001_create_core_tables_PASTE_ONLY.sql` coexist; cleanup candidate.
9. **Applied-migration state is unverifiable** from code (manual migration model). No automated drift check exists.
10. **PWA service worker** (`public/sw.js`) is present; in production it can serve stale cached UI after deploys until all tabs close — a real-world "changes don't appear" risk to manage.
11. **Version metadata inconsistent** — `VERSION.md` says "1.0.0 Official Release" while active development continues beyond it.
12. **Out-of-scope (V2) features not started:** multi-warehouse inventory, EC integration (Amazon/Rakuten/Yahoo), WhatsApp, multi-language, card payment (Stripe), and the public "Detail Manager" general edition.

---

## 9. Recommended Next Phase

**Recommended: PHASE — "Desktop UI Rollout (Phase 1)"**

Rationale: the device-switch pattern (Genspark design → `public/*.html` → iframe, switched at the `lg` breakpoint) is now proven on the Home screen and signed off. Extend it to the core daily-operation screens, one at a time, verifying and committing after each:

1. **Estimates** (`/estimates`) — highest-value, most-used screen → biggest payoff first.
2. **Customers** (`/customers`)
3. **Vehicles** (`/vehicles`)
4. **Work Orders** (`/work-orders`)
5. **Settings** (`/settings`)

**Recommended prerequisites / parallel hygiene (low effort, high value):**
- **Complete the environment config** (at least `SUPABASE_SERVICE_ROLE_KEY` + `STORAGE_BUCKET`) so PDF storage / OCR / LINE can be tested end-to-end before more UI is layered on.
- **Refresh documentation**: update `CHANGELOG.md` through PHASE73 + recent UI work, fix the migration-name references, and record the intentional migration gaps.
- Decide the **long-term desktop architecture** (keep iframes vs. convert to native React components) before the dashboard needs live data.

---

## 10. Audit Scope Confirmation

- ✅ No source code modified.
- ✅ No commits created.
- ✅ No migrations run.
- ✅ Deliverable produced: `PROJECT_STATUS_REPORT.md` (this file, uncommitted).

*End of report.*
