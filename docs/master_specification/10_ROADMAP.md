# 10 — ROADMAP

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Active — Living Document (updated as ODs resolve and phases complete) |
| **Last Updated** | 2026-06-26 |
| **Canonical Source** | `ROADMAP_V2.md`, `ROADMAP_AFTER_v1.md`, audit findings |
| **Related Documents** | `09_PHASE_STATUS.md`, `11_CANONICAL_RULES.md`, `OPERATOR_DECISIONS.md`, `AI_MARKETING_AGENT_ROADMAP.md` |

> **Baseline = current implementation** (commit `ae97aa0` + SDD restructuring + PHASE74/75 audit, 2026-06-25). The roadmap begins *after* what already exists.
> No invented features. Every item traces to (a) the Canonical Specification, (b) the existing implementation, or (c) an already-documented project plan (`ROADMAP_V2.md`, `ROADMAP_AFTER_v1.md`).

---

## Prerequisite Gate — PHASE74/75 Complete ✅

Before beginning Phase A or B work:
- ✅ `MASTER_SPECIFICATION_AUDIT_REPORT.md` created (PHASE74)
- ✅ `OPERATOR_DECISIONS.md` created with 17 items (PHASE75)
- ✅ Specification errors fixed (PHASE75)
- ⏳ **OD-1 through OD-10 must be resolved before any pricing, PPF, or LINE implementation**

---

## Baseline (already done — not roadmap)

GYEON Detailer Agent core on Next.js + Supabase: auth, customers, vehicles, estimate wizard (routing for 7 categories, multi-select; STEP1–5 complete; 6 category-specific steps placeholder), PDFs, work orders, completion reports, invoices, payments, calendar, reservations, products, product orders, dealer settings (canonical schema migration 070 created), LINE code (inactive), OCR code (inactive), maintenance reminders, subscriptions, admin console. **Mobile UI complete. PC top screen + device switch delivered. SDD master specification docs created and audited.**

---

## Phase A — Desktop UI Rollout (next, highest priority)

Extend the proven device-switch pattern (Genspark design → implement → verify → commit) to core screens, one at a time:

1. **Estimates** (`/estimates`) — highest value, shown to customers directly.
2. **Customers** (`/customers`)
3. **Vehicles** (`/vehicles`)
4. **Work Orders** (`/work-orders`)
5. **Settings** (`/settings`)
6. Remainder (invoices, payments, products, product-orders, calendar, reservations, line, maintenance).

*Rationale:* The architecture already exists; this adds desktop presentation over the shared engine.

---

## Phase B — Integration Activation

> ⚠️ **Dependency:** Phase B LINE activation requires migration 070 to be applied first (OD-1).

Make code-complete integrations operational by configuration (not new code):

