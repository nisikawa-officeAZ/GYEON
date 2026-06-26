# 00 — MASTER SPECIFICATION INDEX
## GYEON Detailer Agent — Canonical Package v1.0

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Specification Freeze Candidate |
| **Last Updated** | 2026-06-26 |
| **Canonical Source** | All 11 core spec documents |
| **Related Documents** | All |

> This index is the **entry point** for all specification work. Read this document first.
> All documents in this package are derived from `gyeon_flow.json` and `gyeon_settings_flow.json`.
> **Rule:** Never modify the canonical JSON files. Never implement without a spec. See `11_CANONICAL_RULES.md`.

---

## 1. Project Overview

**GYEON Detailer Agent** is a cloud-based business management platform for automotive detailing shops that handle GYEON ceramic coating and related services. It converts on-site consultations into structured estimates, then carries that relationship forward through work orders, invoices, maintenance reminders, and repeat visits.

- **Tagline:** 「施工で終わらせない。顧客との関係を、次の来店へ。」
- **Market:** Japan (primary); global expansion planned (v2.0)
- **Architecture:** Next.js 15 + Supabase (PostgreSQL + Auth + Storage) + Vercel
- **Messaging:** LINE LIFF + Messaging API
- **OCR:** OpenAI gpt-4o-mini (vehicle registration)
- **PDF:** @react-pdf/renderer (server-side)
- **Version:** 1.0.0 "Official Release" (post-v1 work ongoing)

---

## 2. Reading Order

### 2a. For a new reader — read in this order

| Step | Document | Purpose |
|------|----------|---------|
| 1 | `00_MASTER_SPECIFICATION_INDEX.md` | This document — orientation |
| 2 | `01_PROJECT_OVERVIEW.md` | Project identity, stack, philosophy |
| 3 | `02_SYSTEM_ARCHITECTURE.md` | System design, security, subscriptions |
| 4 | `03_BUSINESS_WORKFLOW.md` | The estimate flow — core product behavior |
| 5 | `04_SETTINGS_WORKFLOW.md` | Store settings, auth, persistence |
| 6 | `05_DATABASE_REQUIREMENTS.md` | Data model — canonical contracts vs implementation |
| 7 | `11_CANONICAL_RULES.md` | **All binding rules** — read before any implementation work |
| 8 | `06_OCR_REQUIREMENTS.md` | OCR activation requirements |
| 9 | `07_LINE_REQUIREMENTS.md` | LINE/LIFF activation requirements |
| 10 | `08_UI_REQUIREMENTS.md` | Screen and device requirements |
| 11 | `09_PHASE_STATUS.md` | Current implementation status |
| 12 | `10_ROADMAP.md` | What's next |

### 2b. Before implementing a feature

1. Check `11_CANONICAL_RULES.md` for binding constraints.
2. Find the relevant workflow document (03–08).
3. Check `OPERATOR_DECISIONS.md` — confirm all blocking decisions are resolved for that feature.
4. Check `09_PHASE_STATUS.md` — confirm the feature is in the right phase.

### 2c. Before a new design or PR

1. Read `11_CANONICAL_RULES.md` §4 (Incremental Delivery) and §5 (Design Workflow).
2. Confirm Genspark design is approved (see `08_UI_REQUIREMENTS.md` §4).
3. Check `OPERATOR_DECISIONS.md` for any open decisions that touch the feature.

---

## 3. Document Dependencies

```
gyeon_flow.json ──────────────────────────────────────────────────────────────────┐
gyeon_settings_flow.json ─────────────────────────────────────────────────────────┤
                                                                                   │
                         ┌─────────────────────────────────────────────────────────┘
                         │
                         ▼
            01_PROJECT_OVERVIEW.md
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
02_SYSTEM_ARCH   03_BUSINESS_WF   04_SETTINGS_WF
          │              │              │
          └──────┬────────┘              │
                 ▼                      ▼
        05_DATABASE_REQ          04_SETTINGS_WF
                 │
       ┌─────────┼────────┐
       ▼         ▼        ▼
 06_OCR      07_LINE   08_UI
                          │
                          ▼
                   09_PHASE_STATUS
                          │
                          ▼
                    10_ROADMAP

11_CANONICAL_RULES  ──── governs ALL of the above
```

**Key dependency rules:**
- `03_BUSINESS_WORKFLOW.md` → requires `gyeon_flow.json` (canonical prices/IDs still have open ODs)
- `05_DATABASE_REQUIREMENTS.md` → requires migration 070 applied (OD-1)
- `07_LINE_REQUIREMENTS.md` → requires migration 070 applied (OD-1) + LINE credentials
- `06_OCR_REQUIREMENTS.md` → requires `OPENAI_API_KEY` + `STORAGE_BUCKET`
- `10_ROADMAP.md` → updated as ODs are resolved

