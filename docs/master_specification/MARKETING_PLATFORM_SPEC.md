# AI Marketing Platform Specification
## Sprint 11A: Marketing as a First-Class Business Domain

| Field | Value |
|-------|-------|
| **Document** | AI Marketing Platform Architecture |
| **Status** | Sprint 11A baseline — architecture complete, no API integrations |
| **Module** | `src/lib/marketing/` |
| **Created** | 2026-06-26 |

> **Design principle:** Marketing is not a feature bolted onto media management.
> Marketing is a first-class platform business domain that orchestrates media assets,
> AI agents, distribution channels, and optimization signals into a publishing pipeline.
> Every future content generation, social publishing, and growth workflow flows through this layer.

---

## 1. Platform Overview

The AI Marketing Platform is the central orchestration layer for:

- **Content creation** — selecting media, generating captions and hashtags, composing assets
- **Approval workflow** — AI review, dealer approval, compliance checking
- **Channel distribution** — publishing to Instagram, TikTok, LINE VOOM, GBP, and 6 other channels
- **Optimization** — SEO, MEO, AEO, LLMO, AIO metadata management
- **Analytics** — performance tracking across all channels
- **Governance** — policy enforcement, consent verification, audit trail

### Platform Architecture

```
MediaAsset (src/lib/media)
       ↓
MarketingAsset (src/lib/marketing)
  source_media: MediaAsset[]
       ↓
Publishing Workflow
  media_selection → asset_creation → ai_review → dealer_approval →
  scheduling → publishing → analytics → retention → audit
       ↓
Channel Registry (10 channels)
  instagram_feed, instagram_reels, instagram_stories, facebook, tiktok,
  youtube_shorts, x, google_business_profile, line_voom, website_news
       ↓
AI Agents
  marketing_agent, seo_agent, reputation_agent, growth_agent
       ↓
Optimization Profile
  SEO + MEO + AEO + LLMO + AIO
```

---

## 2. Marketing Domain Objects (Phase A)

### 2.1 MarketingCampaign

The primary orchestration object. Coordinates multiple `MarketingAsset` objects
published across one or more channels to a defined audience on a defined schedule.

```typescript
interface MarketingCampaign {
  id:            string;
  dealer_id:     string;   // Always from getCurrentDealer()
  name:          string;
  campaign_type: MarketingCampaignType;
  channels:      MarketingChannelId[];
  audience:      MarketingAudience;
  schedule:      MarketingSchedule;
  asset_ids:     string[];
  policy:        MarketingPolicy;
  analytics:     MarketingCampaignAnalytics | null;
  status:        MarketingCampaignStatus;
}
```

Campaign statuses: `draft → pending_approval → approved → scheduled → publishing → published | partially_published | paused | completed | archived | cancelled`

### 2.2 MarketingPolicy

Governance layer for a campaign. Critical defaults:

| Policy Field | Default | Override |
|-------------|---------|---------|
| `requires_dealer_approval` | `true` | Explicit dealer opt-out |
| `requires_media_consent` | `true` | Explicit dealer opt-out |
| `ai_content_allowed` | `false` | Must be explicitly enabled |
| `watermark_required` | `true` | Explicit dealer opt-out |
| `max_posts_per_day` | `3` | Dealer configuration |

### 2.3 MarketingAudience

Defines who receives the content:

- `all_followers`, `existing_customers`, `new_customer_acquisition`
- `vehicle_type_segment`, `service_interest_segment`, `geographic_segment`

Customer segments: `ceramic_coating_customers`, `ppf_customers`, `maintenance_customers`, `detailing_customers`, `high_value_customers`, `lapsed_customers`

---

## 3. Marketing Asset Model (Phase B)

### 3.1 MarketingAsset

Wraps one or more canonical `MediaAsset` objects with publishing context.
Marketing assets MUST use `MediaAsset` objects — raw `DealerMedia` or file paths are not accepted.

```typescript
interface MarketingAsset {
  source_media:        MediaAsset[];    // All must have visibility = marketing_approved
  asset_type:          MarketingAssetType;
  generated_caption:   string | null;
  generated_hashtags:  string[];
  target_channels:     MarketingChannelId[];
  status:              MarketingAssetStatus;
  approval_status:     MarketingApprovalStatus;
  published_to:        MarketingPublishRecord[];
}
```

### 3.2 Asset Types

