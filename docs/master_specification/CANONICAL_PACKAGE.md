# CANONICAL PACKAGE
## GYEON Detailer Agent — Consumption Guide

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Specification Freeze Candidate |
| **Last Updated** | 2026-06-25 |
| **Related** | `00_MASTER_SPECIFICATION_INDEX.md`, `11_CANONICAL_RULES.md` |

---

## 1. Purpose

The Canonical Package is the **single authoritative source** for all design, implementation, and specification work on GYEON Detailer Agent. It contains:

- The complete specification of how the product must behave
- The binding rules all work must follow
- The current implementation status
- The roadmap for remaining work
- Open business decisions requiring operator input

**The package is self-contained.** A reader with access to this folder and the two canonical JSON files (`gyeon_flow.json`, `gyeon_settings_flow.json`) has everything needed to:
- Understand the product
- Design new screens
- Implement new features
- Migrate the database
- Activate integrations

---

## 2. How to Use This Package

### Start here
1. Read `00_MASTER_SPECIFICATION_INDEX.md` — orientation, reading order, folder map.
2. Read `01_PROJECT_OVERVIEW.md` — product identity and philosophy.
3. Read `11_CANONICAL_RULES.md` — all binding rules. **This must be read before any implementation.**

### For a specific task

| Task | Primary document | Also read |
|------|-----------------|-----------|
| Build an estimate wizard screen | `03_BUSINESS_WORKFLOW.md` | `11_CANONICAL_RULES.md` §8 |
| Build a settings screen | `04_SETTINGS_WORKFLOW.md` | `11_CANONICAL_RULES.md` §7 |
| Write a DB migration | `05_DATABASE_REQUIREMENTS.md` | `11_CANONICAL_RULES.md` §3 |
| Activate OCR | `06_OCR_REQUIREMENTS.md` | `05_DATABASE_REQUIREMENTS.md` |
| Activate LINE | `07_LINE_REQUIREMENTS.md` | `05_DATABASE_REQUIREMENTS.md`, OD-1 |
| Build a desktop UI screen | `08_UI_REQUIREMENTS.md` | `11_CANONICAL_RULES.md` §4,5 |
| Check what phase to work on next | `09_PHASE_STATUS.md` | `10_ROADMAP.md` |
| Understand a business decision | `OPERATOR_DECISIONS.md` | Referenced spec docs |

---

## 3. How Genspark Should Consume This Package

Genspark is the **visual authority** for UI/UX design. It produces HTML/code designs that are then implemented in `~/DealerOS` by Claude Code.

### What Genspark needs from this package