---

## 4. Canonical Source Hierarchy

```
TIER 1 — HIGHEST AUTHORITY (read-only, never modified)
  gyeon_flow.json          — estimate flow, pricing, screens
  gyeon_settings_flow.json — settings, auth, persistence, LINE

TIER 2 — IMPLEMENTATION CONTRACTS (follow Tier 1; extend where Tier 1 is silent)
  supabase/migrations/     — schema of record for DB
  src/lib/dealer-settings/dealer-settings-types.ts  — TypeScript read contract
  src/lib/dealer-settings/dealer-settings-defaults.ts — fallback values (⚠️ 8 ODs pending)

TIER 3 — THIS PACKAGE (derived; must not contradict Tier 1 or 2)
  /docs/master_specification/  — all files in this folder

TIER 4 — DESIGN AUTHORITY
  Genspark                 — visual authority for UI/UX decisions
```

**When there is a conflict:**
1. Tier 1 beats Tier 2.
2. Tier 2 beats Tier 3.
3. Operator decisions can promote Tier 2 values to Tier 1 authority (by updating the canonical JSON).
4. Tier 4 governs visual decisions only; it cannot override business logic in Tier 1.

---

## 5. Folder Structure

```
~/DealerOS/docs/master_specification/
│
├── 00_MASTER_SPECIFICATION_INDEX.md   ← You are here
├── 01_PROJECT_OVERVIEW.md             ← Project identity, stack, SDD philosophy
├── 02_SYSTEM_ARCHITECTURE.md          ← System design, security, subscriptions
├── 03_BUSINESS_WORKFLOW.md            ← Estimate flow (from gyeon_flow.json)
├── 04_SETTINGS_WORKFLOW.md            ← Settings & auth (from gyeon_settings_flow.json)
├── 05_DATABASE_REQUIREMENTS.md        ← Data model, migrations, DB contracts
├── 06_OCR_REQUIREMENTS.md             ← Vehicle registration OCR
├── 07_LINE_REQUIREMENTS.md            ← LINE / LIFF / messaging
├── 08_UI_REQUIREMENTS.md              ← Screen requirements, device strategy
├── 09_PHASE_STATUS.md                 ← Implementation status (living document)
├── 10_ROADMAP.md                      ← What's next (living document)
├── 11_CANONICAL_RULES.md              ← Binding rules for all work
│
├── MASTER_SPECIFICATION_AUDIT_REPORT.md   ← PHASE74: full audit findings
├── MASTER_SPECIFICATION_CHANGELOG.md      ← PHASE75: per-item resolution log
├── OPERATOR_DECISIONS.md                  ← PHASE75: 17 open business decisions
├── MASTER_SPECIFICATION_V1_READY.md       ← PHASE75: freeze certification
│
├── CANONICAL_PACKAGE.md                   ← PHASE76: how to consume this package
├── PACKAGE_STRUCTURE.md                   ← PHASE76: detailed structure guide
├── VERSION.md                             ← PHASE76: version and approval record
├── CANONICAL_PACKAGE_REPORT.md            ← PHASE76: completion report
│
├── DEALER_RANK_SPEC.md                    ← Sprint 9: rank lockdown spec + Sprint 10 deferred work
├── SPRINT10_APPROVAL_FLOW_SPEC.md         ← Sprint 10: dealer approval flow (decisions locked)
├── SPRINT10A_IMPLEMENTATION_PLAN.md       ← Sprint 10A: full implementation plan
├── AI_GATEWAY_SPEC.md                     ← Sprint 10C: AI provider gateway (5 providers, AES-256-GCM, settings UI)
├── AI_AGENT_FRAMEWORK.md                  ← Sprint 10D–E: Common AI agent architecture (lifecycle, registry, capabilities)
├── AI_MARKETING_AGENT_ROADMAP.md          ← Future: PHASE 71–76 AI marketing + growth (deferred)
├── AI_REPUTATION_AGENT_ROADMAP.md         ← Sprint 10E + Future: PHASE 77–81 AI reputation; foundation implemented
├── CUSTOMER_ENGAGEMENT_SPEC.md            ← Sprint 10F: Customer Engagement Platform — central orchestration layer
│
└── [SUPERSEDED — do not use]
    ├── 02_BUSINESS_WORKFLOW.md
    ├── 03_SETTINGS_WORKFLOW.md
    ├── 04_DATABASE_REQUIREMENTS.md
    ├── 05_OCR_REQUIREMENTS.md
    ├── 06_LINE_REQUIREMENTS.md
    ├── 07_UI_REQUIREMENTS.md
    └── 08_DEVELOPMENT_RULES.md
```

