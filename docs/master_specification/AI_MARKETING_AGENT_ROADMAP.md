# AI Marketing Agent — Future Roadmap
## GYEON Detailer Agent: From Business Management to AI Growth Platform

| Field | Value |
|-------|-------|
| **Document** | AI Marketing Agent Roadmap |
| **Status** | Approved Future Feature — Deferred |
| **Created** | 2026-06-26 |
| **Priority** | Future Version (after core platform reaches stable production) |
| **Phases** | PHASE 71 – PHASE 76 |
| **Implementation** | Do not implement. Specification and roadmap only. |

---

## Vision

Transform GYEON Detailer Agent from a business management system into an **AI business growth platform**.

The core platform manages operations: estimates, invoices, work orders, customers, vehicles, reminders.
The AI Marketing Agent layer adds a new capability: automatically turning completed work into marketing content — helping dealers grow their business without additional effort.

**Long-term goal:** An autonomous business assistant that helps dealers increase sales, customer retention, and marketing efficiency — not just manage operations.

---

## Principles

1. **Dealer always approves.** Automatic publishing must remain optional. Dealer review and approval before any public post is the default behavior.
2. **Privacy-first.** License plates and faces must be blurred before any image leaves the system.
3. **No extra work for the dealer.** The agent runs automatically from existing job data — dealers do not need to produce content manually.
4. **Platform-specific content.** Each social platform receives content optimized for its format and audience.
5. **AI recommendations, human decisions.** The Growth Agent suggests; the dealer decides.

---

## PHASE 71 — AI Media Management Foundation

**Prerequisite:** Core business platform at stable production.

### 71.1 Job Media Management

| Feature | Description |
|---------|-------------|
| Before / after image uploads | Attach before and after photos to completed work orders |
| Work-in-progress images | Mid-job documentation images linked to work order timeline |
| Video library | Short video clips from job sessions, stored per work order |
| Media gallery per job | Browsable gallery of all media for a specific work order |
| Dealer media library | Global library across all jobs, searchable and filterable |

### 71.2 AI Image Processing

| Feature | Description |
|---------|-------------|
| AI image quality evaluation | Automatic scoring: sharpness, lighting, composition |
| Automatic best-shot selection | AI picks the strongest before/after pair from a batch |
| Automatic license plate blur | Detected plates blurred before any image is stored or published |
| Automatic face blur | Detected faces blurred before any image is stored or published |

**Security rule:** License plate blur and face blur run server-side before any image is stored. No unblurred image with identifiable information may be stored in dealer-accessible storage or transmitted to any external service.

### 71.3 Dealer Branding Assets

| Feature | Description |
|---------|-------------|
| Dealer logo management | Upload and manage shop logo and brand assets |
| Brand color settings | Primary and secondary brand colors for content overlays |
| Brand templates | Pre-designed overlay templates for before/after images |
| Watermark settings | Optional shop name watermark position and opacity |
| Brand preview | Preview how branded content will appear |

### Data model additions (migration required — do not apply now)

```
work_order_media (
  id, work_order_id, dealer_id,
  media_type: 'before' | 'after' | 'wip' | 'video',
  storage_url, thumbnail_url, blurred_url,
  ai_quality_score, ai_selected,
  created_at, updated_at
)

dealer_brand_assets (
  id, dealer_id,
  logo_url, primary_color, secondary_color,
  watermark_enabled, watermark_position, watermark_opacity,
  template_id,
  created_at, updated_at
)
```

---

## PHASE 72 — AI Video Generator

**Prerequisite:** PHASE 71 complete. Media library populated.

### 72.1 Automatic Video Creation

The system automatically creates marketing videos from completed job data — no editing required from the dealer.

| Input | Source |
|-------|--------|
| Before / after images | `work_order_media` |
| Job details | Work order: service category, product used, vehicle |
| Dealer branding | `dealer_brand_assets` |
| Background music | Licensed library (curated by service) |

### 72.2 Output Formats

| Format | Duration | Platform |
|--------|----------|----------|
| Instagram Reel | 15s / 30s | Instagram |
| TikTok | 15s / 30s | TikTok |
| YouTube Shorts | 60s | YouTube |
| Facebook Reel | 30s | Facebook |
| LINE VOOM | 30s | LINE |

All formats generated from the same source media — platform-specific aspect ratio and duration applied automatically.

### 72.3 Video Customization

- Transition style selection (fade, cut, zoom)
- Text overlay position and font
- Brand color theme applied automatically
- Music volume / no-music option
- Preview before publishing

---

## PHASE 73 — AI Content Writer

**Prerequisite:** PHASE 71 complete. Job metadata available.