| Asset Type | Description | Required Media |
|-----------|-------------|----------------|
| `before_after_comparison` | Side-by-side comparison | 2 photos (before + after) |
| `work_progress_photo` | Mid-job documentation | 1+ photos |
| `work_progress_video` | Mid-job video | 1 video |
| `water_beading_video` | Water beading proof | 1 video |
| `completion_photo` | Final result photo | 1+ photos |
| `completion_video` | Final result video | 1 video |
| `ai_generated_image` | AI-produced image | 0+ source photos |
| `ai_generated_video` | AI-produced video | 0+ source media |
| `customer_testimonial` | Customer review + media | 1+ media |
| `review_highlight` | Text highlight | optional media |

### 3.3 Asset Status Flow

```
draft → pending_review → ai_reviewed → pending_approval → approved → scheduled → publishing → published
                    ↘ (failed review) → asset_creation (revise)
                                     ↘ (dealer rejected) → asset_creation (revise)
```

### 3.4 Publishability Gate

`isAssetPublishable(asset)` checks:
1. `status === "approved"`
2. `approval_status === "approved"`
3. At least one `target_channels` entry
4. All `source_media` pass `checkMediaPermission()` — `can_use_for_marketing = true`

---

## 4. Channel Registry (Phase C)

### 4.1 All 10 Channels

| Channel | Platform | Key Specs | Status |
|---------|----------|-----------|--------|
| `instagram_feed` | Instagram | Up to 10 media, 2200 chars, 4:5 ratio | Pending |
| `instagram_reels` | Instagram | Vertical video ≤ 90s, 9:16 | Pending |
| `instagram_stories` | Instagram | Ephemeral, 15s video, 9:16 | Pending |
| `facebook` | Facebook | Up to 10 media, 63,206 chars | Pending |
| `tiktok` | TikTok | Vertical video ≤ 10 min, 9:16 | Pending |
| `youtube_shorts` | YouTube | Vertical video ≤ 60s, 100 char title | Pending |
| `x` | X | Up to 4 media, 280 chars | Pending |
| `google_business_profile` | Google | Posts expire 7 days, 1500 chars | Pending |
| `line_voom` | LINE | Up to 20 media, 1000 chars | Pending |
| `website_news` | Owned | No limits, article format | Pending |

All channels have `available_now = false`. Phase 11B priority: `instagram_feed` + `google_business_profile`.

### 4.2 Registry Queries

- `getChannel(id)` → channel entry with full capability metadata
- `getAvailableChannels()` → currently returns `[]`
- `getChannelsByPlatform(platform)` → all channels on a platform
- `channelSupportsFormat(channelId, format)` → format compatibility check

---

## 5. Publishing Workflow (Phase D)

### 5.1 Nine-Stage Pipeline

```
media_selection → asset_creation → ai_review → dealer_approval →
scheduling → publishing → analytics → retention → audit
```

Each stage produces a `MarketingWorkflowStep` with: `status`, `started_at`, `completed_at`, `actor_id`, `notes`.

### 5.2 State Machine

`WORKFLOW_TRANSITIONS` defines all valid transitions:
- Forward path: stage n → stage n+1
- Correction paths:
  - `ai_review → asset_creation` (quality issues found)
  - `dealer_approval → asset_creation` (dealer rejected)
  - `asset_creation → dealer_approval` (skip AI review if policy allows)

### 5.3 Stage Derivation

`deriveWorkflowStage(asset)` derives the current stage from `status` + `approval_status` + `published_to`:
- `archived` → `audit`
- `published` → `analytics`
- `publishing` → `publishing`
- `scheduled` → `scheduling`
- `approved + approval_status=approved` → `scheduling`
- `ai_reviewed` → `dealer_approval`
- `pending_review` → `ai_review`
- `draft` → `asset_creation`

---

## 6. SEO / MEO / AEO / LLMO / AIO Model (Phase E)

### 6.1 Five Optimization Targets

| Target | Full Name | Search System | Key Signals |
|--------|-----------|---------------|-------------|
| `seo` | Search Engine Optimization | Google organic | Keywords, backlinks, schema.org |
| `meo` | Map Engine Optimization | Google Maps, GBP | NAP consistency, proximity, reviews |
| `aeo` | Answer Engine Optimization | Google Featured Snippets | FAQ schema, concise direct answers |
| `llmo` | LLM Optimization | ChatGPT, Claude, Gemini | Entity clarity, citation-worthy content |
| `aio` | AI Optimization | Perplexity, Google AI Overview | Structured answers, semantic clarity |

### 6.2 ContentOptimizationProfile

Aggregates all five metadata profiles for a single dealer. Populated by `seo_agent` (Phase 11B+).