**Required reading before any design session:**
1. `01_PROJECT_OVERVIEW.md` §3 — Tech stack (know what's available)
2. `08_UI_REQUIREMENTS.md` §2 — Device strategy (PC vs mobile, `lg` breakpoint)
3. `08_UI_REQUIREMENTS.md` §4 — Design language (`#080d1a`, blue gradient, glass cards, `GYEON®`)
4. `08_UI_REQUIREMENTS.md` §3a — 13-screen implementation status (don't design what's already built)

**For each screen design:**
- Check `03_BUSINESS_WORKFLOW.md` for the estimate screens (steps, conditions, fields)
- Check `04_SETTINGS_WORKFLOW.md` for settings screens (groups, drawers)
- Confirm the canonical category IDs match (coating/ppf/window/maintenance/carwash/roomclean/other)

### Design handoff format
- Preferred: HTML/code (directly implementable)
- Acceptable: Screenshot with annotated spec
- Not preferred: URL-only (may become stale)

### Design constraints Genspark must respect
- `#080d1a` background — this is the dark navy luxury brand color
- Blue gradient: `#2563eb → #1d4ed8` (interactive), `#60a5fa` (highlight)
- Glass cards: `rgba(255,255,255,0.04)` + blue-tinted border + `backdrop-blur`
- `GYEON®` wordmark with `letter-spacing`
- Mobile screens are **not modified** when adding desktop screens
- Category-specific wizard steps (PPF, window, etc.) are **placeholder** — design can proceed for these pending OD-2 through OD-7

---

## 4. How Claude Code Should Consume This Package

Claude Code is the **implementation authority** — it reads designs from Genspark and implements them in `~/DealerOS`.

### Before starting any implementation session

1. Read `11_CANONICAL_RULES.md` in full — rules are binding and override defaults.
2. Check `09_PHASE_STATUS.md` — confirm the feature is in scope for the current phase.
3. Check `OPERATOR_DECISIONS.md` — confirm all BLOCKERs for that feature are resolved.
4. Read the relevant workflow doc (03–08) for the feature being built.

### Mandatory constraints (non-negotiable)

From `11_CANONICAL_RULES.md`:
- `dealer_id` always from `getCurrentDealer()` server-side — never from client
- `line_channel_secret` and `line_access_token` never returned to client
- `getDealerSettingsPublic()` must strip LINE secrets before returning
- `ocr_policy.human_confirmation_required` is always `true` — never allow false
- All migrations require CTO approval before execution
- Mobile screens unchanged when adding desktop screens

### Working method (incremental delivery)
1. **One screen at a time** — small change → verify visually → commit → next
2. Verify on both PC (≥1024px) and mobile (<1024px) before sign-off
3. Do not invent features — all work must trace to this spec or roadmap

### Implementation pending (ready to build)
The 6 wizard placeholder steps (PPF, window, maintenance, carwash, roomclean, other) are in scope for Phase A after operator pricing decisions are resolved. See `08_UI_REQUIREMENTS.md` §3a and `03_BUSINESS_WORKFLOW.md` §4.5–4.10.

---

## 5. How Future Developers Should Consume This Package

Future developers joining the project should use this package as the onboarding source of truth.

### Day 1 reading list (in order)
1. `00_MASTER_SPECIFICATION_INDEX.md` — folder map and orientation
2. `01_PROJECT_OVERVIEW.md` — product identity and architecture
3. `02_SYSTEM_ARCHITECTURE.md` — how the system is built
4. `11_CANONICAL_RULES.md` — the rules. **Read this completely before writing any code.**
5. `03_BUSINESS_WORKFLOW.md` — the core product flow
6. `09_PHASE_STATUS.md` — where we are

### Week 1 reading list
- `04_SETTINGS_WORKFLOW.md`
- `05_DATABASE_REQUIREMENTS.md`
- `OPERATOR_DECISIONS.md` (to understand what's still open)
- `10_ROADMAP.md`

### Canonical JSON files
The two JSON files (`gyeon_flow.json`, `gyeon_settings_flow.json`) are the highest authority. Until they are placed under version control (Phase C task), they are stored in `~/Desktop/_gyeon_review/export_staging/CANONICAL_DOCS/`.

**These files are read-only.** Do not overwrite. Do not redesign. Business changes to logic begin by updating the spec and JSON, then the implementation.

### Key architectural decisions to understand
1. **Supabase replaces the original Genspark runtime** (IndexedDB/KV/D1) — see `11_CANONICAL_RULES.md` §6
2. **RLS is enforced on all feature tables** — `dealer_id` always server-side
3. **Migration 070** adds 32 columns to `dealer_settings` — apply status unknown (OD-1)
4. **6 wizard steps are placeholder** — routing works but UI fields not built yet
5. **LINE and OCR are code-complete but inactive** — need env vars to activate

---

## 6. Package Maintenance

### When to update this package
- When any operator decision is resolved → update the affected spec doc + OPERATOR_DECISIONS.md
- When any migration is applied → update `05_DATABASE_REQUIREMENTS.md` §5
- When a new phase completes → update `09_PHASE_STATUS.md`
- When the roadmap changes → update `10_ROADMAP.md`
- When a new canonical rule is added → update `11_CANONICAL_RULES.md`
- When a new future roadmap section is approved → update `10_ROADMAP.md` + add dedicated spec file

### What never changes (frozen)
- Canonical JSON files (`gyeon_flow.json`, `gyeon_settings_flow.json`)
- `11_CANONICAL_RULES.md` security rules (§2)
- `11_CANONICAL_RULES.md` detailer_rank valid values (§7.2)
- `11_CANONICAL_RULES.md` `ocr_policy.human_confirmation_required` always-true rule (§7.3)

### Version bump criteria
| Change | Version action |
|--------|---------------|
| Fix a spec error | No version bump |
| Resolve an operator decision | Minor update (0.x) |
| Complete a phase | Minor update (0.x) |
| Achieve all OD resolutions + CTO approval | Bump to v1.0 official |
| Spec redesign (new canonical JSON) | Major version (v2.0) |

---

### Future Roadmap documents (deferred — do not implement)

| Document | Scope |
|----------|-------|
| `AI_MARKETING_AGENT_ROADMAP.md` | PHASE 71–77: AI media, video generation, content writing, social publishing, analytics, growth agent, review request agent. Includes **mandatory Discovery Optimization requirement** (SEO/MEO/AEO/LLMO/AIO) and **mandatory compliance rules** for review collection (no fake reviews, no incentivized reviews, no pressure). Full spec with principles, phase dependencies, privacy rules, and implementation gate. |

**Mandatory requirement note:** All AI-generated marketing content must be optimized for SEO, MEO (Google Maps/local), AEO (Answer Engine / featured snippets), LLMO (Large Language Model citations), and AIO (Google AI Overviews). This is built into PHASE 73 (AI Content Writer) as a non-optional Discovery Optimization Engine and tracked in PHASE 75 (Analytics) as a dedicated analytics category.

These documents are specification-only. No implementation until the gate conditions in each document are satisfied.

---

*GYEON Detailer Agent | Canonical Package v1.0 | Office AZ | 2026-06-26*