### 73.1 Generated Content Types

| Content | Description |
|---------|-------------|
| Post title | Attention-grabbing headline for the service |
| Caption | 1–3 paragraph marketing copy for the completed job |
| Hashtags | Platform-appropriate hashtags (quantity tuned per platform) |
| SEO keywords | Keywords for Google Business Profile and web posts |
| Local area keywords | City, neighborhood, or regional keywords for local SEO |
| GYEON product references | Correct product names, grades, and benefits per job |
| Dealer branding voice | Content tone adapted to dealer's business name and style |

### 73.2 Content Context Inputs

The AI writer uses the following job data automatically:

- Service category (coating / PPF / window film / maintenance / carwash / room cleaning / other)
- GYEON product used (from estimate line items)
- Vehicle make and model
- Body size tier
- Dealer name and location (from `dealer_settings`)
- Before/after image quality score (from PHASE 71)

### 73.3 Content Safety

- No AI-generated content contains customer PII
- No AI-generated content references customer names, addresses, or contact details
- Vehicle plate numbers are never included in generated text (blurred in images, omitted in text)

---

## PHASE 74 — AI Social Publishing

**Prerequisite:** PHASE 72 and PHASE 73 complete. Dealer approves generated content.

### 74.1 Supported Platforms

| Platform | Content types |
|---------|---------------|
| Instagram | Images, Reels, Stories |
| Facebook | Images, Reels, Posts |
| X (Twitter) | Images, short-form posts |
| TikTok | Videos |
| YouTube Shorts | Videos |
| LINE VOOM | Videos, images |

### 74.2 Publishing Workflow

```
Job completed
  → AI generates media + content draft
  → Dealer receives notification: "新しいコンテンツが準備できました"
  → Dealer reviews draft in GYEON Detailer Agent
  → Dealer edits title / caption / hashtags (optional)
  → Dealer selects target platforms
  → Dealer approves → scheduled or immediate publish
  → System publishes to connected platform APIs
  → Publish confirmation and URL stored in job record
```

**Default behavior: dealer approval required before any publish.**
Automatic publishing without dealer review must remain an opt-in setting, never the default.

### 74.3 Scheduling Features

| Feature | Description |
|---------|-------------|
| Immediate publish | Post now to selected platforms |
| Scheduled publish | Set a specific date and time |
| AI-recommended timing | AI suggests optimal posting time based on platform engagement data |
| Recurring schedule | Auto-schedule new content at regular intervals |
| Queue management | View, reorder, or cancel scheduled posts |

### 74.4 Platform-Specific Optimization

| Platform | Optimization applied |
|---------|---------------------|
| Instagram | Square / portrait aspect ratio; 30-hashtag limit; geotag support |
| TikTok | Vertical 9:16 video; trending sound suggestions |
| YouTube Shorts | 60s max; chapter markers; description keywords |
| X | 280-character limit; link preview handling |
| LINE VOOM | Japanese text preferred; LINE-specific emoji |

### 74.5 Platform Connection

- OAuth2 connection per platform (dealer connects their account)
- Credentials stored encrypted, server-side only — never in client state
- Revokable at any time from dealer settings
- One dealer account per platform connection

---

## PHASE 75 — AI Marketing Analytics

**Prerequisite:** PHASE 74 active. Published posts accumulating data.

### 75.1 Performance Metrics

| Metric | Source |
|--------|--------|
| Reach | Platform API |
| Views | Platform API |
| Saves / bookmarks | Platform API |
| Likes | Platform API |
| Shares / reposts | Platform API |
| Comments | Platform API |
| Profile visits from post | Platform API |
| Click-through rate | Platform API (if link included) |

### 75.2 Business-Level Analytics

| Insight | Description |
|---------|-------------|
| Popular services | Which service categories generate the most engagement |
| Best-performing images | Which before/after pairs drive the most saves/reach |
| Best posting times | When engagement peaks by platform and day of week |
| Growth trends | Follower growth and reach growth over time |
| Top-performing posts | Ranked list with key metrics |
| Estimated new customer inquiries | Correlation between post reach and new bookings (if booking data available) |

### 75.3 AI Recommendations

After analyzing historical performance, the AI generates actionable recommendations:

- "ボディコーティングの施工動画は土曜の19時前後に投稿すると閲覧数が最も高くなっています"
- "PPF施工のビフォーアフターは他のカテゴリより3倍保存されています"
- "ハッシュタグ #セラミックコーティング を追加したポストはリーチが平均42%増加しています"

Recommendations are displayed in Japanese and tailored to the specific dealer's history.

---