```typescript
interface ContentOptimizationProfile {
  dealer_id:          string;
  active_targets:     OptimizationTarget[];
  seo:                SeoMetadata;
  meo:                MeoMetadata;
  aeo:                AeoMetadata;
  llmo:               LlmoMetadata;
  aio:                AioMetadata;
  last_optimized_at:  string | null;
}
```

`buildEmptyOptimizationProfile(dealerId)` creates a blank profile with default metadata for initial setup.

---

## 7. AI Compatibility (Phase F)

### 7.1 Agent Marketing Capabilities

```typescript
const AGENT_MARKETING_CAPABILITIES = {
  marketing_agent:  ["caption_generation", "hashtag_generation", "quality_review",
                     "compliance_check", "performance_prediction", "audience_targeting", "channel_adaptation"],
  seo_agent:        ["seo_optimization"],
  reputation_agent: ["quality_review", "compliance_check"],
  growth_agent:     ["performance_prediction", "audience_targeting"],
};
```

### 7.2 MarketingAssetForAgent

Agents receive `MarketingAssetForAgent` — never the full `MarketingAsset`:

```typescript
interface MarketingAssetForAgent {
  id:                   string;
  dealer_id:            string;
  asset_type:           MarketingAssetType;
  approval_status:      MarketingApprovalStatus;
  generated_caption:    string | null;
  generated_hashtags:   string[];
  target_channels:      MarketingChannelId[];
  source_media_for_ai:  MediaForAI[];   // Pre-validated, already gated
}
```

### 7.3 Gate Function

`toMarketingAssetForAgent(asset, agentId, dealerId)` validates:
1. `asset.dealer_id === dealerId` (cross-dealer isolation)
2. Agent is authorized for marketing workflows
3. Asset has an AI-eligible status
4. All source_media pass `checkMarketingAssetMediaPermissions()`
5. All source_media individually pass `checkMediaAICapability("ai_marketing")`

Returns `{ allowed: true, asset: MarketingAssetForAgent }` or `{ allowed: false, reason }`.

---

## 8. Files Changed (Sprint 11A)

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/marketing/marketing-types.ts` | Created | Phase A: all pure domain types |
| `src/lib/marketing/marketing-asset.ts` | Created | Phase B: MarketingAsset + validation |
| `src/lib/marketing/marketing-channel.ts` | Created | Phase C: channel registry (10 channels) |
| `src/lib/marketing/marketing-workflow.ts` | Created | Phase D: 9-stage workflow state machine |
| `src/lib/marketing/marketing-optimization.ts` | Created | Phase E: SEO/MEO/AEO/LLMO/AIO models |
| `src/lib/marketing/marketing-ai.ts` | Created | Phase F: AI agent compatibility layer |
| `src/lib/marketing/index.ts` | Created | Phase G: public API exports |
| `docs/master_specification/MARKETING_PLATFORM_SPEC.md` | Created | Phase G: this document |
| `docs/master_specification/AI_MARKETING_AGENT_ROADMAP.md` | Updated | Phase G: Sprint 11A section added |
| `docs/master_specification/00_MASTER_SPECIFICATION_INDEX.md` | Updated | Phase G: v2.8 |

---

## 9. What Is NOT Implemented (by design)

| Feature | Reason |
|---------|--------|
| Social platform API integrations | Phase 11B+ — per-channel activation |
| AI caption / hashtag generation | Phase 11B — requires AI Gateway + marketing_agent |
| Dealer approval UI | Phase 11B — requires UI design pass |
| `seo_agent` optimization runs | Phase 11B — requires seo_agent implementation |
| `media_assets` table migration | Requires CTO approval |
| Publishing scheduler / cron | Phase 11B+ — requires DB + queue infrastructure |
| Analytics collection | Phase 11B+ — requires channel API read access |

---

## 10. Remaining Work Before Sprint 11B

| Item | Priority | Prerequisite |
|------|----------|--------------|
| Channel adapter interfaces (per-channel publish contract) | High | This sprint |
| `marketing_agent` AI request/response types | High | AI Gateway (Sprint 10C) |
| Dealer approval server action | High | DB schema |
| MarketingCampaign DB schema proposal | Medium | CTO approval process |
| MarketingAsset DB schema proposal | Medium | CTO approval process |
| `ContentOptimizationProfile` DB persistence | Medium | Schema |
| Google Business Profile API scoping | Medium | Developer account |
| Instagram Graph API scoping | Medium | Facebook Business account |

---

*GYEON Detailer Agent | AI Marketing Platform Specification | Office AZ | 2026-06-26*
