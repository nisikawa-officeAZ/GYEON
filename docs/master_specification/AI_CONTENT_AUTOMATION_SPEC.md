# AI Content Automation Platform Specification
## GYEON Detailer Agent — Sprint 11I

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Foundation Complete — Dispatch Deferred |
| **Sprint** | 11I |
| **Created** | 2026-06-26 |
| **Last Updated** | 2026-06-26 |
| **Implementation** | `src/lib/content-automation/` |
| **Publishing Status** | Deferred — Phase 11J+ |
| **AI Execution Status** | Deferred — Phase 11J+ |

---

## §1 — Overview

The AI Content Automation Platform is the canonical social publishing subsystem for GYEON Detailer Agent. It orchestrates the complete workflow from a completed work order to dealer-approved social media publishing.

### Purpose

Given a completed work order with approved before/after media:

1. Assemble a `ContentProject` from the work order and its `MediaAsset` objects
2. Plan a visual narrative (`StoryboardPlan`) — AI sequences media in Phase 11J+
3. Draft per-channel captions (`CaptionPlan`) — AI writes in Phase 11J+
4. Optimize content for SEO / MEO / AEO / LLMO / AIO
5. Require dealer approval before any external publishing
6. Lock a `PublishingPlan` and dispatch to social platforms — Phase 11J+

### Key design decisions

- **execution_deferred: true** — No social API calls fire in Sprint 11I. All plans are typed structures describing WHAT WILL happen in Phase 11J+.
- **dispatch_deferred: true** — No content is published. `PublishingPlan.dispatch_deferred` is a literal type.
- **dealer_id always from getCurrentDealer()** — Every server-side consumer scopes by dealer, never by client input.
- **Extends, not duplicates, AI Marketing Platform** — `ContentPublishingDestinationId` maps 1:1 to `MarketingChannelId`. Optimization types re-export from `@/lib/marketing`. No type duplication.
- **Provider-agnostic AI** — Agents referenced by `AIAgentId`, never by provider name.
- **Read-only media** — Content Automation reads `MediaAsset` records but never writes to the media platform.
- **Pure modules** — All Sprint 11I files have no `"use server"`, no async, no DB calls, no external calls.

---

## §2 — Architecture

```
WORK_COMPLETED (CE event)
         │
         ▼
ContentSource
  ├── dealer_id (from getCurrentDealer())
  ├── work_order_id
  ├── approved_media: MediaAsset[]  (consent_verified = true)
  └── service_summary
         │
         ▼
ContentProject (status: "draft")
  ├── ApprovalWorkflow (mode: dealer_approval by default)
  ├── target_channels: MarketingChannelId[]
  └── AutomationPolicy
         │
         ▼
ContentPipelineExecutionPlan
  ├── storyboard_planning   (deferred → marketing_agent Phase 11J+)
  ├── caption_planning      (deferred → marketing_agent Phase 11J+)
  ├── seo_optimization      (available → deterministic from dealer settings)
  ├── meo_optimization      (available → deterministic from dealer settings)
  ├── aeo_optimization      (deferred → marketing_agent Phase 11J+)
  ├── llmo_optimization     (deferred → marketing_agent Phase 11J+)
  ├── aio_optimization      (deferred → marketing_agent Phase 11J+)
  ├── dealer_approval       (available → UI workflow)
  └── publishing_plan       (available → plan locked after approval)
         │
         ▼
PublishingPlan (dispatch_deferred: true)
  └── PublishingTarget[] per channel
         │
         ▼ Phase 11J+
Dispatch → Instagram / GBP / TikTok / YouTube / Facebook / LINE VOOM / Website
         │
         ▼ Phase 11J+
Analytics → impressions, reach, engagement, conversions
```

---

## §3 — Source Files

| File | Phase | Description |
|------|-------|-------------|
| `content-automation-types.ts` | A | Core domain: ContentProject, ContentSource, StoryboardPlan, CaptionPlan, HashtagPlan, PublishingPlan, ApprovalWorkflow, PublishingSchedule, AutomationPolicy |
| `content-pipeline.ts` | B | PIPELINE_STAGE_REGISTRY (14 stages), ContentPipelineExecutionPlan, buildPipelineExecutionPlan |
| `publishing-registry.ts` | C | PUBLISHING_DESTINATION_REGISTRY (9 destinations), helpers for optimization/video/SEO filtering |
| `optimization-model.ts` | D | ContentOptimizationBundle, ContentOptimizationStatus, buildEmptyOptimizationBundle; extends @/lib/marketing types |
| `content-automation-ai.ts` | E | CONTENT_AI_STAGE_REGISTRY (5 AI stages), ContentAIExecutionPlan (deferred), cross-feed builders |
| `approval-workflow.ts` | F | DEFAULT_AUTOMATION_POLICY, evaluateApprovalGate, buildApprovalWorkflow, applyApprovalDecision |
| `index.ts` | — | Public barrel export for `@/lib/content-automation` |

