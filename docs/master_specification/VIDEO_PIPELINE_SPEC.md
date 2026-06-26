# AI Video Pipeline Specification
## Sprint 11B: Video as a First-Class Business Domain

| Field | Value |
|-------|-------|
| **Document** | AI Video Pipeline Architecture |
| **Status** | Sprint 11B baseline — architecture complete, no provider integration |
| **Module** | `src/lib/video/` |
| **Created** | 2026-06-26 |

> **Design principle:** The AI Video Pipeline is not a file conversion tool.
> It is a first-class platform business domain that orchestrates canonical
> MediaAsset objects into a sequenced narrative, submits that narrative to
> provider-agnostic AI generation, and routes the output to publishing destinations
> with full privacy governance and audit trail.
>
> Every future AI-generated marketing video flows through this layer.

---

## 1. Platform Overview

The AI Video Pipeline is the central orchestration layer for:

- **Source selection** — choosing which MediaAsset objects contribute to a video
- **Storyboard composition** — sequencing scenes with durations and transitions
- **AI generation** — submitting to provider-agnostic AI for video synthesis
- **Privacy governance** — consent checks, face blurring, license plate blurring
- **Publishing** — routing generated video to 9 platform-specific profiles
- **Retention** — tracking downloads and scheduling deletion

### Platform Architecture

```
MediaAsset (src/lib/media)
  ↓ wrapped by VideoSource (Phase B)
  ↓
VideoProject (Phase A)
  sources: VideoSource[]
  timeline: VideoTimeline | null
  output: VideoOutput | null
  policy: VideoPolicy
  retention: VideoRetention
  ↓
VideoTimeline (Phase C)
  scenes: VideoScene[]
  total_duration_seconds: number
  aspect_ratio: VideoAspectRatio
  ↓
VIDEO_AI_PROVIDER_REGISTRY (Phase E) — 8 providers
  ↓ via AI Gateway (AI_GATEWAY_SPEC.md)
  ↓
VideoOutput (Phase A) — generated video artifact
  ↓
VIDEO_PUBLISHING_PROFILE_REGISTRY (Phase D) — 9 destinations
  ↓
VideoDownloadRecord / VideoDeletionRecord (Phase F) — audit trail
```

---

## 2. Core Domain Objects (Phase A)

### 2.1 VideoProject

The primary orchestration object. All pipeline state flows through VideoProject.

```typescript
interface VideoProject {
  id:                  string;
  dealer_id:           string;   // Always from getCurrentDealer()
  name:                string;
  status:              VideoProjectStatus;
  template_id:         string | null;
  sources:             VideoSource[];
  timeline:            VideoTimeline | null;
  output:              VideoOutput | null;
  policy:              VideoPolicy;
  retention:           VideoRetention;
  publishing_profiles: VideoPublishingProfileId[];
  analytics:           VideoAnalytics | null;
  ai_provider_id:      VideoAIProviderId | null;
  ai_request_id:       string | null;
  marketing_asset_id:  string | null;
}
```

### 2.2 VideoProjectStatus — 13 stages

```
draft → pending_storyboard → storyboard_ready → pending_generation → generating →
generation_complete → pending_approval → approved → publishing → published
                                                           ↘ failed
                                                           ↘ archived → deleted
```

### 2.3 VideoPolicy — governance defaults

| Policy Field | Default | Override |
|-------------|---------|---------|
| `requires_dealer_approval` | `true` | Explicit opt-out per project |
| `requires_media_consent` | `true` | Explicit opt-out per project |
| `ai_content_allowed` | `false` | Must be explicitly enabled |
| `watermark_required` | `true` | Explicit opt-out per project |
| `max_generation_attempts` | `3` | Dealer configuration |

### 2.4 VideoOutput

Populated once generation is complete. file_path and file_url are null until then.
The generated video is subsequently wrapped into a `MediaAsset` in the media domain
(ai_generated = true) for lifecycle and consent tracking.

### 2.5 VideoTemplate

Preset scene compositions. Three presets defined in PRESET_VIDEO_TEMPLATES:
- `before_after_30s` — 6-scene 30s reel for Instagram/TikTok
- `water_beading_15s` — 3-scene 15s story for high-impact water beading proof
- `completion_showcase_60s` — 8-scene 60s full reel for YouTube Shorts

All presets have `available_now = false` until generation providers are integrated.

---

## 3. Source Media Model (Phase B)

### 3.1 VideoSource

Wraps a canonical MediaAsset with pipeline-specific context.