- Provision environment: `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `NEXT_PUBLIC_LIFF_ID`, `CRON_SECRET`.
- **Apply migration 070** (`070_dealer_settings_canonical.sql`) after CTO approval and staging verification.
- Activate **OCR** (車検証 → vehicle fields; mandatory human review always required — see `11_CANONICAL_RULES.md` §7.3).
- Activate **LINE** (LIFF, webhook, push, reminders) and unhide settings group **g5** when LINE credentials are provisioned (OD-13).

---

## Phase C — Specification & Data Reconciliation

> Must complete all 🔴 BLOCKER Operator Decisions (OD-1 through OD-10) before starting.

- **Resolve Operator Decisions**: Update spec docs with confirmed prices, part IDs, grades, rank names.
  - Update `03_BUSINESS_WORKFLOW.md` with confirmed PPF prices, film types, ranks.
  - Update `04_SETTINGS_WORKFLOW.md` §5.6 and §5.7 with confirmed IDs.
  - Update `05_DATABASE_REQUIREMENTS.md` §4.3 with confirmed `ppf_price_tables` values.
- Place canonical JSONs under repo version control (makes SDD enforceable in CI).
- Verify `dealer_settings` covers all **37 canonical settings keys** (`04_SETTINGS_WORKFLOW.md` §7).
- Define OCR field-mapping contract: which 車検証 fields map to which estimate/vehicle fields (OD-16).
- Define vehicle registration image retention/privacy policy (OD-17).
- Resolve canonical stores without a clear table: `past_histories`, `dealer_statements` (業販 monthly statements).
- Reconcile `XL/XXL` body sizes vs PPF `LL+` size-key inconsistency (`03_BUSINESS_WORKFLOW.md` §4.2, OD-15).
- Update `CHANGELOG.md` (PHASE66–73+), fix migration-name references, ratify version per OD-14.

---

## Phase D — Hardening

- Re-introduce **ESLint** (config + script) into the pipeline.
- Silence `/products` build-time dynamic-server log (mark route dynamic).
- Remove duplicate legacy migration (`001_..._PASTE_ONLY.sql`) under additive-safe process.
- Manage **PWA service-worker stale-cache** risk on deploys.
- Evaluate iframe vs. native React for PC screens when they need live data (`08_UI_REQUIREMENTS.md` §2).

---

## Phase E — Documented V2 Scope (existing project plans — not invented)

From the project's already-recorded V2 roadmap (`ROADMAP_V2.md`, `ROADMAP_AFTER_v1.md`):

### v1.1 — Operational Enhancements
| Feature | Description |
|---------|-------------|
| Stripe / card payment | Accept customer card payments; automated invoice payment links |
| Automated invoice generation | Auto-generate and send invoices on work order completion |
| Automated renewal reminder | Email + LINE push at 30d / 7d before renewal; remove manual admin step |
| e-車検証 QR support | Electronic vehicle registration QR code scan (future OCR enhancement) |

### v1.2 — Inventory & Supply Chain
| Feature | Description |
|---------|-------------|
| Inventory management | Track stock levels; low-stock alerts; stock adjustment log |
| Backorder management | Dealer backorders → GYEON Japan HQ → ETA tracking → customer proactive notification |
| Supplier management | Supplier catalog, PO creation, delivery tracking |

### v2.0 — Global Edition
| Feature | Description |
|---------|-------------|
| Internationalization (i18n) | English + Simplified Chinese UI |
| Multi-currency | USD, EUR, AUD, CNY |
| WhatsApp Business API | Customer messaging for non-LINE markets |
| Global architecture | Per-region Supabase projects; GDPR-ready |

### v2.1 — AI & Intelligence
| Feature | Description |
|---------|-------------|
| AI Assistant | Natural language Q&A about customer/vehicle history (Claude API) |
| Smart Scheduling | AI-suggested slots based on demand patterns |
| Maintenance Prediction | ML-based maintenance interval recommendations |
| Revenue Forecasting | Monthly/quarterly projection |
| Customer Churn Prediction | Identify at-risk customers |

### v2.2 — Enterprise & Multi-Store
| Feature | Description |
|---------|-------------|
| Multi-store management | One account for multiple locations |
| Franchise management | Franchisor dashboard for network oversight |
| Staff hierarchy | Regional manager / store manager / technician roles |
| Enterprise SSO | SAML 2.0 / Azure AD integration |
| Public REST API | Enterprise integrations; webhook subscriptions |
| White-label | Custom branding per dealer group |

### v3.0 — Platform
| Feature | Description |
|---------|-------------|
| Customer portal | Self-service (history, invoices, booking, reminders) via LIFF or direct URL |
| Native mobile app | iOS/Android native (beyond PWA) |
| EC integration | Shopify, WooCommerce, Rakuten sync |
| IoT integration | Equipment sensor data linked to work orders |

---

## Phase F — AI Marketing Agent (Future Roadmap)

> **Status:** Approved future feature — deferred until core business platform reaches stable production.
> **Full specification:** `AI_MARKETING_AGENT_ROADMAP.md`
> **Do not implement until the Implementation Gate in that document is satisfied.**

Transform GYEON Detailer Agent from a business management system into an AI business growth platform. The agent automatically converts completed jobs into marketing content — videos, captions, hashtags — and publishes to social platforms with dealer approval.

| Phase | Name | What it delivers |
|-------|------|-----------------|
| PHASE 71 | AI Media Management Foundation | Before/after image management, AI blur (plates + faces), AI quality scoring, dealer branding assets |
| PHASE 72 | AI Video Generator | Auto-create 15s/30s/60s marketing videos from completed jobs (Instagram Reel, TikTok, YouTube Shorts, Facebook Reel, LINE VOOM) |
| PHASE 73 | AI Content Writer | Auto-generate titles, captions, hashtags; **mandatory SEO/MEO/AEO/LLMO/AIO optimization** via Discovery Optimization Engine; local + service + vehicle + GYEON product keywords; FAQ-style answer content; platform metadata |
| PHASE 74 | AI Social Publishing | Draft → dealer approval → scheduled publish to Instagram, Facebook, X, TikTok, YouTube Shorts, LINE VOOM |
| PHASE 75 | AI Marketing Analytics | Reach, views, saves, engagement; **discovery performance analytics** (MEO/SEO/AEO/LLMO/AIO channel tracking); AI recommendations |
| PHASE 76 | AI Growth Agent | Proactive: detect inactive accounts, suggest content, auto-create drafts, trigger campaign ideas |
| PHASE 77 | AI Review Request Agent | After job completion, AI generates polite Japanese LINE review request; links to Google Business Profile, Instagram, dealer website; dealer approval required; strict no-fake-review compliance rules |

**Locked principles:**
- Dealer approval before any publish is the **default**. Automatic publishing is opt-in, never the default.
- License plates and faces are blurred server-side before any image is stored or transmitted.
- All AI API credentials are server-side only — never exposed to the client.
- No synthetic "before" images — ever.
- **All generated content must be optimized for SEO, MEO, AEO, LLMO, and AIO.** This is mandatory, not optional. See `AI_MARKETING_AGENT_ROADMAP.md` §Discovery Optimization.

**Implementation gate:** Core platform stable + Sprint 10 complete + CTO sign-off on media storage architecture + privacy policy update. See `AI_MARKETING_AGENT_ROADMAP.md` §Implementation Gate.

---

## Sequencing Summary

**Prerequisites → A (desktop UI) → B (activate integrations) → C (spec/data reconciliation) → D (hardening) → E (documented V2 scope) → F (AI Marketing Agent — future).**

- Phase A can begin immediately (no operator decisions block desktop UI work).
- Phase B requires OD-1 (migration 070 status) + env var provisioning.
- Phase B LINE activation requires migration 070 to be applied BEFORE LINE settings become usable.
- Phase C requires OD-1 through OD-10 to be resolved first.
- Phase A and Phase B env-var provisioning can proceed in parallel.
- Phase E items each require their own specification pass under SDD before implementation begins.
- Phase F requires core platform stable production + its own specification pass per SDD. See `AI_MARKETING_AGENT_ROADMAP.md`.

---

## Prioritization Criteria

1. **Dealer revenue impact** — features that directly enable billing or upsell
2. **Operational efficiency** — reduce manual admin work
3. **Customer demand** — feedback from UAT dealers
4. **Market expansion** — required for non-Japanese markets
5. **Competitive differentiation** — features not available in competing products