---

## 6. Version History

| Version | Date | Phase | Description |
|---------|------|-------|-------------|
| 0.1 | 2026-06-25 | Pre-PHASE74 | Initial 11-file master spec created (SDD restructuring) |
| 0.9 | 2026-06-25 | PHASE74 | Full audit of all 11 documents (60 findings) |
| 0.95 | 2026-06-25 | PHASE75 | 30 specification errors resolved; 17 operator decisions isolated |
| **1.0** | **2026-06-25** | **PHASE76** | **Canonical Package organized; specification freeze candidate** |
| 1.1 | 2026-06-26 | Sprint 9–10 | Dealer rank lockdown, approval flow spec (decisions locked), Sprint 10A plan |
| 1.2 | 2026-06-26 | Future Roadmap | AI Marketing Agent roadmap added (PHASE 71–77, deferred) |
| 1.3 | 2026-06-26 | Pro+ Feature | LINE Rich Menu Management implemented (Pro+); `line_rich_menu` in AppFeature; uses PHASE70 `line_public_settings` column; no new migration; pure-Node.js PNG generator |
| 1.4 | 2026-06-26 | Architecture | AI Gateway Architecture decision; AI Platform restructured (F1 Marketing, F2 Growth, F3 Reputation); PHASE 77 moved to AI Reputation Agent; `AI_GATEWAY_SPEC.md` + `AI_REPUTATION_AGENT_ROADMAP.md` created |
| 1.5 | 2026-06-26 | Architecture | AI Gateway expanded: OpenRouter added, AI Provider Settings section (connection test, usage limits, cost visibility, per-feature model selection), `"ai_gateway"` as Pro+ AppFeature; product vision updated to AI-powered business OS |
| 1.6 | 2026-06-26 | Sprint 10B | LINE Rich Menu foundation: LIFF/postback action types, button purpose/slot identity, future workflow hints, validation layer, AI Reputation Agent connection point (slot 3 review) |
| 1.7 | 2026-06-26 | Sprint 10C | AI Gateway settings layer: AES-256-GCM key encryption, 5-provider registry with capabilities, dealer AI settings UI (Pro+), save/test/readiness-check server actions, migration proposal for dealer_settings.ai_settings column |
| 1.8 | 2026-06-26 | Sprint 10D | AI Agent Framework: AIAgent interface, AIAgentContext, lifecycle runner, execution policy, 7-agent registry, capability model (16 provider caps + 8 agent caps), AIAgentNotImplementedError pattern for Phase G |
| **1.9** | **2026-06-26** | **Sprint 10E** | **AI Reputation Agent Foundation: ReputationAgent (first active agent), review workflow model, compliance constants, MarketingAgentFeed cross-agent interface, 5 reputation types, run-reputation-task server action** |
| **2.0** | **2026-06-26** | **Sprint 10F** | **Customer Engagement Platform: 10-event system, 7 pre-defined workflows, trigger registry with agent subscribers, context factory, eligibility checks, CUSTOMER_ENGAGEMENT_SPEC.md** |

---

## 7. Approval Status

| Document | Audit Status | Freeze Status | Blocking ODs |
|----------|-------------|---------------|--------------|
| 01_PROJECT_OVERVIEW.md | ✅ Audited | ✅ Frozen | None |
| 02_SYSTEM_ARCHITECTURE.md | ✅ Audited | ⚠️ Minor gaps | None |
| 03_BUSINESS_WORKFLOW.md | ✅ Audited | ⚠️ OD-pending | OD-2,3,4,5,6,7,9,10,15 |
| 04_SETTINGS_WORKFLOW.md | ✅ Audited | ✅ Frozen | None |
| 05_DATABASE_REQUIREMENTS.md | ✅ Audited | ✅ Frozen | OD-1 (apply status) |
| 06_OCR_REQUIREMENTS.md | ✅ Audited | ✅ Frozen | OD-16,17 (future) |
| 07_LINE_REQUIREMENTS.md | ✅ Audited | ✅ Frozen | OD-11 (dual-path) |
| 08_UI_REQUIREMENTS.md | ✅ Audited | ✅ Frozen | None |
| 09_PHASE_STATUS.md | ✅ Audited | ✅ Frozen (living) | OD-14 (version) |
| 10_ROADMAP.md | ✅ Audited | ✅ Frozen (living) | None |
| 11_CANONICAL_RULES.md | ✅ Audited | ✅ Frozen | None |

**Overall package status:** Specification Freeze Candidate — `MASTER_SPECIFICATION_V1_READY.md` for details.

---

*GYEON Detailer Agent | Canonical Package v1.0 | Office AZ | 2026-06-25*