```typescript
interface VideoSource {
  media_asset:             MediaAsset;      // Never a raw file path
  source_type:             VideoSourceType; // What this media represents
  role_in_project:         VideoSourceRole; // How it's used visually
  display_duration_seconds: number | null;
  transition_after:        VideoTransition;
  ai_scene_description:    string | null;  // Fed to AI generation prompt
  order:                   number;
}
```

### 3.2 The 12 VideoSourceTypes

| Source Type | Description | Typical Scene |
|------------|-------------|---------------|
| `before_photo` | Vehicle before service | `vehicle_before` |
| `after_photo` | Vehicle after service | `vehicle_after` |
| `work_progress_photo` | Static photo during work | `work_process` |
| `work_progress_video` | Video clip during work | `work_process` |
| `water_beading_video` | Water beading test | `water_beading` |
| `completion_photo` | Final high-quality photo | `vehicle_after` |
| `completion_video` | Final cinematic video | `vehicle_after` |
| `dealer_logo` | Dealer brand mark | `intro`, `outro`, `branding` |
| `customer_review` | Review text or testimonial | `customer_review` |
| `product_photo` | Product (coating/PPF) | `product_highlight` |
| `product_video` | Product demonstration | `product_highlight` |
| `ai_generated_media` | Previously AI-generated | Any scene |

### 3.3 Source Permission Gate

Before any source can be used in video generation:
1. `isSourcePermittedForMarketing(source)` — checks `checkMediaPermission().can_use_for_marketing`
2. `sourceRequiresConsent(source)` — customer_review always requires consent
3. `checkMediaAICapability({ capability: "ai_marketing", ... })` — AI access gate

All sources must pass all three checks before `toVideoProjectForAI()` succeeds.

---

## 4. Timeline Model (Phase C)

### 4.1 The 10 VideoSceneTypes

| Scene Type | Narrative Purpose | Typical Duration |
|-----------|-------------------|-----------------|
| `intro` | Opening hook — brand identity | 2–3s |
| `branding` | Dealer logo, name, tagline | 2–4s |
| `vehicle_before` | Vehicle condition before service | 3–8s |
| `work_process` | Active work — coating, PPF, etc. | 5–15s |
| `product_highlight` | Product used in service | 3–7s |
| `water_beading` | Water beading test — signature proof | 5–12s |
| `vehicle_after` | Finished vehicle — reveal | 5–12s |
| `customer_review` | Customer testimonial excerpt | 4–10s |
| `call_to_action` | CTA — contact info, booking | 3–7s |
| `outro` | Closing — logo, contact, music fade | 2–3s |

### 4.2 VideoTimeline

```typescript
interface VideoTimeline {
  project_id:             string;
  scenes:                 VideoScene[];
  total_duration_seconds: number;   // Must match sum of scene durations
  aspect_ratio:           VideoAspectRatio;
  frame_rate:             VideoFrameRate;
  audio_config:           VideoAudioConfig;
}
```

`validateTimeline()` checks: non-empty, unique orders, positive durations,
each scene has at least one source, and total_duration_seconds is in sync.

---

## 5. Publishing Profiles (Phase D)

### 5.1 All 9 Profiles

| Profile | Platform | Aspect | Target | Max | Status |
|---------|----------|--------|--------|-----|--------|
| `instagram_reels` | Instagram | 9:16 | 30s | 90s | Pending |
| `instagram_stories` | Instagram | 9:16 | 10s | 15s | Pending |
| `tiktok` | TikTok | 9:16 | 45s | 600s | Pending |
| `youtube_shorts` | YouTube | 9:16 | 40s | 60s | Pending |
| `facebook_reels` | Facebook | 9:16 | 30s | 90s | Pending |
| `google_business_profile` | Google | 16:9 | 20s | 30s | Pending |
| `line_voom` | LINE | 1:1 | 30s | 300s | Pending |
| `website_hero` | Owned | 16:9 | 45s | 120s | Pending |
| `dealer_website_gallery` | Owned | 4:3 | 60s | 300s | Pending |

All profiles have `available_now = false`. Publishing infrastructure requires Phase 11C+.

### 5.2 Policy Fields Per Profile

Each profile defines:
- `subtitle_policy` — required / recommended / optional / not_applicable
- `logo_policy` — required / optional / not_recommended
- `watermark_policy` — required / optional / not_allowed
- `thumbnail_policy` — required / auto_first_frame / recommended / not_applicable

Priority for Phase 11C: `google_business_profile` (highest impact for MEO) + `instagram_reels`.

---

## 6. AI Provider Compatibility (Phase E)

### 6.1 Provider Registry