---

## §4 — Content Pipeline

14 stages from trigger to analytics:

| # | Stage | Available | Requires | Agent |
|---|-------|-----------|----------|-------|
| 1 | work_completed | Yes (Sprint 11E) | — | — |
| 2 | media_collection | Yes (Sprint 11I) | Media Platform | — |
| 3 | content_project | Yes (Sprint 11I) | — | — |
| 4 | storyboard_planning | No (Sprint 11J+) | AI | marketing_agent |
| 5 | caption_planning | No (Sprint 11J+) | AI | marketing_agent |
| 6 | seo_optimization | Yes (Sprint 11I) | Dealer settings | — |
| 7 | meo_optimization | Yes (Sprint 11I) | Dealer settings | — |
| 8 | aeo_optimization | No (Sprint 11J+) | AI | marketing_agent |
| 9 | llmo_optimization | No (Sprint 11J+) | AI | marketing_agent |
| 10 | aio_optimization | No (Sprint 11J+) | AI | marketing_agent |
| 11 | dealer_approval | Yes (Sprint 11I) | Human action | — |
| 12 | publishing_plan | Yes (Sprint 11I) | — | — |
| 13 | dispatch | No (Sprint 11J+) | Social APIs | — |
| 14 | analytics | No (Sprint 11J+) | Social APIs | — |

5 stages are available in Sprint 11I. 9 stages are deferred to Phase 11J+.

---

## §5 — Publishing Registry

9 destinations with full capability metadata:

| Destination | Platform | Video | Hashtags | Google-Indexed | Optimization |
|-------------|----------|-------|----------|----------------|--------------|
| instagram_feed | Instagram | Yes | Yes | No | SEO, LLMO, AIO |
| instagram_reels | Instagram | Yes (9:16) | Yes | No | SEO, LLMO, AIO |
| instagram_stories | Instagram | Yes (9:16) | Yes | No | none |
| facebook | Facebook | Yes | No | Partial | SEO, MEO, LLMO, AIO |
| tiktok | TikTok | Yes (9:16) | Yes | No | LLMO, AIO |
| youtube_shorts | YouTube | Yes (9:16, ≤60s) | Yes | Yes | SEO, LLMO, AIO |
| google_business_profile | Google | No | No | Yes | All 5 |
| line_voom | LINE | Yes | No | No | none |
| website_news | Dealer site | No | No | Yes | All 5 |

All destinations have `api_available: false` — social API integration is Phase 11J+.

Google Business Profile and Website News are highest priority for Phase 11J+ — they directly impact local search ranking.

---

## §6 — Optimization Model

Extends `ContentOptimizationProfile` from `@/lib/marketing` (Sprint 11A):

| Target | Applies To | AI Required | Available |
|--------|-----------|-------------|-----------|
| SEO | website_news, GBP, YouTube, Facebook | No | Yes (Sprint 11I — metadata) |
| MEO | GBP, Facebook | No | Yes (Sprint 11I — metadata) |
| AEO | website_news, GBP | Yes | No (Sprint 11J+) |
| LLMO | Instagram, GBP, YouTube, website_news | Yes | No (Sprint 11J+) |
| AIO | all except stories, LINE VOOM | Yes | No (Sprint 11J+) |

`buildEmptyOptimizationBundle(project_id, dealer_id, applicable_targets, now)` creates a blank bundle for deferred computation.

SEO/MEO are populated deterministically from dealer settings (no AI needed).
AEO/LLMO/AIO require `marketing_agent` enrichment in Phase 11J+.

---

## §7 — Approval Workflow

5 approval modes:

| Mode | Description | Blocks Publishing |
|------|-------------|------------------|
| `dealer_approval` | Explicit dealer sign-off before every publish | Until approved |
| `scheduled` | System auto-publishes at scheduled time | No |
| `manual` | Dealer initiates manually — no push | No |
| `draft_only` | Pipeline completes but never dispatches | Always |
| `disabled` | Content automation is fully off | Always |