## PHASE 76 — AI Growth Agent

**Prerequisite:** PHASE 71–75 operational. Sufficient historical data accumulated.

### 76.1 Proactive Detection

The AI Growth Agent monitors dealer activity and proactively identifies opportunities:

| Trigger condition | Agent action |
|------------------|-------------|
| SNS account connected but no post in 14 days | Alert + suggest content from recent jobs |
| 3+ completed jobs with no media uploaded | Prompt dealer to add before/after photos |
| High-quality job media available but no post drafted | Auto-generate draft and notify dealer |
| Seasonal opportunity detected (spring, rainy season, summer heat) | Suggest maintenance campaign content |
| Competitor posting frequency increases (if detectable) | Recommend increased posting cadence |
| Customer approaching maintenance reminder date | Suggest re-engagement post (anonymized) |

### 76.2 Automated Content Pipeline

When the dealer opts in to the automated pipeline:

```
Completed work order
  → AI evaluates media quality
  → If quality score ≥ threshold:
      AI generates video (PHASE 72)
      AI writes caption + hashtags (PHASE 73)
      Draft enters approval queue
      Dealer notified: "1件のコンテンツが自動作成されました"
  → Dealer approves or edits → publish
```

**The dealer always has a review step.** Automatic publish without approval is never triggered unless the dealer has explicitly enabled a "fully automated" mode (which requires a separate opt-in confirmation screen).

### 76.3 Campaign Ideas

The AI proactively generates marketing campaign concepts:

| Campaign type | Example |
|--------------|---------|
| Seasonal | "梅雨前のコーティングキャンペーン" — rainy season prep |
| Service spotlight | "PPF施工特集" — feature a service category for a week |
| Before/after series | "施工事例ウィーク" — one job featured per day |
| Customer milestone | "1,000台施工達成" — milestone celebration post |
| Product launch | New GYEON product tied to a recent job |

### 76.4 Growth Dashboard

A dedicated dashboard section showing:

- Content pipeline status (drafts pending, scheduled, published)
- Growth velocity (follower growth rate, reach trend)
- Revenue attribution (estimated job inquiries from social content)
- AI agent activity log (what the agent noticed and suggested)
- Campaign performance summary

---

## Phase Dependency Map

```
PHASE 71 — AI Media Foundation
  (before/after images, AI blur, branding assets)
      │
      ├── PHASE 72 — AI Video Generator
      │       (requires: job media)
      │
      ├── PHASE 73 — AI Content Writer
      │       (requires: job metadata + media quality score)
      │
      └─────────────────────┐
                            ▼
                   PHASE 74 — AI Social Publishing
                        (requires: PHASE 72 + 73)
                            │
                            ▼
                   PHASE 75 — AI Marketing Analytics
                        (requires: published post data)
                            │
                            ▼
                   PHASE 76 — AI Growth Agent
                        (requires: sufficient history)
```

---

## Technology Considerations (Preliminary)

| Capability | Candidate technology |
|------------|---------------------|
| License plate / face blur | OpenAI Vision API or dedicated CV model |
| AI image quality scoring | OpenAI Vision API |
| AI video generation | Runway, Sora API, or similar when available |
| AI content writing | Claude API (claude-sonnet-4-6 or later) |
| Social publishing | Instagram Graph API, Facebook API, TikTok API, YouTube Data API, LINE Messaging API |
| Analytics ingestion | Platform Insights APIs |
| Background processing | Supabase Edge Functions or dedicated job queue |

**All AI API keys must be stored server-side. No AI API credentials may be exposed to the client.**

---

## Deferred — What Is Explicitly Out of Scope

| Feature | Why deferred |
|---------|-------------|
| Fully autonomous posting (no dealer review) | Dealer control is a core principle — may be opt-in later |
| Customer-facing content (posting customer names, reviews) | Privacy; requires separate consent flow |
| Paid advertising management (Meta Ads, Google Ads) | Separate product scope; requires billing integration |
| Competitor analysis (monitoring specific competitor accounts) | Legal and ethical considerations |
| AI-generated before images (synthetic) | Could mislead customers — permanently out of scope |

---

## Implementation Gate

**Do not begin any PHASE 71–76 implementation until:**

1. Core business platform (estimates, invoices, work orders, customers, LINE) is at stable production
2. Sprint 10 (dealer approval flow) is complete
3. CTO sign-off on media storage architecture and AI vendor selection
4. Privacy policy updated for AI image processing and social platform connections
5. Separate product specification pass for each phase under SDD

---

*GYEON Detailer Agent | AI Marketing Agent Roadmap | Office AZ | 2026-06-26*