| Provider | Label | Capabilities | Max Duration | Status |
|---------|-------|--------------|-------------|--------|
| `anthropic` | Claude | storyboard, captions, quality review | N/A (text) | Pending |
| `openai_sora` | OpenAI Sora | video generation | 60s | Pending |
| `google_veo` | Google Veo 2 | video generation | 60s | Pending |
| `runway_gen3` | Runway Gen-3 | video generation, scene assembly | 10s | Pending |
| `pika_labs` | Pika 2.0 | video generation, scene assembly | 15s | Pending |
| `kling_ai` | Kling AI | video generation, scene assembly | 30s | Pending |
| `azure_openai` | Azure OpenAI | storyboard, captions | N/A (text) | Pending |
| `openrouter` | OpenRouter | storyboard, captions | N/A (text) | Pending |

All providers have `available_now = false`. Integration requires CTO approval.

### 6.2 AI Access Gate

`toVideoProjectForAI(project, dealerId, providerId, capability)` validates:
1. `project.dealer_id === dealerId` — cross-dealer isolation
2. `policy.ai_content_allowed = true` — explicit opt-in required
3. Sources list is non-empty
4. All sources pass `allSourcesPermittedForMarketing()` gate
5. All sources pass `checkMediaAICapability("ai_marketing")` gate
6. Provider exists in registry and supports the requested capability

Returns `{ allowed: true, project: VideoProjectForAI }` or `{ allowed: false, reason }`.

`VideoProjectForAI` strips all raw MediaAsset file URLs — replaces with `MediaForAI[]`
(the same pre-validated projection used by marketing_agent and growth_agent).

### 6.3 Agent Video Capabilities

```typescript
const AGENT_VIDEO_CAPABILITIES = {
  marketing_agent: [
    "submit_storyboard_request", "submit_generation_request",
    "review_generated_video", "generate_captions", "select_thumbnail",
  ],
  growth_agent: ["submit_storyboard_request", "select_thumbnail"],
};
```

---

## 7. Customer Privacy (Phase F)

### 7.1 VideoConsentRequirement (strictness order)

```
ai_excluded          — Blocks all AI generation for this project
consent_required     — Explicit written consent before any external use
internal_only        — Internal records only; cannot be published
marketing_approved   — Full marketing use permitted
not_required         — No consent needed (dealer logo, stock media)
```

`resolveStrictestConsentRequirement()` derives the project-level requirement
from all source media requirements (most restrictive wins).

### 7.2 VideoPrivacyConfig

```typescript
interface VideoPrivacyConfig {
  output_consent_requirement: VideoConsentRequirement;
  source_consent_requirement: VideoConsentRequirement;
  faces_policy:               VideoFacesPolicy;          // blur_all (default) | blur_non_consenting | allow_all
  license_plate_policy:       VideoLicensePlatePolicy;   // blur_all (default) | allow_all
  ai_training_excluded:       boolean;                   // true by default
  retention:                  VideoRetention;
}
```

### 7.3 Defaults

| Config Field | Default | Reason |
|-------------|---------|--------|
| `license_plate_policy` | `blur_all` | Privacy and legal risk reduction |
| `faces_policy` | `blur_non_consenting` | Balance between natural video and privacy |
| `ai_training_excluded` | `true` | Opt-out-by-default for AI model training |
| `source_consent_requirement` | `consent_required` | Customer media always requires consent |
| `output_consent_requirement` | `marketing_approved` | Output is intended for marketing |

### 7.4 Download Tracking

`VideoDownloadRecord` — immutable audit record per download. Created when dealer
downloads the generated video. file_path_hash = SHA-256 of output path (never raw path).

Phase F creates the record. Phase 11C+ triggers deletion after retention period expires.

---

## 8. Future AI Workflow (Phase G — not yet executed)

This workflow is fully documented. No stage runs at runtime in Sprint 11B.

### Step-by-Step Future Workflow