Default mode: `dealer_approval` — requires explicit dealer action on every ContentProject.

Revision cycle:
- Dealer may reject and request revisions up to `max_revisions` times (default: 3)
- After max revisions, project must be escalated or cancelled
- `applyApprovalDecision(workflow, decision, decided_by, notes, now)` is a pure function — returns a new workflow object without mutating

`DEFAULT_AUTOMATION_POLICY` has `enabled: false` — automation is off until Phase 11J+ social API integration.

---

## §8 — AI Integration

5 AI stages with task configs:

| Stage | Agent | Task | Customer-Facing | Review Required |
|-------|-------|------|-----------------|-----------------|
| storyboard_planning | marketing_agent | image_analysis | No | No |
| caption_planning | marketing_agent | content_writing | Yes | Yes — dealer reviews |
| aeo_optimization | marketing_agent | keyword_extraction | No | No |
| llmo_optimization | marketing_agent | content_writing | No | No |
| aio_optimization | marketing_agent | content_writing | No | No |

Cross-agent feeds:
- `growth_agent` → `marketing_agent`: optimal publish time suggestions (via gateway)

All AI execution is `execution_deferred: true` in Sprint 11I. `buildContentAIExecutionPlan()` returns a typed plan with no inference triggered.

---

## §9 — ContentProject Lifecycle

```
draft
  │ (pipeline runs stages 1–3, optimization computed)
  ▼
planning
  │ (AI stages run — Phase 11J+)
  ▼
ai_review
  │ (AI output ready — sends to dealer)
  ▼
pending_approval
  │ dealer.approve()       dealer.reject()     dealer.request_revision()
  ▼                            ▼                        ▼
approved                   rejected              revision_requested
  │                            │                        │
  ▼                            ▼                (revision submitted)
scheduled / publishing     cancelled              pending_approval
  │
  ▼
published / partially_published
  │
  ▼
archived
```

---

## §10 — Security Constraints

1. **dealer_id**: Always from `getCurrentDealer()` in `ContentSource`, `ContentProject`, `ApprovalWorkflow`, `PublishingPlan`. Never from form input or URL parameters.
2. **Media consent**: `ContentSource.consent_verified` must be `true` before any media is included in a `ContentProject`. Only `MediaAsset` records with `consent_status: "approved"` may be used.
3. **No social API credentials on client**: Social platform tokens (Instagram, TikTok, etc.) are stored server-side only. Never returned to the client. Integration is Phase 11J+.
4. **No schema changes without CTO approval**: Phase 11J+ will require a `content_projects` DB table. CTO approval required before migration.
5. **AI key isolation**: marketing_agent uses the dealer's own AI provider key via the AI Gateway. Office AZ does not pay AI inference costs.

---

## §11 — Relationship to AI Marketing Platform

The Content Automation Platform is a specialization of the AI Marketing Platform:

| Aspect | AI Marketing Platform | Content Automation Platform |
|--------|----------------------|-----------------------------|
| Scope | Generic campaign management | Work-order-triggered social publishing |
| Trigger | Manual / scheduled campaign | WORK_COMPLETED CE event |
| Content | Any marketing asset | Before/after media from work orders |
| Channels | 10 channels | 9 destinations (maps to MarketingChannelId) |
| Optimization | `ContentOptimizationProfile` | Extends same types |
| Approval | `MarketingApprovalStatus` | `ApprovalWorkflow` with revision cycles |

The two platforms share types but are not hierarchically coupled. A dealer may use Content Automation independently of the broader AI Marketing campaign system.

---

## §12 — Phase Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **Sprint 11I** | **Content Automation Platform Foundation** | **Complete (this document)** |
| Sprint 11J | Social API adapters — Instagram, GBP (first two) | Planned |
| Sprint 11J | marketing_agent storyboard + caption pipeline wiring | Planned |
| Sprint 11J | Dealer content review UI component | Planned |
| Sprint 11J | content_projects DB table (CTO approval required) | Planned |
| Sprint 11K | TikTok, YouTube Shorts, LINE VOOM adapters | Planned |
| Sprint 11K | AEO / LLMO / AIO optimization via marketing_agent | Planned |
| Sprint 11L | Analytics collection + growth_agent feed | Planned |
| Sprint 11L | Facebook + website_news CMS publishing | Planned |