```
STEP 1 — Source Selection
  Dealer (or growth_agent) selects MediaAsset objects from completed work orders.
  Each MediaAsset must have visibility = marketing_approved and consent_status = approved.
  VideoSource objects are created wrapping each MediaAsset.

STEP 2 — VideoProject Creation
  VideoProject is created with status = "draft".
  dealer_id always injected from getCurrentDealer() in the server action.
  policy.requires_dealer_approval = true, ai_content_allowed must be explicitly set.

STEP 3 — Storyboard Generation (AI Gateway → Anthropic Claude)
  status → "pending_storyboard"
  toVideoProjectForAI() gate validates consent, permissions, policy.
  VideoProjectForStoryboard is sent to Claude via AI Gateway.
  Claude returns a storyboard: scene sequence, descriptions, suggested durations.
  VideoTimeline is constructed from the storyboard.
  status → "storyboard_ready"

STEP 4 — Dealer Storyboard Review
  Dealer reviews scene sequence and durations.
  Dealer may edit ai_scene_description on any VideoSource.
  Dealer approves or requests revision.

STEP 5 — Video Generation (AI Gateway → Runway / Kling / Pika)
  status → "pending_generation" → "generating"
  toVideoProjectForAI() gate runs again with the approved timeline.
  VideoAIRequest sent to AI Gateway with capability = "video_generation".
  AI provider generates video clips per scene.
  Clips assembled into final output video.
  VideoOutput.file_path set. status → "generation_complete" → "pending_approval"

STEP 6 — Dealer Video Review
  Dealer watches generated video.
  status → "pending_approval"
  Dealer may approve or reject (with rejection reason).
  If rejected: return to step 3 or 5 with feedback.
  If approved: status → "approved"

STEP 7 — Publishing
  status → "publishing"
  For each VideoPublishingProfileId in publishing_profiles:
    Validate duration, aspect ratio for that profile.
    Submit to platform-specific publishing adapter.
  status → "published" (or "failed" if any profile fails)
  VideoAnalytics collection begins after publishing.

STEP 8 — Retention and Deletion
  VideoDownloadRecord created on each dealer download.
  After retention_days elapsed (or delete_after_publishing = true):
    VideoDeletionRecord created (scheduled_for set).
    Phase 11C+ scheduled job reads record and deletes file.
    Generated video MediaAsset status → "soft_deleted"
  status → "archived" → "deleted"
```

---

## 9. Files Created (Sprint 11B)

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/video/video-types.ts` | Created | Phase A: all pure domain types + default constants + PRESET_VIDEO_TEMPLATES |
| `src/lib/video/video-source.ts` | Created | Phase B: VideoSource, source gates, source helpers |
| `src/lib/video/video-timeline.ts` | Created | Phase C: VideoScene, VideoTimeline, validateTimeline() |
| `src/lib/video/video-project.ts` | Created | Phase A: VideoProject full domain object, storyboard projection |
| `src/lib/video/video-publishing.ts` | Created | Phase D: VIDEO_PUBLISHING_PROFILE_REGISTRY (9 profiles) |
| `src/lib/video/video-ai.ts` | Created | Phase E: VIDEO_AI_PROVIDER_REGISTRY (8 providers), AI gate |
| `src/lib/video/video-privacy.ts` | Created | Phase F: VideoPrivacyConfig, download+deletion records |
| `src/lib/video/index.ts` | Created | Phase G: public API exports |
| `docs/master_specification/VIDEO_PIPELINE_SPEC.md` | Created | Phase H: this document |
| `docs/master_specification/AI_MARKETING_AGENT_ROADMAP.md` | Updated | Phase H: Sprint 11B section added |
| `docs/master_specification/00_MASTER_SPECIFICATION_INDEX.md` | Updated | Phase H: v2.9 |

---

## 10. What Is NOT Implemented (by design)

| Feature | Reason |
|---------|--------|
| Video generation provider SDKs | Phase 11C+ — requires CTO approval and API credentials |
| Dealer storyboard review UI | Phase 11C — requires UI design pass |
| Dealer video approval UI | Phase 11C — requires UI design pass |
| Publishing adapters (any channel) | Phase 11C — per-profile activation |
| AI Gateway video routing | Phase 11C — requires `storyboard_generation` capability route |
| `video_projects` DB table | Requires CTO approval — schema proposal pending |
| `video_sources` DB table | Requires CTO approval — references proposed `media_assets` table |
| `VideoDownloadRecord` persistence | Phase 11C — requires DB table |
| `VideoDeletionRecord` persistence | Phase 11C — requires DB table + scheduled job |
| Face blurring runtime | Phase 11C — requires computer vision integration |
| License plate blurring runtime | Phase 11C — requires computer vision integration |

---

## 11. Dependency Map

```
@/lib/video/video-types       → (no imports)
@/lib/video/video-source      → video-types, @/lib/media
@/lib/video/video-timeline    → video-types, video-source
@/lib/video/video-project     → video-types, video-source, video-timeline
@/lib/video/video-publishing  → video-types
@/lib/video/video-ai          → video-types, video-source, video-project,
                                  @/lib/media, @/lib/ai/agents/types
@/lib/video/video-privacy     → video-types

@/lib/media   → (no knowledge of @/lib/video)
@/lib/marketing → (no knowledge of @/lib/video)
```

Cross-module boundary: VideoProject uses `marketing_asset_id: string | null` to
reference a `MarketingAsset` without importing `@/lib/marketing`. This avoids
circular dependencies while allowing the future orchestration layer to link them.

---

*GYEON Detailer Agent | AI Video Pipeline Specification | Office AZ | 2026-06-26*
